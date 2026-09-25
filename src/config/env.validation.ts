import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.string().min(1).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  DATABASE_URL: z.string().min(1),

  LLM_BASE_URL: z.string().min(1).default('https://api.openai.com/v1'),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().min(1),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  LLM_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(0).default(500),

  LLM_CACHE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  LLM_CACHE_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
  LLM_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),

  REDIS_URL: z.string().min(1).optional(),
  TICKET_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  TEST_DATABASE_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }

  return parsed.data;
}
