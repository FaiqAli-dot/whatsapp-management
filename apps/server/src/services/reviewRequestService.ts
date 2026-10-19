import {
  canTransition,
  clarificationPrompt,
  DUPLICATE_REQUEST_WINDOW_MS,
  LANDING_TOKEN_TTL_MS,
  parseCustomerReply,
  shouldApplyStatusUpdate,
  type MessageStatus,
} from '@wrs/shared';
import { ReviewRequest } from '../models/ReviewRequest.js';
import { Customer } from '../models/Customer.js';
import { Message } from '../models/Message.js';
import { WhatsAppConnection } from '../models/WhatsAppConnection.js';
import { Business } from '../models/Business.js';
import { Feedback } from '../models/Feedback.js';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';
import { decryptSecret, generateUnguessableToken, hashToken } from '../lib/crypto.js';
import { getWhatsAppProvider } from '../whatsapp/index.js';
import { getEnv } from '../config/env.js';
import { assertWithinRequestLimit, incrementUsage } from './billingService.js';
import { recordAnalyticsEvent } from './analyticsService.js';
import { generateDraft } from './draftService.js';
import { enqueueJob } from './jobService.js';
import type { Job } from '../models/Job.js';
import { getEnv as envAgain } from '../config/env.js';

export async function previewReviewRequest(businessId: string, customerId: string) {
  const customer = await Customer.findOne({
    _id: customerId,
    businessId,
    deletedAt: null,
  });
  if (!customer) throw new NotFoundError('Customer not found');

  const issues: string[] = [];
  if (customer.consentStatus !== 'granted') issues.push('Customer has not granted consent');
  if (customer.optedOutAt) issues.push('Customer opted out');
  if (!customer.phoneE164) issues.push('Customer phone missing');

  const conn = await WhatsAppConnection.findOne({ businessId });
  if (!conn || conn.status !== 'connected') {
    issues.push('WhatsApp is disconnected — connect your WhatsApp Business account');
  }

  const biz = await Business.findById(businessId);
  if (!biz?.googleReviewUrl) issues.push('Google Review URL not configured');
  if (!biz?.onboardingComplete) issues.push('Onboarding incomplete');

  try {
    await assertWithinRequestLimit(businessId);
  } catch (e) {
    if (e instanceof AppError) issues.push(e.message);
  }

  const recent = await ReviewRequest.findOne({
    businessId,
    customerId,
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_REQUEST_WINDOW_MS) },
    status: { $nin: ['FAILED', 'CANCELLED'] },
  });
  if (recent)
    issues.push('A review request was already created for this customer in the last 7 days');

  const simulated = getEnv().WHATSAPP_MODE === 'simulator' || conn?.mode === 'simulator';

  return {
    customer: {
      id: String(customer._id),
      name: customer.name,
      phoneE164: customer.phoneE164,
      consentStatus: customer.consentStatus,
    },
    canSend: issues.length === 0,
    issues,
    simulated,
    templateName: conn?.templateName ?? 'review_request',
  };
}

