import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  collectQueryTerms,
  fingerprint,
  normalizeText,
  overlapRatio,
} from '../../common/text/similarity.js';
import {
  isTicketCategory,
  type TicketCategory,
} from '../../domain/ticket-enums.js';
import { REDIS_CLIENT, type RedisClient } from '../../redis/redis.constants.js';

const INDEX_NAME = 'idx:llm:class';
const KEY_PREFIX = 'llm:class:';
const MAX_CANDIDATES = 5;
const DEFAULT_TTL_SECONDS = 86_400;

export interface StoredClassification {
  category: TicketCategory;
  suggestedReply: string;
}

export interface SimilarClassificationMatch {
  classification: StoredClassification;
  overlap: number;
  candidates: number;
}

function cacheKey(
  organizationId: number,
  subject: string,
  message: string,
): string {
  // normalizeText collapses every whitespace run into a single space, so a
  // newline can never survive inside a part and is safe to use as a separator.
  const seed = `${normalizeText(subject)}\n${normalizeText(message)}`;

  return `${KEY_PREFIX}${organizationId}:${fingerprint(seed)}`;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readStored(hash: Record<string, unknown>): StoredClassification | null {
  const category = asString(hash.category);
  const reply = asString(hash.reply);

  if (category === null || !isTicketCategory(category)) {
    return null;
  }

  if (reply === null || reply.trim().length === 0) {
    return null;
  }

  return { category, suggestedReply: reply };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class ClassificationCacheRepository implements OnModuleInit {
  private readonly logger = new Logger(ClassificationCacheRepository.name);
  private similarityEnabled = false;

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClient | null,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const client = this.usableClient();

    if (client === null) {
      return;
    }

    try {
      await client.ft.create(
        INDEX_NAME,
        {
          org: { type: 'TAG' },
          subject: { type: 'TEXT' },
          message: { type: 'TEXT' },
        },
        { ON: 'HASH', PREFIX: KEY_PREFIX },
      );
      this.similarityEnabled = true;
    } catch (error) {
      if (describeError(error).toLowerCase().includes('already exists')) {
        this.similarityEnabled = true;
        return;
      }

      this.logger.warn(
        `RediSearch is unavailable, similarity matching is disabled and only exact matches are reused: ${describeError(error)}`,
      );
    }
  }

  async findExact(
    organizationId: number,
    subject: string,
    message: string,
  ): Promise<StoredClassification | null> {
    const client = this.usableClient();

    if (client === null) {
      return null;
    }

    try {
      const hash = await client.hGetAll(
        cacheKey(organizationId, subject, message),
      );

      return readStored(hash);
    } catch (error) {
      this.logger.warn(
        `Classification cache read failed: ${describeError(error)}`,
      );
      return null;
    }
  }

  async findSimilar(
    organizationId: number,
    subject: string,
    message: string,
  ): Promise<SimilarClassificationMatch | null> {
    const client = this.usableClient();

    if (client === null || !this.similarityEnabled) {
      return null;
    }

    const terms = collectQueryTerms(`${subject} ${message}`);

    if (terms.length === 0) {
      return null;
    }

    try {
      const alternatives = terms.join('|');
      const result = await client.ft.search(
        INDEX_NAME,
        `@org:{${organizationId}} (@subject:(${alternatives}) | @message:(${alternatives}))`,
        {
          // BM25 ranks which candidates come back. The numeric score itself is
          // not exposed by the typed client, and it is not used to decide
          // either, because BM25 has no absolute scale.
          SCORER: 'BM25',
          LIMIT: { from: 0, size: MAX_CANDIDATES },
        },
      );

      const wanted = `${subject} ${message}`;
      let best: SimilarClassificationMatch | null = null;

      for (const document of result.documents) {
        const stored = readStored(document.value);

        if (stored === null) {
          continue;
        }

        const candidateSubject = asString(document.value.subject) ?? '';
        const candidateMessage = asString(document.value.message) ?? '';
        const overlap = overlapRatio(
          wanted,
          `${candidateSubject} ${candidateMessage}`,
        );

        if (best === null || overlap > best.overlap) {
          best = {
            classification: stored,
            overlap,
            candidates: result.documents.length,
          };
        }
      }

      return best;
    } catch (error) {
      this.logger.warn(
        `Classification similarity search failed: ${describeError(error)}`,
      );
      return null;
    }
  }

  async store(
    organizationId: number,
    subject: string,
    message: string,
    classification: StoredClassification,
  ): Promise<void> {
    const client = this.usableClient();

    if (client === null) {
      return;
    }

    try {
      const key = cacheKey(organizationId, subject, message);

      await client.hSet(key, {
        org: String(organizationId),
        subject: normalizeText(subject),
        message: normalizeText(message),
        category: classification.category,
        reply: classification.suggestedReply,
        created_at: String(Date.now()),
      });
      await client.expire(key, this.ttlSeconds());
    } catch (error) {
      this.logger.warn(
        `Classification cache write failed: ${describeError(error)}`,
      );
    }
  }

  private usableClient(): RedisClient | null {
    if (this.client === null || !this.client.isReady) {
      return null;
    }

    return this.client;
  }

  private ttlSeconds(): number {
    return (
      this.config.get<number>('LLM_CACHE_TTL_SECONDS') ?? DEFAULT_TTL_SECONDS
    );
  }
}
