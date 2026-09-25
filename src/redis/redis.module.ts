import { Module } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants.js';
import { redisClientProvider } from './redis.provider.js';

// Exports only the REDIS_CLIENT token. Consumers inject it and must treat null
// as "Redis is not configured", so importing this module never makes Redis a
// hard dependency.
@Module({
  providers: [redisClientProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
