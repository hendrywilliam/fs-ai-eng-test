import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { ClassificationService } from './classification.service.js';
import { ClassificationCacheRepository } from './repo/classification-cache.repository.js';
import { TicketCacheRepository } from './repo/ticket-cache.repository.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsRepository } from './repo/tickets.repository.js';
import { TicketsService } from './tickets.service.js';

@Module({
  imports: [LlmModule, RedisModule],
  controllers: [TicketsController],
  providers: [
    TicketsRepository,
    TicketCacheRepository,
    ClassificationCacheRepository,
    ClassificationService,
    TicketsService,
  ],
})
export class TicketsModule {}
