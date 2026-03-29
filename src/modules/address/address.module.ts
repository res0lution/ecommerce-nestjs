import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { AddressRepository } from './repository/address.repository';

@Module({
  imports: [AuthModule],
  controllers: [AddressController],
  providers: [AddressService, AddressRepository],
})
export class AddressModule {}
