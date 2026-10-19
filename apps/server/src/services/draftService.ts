import { generateTemplateDraft, redactPiiForLlm } from '@wrs/shared';
import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';

const recentCalls = new Map<string, number[]>();

function rateLimitOk(businessId: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (recentCalls.get(businessId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    recentCalls.set(businessId, arr);
    return false;
  }
  arr.push(now);
  recentCalls.set(businessId, arr);
  return true;
}

export async function generateDraft(input: {
  businessId: string;
  businessName: string;
  rating: number;
  feedback?: string | null;
  category?: string;
}): Promise<{ text: string; source: 'template' | 'llm' }> {
  const feedback = (input.feedback ?? '').slice(0, 1000);
  const template = generateTemplateDraft({
    businessName: input.businessName,
    rating: input.rating,
    feedback,
    category: input.category,
  });

  const env = getEnv();
  if (!env.OPENAI_API_KEY) {
    return { text: template.text, source: 'template' };
  }
  if (!rateLimitOk(input.businessId)) {
    return { text: template.text, source: 'template' };
  }

  try {
    const safeFeedback = redactPiiForLlm(feedback);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'Write a short Google review draft using ONLY the customer facts provided. Never invent services, staff, or outcomes. Never turn negative feedback into praise. Keep under 400 chars. Return plain text only.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              businessName: input.businessName.slice(0, 80),
              rating: input.rating,
              feedback: safeFeedback,
            }),
          },
        ],
      }),
    });
    if (!res.ok) {
      logger.warn({ msg: 'llm_draft_failed', status: res.status });
      return { text: template.text, source: 'template' };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { text: template.text, source: 'template' };
    return { text: text.slice(0, 500), source: 'llm' };
  } catch (e) {
    logger.warn({ msg: 'llm_draft_error', err: String(e) });
    return { text: template.text, source: 'template' };
  }
}
