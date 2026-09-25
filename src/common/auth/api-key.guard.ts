import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AuthenticatedOrganization,
  AuthenticatedRequest,
} from '../types/authenticated-request.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export const API_KEY_HEADER = 'x-api-key';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = request.header(API_KEY_HEADER);

    if (!apiKey) {
      throw new UnauthorizedException(`Missing ${API_KEY_HEADER} header`);
    }
    const organization = await this.prisma.$queryRaw<
      AuthenticatedOrganization[]
    >`
      SELECT id, name FROM organizations WHERE api_key = ${apiKey} LIMIT 1;
    `;
    if (!organization[0]) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.organization = organization[0];
    return true;
  }
}
