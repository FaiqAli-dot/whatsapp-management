import pino from 'pino';
import { getEnv } from '../config/env.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'password',
  'accessToken',
  'token',
  'secret',
  'cookie',
  '*.password',
  '*.accessToken',
  '*.token',
  '*.secret',
  'body.password',
  'body.accessToken',
];

export function createLogger(name?: string) {
  const env = getEnv();
  return pino({
    name,
    level: env.LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}

export const logger = createLogger('wrs');
