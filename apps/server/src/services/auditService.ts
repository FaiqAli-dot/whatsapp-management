import { AuditEvent } from '../models/AuditEvent.js';

export async function audit(input: {
  businessId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await AuditEvent.create({
    businessId: input.businessId ?? null,
    userId: input.userId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    ip: input.ip ?? null,
    meta: scrub(input.meta ?? {}),
  });
}

function scrub(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/password|token|secret|authorization|cookie|accessToken/i.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
}
