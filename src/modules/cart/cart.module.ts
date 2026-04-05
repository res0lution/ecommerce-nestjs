import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CartCacheService } from './cache/cart-cache.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartRepository } from './repository/cart.repository';

@Module({
  imports: [AuthModule],
  controllers: [CartController],
  providers: [CartService, CartRepository, CartCacheService],
  exports: [CartService, CartRepository],
})
export class CartModule {}
