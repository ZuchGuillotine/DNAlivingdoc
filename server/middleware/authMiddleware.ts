import { Request, Response, NextFunction } from 'express';

// Check if user is authenticated and set authentication information consistently
export const setAuthInfo = (req: Request, res: Response, next: NextFunction) => {
  // Direct check of authentication state
  const isAuthenticated = req.isAuthenticated();

  // Attach auth info to request object for consistent access
  req.authInfo = {
    isAuthenticated,
    userId: isAuthenticated && req.user ? req.user.id : null,
    userTier: isAuthenticated && req.user ? (req.user.subscriptionTier || 'free') : null,
    isAdmin: isAuthenticated && req.user ? (req.user.isAdmin || false) : false
  };

  // Only log auth failures in non-public routes
  if (!isAuthenticated && req.path.startsWith('/api/') && !req.path.startsWith('/api/query')) {
    console.log('Auth Debug -', req.path, {
      sessionID: req.sessionID,
      hasSession: !!req.session,
      hasUser: !!req.user,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Add type definition to express Request interface
declare global {
  namespace Express {
    interface Request {
      authInfo?: {
        isAuthenticated: boolean;
        userId: number | null;
        userTier: string | null;
        isAdmin: boolean;
      };
    }
  }
}