import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, User } from './db';
import { hasRequiredAcademicRole } from './academicProgressionAuthorization';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be configured and contain at least 32 characters.'
    );
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

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string; role: string };
    const user = db.getState().users.find((u) => u.id === decoded.sub);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User record not found.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'User account is deactivated. Contact administrator.' });
    }

    if (user.isLocked) {
      return res.status(403).json({ success: false, message: 'User account is locked due to security policy.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!hasRequiredAcademicRole(req.user, allowedRoles)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' lacks permission for this action.`,
      });
    }

    next();
  };
}
