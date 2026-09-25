import { z } from 'zod';
import { TICKET_CATEGORIES, type TicketCategory } from '../domain/ticket-enums.js';

export const CLASSIFICATION_SCHEMA_NAME = 'ticket_classification';

export const classificationResponseSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  suggested_reply: z.string().trim().min(1).max(2_000),
});

export interface ParsedClassification {
  category: TicketCategory;
  suggestedReply: string;
}
