import { OrderStatus, PaymentProvider, PaymentStatus, Prisma, PrismaClient } from '@prisma/client';

import type { CatalogSeedResult } from './catalog.seed';
import type { UsersSeedResult } from './users.seed';

interface CartItemSeed {
  productKey: string;
  variantSku: string;
  quantity: number;
  unitPrice: string;
}

interface OrderItemSeed {
  productKey: string;
  variantSku: string;
  titleSnapshot: string;
  imageUrlSnapshot: string | null;
  sizeSnapshot: string | null;
  quantity: number;
  unitPrice: string;
}

interface OrderSeed {
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  deliveryAmount: string;
  cancelReason?: string;
  cancelledAt?: Date;
  deliveredAt?: Date;
  deliveryEta?: Date;
  items: OrderItemSeed[];
  payment: {
    providerPaymentId?: string;
    status: PaymentStatus;
    amount: string;
    confirmationUrl?: string;
    idempotenceKey?: string;
    paidAt?: Date;
    failureReason?: string;
    rawPayload?: Prisma.InputJsonValue;
  };
}

const cartItems: CartItemSeed[] = [
  {
    productKey: 'pegasus-41',
    variantSku: 'SEED-PEG41-BLK-42',
    quantity: 1,
    unitPrice: '129.99',
  },
  {
    productKey: 'kids-revolution-7',
    variantSku: 'SEED-KID7-GRN-35',
    quantity: 2,
    unitPrice: '79.90',
  },
];

const orders: OrderSeed[] = [
  {
    number: 'SEED-2026-0001',
    status: OrderStatus.PAID,
    paymentStatus: PaymentStatus.SUCCEEDED,
    currency: 'RUB',
    deliveryAmount: '15.00',
    deliveredAt: new Date('2026-03-02T10:00:00.000Z'),
    items: [
      {
        productKey: 'pegasus-41',
        variantSku: 'SEED-PEG41-BLK-42',
        titleSnapshot: 'Air Zoom Pegasus 41',
        imageUrlSnapshot: 'https://cdn.seed.local/peg41/main.jpg',
        sizeSnapshot: '42',
        quantity: 1,
        unitPrice: '129.99',
      },
    ],
    payment: {
      providerPaymentId: 'seed-payment-paid-0001',
      status: PaymentStatus.SUCCEEDED,
      amount: '144.99',
      confirmationUrl: 'https://pay.seed.local/confirm/paid-0001',
      idempotenceKey: 'seed-idemp-paid-0001',
      paidAt: new Date('2026-03-01T09:20:00.000Z'),
      rawPayload: { source: 'seed', event: 'payment.succeeded' },
    },
  },
  {
    number: 'SEED-2026-0002',
    status: OrderStatus.PROCESSING,
    paymentStatus: PaymentStatus.WAITING_FOR_CAPTURE,
    currency: 'RUB',
    deliveryAmount: '15.00',
    deliveryEta: new Date('2026-05-15T00:00:00.000Z'),
    items: [
      {
        productKey: 'metcon-9',
        variantSku: 'SEED-MET9-GRY-42',
        titleSnapshot: 'Metcon 9',
        imageUrlSnapshot: 'https://cdn.seed.local/metcon9/main.jpg',
        sizeSnapshot: '42',
        quantity: 1,
        unitPrice: '139.00',
      },
      {
        productKey: 'kids-revolution-7',
        variantSku: 'SEED-KID7-GRN-35',
        titleSnapshot: 'Revolution 7 Kids',
        imageUrlSnapshot: 'https://cdn.seed.local/kids7/main.jpg',
        sizeSnapshot: '35',
        quantity: 1,
        unitPrice: '79.90',
      },
    ],
    payment: {
      providerPaymentId: 'seed-payment-hold-0002',
      status: PaymentStatus.WAITING_FOR_CAPTURE,
      amount: '233.90',
      confirmationUrl: 'https://pay.seed.local/confirm/hold-0002',
      idempotenceKey: 'seed-idemp-hold-0002',
      rawPayload: { source: 'seed', event: 'payment.waiting_for_capture' },
    },
  },
  {
    number: 'SEED-2026-0003',
    status: OrderStatus.CANCELLED,
    paymentStatus: PaymentStatus.CANCELED,
    currency: 'RUB',
    deliveryAmount: '15.00',
    cancelReason: 'Customer changed mind',
    cancelledAt: new Date('2026-04-10T12:10:00.000Z'),
    items: [
      {
        productKey: 'infinity-run-4-w',
        variantSku: 'SEED-INF4-PNK-39',
        titleSnapshot: 'React Infinity Run 4',
        imageUrlSnapshot: 'https://cdn.seed.local/inf4/main.jpg',
        sizeSnapshot: '39',
        quantity: 1,
        unitPrice: '149.50',
      },
    ],
    payment: {
      providerPaymentId: 'seed-payment-cancel-0003',
      status: PaymentStatus.CANCELED,
      amount: '164.50',
      idempotenceKey: 'seed-idemp-cancel-0003',
      failureReason: 'Canceled by user before capture',
      rawPayload: { source: 'seed', event: 'payment.canceled' },
    },
  },
];

