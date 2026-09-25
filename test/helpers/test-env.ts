import { config as loadEnv } from 'dotenv';

/**
 * Makes the suites runnable on a fresh clone by loading .env (plus optional
 * .env.test.local overrides) and then filling in anything still missing.
 *
 * IMPORTANT: this must run before a spec file imports AppModule, because
 * ConfigModule.forRoot() loads .env and validates the environment eagerly while
 * app.module.ts is being evaluated. That is why it is wired up as a Vitest
 * `setupFiles` entry rather than called from inside a spec.
 *
 * The destructive database specs are gated on TEST_DATABASE_URL rather than
 * DATABASE_URL, which guarantees they can never be pointed at a development
 * database by accident.
 */
export function applyTestEnv(): void {
  loadEnv({ quiet: true });
  loadEnv({ path: '.env.test.local', override: true, quiet: true });

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (testDatabaseUrl) {
    process.env.DATABASE_URL = testDatabaseUrl;
  }

  const defaults: Record<string, string> = {
    NODE_ENV: 'test',
    // Only used when TEST_DATABASE_URL is absent, and never connected to in that
    // case: every spec except the skipped database suite stubs Prisma out.
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/goodevadesk_e2e',
    // Unroutable on purpose so an accidental real call fails fast.
    LLM_BASE_URL: 'http://127.0.0.1:1/v1',
    LLM_API_KEY: 'test-llm-key',
    LLM_MODEL: 'test-model',
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
