import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CatalogService } from './catalog.service';
import type {
  CategoryTreeNode,
  ProductDetailsResponse,
  ProductFiltersResponse,
  ProductListResponse,
} from './catalog.types';
import {
  CategoryTreeNodeDto,
  ProductDetailsResponseDto,
  ProductFiltersResponseDto,
  ProductListResponseDto,
} from './dto/catalog-response.dto';
import { FiltersQueryDto } from './dto/filters-query.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Get categories tree' })
  @ApiResponse({ status: 200, type: CategoryTreeNodeDto, isArray: true })
  async getCategories(): Promise<CategoryTreeNode[]> {
    return this.service.getCategoriesTree();
  }

  @Get('products')
  @ApiOperation({ summary: 'Get catalog products list' })
  @ApiResponse({ status: 200, type: ProductListResponseDto })
  async getProducts(@Query() query: ListProductsQueryDto): Promise<ProductListResponse> {
    return this.service.listProducts({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      category: query.category,
      sort: query.sort,
      gender: query.gender,
      kids: query.kids,
      priceFrom: query.priceFrom,
      priceTo: query.priceTo,
      sport: query.sport,
      size: query.size,
    });
  }

  @Get('products/filters')
  @ApiOperation({ summary: 'Get category-aware product filters' })
  @ApiResponse({ status: 200, type: ProductFiltersResponseDto })
  async getProductFilters(@Query() query: FiltersQueryDto): Promise<ProductFiltersResponse> {
    return this.service.getFilters(query.category);
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Get product details by slug' })
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, type: ProductDetailsResponseDto })
  async getProductDetails(@Param('slug') slug: string): Promise<ProductDetailsResponse> {
    return this.service.getProductDetails(slug);
  }

  @Get('products/:id/recommendations')
  @ApiOperation({ summary: 'Get product recommendations' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductListResponseDto })
  async getRecommendations(@Param('id', ParseUUIDPipe) id: string): Promise<ProductListResponse> {
    const items = await this.service.getRecommendations(id);
    return {
      items,
      total: items.length,
    };
  }
}
