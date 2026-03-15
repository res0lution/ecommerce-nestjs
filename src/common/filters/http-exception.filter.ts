import * as common from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

@common.Catch()
export class AllExceptionsFilter implements common.ExceptionFilter {
  constructor(
    private readonly logger: common.LoggerService,
    private readonly config: ConfigService,
  ) {}

  catch(exception: unknown, host: common.ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof common.HttpException
        ? exception.getStatus()
        : common.HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof common.HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const isProduction = this.config.get<string>('nodeEnv') === 'production';

    const responsePayload =
      exception instanceof common.HttpException ? exception.getResponse() : null;
    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (typeof responsePayload === 'object' && responsePayload !== null) {
      Object.assign(body, responsePayload);
    }

    if (!isProduction && exception instanceof Error && (exception.stack ?? '')) {
      body.stack = exception.stack;
    }

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(body);
  }
}
