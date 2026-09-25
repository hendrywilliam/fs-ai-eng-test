import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS_CLIENT, type RedisClient } from '../redis/redis.constants.js';

const CHECK_TIMEOUT_MS = 2_000;

export type DependencyState = 'up' | 'down' | 'disabled';

export interface DependencyCheck {
  status: DependencyState;
}

export interface HealthReport {
  status: 'ok' | 'error';
  uptime_seconds: number;
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
}

export interface HealthResult {
  report: HealthReport;
  httpStatus: number;
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Health check timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient | null,
  ) {}

  async check(): Promise<HealthResult> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const healthy = database.status === 'up';

    if (!healthy) {
      this.logger.warn('Readiness check reports the database as unavailable');
    }

    return {
      report: {
        status: healthy ? 'ok' : 'error',
        uptime_seconds: Math.round(process.uptime() * 1_000) / 1_000,
        checks: { database, redis },
      },
      httpStatus: healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
      return { status: 'up' };
    } catch (error) {
      this.logger.warn(`Database check failed: ${describeError(error)}`);
      return { status: 'down' };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    if (this.redis === null) {
      return { status: 'disabled' };
    }

    try {
      await withTimeout(this.redis.ping(), CHECK_TIMEOUT_MS);
      return { status: 'up' };
    } catch (error) {
      this.logger.warn(`Redis check failed: ${describeError(error)}`);
      return { status: 'down' };
    }
  }
}
