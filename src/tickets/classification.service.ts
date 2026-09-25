import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService, type TicketClassification } from '../llm/llm.service.js';
import {
  ClassificationCacheRepository,
  type StoredClassification,
} from './repo/classification-cache.repository.js';

const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly cache: ClassificationCacheRepository,
    private readonly config: ConfigService,
  ) {}

  async classify(
    organizationId: number,
    subject: string,
    message: string,
  ): Promise<TicketClassification> {
    if (!this.enabled()) {
      return this.llm.classifyTicket({ subject, message });
    }

    const exact = await this.cache.findExact(organizationId, subject, message);

    if (exact !== null) {
      this.logger.log(
        `Reused a cached classification by exact match for organization ${organizationId}`,
      );
      return exact;
    }

    const similar = await this.cache.findSimilar(
      organizationId,
      subject,
      message,
    );

    if (similar !== null && similar.overlap >= this.threshold()) {
      this.logger.log(
        `Reused a cached classification by similarity for organization ${organizationId} (overlap=${similar.overlap.toFixed(2)} of ${similar.candidates} candidate(s))`,
      );
      return similar.classification;
    }

    const fresh = await this.llm.classifyTicket({ subject, message });
    await this.remember(organizationId, subject, message, fresh);

    return fresh;
  }

  // Only a fully usable result is worth caching. Storing a failed
  // classification would make every later identical ticket reuse the failure
  // without ever retrying the provider.
  private async remember(
    organizationId: number,
    subject: string,
    message: string,
    classification: TicketClassification,
  ): Promise<void> {
    if (
      classification.category === null ||
      classification.suggestedReply === null
    ) {
      return;
    }

    const stored: StoredClassification = {
      category: classification.category,
      suggestedReply: classification.suggestedReply,
    };

    await this.cache.store(organizationId, subject, message, stored);
  }

  private enabled(): boolean {
    return this.config.get<boolean>('LLM_CACHE_ENABLED') ?? true;
  }

  private threshold(): number {
    return (
      this.config.get<number>('LLM_CACHE_SIMILARITY_THRESHOLD') ??
      DEFAULT_SIMILARITY_THRESHOLD
    );
  }
}
