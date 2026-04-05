import { PrismaClient, ProductGender } from '@prisma/client';

type IdMap = Record<string, string>;

interface CategorySeed {
  key: string;
  name: string;
  slug: string;
  level: number;
  parentKey?: string;
}

interface ProductSeed {
  key: string;
  title: string;
  slug: string;
  description: string;
  categoryKey: string;
  brand: string;
  gender: ProductGender;
  isActive: boolean;
  isBestSeller: boolean;
  popularityScore: number;
  attributeValueKeys: string[];
}

interface VariantSeed {
  sku: string;
  productKey: string;
  price: string;
  oldPrice: string | null;
  color: string;
  size: string;
  stock: number;
  isActive: boolean;
}

interface ImageSeed {
  productKey: string;
  variantSku?: string;
  url: string;
  sortOrder: number;
}

export interface CatalogSeedResult {
  categoryIds: IdMap;
  productIds: IdMap;
  variantIds: IdMap;
  attributeValueIds: IdMap;
}

const categories: CategorySeed[] = [
  { key: 'men', name: 'Men', slug: 'men', level: 0 },
  { key: 'women', name: 'Women', slug: 'women', level: 0 },
  { key: 'kids', name: 'Kids', slug: 'kids', level: 0 },
  {
    key: 'men-running',
    name: 'Running Shoes',
    slug: 'men-running-shoes',
    level: 1,
    parentKey: 'men',
  },
  {
    key: 'men-lifestyle',
    name: 'Lifestyle Sneakers',
    slug: 'men-lifestyle-sneakers',
    level: 1,
    parentKey: 'men',
  },
  {
    key: 'women-running',
    name: 'Women Running',
    slug: 'women-running-shoes',
    level: 1,
    parentKey: 'women',
  },
  {
    key: 'kids-running',
    name: 'Kids Running',
    slug: 'kids-running-shoes',
    level: 1,
    parentKey: 'kids',
  },
];

const attributeDefinition = [
  {
    name: 'Gender',
    values: [
      { key: 'gender-men', value: 'Men' },
      { key: 'gender-women', value: 'Women' },
      { key: 'gender-unisex', value: 'Unisex' },
    ],
  },
  {
    name: 'Sport',
    values: [
      { key: 'sport-running', value: 'Running' },
      { key: 'sport-training', value: 'Training' },
      { key: 'sport-lifestyle', value: 'Lifestyle' },
    ],
  },
  {
    name: 'Material',
    values: [
      { key: 'material-mesh', value: 'Mesh' },
      { key: 'material-knit', value: 'Knit' },
      { key: 'material-leather', value: 'Leather' },
    ],
  },
];

const products: ProductSeed[] = [
  {
    key: 'pegasus-41',
    title: 'Air Zoom Pegasus 41',
    slug: 'air-zoom-pegasus-41',
    description: 'Responsive daily running shoes with balanced cushioning.',
    categoryKey: 'men-running',
    brand: 'Nike',
    gender: ProductGender.MEN,
    isActive: true,
    isBestSeller: true,
    popularityScore: 95,
    attributeValueKeys: ['gender-men', 'sport-running', 'material-mesh'],
  },
  {
    key: 'metcon-9',
    title: 'Metcon 9',
    slug: 'metcon-9',
    description: 'Stable training shoes for gym sessions and mixed workouts.',
    categoryKey: 'men-lifestyle',
    brand: 'Nike',
    gender: ProductGender.MEN,
    isActive: true,
    isBestSeller: false,
    popularityScore: 76,
    attributeValueKeys: ['gender-men', 'sport-training', 'material-knit'],
  },
  {
    key: 'infinity-run-4-w',
    title: 'React Infinity Run 4',
    slug: 'react-infinity-run-4-women',
    description: 'Soft supportive ride for long-distance daily runs.',
    categoryKey: 'women-running',
    brand: 'Nike',
    gender: ProductGender.WOMEN,
    isActive: true,
    isBestSeller: true,
    popularityScore: 84,
    attributeValueKeys: ['gender-women', 'sport-running', 'material-knit'],
  },
  {
    key: 'kids-revolution-7',
    title: 'Revolution 7 Kids',
    slug: 'revolution-7-kids',
    description: 'Lightweight kids running shoes for school and playground.',
    categoryKey: 'kids-running',
    brand: 'Nike',
    gender: ProductGender.UNISEX,
    isActive: true,
    isBestSeller: false,
    popularityScore: 62,
    attributeValueKeys: ['gender-unisex', 'sport-running', 'material-mesh'],
  },
];

