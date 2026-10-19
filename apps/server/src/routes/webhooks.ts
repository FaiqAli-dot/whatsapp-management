import { Router } from 'express';
import { getEnv } from '../config/env.js';
import { verifyMetaSignature } from '../whatsapp/index.js';
import { processWhatsAppWebhook } from '../services/webhookService.js';
import { ValidationError } from '../lib/errors.js';
import { testBilling } from '../services/billingService.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { createHash } from 'node:crypto';

export const webhooksRouter = Router();

/** Meta webhook verification challenge */
webhooksRouter.get('/whatsapp', (req, res) => {
  const env = getEnv();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(String(challenge ?? ''));
  }
  return res.sendStatus(403);
});

webhooksRouter.post('/whatsapp', async (req, res, next) => {
  try {
    const env = getEnv();
    const raw = (req as { rawBody?: Buffer }).rawBody;

    if (env.WHATSAPP_MODE === 'meta' && env.META_APP_SECRET) {
      if (!raw) throw new ValidationError('Missing raw body for signature verification');
      const ok = verifyMetaSignature(
        raw,
        req.headers['x-hub-signature-256'] as string | undefined,
        env.META_APP_SECRET,
      );
      if (!ok) {
        return res
          .status(401)
          .json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
      }
    }

    // Reject oversized payloads (defense in depth; express json limit also applies)
    if (raw && raw.length > 1_000_000) {
      return res
        .status(413)
        .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Webhook too large' } });
    }

    const eventId =
      (req.headers['x-hub-signature-256'] as string | undefined)?.slice(0, 64) ||
      createHash('sha256')
        .update(raw || JSON.stringify(req.body))
        .digest('hex')
        .slice(0, 32) + `:${Date.now()}`;

    // Prefer Meta-provided wamid-based ids when present
    const betterId = extractEventId(req.body) || eventId;

    const result = await processWhatsAppWebhook({
      provider: 'meta',
      eventId: betterId,
      payload: req.body,
      simulated: false,
    });

    // Always 200 quickly to Meta after accept; duplicates are no-ops
    res.status(200).json({ ok: true, duplicate: result.duplicate });
  } catch (e) {
    next(e);
  }
});

webhooksRouter.post('/billing', async (req, res, next) => {
  try {
    const env = getEnv();
    if (env.BILLING_MODE === 'stripe' && env.STRIPE_WEBHOOK_SECRET) {
      // Live Stripe verification documented — not implemented without credentials
      return res.status(501).json({
        error: {
          code: 'BILLING_LIVE_NOT_CONFIGURED',
          message: 'Configure Stripe webhook verification before enabling live billing',
        },
      });
    }
    const eventId = String(
      req.body.eventId || createHash('sha256').update(JSON.stringify(req.body)).digest('hex'),
    );
    try {
      await WebhookEvent.create({
        provider: 'billing',
        eventId,
        payloadHash: createHash('sha256').update(JSON.stringify(req.body)).digest('hex'),
        status: 'processed',
        processedAt: new Date(),
        simulated: true,
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        return res.json({ ok: true, duplicate: true, testMode: true });
      }
      throw err;
    }
    await testBilling.handleWebhook({
      eventId,
      type: String(req.body.type || 'test'),
      businessId: String(req.body.businessId || ''),
    });
    res.json({ ok: true, testMode: true });
  } catch (e) {
    next(e);
  }
});

function extractEventId(body: unknown): string | null {
  const b = body as {
    entry?: Array<{
      id?: string;
      changes?: Array<{
        value?: {
          statuses?: Array<{ id: string; status: string }>;
          messages?: Array<{ id: string }>;
        };
      }>;
    }>;
  };
  const parts: string[] = [];
  for (const e of b.entry ?? []) {
    for (const c of e.changes ?? []) {
      for (const s of c.value?.statuses ?? []) parts.push(`st:${s.id}:${s.status}`);
      for (const m of c.value?.messages ?? []) parts.push(`msg:${m.id}`);
    }
  }
  if (!parts.length) return null;
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
