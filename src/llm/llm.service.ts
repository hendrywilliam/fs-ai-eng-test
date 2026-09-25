import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { TicketCategory } from '../domain/ticket-enums.js';
import { OPENAI_CLIENT } from './llm.constants.js';
import {
  CLASSIFICATION_SCHEMA_NAME,
  classificationResponseSchema,
  type ParsedClassification,
} from './llm.schemas.js';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
} from './prompts.js';
import { withRetry } from './retry.js';

export interface ClassifyTicketInput {
  subject: string;
  message: string;
}

export interface TicketClassification {
  category: TicketCategory | null;
  suggestedReply: string | null;
}

function emptyClassification(): TicketClassification {
  return { category: null, suggestedReply: null };
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof APIError) {
    const status = error.status;
    if (status === undefined) {
      return true;
    }
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }
  return true;
}

function isContractViolation(error: unknown): boolean {
  return (
    error instanceof SyntaxError ||
    (error instanceof Error && error.name === 'ZodError')
  );
}

function describeError(error: unknown): string {
  if (error instanceof APIError) {
    return `${error.name} status=${error.status ?? 'n/a'}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return 'unknown error';
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly config: ConfigService,
  ) {}

  async classifyTicket(
    input: ClassifyTicketInput,
  ): Promise<TicketClassification> {
    const startedAt = Date.now();
    let model = 'unknown';

    try {
      model = this.config.getOrThrow<string>('LLM_MODEL');
      const retries = this.config.get<number>('LLM_MAX_RETRIES') ?? 2;
      const baseDelayMs =
        this.config.get<number>('LLM_RETRY_BASE_DELAY_MS') ?? 500;

      const parsed = await withRetry(
        () => this.requestClassification(model, input),
        {
          retries,
          baseDelayMs,
          shouldRetry: isRetryableError,
          onRetry: ({ attempt, delayMs }) => {
            this.logger.warn(
              `Retrying LLM request (attempt ${attempt}/${retries}) after ${delayMs}ms`,
            );
          },
        },
      );

      const latencyMs = Date.now() - startedAt;

      if (parsed === null) {
        this.logger.warn(
          `LLM returned an unusable classification (model=${model}, latency=${latencyMs}ms)`,
        );
        return emptyClassification();
      }

      this.logger.log(
        `LLM classified ticket as ${parsed.category} (model=${model}, latency=${latencyMs}ms)`,
      );

      return {
        category: parsed.category,
        suggestedReply: parsed.suggestedReply,
      };
    } catch (error) {
      this.logger.error(
        `LLM classification failed (model=${model}, latency=${Date.now() - startedAt}ms): ${describeError(error)}`,
      );
      return emptyClassification();
    }
  }

  private async requestClassification(
    model: string,
    input: ClassifyTicketInput,
  ): Promise<ParsedClassification | null> {
    try {
      const completion = await this.client.chat.completions.parse({
        model,
        temperature: 0,
        response_format: zodResponseFormat(
          classificationResponseSchema,
          CLASSIFICATION_SCHEMA_NAME,
        ),
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: buildClassificationUserPrompt(input) },
        ],
      });

      const parsed = completion.choices[0]?.message?.parsed;

      if (!parsed) {
        return null;
      }

      return {
        category: parsed.category,
        suggestedReply: parsed.suggested_reply,
      };
    } catch (error) {
      if (isContractViolation(error)) {
        this.logger.warn(
          `LLM structured output did not match the required schema: ${describeError(error)}`,
        );
        return null;
      }

      throw error;
    }
  }
}
