import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { mapPrismaError } from './prisma-exception.filter.js';

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return { code } as unknown as Prisma.PrismaClientKnownRequestError;
}

describe('mapPrismaError', () => {
  it('maps unique constraint violations to 409', () => {
    expect(mapPrismaError(knownError('P2002')).status).toBe(HttpStatus.CONFLICT);
  });

  it('maps foreign key violations to 409', () => {
    expect(mapPrismaError(knownError('P2003')).status).toBe(HttpStatus.CONFLICT);
  });

  it('maps missing records to 404', () => {
    expect(mapPrismaError(knownError('P2025')).status).toBe(HttpStatus.NOT_FOUND);
  });

  it('maps unmapped codes to a generic 500 without leaking database details', () => {
    const mapped = mapPrismaError(knownError('P9999'));

    expect(mapped.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mapped.message).toBe('Database error');
  });
});
