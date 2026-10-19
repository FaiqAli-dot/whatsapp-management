import { describe, expect, it, beforeAll } from 'vitest';
import { resetEnvCache, loadEnv } from '../config/env.js';
import {
  encryptSecret,
  decryptSecret,
  hashToken,
  generateUnguessableToken,
} from '../lib/crypto.js';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-cred-encryption-key-32chars!!';
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars!!';
  resetEnvCache();
  loadEnv();
});

describe('crypto', () => {
  it('encrypts and decrypts secrets', () => {
    const enc = encryptSecret('meta-access-token-value');
    expect(enc).not.toContain('meta-access-token-value');
    expect(decryptSecret(enc)).toBe('meta-access-token-value');
  });

  it('hashes tokens (no plaintext storage)', () => {
    const raw = generateUnguessableToken();
    const h = hashToken(raw);
    expect(h).toHaveLength(64);
    expect(h).not.toBe(raw);
  });
});
