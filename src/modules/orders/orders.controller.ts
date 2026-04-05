import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CheckoutOrderDto } from './dto/checkout-order.dto';
import {
  CheckoutOrderResponseDto,
  OrderDetailsResponseDto,
  OrderListItemResponseDto,
} from './dto/order-response.dto';
import { OrdersService } from './orders.service';
import type { CheckoutResult, OrderDetailsResult, OrderListItemResult } from './orders.types';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Checkout current cart and create order' })
  @ApiBody({ type: CheckoutOrderDto })
  @ApiResponse({ status: 201, type: CheckoutOrderResponseDto })
  async checkout(
    @CurrentUser() user: AccessPayload,
    @Body() dto: CheckoutOrderDto,
  ): Promise<CheckoutResult> {
    return this.service.checkout(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user orders list' })
  @ApiResponse({ status: 200, type: OrderListItemResponseDto, isArray: true })
  async listOrders(@CurrentUser() user: AccessPayload): Promise<OrderListItemResult[]> {
    return this.service.listOrders(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user order details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OrderDetailsResponseDto })
  async getOrder(
    @CurrentUser() user: AccessPayload,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<OrderDetailsResult> {
    return this.service.getOrderById(user.sub, orderId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: CancelOrderDto })
  @ApiResponse({ status: 200, type: OkResponseDto })
  async cancelOrder(
    @CurrentUser() user: AccessPayload,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OkResult> {
    await this.service.cancelOrder(user.sub, orderId, dto.reason);
    return { ok: true };
  }
}
