import {
  isTicketCategory,
  isTicketStatus,
  type TicketCategory,
  type TicketStatus,
} from '../../domain/ticket-enums.js';
import type { Ticket } from '../../generated/prisma/client.js';
import type { TicketResponse } from '../dto/ticket-response.js';

function narrowCategory(value: string | null): TicketCategory | null {
  if (value === null) {
    return null;
  }

  if (!isTicketCategory(value)) {
    throw new Error(
      `Unknown ticket category stored in the database: "${value}"`,
    );
  }

  return value;
}

function narrowStatus(value: string): TicketStatus {
  if (!isTicketStatus(value)) {
    throw new Error(`Unknown ticket status stored in the database: "${value}"`);
  }

  return value;
}

// Serialization boundary for a ticket. The database row is narrowed once here,
// then toJSON() produces the snake_case shape that leaves the process:
// JSON.stringify picks it up automatically, so no code path can respond with a
// ticket without going through this class first.
export class TicketEntity {
  private constructor(
    private readonly id: number,
    private readonly organizationId: number,
    private readonly customerEmail: string,
    private readonly subject: string,
    private readonly message: string,
    private readonly category: TicketCategory | null,
    private readonly suggestedReply: string | null,
    private readonly status: TicketStatus,
    private readonly createdAt: Date,
  ) {}

  static from(ticket: Ticket): TicketEntity {
    return new TicketEntity(
      ticket.id,
      ticket.organizationId,
      ticket.customerEmail,
      ticket.subject,
      ticket.message,
      narrowCategory(ticket.category),
      ticket.suggestedReply,
      narrowStatus(ticket.status),
      ticket.createdAt,
    );
  }

  toJSON(): TicketResponse {
    return {
      id: this.id,
      organization_id: this.organizationId,
      customer_email: this.customerEmail,
      subject: this.subject,
      message: this.message,
      category: this.category,
      suggested_reply: this.suggestedReply,
      status: this.status,
      created_at: this.createdAt.toISOString(),
    };
  }
}
