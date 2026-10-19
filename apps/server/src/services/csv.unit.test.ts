import { describe, expect, it } from 'vitest';
import { mapAndValidateRows, parseCsv, sanitizeCsvCell, rejectedRowsToCsv } from './csvService.js';

describe('csvService', () => {
  it('parses CSV and maps rows', () => {
    const { headers, rows } = parseCsv('name,phone,consent\nAda,+14155550101,yes\n');
    expect(headers).toEqual(['name', 'phone', 'consent']);
    const { accepted, rejected } = mapAndValidateRows(rows, {
      name: 'name',
      phone: 'phone',
      consent: 'consent',
    });
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
    expect(accepted[0]!.phoneE164).toBe('+14155550101');
  });

  it('rejects invalid phones and guards formula injection', () => {
    const { rows } = parseCsv('name,phone\nBob,123\n');
    const { rejected } = mapAndValidateRows(rows, { name: 'name', phone: 'phone' });
    expect(rejected[0]!.reason).toMatch(/digit|country/i);
    expect(sanitizeCsvCell('=CMD()')).toMatch(/^'/);
    const csv = rejectedRowsToCsv(rejected);
    expect(csv).toContain('line,reason');
  });
});
