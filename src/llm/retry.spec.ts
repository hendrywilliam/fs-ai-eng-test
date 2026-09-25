import { withRetry } from './retry.js';

const noSleep = async (): Promise<void> => {};

describe('withRetry', () => {
  it('returns the first successful result without retrying', async () => {
    const operation = vi.fn().mockResolvedValue('ok');

    await expect(withRetry(operation, { retries: 3, shouldRetry: () => true, sleep: noSleep })).resolves.toBe(
      'ok',
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure and then succeeds', async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');

    await expect(withRetry(operation, { retries: 3, shouldRetry: () => true, sleep: noSleep })).resolves.toBe(
      'ok',
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('stops after the configured number of retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      withRetry(operation, { retries: 2, shouldRetry: () => true, sleep: noSleep }),
    ).rejects.toThrow('boom');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry when shouldRetry declines', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('fatal'));

    await expect(
      withRetry(operation, { retries: 5, shouldRetry: () => false, sleep: noSleep }),
    ).rejects.toThrow('fatal');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('performs exactly one attempt when retries is zero', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      withRetry(operation, { retries: 0, shouldRetry: () => true, sleep: noSleep }),
    ).rejects.toThrow('boom');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('reports each retry with an increasing attempt number', async () => {
    const onRetry = vi.fn();
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      withRetry(operation, { retries: 2, shouldRetry: () => true, sleep: noSleep, onRetry }),
    ).rejects.toThrow('boom');

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls.map(([info]) => info.attempt)).toEqual([1, 2]);
  });

  it('backs off exponentially, within the jitter band', async () => {
    const delays: number[] = [];
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      withRetry(operation, {
        retries: 3,
        baseDelayMs: 100,
        maxDelayMs: 10_000,
        shouldRetry: () => true,
        sleep: noSleep,
        onRetry: ({ delayMs }) => delays.push(delayMs),
      }),
    ).rejects.toThrow('boom');

    expect(delays).toHaveLength(3);
    expect(delays[0]).toBeGreaterThanOrEqual(50);
    expect(delays[0]).toBeLessThanOrEqual(100);
    expect(delays[1]).toBeGreaterThanOrEqual(100);
    expect(delays[1]).toBeLessThanOrEqual(200);
    expect(delays[2]).toBeGreaterThanOrEqual(200);
    expect(delays[2]).toBeLessThanOrEqual(400);
  });

  it('never exceeds maxDelayMs', async () => {
    const delays: number[] = [];
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      withRetry(operation, {
        retries: 4,
        baseDelayMs: 1_000,
        maxDelayMs: 2_000,
        shouldRetry: () => true,
        sleep: noSleep,
        onRetry: ({ delayMs }) => delays.push(delayMs),
      }),
    ).rejects.toThrow('boom');

    expect(Math.max(...delays)).toBeLessThanOrEqual(2_000);
  });
});
