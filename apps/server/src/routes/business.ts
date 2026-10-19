import { Router } from 'express';
import { businessProfileSchema, normalizeE164 } from '@wrs/shared';
import { Business } from '../models/Business.js';
import { User } from '../models/User.js';
import { WhatsAppConnection } from '../models/WhatsAppConnection.js';
import { requireAuth, requireBusiness } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js';
import { validateGoogleReviewUrl } from '../services/googleUrlService.js';
import { audit } from '../services/auditService.js';
import { getEnv } from '../config/env.js';
import { z } from 'zod';

export const businessRouter = Router();

businessRouter.post(
  '/',
  requireAuth,
  validateBody(businessProfileSchema),
  async (req, res, next) => {
    try {
      if (req.businessId) throw new ConflictError('Business already exists for this account');
      const body = req.body;
      const phone = normalizeE164(body.phone, countryCallingCode(body.country));
      if (!phone.ok) throw new ValidationError(phone.error);

      let googleStatus: 'unknown' | 'valid' | 'invalid' | 'unreachable' = 'unknown';
      let googleValidatedAt: Date | null = null;
      if (body.googleReviewUrl) {
        const v = await validateGoogleReviewUrl(body.googleReviewUrl);
        googleStatus = v.status;
        if (v.ok) googleValidatedAt = new Date();
      }

      const biz = await Business.create({
        ownerUserId: req.user!.id,
        name: body.name,
        category: body.category,
        phone: body.phone,
        phoneE164: phone.e164,
        country: body.country,
        timezone: body.timezone,
        googleReviewUrl: body.googleReviewUrl ?? null,
        googlePlaceId: body.googlePlaceId ?? null,
        googleUrlValidationStatus: googleStatus,
        googleUrlValidatedAt: googleValidatedAt,
        description: body.description ?? '',
        onboardingComplete: false,
      });

      await User.updateOne({ _id: req.user!.id }, { $set: { businessId: biz._id } });

      // Default simulator connection for pilot
      await WhatsAppConnection.create({
        businessId: biz._id,
        mode: getEnv().WHATSAPP_MODE === 'meta' ? 'meta' : 'simulator',
        status: getEnv().WHATSAPP_MODE === 'simulator' ? 'connected' : 'disconnected',
        connectedAt: getEnv().WHATSAPP_MODE === 'simulator' ? new Date() : null,
        phoneNumberId: getEnv().WHATSAPP_MODE === 'simulator' ? `sim_${biz._id}` : null,
        displayPhoneNumber: phone.e164,
      });

      await audit({
        userId: req.user!.id,
        businessId: String(biz._id),
        action: 'business.create',
        resourceType: 'business',
        resourceId: String(biz._id),
        ip: req.ip,
      });

      res.status(201).json({ business: serializeBusiness(biz) });
    } catch (e) {
      next(e);
    }
  },
);

businessRouter.get('/me', requireAuth, requireBusiness, async (req, res, next) => {
  try {
    const biz = await Business.findOne({ _id: req.businessId, deletedAt: null });
    if (!biz) throw new NotFoundError('Business not found');
    const conn = await WhatsAppConnection.findOne({ businessId: biz._id }).lean();
    const setupHints = buildSetupHints(biz, conn);
    res.json({
      business: serializeBusiness(biz),
      whatsapp: conn
        ? {
            status: conn.status,
            mode: conn.mode,
            displayPhoneNumber: conn.displayPhoneNumber,
            lastError: conn.lastError,
            templateName: conn.templateName,
            simulated: conn.mode === 'simulator',
          }
        : null,
      setupHints,
    });
  } catch (e) {
    next(e);
  }
});

