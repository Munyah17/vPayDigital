import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ProviderError } from '@vpay/types';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (err instanceof ProviderError) {
    logger.warn({ err, url: req.url }, 'Provider error');
    const status = err.statusCode ?? 502;
    res.status(status).json({
      success: false,
      error: 'Payment provider error',
      message: err.message,
    });
    return;
  }

  if (err instanceof Error) {
    logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');

    if (err.message.includes('Insufficient balance') || err.message.includes('Insufficient float')) {
      res.status(402).json({ success: false, error: err.message });
      return;
    }

    if (err.message.includes('not found')) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }

    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
    return;
  }

  res.status(500).json({ success: false, error: 'Internal server error' });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.url} not found` });
}
