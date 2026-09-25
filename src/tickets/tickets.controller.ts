import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentOrganization } from '../common/auth/current-organization.decorator.js';
import {
  successResponse,
  type ApiSuccessResponse,
} from '../common/types/api-response.js';
import type { AuthenticatedOrganization } from '../common/types/authenticated-request.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import type { TicketResponse } from './dto/ticket-response.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  async create(
    @CurrentOrganization() organization: AuthenticatedOrganization,
    @Body() dto: CreateTicketDto,
  ): Promise<ApiSuccessResponse<TicketResponse>> {
    return successResponse(
      await this.ticketsService.create(organization.id, dto),
    );
  }

  @Get()
  async findAll(
    @CurrentOrganization() organization: AuthenticatedOrganization,
    @Query() query: ListTicketsQueryDto,
  ): Promise<ApiSuccessResponse<TicketResponse[]>> {
    return successResponse(
      await this.ticketsService.findAll(organization.id, query),
    );
  }

  @Get(':id')
  async findOne(
    @CurrentOrganization() organization: AuthenticatedOrganization,
    @Param('id', new ParseIntPipe()) id: number,
  ): Promise<ApiSuccessResponse<TicketResponse>> {
    return successResponse(
      await this.ticketsService.findOne(organization.id, id),
    );
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentOrganization() organization: AuthenticatedOrganization,
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateTicketStatusDto,
  ): Promise<ApiSuccessResponse<TicketResponse>> {
    return successResponse(
      await this.ticketsService.updateStatus(organization.id, id, dto),
    );
  }
}
