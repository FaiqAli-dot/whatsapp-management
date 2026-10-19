import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';
import { getEnv } from '../config/env.js';

const env = () => getEnv();

export const { generateToken: generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env().SESSION_SECRET,
  getSessionIdentifier: (req: Request) => req.sessionID || 'anonymous',
  cookieName: 'wrs.csrf',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    secure: env().COOKIE_SECURE ?? env().NODE_ENV === 'production',
    httpOnly: true,
  },
  getTokenFromRequest: (req: Request) =>
    (req.headers['x-csrf-token'] as string | undefined) || (req.body?._csrf as string | undefined),
});
