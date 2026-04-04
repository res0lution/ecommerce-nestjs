import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';

import type { ProductSearchFilters } from '../catalog.types';
import type { ProductSizeAvailability } from '../catalog.types';
import type { CategoryEntity, ProductAttributeEntity, ProductEntity } from '../entities';

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<CategoryEntity[]> {
    return this.prisma.category.findMany({
      select: { id: true, name: true, slug: true, parentId: true, level: true },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  async findCategoryBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
    return this.prisma.category.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
  }

  async listCategoryDescendants(rootCategoryId: string): Promise<string[]> {
    const rows = await this.prisma.category.findMany({
      select: { id: true, parentId: true },
    });
    const byParent = new Map<string, string[]>();

    for (const row of rows) {
      if (row.parentId === null) {
        continue;
      }
      const list = byParent.get(row.parentId) ?? [];
      list.push(row.id);
      byParent.set(row.parentId, list);
    }

    const queue = [rootCategoryId];
    const visited = new Set<string>(queue);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) {
        continue;
      }
      const children = byParent.get(current) ?? [];
      for (const child of children) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      }
    }

    return [...visited];
  }

  async listProductsForFiltering(filters: ProductSearchFilters): Promise<ProductEntity[]> {
    const where = await this.buildProductWhere(filters);
    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
        attributeValues: {
          include: {
            attributeValue: {
              include: { attribute: true },
            },
          },
        },
        reviews: true,
      },
    });

    return products.map((product) => this.mapProduct(product));
  }

  async listProductsPage(
    filters: ProductSearchFilters,
  ): Promise<{ items: ProductEntity[]; total: number }> {
    const where = await this.buildProductWhere(filters);
    const total = await this.prisma.product.count({ where });
    if (total === 0) {
      return { items: [], total: 0 };
    }

    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;
    const orderByPrice = filters.sort === 'price_asc' || filters.sort === 'price_desc';
    const pageIds = orderByPrice
      ? await this.listProductIdsByMinPrice(where, filters, skip, take)
      : (
          await this.prisma.product.findMany({
            where,
            select: { id: true },
            orderBy: { popularityScore: 'desc' },
            skip,
            take,
          })
        ).map((item) => item.id);

    if (pageIds.length === 0) {
      return { items: [], total };
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: pageIds } },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
        attributeValues: {
          include: {
            attributeValue: {
              include: { attribute: true },
            },
          },
        },
        reviews: true,
      },
    });

    const byId = new Map(products.map((product) => [product.id, this.mapProduct(product)]));
    return {
      items: pageIds
        .map((id) => byId.get(id))
        .filter((item): item is ProductEntity => item !== undefined),
      total,
    };
  }

  async getFilterFacets(category?: string): Promise<{
    minPrice: number;
    maxPrice: number;
    sizes: string[];
    genders: string[];
    sports: string[];
  }> {
    const where = await this.buildProductWhere({ page: 1, limit: 1, category });
    const variantWhere: Prisma.ProductVariantWhereInput = {
      isActive: true,
      product: where,
    };

    const [priceAgg, sizeRows, genderRows, sportRows] = await this.prisma.$transaction([
      this.prisma.productVariant.aggregate({
        where: variantWhere,
        _min: { price: true },
        _max: { price: true },
      }),
      this.prisma.productVariant.findMany({
        where: variantWhere,
        select: { size: true },
        distinct: ['size'],
      }),
      this.prisma.productAttributeValue.findMany({
        where: {
          product: where,
          attributeValue: {
            attribute: {
              name: {
                equals: 'Gender',
                mode: 'insensitive',
              },
            },
          },
        },
        select: {
          attributeValue: {
            select: { value: true },
          },
        },
        distinct: ['attributeValueId'],
      }),
      this.prisma.productAttributeValue.findMany({
        where: {
          product: where,
          attributeValue: {
            attribute: {
              name: {
                equals: 'Sport',
                mode: 'insensitive',
              },
            },
          },
        },
        select: {
          attributeValue: {
            select: { value: true },
          },
        },
        distinct: ['attributeValueId'],
      }),
    ]);

    const uniqueSorted = (values: string[]): string[] =>
      [...new Set(values.filter((value) => value.length > 0))].sort((a, b) => a.localeCompare(b));

    return {
      minPrice: Number(priceAgg._min.price ?? 0),
      maxPrice: Number(priceAgg._max.price ?? 0),
      sizes: uniqueSorted(sizeRows.map((row) => row.size)),
      genders: uniqueSorted(genderRows.map((row) => row.attributeValue.value)),
      sports: uniqueSorted(sportRows.map((row) => row.attributeValue.value)),
    };
  }

  async findProductBySlug(slug: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
        attributeValues: {
          include: {
            attributeValue: {
              include: { attribute: true },
            },
          },
        },
        reviews: true,
      },
    });

    return product ? this.mapProduct(product) : null;
  }

  async findSizeAvailabilityByProductSlug(slug: string): Promise<ProductSizeAvailability[] | null> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        isActive: true,
        variants: {
          where: { isActive: true },
          select: {
            size: true,
            stock: true,
          },
        },
      },
    });
    if (!product || !product.isActive) {
      return null;
    }

    const sizeState = new Map<string, boolean>();
    for (const variant of product.variants) {
      const hasStock = variant.stock > 0;
      const previous = sizeState.get(variant.size) ?? false;
      sizeState.set(variant.size, previous || hasStock);
    }

    return [...sizeState.entries()]
      .map(([size, available]) => ({ size, available }))
      .sort((a, b) => a.size.localeCompare(b.size));
  }

  async findRecommendations(productId: string, limit: number): Promise<ProductEntity[]> {
    const target = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        attributeValues: {
          select: { attributeValueId: true },
        },
      },
    });
    if (!target) {
      return [];
    }

    const similarByCategory = await this.prisma.product.findMany({
      where: {
        id: { not: productId },
        isActive: true,
        categoryId: target.categoryId,
      },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
        attributeValues: {
          include: {
            attributeValue: {
              include: { attribute: true },
            },
          },
        },
        reviews: true,
      },
      take: limit * 3,
    });

    const targetAttrIds = new Set(target.attributeValues.map((a) => a.attributeValueId));
    const scored = similarByCategory
      .map((candidate) => {
        const overlap = candidate.attributeValues.reduce((score, attr) => {
          return score + (targetAttrIds.has(attr.attributeValueId) ? 1 : 0);
        }, 0);
        return { candidate, overlap };
      })
      .sort(
        (a, b) =>
          b.overlap - a.overlap || b.candidate.popularityScore - a.candidate.popularityScore,
      )
      .slice(0, limit)
      .map((entry) => entry.candidate);

    return scored.map((product) => this.mapProduct(product));
  }

  async findProductForIndex(productId: string): Promise<ProductEntity | null> {
    return this.findProductById(productId);
  }

  async findProductById(productId: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
        attributeValues: {
          include: {
            attributeValue: {
              include: { attribute: true },
            },
          },
        },
        reviews: true,
      },
    });

    return product ? this.mapProduct(product) : null;
  }

  private mapProduct(
    product: Prisma.ProductGetPayload<{
      include: {
        category: true;
        variants: { include: { images: true } };
        images: true;
        attributeValues: {
          include: {
            attributeValue: {
              include: {
                attribute: true;
              };
            };
          };
        };
        reviews: true;
      };
    }>,
  ): ProductEntity {
    const attributes: ProductAttributeEntity[] = product.attributeValues.map((entry) => ({
      name: entry.attributeValue.attribute.name,
      value: entry.attributeValue.value,
    }));

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      categoryId: product.categoryId,
      brand: product.brand,
      gender: product.gender,
      isActive: product.isActive,
      isBestSeller: product.isBestSeller,
      popularityScore: product.popularityScore,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
        parentId: product.category.parentId,
        level: product.category.level,
      },
      variants: product.variants.map((variant) => ({
        id: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        price: Number(variant.price),
        oldPrice: variant.oldPrice !== null ? Number(variant.oldPrice) : null,
        color: variant.color,
        size: variant.size,
        stock: variant.stock,
        isActive: variant.isActive,
        images: variant.images.map((image) => ({
          id: image.id,
          productId: image.productId,
          variantId: image.variantId,
          url: image.url,
          sortOrder: image.sortOrder,
        })),
      })),
      images: product.images.map((image) => ({
        id: image.id,
        productId: image.productId,
        variantId: image.variantId,
        url: image.url,
        sortOrder: image.sortOrder,
      })),
      attributes,
      reviews: product.reviews.map((review) => ({
        id: review.id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
      })),
    };
  }

  private async resolveCategoryFilterIds(filters: ProductSearchFilters): Promise<string[] | null> {
    const hasCategory = Boolean(filters.category);
    const hasKids = filters.kids === true;
    if (!hasCategory && !hasKids) {
      return null;
    }

    const rootSlugs = new Set<string>();
    if (filters.category !== undefined && filters.category.length > 0) {
      rootSlugs.add(filters.category);
    }
    if (hasKids) {
      rootSlugs.add('kids');
    }

    const roots = await this.prisma.category.findMany({
      where: {
        slug: {
          in: [...rootSlugs],
        },
      },
      select: {
        id: true,
      },
    });

    if (roots.length === 0) {
      return [];
    }

    const ids = new Set<string>();
    for (const root of roots) {
      const descendants = await this.listCategoryDescendants(root.id);
      for (const id of descendants) {
        ids.add(id);
      }
    }
    return [...ids];
  }

  private async buildProductWhere(
    filters: ProductSearchFilters,
  ): Promise<Prisma.ProductWhereInput> {
    const categoryIds = await this.resolveCategoryFilterIds(filters);
    const hasVariantFilter =
      (filters.size !== undefined && filters.size.length > 0) ||
      filters.priceFrom !== undefined ||
      filters.priceTo !== undefined;
    const andClauses: Prisma.ProductWhereInput[] = [];

    if (filters.gender !== undefined && filters.gender.length > 0) {
      andClauses.push({
        attributeValues: {
          some: {
            attributeValue: {
              attribute: { name: { equals: 'Gender', mode: 'insensitive' } },
              value: { equals: filters.gender, mode: 'insensitive' },
            },
          },
        },
      });
    }
    if (filters.sport !== undefined && filters.sport.length > 0) {
      andClauses.push({
        attributeValues: {
          some: {
            attributeValue: {
              attribute: { name: { equals: 'Sport', mode: 'insensitive' } },
              value: { equals: filters.sport, mode: 'insensitive' },
            },
          },
        },
      });
    }

    return {
      isActive: true,
      ...(categoryIds !== null ? { categoryId: { in: categoryIds } } : {}),
      ...(hasVariantFilter
        ? {
            variants: {
              some: {
                isActive: true,
                ...(filters.size !== undefined && filters.size.length > 0
                  ? { size: filters.size }
                  : {}),
                ...(filters.priceFrom !== undefined || filters.priceTo !== undefined
                  ? {
                      price: {
                        ...(filters.priceFrom !== undefined ? { gte: filters.priceFrom } : {}),
                        ...(filters.priceTo !== undefined ? { lte: filters.priceTo } : {}),
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    };
  }

  private async listProductIdsByMinPrice(
    where: Prisma.ProductWhereInput,
    filters: ProductSearchFilters,
    skip: number,
    take: number,
  ): Promise<string[]> {
    const direction = filters.sort === 'price_desc' ? 'desc' : 'asc';
    const rows = await this.prisma.productVariant.groupBy({
      by: ['productId'],
      where: {
        isActive: true,
        product: where,
        ...(filters.size !== undefined && filters.size.length > 0 ? { size: filters.size } : {}),
        ...(filters.priceFrom !== undefined || filters.priceTo !== undefined
          ? {
              price: {
                ...(filters.priceFrom !== undefined ? { gte: filters.priceFrom } : {}),
                ...(filters.priceTo !== undefined ? { lte: filters.priceTo } : {}),
              },
            }
          : {}),
      },
      _min: { price: true },
      orderBy: [{ _min: { price: direction } }, { productId: 'asc' }],
      skip,
      take,
    });

    return rows.map((row) => row.productId);
  }
}
