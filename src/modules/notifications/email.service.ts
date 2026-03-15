import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  /** In e2e / dev without key: last verification token captured for tests */
  public lastVerificationToken: string | null = null;
  public lastResetToken: string | null = null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('resend.apiKey', '');
    this.resend = key.length > 0 ? new Resend(key) : null;
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    this.lastVerificationToken = token;
    const frontend = this.config.get<string>('frontendUrl', '');
    const link = `${frontend}/verify-email?token=${encodeURIComponent(token)}`;
    const from = this.config.get<string>('resend.from', '');

    if (!this.resend) {
      this.logger.debug(`Verification email (no Resend): ${to} -> ${link}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from,
      to,
      subject: 'Confirm your email',
      html: `<p><a href="${link}">Verify email</a></p><p>Or copy: ${link}</p>`,
    });
    if (error !== null && error !== undefined) {
      this.logger.error(`Resend verification: ${JSON.stringify(error)}`);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    this.lastResetToken = token;
    const frontend = this.config.get<string>('frontendUrl', '');
    const link = `${frontend}/reset-password?token=${encodeURIComponent(token)}`;
    const from = this.config.get<string>('resend.from', '');

    if (!this.resend) {
      this.logger.debug(`Reset email (no Resend): ${to} -> ${link}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from,
      to,
      subject: 'Reset your password',
      html: `<p><a href="${link}">Reset password</a></p>`,
    });
    if (error !== null && error !== undefined) {
      this.logger.error(`Resend reset: ${JSON.stringify(error)}`);
      throw new Error('Failed to send reset email');
    }
  }
}
