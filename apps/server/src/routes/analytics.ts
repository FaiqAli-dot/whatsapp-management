import { Router } from 'express';
import { analyticsQuerySchema } from '@wrs/shared';
import { requireAuth, requireBusiness } from '../middleware/auth.js';
import { getAnalyticsSummary } from '../services/analyticsService.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireBusiness);

analyticsRouter.get('/', async (req, res, next) => {
  try {
    const q = analyticsQuerySchema.parse(req.query);
    const summary = await getAnalyticsSummary(req.businessId!, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
    res.json({
      ...summary,
      timezone: q.timezone || 'UTC',
      empty: summary.requestsCreated === 0,
    });
  } catch (e) {
    next(e);
  }
});
