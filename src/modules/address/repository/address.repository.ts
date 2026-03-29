import { Injectable } from '@nestjs/common';
import type { Prisma, UserAddress } from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';

import type { AddressResult, AddressUpdateData } from '../address.types';

@Injectable()
export class AddressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUserId(userId: string): Promise<AddressResult[]> {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findByIdForUser(userId: string, addressId: string): Promise<UserAddress | null> {
    return this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.userAddress.count({ where: { userId } });
  }

  async createForUser(
    userId: string,
    data: {
      country: string;
      city: string;
      street: string;
      house: string;
      apartment?: string;
      postalCode: string;
      isDefault: boolean;
    },
  ): Promise<AddressResult> {
    return this.prisma.userAddress.create({
      data: {
        userId,
        country: data.country,
        city: data.city,
        street: data.street,
        house: data.house,
        apartment: data.apartment ?? null,
        postalCode: data.postalCode,
        isDefault: data.isDefault,
      },
    });
  }

  async updateById(addressId: string, data: AddressUpdateData): Promise<AddressResult> {
    return this.prisma.userAddress.update({
      where: { id: addressId },
      data,
    });
  }

  async deleteById(addressId: string): Promise<void> {
    await this.prisma.userAddress.delete({ where: { id: addressId } });
  }

  async clearDefaultByUserId(userId: string): Promise<void> {
    await this.prisma.userAddress.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  async findFirstByUserId(userId: string): Promise<UserAddress | null> {
    return this.prisma.userAddress.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async runInTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => operation(tx));
  }
}
