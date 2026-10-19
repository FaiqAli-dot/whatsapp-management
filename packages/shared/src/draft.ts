export interface DraftInput {
  businessName: string;
  rating: number;
  feedback?: string | null;
  category?: string;
}

export interface DraftResult {
  text: string;
  source: 'template' | 'llm';
  editable: true;
}

/**
 * Deterministic template draft from customer-supplied facts only.
 * Never invents services/staff/outcomes; never turns negative into praise.
 */
export function generateTemplateDraft(input: DraftInput): DraftResult {
  const name = sanitizeSnippet(input.businessName, 80) || 'this business';
  const feedback = input.feedback ? sanitizeSnippet(input.feedback, 400) : '';
  const rating = clampRating(input.rating);

  let text: string;
  if (rating <= 2) {
    // Preserve negative/critical sentiment — do not rewrite as praise
    if (feedback) {
      text = `My experience at ${name}: ${feedback}`;
    } else {
      text = `I rated my experience at ${name} ${rating}/5.`;
    }
  } else if (rating === 3) {
    if (feedback) {
      text = `Visit to ${name}: ${feedback}`;
    } else {
      text = `I had an okay experience at ${name} (${rating}/5).`;
    }
  } else {
    // 4–5: positive framing only from provided feedback
    if (feedback) {
      text = `${feedback} — ${name}`;
    } else {
      text = `I had a great experience at ${name} and would recommend them.`;
    }
  }

  return { text: text.trim().slice(0, 500), source: 'template', editable: true };
}

function clampRating(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function sanitizeSnippet(s: string, max: number): string {
  return s
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Minimize PII before any external LLM call. */
export function redactPiiForLlm(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\+?\d[\d\s\-().]{7,}\d/g, '[phone]')
    .replace(/\b\d{4,}\b/g, '[number]');
}
