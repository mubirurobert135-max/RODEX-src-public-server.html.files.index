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
    const queryToken = req.query.sessionToken as string | undefined;

    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer session_')) {
      token = authHeader.slice(7);
    } else if (sessionHeader && sessionHeader.startsWith('session_')) {
      token = sessionHeader;
    } else if (queryToken && queryToken.startsWith('session_')) {
      token = queryToken;
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

    // Default fallback to initial user to maintain seamless backward compatibility
    const defaultUser = globalAuthService.getDefaultInitialUser();
    req.user = defaultUser;
    req.userId = defaultUser.id;
    req.sessionToken = globalAuthService.getDefaultInitialToken();
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
