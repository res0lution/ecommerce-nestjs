export type CartItemResult = {
  itemId: string;
  productId: string;
  variantId: string;
  title: string;
  image: string | null;
  size: string | null;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type CartResult = {
  items: CartItemResult[];
  subtotal: number;
  deliveryAmount: number;
  totalAmount: number;
};

export type AddCartItemInput = {
  variantId: string;
  quantity: number;
};

export type UpdateCartItemInput = {
  quantity: number;
};
