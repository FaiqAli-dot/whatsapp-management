import { Router } from 'express';
import { planIdSchema, PLANS } from '@wrs/shared';
import { requireAuth, requireBusiness } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { getBillingMode, testBilling } from '../services/billingService.js';
import { Business } from '../models/Business.js';
import { z } from 'zod';

export const billingRouter = Router();
billingRouter.use(requireAuth, requireBusiness);

billingRouter.get('/plans', (_req, res) => {
  res.json({
    mode: getBillingMode(),
    plans: PLANS,
    notice:
      getBillingMode() === 'test'
        ? 'TEST MODE billing — plan changes are not payment proof'
        : 'Stripe live mode',
  });
});

billingRouter.get('/usage', async (req, res, next) => {
  try {
    const biz = await Business.findById(req.businessId).lean();
    const plan = PLANS[(biz?.planId as keyof typeof PLANS) || 'free'];
    res.json({
      planId: biz?.planId,
      subscriptionStatus: biz?.subscriptionStatus,
      usageRequestsThisPeriod: biz?.usageRequestsThisPeriod ?? 0,
      limit: plan.monthlyRequestLimit,
      customerLimit: plan.customerLimit,
      testMode: getBillingMode() === 'test',
    });
  } catch (e) {
    next(e);
  }
});

billingRouter.post(
  '/change-plan',
  validateBody(z.object({ planId: planIdSchema })),
  async (req, res, next) => {
    try {
      if (getBillingMode() !== 'test') {
        return res.status(501).json({
          error: {
            code: 'LIVE_BILLING_SETUP_REQUIRED',
            message: 'Configure Stripe credentials for live billing',
          },
        });
      }
      const result = await testBilling.changePlan(req.businessId!, req.body.planId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

billingRouter.post('/cancel', async (req, res, next) => {
  try {
    if (getBillingMode() !== 'test') {
      return res.status(501).json({
        error: { code: 'LIVE_BILLING_SETUP_REQUIRED', message: 'Configure Stripe first' },
      });
    }
    const result = await testBilling.cancel(req.businessId!);
    res.json(result);
  } catch (e) {
    next(e);
  }
});
