import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string)?.trim() || randomUUID();
    (req as Request & { requestId: string }).requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}
