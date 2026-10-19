import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import type { Types } from 'mongoose';

export interface SessionUser {
  id: string;
  email: string;
  businessId: string | null;
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfSecret?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      businessId?: string;
    }
  }
}

export async function loadSessionUser(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.session?.userId) {
      return next();
    }
    const user = await User.findOne({ _id: req.session.userId, deletedAt: null }).lean();
    if (!user) {
      req.session.destroy(() => undefined);
      return next();
    }
    req.user = {
      id: String(user._id),
      email: user.email,
      businessId: user.businessId ? String(user.businessId) : null,
    };
    if (user.businessId) {
      req.businessId = String(user.businessId);
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError());
  next();
}

export function requireBusiness(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError());
  if (!req.businessId) return next(new ForbiddenError('Complete business onboarding first'));
  next();
}

/** Never trust client-supplied tenant IDs — always use session businessId. */
export function tenantScope(businessId: string | Types.ObjectId | undefined): {
  businessId: string;
} {
  if (!businessId) throw new ForbiddenError('No tenant context');
  return { businessId: String(businessId) };
}

export async function assertBusinessOwnedByUser(businessId: string, userId: string): Promise<void> {
  const biz = await Business.findOne({
    _id: businessId,
    ownerUserId: userId,
    deletedAt: null,
  }).lean();
  if (!biz) throw new ForbiddenError();
}
