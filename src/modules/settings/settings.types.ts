import type { SettingsEntity } from './entities/settings.entity';

export type SettingsResult = SettingsEntity;

export interface UpdateSettingsInput {
  language?: string;
  currency?: string;
  notificationsEnabled?: boolean;
}
