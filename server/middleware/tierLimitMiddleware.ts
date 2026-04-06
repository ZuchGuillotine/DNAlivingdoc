
import { Request, Response, NextFunction } from 'express';
import { tierLimitService } from '../services/tierLimitService';
import logger from '../utils/logger';

export const checkLLMLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      return next(); // Allow unauthenticated users (they get handled separately)
    }

    const canUseAI = await tierLimitService.canUseAI(req.user!.id);
    if (!canUseAI) {
      logger.warn('LLM limit reached:', {
        userId: req.user!.id,
        timestamp: new Date().toISOString()
      });
      return res.status(429).json({
        error: 'AI usage limit reached',
        message: 'Please upgrade your subscription to continue using AI features'
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking LLM limit:', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    next(error);
  }
};

export const checkLabUploadLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const canUploadLab = await tierLimitService.canUploadLab(req.user!.id);
    if (!canUploadLab) {
      logger.warn('Lab upload limit reached:', {
        userId: req.user!.id,
        timestamp: new Date().toISOString()
      });
      return res.status(429).json({
        error: 'Lab upload limit reached',
        message: 'Please upgrade your subscription to upload more lab results'
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking lab upload limit:', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error)
    });
    next(error);
  }
};
