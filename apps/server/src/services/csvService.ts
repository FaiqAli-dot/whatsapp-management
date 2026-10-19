import { normalizeE164 } from '@wrs/shared';
import { MAX_CSV_BYTES, MAX_CSV_ROWS } from '@wrs/shared';
import { ValidationError } from '../lib/errors.js';

export interface CsvRow {
  line: number;
  name?: string;
  phone?: string;
  email?: string;
  consent?: string;
}

export interface MappedImportRow {
  line: number;
  name: string;
  phoneE164: string;
  email?: string;
  consentGiven: boolean;
  ok: true;
}

export interface RejectedRow {
  line: number;
  reason: string;
  raw: Record<string, string>;
}

/** Protect against CSV formula injection when exporting rejected reports. */
export function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  if (Buffer.byteLength(content, 'utf8') > MAX_CSV_BYTES) {
    throw new ValidationError(`CSV exceeds ${MAX_CSV_BYTES} bytes`);
  }
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  if (lines.length < 2) throw new ValidationError('CSV must include a header and at least one row');
  if (lines.length - 1 > MAX_CSV_ROWS) {
    throw new ValidationError(`CSV exceeds ${MAX_CSV_ROWS} rows`);
  }
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function mapAndValidateRows(
  rows: Record<string, string>[],
  mapping: { name: string; phone: string; email?: string; consent?: string },
  defaultCountryCallingCode?: string,
): { accepted: MappedImportRow[]; rejected: RejectedRow[] } {
  const accepted: MappedImportRow[] = [];
  const rejected: RejectedRow[] = [];
  const seenPhones = new Set<string>();

  rows.forEach((raw, idx) => {
    const line = idx + 2;
    const name = (raw[mapping.name] ?? '').trim();
    const phone = (raw[mapping.phone] ?? '').trim();
    const email = mapping.email ? (raw[mapping.email] ?? '').trim() : '';
    const consentRaw = mapping.consent ? (raw[mapping.consent] ?? '').trim().toLowerCase() : '';

    if (!name) {
      rejected.push({ line, reason: 'Missing name', raw });
      return;
    }
    const norm = normalizeE164(phone, defaultCountryCallingCode);
    if (!norm.ok) {
      rejected.push({ line, reason: norm.error, raw });
      return;
    }
    if (seenPhones.has(norm.e164)) {
      rejected.push({ line, reason: 'Duplicate phone in file', raw });
      return;
    }
    seenPhones.add(norm.e164);

    const consentGiven =
      consentRaw === 'yes' ||
      consentRaw === 'true' ||
      consentRaw === '1' ||
      consentRaw === 'y' ||
      consentRaw === 'granted';

    if (mapping.consent && !consentGiven) {
      rejected.push({ line, reason: 'Consent not granted', raw });
      return;
    }

    accepted.push({
      line,
      name,
      phoneE164: norm.e164,
      email: email || undefined,
      consentGiven: mapping.consent ? consentGiven : false,
      ok: true,
    });
  });

  return { accepted, rejected };
}

export function rejectedRowsToCsv(rejected: RejectedRow[]): string {
  const header = 'line,reason,raw_json';
  const lines = rejected.map((r) => {
    const safeRaw: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.raw)) {
      safeRaw[k] = sanitizeCsvCell(v);
    }
    return [r.line, sanitizeCsvCell(r.reason), sanitizeCsvCell(JSON.stringify(safeRaw))].join(',');
  });
  return [header, ...lines].join('\n');
}
