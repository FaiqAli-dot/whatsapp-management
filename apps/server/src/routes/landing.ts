import { Router } from 'express';
import { draftUpdateSchema, privateFeedbackSchema } from '@wrs/shared';
import { validateBody } from '../middleware/validate.js';
import {
  getLandingByToken,
  submitPrivateFeedback,
  trackLandingAction,
  updateLandingDraft,
} from '../services/reviewRequestService.js';
import { z } from 'zod';

export const landingRouter = Router();

function tokenOf(req: { params: Record<string, string | string[] | undefined> }): string {
  const t = req.params.token;
  return Array.isArray(t) ? t[0]! : String(t || '');
}

landingRouter.get('/:token', async (req, res, next) => {
  try {
    const data = await getLandingByToken(tokenOf(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

landingRouter.patch('/:token/draft', validateBody(draftUpdateSchema), async (req, res, next) => {
  try {
    const data = await updateLandingDraft(tokenOf(req), req.body.text);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

landingRouter.post(
  '/:token/track',
  validateBody(z.object({ action: z.enum(['draft_copy', 'google_click']) })),
  async (req, res, next) => {
    try {
      const data = await trackLandingAction(tokenOf(req), req.body.action);
      res.json(data);
    } catch (e) {
      next(e);
    }
  },
);

landingRouter.post(
  '/:token/private-feedback',
  validateBody(privateFeedbackSchema),
  async (req, res, next) => {
    try {
      const data = await submitPrivateFeedback(tokenOf(req), req.body.message);
      res.json(data);
    } catch (e) {
      next(e);
    }
  },
);
