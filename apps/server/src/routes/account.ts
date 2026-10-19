import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { deleteAccount } from '../services/accountDeletionService.js';
import { validateBody } from '../middleware/validate.js';
import { z } from 'zod';

export const accountRouter = Router();

accountRouter.delete(
  '/',
  requireAuth,
  validateBody(z.object({ confirm: z.literal('DELETE') })),
  async (req, res, next) => {
    try {
      await deleteAccount(req.user!.id, req.businessId ?? null);
      req.session.destroy(() => undefined);
      res.clearCookie('wrs.sid');
      res.json({
        ok: true,
        policy:
          'Account deleted: credentials removed, tenant customers/messages/feedback/analytics/jobs purged, user anonymized per retention policy.',
      });
    } catch (e) {
      next(e);
    }
  },
);
