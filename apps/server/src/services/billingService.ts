import { PLANS, type PlanId } from '@wrs/shared';
import { Business } from '../models/Business.js';
import { AppError } from '../lib/errors.js';
import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Test-mode billing adapter — clearly not live payment proof.
 * Redirect != payment proof.
 */
export class TestBillingAdapter {
  readonly mode = 'test' as const;

  async changePlan(businessId: string, planId: PlanId): Promise<{ ok: true; testMode: true }> {
    await Business.updateOne(
      { _id: businessId },
      { $set: { planId, subscriptionStatus: 'active' } },
    );
    logger.info({ msg: 'billing_test_plan_change', businessId, planId, testMode: true });
    return { ok: true, testMode: true };
  }

  async cancel(businessId: string): Promise<{ ok: true; testMode: true }> {
    await Business.updateOne(
      { _id: businessId },
      { $set: { subscriptionStatus: 'cancelled', planId: 'free' } },
    );
    return { ok: true, testMode: true };
  }

  /** Simulated webhook — must verify in live Stripe adapter. */
  async handleWebhook(payload: {
    eventId: string;
    type: string;
    businessId: string;
  }): Promise<{ processed: boolean; testMode: true }> {
    logger.info({ msg: 'billing_test_webhook', ...payload, testMode: true });
    return { processed: true, testMode: true };
  }
}

export const testBilling = new TestBillingAdapter();

export async function assertWithinRequestLimit(businessId: string): Promise<void> {
  const biz = await Business.findById(businessId);
  if (!biz) throw new AppError(404, 'Business not found');
  if (biz.subscriptionStatus === 'cancelled') {
    // grace: allow reading but not new sends after cancel unless free plan residual
  }
  const plan = PLANS[biz.planId as PlanId] ?? PLANS.free;
  const periodStart = biz.usagePeriodStart ?? new Date();
  const now = new Date();
  // Reset monthly window
  if (now.getTime() - periodStart.getTime() > 30 * 24 * 60 * 60 * 1000) {
    biz.usagePeriodStart = now;
    biz.usageRequestsThisPeriod = 0;
    await biz.save();
  }
  if ((biz.usageRequestsThisPeriod ?? 0) >= plan.monthlyRequestLimit) {
    if (biz.subscriptionStatus === 'grace') {
      // still block after grace exhaustion
    }
    throw new AppError(
      402,
      `Monthly request limit (${plan.monthlyRequestLimit}) reached for plan ${plan.name}`,
      'USAGE_LIMIT',
    );
  }
}

export async function incrementUsage(businessId: string): Promise<void> {
  await Business.updateOne({ _id: businessId }, { $inc: { usageRequestsThisPeriod: 1 } });
}

export function getBillingMode(): 'test' | 'stripe' {
  return getEnv().BILLING_MODE;
}
