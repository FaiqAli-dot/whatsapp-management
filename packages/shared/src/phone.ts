/**
 * Normalize international phone numbers to E.164.
 * Accepts common formats; requires country calling code when not present.
 */
export function normalizeE164(
  input: string,
  defaultCountryCallingCode?: string,
): { ok: true; e164: string } | { ok: false; error: string } {
  if (!input || typeof input !== 'string') {
    return { ok: false, error: 'Phone is required' };
  }
  let raw = input.trim();
  // Strip WhatsApp / tel prefixes
  raw = raw.replace(/^(whatsapp:|tel:)/i, '');
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: 'Phone must have 8–15 digits' };
  }
  if (hasPlus) {
    if (digits.length < 10) return { ok: false, error: 'Invalid E.164 length' };
    return { ok: true, e164: `+${digits}` };
  }
  if (defaultCountryCallingCode) {
    const cc = defaultCountryCallingCode.replace(/\D/g, '');
    if (!cc) return { ok: false, error: 'Invalid default country code' };
    // Avoid double-prefixing if already starts with country code
    if (digits.startsWith(cc) && digits.length >= 10) {
      return { ok: true, e164: `+${digits}` };
    }
    return { ok: true, e164: `+${cc}${digits}` };
  }
  return { ok: false, error: 'Phone must include country code (E.164)' };
}

export function phonesEqual(a: string, b: string): boolean {
  const na = normalizeE164(a);
  const nb = normalizeE164(b);
  if (!na.ok || !nb.ok) return false;
  return na.e164 === nb.e164;
}