export async function createReviewRequest(
  businessId: string,
  customerId: string,
  confirm: boolean,
) {
  if (!confirm) throw new ValidationError('Confirm is required');
  const preview = await previewReviewRequest(businessId, customerId);
  if (!preview.canSend) {
    throw new ValidationError('Cannot create review request', preview.issues);
  }

  const conn = await WhatsAppConnection.findOne({ businessId });
  const simulated = getEnv().WHATSAPP_MODE === 'simulator' || conn?.mode === 'simulator';
  const idempotencyKey = `rr:${businessId}:${customerId}:${Math.floor(Date.now() / 60000)}`;

  let request;
  try {
    request = await ReviewRequest.create({
      businessId,
      customerId,
      status: 'CREATED',
      simulated,
      idempotencyKey,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new ConflictError('Duplicate review request (idempotency)');
    }
    throw err;
  }

  await recordAnalyticsEvent({
    businessId,
    type: 'request_created',
    dedupeKey: `request_created:${request._id}`,
    reviewRequestId: String(request._id),
    customerId,
    simulated,
  });

  await transitionStatus(request, 'QUEUED');

  await enqueueJob({
    businessId,
    type: 'send_review_request',
    payload: { reviewRequestId: String(request._id) },
    idempotencyKey: `job:send:${request._id}`,
  });

  await incrementUsage(businessId);

  return request;
}

export async function transitionStatus(
  request: InstanceType<typeof ReviewRequest>,
  to: MessageStatus,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const from = request.status as MessageStatus;
  if (from === to) {
    Object.assign(request, extra);
    await request.save();
    return true;
  }
  if (!shouldApplyStatusUpdate(from, to)) {
    return false;
  }
  if (!canTransition(from, to) && !shouldApplyStatusUpdate(from, to)) {
    return false;
  }
  request.status = to;
  Object.assign(request, extra);
  await request.save();
  return true;
}

export async function processOutboundJob(job: InstanceType<typeof Job>): Promise<void> {
  if (job.type === 'send_review_request') {
    return processSendReviewRequestJob(job);
  }
  return processFollowUpTextJob(job);
}

async function processFollowUpTextJob(job: InstanceType<typeof Job>): Promise<void> {
  const reviewRequestId = String(job.payload.reviewRequestId);
  const text = String(job.payload.text ?? '');
  const request = await ReviewRequest.findById(reviewRequestId);
  if (!request) throw new Error('Review request missing');
  const businessId = String(request.businessId);
  const customer = await Customer.findOne({ _id: request.customerId, businessId, deletedAt: null });
  if (!customer || customer.optedOutAt) return;

  const conn = await WhatsAppConnection.findOne({ businessId });
  if (!conn || conn.status !== 'connected') throw new Error('WhatsApp disconnected');

  const provider = getWhatsAppProvider(conn.mode as 'simulator' | 'meta');
  if (envAgain().NODE_ENV === 'test' && provider.name === 'meta') {
    throw new Error('Live Meta sends forbidden in test');
  }
  const accessToken =
    conn.mode === 'simulator'
      ? 'simulator'
      : conn.accessTokenEncrypted
        ? decryptSecret(conn.accessTokenEncrypted)
        : '';

  const result = await provider.sendText({
    toE164: customer.phoneE164,
    body: text,
    accessToken,
    phoneNumberId: conn.phoneNumberId || 'simulator',
  });

  await Message.create({
    businessId,
    reviewRequestId: request._id,
    customerId: customer._id,
    direction: 'outbound',
    status: 'SENT',
    providerMessageId: result.providerMessageId,
    simulated: result.simulated,
    body: text.slice(0, 2000),
  });
}

export async function processSendReviewRequestJob(job: InstanceType<typeof Job>): Promise<void> {
  const reviewRequestId = String(job.payload.reviewRequestId);
  const request = await ReviewRequest.findById(reviewRequestId);
  if (!request) throw new Error('Review request missing');
  if (['SENT', 'DELIVERED', 'READ', 'CANCELLED'].includes(request.status)) {
    return; // idempotent — already sent
  }

  const businessId = String(request.businessId);
  const customer = await Customer.findOne({
    _id: request.customerId,
    businessId,
    deletedAt: null,
  });
  if (!customer) throw new Error('Customer missing');
  if (customer.optedOutAt) {
    await transitionStatus(request, 'CANCELLED', { failureReason: 'Customer opted out' });
    return;
  }

  const conn = await WhatsAppConnection.findOne({ businessId });
  if (!conn || conn.status !== 'connected') {
    await transitionStatus(request, 'FAILED', {
      failureReason: 'WhatsApp disconnected — reconnect in Settings',
    });
    await recordAnalyticsEvent({
      businessId,
      type: 'failure',
      dedupeKey: `failure:${request._id}:disconnected`,
      reviewRequestId: String(request._id),
      simulated: request.simulated,
    });
    throw new Error('WhatsApp disconnected');
  }

  await transitionStatus(request, 'SENDING');

  const provider = getWhatsAppProvider(conn.mode as 'simulator' | 'meta');
  const accessToken =
    conn.mode === 'simulator'
      ? 'simulator'
      : conn.accessTokenEncrypted
        ? decryptSecret(conn.accessTokenEncrypted)
        : '';

  if (conn.mode === 'meta' && !accessToken) {
    await transitionStatus(request, 'FAILED', { failureReason: 'Missing WhatsApp credentials' });
    throw new Error('Missing credentials');
  }

  if (envAgain().NODE_ENV === 'test' && provider.name === 'meta') {
    throw new Error('Live Meta sends forbidden in test');
  }

  try {
    const result = await provider.sendTemplate({
      toE164: customer.phoneE164,
      templateName: conn.templateName || 'review_request',
      templateLanguage: conn.templateLanguage || 'en_US',
      accessToken,
      phoneNumberId: conn.phoneNumberId || 'simulator',
    });

    await Message.create({
      businessId,
      reviewRequestId: request._id,
      customerId: customer._id,
      direction: 'outbound',
      status: 'SENT',
      templateName: conn.templateName,
      providerMessageId: result.providerMessageId,
      simulated: result.simulated,
      body: `[template:${conn.templateName}]`,
    });

    await transitionStatus(request, 'SENT', {
      providerMessageId: result.providerMessageId,
      sentAt: new Date(),
      simulated: result.simulated,
    });

    await recordAnalyticsEvent({
      businessId,
      type: 'submitted_to_provider',
      dedupeKey: `submitted:${request._id}`,
      reviewRequestId: String(request._id),
      customerId: String(customer._id),
      simulated: result.simulated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await transitionStatus(request, 'FAILED', { failureReason: message });
    await Message.create({
      businessId,
      reviewRequestId: request._id,
      customerId: customer._id,
      direction: 'outbound',
      status: 'FAILED',
      simulated: request.simulated,
      errorMessage: message.slice(0, 500),
    });
    await recordAnalyticsEvent({
      businessId,
      type: 'failure',
      dedupeKey: `failure:${request._id}:${message.slice(0, 40)}`,
      reviewRequestId: String(request._id),
      simulated: request.simulated,
    });
    throw err;
  }
}

export async function applyProviderStatusUpdate(input: {
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  simulated?: boolean;
  errorMessage?: string;
}): Promise<{ updated: boolean }> {
  const request = await ReviewRequest.findOne({ providerMessageId: input.providerMessageId });
  if (!request) return { updated: false };

  const map: Record<string, MessageStatus> = {
    sent: 'SENT',
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
  };
  const to = map[input.status]!;
  const extra: Record<string, unknown> = {};
  if (to === 'DELIVERED') extra.deliveredAt = new Date();
  if (to === 'READ') extra.readAt = new Date();
  if (to === 'FAILED') extra.failureReason = input.errorMessage ?? 'Provider failure';

  const applied = await transitionStatus(request, to, extra);
  if (!applied) return { updated: false };

  await Message.updateOne(
    { providerMessageId: input.providerMessageId },
    { $set: { status: to, errorMessage: input.errorMessage } },
  );

  const businessId = String(request.businessId);
  if (to === 'DELIVERED') {
    await recordAnalyticsEvent({
      businessId,
      type: 'delivered',
      dedupeKey: `delivered:${request._id}`,
      reviewRequestId: String(request._id),
      simulated: input.simulated ?? request.simulated,
    });
  }
  if (to === 'READ') {
    await recordAnalyticsEvent({
      businessId,
      type: 'read',
      dedupeKey: `read:${request._id}`,
      reviewRequestId: String(request._id),
      simulated: input.simulated ?? request.simulated,
    });
  }
  if (to === 'FAILED') {
    await recordAnalyticsEvent({
      businessId,
      type: 'failure',
      dedupeKey: `failure_status:${request._id}`,
      reviewRequestId: String(request._id),
      simulated: input.simulated ?? request.simulated,
    });
  }
  return { updated: true };
}

export async function handleInboundReply(input: {
  businessId?: string;
  fromE164: string;
  text: string;
  providerMessageId: string;
  simulated?: boolean;
}): Promise<{ handled: boolean; action?: string }> {
  // Resolve tenant via phone mapping on WhatsApp connection + customer phone
  let businessId = input.businessId;
  let customer = null as InstanceType<typeof Customer> | null;

  if (businessId) {
    customer = await Customer.findOne({
      businessId,
      phoneE164: input.fromE164,
      deletedAt: null,
    });
  } else {
    customer = await Customer.findOne({ phoneE164: input.fromE164, deletedAt: null }).sort({
      updatedAt: -1,
    });
    if (customer) businessId = String(customer.businessId);
  }

  if (!customer || !businessId) return { handled: false, action: 'unknown_customer' };

  // Associate to most recent active request for this customer
  const request = await ReviewRequest.findOne({
    businessId,
    customerId: customer._id,
    status: { $in: ['SENT', 'DELIVERED', 'READ', 'SENDING'] },
  }).sort({ createdAt: -1 });

  if (!request) return { handled: false, action: 'no_active_request' };

  await Message.create({
    businessId,
    reviewRequestId: request._id,
    customerId: customer._id,
    direction: 'inbound',
    status: 'DELIVERED',
    body: input.text.slice(0, 2000),
    providerMessageId: input.providerMessageId,
    simulated: input.simulated ?? false,
  });

  await recordAnalyticsEvent({
    businessId,
    type: 'reply',
    dedupeKey: `reply:${input.providerMessageId}`,
    reviewRequestId: String(request._id),
    customerId: String(customer._id),
    simulated: input.simulated ?? false,
  });

  request.repliedAt = new Date();
  await request.save();

  const parsed = parseCustomerReply(input.text);

  if (parsed.kind === 'opt_out') {
    customer.optedOutAt = new Date();
    customer.consentStatus = 'revoked';
    await customer.save();
    return { handled: true, action: 'opt_out' };
  }

  if (parsed.kind === 'ambiguous' || parsed.kind === 'unclear') {
    if (!request.clarificationSentAt) {
      request.clarificationSentAt = new Date();
      await request.save();
      await enqueueJob({
        businessId,
        type: 'send_clarification',
        payload: {
          reviewRequestId: String(request._id),
          text: clarificationPrompt(parsed.kind === 'ambiguous' ? 'ambiguous' : 'unclear'),
        },
        idempotencyKey: `clarify:${request._id}`,
      });
    }
    return { handled: true, action: 'clarification' };
  }

  if (parsed.kind === 'feedback_only') {
    request.feedbackText = parsed.feedback;
    await request.save();
    if (!request.clarificationSentAt) {
      request.clarificationSentAt = new Date();
      await request.save();
      await enqueueJob({
        businessId,
        type: 'send_clarification',
        payload: {
          reviewRequestId: String(request._id),
          text: clarificationPrompt('feedback_only'),
        },
        idempotencyKey: `clarify_fb:${request._id}`,
      });
    }
    return { handled: true, action: 'feedback_only' };
  }

  // rating
  request.rating = parsed.rating;
  if (parsed.feedback) request.feedbackText = parsed.feedback;
  await request.save();

  await Feedback.create({
    businessId,
    reviewRequestId: request._id,
    customerId: customer._id,
    kind: 'public_draft_source',
    rating: parsed.rating,
    text: parsed.feedback || `Rating ${parsed.rating}`,
    simulated: input.simulated ?? false,
  });

  await recordAnalyticsEvent({
    businessId,
    type: 'rating',
    dedupeKey: `rating:${request._id}`,
    reviewRequestId: String(request._id),
    customerId: String(customer._id),
    ratingValue: parsed.rating,
    simulated: input.simulated ?? false,
  });

  // Generate draft + landing token for ALL ratings (no gating)
  const biz = await Business.findById(businessId);
  const draft = await generateDraft({
    businessId,
    businessName: biz?.name || 'Business',
    rating: parsed.rating,
    feedback: request.feedbackText,
    category: biz?.category,
  });
  request.draftText = draft.text;
  request.draftSource = draft.source;

  const rawToken = generateUnguessableToken(32);
  request.landingTokenHash = hashToken(rawToken);
  request.landingTokenExpiresAt = new Date(Date.now() + LANDING_TOKEN_TTL_MS);
  await request.save();

  const appUrl = getEnv().APP_URL;
  const landingUrl = `${appUrl}/r/${rawToken}`;

  await enqueueJob({
    businessId,
    type: 'send_draft_link',
    payload: {
      reviewRequestId: String(request._id),
      text: `Thanks for your feedback! You can edit and copy a review draft here (you submit it yourself on Google): ${landingUrl}`,
    },
    idempotencyKey: `draft_link:${request._id}`,
  });

  return {
    handled: true,
    action: 'rating' /* token only for simulator tests via separate endpoint */,
  };
}

export async function getLandingByToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const request = await ReviewRequest.findOne({ landingTokenHash: tokenHash });
  if (!request) throw new NotFoundError('Link not found');
  if (request.landingRevokedAt) throw new ForbiddenError('Link revoked');
  if (request.landingTokenExpiresAt && request.landingTokenExpiresAt < new Date()) {
    throw new ForbiddenError('Link expired');
  }
  const biz = await Business.findById(request.businessId);
  if (!biz || biz.deletedAt) throw new NotFoundError('Business unavailable');

  await recordAnalyticsEvent({
    businessId: String(request.businessId),
    type: 'landing_visit',
    dedupeKey: `landing_visit:${request._id}`,
    reviewRequestId: String(request._id),
    simulated: request.simulated,
  });

  return {
    businessName: biz.name,
    draftText: request.draftText || '',
    googleReviewUrl: biz.googleReviewUrl,
    rating: request.rating,
    simulated: request.simulated,
    expiresAt: request.landingTokenExpiresAt,
    // Explicit: customer must submit themselves; we do not prefill Google
    notice:
      'Copy your draft, then open Google Reviews and paste it yourself. Opening Google does not publish a review.',
  };
}

export async function updateLandingDraft(rawToken: string, text: string) {
  const tokenHash = hashToken(rawToken);
  const request = await ReviewRequest.findOne({ landingTokenHash: tokenHash });
  if (!request) throw new NotFoundError('Link not found');
  if (request.landingRevokedAt) throw new ForbiddenError('Link revoked');
  if (request.landingTokenExpiresAt && request.landingTokenExpiresAt < new Date()) {
    throw new ForbiddenError('Link expired');
  }
  request.draftText = text.slice(0, 500);
  await request.save();
  return { draftText: request.draftText };
}

export async function trackLandingAction(rawToken: string, action: 'draft_copy' | 'google_click') {
  const tokenHash = hashToken(rawToken);
  const request = await ReviewRequest.findOne({ landingTokenHash: tokenHash });
  if (!request) throw new NotFoundError('Link not found');
  await recordAnalyticsEvent({
    businessId: String(request.businessId),
    type: action,
    dedupeKey: `${action}:${request._id}`,
    reviewRequestId: String(request._id),
    simulated: request.simulated,
  });
  return { ok: true };
}

export async function submitPrivateFeedback(rawToken: string, message: string) {
  const tokenHash = hashToken(rawToken);
  const request = await ReviewRequest.findOne({ landingTokenHash: tokenHash });
  if (!request) throw new NotFoundError('Link not found');
  await Feedback.create({
    businessId: request.businessId,
    reviewRequestId: request._id,
    customerId: request.customerId,
    kind: 'private',
    rating: request.rating,
    text: message.slice(0, 2000),
    simulated: request.simulated,
  });
  await recordAnalyticsEvent({
    businessId: String(request.businessId),
    type: 'private_feedback',
    dedupeKey: `private_feedback:${request._id}`,
    reviewRequestId: String(request._id),
    simulated: request.simulated,
  });
  return { ok: true };
}
