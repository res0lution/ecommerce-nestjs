import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AddressService } from './address.service';
import { AddressRepository } from './repository/address.repository';

type AddressRepositoryMock = Pick<
  AddressRepository,
  'countByUserId' | 'findByIdForUser' | 'listByUserId' | 'runInTransaction'
>;

describe('AddressService', () => {
  let service: AddressService;
  let repository: jest.Mocked<AddressRepositoryMock>;

  beforeEach(() => {
    repository = {
      countByUserId: jest.fn(),
      findByIdForUser: jest.fn(),
      listByUserId: jest.fn(),
      runInTransaction: jest.fn(),
    };
    service = new AddressService(repository as unknown as AddressRepository);
  });

  it('getAddresses returns list from repository', async () => {
    const rows = [
      {
        id: 'a1',
        country: 'NL',
        city: 'Amsterdam',
        street: 'Main',
        house: '1',
        apartment: null,
        postalCode: '1000AA',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    repository.listByUserId.mockResolvedValue(rows);

    const result = await service.getAddresses('u1');

    expect(result).toEqual(rows);
    expect(repository.listByUserId).toHaveBeenCalledWith('u1');
  });

  it('createAddress sets first address as default', async () => {
    repository.countByUserId.mockResolvedValue(0);

    const updateMany = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      country: 'NL',
      city: 'Amsterdam',
      street: 'Main',
      house: '12',
      apartment: null,
      postalCode: '1000AA',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    repository.runInTransaction.mockImplementation(async (operation) =>
      operation({ userAddress: { updateMany, create } } as never),
    );

    const result = await service.createAddress('u1', {
      country: 'NL',
      city: 'Amsterdam',
      street: 'Main',
      house: '12',
      postalCode: '1000AA',
    });

    expect(result.isDefault).toBe(true);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('createAddress keeps default unchanged for non-first non-default input', async () => {
    repository.countByUserId.mockResolvedValue(2);

    const updateMany = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({
      id: 'a2',
      userId: 'u1',
      country: 'NL',
      city: 'Rotterdam',
      street: 'Second',
      house: '20',
      apartment: null,
      postalCode: '2000BB',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    repository.runInTransaction.mockImplementation(async (operation) =>
      operation({ userAddress: { updateMany, create } } as never),
    );

    const result = await service.createAddress('u1', {
      country: 'NL',
      city: 'Rotterdam',
      street: 'Second',
      house: '20',
      postalCode: '2000BB',
      isDefault: false,
    });

    expect(result.isDefault).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('updateAddress throws when address is missing', async () => {
    repository.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.updateAddress('u1', 'missing', {
        city: 'Utrecht',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateAddress forbids clearing default from current default address', async () => {
    repository.findByIdForUser.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      isDefault: true,
    } as never);

    await expect(
      service.updateAddress('u1', 'a1', {
        isDefault: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateAddress switches default and updates address', async () => {
    repository.findByIdForUser.mockResolvedValue({
      id: 'a2',
      userId: 'u1',
      isDefault: false,
    } as never);

    const updateMany = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue({
      id: 'a2',
      country: 'NL',
      city: 'Haarlem',
      street: 'Third',
      house: '7',
      apartment: null,
      postalCode: '3000CC',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.runInTransaction.mockImplementation(async (operation) =>
      operation({ userAddress: { updateMany, update } } as never),
    );

    const result = await service.updateAddress('u1', 'a2', {
      city: 'Haarlem',
      isDefault: true,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isDefault: true },
      data: { isDefault: false },
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.isDefault).toBe(true);
  });

  it('setDefaultAddress resets previous default and sets target', async () => {
    repository.findByIdForUser.mockResolvedValue({
      id: 'a2',
      isDefault: false,
      userId: 'u1',
    } as never);

    const updateMany = jest.fn().mockResolvedValue(undefined);
    const update = jest.fn().mockResolvedValue(undefined);

    repository.runInTransaction.mockImplementation(async (operation) =>
      operation({ userAddress: { updateMany, update } } as never),
    );

    await service.setDefaultAddress('u1', 'a2');

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isDefault: true },
      data: { isDefault: false },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'a2' },
      data: { isDefault: true },
    });
  });

  it('setDefaultAddress throws when address is missing', async () => {
    repository.findByIdForUser.mockResolvedValue(null);

    await expect(service.setDefaultAddress('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deleteAddress forbids deleting last address', async () => {
    repository.findByIdForUser.mockResolvedValue({
      id: 'a1',
      isDefault: true,
      userId: 'u1',
    } as never);
    repository.countByUserId.mockResolvedValue(1);

    await expect(service.deleteAddress('u1', 'a1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deleteAddress throws when address is missing', async () => {
    repository.findByIdForUser.mockResolvedValue(null);

    await expect(service.deleteAddress('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deleteAddress removes non-default address without reassignment', async () => {
    repository.findByIdForUser.mockResolvedValue({
      id: 'a2',
      userId: 'u1',
      isDefault: false,
    } as never);
    repository.countByUserId.mockResolvedValue(2);

    const del = jest.fn().mockResolvedValue(undefined);
    const findFirst = jest.fn();
    const update = jest.fn();

    repository.runInTransaction.mockImplementation(async (operation) =>
      operation({ userAddress: { delete: del, findFirst, update } } as never),
    );

    await service.deleteAddress('u1', 'a2');

    expect(del).toHaveBeenCalledWith({ where: { id: 'a2' } });
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('deleteAddress reassigns default when deleting current default', async () => {
    repository.findByIdForUser.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      isDefault: true,
    } as never);
    repository.countByUserId.mockResolvedValue(2);

    const del = jest.fn().mockResolvedValue(undefined);
    const findFirst = jest.fn().mockResolvedValue({ id: 'a2' });
    const update = jest.fn().mockResolvedValue(undefined);

    repository.runInTransaction.mockImplementation(async (operation) =>
      operation({ userAddress: { delete: del, findFirst, update } } as never),
    );

    await service.deleteAddress('u1', 'a1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'a2' },
      data: { isDefault: true },
    });
  });

  it('setDefaultAddress does nothing if target is already default', async () => {
    repository.findByIdForUser.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      isDefault: true,
    } as never);

    await service.setDefaultAddress('u1', 'a1');

    expect(repository.runInTransaction).not.toHaveBeenCalled();
  });
});
