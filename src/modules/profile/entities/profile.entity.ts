export interface ProfileEntity {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  phone: string | null;
  emailVerified: boolean;
}
