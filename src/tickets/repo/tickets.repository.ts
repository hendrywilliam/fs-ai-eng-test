import { Injectable } from '@nestjs/common';
import type { TicketCategory, TicketStatus } from '../../domain/ticket-enums.js';
import type { Ticket } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ListTicketsQueryDto } from '../dto/list-tickets-query.dto.js';

export interface CreateTicketInput {
  organizationId: number;
  customerEmail: string;
  subject: string;
  message: string;
  status: TicketStatus;
}

export interface TicketClassificationPatch {
  category: TicketCategory | null;
  suggestedReply: string | null;
}

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateTicketInput): Promise<Ticket> {
    return this.prisma.ticket.create({
      data: {
        organizationId: input.organizationId,
        customerEmail: input.customerEmail,
        subject: input.subject,
        message: input.message,
        status: input.status,
      },
    });
  }

  findById(organizationId: number, id: number): Promise<Ticket | null> {
    return this.prisma.ticket.findFirst({ where: { id, organizationId } });
  }

  findMany(organizationId: number, query: ListTicketsQueryDto): Promise<Ticket[]> {
    return this.prisma.ticket.findMany({
      where: {
        organizationId,
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.category !== undefined ? { category: query.category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    });
  }

  async applyClassification(
    organizationId: number,
    id: number,
    patch: TicketClassificationPatch,
  ): Promise<void> {
    await this.prisma.ticket.updateMany({
      where: { id, organizationId },
      data: {
        category: patch.category ?? undefined,
        suggestedReply: patch.suggestedReply ?? undefined,
      },
    });
  }

  async updateStatus(
    organizationId: number,
    id: number,
    status: TicketStatus,
  ): Promise<Ticket | null> {
    const result = await this.prisma.ticket.updateMany({
      where: { id, organizationId },
      data: { status },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(organizationId, id);
  }
}
