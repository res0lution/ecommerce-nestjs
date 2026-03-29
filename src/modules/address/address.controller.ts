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

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AccessPayload, OkResult } from '../auth/auth.types';
import { OkResponseDto } from '../auth/dto/auth-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddressService } from './address.service';
import type { AddressResult } from './address.types';
import { AddressResponseDto } from './dto/address-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('address')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressController {
  constructor(private readonly service: AddressService) {}

  @Get()
  @ApiOperation({ summary: 'Get user addresses' })
  @ApiResponse({
    status: 200,
    description: 'Address list',
    type: AddressResponseDto,
    isArray: true,
  })
  async getAddresses(@CurrentUser() user: AccessPayload): Promise<AddressResult[]> {
    return this.service.getAddresses(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create address' })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({ status: 201, description: 'Address created', type: AddressResponseDto })
  async createAddress(
    @CurrentUser() user: AccessPayload,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResult> {
    return this.service.createAddress(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update address' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateAddressDto })
  @ApiResponse({ status: 200, description: 'Address updated', type: AddressResponseDto })
  async updateAddress(
    @CurrentUser() user: AccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResult> {
    return this.service.updateAddress(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete address' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Address deleted', type: OkResponseDto })
  async deleteAddress(
    @CurrentUser() user: AccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OkResult> {
    await this.service.deleteAddress(user.sub, id);
    return { ok: true };
  }

  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set address as default' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Address set as default', type: OkResponseDto })
  async setDefaultAddress(
    @CurrentUser() user: AccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OkResult> {
    await this.service.setDefaultAddress(user.sub, id);
    return { ok: true };
  }
}
