import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AddressResult, CreateAddressInput, UpdateAddressInput } from './address.types';
import { AddressRepository } from './repository/address.repository';

@Injectable()
export class AddressService {
  constructor(private readonly repository: AddressRepository) {}

  async getAddresses(userId: string): Promise<AddressResult[]> {
    return this.repository.listByUserId(userId);
  }

  async createAddress(userId: string, dto: CreateAddressInput): Promise<AddressResult> {
    const total = await this.repository.countByUserId(userId);
    const shouldBeDefault = dto.isDefault === true || total === 0;

    return this.repository.runInTransaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.create({
        data: {
          userId,
          country: dto.country,
          city: dto.city,
          street: dto.street,
          house: dto.house,
          apartment: dto.apartment ?? null,
          postalCode: dto.postalCode,
          isDefault: shouldBeDefault,
        },
      });
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressInput,
  ): Promise<AddressResult> {
    const existing = await this.repository.findByIdForUser(userId, addressId);
    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    if (dto.isDefault === false && existing.isDefault) {
      throw new BadRequestException('At least one default address is required');
    }

    return this.repository.runInTransaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const data: Prisma.UserAddressUpdateInput = {
        country: dto.country,
        city: dto.city,
        street: dto.street,
        house: dto.house,
        apartment: dto.apartment,
        postalCode: dto.postalCode,
      };

      if (dto.isDefault !== undefined) {
        data.isDefault = dto.isDefault;
      }

      return tx.userAddress.update({
        where: { id: addressId },
        data,
      });
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const existing = await this.repository.findByIdForUser(userId, addressId);
    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    const total = await this.repository.countByUserId(userId);
    if (total <= 1) {
      throw new BadRequestException('Cannot delete the last address');
    }

    await this.repository.runInTransaction(async (tx) => {
      await tx.userAddress.delete({
        where: { id: addressId },
      });

      if (existing.isDefault) {
        const nextAddress = await tx.userAddress.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });

        if (nextAddress) {
          await tx.userAddress.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    const existing = await this.repository.findByIdForUser(userId, addressId);
    if (!existing) {
      throw new NotFoundException('Address not found');
    }
    if (existing.isDefault) {
      return;
    }

    await this.repository.runInTransaction(async (tx) => {
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      await tx.userAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }
}
