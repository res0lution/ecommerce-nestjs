import { Injectable } from '@nestjs/common';
import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPaymentByOrderForUser(
    orderId: string,
    userId: string,
  ): Promise<{
    orderId: string;
    status: PaymentStatus;
    confirmationUrl: string | null;
    providerPaymentId: string | null;
  } | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        status: true,
        confirmationUrl: true,
        providerPaymentId: true,
        order: {
          select: {
            userId: true,
          },
        },
      },
    });
    if (!payment || payment.order.userId !== userId) {
      return null;
    }
    return {
      orderId: payment.orderId,
      status: payment.status,
      confirmationUrl: payment.confirmationUrl,
      providerPaymentId: payment.providerPaymentId,
    };
  }

  async findById(paymentId: string): Promise<{
    id: string;
    orderId: string;
    status: PaymentStatus;
    amount: Prisma.Decimal;
    currency: string;
    providerPaymentId: string | null;
    confirmationUrl: string | null;
    idempotenceKey: string | null;
  } | null> {
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        orderId: true,
        status: true,
        amount: true,
        currency: true,
        providerPaymentId: true,
        confirmationUrl: true,
        idempotenceKey: true,
      },
    });
  }

  async saveIdempotenceKeyIfMissing(paymentId: string, idempotenceKey: string): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        idempotenceKey: null,
      },
      data: {
        idempotenceKey,
      },
    });
  }

  async updateProviderData(
    paymentId: string,
    data: {
      providerPaymentId: string;
      confirmationUrl: string | null;
      status: PaymentStatus;
      idempotenceKey: string;
      rawPayload: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  }

  async updateProviderDataIfMissing(
    paymentId: string,
    data: {
      providerPaymentId: string;
      confirmationUrl: string | null;
      status: PaymentStatus;
      idempotenceKey: string;
      rawPayload: Prisma.InputJsonValue;
    },
  ): Promise<boolean> {
    const updated = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        providerPaymentId: null,
      },
      data,
    });

    return updated.count > 0;
  }

  async hasProcessedWebhook(eventId: string): Promise<boolean> {
    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { eventId },
      select: { id: true },
    });
    return existing !== null;
  }

  async processWebhookInTransaction(input: {
    eventId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    providerPaymentId: string;
    paymentStatus: PaymentStatus;
    orderStatus: OrderStatus | null;
    paidAt: Date | null;
    failureReason: string | null;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existingEvent = await tx.paymentWebhookEvent.findUnique({
        where: { eventId: input.eventId },
        select: { id: true },
      });
      if (existingEvent) {
        return;
      }

      await tx.paymentWebhookEvent.create({
        data: {
          provider: 'YOOKASSA',
          eventId: input.eventId,
          eventType: input.eventType,
          payload: input.payload,
        },
      });

      const payment = await tx.payment.findFirst({
        where: {
          provider: 'YOOKASSA',
          providerPaymentId: input.providerPaymentId,
        },
        select: {
          id: true,
          orderId: true,
        },
      });

      if (!payment) {
        return;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: input.paymentStatus,
          paidAt: input.paidAt,
          failureReason: input.failureReason,
          rawPayload: input.payload,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: input.paymentStatus,
          ...(input.orderStatus !== null ? { status: input.orderStatus } : {}),
        },
      });
    });
  }

  async findByProviderPaymentId(providerPaymentId: string): Promise<{
    id: string;
    amount: Prisma.Decimal;
    currency: string;
    orderId: string;
    userId: string;
  } | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId },
      select: {
        id: true,
        provider: true,
        amount: true,
        currency: true,
        orderId: true,
        order: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!payment || payment.provider !== 'YOOKASSA') {
      return null;
    }

    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      orderId: payment.orderId,
      userId: payment.order.userId,
    };
  }
}
