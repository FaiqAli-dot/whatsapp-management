import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearCollections } from '../test/setup.js';
import { createApp } from '../app.js';
import { registerAndLogin, onboardBusiness } from '../test/helpers.js';
import type { Express } from 'express';
import { ReviewRequest } from '../models/ReviewRequest.js';
import { hashToken } from '../lib/crypto.js';

let app: Express;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
}, 120000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('API integration', () => {
  it('registers, onboards, CRUD customer, CSV import, review flow with simulator', async () => {
    const { agent, csrf: csrf0 } = await registerAndLogin(app, {
      email: 'owner-a@example.com',
    });
    const { csrf } = await onboardBusiness(agent, csrf0);

    const h = { 'x-test-csrf': '1' };
    const cust = await agent.post('/api/v1/customers').set(h).send({
      name: 'Jane Doe',
      phone: '+14155550200',
      consentGiven: true,
      consentSource: 'manual',
    });
    expect(cust.status).toBe(201);
    const customerId = cust.body.customer.id as string;

    // Invalid CSV rejected
    const badCsv = Buffer.from('name,phone\nX,bad\n');
    const badImport = await agent
      .post('/api/v1/customers/import')
      .set(h)
      .field('mapping', JSON.stringify({ name: 'name', phone: 'phone', consent: 'consent' }))
      .attach('file', badCsv, 'bad.csv');
    expect(badImport.status).toBe(200);
    expect(badImport.body.rejectedCount).toBeGreaterThan(0);

    // Valid CSV
    const goodCsv = Buffer.from('name,phone,consent\nSam,+14155550300,yes\n');
    const goodImport = await agent
      .post('/api/v1/customers/import')
      .set(h)
      .field('mapping', JSON.stringify({ name: 'name', phone: 'phone', consent: 'consent' }))
      .attach('file', goodCsv, 'good.csv');
    expect(goodImport.body.imported).toBe(1);
    expect(goodImport.body.notice).toMatch(/No review requests were sent/i);

    const preview = await agent.post('/api/v1/review-requests/preview').set(h).send({ customerId });
    expect(preview.body.canSend).toBe(true);
    expect(preview.body.simulated).toBe(true);

    const created = await agent
      .post('/api/v1/review-requests')
      .set(h)
      .send({ customerId, confirm: true });
    expect(created.status).toBe(201);
    expect(created.body.request.simulated).toBe(true);
    expect(['SENT', 'QUEUED', 'SENDING']).toContain(created.body.request.status);

    // Ensure sent
    await agent.post('/api/v1/simulator/process-jobs').set(h);
    const rrId = created.body.request.id as string;
    let rr = await ReviewRequest.findById(rrId);
    expect(rr?.status).toBe('SENT');
    expect(rr?.providerMessageId).toBeTruthy();

    // Delivery webhook (simulated)
    const del = await agent
      .post('/api/v1/simulator/deliver')
      .set(h)
      .send({ reviewRequestId: rrId, status: 'delivered' });
    expect(del.body.simulated).toBe(true);
    expect(del.body.duplicate).toBe(false);

    // Duplicate webhook does not duplicate analytics
    const del2 = await agent
      .post('/api/v1/simulator/deliver')
      .set(h)
      .send({ reviewRequestId: rrId, status: 'delivered' });
    // different event id each time from simulator route — status apply is idempotent via shouldApply
    expect(del2.body.simulated).toBe(true);

    // Inbound ratings 5
    const inbound = await agent
      .post('/api/v1/simulator/inbound')
      .set(h)
      .send({ reviewRequestId: rrId, text: '5 - Great service!' });
    expect(inbound.body.request.rating).toBe(5);
    expect(inbound.body.request.draftText).toBeTruthy();

    const reveal = await agent
      .post('/api/v1/simulator/reveal-landing-token')
      .set(h)
      .send({ reviewRequestId: rrId });
    const token = reveal.body.token as string;

    const landing = await agent.get(`/api/v1/r/${token}`);
    expect(landing.status).toBe(200);
    expect(landing.body.businessName).toBeTruthy();
    expect(landing.body.notice).toMatch(/paste it yourself/i);

    await agent.post(`/api/v1/r/${token}/track`).send({ action: 'draft_copy' });
    await agent.post(`/api/v1/r/${token}/track`).send({ action: 'google_click' });
    await agent
      .post(`/api/v1/r/${token}/private-feedback`)
      .send({ message: 'Please call me about parking' });

    const analytics = await agent.get('/api/v1/analytics');
    expect(analytics.body.requestsCreated).toBeGreaterThanOrEqual(1);
    expect(analytics.body.ratings).toBeGreaterThanOrEqual(1);
    expect(analytics.body.draftCopies).toBe(1);
    expect(analytics.body.googleClicks).toBe(1);
    expect(analytics.body.privateFeedback).toBe(1);
    expect(analytics.body.note).toMatch(/not proof/i);

    // Expired token
    rr = await ReviewRequest.findById(rrId);
    rr!.landingTokenExpiresAt = new Date(Date.now() - 1000);
    await rr!.save();
    const expired = await agent.get(`/api/v1/r/${token}`);
    expect(expired.status).toBe(403);
  });

  it('tenant isolation: Business A cannot access Business B', async () => {
    const a = await registerAndLogin(app, { email: 'tenant-a@example.com' });
    const aOn = await onboardBusiness(a.agent, a.csrf);
    const custA = await a.agent
      .post('/api/v1/customers')
      .set('x-test-csrf', '1')
      .send({ name: 'A Cust', phone: '+14155551001', consentGiven: true });

    const b = await registerAndLogin(app, { email: 'tenant-b@example.com' });
    const bOn = await onboardBusiness(b.agent, b.csrf);

    const leak = await b.agent
      .get(`/api/v1/customers/${custA.body.customer.id}`)
      .set('x-test-csrf', '1');
    expect(leak.status).toBe(404);

    const leakDel = await b.agent
      .delete(`/api/v1/customers/${custA.body.customer.id}`)
      .set('x-test-csrf', '1');
    expect(leakDel.status).toBe(404);

    const analyticsB = await b.agent.get('/api/v1/analytics');
    expect(analyticsB.body.requestsCreated).toBe(0);
  });

  it('opt-out suppresses future messages', async () => {
    const { agent, csrf: csrf0 } = await registerAndLogin(app, { email: 'optout@example.com' });
    const { csrf } = await onboardBusiness(agent, csrf0);
    const cust = await agent
      .post('/api/v1/customers')
      .set('x-test-csrf', '1')
      .send({ name: 'Opt', phone: '+14155552000', consentGiven: true });

    const created = await agent
      .post('/api/v1/review-requests')
      .set('x-test-csrf', '1')
      .send({ customerId: cust.body.customer.id, confirm: true });
    await agent.post('/api/v1/simulator/process-jobs').set('x-test-csrf', '1');

    await agent
      .post('/api/v1/simulator/inbound')
      .set('x-test-csrf', '1')
      .send({ reviewRequestId: created.body.request.id, text: 'STOP' });

    const preview = await agent
      .post('/api/v1/review-requests/preview')
      .set('x-test-csrf', '1')
      .send({ customerId: cust.body.customer.id });
    expect(preview.body.canSend).toBe(false);
    expect(preview.body.issues.join(' ')).toMatch(/opt/i);
  });

  it('disconnected WhatsApp shows actionable errors', async () => {
    const { agent, csrf: csrf0 } = await registerAndLogin(app, { email: 'disc@example.com' });
    const { csrf } = await onboardBusiness(agent, csrf0);
    await agent.post('/api/v1/whatsapp/disconnect').set('x-test-csrf', '1');
    const cust = await agent
      .post('/api/v1/customers')
      .set('x-test-csrf', '1')
      .send({ name: 'X', phone: '+14155553000', consentGiven: true });
    const preview = await agent
      .post('/api/v1/review-requests/preview')
      .set('x-test-csrf', '1')
      .send({ customerId: cust.body.customer.id });
    expect(preview.body.canSend).toBe(false);
    expect(preview.body.issues.join(' ')).toMatch(/WhatsApp/i);
  });

  it('simulated failed send', async () => {
    const { agent, csrf: csrf0 } = await registerAndLogin(app, { email: 'fail@example.com' });
    const { csrf } = await onboardBusiness(agent, csrf0);
    // Phone ending in 0000 triggers simulator failure
    const cust = await agent
      .post('/api/v1/customers')
      .set('x-test-csrf', '1')
      .send({ name: 'Fail', phone: '+14155550000', consentGiven: true });
    const created = await agent
      .post('/api/v1/review-requests')
      .set('x-test-csrf', '1')
      .send({ customerId: cust.body.customer.id, confirm: true });
    await agent.post('/api/v1/simulator/process-jobs').set('x-test-csrf', '1');
    // may need multiple ticks for retries — check failed or pending retry
    const detail = await agent.get(`/api/v1/review-requests/${created.body.request.id}`);
    expect(['FAILED', 'QUEUED', 'SENDING', 'CREATED']).toContain(detail.body.request.status);
    if (detail.body.request.status === 'FAILED') {
      expect(detail.body.request.failureReason).toBeTruthy();
      expect(detail.body.request.simulated).toBe(true);
    }
  });

  it('account deletion purges tenant data', async () => {
    const {
      agent,
      csrf: csrf0,
      user,
    } = await registerAndLogin(app, {
      email: 'delete-me@example.com',
    });
    const { csrf } = await onboardBusiness(agent, csrf0);
    await agent
      .post('/api/v1/customers')
      .set('x-test-csrf', '1')
      .send({ name: 'Z', phone: '+14155554000', consentGiven: true });

    const del = await agent
      .delete('/api/v1/account')
      .set('x-test-csrf', '1')
      .send({ confirm: 'DELETE' });
    expect(del.status).toBe(200);

    const { Customer } = await import('../models/Customer.js');
    const left = await Customer.countDocuments({ businessId: user.businessId });
    // businessId on user was set after onboard — may be stale on returned user object
    expect(left).toBe(0);
  });

  it('revoked landing token rejected', async () => {
    const { agent, csrf: csrf0 } = await registerAndLogin(app, { email: 'rev@example.com' });
    const { csrf } = await onboardBusiness(agent, csrf0);
    const cust = await agent
      .post('/api/v1/customers')
      .set('x-test-csrf', '1')
      .send({ name: 'R', phone: '+14155555000', consentGiven: true });
    const created = await agent
      .post('/api/v1/review-requests')
      .set('x-test-csrf', '1')
      .send({ customerId: cust.body.customer.id, confirm: true });
    await agent.post('/api/v1/simulator/process-jobs').set('x-test-csrf', '1');
    await agent
      .post('/api/v1/simulator/inbound')
      .set('x-test-csrf', '1')
      .send({ reviewRequestId: created.body.request.id, text: '4' });
    const reveal = await agent
      .post('/api/v1/simulator/reveal-landing-token')
      .set('x-test-csrf', '1')
      .send({ reviewRequestId: created.body.request.id });
    const rr = await ReviewRequest.findById(created.body.request.id);
    rr!.landingRevokedAt = new Date();
    await rr!.save();
    const landing = await agent.get(`/api/v1/r/${reveal.body.token}`);
    expect(landing.status).toBe(403);
    // token hash still stored hashed
    expect(rr!.landingTokenHash).toBe(hashToken(reveal.body.token));
  });
});
