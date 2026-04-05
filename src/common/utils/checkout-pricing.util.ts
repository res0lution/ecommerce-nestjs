import { Prisma } from '@prisma/client';

export type CheckoutTotals = {
  subtotal: Prisma.Decimal;
  deliveryAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

export function calculateCheckoutTotals(
  lineTotals: Prisma.Decimal[],
  deliveryFixedAmount: Prisma.Decimal,
): CheckoutTotals {
  const subtotal = lineTotals.reduce(
    (acc, lineTotal) => acc.plus(lineTotal),
    new Prisma.Decimal(0),
  );
  const deliveryAmount = subtotal.gt(0) ? deliveryFixedAmount : new Prisma.Decimal(0);

  return {
    subtotal,
    deliveryAmount,
    totalAmount: subtotal.plus(deliveryAmount),
  };
}
