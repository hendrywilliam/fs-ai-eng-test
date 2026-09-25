export interface RetryInfo {
  error: unknown;
  attempt: number;
  delayMs: number;
}

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry: (error: unknown) => boolean;
  onRetry?: (info: RetryInfo) => void;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { retries, baseDelayMs = 500, maxDelayMs = 8_000, shouldRetry, onRetry } = options;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }

      const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delayMs = Math.round(ceiling * (0.5 + Math.random() * 0.5));

      onRetry?.({ error, attempt: attempt + 1, delayMs });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
