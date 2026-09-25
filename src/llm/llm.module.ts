import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './llm.constants.js';
import { LlmService } from './llm.service.js';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): OpenAI =>
        new OpenAI({
          apiKey: config.getOrThrow<string>('LLM_API_KEY'),
          baseURL: config.get<string>('LLM_BASE_URL'),
          timeout: config.get<number>('LLM_TIMEOUT_MS') ?? 15_000,
          maxRetries: 0,
        }),
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
