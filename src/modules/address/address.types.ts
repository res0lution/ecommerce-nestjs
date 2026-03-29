import type { Prisma } from '@prisma/client';

import type { AddressEntity } from './entities/address.entity';

export type AddressResult = AddressEntity;

export interface CreateAddressInput {
  country: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode: string;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  country?: string;
  city?: string;
  street?: string;
  house?: string;
  apartment?: string;
  postalCode?: string;
  isDefault?: boolean;
}

export type AddressUpdateData = Omit<Prisma.UserAddressUpdateInput, 'user'>;