const variants: VariantSeed[] = [
  {
    sku: 'SEED-PEG41-BLK-42',
    productKey: 'pegasus-41',
    price: '129.99',
    oldPrice: '149.99',
    color: 'black',
    size: '42',
    stock: 14,
    isActive: true,
  },
  {
    sku: 'SEED-PEG41-BLU-43',
    productKey: 'pegasus-41',
    price: '129.99',
    oldPrice: null,
    color: 'blue',
    size: '43',
    stock: 9,
    isActive: true,
  },
  {
    sku: 'SEED-MET9-GRY-42',
    productKey: 'metcon-9',
    price: '139.00',
    oldPrice: null,
    color: 'gray',
    size: '42',
    stock: 6,
    isActive: true,
  },
  {
    sku: 'SEED-INF4-PNK-39',
    productKey: 'infinity-run-4-w',
    price: '149.50',
    oldPrice: '169.00',
    color: 'pink',
    size: '39',
    stock: 11,
    isActive: true,
  },
  {
    sku: 'SEED-KID7-GRN-35',
    productKey: 'kids-revolution-7',
    price: '79.90',
    oldPrice: null,
    color: 'green',
    size: '35',
    stock: 15,
    isActive: true,
  },
];

const images: ImageSeed[] = [
  { productKey: 'pegasus-41', url: 'https://cdn.seed.local/peg41/main.jpg', sortOrder: 0 },
  {
    productKey: 'pegasus-41',
    variantSku: 'SEED-PEG41-BLK-42',
    url: 'https://cdn.seed.local/peg41/black-42.jpg',
    sortOrder: 1,
  },
  { productKey: 'metcon-9', url: 'https://cdn.seed.local/metcon9/main.jpg', sortOrder: 0 },
  { productKey: 'infinity-run-4-w', url: 'https://cdn.seed.local/inf4/main.jpg', sortOrder: 0 },
  { productKey: 'kids-revolution-7', url: 'https://cdn.seed.local/kids7/main.jpg', sortOrder: 0 },
];

export async function seedCatalog(prisma: PrismaClient): Promise<CatalogSeedResult> {
  const categoryIds: IdMap = {};
  const productIds: IdMap = {};
  const variantIds: IdMap = {};
  const attributeValueIds: IdMap = {};

  const rootCategories = categories.filter((item) => item.parentKey === undefined);
  for (const category of rootCategories) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        level: category.level,
        parentId: null,
      },
      create: {
        name: category.name,
        slug: category.slug,
        level: category.level,
      },
    });
    categoryIds[category.key] = row.id;
  }

  const childCategories = categories.filter((item) => item.parentKey !== undefined);
  for (const category of childCategories) {
    const parentId = categoryIds[category.parentKey as string];
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        level: category.level,
        parentId,
      },
      create: {
        name: category.name,
        slug: category.slug,
        level: category.level,
        parentId,
      },
    });
    categoryIds[category.key] = row.id;
  }

  for (const attribute of attributeDefinition) {
    const attributeRow = await prisma.attribute.upsert({
      where: { name: attribute.name },
      update: {},
      create: { name: attribute.name },
    });

    for (const value of attribute.values) {
      const valueRow = await prisma.attributeValue.upsert({
        where: {
          attributeId_value: {
            attributeId: attributeRow.id,
            value: value.value,
          },
        },
        update: {
          value: value.value,
        },
        create: {
          attributeId: attributeRow.id,
          value: value.value,
        },
      });
      attributeValueIds[value.key] = valueRow.id;
    }
  }

  for (const product of products) {
    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        title: product.title,
        description: product.description,
        categoryId: categoryIds[product.categoryKey],
        brand: product.brand,
        gender: product.gender,
        isActive: product.isActive,
        isBestSeller: product.isBestSeller,
        popularityScore: product.popularityScore,
      },
      create: {
        title: product.title,
        slug: product.slug,
        description: product.description,
        categoryId: categoryIds[product.categoryKey],
        brand: product.brand,
        gender: product.gender,
        isActive: product.isActive,
        isBestSeller: product.isBestSeller,
        popularityScore: product.popularityScore,
      },
    });
    productIds[product.key] = row.id;
  }

  for (const variant of variants) {
    const row = await prisma.productVariant.upsert({
      where: { sku: variant.sku },
      update: {
        productId: productIds[variant.productKey],
        price: variant.price,
        oldPrice: variant.oldPrice,
        color: variant.color,
        size: variant.size,
        stock: variant.stock,
        isActive: variant.isActive,
      },
      create: {
        productId: productIds[variant.productKey],
        sku: variant.sku,
        price: variant.price,
        oldPrice: variant.oldPrice,
        color: variant.color,
        size: variant.size,
        stock: variant.stock,
        isActive: variant.isActive,
      },
    });
    variantIds[variant.sku] = row.id;
  }

  await prisma.productImage.deleteMany({
    where: {
      productId: {
        in: Object.values(productIds),
      },
    },
  });

  await prisma.productImage.createMany({
    data: images.map((image) => ({
      productId: productIds[image.productKey],
      variantId: image.variantSku != null ? variantIds[image.variantSku] : null,
      url: image.url,
      sortOrder: image.sortOrder,
    })),
  });

  await prisma.productAttributeValue.deleteMany({
    where: {
      productId: {
        in: Object.values(productIds),
      },
    },
  });

  await prisma.productAttributeValue.createMany({
    data: products.flatMap((product) =>
      product.attributeValueKeys.map((attributeValueKey) => ({
        productId: productIds[product.key],
        attributeValueId: attributeValueIds[attributeValueKey],
      })),
    ),
    skipDuplicates: true,
  });

  return { categoryIds, productIds, variantIds, attributeValueIds };
}
