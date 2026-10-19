export const MESSAGE_STATUSES = [
  'CREATED',
  'QUEUED',
  'SENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'CANCELLED',
] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Permitted transitions. API acceptance != delivery. */
export const STATUS_TRANSITIONS: Record<MessageStatus, readonly MessageStatus[]> = {
  CREATED: ['QUEUED', 'CANCELLED'],
  QUEUED: ['SENDING', 'CANCELLED', 'FAILED'],
  SENDING: ['SENT', 'FAILED'],
  SENT: ['DELIVERED', 'READ', 'FAILED'],
  DELIVERED: ['READ', 'FAILED'],
  READ: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: MessageStatus, to: MessageStatus): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Rank for out-of-order webhook reconciliation (higher = later). */
export const STATUS_RANK: Record<MessageStatus, number> = {
  CREATED: 0,
  QUEUED: 1,
  SENDING: 2,
  SENT: 3,
  DELIVERED: 4,
  READ: 5,
  FAILED: 6,
  CANCELLED: 6,
};

export function shouldApplyStatusUpdate(current: MessageStatus, incoming: MessageStatus): boolean {
  if (current === 'FAILED' || current === 'CANCELLED') return false;
  if (incoming === 'FAILED' && ['SENT', 'DELIVERED', 'READ'].includes(current)) {
    // Ambiguous late failure after delivery — do not regress without reconcile flag
    return false;
  }
  if (canTransition(current, incoming)) return true;
  // Allow forward jumps that Meta may emit (e.g. SENT -> READ)
  return STATUS_RANK[incoming] > STATUS_RANK[current] && incoming !== 'FAILED';
}
