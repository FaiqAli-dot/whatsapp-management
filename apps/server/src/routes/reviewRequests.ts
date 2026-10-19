import { Router } from 'express';
import { reviewRequestCreateSchema, paginationSchema } from '@wrs/shared';
import { ReviewRequest } from '../models/ReviewRequest.js';
import { Message } from '../models/Message.js';
import { requireAuth, requireBusiness, tenantScope } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import { createReviewRequest, previewReviewRequest } from '../services/reviewRequestService.js';
import { runWorkerOnce } from '../services/jobService.js';
import { z } from 'zod';

export const reviewRequestsRouter = Router();
reviewRequestsRouter.use(requireAuth, requireBusiness);

reviewRequestsRouter.post(
  '/preview',
  validateBody(z.object({ customerId: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const preview = await previewReviewRequest(req.businessId!, req.body.customerId);
      res.json(preview);
    } catch (e) {
      next(e);
    }
  },
);

reviewRequestsRouter.post('/', validateBody(reviewRequestCreateSchema), async (req, res, next) => {
  try {
    const request = await createReviewRequest(
      req.businessId!,
      req.body.customerId,
      req.body.confirm,
    );
    // Process durable job immediately in-process for snappy UX; worker also polls
    await runWorkerOnce(`api-${process.pid}`);
    const fresh = await ReviewRequest.findById(request._id);
    res.status(201).json({ request: serialize(fresh!) });
  } catch (e) {
    next(e);
  }
});

reviewRequestsRouter.get('/', async (req, res, next) => {
  try {
    const q = paginationSchema.parse(req.query);
    const filter = { ...tenantScope(req.businessId) };
    const total = await ReviewRequest.countDocuments(filter);
    const items = await ReviewRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean();
    res.json({ items: items.map(serialize), page: q.page, limit: q.limit, total });
  } catch (e) {
    next(e);
  }
});

reviewRequestsRouter.get('/:id', async (req, res, next) => {
  try {
    const request = await ReviewRequest.findOne({
      _id: req.params.id,
      ...tenantScope(req.businessId),
    });
    if (!request) throw new NotFoundError('Review request not found');
    const messages = await Message.find({
      reviewRequestId: request._id,
      ...tenantScope(req.businessId),
    })
      .sort({ createdAt: 1 })
      .lean();
    res.json({
      request: serialize(request),
      messages: messages.map((m) => ({
        id: String(m._id),
        direction: m.direction,
        status: m.status,
        body: m.body,
        simulated: m.simulated,
        providerMessageId: m.providerMessageId,
        createdAt: m.createdAt,
        errorMessage: m.errorMessage,
      })),
    });
  } catch (e) {
    next(e);
  }
});

function serialize(r: {
  _id: unknown;
  customerId: unknown;
  status: string;
  simulated?: boolean;
  providerMessageId?: string | null;
  failureReason?: string | null;
  rating?: number | null;
  feedbackText?: string | null;
  draftText?: string | null;
  draftSource?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  repliedAt?: Date | null;
  createdAt?: Date;
}) {
  return {
    id: String(r._id),
    customerId: String(r.customerId),
    status: r.status,
    simulated: Boolean(r.simulated),
    providerMessageId: r.providerMessageId,
    failureReason: r.failureReason,
    rating: r.rating,
    feedbackText: r.feedbackText,
    draftText: r.draftText,
    draftSource: r.draftSource,
    sentAt: r.sentAt,
    deliveredAt: r.deliveredAt,
    readAt: r.readAt,
    repliedAt: r.repliedAt,
    createdAt: r.createdAt,
  };
}
