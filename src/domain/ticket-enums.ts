export const TICKET_STATUSES = ['open', 'in_progress', 'closed'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = ['billing', 'technical', 'general'] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isTicketCategory(value: string): value is TicketCategory {
  return (TICKET_CATEGORIES as readonly string[]).includes(value);
}
