import { CONVERSION_DEFINITIONS, emptyAnalyticsSummary, safeRate } from '@wrs/shared';
import mongoose from 'mongoose';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';

export async function recordAnalyticsEvent(input: {
  businessId: string;
  type: string;
  dedupeKey: string;
  reviewRequestId?: string | null;
  customerId?: string | null;
  ratingValue?: number | null;
  simulated?: boolean;
  meta?: Record<string, unknown>;
  occurredAt?: Date;
}): Promise<boolean> {
  try {
    await AnalyticsEvent.create({
      businessId: input.businessId,
      type: input.type,
      dedupeKey: input.dedupeKey,
      reviewRequestId: input.reviewRequestId ?? null,
      customerId: input.customerId ?? null,
      ratingValue: input.ratingValue ?? null,
      simulated: input.simulated ?? false,
      meta: input.meta ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    });
    return true;
  } catch (err: unknown) {
    // Duplicate dedupeKey — already counted
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      return false;
    }
    throw err;
  }
}

export async function getAnalyticsSummary(
  businessId: string,
  opts: { from?: Date; to?: Date } = {},
) {
  // Aggregation does not cast strings → ObjectId; match tenant explicitly.
  const match: Record<string, unknown> = {
    businessId: new mongoose.Types.ObjectId(businessId),
  };
  if (opts.from || opts.to) {
    match.occurredAt = {
      ...(opts.from ? { $gte: opts.from } : {}),
      ...(opts.to ? { $lte: opts.to } : {}),
    };
  }

  const rows = await AnalyticsEvent.aggregate<{
    _id: string;
    count: number;
    ratings: number[];
  }>([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        ratings: {
          $push: {
            $cond: [{ $eq: ['$type', 'rating'] }, '$ratingValue', '$$REMOVE'],
          },
        },
      },
    },
  ]);

  const summary = emptyAnalyticsSummary();
  const map: Record<string, keyof typeof summary> = {
    request_created: 'requestsCreated',
    submitted_to_provider: 'submittedToProvider',
    delivered: 'delivered',
    read: 'read',
    reply: 'replies',
    rating: 'ratings',
    landing_visit: 'landingVisits',
    draft_copy: 'draftCopies',
    google_click: 'googleClicks',
    private_feedback: 'privateFeedback',
    failure: 'failures',
  };

  for (const row of rows) {
    const key = map[row._id];
    if (key && key !== 'ratingDistribution' && key !== 'conversions') {
      (summary as Record<string, unknown>)[key] = row.count;
    }
    if (row._id === 'rating') {
      for (const v of row.ratings) {
        if (v >= 1 && v <= 5) {
          summary.ratingDistribution[v as 1 | 2 | 3 | 4 | 5] += 1;
        }
      }
    }
  }

  summary.conversions = {
    deliveryRate: safeRate(summary.delivered, summary.submittedToProvider),
    replyRate: safeRate(summary.replies, summary.delivered),
    ratingRate: safeRate(summary.ratings, summary.replies),
    landingVisitRate: safeRate(summary.landingVisits, summary.ratings),
    copyRate: safeRate(summary.draftCopies, summary.landingVisits),
    googleClickRate: safeRate(summary.googleClicks, summary.landingVisits),
    failureRate: safeRate(summary.failures, summary.submittedToProvider),
  };

  return {
    ...summary,
    definitions: CONVERSION_DEFINITIONS,
    note: 'googleClicks is not proof of a published Google review',
  };
}
