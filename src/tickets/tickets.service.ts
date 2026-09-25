import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { TicketStatus } from '../domain/ticket-enums.js';
import type { Ticket } from '../generated/prisma/client.js';
import { ClassificationService } from './classification.service.js';
import type { CreateTicketDto } from './dto/create-ticket.dto.js';
import type { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import type { TicketResponse } from './dto/ticket-response.js';
import type { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { TicketEntity } from './entities/ticket.entity.js';
import { TicketCacheRepository } from './repo/ticket-cache.repository.js';
import { TicketsRepository } from './repo/tickets.repository.js';

const INITIAL_TICKET_STATUS: TicketStatus = 'open';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly ticketCache: TicketCacheRepository,
    private readonly classification: ClassificationService,
  ) {}

  async create(organizationId: number, dto: CreateTicketDto): Promise<TicketResponse> {
    let ticket = await this.ticketsRepository.create({
      organizationId,
      customerEmail: dto.customer_email,
      subject: dto.subject,
      message: dto.message,
      status: INITIAL_TICKET_STATUS,
    });

    const classification = await this.classification.classify(
      organizationId,
      dto.subject,
      dto.message,
    );

    if (classification.category === null && classification.suggestedReply === null) {
      this.logger.warn(
        `Ticket ${ticket.id} saved without classification (LLM unavailable or returned no usable result)`,
      );
      return TicketEntity.from(ticket).toJSON();
    }

    await this.ticketsRepository.applyClassification(organizationId, ticket.id, {
      category: classification.category,
      suggestedReply: classification.suggestedReply,
    });

    ticket = await this.requireTicket(organizationId, ticket.id);
    await this.ticketCache.invalidate(organizationId, ticket.id);

    return TicketEntity.from(ticket).toJSON();
  }

  async findAll(organizationId: number, query: ListTicketsQueryDto): Promise<TicketResponse[]> {
    const tickets = await this.ticketsRepository.findMany(organizationId, query);

    return tickets.map((ticket) => TicketEntity.from(ticket).toJSON());
  }

  async findOne(organizationId: number, id: number): Promise<TicketResponse> {
    const cached = await this.ticketCache.get(organizationId, id);

    if (cached !== null) {
      return cached;
    }

    const response = TicketEntity.from(
      await this.requireTicket(organizationId, id),
    ).toJSON();
    await this.ticketCache.set(organizationId, id, response);

    return response;
  }

  async updateStatus(
    organizationId: number,
    id: number,
    dto: UpdateTicketStatusDto,
  ): Promise<TicketResponse> {
    const ticket = await this.ticketsRepository.updateStatus(organizationId, id, dto.status);

    if (ticket === null) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    await this.ticketCache.invalidate(organizationId, id);

    return TicketEntity.from(ticket).toJSON();
  }

  private async requireTicket(organizationId: number, id: number): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findById(organizationId, id);

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }
}
