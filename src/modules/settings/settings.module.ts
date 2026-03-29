import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProfileRepository } from '../profile/repository/profile.repository';
import { SettingsRepository } from './repository/settings.repository';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsRepository, ProfileRepository],
})
export class SettingsModule {}
