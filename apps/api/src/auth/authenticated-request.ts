import type { Request } from 'express';

export interface AuthenticatedUser {
  sub: number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
