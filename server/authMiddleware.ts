import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { db, User } from './db';
import { createAuthenticateToken, requireRoles } from './authenticationMiddleware';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured and contain at least 32 characters.');
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export const authenticateToken = createAuthenticateToken(
  (userId) => db.getState().users.find((user) => user.id === userId),
  JWT_SECRET
);

export { requireRoles };
