export enum ProductSearchIndexJobName {
  ReindexProduct = 'reindex-product',
}

export type ProductSearchIndexPayload = {
  productId: string;
};
