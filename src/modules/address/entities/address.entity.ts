export interface AddressEntity {
  id: string;
  country: string;
  city: string;
  street: string;
  house: string;
  apartment: string | null;
  postalCode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
