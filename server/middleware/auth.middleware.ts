import { Request, Response, NextFunction } from 'express';
import { authConfig } from '../config/auth.config';

// Middleware to ensure user is authenticated
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    console.log('Authentication required:', {
      path: req.path,
      method: req.method,
      sessionID: req.sessionID,
      timestamp: new Date().toISOString()
    });
    
    // For API routes, return JSON error
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        error: 'Authentication required',
        redirect: '/login'
      });
    }
    
    // For other routes, redirect to login
    return res.redirect('/login');
  }
  
  next();
};

// Middleware to ensure user is admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.user?.isAdmin) {
    console.log('Admin access denied:', {
      userId: req.user?.id,
      path: req.path,
      timestamp: new Date().toISOString()
    });
    
    return res.status(403).json({
      error: 'Admin access required',
      message: 'You do not have admin privileges'
    });
  }
  
  next();
};

// Middleware to check subscription tier
export const requireTier = (minTier: 'free' | 'starter' | 'pro') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userTier = req.user?.subscriptionTier || 'free';
    const tierHierarchy: Record<string, number> = { free: 0, starter: 1, pro: 2 };
    
    if (tierHierarchy[userTier] < tierHierarchy[minTier]) {
      return res.status(403).json({
        error: 'Insufficient subscription tier',
        message: `This feature requires ${minTier} tier or higher`,
        currentTier: userTier,
        requiredTier: minTier
      });
    }
    
    next();
  };
};

// Middleware to check specific feature limits
export const checkFeatureLimit = (feature: 'llm' | 'labUpload') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      // Allow unauthenticated users for some features (like public LLM queries)
      if (feature === 'llm' && req.path === '/api/query') {
        return next();
      }
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userTier = req.user?.subscriptionTier || 'free';
    const limits = authConfig.tiers[userTier as keyof typeof authConfig.tiers];
    
    // Import the tier limit service dynamically to avoid circular dependencies
    const { tierLimitService } = await import('../services/tierLimitService');
    
    try {
      if (feature === 'llm') {
        const canUse = await tierLimitService.canUseAI(req.user!.id);
        if (!canUse) {
          return res.status(429).json({
            error: 'AI usage limit reached',
            message: `You've reached your daily limit of ${limits.llmRequestsPerDay} AI requests. Please upgrade your subscription for more.`,
            limit: limits.llmRequestsPerDay,
            tier: userTier
          });
        }
      } else if (feature === 'labUpload') {
        const canUpload = await tierLimitService.canUploadLab(req.user!.id);
        if (!canUpload) {
          return res.status(429).json({
            error: 'Lab upload limit reached',
            message: `You've reached your monthly limit of ${limits.labUploadsPerMonth} lab uploads. Please upgrade your subscription for more.`,
            limit: limits.labUploadsPerMonth,
            tier: userTier
          });
        }
      }
      
      next();
    } catch (error) {
      console.error(`Error checking ${feature} limit:`, error);
      next(error);
    }
  };
};

// Optional auth - sets user info if authenticated but doesn't require it
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Passport will have already set req.user if authenticated
  // This middleware just logs for debugging
  if (req.isAuthenticated()) {
    console.log('Authenticated request:', {
      userId: req.user?.id,
      path: req.path,
      method: req.method
    });
  }
  
  next();
};

// Set auth info on request for consistent access
export const setAuthInfo = (req: Request, res: Response, next: NextFunction) => {
  const isAuthenticated = req.isAuthenticated();
  
  req.authInfo = {
    isAuthenticated,
    userId: isAuthenticated && req.user ? req.user.id : null,
    userTier: isAuthenticated && req.user ? (req.user.subscriptionTier || 'free') : null,
    isAdmin: isAuthenticated && req.user ? (req.user.isAdmin || false) : false
  };
  
  next();
};

// Type definition moved to authMiddleware.ts to avoid conflicts 