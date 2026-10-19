import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema } from '@wrs/shared';
import { User } from '../models/User.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth, loadSessionUser } from '../middleware/auth.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../lib/errors.js';
import { generateUnguessableToken, hashToken } from '../lib/crypto.js';
import { sendEmail } from '../services/emailService.js';
import { audit } from '../services/auditService.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { getEnv } from '../config/env.js';
import { z } from 'zod';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts' } },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many reset attempts' } },
});

authRouter.get('/csrf', (req, res) => {
  if (!req.session.csrfSecret) req.session.csrfSecret = '1';
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
});

authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body as {
      email: string;
      password: string;
      name: string;
    };
    const existing = await User.findOne({ email });
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = generateUnguessableToken(24);
    const user = await User.create({
      email,
      passwordHash,
      name,
      emailVerifyTokenHash: hashToken(verifyToken),
      emailVerifyExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const verifyUrl = `${getEnv().CLIENT_URL}/verify-email?token=${verifyToken}`;
    await sendEmail({
      to: email,
      subject: 'Verify your email',
      text: `Verify your email: ${verifyUrl}`,
    });

    req.session.userId = String(user._id);
    await audit({
      userId: String(user._id),
      action: 'auth.register',
      resourceType: 'user',
      resourceId: String(user._id),
      ip: req.ip,
    });

    res.status(201).json({
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        emailVerified: false,
        businessId: null,
      },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await User.findOne({ email, deletedAt: null });
    if (!user) throw new UnauthorizedError('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Invalid credentials');

    req.session.userId = String(user._id);
    await audit({
      userId: String(user._id),
      businessId: user.businessId ? String(user.businessId) : null,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: String(user._id),
      ip: req.ip,
    });

    res.json({
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        emailVerified: Boolean(user.emailVerifiedAt),
        businessId: user.businessId ? String(user.businessId) : null,
      },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('wrs.sid');
      res.json({ ok: true });
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.id).lean();
    if (!user || user.deletedAt) throw new UnauthorizedError();
    res.json({
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        emailVerified: Boolean(user.emailVerifiedAt),
        businessId: user.businessId ? String(user.businessId) : null,
      },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post(
  '/verify-email',
  validateBody(z.object({ token: z.string().min(10) })),
  async (req, res, next) => {
    try {
      const tokenHash = hashToken(req.body.token);
      const user = await User.findOne({
        emailVerifyTokenHash: tokenHash,
        emailVerifyExpiresAt: { $gt: new Date() },
      });
      if (!user) throw new ValidationError('Invalid or expired verification token');
      user.emailVerifiedAt = new Date();
      user.emailVerifyTokenHash = null;
      user.emailVerifyExpiresAt = null;
      await user.save();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.post(
  '/forgot-password',
  resetLimiter,
  validateBody(z.object({ email: z.string().email() })),
  async (req, res, next) => {
    try {
      const email = String(req.body.email).toLowerCase();
      const user = await User.findOne({ email, deletedAt: null });
      // Always return ok to avoid account enumeration
      if (user) {
        const token = generateUnguessableToken(24);
        user.resetTokenHash = hashToken(token);
        user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        await sendEmail({
          to: email,
          subject: 'Password reset',
          text: `Reset your password: ${getEnv().CLIENT_URL}/reset-password?token=${token}`,
        });
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.post(
  '/reset-password',
  resetLimiter,
  validateBody(
    z.object({
      token: z.string().min(10),
      password: z.string().min(10).max(128),
    }),
  ),
  async (req, res, next) => {
    try {
      const tokenHash = hashToken(req.body.token);
      const user = await User.findOne({
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { $gt: new Date() },
        deletedAt: null,
      });
      if (!user) throw new ValidationError('Invalid or expired reset token');
      user.passwordHash = await bcrypt.hash(req.body.password, 12);
      user.resetTokenHash = null;
      user.resetTokenExpiresAt = null;
      await user.save();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// re-export for type side effects
void loadSessionUser;
