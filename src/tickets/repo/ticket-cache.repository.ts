import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
} from '../../domain/ticket-enums.js';
import type { TicketResponse } from '../dto/ticket-response.js';
import { REDIS_CLIENT, type RedisClient } from '../../redis/redis.constants.js';

const cachedTicketSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  customer_email: z.string(),
  subject: z.string(),
  message: z.string(),
  category: z.enum(TICKET_CATEGORIES).nullable(),
  suggested_reply: z.string().nullable(),
  status: z.enum(TICKET_STATUSES),
  created_at: z.string(),
});

function cacheKey(organizationId: number, ticketId: number): string {
  return `tickets:${organizationId}:${ticketId}`;
}

@Injectable()
export class TicketCacheRepository implements OnModuleDestroy {
  private readonly logger = new Logger(TicketCacheRepository.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClient | null,
    private readonly config: ConfigService,
  ) {}

  async get(
    organizationId: number,
    id: number,
  ): Promise<TicketResponse | null> {
    const client = this.usableClient();
    if (client === null) {
      return null;
    }
    try {
      const raw = await client.get(cacheKey(organizationId, id));
      if (raw === null) {
        return null;
      }
      const parsed = cachedTicketSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        this.logger.warn(
          `Discarding an unreadable cached ticket for key ${cacheKey(organizationId, id)}`,
        );
        return null;
      }
      return parsed.data;
    } catch (error) {
      this.logger.warn(
        `Ticket cache read failed, falling back to PostgreSQL: ${describeError(error)}`,
      );
      return null;
    }
  }

  async set(
    organizationId: number,
    id: number,
    ticket: TicketResponse,
  ): Promise<void> {
    const client = this.usableClient();

    if (client === null) {
      return;
    }

    try {
      await client.set(cacheKey(organizationId, id), JSON.stringify(ticket), {
        EX: this.ttlSeconds(),
      });
    } catch (error) {
      this.logger.warn(`Ticket cache write failed: ${describeError(error)}`);
    }
  }

  async invalidate(organizationId: number, id: number): Promise<void> {
    const client = this.usableClient();

    if (client === null) {
      return;
    }

    try {
      await client.del(cacheKey(organizationId, id));
    } catch (error) {
      this.logger.warn(
        `Ticket cache invalidation failed: ${describeError(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client !== null && this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  private usableClient(): RedisClient | null {
    if (this.client === null || !this.client.isReady) {
      return null;
    }

    return this.client;
  }

  private ttlSeconds(): number {
    return this.config.get<number>('TICKET_CACHE_TTL_SECONDS') ?? 300;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
