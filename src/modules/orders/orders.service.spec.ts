import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { PaymentsService } from '../payments/payments.service';
import { OrdersCacheService } from './cache/orders-cache.service';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repository/orders.repository';

type OrdersRepositoryMock = Pick<
  OrdersRepository,
  | 'findAddressForUser'
  | 'runSerializableTransaction'
  | 'findCartForCheckout'
  | 'createOrderWithPayment'
  | 'clearCartItems'
  | 'listOrdersByUser'
  | 'findOrderDetailsByIdForUser'
  | 'updateOrderCancellation'
>;

type PaymentsServiceMock = Pick<PaymentsService, 'createProviderPayment'>;
type OrdersCacheServiceMock = Pick<
  OrdersCacheService,
  | 'ordersListKey'
  | 'orderDetailsKey'
  | 'ordersListTtlSeconds'
  | 'orderDetailsTtlSeconds'
  | 'get'
  | 'set'
  | 'invalidateOrdersForUser'
  | 'invalidateCart'
>;

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: jest.Mocked<OrdersRepositoryMock>;
  let paymentsService: jest.Mocked<PaymentsServiceMock>;
  let cache: jest.Mocked<OrdersCacheServiceMock>;

  beforeEach(() => {
    repository = {
      findAddressForUser: jest.fn(),
      runSerializableTransaction: jest.fn(),
      findCartForCheckout: jest.fn(),
      createOrderWithPayment: jest.fn(),
      clearCartItems: jest.fn(),
      listOrdersByUser: jest.fn(),
      findOrderDetailsByIdForUser: jest.fn(),
      updateOrderCancellation: jest.fn(),
    };
    paymentsService = {
      createProviderPayment: jest.fn(),
    };
    cache = {
      ordersListKey: jest.fn().mockReturnValue('orders:list:user-1'),
      orderDetailsKey: jest.fn().mockReturnValue('orders:details:user-1:order-1'),
      ordersListTtlSeconds: 60,
      orderDetailsTtlSeconds: 90,
      get: jest.fn(),
      set: jest.fn(),
      invalidateOrdersForUser: jest.fn(),
      invalidateCart: jest.fn(),
    };

    service = new OrdersService(
      repository as unknown as OrdersRepository,
      paymentsService as unknown as PaymentsService,
      {
        get<T>(key: string, defaultValue?: T): T {
          const values: Record<string, unknown> = {
            'checkout.currency': 'RUB',
            'checkout.deliveryFixedAmount': 15,
          };
          return (values[key] ?? defaultValue) as T;
        },
      } as ConfigService,
      cache as unknown as OrdersCacheService,
    );
  });

  it('creates order from cart and returns payment confirmation url', async () => {
    repository.runSerializableTransaction.mockImplementation(async (operation) =>
      operation({} as Prisma.TransactionClient),
    );
    repository.findCartForCheckout.mockResolvedValue({
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          quantity: 2,
          unitPrice: new Prisma.Decimal(50),
          productId: 'product-1',
          variantId: 'variant-1',
          product: { title: 'Nike Air', isActive: true, images: [{ url: 'product.png' }] },
          variant: {
            price: new Prisma.Decimal(50),
            size: '42',
            stock: 5,
            isActive: true,
            images: [{ url: 'variant.png' }],
          },
        },
      ],
    });
    repository.createOrderWithPayment.mockResolvedValue({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      paymentId: 'payment-1',
    });
    paymentsService.createProviderPayment.mockResolvedValue({
      orderId: 'order-1',
      status: 'PENDING',
      confirmationUrl: 'https://yookassa.test/redirect',
      providerPaymentId: 'provider-1',
    });

    const result = await service.checkout('user-1', { paymentMethod: 'yookassa' });

    expect(repository.createOrderWithPayment).toHaveBeenCalledTimes(1);
    expect(repository.clearCartItems).toHaveBeenCalledWith(expect.any(Object), 'cart-1');
    expect(paymentsService.createProviderPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'payment-1',
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        userId: 'user-1',
      }),
    );
    expect(cache.invalidateOrdersForUser).toHaveBeenCalledWith('user-1');
    expect(cache.invalidateCart).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      payment: {
        status: 'PENDING',
        confirmationUrl: 'https://yookassa.test/redirect',
      },
    });
  });

  it('throws when checkout is called with empty cart', async () => {
    repository.runSerializableTransaction.mockImplementation(async (operation) =>
      operation({} as Prisma.TransactionClient),
    );
    repository.findCartForCheckout.mockResolvedValue({
      id: 'cart-1',
      items: [],
    });

    await expect(service.checkout('user-1', { paymentMethod: 'yookassa' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('lists orders from cache when present', async () => {
    cache.get.mockResolvedValue([
      {
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        statusLabel: OrderStatus.PENDING,
        statusDate: new Date(),
        itemsPreview: [],
        totalAmount: 100,
        canCancel: true,
      },
    ]);

    const result = await service.listOrders('user-1');

    expect(repository.listOrdersByUser).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('throws not found for missing order details', async () => {
    cache.get.mockResolvedValue(undefined);
    repository.findOrderDetailsByIdForUser.mockResolvedValue(null);

    await expect(service.getOrderById('user-1', 'order-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('cancels allowed order and invalidates cache', async () => {
    repository.findOrderDetailsByIdForUser.mockResolvedValue({
      id: 'order-1',
      number: 'ORD-1',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      currency: 'RUB',
      subtotal: new Prisma.Decimal(100),
      deliveryAmount: new Prisma.Decimal(15),
      totalAmount: new Prisma.Decimal(115),
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveryEta: null,
      deliveredAt: null,
      cancelledAt: null,
      cancelReason: null,
      items: [],
    });

    await service.cancelOrder('user-1', 'order-1', 'No longer needed');

    expect(repository.updateOrderCancellation).toHaveBeenCalledWith('order-1', 'No longer needed');
    expect(cache.invalidateOrdersForUser).toHaveBeenCalledWith('user-1');
  });

  it('rejects cancellation for non-cancellable status', async () => {
    repository.findOrderDetailsByIdForUser.mockResolvedValue({
      id: 'order-1',
      number: 'ORD-1',
      status: OrderStatus.SHIPPED,
      paymentStatus: PaymentStatus.SUCCEEDED,
      currency: 'RUB',
      subtotal: new Prisma.Decimal(100),
      deliveryAmount: new Prisma.Decimal(15),
      totalAmount: new Prisma.Decimal(115),
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveryEta: null,
      deliveredAt: null,
      cancelledAt: null,
      cancelReason: null,
      items: [],
    });

    await expect(service.cancelOrder('user-1', 'order-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
