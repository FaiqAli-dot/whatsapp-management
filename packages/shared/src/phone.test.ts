import { describe, expect, it } from 'vitest';
import { normalizeE164 } from './phone.js';

describe('normalizeE164', () => {
  it('keeps valid E.164', () => {
    expect(normalizeE164('+14155552671')).toEqual({ ok: true, e164: '+14155552671' });
  });

  it('applies default country code', () => {
    expect(normalizeE164('(415) 555-2671', '1')).toEqual({
      ok: true,
      e164: '+14155552671',
    });
  });

  it('rejects too short', () => {
    expect(normalizeE164('123').ok).toBe(false);
  });

  it('requires country code when missing', () => {
    expect(normalizeE164('4155552671').ok).toBe(false);
  });
});
