import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { EmailService } from '../../modules/notifications/email.service';
import { AuthEmailJobName, type AuthEmailPayload } from '../auth-email/auth-email.types';
import { AUTH_EMAIL_QUEUE } from '../queue.constants';

@Injectable()
@Processor(AUTH_EMAIL_QUEUE)
export class AuthEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(AuthEmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<AuthEmailPayload>): Promise<void> {
    switch (job.name as AuthEmailJobName) {
      case AuthEmailJobName.SendVerificationEmail:
        await this.emailService.sendVerificationEmail(job.data.to, job.data.token);
        return;
      case AuthEmailJobName.SendPasswordResetEmail:
        await this.emailService.sendPasswordResetEmail(job.data.to, job.data.token);
        return;
      default:
        throw new Error(`Unsupported auth email job: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AuthEmailPayload> | undefined, error: Error): void {
    const jobId = job?.id ?? 'unknown';
    this.logger.error(`Auth email job failed id=${jobId}: ${error.message}`);
  }
}
