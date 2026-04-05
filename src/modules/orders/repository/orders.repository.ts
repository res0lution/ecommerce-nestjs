import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';
import { cartItemsSelect } from '@/modules/cart/repository/cart-selects';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAddressForUser(userId: string, addressId: string): Promise<{ id: string } | null> {
    const address = await this.prisma.userAddress.findUnique({
      where: { id: addressId },
      select: {
        id: true,
        userId: true,
      },
    });
    if (!address || address.userId !== userId) {
      return null;
    }
    return { id: address.id };
  }

  async findCartForCheckout(
    userId: string,
    tx?: TxClient,
  ): Promise<{
    id: string;
    items: Array<{
      id: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      productId: string;
      variantId: string;
      product: { title: string; isActive: boolean; images: Array<{ url: string }> };
      variant: {
        price: Prisma.Decimal;
        size: string;
        stock: number;
        isActive: boolean;
        images: Array<{ url: string }>;
      };
    }>;
  } | null> {
    const client = tx ?? this.prisma;
    return client.cart.findUnique({
      where: { userId },
      select: cartItemsSelect,
    });
  }

  async createOrderWithPayment(
    tx: TxClient,
    input: {
      userId: string;
      orderNumber: string;
      currency: string;
      subtotal: Prisma.Decimal;
      deliveryAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      items: Array<{
        productId: string;
        variantId: string;
        titleSnapshot: string;
        imageUrlSnapshot: string | null;
        sizeSnapshot: string | null;
        quantity: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }>;
    },
  ): Promise<{ orderId: string; orderNumber: string; paymentId: string }> {
    const order = await tx.order.create({
      data: {
        userId: input.userId,
        number: input.orderNumber,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        currency: input.currency,
        subtotal: input.subtotal,
        deliveryAmount: input.deliveryAmount,
        totalAmount: input.totalAmount,
      },
      select: {
        id: true,
      },
    });

    await tx.orderItem.createMany({
      data: input.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        variantId: item.variantId,
        titleSnapshot: item.titleSnapshot,
        imageUrlSnapshot: item.imageUrlSnapshot,
        sizeSnapshot: item.sizeSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    });

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: 'YOOKASSA',
        status: 'PENDING',
        amount: input.totalAmount,
        currency: input.currency,
      },
      select: {
        id: true,
      },
    });

    return {
      orderId: order.id,
      orderNumber: input.orderNumber,
      paymentId: payment.id,
    };
  }

  async clearCartItems(tx: TxClient, cartId: string): Promise<void> {
    await tx.cartItem.deleteMany({
      where: { cartId },
    });
  }

  async runSerializableTransaction<T>(operation: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => operation(tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async listOrdersByUser(userId: string): Promise<
    Array<{
      id: string;
      number: string;
      status: OrderStatus;
      createdAt: Date;
      updatedAt: Date;
      cancelledAt: Date | null;
      deliveredAt: Date | null;
      totalAmount: Prisma.Decimal;
      items: Array<{
        titleSnapshot: string;
        imageUrlSnapshot: string | null;
      }>;
    }>
  > {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        cancelledAt: true,
        deliveredAt: true,
        totalAmount: true,
        items: {
          take: 3,
          select: {
            titleSnapshot: true,
            imageUrlSnapshot: true,
          },
        },
      },
    });
  }

  async findOrderDetailsByIdForUser(
    userId: string,
    orderId: string,
  ): Promise<{
    id: string;
    number: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    currency: string;
    subtotal: Prisma.Decimal;
    deliveryAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    deliveryEta: Date | null;
    deliveredAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    items: Array<{
      id: string;
      productId: string;
      variantId: string;
      titleSnapshot: string;
      imageUrlSnapshot: string | null;
      sizeSnapshot: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }>;
  } | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        userId: true,
        status: true,
        paymentStatus: true,
        currency: true,
        subtotal: true,
        deliveryAmount: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        deliveryEta: true,
        deliveredAt: true,
        cancelledAt: true,
        cancelReason: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            titleSnapshot: true,
            imageUrlSnapshot: true,
            sizeSnapshot: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
    });
    if (!order || order.userId !== userId) {
      return null;
    }

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotal: order.subtotal,
      deliveryAmount: order.deliveryAmount,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deliveryEta: order.deliveryEta,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      items: order.items,
    };
  }

  async updateOrderCancellation(orderId: string, reason: string | null): Promise<void> {
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
  }
}
