import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getEnv } from '../config/env.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const env = getEnv();

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.flatten(),
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // csrf-csrf errors
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'EBADCSRFTOKEN'
  ) {
    return res.status(403).json({
      error: { code: 'CSRF', message: 'Invalid CSRF token' },
    });
  }

  logger.error({ err: sanitizeError(err), msg: 'unhandled_error' });

  return res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Internal server error',
      ...(env.NODE_ENV === 'production' ? {} : { debug: String(err) }),
    },
  });
}

function sanitizeError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  const copy = { ...(err as Record<string, unknown>) };
  for (const k of ['password', 'token', 'authorization', 'cookie', 'accessToken']) {
    if (k in copy) copy[k] = '[REDACTED]';
  }
  return copy;
}
