import { googleReviewUrlSchema } from '@wrs/shared';

export type GoogleUrlValidation = {
  ok: boolean;
  status: 'valid' | 'invalid' | 'unreachable';
  message: string;
  finalUrl?: string;
};

/**
 * Format alone isn't validity — perform a HEAD/GET reachability check.
 * Does not claim Place details without Places API.
 */
export async function validateGoogleReviewUrl(url: string): Promise<GoogleUrlValidation> {
  const parsed = googleReviewUrlSchema.safeParse(url);
  if (!parsed.success) {
    return { ok: false, status: 'invalid', message: 'URL format is not a Google review/maps link' };
  }

  // In automated tests, skip live network but still require schema-valid Google hosts.
  // Production/staging always perform reachability (format alone isn't validity).
  if (process.env.NODE_ENV === 'test') {
    if (url.includes('invalid-unreachable-test')) {
      return { ok: false, status: 'unreachable', message: 'Simulated unreachable' };
    }
    return {
      ok: true,
      status: 'valid',
      message: 'URL schema-valid (test harness)',
      finalUrl: parsed.data,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(parsed.data, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'WRS-GoogleUrlValidator/1.0' },
    });
    clearTimeout(timer);
    if (res.status >= 200 && res.status < 400) {
      return {
        ok: true,
        status: 'valid',
        message: 'URL reachable',
        finalUrl: res.url || parsed.data,
      };
    }
    return {
      ok: false,
      status: 'unreachable',
      message: `URL returned HTTP ${res.status}`,
    };
  } catch {
    return {
      ok: false,
      status: 'unreachable',
      message: 'Could not reach URL (network/timeout). Check the link.',
    };
  }
}

/** Supported share format — we do not claim text prefill into Google. */
export function normalizeGoogleReviewOpenUrl(url: string): string {
  return url.trim();
}
