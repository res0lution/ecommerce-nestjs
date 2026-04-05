import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { CartCacheService } from './cache/cart-cache.service';
import { CartService } from './cart.service';
import { CartRepository } from './repository/cart.repository';

type CartRepositoryMock = Pick<
  CartRepository,
  | 'findByUserIdWithItems'
  | 'getOrCreateByUserId'
  | 'findVariantForCart'
  | 'findItemByCartAndVariant'
  | 'updateItem'
  | 'createItem'
  | 'findItemByIdForUser'
  | 'deleteItem'
  | 'clearCartByUserId'
>;
type CartCacheServiceMock = Pick<
  CartCacheService,
  'cartKey' | 'cartTtlSeconds' | 'get' | 'set' | 'invalidateCart'
>;

describe('CartService', () => {
  let service: CartService;
  let repository: jest.Mocked<CartRepositoryMock>;
  let cache: jest.Mocked<CartCacheServiceMock>;

  beforeEach(() => {
    repository = {
      findByUserIdWithItems: jest.fn(),
      getOrCreateByUserId: jest.fn(),
      findVariantForCart: jest.fn(),
      findItemByCartAndVariant: jest.fn(),
      updateItem: jest.fn(),
      createItem: jest.fn(),
      findItemByIdForUser: jest.fn(),
      deleteItem: jest.fn(),
      clearCartByUserId: jest.fn(),
    };
    cache = {
      cartKey: jest.fn().mockReturnValue('cart:user-1'),
      cartTtlSeconds: 30,
      get: jest.fn(),
      set: jest.fn(),
      invalidateCart: jest.fn(),
    };

    service = new CartService(
      repository as unknown as CartRepository,
      {
        get<T>(key: string, defaultValue?: T): T {
          const values: Record<string, unknown> = {
            'checkout.deliveryFixedAmount': 15,
          };
          return (values[key] ?? defaultValue) as T;
        },
      } as ConfigService,
      cache as unknown as CartCacheService,
    );
  });

  it('calculates subtotal and totals from cart items', async () => {
    cache.get.mockResolvedValue(undefined);
    repository.findByUserIdWithItems.mockResolvedValue({
      id: 'cart-1',
      userId: 'user-1',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: 'variant-1',
          quantity: 2,
          unitPrice: new Prisma.Decimal(50),
          product: { title: 'Nike Air', images: [{ url: 'product.png' }] },
          variant: {
            price: new Prisma.Decimal(50),
            size: '42',
            stock: 10,
            isActive: true,
            images: [{ url: 'variant.png' }],
          },
        },
      ],
    });

    const result = await service.getCart('user-1');

    expect(result.subtotal).toBe(100);
    expect(result.deliveryAmount).toBe(15);
    expect(result.totalAmount).toBe(115);
    expect(result.items[0]).toMatchObject({
      itemId: 'item-1',
      title: 'Nike Air',
      image: 'variant.png',
      size: '42',
      quantity: 2,
      price: 50,
      lineTotal: 100,
    });
    expect(cache.set).toHaveBeenCalledWith('cart:user-1', expect.any(Object), 30);
  });

  it('throws conflict when requested quantity exceeds stock', async () => {
    repository.getOrCreateByUserId.mockResolvedValue({ id: 'cart-1', userId: 'user-1' });
    repository.findVariantForCart.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      stock: 3,
      isActive: true,
      price: new Prisma.Decimal(99),
      size: '42',
      product: { isActive: true },
    });
    repository.findItemByCartAndVariant.mockResolvedValue({ id: 'item-1', quantity: 2 });

    await expect(
      service.addItem('user-1', {
        variantId: 'variant-1',
        quantity: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns cart from cache when present', async () => {
    cache.get.mockResolvedValue({
      items: [],
      subtotal: 0,
      deliveryAmount: 0,
      totalAmount: 0,
    });

    const result = await service.getCart('user-1');

    expect(repository.findByUserIdWithItems).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(0);
  });

  it('invalidates cache on clear cart', async () => {
    await service.clearCart('user-1');
    expect(cache.invalidateCart).toHaveBeenCalledWith('user-1');
  });

  it('throws not found for delete missing item', async () => {
    repository.findItemByIdForUser.mockResolvedValue(null);
    await expect(service.deleteItem('user-1', 'item-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
