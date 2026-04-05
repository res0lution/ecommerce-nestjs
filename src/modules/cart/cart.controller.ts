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

import { CurrentUser } from '@/common/decorators/current-user.decorator';

import type { AccessPayload, OkResult } from '../auth/auth.types';
import { OkResponseDto } from '../auth/dto/auth-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import type { CartResult } from './cart.types';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  async getCart(@CurrentUser() user: AccessPayload): Promise<CartResult> {
    return this.service.getCart(user.sub);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({ status: 201, type: CartResponseDto })
  async addItem(
    @CurrentUser() user: AccessPayload,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResult> {
    return this.service.addItem(user.sub, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, type: CartResponseDto })
  async updateItem(
    @CurrentUser() user: AccessPayload,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResult> {
    return this.service.updateItem(user.sub, itemId, dto);
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete item from cart' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkResponseDto })
  async deleteItem(
    @CurrentUser() user: AccessPayload,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<OkResult> {
    await this.service.deleteItem(user.sub, itemId);
    return { ok: true };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear user cart' })
  @ApiResponse({ status: 200, type: OkResponseDto })
  async clearCart(@CurrentUser() user: AccessPayload): Promise<OkResult> {
    await this.service.clearCart(user.sub);
    return { ok: true };
  }
}
