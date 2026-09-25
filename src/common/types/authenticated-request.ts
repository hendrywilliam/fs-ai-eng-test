import type { Request } from 'express';

export interface AuthenticatedOrganization {
  id: number;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  organization: AuthenticatedOrganization;
}
