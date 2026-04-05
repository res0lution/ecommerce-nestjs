import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';

import { cartItemsSelect } from './cart-selects';

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateByUserId(userId: string): Promise<{ id: string; userId: string }> {
    return this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true, userId: true },
    });
  }

  async findByUserIdWithItems(userId: string): Promise<{
    id: string;
    userId: string;
    items: Array<{
      id: string;
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      product: { title: string; images: Array<{ url: string }> };
      variant: {
        price: Prisma.Decimal;
        size: string;
        stock: number;
        isActive: boolean;
        images: Array<{ url: string }>;
      };
    }>;
  } | null> {
    return this.prisma.cart.findUnique({
      where: { userId },
      select: cartItemsSelect,
    });
  }

  async findItemByCartAndVariant(
    cartId: string,
    variantId: string,
  ): Promise<{ id: string; quantity: number } | null> {
    return this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
      select: { id: true, quantity: true },
    });
  }

  async findItemByIdForUser(
    userId: string,
    itemId: string,
  ): Promise<{ id: string; cartId: string; variantId: string } | null> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        cartId: true,
        variantId: true,
        cart: {
          select: {
            userId: true,
          },
        },
      },
    });
    if (!item || item.cart.userId !== userId) {
      return null;
    }
    return {
      id: item.id,
      cartId: item.cartId,
      variantId: item.variantId,
    };
  }

  async findVariantForCart(variantId: string): Promise<{
    id: string;
    productId: string;
    stock: number;
    isActive: boolean;
    price: Prisma.Decimal;
    size: string;
    product: { isActive: boolean };
  } | null> {
    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
        stock: true,
        isActive: true,
        price: true,
        size: true,
        product: {
          select: {
            isActive: true,
          },
        },
      },
    });
  }

  async createItem(input: {
    cartId: string;
    productId: string;
    variantId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
  }): Promise<void> {
    await this.prisma.cartItem.create({
      data: input,
    });
  }

  async updateItem(
    itemId: string,
    input: {
      quantity?: number;
      unitPrice?: Prisma.Decimal;
    },
  ): Promise<void> {
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: input,
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });
  }

  async clearCartByUserId(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: {
        cart: { userId },
      },
    });
  }
}
