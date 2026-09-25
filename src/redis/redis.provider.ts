import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { REDIS_CLIENT, type RedisClient } from './redis.constants.js';

const logger = new Logger('RedisClient');

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT, // Injection token.
  inject: [ConfigService], // Dependencies to inject into the factory.
  useFactory: (config: ConfigService): RedisClient | null => {
    const url = config.get<string>('REDIS_URL');

    if (url === undefined) {
      logger.log('REDIS_URL is not set, the ticket read cache is disabled');
      return null;
    }

    const client = createClient({ url });
    let errorReported = false;

    client.on('error', (error: Error) => {
      if (errorReported) {
        return;
      }

      errorReported = true;
      logger.warn(
        `Redis is unavailable, the ticket read cache is bypassed until it recovers: ${error.message}`,
      );
    });

    void client.connect().catch((error: unknown) => {
      logger.warn(`Redis initial connection failed: ${describeError(error)}`);
    });

    return client;
  },
};
