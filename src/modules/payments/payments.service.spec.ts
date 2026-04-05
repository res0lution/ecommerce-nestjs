import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { createHmac } from 'crypto';

import { PaymentsCacheService } from './cache/payments-cache.service';
import { YooKassaClient } from './clients/yookassa.client';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './repository/payments.repository';

type PaymentsRepositoryMock = Pick<
  PaymentsRepository,
  | 'findPaymentByOrderForUser'
  | 'findById'
  | 'saveIdempotenceKeyIfMissing'
  | 'updateProviderData'
  | 'updateProviderDataIfMissing'
  | 'hasProcessedWebhook'
  | 'findByProviderPaymentId'
  | 'processWebhookInTransaction'
>;

type YooKassaClientMock = Pick<YooKassaClient, 'createPayment'>;
type PaymentsCacheServiceMock = Pick<
  PaymentsCacheService,
  'invalidateOrdersForUser' | 'invalidateOrderDetails'
>;

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repository: jest.Mocked<PaymentsRepositoryMock>;
  let yooKassaClient: jest.Mocked<YooKassaClientMock>;
  let cache: jest.Mocked<PaymentsCacheServiceMock>;

  beforeEach(() => {
    repository = {
      findPaymentByOrderForUser: jest.fn(),
      findById: jest.fn(),
      saveIdempotenceKeyIfMissing: jest.fn(),
      updateProviderData: jest.fn(),
      updateProviderDataIfMissing: jest.fn(),
      hasProcessedWebhook: jest.fn(),
      findByProviderPaymentId: jest.fn(),
      processWebhookInTransaction: jest.fn(),
    };
    yooKassaClient = {
      createPayment: jest.fn(),
    };
    cache = {
      invalidateOrdersForUser: jest.fn(),
      invalidateOrderDetails: jest.fn(),
    };

    service = new PaymentsService(
      repository as unknown as PaymentsRepository,
      {
        get<T>(key: string, defaultValue?: T): T {
          const values: Record<string, unknown> = {
            'payments.yookassa.returnUrl': 'http://localhost:3001/checkout/result',
            'payments.yookassa.webhookSecret': 'test-webhook-secret',
          };
          return (values[key] ?? defaultValue) as T;
        },
      } as ConfigService,
      yooKassaClient as unknown as YooKassaClient,
      cache as unknown as PaymentsCacheService,
    );
  });

  it('maps waiting_for_capture provider status', async () => {
    repository.findById.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      status: PaymentStatus.PENDING,
      amount: new Prisma.Decimal(115),
      currency: 'RUB',
      providerPaymentId: null,
      confirmationUrl: null,
      idempotenceKey: null,
    });
    yooKassaClient.createPayment.mockResolvedValue({
      id: 'provider-1',
      status: 'waiting_for_capture',
      confirmation: {
        type: 'redirect',
        confirmation_url: 'https://yookassa.test/pay',
      },
    });

    repository.updateProviderDataIfMissing.mockResolvedValue(true);
    const result = await service.createProviderPayment({
      paymentId: 'payment-1',
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      userId: 'user-1',
    });

    expect(repository.saveIdempotenceKeyIfMissing).toHaveBeenCalledWith(
      'payment-1',
      'payment-payment-1',
    );
    expect(repository.updateProviderDataIfMissing).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({
        providerPaymentId: 'provider-1',
        status: PaymentStatus.WAITING_FOR_CAPTURE,
      }),
    );
    expect(result.status).toBe(PaymentStatus.WAITING_FOR_CAPTURE);
  });

  it('handles succeeded webhook and maps order status to PAID', async () => {
    repository.hasProcessedWebhook.mockResolvedValue(false);
    repository.findByProviderPaymentId.mockResolvedValue({
      id: 'payment-1',
      amount: new Prisma.Decimal(115),
      currency: 'RUB',
      orderId: 'order-1',
      userId: 'user-1',
    });

    await service.processYooKassaWebhook({
      id: 'event-1',
      event: 'payment.succeeded',
      object: {
        id: 'provider-1',
        status: 'succeeded',
        amount: { value: '115.00', currency: 'RUB' },
      },
    });

    expect(repository.processWebhookInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        providerPaymentId: 'provider-1',
        paymentStatus: PaymentStatus.SUCCEEDED,
        orderStatus: OrderStatus.PAID,
      }),
    );
    expect(cache.invalidateOrdersForUser).toHaveBeenCalledWith('user-1');
    expect(cache.invalidateOrderDetails).toHaveBeenCalledWith('user-1', 'order-1');
  });

  it('reuses existing provider payment when update race happens', async () => {
    repository.findById
      .mockResolvedValueOnce({
        id: 'payment-1',
        orderId: 'order-1',
        status: PaymentStatus.PENDING,
        amount: new Prisma.Decimal(115),
        currency: 'RUB',
        providerPaymentId: null,
        confirmationUrl: null,
        idempotenceKey: null,
      })
      .mockResolvedValueOnce({
        id: 'payment-1',
        orderId: 'order-1',
        status: PaymentStatus.PENDING,
        amount: new Prisma.Decimal(115),
        currency: 'RUB',
        providerPaymentId: 'provider-existing',
        confirmationUrl: 'https://yookassa.test/existing',
        idempotenceKey: 'payment-payment-1',
      });
    yooKassaClient.createPayment.mockResolvedValue({
      id: 'provider-new',
      status: 'pending',
      confirmation: {
        type: 'redirect',
        confirmation_url: 'https://yookassa.test/new',
      },
    });
    repository.updateProviderDataIfMissing.mockResolvedValue(false);

    const result = await service.createProviderPayment({
      paymentId: 'payment-1',
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      userId: 'user-1',
    });

    expect(result.providerPaymentId).toBe('provider-existing');
    expect(result.confirmationUrl).toBe('https://yookassa.test/existing');
  });

  it('rejects webhook with invalid signature', () => {
    expect(() =>
      service.validateWebhookSignature(
        { id: 'event-1', object: { id: 'provider-1' } },
        'sha256=invalid',
      ),
    ).toThrow('Invalid webhook signature');
  });

  it('accepts webhook with valid signature', () => {
    const payload = { id: 'event-1', object: { id: 'provider-1' } };
    const signature = createHmac('sha256', 'test-webhook-secret')
      .update(JSON.stringify(payload))
      .digest('hex');

    expect(() => service.validateWebhookSignature(payload, `sha256=${signature}`)).not.toThrow();
  });
});
