import { validateEnv } from './env.validation.js';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/goodevadesk',
  LLM_API_KEY: 'test-key',
  LLM_MODEL: 'test-model',
};

describe('validateEnv', () => {
  it('applies the documented defaults', () => {
    const env = validateEnv({ ...VALID_ENV });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LLM_BASE_URL).toBe('https://api.openai.com/v1');
    expect(env.LLM_TIMEOUT_MS).toBe(15_000);
    expect(env.LLM_MAX_RETRIES).toBe(2);
    expect(env.LLM_RETRY_BASE_DELAY_MS).toBe(500);
  });

  it('coerces numeric strings so ConfigService returns real numbers', () => {
    const env = validateEnv({ ...VALID_ENV, PORT: '8080', LLM_MAX_RETRIES: '1' });

    expect(env.PORT).toBe(8080);
    expect(env.LLM_MAX_RETRIES).toBe(1);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({ LLM_API_KEY: 'k', LLM_MODEL: 'm' })).toThrow(/DATABASE_URL/);
  });

  it('rejects a blank LLM_API_KEY', () => {
    expect(() => validateEnv({ ...VALID_ENV, LLM_API_KEY: '' })).toThrow(/LLM_API_KEY/);
  });

  it('rejects a missing LLM_MODEL', () => {
    expect(() => validateEnv({ DATABASE_URL: VALID_ENV.DATABASE_URL, LLM_API_KEY: 'k' })).toThrow(
      /LLM_MODEL/,
    );
  });

  it('rejects an out of range retry count', () => {
    expect(() => validateEnv({ ...VALID_ENV, LLM_MAX_RETRIES: '99' })).toThrow(/LLM_MAX_RETRIES/);
  });

  it('rejects a non numeric port', () => {
    expect(() => validateEnv({ ...VALID_ENV, PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('keeps unrelated process variables out of the validated result', () => {
    const env = validateEnv({ ...VALID_ENV, PATH: '/usr/bin' });

    expect(env).not.toHaveProperty('PATH');
  });

  it('treats TEST_DATABASE_URL as optional', () => {
    expect(validateEnv({ ...VALID_ENV }).TEST_DATABASE_URL).toBeUndefined();
    expect(
      validateEnv({ ...VALID_ENV, TEST_DATABASE_URL: 'postgresql://localhost/test' })
        .TEST_DATABASE_URL,
    ).toBe('postgresql://localhost/test');
  });
});
