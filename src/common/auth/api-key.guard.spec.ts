import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedOrganization } from '../types/authenticated-request.js';
import { ApiKeyGuard } from './api-key.guard.js';

function buildGuard(options: { isPublic?: boolean } = {}) {
  const findUnique = vi.fn();
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(options.isPublic ?? false),
  } as unknown as Reflector;

  const guard = new ApiKeyGuard(
    { organization: { findUnique } } as unknown as PrismaService,
    reflector,
  );

  return { guard, findUnique };
}

function buildContext(apiKey?: string) {
  const request = {
    header: vi.fn((name: string) => (name === 'x-api-key' ? apiKey : undefined)),
    organization: undefined as AuthenticatedOrganization | undefined,
  };

  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('ApiKeyGuard', () => {
  it('rejects a request with no x-api-key header', async () => {
    const { guard, findUnique } = buildGuard();
    const { context } = buildContext(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects an api key that matches no organization', async () => {
    const { guard, findUnique } = buildGuard();
    const { context, request } = buildContext('unknown-key');
    findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).toHaveBeenCalledWith({
      where: { apiKey: 'unknown-key' },
      select: { id: true, name: true },
    });
    expect(request.organization).toBeUndefined();
  });

  it('attaches the resolved organization for a valid api key', async () => {
    const { guard, findUnique } = buildGuard();
    const { context, request } = buildContext('gd_demo_key_123');
    findUnique.mockResolvedValue({ id: 'org-1', name: 'GoodevaDesk Demo' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.organization).toEqual({ id: 'org-1', name: 'GoodevaDesk Demo' });
  });

  it('lets @Public() routes through without touching the database', async () => {
    const { guard, findUnique } = buildGuard({ isPublic: true });
    const { context } = buildContext(undefined);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
