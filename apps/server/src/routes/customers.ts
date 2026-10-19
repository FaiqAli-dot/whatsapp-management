import { Router } from 'express';
import multer from 'multer';
import {
  customerCreateSchema,
  customerUpdateSchema,
  normalizeE164,
  paginationSchema,
  MAX_CSV_BYTES,
} from '@wrs/shared';
import { Customer } from '../models/Customer.js';
import { Business } from '../models/Business.js';
import { requireAuth, requireBusiness, tenantScope } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js';
import { mapAndValidateRows, parseCsv, rejectedRowsToCsv } from '../services/csvService.js';
import { audit } from '../services/auditService.js';
import { PLANS, type PlanId } from '@wrs/shared';
import { z } from 'zod';

export const customersRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_BYTES },
});

customersRouter.use(requireAuth, requireBusiness);

customersRouter.get('/', async (req, res, next) => {
  try {
    const q = paginationSchema.parse(req.query);
    const filter: Record<string, unknown> = {
      ...tenantScope(req.businessId),
      deletedAt: null,
    };
    if (q.consent) filter.consentStatus = q.consent;
    if (q.q) {
      filter.$or = [
        { name: { $regex: escapeRegex(q.q), $options: 'i' } },
        { phoneE164: { $regex: escapeRegex(q.q), $options: 'i' } },
      ];
    }
    const total = await Customer.countDocuments(filter);
    const items = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean();
    res.json({
      items: items.map(serialize),
      page: q.page,
      limit: q.limit,
      total,
    });
  } catch (e) {
    next(e);
  }
});

customersRouter.post('/', validateBody(customerCreateSchema), async (req, res, next) => {
  try {
    const businessId = req.businessId!;
    await assertCustomerLimit(businessId);
    const biz = await Business.findById(businessId);
    const phone = normalizeE164(req.body.phone, callingCode(biz?.country));
    if (!phone.ok) throw new ValidationError(phone.error);

    if (!req.body.consentGiven) {
      throw new ValidationError('Consent is required to create a customer for messaging');
    }

    try {
      const customer = await Customer.create({
        businessId,
        name: req.body.name,
        phone: req.body.phone,
        phoneE164: phone.e164,
        email: req.body.email ?? null,
        consentStatus: 'granted',
        consentSource: req.body.consentSource ?? 'manual',
        consentAt: new Date(),
        notes: req.body.notes ?? '',
      });
      await audit({
        userId: req.user!.id,
        businessId,
        action: 'customer.create',
        resourceType: 'customer',
        resourceId: String(customer._id),
      });
      res.status(201).json({ customer: serialize(customer) });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: number }).code === 11000
      ) {
        throw new ConflictError('Customer with this phone already exists');
      }
      throw err;
    }
  } catch (e) {
    next(e);
  }
});

customersRouter.get('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      ...tenantScope(req.businessId),
      deletedAt: null,
    });
    if (!customer) throw new NotFoundError('Customer not found');
    res.json({ customer: serialize(customer) });
  } catch (e) {
    next(e);
  }
});

customersRouter.patch('/:id', validateBody(customerUpdateSchema), async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      ...tenantScope(req.businessId),
      deletedAt: null,
    });
    if (!customer) throw new NotFoundError('Customer not found');
    const body = req.body;
    if (body.name) customer.name = body.name;
    if (body.notes !== undefined) customer.notes = body.notes;
    if (body.email !== undefined) customer.email = body.email;
    if (body.phone) {
      const biz = await Business.findById(req.businessId);
      const phone = normalizeE164(body.phone, callingCode(biz?.country));
      if (!phone.ok) throw new ValidationError(phone.error);
      customer.phone = body.phone;
      customer.phoneE164 = phone.e164;
    }
    if (body.consentGiven === true) {
      customer.consentStatus = 'granted';
      customer.consentAt = new Date();
      customer.consentSource = body.consentSource ?? customer.consentSource ?? 'manual';
      customer.optedOutAt = null;
    }
    if (body.consentGiven === false) {
      customer.consentStatus = 'revoked';
      customer.optedOutAt = new Date();
    }
    await customer.save();
    res.json({ customer: serialize(customer) });
  } catch (e) {
    next(e);
  }
});

customersRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await Customer.updateOne(
      { _id: req.params.id, ...tenantScope(req.businessId), deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    if (result.matchedCount === 0) throw new NotFoundError('Customer not found');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

customersRouter.post('/import/preview', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError('CSV file required');
    const content = req.file.buffer.toString('utf8');
    const parsed = parseCsv(content);
    res.json({
      headers: parsed.headers,
      previewRows: parsed.rows.slice(0, 5),
      rowCount: parsed.rows.length,
      // No auto-send after import
      notice: 'Import never auto-sends review requests',
    });
  } catch (e) {
    next(e);
  }
});

customersRouter.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError('CSV file required');
    const mapping = z
      .object({
        name: z.string(),
        phone: z.string(),
        email: z.string().optional(),
        consent: z.string().optional(),
      })
      .parse(JSON.parse(String(req.body.mapping || '{}')));

    const content = req.file.buffer.toString('utf8');
    const parsed = parseCsv(content);
    const biz = await Business.findById(req.businessId);
    const { accepted, rejected } = mapAndValidateRows(
      parsed.rows,
      mapping,
      callingCode(biz?.country),
    );

    let imported = 0;
    let skippedExisting = 0;
    for (const row of accepted) {
      await assertCustomerLimit(req.businessId!);
      try {
        await Customer.create({
          businessId: req.businessId,
          name: row.name,
          phone: row.phoneE164,
          phoneE164: row.phoneE164,
          email: row.email ?? null,
          consentStatus: row.consentGiven ? 'granted' : 'unknown',
          consentSource: 'import',
          consentAt: row.consentGiven ? new Date() : null,
        });
        imported++;
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: number }).code === 11000
        ) {
          skippedExisting++;
        } else {
          throw err;
        }
      }
    }

    res.json({
      imported,
      skippedExisting,
      rejectedCount: rejected.length,
      rejectedCsv: rejectedRowsToCsv(rejected),
      notice: 'Import complete. No review requests were sent automatically.',
    });
  } catch (e) {
    next(e);
  }
});

function serialize(c: {
  _id: unknown;
  name: string;
  phone: string;
  phoneE164: string;
  email?: string | null;
  consentStatus: string;
  consentSource?: string | null;
  consentAt?: Date | null;
  optedOutAt?: Date | null;
  notes?: string;
}) {
  return {
    id: String(c._id),
    name: c.name,
    phone: c.phone,
    phoneE164: c.phoneE164,
    email: c.email,
    consentStatus: c.consentStatus,
    consentSource: c.consentSource,
    consentAt: c.consentAt,
    optedOutAt: c.optedOutAt,
    notes: c.notes,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function callingCode(country?: string | null): string | undefined {
  if (!country) return undefined;
  const map: Record<string, string> = { US: '1', CA: '1', GB: '44', AU: '61', IN: '91' };
  return map[country.toUpperCase()];
}

async function assertCustomerLimit(businessId: string) {
  const biz = await Business.findById(businessId);
  const plan = PLANS[(biz?.planId as PlanId) || 'free'];
  const count = await Customer.countDocuments({ businessId, deletedAt: null });
  if (count >= plan.customerLimit) {
    throw new ValidationError(
      `Customer limit (${plan.customerLimit}) reached for plan ${plan.name}`,
    );
  }
}
