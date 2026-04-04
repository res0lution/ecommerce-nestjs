import { Injectable, NotFoundException } from '@nestjs/common';

import { ProductSearchIndexProducer } from '@/queues/product-search-index/product-search-index.producer';

import { CatalogCacheService } from './cache/catalog-cache.service';
import type {
  CategoryTreeNode,
  ProductDetailsResponse,
  ProductFiltersResponse,
  ProductListItem,
  ProductListResponse,
  ProductSearchFilters,
} from './catalog.types';
import type { CategoryEntity, ProductEntity } from './entities';
import { CatalogRepository } from './repository/catalog.repository';
import { CatalogSearchService } from './search/catalog-search.service';

type ProductDetailsStaticResponse = Omit<ProductDetailsResponse, 'sizes'>;

@Injectable()
export class CatalogService {
  constructor(
    private readonly cache: CatalogCacheService,
    private readonly repository: CatalogRepository,
    private readonly searchService: CatalogSearchService,
    private readonly searchIndexProducer: ProductSearchIndexProducer,
  ) {}

  async getCategoriesTree(): Promise<CategoryTreeNode[]> {
    const key = this.cache.categoriesListKey();
    const cached = await this.cache.get<CategoryTreeNode[]>(key);
    if (cached) {
      return cached;
    }

    const categories = await this.repository.listCategories();
    const byParent = new Map<string | null, CategoryTreeNode[]>();

    for (const category of categories) {
      const list = byParent.get(category.parentId) ?? [];
      list.push({
        id: category.id,
        name: category.name,
        slug: category.slug,
        children: [],
      });
      byParent.set(category.parentId, list);
    }

    const buildTree = (parentId: string | null): CategoryTreeNode[] => {
      const nodes = byParent.get(parentId) ?? [];
      return nodes.map((node) => ({
        ...node,
        children: buildTree(node.id),
      }));
    };

    const tree = buildTree(null);
    await this.cache.set(key, tree, this.cache.categoriesTtlSeconds);
    return tree;
  }

  async listProducts(filters: ProductSearchFilters): Promise<ProductListResponse> {
    const key = this.cache.productsListKey(filters);
    const cached = await this.cache.get<ProductListResponse>(key);
    if (cached) {
      return cached;
    }

    const categorySlugs = await this.resolveCategorySlugs(filters);
    const elasticResult = await this.searchService.searchProducts({
      ...filters,
      categorySlugs,
    });
    if (elasticResult) {
      await this.cache.set(key, elasticResult, this.cache.productsListTtlSeconds);
      return elasticResult;
    }

    const fallback = await this.repository.listProductsPage(filters);
    const response: ProductListResponse = {
      items: fallback.items.map((product) => this.toListItem(product)),
      total: fallback.total,
    };
    await this.cache.set(key, response, this.cache.productsListTtlSeconds);
    return response;
  }

  async getFilters(category?: string): Promise<ProductFiltersResponse> {
    const key = this.cache.filtersKey(category);
    const cached = await this.cache.get<ProductFiltersResponse>(key);
    if (cached) {
      return cached;
    }

    const categorySlugs = await this.resolveCategorySlugs({
      page: 1,
      limit: 1,
      category,
    });
    const elasticFilters = await this.searchService.getFilters({
      page: 1,
      limit: 1,
      category,
      categorySlugs,
    });
    if (elasticFilters) {
      await this.cache.set(key, elasticFilters, this.cache.filtersTtlSeconds);
      return elasticFilters;
    }

    const facets = await this.repository.getFilterFacets(category);

    const response: ProductFiltersResponse = {
      priceRanges:
        facets.minPrice > 0 || facets.maxPrice > 0
          ? [{ from: facets.minPrice, to: facets.maxPrice }]
          : [],
      sizes: facets.sizes,
      genders: facets.genders,
      sports: facets.sports,
    };
    await this.cache.set(key, response, this.cache.filtersTtlSeconds);
    return response;
  }

  async getProductDetails(slug: string): Promise<ProductDetailsResponse> {
    const key = this.cache.productDetailsKey(slug);
    const cached = await this.cache.get<ProductDetailsStaticResponse>(key);
    if (cached) {
      const sizes = await this.repository.findSizeAvailabilityByProductSlug(slug);
      if (!sizes) {
        await this.cache.delete(key);
        throw new NotFoundException('Product not found');
      }
      return {
        ...cached,
        sizes,
      };
    }

    const product = await this.repository.findProductBySlug(slug);
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    const staticPayload = this.toProductDetailsStatic(product);
    await this.cache.set(key, staticPayload, this.cache.productDetailsTtlSeconds);

    return {
      ...staticPayload,
      sizes: this.toSizeAvailability(product),
    };
  }

