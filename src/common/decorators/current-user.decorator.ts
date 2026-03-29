import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AccessPayload } from '../../modules/auth/auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessPayload => {
    const request = context.switchToHttp().getRequest<{ user: AccessPayload }>();
    return request.user;
  },
);
