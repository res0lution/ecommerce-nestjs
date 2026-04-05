import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { calculateCheckoutTotals } from '@/common/utils/checkout-pricing.util';

import { CartCacheService } from './cache/cart-cache.service';
import type {
  AddCartItemInput,
  CartItemResult,
  CartResult,
  UpdateCartItemInput,
} from './cart.types';
import { CartRepository } from './repository/cart.repository';

@Injectable()
export class CartService {
  private readonly deliveryFixedAmount: Prisma.Decimal;

  constructor(
    private readonly repository: CartRepository,
    private readonly configService: ConfigService,
    private readonly cache: CartCacheService,
  ) {
    const fixed = this.configService.get<number>('checkout.deliveryFixedAmount', 0);
    this.deliveryFixedAmount = new Prisma.Decimal(fixed);
  }

  async getCart(userId: string): Promise<CartResult> {
    const cacheKey = this.cache.cartKey(userId);
    const cached = await this.cache.get<CartResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const cart = await this.repository.findByUserIdWithItems(userId);
    const result = !cart ? this.emptyCart() : this.toCartResult(cart.items);
    await this.cache.set(cacheKey, result, this.cache.cartTtlSeconds);
    return result;
  }

  async addItem(userId: string, input: AddCartItemInput): Promise<CartResult> {
    const cart = await this.repository.getOrCreateByUserId(userId);
    const variant = await this.repository.findVariantForCart(input.variantId);

    if (!variant || !variant.isActive || !variant.product.isActive) {
      throw new NotFoundException('Variant not found');
    }

    if (variant.stock <= 0) {
      throw new ConflictException('Variant is out of stock');
    }

    const existing = await this.repository.findItemByCartAndVariant(cart.id, input.variantId);
    const requestedQuantity = (existing?.quantity ?? 0) + input.quantity;
    if (requestedQuantity > variant.stock) {
      throw new ConflictException('Requested quantity exceeds available stock');
    }

    if (existing) {
      await this.repository.updateItem(existing.id, {
        quantity: requestedQuantity,
        unitPrice: variant.price,
      });
    } else {
      await this.repository.createItem({
        cartId: cart.id,
        productId: variant.productId,
        variantId: variant.id,
        quantity: input.quantity,
        unitPrice: variant.price,
      });
    }

    await this.cache.invalidateCart(userId);
    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: UpdateCartItemInput,
  ): Promise<CartResult> {
    const cartItem = await this.repository.findItemByIdForUser(userId, itemId);
    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    const variant = await this.repository.findVariantForCart(cartItem.variantId);
    if (!variant || !variant.isActive || !variant.product.isActive) {
      throw new ConflictException('Variant is unavailable');
    }

    if (input.quantity > variant.stock) {
      throw new ConflictException('Requested quantity exceeds available stock');
    }

    await this.repository.updateItem(cartItem.id, {
      quantity: input.quantity,
      unitPrice: variant.price,
    });

    await this.cache.invalidateCart(userId);
    return this.getCart(userId);
  }

  async deleteItem(userId: string, itemId: string): Promise<void> {
    const cartItem = await this.repository.findItemByIdForUser(userId, itemId);
    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }
    await this.repository.deleteItem(cartItem.id);
    await this.cache.invalidateCart(userId);
  }

  async clearCart(userId: string): Promise<void> {
    await this.repository.clearCartByUserId(userId);
    await this.cache.invalidateCart(userId);
  }

  private emptyCart(): CartResult {
    return {
      items: [],
      subtotal: 0,
      deliveryAmount: 0,
      totalAmount: 0,
    };
  }

  private toCartResult(
    items: Array<{
      id: string;
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      product: { title: string; images: Array<{ url: string }> };
      variant: { size: string; stock: number; images: Array<{ url: string }> };
    }>,
  ): CartResult {
    const mappedItems: CartItemResult[] = items.map((item) => {
      const lineTotal = item.unitPrice.mul(item.quantity);
      const variantImage = item.variant.images[0]?.url ?? null;
      const productImage = item.product.images[0]?.url ?? null;
      return {
        itemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        title: item.product.title,
        image: variantImage ?? productImage,
        size: item.variant.size ?? null,
        price: this.decimalToNumber(item.unitPrice),
        quantity: item.quantity,
        lineTotal: this.decimalToNumber(lineTotal),
      };
    });

    const lineTotals = mappedItems.map((item) => new Prisma.Decimal(item.lineTotal));
    const totals = calculateCheckoutTotals(lineTotals, this.deliveryFixedAmount);

    return {
      items: mappedItems,
      subtotal: this.decimalToNumber(totals.subtotal),
      deliveryAmount: this.decimalToNumber(totals.deliveryAmount),
      totalAmount: this.decimalToNumber(totals.totalAmount),
    };
  }

  private decimalToNumber(value: Prisma.Decimal): number {
    return Number(value.toFixed(2));
  }
}
