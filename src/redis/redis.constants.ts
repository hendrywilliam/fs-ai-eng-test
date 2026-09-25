import type { RedisClientType } from 'redis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export type RedisClient = RedisClientType;
