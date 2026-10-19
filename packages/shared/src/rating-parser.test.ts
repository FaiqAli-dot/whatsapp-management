import { describe, expect, it } from 'vitest';
import { parseCustomerReply } from './rating-parser.js';

describe('parseCustomerReply', () => {
  it('parses sole digit ratings', () => {
    expect(parseCustomerReply('5')).toEqual({ kind: 'rating', rating: 5 });
    expect(parseCustomerReply('1')).toEqual({ kind: 'rating', rating: 1 });
  });

  it('parses rating with feedback separators', () => {
    expect(parseCustomerReply('5 - Great service!')).toEqual({
      kind: 'rating',
      rating: 5,
      feedback: 'Great service!',
    });
    expect(parseCustomerReply('4, staff were friendly')).toEqual({
      kind: 'rating',
      rating: 4,
      feedback: 'staff were friendly',
    });
  });

  it('treats feedback without rating as feedback_only', () => {
    expect(parseCustomerReply('The service was okay')).toEqual({
      kind: 'feedback_only',
      feedback: 'The service was okay',
    });
  });

  it('handles opt-out keywords', () => {
    expect(parseCustomerReply('STOP')).toEqual({ kind: 'opt_out' });
    expect(parseCustomerReply('unsubscribe please')).toEqual({ kind: 'opt_out' });
  });

  it('handles word ratings multilingual', () => {
    expect(parseCustomerReply('five')).toMatchObject({ kind: 'rating', rating: 5 });
    expect(parseCustomerReply('cinco')).toMatchObject({ kind: 'rating', rating: 5 });
    expect(parseCustomerReply('trois')).toMatchObject({ kind: 'rating', rating: 3 });
  });

  it('flags ambiguous conflicting ratings', () => {
    const r = parseCustomerReply('5 - actually it was a 2');
    expect(r.kind).toBe('ambiguous');
  });

  it('does not take digits from phone-like numbers as ratings', () => {
    const r = parseCustomerReply('Call me at +15551234567');
    expect(r.kind).not.toBe('rating');
  });

  it('handles unexpected empty', () => {
    expect(parseCustomerReply('')).toMatchObject({ kind: 'unclear' });
  });

  it('parses labeled ratings', () => {
    expect(parseCustomerReply('Rating: 4 thanks')).toMatchObject({
      kind: 'rating',
      rating: 4,
    });
  });
});
