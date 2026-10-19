import { Router } from 'express';
import { whatsappManualConnectSchema } from '@wrs/shared';
import { WhatsAppConnection } from '../models/WhatsAppConnection.js';
import { requireAuth, requireBusiness } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { encryptSecret, decryptSecret } from '../lib/crypto.js';
import { getEnv } from '../config/env.js';
import { getWhatsAppProvider } from '../whatsapp/index.js';
import { audit } from '../services/auditService.js';
import { NotFoundError } from '../lib/errors.js';

export const whatsappRouter = Router();
whatsappRouter.use(requireAuth, requireBusiness);

whatsappRouter.get('/status', async (req, res, next) => {
  try {
    const conn = await WhatsAppConnection.findOne({ businessId: req.businessId });
    if (!conn) throw new NotFoundError('No WhatsApp connection');
    res.json({
      status: conn.status,
      mode: conn.mode,
      displayPhoneNumber: conn.displayPhoneNumber,
      phoneNumberId: conn.phoneNumberId,
      wabaId: conn.wabaId,
      templateName: conn.templateName,
      templateLanguage: conn.templateLanguage,
      lastError: conn.lastError,
      lastHealthCheckAt: conn.lastHealthCheckAt,
      simulated: conn.mode === 'simulator',
      embeddedSignup: {
        available: Boolean(getEnv().META_EMBEDDED_SIGNUP_CONFIG_ID),
        configId: getEnv().META_EMBEDDED_SIGNUP_CONFIG_ID || null,
        note: getEnv().META_EMBEDDED_SIGNUP_CONFIG_ID
          ? 'Embedded Signup config present — complete Meta App Review before production use'
          : 'Embedded Signup not configured. Use manual pilot onboarding (phoneNumberId, wabaId, accessToken).',
      },
    });
  } catch (e) {
    next(e);
  }
});

/** Manual pilot onboarding — merchant-owned Meta credentials. */
whatsappRouter.post(
  '/connect/manual',
  validateBody(whatsappManualConnectSchema),
  async (req, res, next) => {
    try {
      const env = getEnv();
      const mode = env.WHATSAPP_MODE === 'meta' ? 'meta' : 'simulator';
      // In simulator mode, accept manual fields but keep simulated
      const update: Record<string, unknown> = {
        mode,
        status: 'connected',
        phoneNumberId: req.body.phoneNumberId,
        wabaId: req.body.wabaId,
        displayPhoneNumber: req.body.displayPhoneNumber ?? null,
        accessTokenEncrypted: mode === 'meta' ? encryptSecret(req.body.accessToken) : null,
        templateName: req.body.templateName,
        templateLanguage: req.body.templateLanguage,
        connectedAt: new Date(),
        disconnectedAt: null,
        lastError: null,
      };

      if (mode === 'meta') {
        const provider = getWhatsAppProvider('meta');
        const health = await provider.healthCheck({
          accessToken: req.body.accessToken,
          phoneNumberId: req.body.phoneNumberId,
        });
        if (!health.ok) {
          update.status = 'error';
          update.lastError = health.message;
        }
        update.lastHealthCheckAt = new Date();
      }

      const conn = await WhatsAppConnection.findOneAndUpdate(
        { businessId: req.businessId },
        { $set: update },
        { upsert: true, new: true },
      );

      await audit({
        userId: req.user!.id,
        businessId: req.businessId!,
        action: 'whatsapp.connect_manual',
        resourceType: 'whatsapp_connection',
        resourceId: String(conn!._id),
        meta: { mode, status: conn!.status },
      });

      res.json({
        status: conn!.status,
        mode: conn!.mode,
        simulated: conn!.mode === 'simulator',
        lastError: conn!.lastError,
      });
    } catch (e) {
      next(e);
    }
  },
);

whatsappRouter.post('/connect/simulator', async (req, res, next) => {
  try {
    const conn = await WhatsAppConnection.findOneAndUpdate(
      { businessId: req.businessId },
      {
        $set: {
          mode: 'simulator',
          status: 'connected',
          phoneNumberId: `sim_${req.businessId}`,
          accessTokenEncrypted: null,
          connectedAt: new Date(),
          disconnectedAt: null,
          lastError: null,
        },
      },
      { upsert: true, new: true },
    );
    res.json({ status: conn!.status, mode: 'simulator', simulated: true });
  } catch (e) {
    next(e);
  }
});

whatsappRouter.post('/disconnect', async (req, res, next) => {
  try {
    const conn = await WhatsAppConnection.findOneAndUpdate(
      { businessId: req.businessId },
      {
        $set: {
          status: 'disconnected',
          accessTokenEncrypted: null,
          disconnectedAt: new Date(),
        },
      },
      { new: true },
    );
    await audit({
      userId: req.user!.id,
      businessId: req.businessId!,
      action: 'whatsapp.disconnect',
      resourceType: 'whatsapp_connection',
      resourceId: conn ? String(conn._id) : null,
    });
    res.json({ status: 'disconnected' });
  } catch (e) {
    next(e);
  }
});

whatsappRouter.post('/health', async (req, res, next) => {
  try {
    const conn = await WhatsAppConnection.findOne({ businessId: req.businessId });
    if (!conn) throw new NotFoundError();
    const provider = getWhatsAppProvider(conn.mode as 'simulator' | 'meta');
    const token =
      conn.mode === 'meta' && conn.accessTokenEncrypted
        ? decryptSecret(conn.accessTokenEncrypted)
        : 'simulator';
    const health = await provider.healthCheck({
      accessToken: token,
      phoneNumberId: conn.phoneNumberId || 'simulator',
    });
    conn.lastHealthCheckAt = new Date();
    if (!health.ok) {
      conn.status = 'error';
      conn.lastError = health.message;
    } else if (conn.status === 'error') {
      conn.status = 'connected';
      conn.lastError = null;
    }
    await conn.save();
    res.json({ ...health, status: conn.status });
  } catch (e) {
    next(e);
  }
});
