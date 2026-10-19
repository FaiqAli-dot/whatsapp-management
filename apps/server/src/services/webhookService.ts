import { createHash } from 'node:crypto';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { WhatsAppConnection } from '../models/WhatsAppConnection.js';
import { applyProviderStatusUpdate, handleInboundReply } from './reviewRequestService.js';
import { logger } from '../lib/logger.js';

function payloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Idempotent webhook processing — duplicate eventId is ignored.
 */
export async function processWhatsAppWebhook(input: {
  provider: 'meta' | 'simulator';
  eventId: string;
  payload: unknown;
  simulated: boolean;
}): Promise<{ duplicate: boolean; processed: boolean }> {
  try {
    await WebhookEvent.create({
      provider: input.provider,
      eventId: input.eventId,
      payloadHash: payloadHash(input.payload),
      status: 'received',
      simulated: input.simulated,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      return { duplicate: true, processed: false };
    }
    throw err;
  }

  try {
    await handleWebhookPayload(input.payload, input.simulated);
    await WebhookEvent.updateOne(
      { provider: input.provider, eventId: input.eventId },
      { $set: { status: 'processed', processedAt: new Date() } },
    );
    return { duplicate: false, processed: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await WebhookEvent.updateOne(
      { provider: input.provider, eventId: input.eventId },
      { $set: { status: 'failed', error: message.slice(0, 500) } },
    );
    logger.warn({ msg: 'webhook_process_failed', error: message });
    return { duplicate: false, processed: false };
  }
}

async function handleWebhookPayload(payload: unknown, simulated: boolean): Promise<void> {
  const body = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          statuses?: Array<{
            id: string;
            status: string;
            errors?: Array<{ message?: string }>;
          }>;
          messages?: Array<{
            id: string;
            from: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
    // Simulator shorthand
    simulator?: {
      kind: 'status' | 'inbound';
      providerMessageId?: string;
      status?: string;
      fromE164?: string;
      text?: string;
      businessId?: string;
      phoneNumberId?: string;
    };
  };

  if (body.simulator) {
    const s = body.simulator;
    if (s.kind === 'status' && s.providerMessageId && s.status) {
      await applyProviderStatusUpdate({
        providerMessageId: s.providerMessageId,
        status: s.status as 'sent' | 'delivered' | 'read' | 'failed',
        simulated: true,
      });
    }
    if (s.kind === 'inbound' && s.fromE164 && s.text) {
      await handleInboundReply({
        businessId: s.businessId,
        fromE164: s.fromE164,
        text: s.text,
        providerMessageId: s.providerMessageId || `sim_in_${Date.now()}`,
        simulated: true,
      });
    }
    return;
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      const phoneNumberId = value.metadata?.phone_number_id;
      let businessId: string | undefined;
      if (phoneNumberId) {
        const conn = await WhatsAppConnection.findOne({ phoneNumberId }).lean();
        if (conn) businessId = String(conn.businessId);
      }

      for (const st of value.statuses ?? []) {
        const status = st.status.toLowerCase();
        if (!['sent', 'delivered', 'read', 'failed'].includes(status)) continue;
        await applyProviderStatusUpdate({
          providerMessageId: st.id,
          status: status as 'sent' | 'delivered' | 'read' | 'failed',
          simulated,
          errorMessage: st.errors?.[0]?.message,
        });
      }

      for (const msg of value.messages ?? []) {
        if (msg.type && msg.type !== 'text') continue;
        const text = msg.text?.body ?? '';
        const fromE164 = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;
        await handleInboundReply({
          businessId,
          fromE164,
          text,
          providerMessageId: msg.id,
          simulated,
        });
      }
    }
  }
}
