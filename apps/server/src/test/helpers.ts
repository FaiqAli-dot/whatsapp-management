import request from 'supertest';
import type { Express } from 'express';

export function agent(app: Express) {
  return request.agent(app);
}

/** Test helper headers — CSRF enforced in production; bypass only when NODE_ENV=test. */
function testHeaders() {
  return { 'x-test-csrf': '1' };
}

export async function registerAndLogin(
  app: Express,
  opts: { email: string; password?: string; name?: string } = {
    email: `user_${Date.now()}@example.com`,
  },
) {
  const password = opts.password ?? 'Password123!';
  const name = opts.name ?? 'Test User';
  const a = agent(app);

  await a.get('/api/v1/auth/csrf');

  const reg = await a
    .post('/api/v1/auth/register')
    .set(testHeaders())
    .send({ email: opts.email, password, name });

  if (reg.status >= 400) {
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  }

  return {
    agent: a,
    user: reg.body.user,
    csrf: 'test',
    password,
  };
}

export async function onboardBusiness(
  a: request.SuperAgentTest,
  _csrf: string,
  overrides: Record<string, unknown> = {},
) {
  const body = {
    name: 'Acme Salon',
    category: 'salon',
    phone: '+14155550100',
    country: 'US',
    timezone: 'America/Los_Angeles',
    googleReviewUrl: 'https://g.page/r/example-review',
    description: 'A local salon',
    ...overrides,
  };

  const res = await a.post('/api/v1/business').set(testHeaders()).send(body);
  if (res.status >= 400) {
    throw new Error(`business create failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  await a.post('/api/v1/whatsapp/connect/simulator').set(testHeaders()).send({});

  const { Business } = await import('../models/Business.js');
  if (res.body.business?.id) {
    await Business.updateOne(
      { _id: res.body.business.id },
      {
        $set: {
          googleUrlValidationStatus: 'valid',
          googleUrlValidatedAt: new Date(),
          googleReviewUrl: body.googleReviewUrl,
        },
      },
    );
  }

  const complete = await a
    .post('/api/v1/business/me/complete-onboarding')
    .set(testHeaders())
    .send({});
  if (complete.status >= 400) {
    throw new Error(
      `onboarding complete failed: ${complete.status} ${JSON.stringify(complete.body)}`,
    );
  }

  return { business: res.body.business, csrf: 'test' };
}
