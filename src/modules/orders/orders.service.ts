import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { calculateCheckoutTotals } from '@/common/utils/checkout-pricing.util';

import { PaymentsService } from '../payments/payments.service';
import { OrdersCacheService } from './cache/orders-cache.service';
import type {
  CheckoutInput,
  CheckoutResult,
  OrderDetailsResult,
  OrderListItemResult,
} from './orders.types';
import { OrdersRepository } from './repository/orders.repository';

const CANCELLABLE_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
]);

@Injectable()
export class OrdersService {
  private readonly currency: string;
  private readonly deliveryFixedAmount: Prisma.Decimal;

  constructor(
    private readonly repository: OrdersRepository,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly cache: OrdersCacheService,
  ) {
    this.currency = this.configService.get<string>('checkout.currency', 'RUB');
    this.deliveryFixedAmount = new Prisma.Decimal(
      this.configService.get<number>('checkout.deliveryFixedAmount', 0),
    );
  }

  async checkout(userId: string, input: CheckoutInput): Promise<CheckoutResult> {
    if (input.paymentMethod !== 'yookassa') {
      throw new UnprocessableEntityException('Unsupported payment method');
    }

    if (input.addressId !== undefined) {
      const address = await this.repository.findAddressForUser(userId, input.addressId);
      if (!address) {
        throw new NotFoundException('Address not found');
      }
    }

    const checkoutContext = await this.repository.runSerializableTransaction(async (tx) => {
      const cart = await this.repository.findCartForCheckout(userId, tx);
      if (!cart || cart.items.length === 0) {
        throw new UnprocessableEntityException('Cart is empty');
      }

      const orderItems = cart.items.map((item) => {
        if (!item.product.isActive || !item.variant.isActive) {
          throw new ConflictException('One or more items are unavailable');
        }
        if (item.quantity > item.variant.stock || item.variant.stock <= 0) {
          throw new ConflictException('One or more items are out of stock');
        }
        if (!item.unitPrice.eq(item.variant.price)) {
          throw new UnprocessableEntityException('Cart price is outdated');
        }

        const imageUrl = item.variant.images[0]?.url ?? item.product.images[0]?.url ?? null;
        const lineTotal = item.unitPrice.mul(item.quantity);

        return {
          productId: item.productId,
          variantId: item.variantId,
          titleSnapshot: item.product.title,
          imageUrlSnapshot: imageUrl,
          sizeSnapshot: item.variant.size ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
        };
      });

      const totals = calculateCheckoutTotals(
        orderItems.map((item) => item.lineTotal),
        this.deliveryFixedAmount,
      );

      const created = await this.repository.createOrderWithPayment(tx, {
        userId,
        orderNumber: this.generateOrderNumber(),
        currency: this.currency,
        subtotal: totals.subtotal,
        deliveryAmount: totals.deliveryAmount,
        totalAmount: totals.totalAmount,
        items: orderItems,
      });
      await this.repository.clearCartItems(tx, cart.id);

      return {
        ...created,
      };
    });

    const providerPayment = await this.paymentsService.createProviderPayment({
      paymentId: checkoutContext.paymentId,
      orderId: checkoutContext.orderId,
      orderNumber: checkoutContext.orderNumber,
      userId,
      returnUrl: input.returnUrl,
    });

    await this.cache.invalidateOrdersForUser(userId);
    // Checkout clears cart items in transaction; invalidate cart cache key explicitly.
    await this.cache.invalidateCart(userId);

    return {
      orderId: checkoutContext.orderId,
      orderNumber: checkoutContext.orderNumber,
      payment: {
        status: providerPayment.status,
        confirmationUrl: providerPayment.confirmationUrl,
      },
    };
  }

  async listOrders(userId: string): Promise<OrderListItemResult[]> {
    const cacheKey = this.cache.ordersListKey(userId);
    const cached = await this.cache.get<OrderListItemResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const orders = await this.repository.listOrdersByUser(userId);
    const result = orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.number,
      statusLabel: order.status,
      statusDate: order.cancelledAt ?? order.deliveredAt ?? order.updatedAt ?? order.createdAt,
      itemsPreview: order.items.map((item) => ({
        title: item.titleSnapshot,
        image: item.imageUrlSnapshot,
      })),
      totalAmount: Number(order.totalAmount.toFixed(2)),
      canCancel: CANCELLABLE_ORDER_STATUSES.has(order.status),
    }));
    await this.cache.set(cacheKey, result, this.cache.ordersListTtlSeconds);
    return result;
  }

  async getOrderById(userId: string, orderId: string): Promise<OrderDetailsResult> {
    const cacheKey = this.cache.orderDetailsKey(userId, orderId);
    const cached = await this.cache.get<OrderDetailsResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const order = await this.repository.findOrderDetailsByIdForUser(userId, orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const result = {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotal: Number(order.subtotal.toFixed(2)),
      deliveryAmount: Number(order.deliveryAmount.toFixed(2)),
      totalAmount: Number(order.totalAmount.toFixed(2)),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deliveryEta: order.deliveryEta,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        title: item.titleSnapshot,
        image: item.imageUrlSnapshot,
        size: item.sizeSnapshot,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice.toFixed(2)),
        lineTotal: Number(item.lineTotal.toFixed(2)),
      })),
      canCancel: CANCELLABLE_ORDER_STATUSES.has(order.status),
    };
    await this.cache.set(cacheKey, result, this.cache.orderDetailsTtlSeconds);
    return result;
  }

  async cancelOrder(userId: string, orderId: string, reason?: string): Promise<void> {
    const order = await this.repository.findOrderDetailsByIdForUser(userId, orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!CANCELLABLE_ORDER_STATUSES.has(order.status)) {
      throw new ConflictException('Order cannot be cancelled in current status');
    }

    const normalizedReason = reason?.trim() ?? '';
    await this.repository.updateOrderCancellation(
      order.id,
      normalizedReason.length > 0 ? normalizedReason : null,
    );
    await this.cache.invalidateOrdersForUser(userId);
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `ORD-${y}${m}${d}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
