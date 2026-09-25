import { IsIn } from 'class-validator';
import { TICKET_STATUSES, type TicketStatus } from '../../domain/ticket-enums.js';

export class UpdateTicketStatusDto {
  @IsIn(TICKET_STATUSES)
  status: TicketStatus;
}
