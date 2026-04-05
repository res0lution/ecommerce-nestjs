import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

import { PaymentsCacheService } from './cache/payments-cache.service';
import { YooKassaClient } from './clients/yookassa.client';
import type { CreateProviderPaymentInput, PaymentStatusResult } from './payments.types';
import { PaymentsRepository } from './repository/payments.repository';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly defaultReturnUrl: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly repository: PaymentsRepository,
    private readonly configService: ConfigService,
    private readonly yooKassaClient: YooKassaClient,
    private readonly cache: PaymentsCacheService,
  ) {
    this.defaultReturnUrl = this.configService.get<string>(
      'payments.yookassa.returnUrl',
      'http://localhost:3001/checkout/result',
    );
    this.webhookSecret = this.configService.get<string>(
      'payments.yookassa.webhookSecret',
      'dev-yookassa-webhook-secret',
    );
  }

  async getPaymentStatusForOrder(orderId: string, userId: string): Promise<PaymentStatusResult> {
    const payment = await this.repository.findPaymentByOrderForUser(orderId, userId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async createProviderPayment(input: CreateProviderPaymentInput): Promise<PaymentStatusResult> {
    const payment = await this.repository.findById(input.paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (
      payment.providerPaymentId !== null &&
      payment.providerPaymentId.length > 0 &&
      payment.confirmationUrl !== null &&
      payment.confirmationUrl.length > 0
    ) {
      return {
        orderId: payment.orderId,
        status: payment.status,
        confirmationUrl: payment.confirmationUrl,
        providerPaymentId: payment.providerPaymentId,
      };
    }

    const idempotenceKey = payment.idempotenceKey ?? `payment-${payment.id}`;
    await this.repository.saveIdempotenceKeyIfMissing(payment.id, idempotenceKey);
    const returnUrl = input.returnUrl ?? this.defaultReturnUrl;
    const amount = Number(payment.amount.toFixed(2));

    try {
      const providerPayment = await this.yooKassaClient.createPayment({
        amount,
        currency: payment.currency,
        description: `Order #${input.orderNumber}`,
        returnUrl,
        idempotenceKey,
        metadata: {
          orderId: input.orderId,
          userId: input.userId,
        },
      });

      const mappedStatus = this.mapProviderStatus(providerPayment.status);
      const confirmationUrl = providerPayment.confirmation?.confirmation_url ?? null;
      const updated = await this.repository.updateProviderDataIfMissing(payment.id, {
        providerPaymentId: providerPayment.id,
        confirmationUrl,
        status: mappedStatus,
        idempotenceKey,
        rawPayload: providerPayment as Prisma.InputJsonValue,
      });
      if (!updated) {
        const existing = await this.repository.findById(payment.id);
        if (
          existing &&
          existing.providerPaymentId !== null &&
          existing.providerPaymentId.length > 0
        ) {
          return {
            orderId: existing.orderId,
            status: existing.status,
            confirmationUrl: existing.confirmationUrl,
            providerPaymentId: existing.providerPaymentId,
          };
        }
      }

      return {
        orderId: payment.orderId,
        status: mappedStatus,
        confirmationUrl,
        providerPaymentId: providerPayment.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown payment provider error';
      this.logger.error(`Failed to create YooKassa payment: ${message}`);
      throw new ServiceUnavailableException('Payment provider is unavailable');
    }
  }

  async processYooKassaWebhook(payload: Record<string, unknown>): Promise<void> {
    const eventType = this.readString(payload.event) ?? 'unknown';
    const object = this.readObject(payload.object);
    if (!object) {
      return;
    }

    const providerPaymentId = this.readString(object.id);
    if (providerPaymentId === null || providerPaymentId.length === 0) {
      return;
    }

    const eventId =
      this.readString(payload.id) ??
      `${eventType}:${providerPaymentId}:${this.readString(object.created_at) ?? 'na'}`;

    const alreadyProcessed = await this.repository.hasProcessedWebhook(eventId);
    if (alreadyProcessed) {
      return;
    }

    const paymentRecord = await this.repository.findByProviderPaymentId(providerPaymentId);
    if (paymentRecord) {
      const amountObj = this.readObject(object.amount);
      const webhookAmount = this.readString(amountObj?.value);
      const webhookCurrency = this.readString(amountObj?.currency);
      const paymentAmount = paymentRecord.amount.toFixed(2);

      if (
        webhookAmount !== null &&
        webhookAmount.length > 0 &&
        webhookCurrency !== null &&
        webhookCurrency.length > 0 &&
        (webhookAmount !== paymentAmount || webhookCurrency !== paymentRecord.currency)
      ) {
        this.logger.error(
          `Webhook amount mismatch for payment ${providerPaymentId}. expected=${paymentAmount} ${paymentRecord.currency} got=${webhookAmount} ${webhookCurrency}`,
        );
      }
    }

    const providerStatus = this.readString(object.status) ?? 'pending';
    const paymentStatus = this.mapProviderStatus(providerStatus);
    const orderStatus = this.mapOrderStatusFromPayment(paymentStatus);
    const paidAt = paymentStatus === PaymentStatus.SUCCEEDED ? new Date() : null;
    const cancellationDetails = this.readObject(object.cancellation_details);
    const failureReason = this.readString(cancellationDetails?.reason) ?? null;

    await this.repository.processWebhookInTransaction({
      eventId,
      eventType,
      payload: payload as Prisma.InputJsonValue,
      providerPaymentId,
      paymentStatus,
      orderStatus,
      paidAt,
      failureReason,
    });

    if (paymentRecord) {
      await this.cache.invalidateOrdersForUser(paymentRecord.userId);
      await this.cache.invalidateOrderDetails(paymentRecord.userId, paymentRecord.orderId);
    }
  }

  validateWebhookSignature(payload: Record<string, unknown>, signatureHeader?: string): void {
    const provided = this.normalizeSignature(signatureHeader);
    if (provided === null || provided.length === 0) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = this.computeWebhookSignature(payload);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(provided, 'hex');
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private mapProviderStatus(status: string): PaymentStatus {
    switch (status) {
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'waiting_for_capture':
        return PaymentStatus.WAITING_FOR_CAPTURE;
      case 'canceled':
        return PaymentStatus.CANCELED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private mapOrderStatusFromPayment(status: PaymentStatus): OrderStatus | null {
    if (status === PaymentStatus.SUCCEEDED) {
      return OrderStatus.PAID;
    }
    return null;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private computeWebhookSignature(payload: Record<string, unknown>): string {
    return createHmac('sha256', this.webhookSecret).update(JSON.stringify(payload)).digest('hex');
  }

  private normalizeSignature(signatureHeader?: string): string | null {
    if (signatureHeader === undefined) {
      return null;
    }

    const value = signatureHeader.trim();
    if (value.length === 0) {
      return null;
    }
    if (value.startsWith('sha256=')) {
      return value.slice('sha256='.length);
    }
    return value;
  }
}
