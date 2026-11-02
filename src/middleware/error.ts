import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class ErrorHandler {
  public static readonly handler = (error: any, req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.id || 'unknown';

    if (error instanceof ZodError) {
      logger.warn({ requestId, error: error.errors }, 'Validation error');
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error({ requestId, error }, 'Internal server error');

    res.status(500).json({
      error: 'Internal server error',
    });
  };
}