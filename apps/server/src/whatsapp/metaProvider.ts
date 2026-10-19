import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  IWhatsAppProvider,
  ProviderHealth,
  SendResult,
  SendTemplateParams,
  SendTextParams,
} from './types.js';
import { assertNotLiveInTest } from './types.js';
import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

export class MetaCloudApiProvider implements IWhatsAppProvider {
  readonly name = 'meta' as const;
  readonly simulated = false;

  async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
    const env = getEnv();
    assertNotLiveInTest(env.WHATSAPP_MODE, env.NODE_ENV);
    if (env.WHATSAPP_MODE !== 'meta') {
      throw new AppError(500, 'Meta provider invoked while WHATSAPP_MODE!=meta', 'CONFIG');
    }

    const url = `${GRAPH}/${params.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: params.toE164.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.templateLanguage },
        components: params.components ?? [],
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string; code: number };
    };

    if (!res.ok) {
      logger.warn({
        msg: 'meta_send_failed',
        status: res.status,
        code: json.error?.code,
        // never log access token
      });
      throw new AppError(
        502,
        json.error?.message || 'WhatsApp send failed',
        'WHATSAPP_SEND_FAILED',
        { code: json.error?.code },
      );
    }

    const providerMessageId = json.messages?.[0]?.id;
    if (!providerMessageId) {
      throw new AppError(502, 'No message ID from Meta', 'WHATSAPP_NO_ID');
    }

    // API acceptance != delivery
    return { providerMessageId, accepted: true, simulated: false, raw: { id: providerMessageId } };
  }

  async sendText(params: SendTextParams): Promise<SendResult> {
    const env = getEnv();
    assertNotLiveInTest(env.WHATSAPP_MODE, env.NODE_ENV);

    const url = `${GRAPH}/${params.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: params.toE164.replace(/^\+/, ''),
      type: 'text',
      text: { body: params.body },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };
    if (!res.ok) {
      throw new AppError(
        502,
        json.error?.message || 'WhatsApp text send failed',
        'WHATSAPP_SEND_FAILED',
      );
    }
    const providerMessageId = json.messages?.[0]?.id;
    if (!providerMessageId) {
      throw new AppError(502, 'No message ID from Meta', 'WHATSAPP_NO_ID');
    }
    return { providerMessageId, accepted: true, simulated: false };
  }

  async healthCheck(params: {
    accessToken: string;
    phoneNumberId: string;
  }): Promise<ProviderHealth> {
    try {
      const res = await fetch(`${GRAPH}/${params.phoneNumberId}`, {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
      if (!res.ok) {
        return { ok: false, message: `Meta health HTTP ${res.status}`, simulated: false };
      }
      return { ok: true, message: 'Meta connection healthy', simulated: false };
    } catch (e) {
      return { ok: false, message: String(e), simulated: false };
    }
  }
}

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const metaProvider = new MetaCloudApiProvider();
