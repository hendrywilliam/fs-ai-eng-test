import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketStatus,
} from '../../domain/ticket-enums.js';

export const DEFAULT_TICKET_PAGE_SIZE = 50;
export const MAX_TICKET_PAGE_SIZE = 100;

export class ListTicketsQueryDto {
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatus;

  @IsOptional()
  @IsIn(TICKET_CATEGORIES)
  category?: TicketCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TICKET_PAGE_SIZE)
  limit: number = DEFAULT_TICKET_PAGE_SIZE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
