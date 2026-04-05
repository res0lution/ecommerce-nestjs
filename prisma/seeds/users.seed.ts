import { AuthProvider, PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

type IdMap = Record<string, string>;

interface UserSeed {
  key: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  provider: AuthProvider;
}

interface AddressSeed {
  userKey: string;
  country: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode: string;
  isDefault: boolean;
}

export interface UsersSeedResult {
  userIds: IdMap;
  defaultPassword: string;
}

const defaultPassword = 'SeedPassword123!';

const users: UserSeed[] = [
  {
    key: 'admin',
    email: 'admin@seed.local',
    name: 'Seed Admin',
    phone: '+70000000001',
    role: UserRole.ADMIN,
    provider: AuthProvider.LOCAL,
  },
  {
    key: 'buyer',
    email: 'buyer@seed.local',
    name: 'Seed Buyer',
    phone: '+70000000002',
    role: UserRole.USER,
    provider: AuthProvider.LOCAL,
  },
  {
    key: 'reviewer',
    email: 'reviewer@seed.local',
    name: 'Seed Reviewer',
    phone: '+70000000003',
    role: UserRole.USER,
    provider: AuthProvider.LOCAL,
  },
  {
    key: 'guest',
    email: 'guest@seed.local',
    name: 'Seed Guest',
    role: UserRole.USER,
    provider: AuthProvider.LOCAL,
  },
];

const addresses: AddressSeed[] = [
  {
    userKey: 'buyer',
    country: 'Russia',
    city: 'Moscow',
    street: 'Tverskaya',
    house: '7',
    apartment: '12',
    postalCode: '125009',
    isDefault: true,
  },
  {
    userKey: 'buyer',
    country: 'Russia',
    city: 'Moscow',
    street: 'Novy Arbat',
    house: '15',
    apartment: '18',
    postalCode: '121099',
    isDefault: false,
  },
  {
    userKey: 'reviewer',
    country: 'Russia',
    city: 'Saint Petersburg',
    street: 'Nevsky Prospekt',
    house: '24',
    postalCode: '191186',
    isDefault: true,
  },
];

export async function seedUsers(prisma: PrismaClient): Promise<UsersSeedResult> {
  const passwordHash = await argon2.hash(defaultPassword);
  const userIds: IdMap = {};

  for (const user of users) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        phone: user.phone ?? null,
        role: user.role,
        provider: user.provider,
        passwordHash,
        emailVerified: true,
        deletedAt: null,
      },
      create: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        provider: user.provider,
        passwordHash,
        emailVerified: true,
      },
    });
    userIds[user.key] = row.id;
  }

  for (const user of users) {
    const userId = userIds[user.key];
    await prisma.userSettings.upsert({
      where: { userId },
      update: {
        language: 'en',
        currency: 'RUB',
        notificationsEnabled: true,
      },
      create: {
        userId,
        language: 'en',
        currency: 'RUB',
        notificationsEnabled: true,
      },
    });
  }

  await prisma.userAddress.deleteMany({
    where: {
      userId: {
        in: Object.values(userIds),
      },
    },
  });

  await prisma.userAddress.createMany({
    data: addresses.map((address) => ({
      userId: userIds[address.userKey],
      country: address.country,
      city: address.city,
      street: address.street,
      house: address.house,
      apartment: address.apartment ?? null,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
    })),
  });

  return { userIds, defaultPassword };
}
