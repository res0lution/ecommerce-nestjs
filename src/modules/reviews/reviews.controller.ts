import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';

import type { AccessPayload, OkResult } from '../auth/auth.types';
import { OkResponseDto } from '../auth/dto/auth-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListProductReviewsQueryDto } from './dto/list-product-reviews-query.dto';
import { ProductReviewsListResponseDto, ReviewResponseDto } from './dto/review-response.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';
import type { ProductReviewsListResult, ReviewResult } from './reviews.types';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Get('products/:id/reviews')
  @ApiOperation({ summary: 'Get product reviews' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductReviewsListResponseDto })
  async getProductReviews(
    @Param('id', ParseUUIDPipe) productId: string,
    @Query() query: ListProductReviewsQueryDto,
  ): Promise<ProductReviewsListResult> {
    return this.service.listProductReviews(productId, {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      sort: query.sort,
      rating: query.rating,
    });
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Create review' })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({ status: 201, type: ReviewResponseDto })
  async createReview(
    @CurrentUser() user: AccessPayload,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResult> {
    return this.service.createReview(user.sub, dto);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own review' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateReviewDto })
  @ApiResponse({ status: 200, type: ReviewResponseDto })
  async updateReview(
    @CurrentUser() user: AccessPayload,
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewResult> {
    return this.service.updateReview(user.sub, reviewId, dto);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete own review' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkResponseDto })
  async deleteReview(
    @CurrentUser() user: AccessPayload,
    @Param('id', ParseUUIDPipe) reviewId: string,
  ): Promise<OkResult> {
    await this.service.deleteReview(user.sub, reviewId);
    return { ok: true };
  }
}
