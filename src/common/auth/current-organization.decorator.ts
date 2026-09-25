import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedOrganization,
  AuthenticatedRequest,
} from '../types/authenticated-request.js';

export const CurrentOrganization = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedOrganization => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.organization;
  },
);