  async getRecommendations(productId: string): Promise<ProductListItem[]> {
    const recommendations = await this.repository.findRecommendations(productId, 8);
    return recommendations.map((product) => this.toListItem(product));
  }

  async enqueueReindex(productId: string): Promise<void> {
    await this.searchIndexProducer.enqueueProductReindex(productId);
  }

  async invalidateProductCache(slug: string, categorySlug?: string): Promise<void> {
    await this.cache.invalidateProduct(slug, categorySlug);
  }

  async invalidateCategoryCache(categorySlug?: string): Promise<void> {
    await this.cache.invalidateCategory(categorySlug);
  }

  private toListItem(product: ProductEntity): ProductListItem {
    const minPrice = this.getProductMinPrice(product);
    const firstVariantImage = product.variants
      .flatMap((variant) => variant.images)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const colorsCount = new Set(product.variants.map((variant) => variant.color)).size;
    const hasDiscount = product.variants.some((variant) => variant.oldPrice !== null);
    const badges = [
      ...(product.isBestSeller ? ['Best Seller'] : []),
      ...(hasDiscount ? ['Discount'] : []),
    ];

    return {
      id: product.id,
      title: product.title,
      price: minPrice,
      image: firstVariantImage?.url ?? null,
      badges,
      colorsCount,
    };
  }

  private getProductMinPrice(product: Pick<ProductEntity, 'variants'>): number {
    const prices = product.variants
      .filter((variant) => variant.isActive)
      .map((variant) => variant.price);
    if (prices.length === 0) {
      return 0;
    }
    return Math.min(...prices);
  }

  private toProductDetailsStatic(product: ProductEntity): ProductDetailsStaticResponse {
    const variants = product.variants.map((variant) => ({
      id: variant.id,
      color: variant.color,
      images: variant.images.map((image) => image.url),
    }));
    const attributes: Record<string, string[]> = {};
    for (const attributeEntry of product.attributes) {
      const key = attributeEntry.name;
      const list = attributes[key] ?? [];
      if (!list.includes(attributeEntry.value)) {
        list.push(attributeEntry.value);
      }
      attributes[key] = list;
    }
    const reviewsCount = product.reviews.length;
    const ratingAverage =
      reviewsCount > 0
        ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewsCount
        : 0;

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      price: this.getProductMinPrice(product),
      variants,
      images: product.images.map((image) => image.url),
      attributes,
      rating: Number(ratingAverage.toFixed(2)),
      reviewsCount,
    };
  }

  private toSizeAvailability(
    product: Pick<ProductEntity, 'variants'>,
  ): ProductDetailsResponse['sizes'] {
    const sizeState = new Map<string, boolean>();
    for (const variant of product.variants) {
      const hasStock = variant.stock > 0 && variant.isActive;
      const previous = sizeState.get(variant.size) ?? false;
      sizeState.set(variant.size, previous || hasStock);
    }
    return [...sizeState.entries()]
      .map(([size, available]) => ({ size, available }))
      .sort((a, b) => a.size.localeCompare(b.size));
  }

  private async resolveCategorySlugs(filters: ProductSearchFilters): Promise<string[]> {
    const rootSlugs = new Set<string>();
    if (filters.category !== undefined && filters.category.length > 0) {
      rootSlugs.add(filters.category);
    }
    if (filters.kids === true) {
      rootSlugs.add('kids');
    }
    if (rootSlugs.size === 0) {
      return [];
    }

    const categories = await this.repository.listCategories();
    const byParent = new Map<string | null, Array<{ slug: string; id: string }>>();
    const bySlug = new Map<string, { slug: string; id: string }>();

    for (const category of categories) {
      bySlug.set(category.slug, { slug: category.slug, id: category.id });
      const list = byParent.get(category.parentId) ?? [];
      list.push({ slug: category.slug, id: category.id });
      byParent.set(category.parentId, list);
    }

    const result = new Set<string>();
    const queue: string[] = [];
    for (const slug of rootSlugs) {
      const root = bySlug.get(slug);
      if (root) {
        queue.push(root.id);
        result.add(root.slug);
      }
    }

    const idToSlug = new Map(
      categories.map((category: CategoryEntity) => [category.id, category.slug]),
    );
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === undefined) {
        continue;
      }
      const children = byParent.get(currentId) ?? [];
      for (const child of children) {
        const childSlug = idToSlug.get(child.id);
        if (childSlug !== undefined && !result.has(childSlug)) {
          result.add(childSlug);
          queue.push(child.id);
        }
      }
    }

    return [...result];
  }
}
