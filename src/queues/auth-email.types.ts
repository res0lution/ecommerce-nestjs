export enum AuthEmailJobName {
  SendVerificationEmail = 'send-verification-email',
  SendPasswordResetEmail = 'send-password-reset-email',
}

export interface AuthEmailPayload {
  to: string;
  token: string;
}
