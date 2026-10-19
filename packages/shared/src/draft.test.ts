import { describe, expect, it } from 'vitest';
import { generateTemplateDraft, redactPiiForLlm } from './draft.js';

describe('generateTemplateDraft', () => {
  it('preserves negative sentiment', () => {
    const d = generateTemplateDraft({
      businessName: 'Acme Salon',
      rating: 1,
      feedback: 'Waited too long and staff were rude',
    });
    expect(d.text).toContain('Waited too long');
    expect(d.text.toLowerCase()).not.toMatch(/great|amazing|recommend/);
  });

  it('does not invent services', () => {
    const d = generateTemplateDraft({
      businessName: 'Clinic X',
      rating: 5,
      feedback: 'Friendly front desk',
    });
    expect(d.text).not.toMatch(/surgery|doctor|treatment/i);
    expect(d.text).toContain('Friendly front desk');
  });

  it('handles missing feedback', () => {
    const d = generateTemplateDraft({ businessName: 'Shop', rating: 5 });
    expect(d.text.length).toBeGreaterThan(10);
    expect(d.editable).toBe(true);
  });
});

describe('redactPiiForLlm', () => {
  it('redacts email and phone', () => {
    const out = redactPiiForLlm('Contact jane@example.com or +1 555 123 4567');
    expect(out).not.toContain('jane@example.com');
    expect(out).toContain('[email]');
    expect(out).toContain('[phone]');
  });
});
