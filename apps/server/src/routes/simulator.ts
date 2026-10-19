import { Router } from 'express';
import { requireAuth, requireBusiness } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { processWhatsAppWebhook } from '../services/webhookService.js';
import { ReviewRequest } from '../models/ReviewRequest.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import { runWorkerOnce } from '../services/jobService.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getEnv } from '../config/env.js';

/**
 * Simulator control plane — fully separated from production Meta path.
 * Every event is marked simulated: true.
 * Disabled when WHATSAPP_MODE=meta in production.
 */
export const simulatorRouter = Router();

simulatorRouter.use((req, res, next) => {
  const env = getEnv();
  if (env.NODE_ENV === 'production' && env.WHATSAPP_MODE === 'meta') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  next();
});

simulatorRouter.use(requireAuth, requireBusiness);

simulatorRouter.post('/process-jobs', async (req, res, next) => {
  try {
    const n = await runWorkerOnce(`sim-${req.user!.id}`);
    res.json({ processed: n, simulated: true });
  } catch (e) {
    next(e);
  }
});

simulatorRouter.post(
  '/deliver',
  validateBody(
    z.object({
      reviewRequestId: z.string(),
      status: z.enum(['delivered', 'read', 'failed']),
      errorMessage: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const request = await ReviewRequest.findOne({
        _id: req.body.reviewRequestId,
        businessId: req.businessId,
      });
      if (!request) throw new NotFoundError();
      if (!request.simulated && getEnv().NODE_ENV === 'production') {
        throw new ForbiddenError('Cannot simulate events for live requests');
      }
      if (!request.providerMessageId) {
        throw new ForbiddenError('Request has no provider message ID yet — process jobs first');
      }
      const result = await processWhatsAppWebhook({
        provider: 'simulator',
        eventId: `sim_status_${request.providerMessageId}_${req.body.status}_${randomUUID()}`,
        payload: {
          simulator: {
            kind: 'status',
            providerMessageId: request.providerMessageId,
            status: req.body.status,
          },
        },
        simulated: true,
      });
      res.json({ ...result, simulated: true });
    } catch (e) {
      next(e);
    }
  },
);

simulatorRouter.post(
  '/inbound',
  validateBody(
    z.object({
      reviewRequestId: z.string(),
      text: z.string().min(1).max(2000),
    }),
  ),
  async (req, res, next) => {
    try {
      const request = await ReviewRequest.findOne({
        _id: req.body.reviewRequestId,
        businessId: req.businessId,
      }).populate('customerId');
      if (!request) throw new NotFoundError();

      const { Customer } = await import('../models/Customer.js');
      const customer = await Customer.findOne({
        _id: request.customerId,
        businessId: req.businessId,
      });
      if (!customer) throw new NotFoundError('Customer not found');

      const result = await processWhatsAppWebhook({
        provider: 'simulator',
        eventId: `sim_in_${randomUUID()}`,
        payload: {
          simulator: {
            kind: 'inbound',
            businessId: req.businessId,
            fromE164: customer.phoneE164,
            text: req.body.text,
            providerMessageId: `sim_in_${randomUUID()}`,
          },
        },
        simulated: true,
      });

      // Process clarification / draft link jobs
      await runWorkerOnce(`sim-follow-${req.user!.id}`);

      const fresh = await ReviewRequest.findById(request._id).lean();
      res.json({
        ...result,
        simulated: true,
        request: {
          id: String(fresh?._id),
          status: fresh?.status,
          rating: fresh?.rating,
          feedbackText: fresh?.feedbackText,
          draftText: fresh?.draftText,
          hasLandingToken: Boolean(fresh?.landingTokenHash),
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

/** Test helper: reveal landing token once for simulator demos (hashed in DB). */
simulatorRouter.post(
  '/reveal-landing-token',
  validateBody(z.object({ reviewRequestId: z.string() })),
  async (req, res, next) => {
    try {
      if (getEnv().NODE_ENV === 'production' && getEnv().WHATSAPP_MODE === 'meta') {
        throw new ForbiddenError();
      }
      const request = await ReviewRequest.findOne({
        _id: req.body.reviewRequestId,
        businessId: req.businessId,
      });
      if (!request) throw new NotFoundError();
      if (!request.landingTokenHash) {
        return res.status(400).json({
          error: { code: 'NO_TOKEN', message: 'No landing token yet — send a rating reply first' },
        });
      }
      // Tokens are stored hashed; for simulator we regenerate a fresh token for demo
      const { generateUnguessableToken, hashToken } = await import('../lib/crypto.js');
      const raw = generateUnguessableToken(32);
      request.landingTokenHash = hashToken(raw);
      request.landingTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await request.save();
      res.json({
        token: raw,
        url: `${getEnv().APP_URL}/r/${raw}`,
        simulated: true,
        notice: 'Simulator-only token reveal',
      });
    } catch (e) {
      next(e);
    }
  },
);
