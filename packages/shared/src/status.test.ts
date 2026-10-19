import { describe, expect, it } from 'vitest';
import { canTransition, shouldApplyStatusUpdate } from './status.js';

describe('message status machine', () => {
  it('allows CREATED -> QUEUED', () => {
    expect(canTransition('CREATED', 'QUEUED')).toBe(true);
  });

  it('disallows CREATED -> DELIVERED', () => {
    expect(canTransition('CREATED', 'DELIVERED')).toBe(false);
  });

  it('does not regress FAILED', () => {
    expect(shouldApplyStatusUpdate('FAILED', 'DELIVERED')).toBe(false);
  });

  it('allows SENT -> DELIVERED', () => {
    expect(shouldApplyStatusUpdate('SENT', 'DELIVERED')).toBe(true);
  });

  it('ignores duplicate same status', () => {
    expect(shouldApplyStatusUpdate('SENT', 'SENT')).toBe(true);
  });

  it('does not apply late failure after delivery without reconcile', () => {
    expect(shouldApplyStatusUpdate('DELIVERED', 'FAILED')).toBe(false);
  });
});
