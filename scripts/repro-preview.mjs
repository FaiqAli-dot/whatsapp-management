import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri('repro');

const env = {
  ...process.env,
  NODE_ENV: 'development',
  WHATSAPP_MODE: 'simulator',
  BILLING_MODE: 'test',
  SESSION_SECRET: 'e2e-session-secret-at-least-32-chars',
  CREDENTIAL_ENCRYPTION_KEY: 'e2e-cred-encryption-key-32chars!!',
  PORT: '4010',
  APP_URL: 'http://127.0.0.1:4173',
  CLIENT_URL: 'http://127.0.0.1:4173',
  MONGODB_URI: uri,
  CORS_ORIGINS: 'http://127.0.0.1:4173',
  LOG_LEVEL: 'debug',
  COOKIE_SECURE: 'false',
};

const child = spawn('npx', ['tsx', 'apps/server/src/index.ts'], {
  cwd: root,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (d) => process.stdout.write(d));
child.stderr.on('data', (d) => process.stderr.write(d));

await new Promise((r) => setTimeout(r, 2500));

const jar = [];
async function api(method, p, body, csrf) {
  const headers = { 'content-type': 'application/json' };
  if (csrf) headers['x-csrf-token'] = csrf;
  if (jar.length) headers.cookie = jar.join('; ');
  const res = await fetch(`http://127.0.0.1:4010${p}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.getSetCookie?.() || [];
  for (const c of sc) jar.push(c.split(';')[0]);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const csrf1 = await api('GET', '/api/v1/auth/csrf');
const token = csrf1.json.csrfToken;
const reg = await api('POST', '/api/v1/auth/register', {
  email: 'repro@example.com',
  password: 'Password123!',
  name: 'R',
}, token);
console.log('reg', reg.status);
const csrf2 = (await api('GET', '/api/v1/auth/csrf')).json.csrfToken;
const biz = await api('POST', '/api/v1/business', {
  name: 'Salon',
  category: 'salon',
  phone: '+14155557000',
  country: 'US',
  timezone: 'UTC',
  googleReviewUrl: 'https://g.page/r/x',
}, csrf2);
console.log('biz', biz.status, biz.json);
const csrf3 = (await api('GET', '/api/v1/auth/csrf')).json.csrfToken;
await api('POST', '/api/v1/whatsapp/connect/simulator', {}, csrf3);
const csrf4 = (await api('GET', '/api/v1/auth/csrf')).json.csrfToken;
const cust = await api('POST', '/api/v1/customers', {
  name: 'C',
  phone: '+14155557001',
  consentGiven: true,
}, csrf4);
console.log('cust', cust.status, cust.json);
const csrf5 = (await api('GET', '/api/v1/auth/csrf')).json.csrfToken;
const prev = await api('POST', '/api/v1/review-requests/preview', {
  customerId: cust.json.customer?.id,
}, csrf5);
console.log('preview', prev.status, JSON.stringify(prev.json, null, 2));

child.kill('SIGTERM');
await mongo.stop();
process.exit(0);
