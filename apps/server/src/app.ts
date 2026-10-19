import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getEnv } from './config/env.js';
import { loadSessionUser } from './middleware/auth.js';
import { doubleCsrfProtection, generateCsrfToken } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { businessRouter } from './routes/business.js';
import { customersRouter } from './routes/customers.js';
import { reviewRequestsRouter } from './routes/reviewRequests.js';
import { whatsappRouter } from './routes/whatsapp.js';
import { webhooksRouter } from './routes/webhooks.js';
import { landingRouter } from './routes/landing.js';
import { analyticsRouter } from './routes/analytics.js';
import { billingRouter } from './routes/billing.js';
import { accountRouter } from './routes/account.js';
import { simulatorRouter } from './routes/simulator.js';
import { healthRouter } from './routes/health.js';
import { API_VERSION } from '@wrs/shared';

export function createApp(opts?: { mongoUrl?: string }) {
  const env = getEnv();
  const app = express();

  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origins.includes(origin)) return cb(null, true);
        return cb(new Error('CORS blocked'));
      },
      credentials: true,
    }),
  );

  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  const sessionStore =
    env.NODE_ENV === 'test'
      ? undefined // MemoryStore in tests is OK — production uses Mongo
      : MongoStore.create({
          mongoUrl: opts?.mongoUrl || env.MONGODB_URI,
          collectionName: 'sessions',
          ttl: 60 * 60 * 24 * 14,
        });

  app.use(
    session({
      name: 'wrs.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(loadSessionUser);

  // Health/ready must stay ahead of rate limits for orchestrator probes
  app.use(healthRouter);

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: env.NODE_ENV === 'test' ? 10_000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);

  // Webhooks before CSRF
  app.use(`/api/${API_VERSION}/webhooks`, webhooksRouter);

  // Public landing (no CSRF for GET; mutations need token in body — exempt for tokenized links)
  app.use(`/api/${API_VERSION}/r`, landingRouter);

  // CSRF for cookie-authenticated state changes
  app.get(`/api/${API_VERSION}/auth/csrf`, (req, res) => {
    // Ensure session exists so CSRF binds to a stable session identifier
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = '1';
    }
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  });

  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Landing tokenized POSTs and webhooks already mounted
    if (req.path.startsWith(`/api/${API_VERSION}/r/`)) return next();
    if (req.path.startsWith(`/api/${API_VERSION}/webhooks`)) return next();
    if (env.NODE_ENV === 'test' && req.headers['x-test-csrf'] === '1') return next();
    return doubleCsrfProtection(req, res, next);
  });

  const v1 = `/api/${API_VERSION}`;
  app.use(`${v1}/auth`, authRouter);
  app.use(`${v1}/business`, businessRouter);
  app.use(`${v1}/customers`, customersRouter);
  app.use(`${v1}/review-requests`, reviewRequestsRouter);
  app.use(`${v1}/whatsapp`, whatsappRouter);
  app.use(`${v1}/analytics`, analyticsRouter);
  app.use(`${v1}/billing`, billingRouter);
  app.use(`${v1}/account`, accountRouter);
  app.use(`${v1}/simulator`, simulatorRouter);

  app.use(errorHandler);

  void opts;
  return app;
}
