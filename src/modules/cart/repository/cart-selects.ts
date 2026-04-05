import { Prisma } from '@prisma/client';

export const cartItemsSelect = Prisma.validator<Prisma.CartSelect>()({
  id: true,
  userId: true,
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      productId: true,
      variantId: true,
      product: {
        select: {
          title: true,
          isActive: true,
          images: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true },
          },
        },
      },
      variant: {
        select: {
          price: true,
          size: true,
          stock: true,
          isActive: true,
          images: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  },
});
