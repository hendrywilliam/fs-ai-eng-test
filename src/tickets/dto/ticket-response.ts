import type { TicketCategory, TicketStatus } from '../../domain/ticket-enums.js';

export interface TicketResponse {
  id: number;
  organization_id: number;
  customer_email: string;
  subject: string;
  message: string;
  category: TicketCategory | null;
  suggested_reply: string | null;
  status: TicketStatus;
  created_at: string;
}