businessRouter.patch(
  '/me',
  requireAuth,
  requireBusiness,
  validateBody(businessProfileSchema.partial()),
  async (req, res, next) => {
    try {
      const biz = await Business.findOne({ _id: req.businessId, deletedAt: null });
      if (!biz) throw new NotFoundError();
      const body = req.body;
      if (body.phone) {
        const phone = normalizeE164(body.phone, countryCallingCode(body.country || biz.country));
        if (!phone.ok) throw new ValidationError(phone.error);
        biz.phone = body.phone;
        biz.phoneE164 = phone.e164;
      }
      if (body.name) biz.name = body.name;
      if (body.category) biz.category = body.category;
      if (body.country) biz.country = body.country;
      if (body.timezone) biz.timezone = body.timezone;
      if (body.description !== undefined) biz.description = body.description;
      if (body.googlePlaceId !== undefined) biz.googlePlaceId = body.googlePlaceId;
      if (body.googleReviewUrl !== undefined) {
        biz.googleReviewUrl = body.googleReviewUrl;
        const v = await validateGoogleReviewUrl(body.googleReviewUrl);
        biz.googleUrlValidationStatus = v.status;
        biz.googleUrlValidatedAt = v.ok ? new Date() : null;
      }
      await biz.save();
      res.json({ business: serializeBusiness(biz) });
    } catch (e) {
      next(e);
    }
  },
);

businessRouter.post(
  '/me/validate-google-url',
  requireAuth,
  requireBusiness,
  validateBody(z.object({ url: z.string().url() })),
  async (req, res, next) => {
    try {
      const result = await validateGoogleReviewUrl(req.body.url);
      const biz = await Business.findById(req.businessId);
      if (biz) {
        biz.googleReviewUrl = req.body.url;
        biz.googleUrlValidationStatus = result.status;
        biz.googleUrlValidatedAt = result.ok ? new Date() : null;
        await biz.save();
      }
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

businessRouter.post(
  '/me/complete-onboarding',
  requireAuth,
  requireBusiness,
  async (req, res, next) => {
    try {
      const biz = await Business.findOne({ _id: req.businessId, deletedAt: null });
      if (!biz) throw new NotFoundError();
      const conn = await WhatsAppConnection.findOne({ businessId: biz._id });
      const hints = buildSetupHints(biz, conn);
      if (hints.length) {
        throw new ValidationError('Onboarding incomplete', hints);
      }
      biz.onboardingComplete = true;
      await biz.save();
      res.json({ business: serializeBusiness(biz) });
    } catch (e) {
      next(e);
    }
  },
);

function serializeBusiness(biz: InstanceType<typeof Business>) {
  return {
    id: String(biz._id),
    name: biz.name,
    category: biz.category,
    phone: biz.phone,
    phoneE164: biz.phoneE164,
    country: biz.country,
    timezone: biz.timezone,
    googleReviewUrl: biz.googleReviewUrl,
    googlePlaceId: biz.googlePlaceId,
    googleUrlValidationStatus: biz.googleUrlValidationStatus,
    description: biz.description,
    onboardingComplete: biz.onboardingComplete,
    planId: biz.planId,
    subscriptionStatus: biz.subscriptionStatus,
    usageRequestsThisPeriod: biz.usageRequestsThisPeriod,
  };
}

function buildSetupHints(
  biz:
    | InstanceType<typeof Business>
    | { googleReviewUrl?: string | null; googleUrlValidationStatus?: string; name?: string },
  conn: { status?: string; mode?: string; lastError?: string | null } | null,
): string[] {
  const hints: string[] = [];
  if (!biz.googleReviewUrl) hints.push('Add a Google Review URL');
  if (biz.googleReviewUrl && biz.googleUrlValidationStatus === 'invalid') {
    hints.push('Google Review URL format is invalid');
  }
  if (biz.googleReviewUrl && biz.googleUrlValidationStatus === 'unreachable') {
    hints.push('Google Review URL could not be reached — re-validate or update the link');
  }
  if (!conn || conn.status === 'disconnected') {
    hints.push('Connect your WhatsApp Business account (manual pilot credentials or simulator)');
  }
  if (conn?.status === 'error' || conn?.status === 'token_expired') {
    hints.push(conn.lastError || 'WhatsApp connection error — reconnect and check token/template');
  }
  if (conn?.mode === 'meta' && getEnv().WHATSAPP_MODE !== 'meta') {
    hints.push('Server WHATSAPP_MODE is not meta — live sends disabled');
  }
  return hints;
}

function countryCallingCode(country: string): string | undefined {
  const map: Record<string, string> = {
    US: '1',
    CA: '1',
    GB: '44',
    AU: '61',
    IN: '91',
    MX: '52',
    DE: '49',
    FR: '33',
    ES: '34',
    BR: '55',
  };
  return map[country.toUpperCase()];
}
