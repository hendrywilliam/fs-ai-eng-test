import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/auth/public.decorator.js';
import { HealthService, type HealthReport } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}
  @Public()
  @Get()
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthReport> {
    const { report, httpStatus } = await this.healthService.check();

    response.status(httpStatus);

    return report;
  }
}
