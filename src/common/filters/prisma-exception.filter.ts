import {
  Catch,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

interface MappedError {
  status: number;
  message: string;
}

export function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): MappedError {
  switch (exception.code) {
    case 'P2002':
      return { status: HttpStatus.CONFLICT, message: 'A record with these values already exists' };
    case 'P2003':
      return { status: HttpStatus.CONFLICT, message: 'A related record constraint was violated' };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
    default:
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Database error' };
  }
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  implements ExceptionFilter<Prisma.PrismaClientKnownRequestError>
{
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = mapPrismaError(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Unhandled Prisma error [${exception.code}]: ${exception.message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
    });
  }
}
