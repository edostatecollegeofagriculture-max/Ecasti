import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { hasRequiredAcademicRole } from './academicProgressionAuthorization';

export interface AuthPrincipal {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  isLocked: boolean;
}

export type UserLookup = (userId: string) => AuthPrincipal | undefined;

/**
 * Creates the production authentication middleware with an injectable user
 * lookup. Tests can supply synthetic in-memory users without loading or
 * writing the application's JSON database.
 */
export function createAuthenticateToken(
  findUser: UserLookup,
  jwtSecret: string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { sub: string };
      const user = findUser(decoded.sub);

      if (!user) {
        return res.status(401).json({ success: false, message: 'User record not found.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'User account is deactivated. Contact administrator.' });
      }
      if (user.isLocked) {
        return res.status(403).json({ success: false, message: 'User account is locked due to security policy.' });
      }

      (req as Request & { user?: AuthPrincipal }).user = user;
      return next();
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
  };
}

/** Shared role middleware; SUPER_ADMIN retains the documented global bypass. */
export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: AuthPrincipal }).user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!hasRequiredAcademicRole(user, allowedRoles)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${user.role}' lacks permission for this action.`,
      });
    }
    return next();
  };
}