export async function seedCommerce(
  prisma: PrismaClient,
  catalog: CatalogSeedResult,
  users: UsersSeedResult,
): Promise<void> {
  const buyerId = users.userIds.buyer;
  const buyerCart = await prisma.cart.upsert({
    where: { userId: buyerId },
    update: {},
    create: { userId: buyerId },
    select: { id: true },
  });

  await prisma.cartItem.deleteMany({
    where: { cartId: buyerCart.id },
  });

  await prisma.cartItem.createMany({
    data: cartItems.map((item) => ({
      cartId: buyerCart.id,
      productId: catalog.productIds[item.productKey],
      variantId: catalog.variantIds[item.variantSku],
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  });

  for (const orderSeed of orders) {
    const subtotal = orderSeed.items
      .reduce((acc, item) => acc + Number(item.unitPrice) * item.quantity, 0)
      .toFixed(2);
    const totalAmount = (Number(subtotal) + Number(orderSeed.deliveryAmount)).toFixed(2);

    const order = await prisma.order.upsert({
      where: { number: orderSeed.number },
      update: {
        userId: buyerId,
        status: orderSeed.status,
        paymentStatus: orderSeed.paymentStatus,
        currency: orderSeed.currency,
        subtotal,
        deliveryAmount: orderSeed.deliveryAmount,
        totalAmount,
        deliveryEta: orderSeed.deliveryEta ?? null,
        deliveredAt: orderSeed.deliveredAt ?? null,
        cancelledAt: orderSeed.cancelledAt ?? null,
        cancelReason: orderSeed.cancelReason ?? null,
      },
      create: {
        userId: buyerId,
        number: orderSeed.number,
        status: orderSeed.status,
        paymentStatus: orderSeed.paymentStatus,
        currency: orderSeed.currency,
        subtotal,
        deliveryAmount: orderSeed.deliveryAmount,
        totalAmount,
        deliveryEta: orderSeed.deliveryEta ?? null,
        deliveredAt: orderSeed.deliveredAt ?? null,
        cancelledAt: orderSeed.cancelledAt ?? null,
        cancelReason: orderSeed.cancelReason ?? null,
      },
      select: { id: true },
    });

    await prisma.orderItem.deleteMany({
      where: { orderId: order.id },
    });

    await prisma.orderItem.createMany({
      data: orderSeed.items.map((item) => {
        const lineTotal = (Number(item.unitPrice) * item.quantity).toFixed(2);
        return {
          orderId: order.id,
          productId: catalog.productIds[item.productKey],
          variantId: catalog.variantIds[item.variantSku],
          titleSnapshot: item.titleSnapshot,
          imageUrlSnapshot: item.imageUrlSnapshot,
          sizeSnapshot: item.sizeSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
        };
      }),
    });

    await prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        provider: PaymentProvider.YOOKASSA,
        providerPaymentId: orderSeed.payment.providerPaymentId ?? null,
        status: orderSeed.payment.status,
        amount: orderSeed.payment.amount,
        currency: orderSeed.currency,
        confirmationUrl: orderSeed.payment.confirmationUrl ?? null,
        idempotenceKey: orderSeed.payment.idempotenceKey ?? null,
        paidAt: orderSeed.payment.paidAt ?? null,
        failureReason: orderSeed.payment.failureReason ?? null,
        rawPayload: orderSeed.payment.rawPayload ?? Prisma.JsonNull,
      },
      create: {
        orderId: order.id,
        provider: PaymentProvider.YOOKASSA,
        providerPaymentId: orderSeed.payment.providerPaymentId ?? null,
        status: orderSeed.payment.status,
        amount: orderSeed.payment.amount,
        currency: orderSeed.currency,
        confirmationUrl: orderSeed.payment.confirmationUrl ?? null,
        idempotenceKey: orderSeed.payment.idempotenceKey ?? null,
        paidAt: orderSeed.payment.paidAt ?? null,
        failureReason: orderSeed.payment.failureReason ?? null,
        rawPayload: orderSeed.payment.rawPayload ?? Prisma.JsonNull,
      },
    });
  }

  const webhookEvents = [
    {
      eventId: 'seed-webhook-payment-succeeded-0001',
      eventType: 'payment.succeeded',
      payload: { source: 'seed', orderNumber: 'SEED-2026-0001' },
    },
    {
      eventId: 'seed-webhook-payment-waiting-0002',
      eventType: 'payment.waiting_for_capture',
      payload: { source: 'seed', orderNumber: 'SEED-2026-0002' },
    },
  ];

  for (const event of webhookEvents) {
    await prisma.paymentWebhookEvent.upsert({
      where: { eventId: event.eventId },
      update: {
        provider: PaymentProvider.YOOKASSA,
        eventType: event.eventType,
        payload: event.payload,
      },
      create: {
        provider: PaymentProvider.YOOKASSA,
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.payload,
      },
    });
  }
}
