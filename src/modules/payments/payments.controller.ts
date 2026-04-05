import {
  Body,
  Controller,
  Get,
  Headers,
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
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentsService } from './payments.service';
import type { PaymentStatusResult } from './payments.types';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status by order id' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  async getPaymentStatus(
    @CurrentUser() user: AccessPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentStatusResult> {
    return this.service.getPaymentStatusForOrder(orderId, user.sub);
  }

  @Post('webhooks/yookassa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle YooKassa webhook' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  })
  @ApiResponse({ status: 200, type: OkResponseDto })
  async handleYooKassaWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers('x-yookassa-signature') signature?: string,
  ): Promise<OkResult> {
    this.service.validateWebhookSignature(payload, signature);
    await this.service.processYooKassaWebhook(payload);
    return { ok: true };
  }
}
