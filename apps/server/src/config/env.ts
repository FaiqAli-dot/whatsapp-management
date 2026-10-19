import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/wrs_dev'),
  SESSION_SECRET: z.string().min(32).default('dev-only-session-secret-change-me-32b'),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).default('dev-only-cred-encryption-key-32b!!'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  WHATSAPP_MODE: z.enum(['simulator', 'meta']).default('simulator'),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default('dev-verify-token'),
  META_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  BILLING_MODE: z.enum(['test', 'stripe']).default('test'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_MODE: z.enum(['console', 'smtp']).default('console'),
  SMTP_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${msg}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (env.SESSION_SECRET.includes('dev-only')) {
      throw new Error('SESSION_SECRET must be set in production');
    }
    if (env.CREDENTIAL_ENCRYPTION_KEY.includes('dev-only')) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be set in production');
    }
    if (env.WHATSAPP_MODE === 'meta' && !env.META_APP_SECRET) {
      throw new Error('META_APP_SECRET required when WHATSAPP_MODE=meta');
    }
  }
  cached = env;
  return env;
}

export function getEnv(): Env {
  if (!cached) return loadEnv();
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
