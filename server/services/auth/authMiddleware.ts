import { Request, Response, NextFunction } from 'express';
import { globalAuthService, SafeUser } from './auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      userId?: string;
      sessionToken?: string;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const sessionHeader = req.headers['x-rodex-session-token'] as string | undefined;

    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer session_')) {
      token = authHeader.slice(7);
    } else if (sessionHeader && sessionHeader.startsWith('session_')) {
      token = sessionHeader;
    }

    if (token) {
      const user = globalAuthService.verifySession(token);
      if (user) {
        req.user = user;
        req.userId = user.id;
        req.sessionToken = token;
        return next();
      }
    }

    // No valid credential means anonymous access, never impersonate an owner.
    next();
  } catch (err) {
    next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): any {
  if (!req.user || !req.userId) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}
