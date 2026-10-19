export type AnalyticsMetricKey =
  | 'requestsCreated'
  | 'submittedToProvider'
  | 'delivered'
  | 'read'
  | 'replies'
  | 'ratings'
  | 'landingVisits'
  | 'draftCopies'
  | 'googleClicks'
  | 'privateFeedback'
  | 'failures';

/**
 * Conversion definitions (numerator / denominator).
 * Click != published review — we never claim Google submission.
 */
export const CONVERSION_DEFINITIONS = {
  deliveryRate: {
    numerator: 'delivered' as const,
    denominator: 'submittedToProvider' as const,
    description: 'Messages delivered / messages accepted by provider',
  },
  replyRate: {
    numerator: 'replies' as const,
    denominator: 'delivered' as const,
    description: 'Customer replies / delivered messages',
  },
  ratingRate: {
    numerator: 'ratings' as const,
    denominator: 'replies' as const,
    description: 'Parsed ratings / replies',
  },
  landingVisitRate: {
    numerator: 'landingVisits' as const,
    denominator: 'ratings' as const,
    description: 'Unique landing visits / ratings (gated? NO — all ratings get link)',
  },
  copyRate: {
    numerator: 'draftCopies' as const,
    denominator: 'landingVisits' as const,
    description: 'Draft copy actions / landing visits',
  },
  googleClickRate: {
    numerator: 'googleClicks' as const,
    denominator: 'landingVisits' as const,
    description: 'Open Google Reviews clicks / landing visits (not publish proof)',
  },
  failureRate: {
    numerator: 'failures' as const,
    denominator: 'submittedToProvider' as const,
    description: 'Failed sends / provider submissions',
  },
} as const;

export function safeRate(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return numerator / denominator;
}

export function emptyAnalyticsSummary() {
  return {
    requestsCreated: 0,
    submittedToProvider: 0,
    delivered: 0,
    read: 0,
    replies: 0,
    ratings: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>,
    landingVisits: 0,
    draftCopies: 0,
    googleClicks: 0,
    privateFeedback: 0,
    failures: 0,
    conversions: {
      deliveryRate: null as number | null,
      replyRate: null as number | null,
      ratingRate: null as number | null,
      landingVisitRate: null as number | null,
      copyRate: null as number | null,
      googleClickRate: null as number | null,
      failureRate: null as number | null,
    },
  };
}
