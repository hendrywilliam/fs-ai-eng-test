import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export interface CreateTestAppOptions {
  /** Use the real PostgreSQL client. Requires TEST_DATABASE_URL. */
  useRealPrisma?: boolean;
  /** Replace the default Prisma stub with a purpose built one. */
  prisma?: Record<string, unknown>;
  /** Extra provider overrides, for example a stubbed LlmService. */
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

function createPrismaStub(): Record<string, unknown> {
  const notImplemented = (method: string) => async (): Promise<never> => {
    throw new Error(`Prisma stub: ${method} is not implemented for this spec`);
  };

  return {
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    organization: { findUnique: async () => null },
    ticket: {
      create: notImplemented('ticket.create'),
      updateMany: notImplemented('ticket.updateMany'),
      findFirst: notImplemented('ticket.findFirst'),
      findMany: notImplemented('ticket.findMany'),
    },
  };
}

/**
 * Boots the real application graph so the APP_GUARD / APP_FILTER / APP_PIPE
 * registrations from AppModule are active. That is what makes the auth and
 * validation assertions below meaningful, and it is why the suite stays green
 * without a database: only Prisma is swapped out.
 */
export async function createTestApp(options: CreateTestAppOptions = {}): Promise<INestApplication> {
  const { useRealPrisma = false, prisma, configure } = options;

  let builder = Test.createTestingModule({ imports: [AppModule] });

  if (!useRealPrisma) {
    builder = builder.overrideProvider(PrismaService).useValue(prisma ?? createPrismaStub());
  }

  if (configure) {
    builder = configure(builder);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  return app;
}
