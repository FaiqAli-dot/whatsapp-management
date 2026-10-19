import { OPT_OUT_KEYWORDS } from './constants.js';

export type ParseResult =
  | { kind: 'opt_out' }
  | { kind: 'rating'; rating: number; feedback?: string }
  | { kind: 'feedback_only'; feedback: string }
  | { kind: 'ambiguous'; reason: string }
  | { kind: 'unclear'; reason: string };

const RATING_WORD: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  un: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
};

/**
 * Parse customer WhatsApp replies for ratings 1–5.
 * Only unambiguous ratings; never extract digits from phone-like numbers.
 */
export function parseCustomerReply(text: string): ParseResult {
  if (!text || !text.trim()) {
    return { kind: 'unclear', reason: 'Empty message' };
  }
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Opt-out check (whole-message or leading keyword)
  const firstToken =
    lower
      .replace(/[^a-zàâäéèêëïîôùûüç\-]/gi, ' ')
      .trim()
      .split(/\s+/)[0] ?? '';
  if (OPT_OUT_KEYWORDS.includes(firstToken as (typeof OPT_OUT_KEYWORDS)[number])) {
    return { kind: 'opt_out' };
  }
  if (OPT_OUT_KEYWORDS.some((k) => lower === k || lower.startsWith(`${k} `))) {
    return { kind: 'opt_out' };
  }

  // Reject phone-like long digit runs as rating sources
  if (/\+?\d[\d\s\-().]{8,}\d/.test(trimmed) && !/^[1-5]\b/.test(trimmed)) {
    // May still have rating at start — handled below
  }

  // Pattern: leading rating digit with optional separators and feedback
  // e.g. "5", "5 - Great!", "4, staff were friendly"
  const leading = trimmed.match(/^([1-5])(?:\s*[-–—,.:]\s*|\s+)(.*)$/s);
  if (leading) {
    const rating = Number(leading[1]);
    const feedback = leading[2]?.trim();
    // If remainder contains another conflicting rating digit as a standalone claim
    const conflict = feedback && detectConflictingRating(feedback, rating);
    if (conflict) {
      return { kind: 'ambiguous', reason: conflict };
    }
    return feedback ? { kind: 'rating', rating, feedback } : { kind: 'rating', rating };
  }

  // Sole digit 1-5
  if (/^[1-5]$/.test(trimmed)) {
    return { kind: 'rating', rating: Number(trimmed) };
  }

  // Word ratings: "five", "cinco stars", etc.
  const wordMatch = lower.match(
    /\b(one|two|three|four|five|uno|dos|tres|cuatro|cinco|un|deux|trois|quatre|cinq)\b/,
  );
  if (wordMatch) {
    const rating = RATING_WORD[wordMatch[1]!];
    const without = trimmed.replace(new RegExp(wordMatch[1]!, 'i'), '').trim();
    const feedback = without.replace(/^(stars?|estrellas?|étoiles?|etoiles?)\b/i, '').trim();
    return feedback
      ? { kind: 'rating', rating: rating!, feedback }
      : { kind: 'rating', rating: rating! };
  }

  // Multiple distinct 1-5 digits as standalone tokens → ambiguous
  const standaloneDigits = [...trimmed.matchAll(/(?<!\d)([1-5])(?!\d)/g)].map((m) => m[1]!);
  if (standaloneDigits.length > 1) {
    const unique = new Set(standaloneDigits);
    if (unique.size > 1) {
      return {
        kind: 'ambiguous',
        reason: 'Multiple different rating digits found',
      };
    }
  }

  // Lone standalone digit buried in text without clear marker — require clarification
  // unless it's clearly "rate/rating: N" style
  const labeled = lower.match(
    /(?:rate|rating|score|nota|calificaci[oó]n|note)\s*[:=]?\s*([1-5])\b/,
  );
  if (labeled) {
    const rating = Number(labeled[1]);
    return { kind: 'rating', rating, feedback: trimmed };
  }

  // Feedback without rating (e.g. "The service was okay")
  if (trimmed.length >= 3 && !/\d{6,}/.test(trimmed)) {
    // If a single 1-5 appears mid-sentence near "out of 5" it's ok
    const outOf = trimmed.match(/\b([1-5])\s*(?:\/|out of)\s*5\b/i);
    if (outOf) {
      return { kind: 'rating', rating: Number(outOf[1]), feedback: trimmed };
    }
    if (standaloneDigits.length === 1 && /^[1-5]$/.test(standaloneDigits[0]!)) {
      // Digit alone somewhere — too ambiguous mid-text without label
      const onlyDigitMsg = standaloneDigits.length === 1 && trimmed.length > 3;
      if (onlyDigitMsg && !/^[1-5]\b/.test(trimmed)) {
        return {
          kind: 'ambiguous',
          reason: 'Rating digit found but not clearly a score',
        };
      }
    }
    return { kind: 'feedback_only', feedback: trimmed };
  }

  return { kind: 'unclear', reason: 'Could not interpret message' };
}

function detectConflictingRating(feedback: string, primary: number): string | null {
  const matches = [...feedback.matchAll(/(?<!\d)([1-5])(?!\d)/g)].map((m) => Number(m[1]));
  const others = matches.filter((n) => n !== primary);
  // Ignore years like 2024 — already excluded by (?!\d)
  // Ignore "out of 5"
  const meaningful = others.filter((n) => {
    const re = new RegExp(`(?<!\\d)${n}(?!\\d)\\s*(?:/|out of)\\s*5`, 'i');
    return !re.test(feedback);
  });
  if (meaningful.length > 0 && new Set(meaningful).size > 0) {
    // e.g. "5 - actually it was a 2"
    if (meaningful.some((n) => n !== primary)) {
      return 'Conflicting rating values in message';
    }
  }
  return null;
}

export function clarificationPrompt(kind: 'ambiguous' | 'feedback_only' | 'unclear'): string {
  switch (kind) {
    case 'ambiguous':
      return 'Thanks for your reply! Could you rate your experience with a single number from 1 to 5?';
    case 'feedback_only':
      return 'Thanks for the feedback! Please also send a rating from 1 (poor) to 5 (excellent).';
    default:
      return 'Please reply with a rating from 1 to 5, and optionally a short comment.';
  }
}
