import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri('wrs_e2e');

const env = {
  ...process.env,
  // test env: disposable DB semantics + Google URL harness (no live fetch);
  // CSRF still enforced for browser clients (bypass only with x-test-csrf).
  NODE_ENV: 'test',
  WHATSAPP_MODE: 'simulator',
  BILLING_MODE: 'test',
  SESSION_SECRET: 'e2e-session-secret-at-least-32-chars',
  CREDENTIAL_ENCRYPTION_KEY: 'e2e-cred-encryption-key-32chars!!',
  PORT: '4000',
  APP_URL: 'http://127.0.0.1:4173',
  CLIENT_URL: 'http://127.0.0.1:4173',
  MONGODB_URI: uri,
  CORS_ORIGINS: 'http://127.0.0.1:4173',
  LOG_LEVEL: 'warn',
  COOKIE_SECURE: 'false',
};

const child = spawn('npx', ['tsx', 'apps/server/src/index.ts'], {
  cwd: root,
  env,
  stdio: 'inherit',
});

const shutdown = async () => {
  child.kill('SIGTERM');
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

child.on('exit', async (code) => {
  await mongo.stop();
  process.exit(code ?? 0);
});
