import { z } from 'zod';
import { BUSINESS_CATEGORIES, PLANS } from './constants.js';

export const emailSchema = z
  .string()
  .email()
  .max(254)
  .transform((s) => s.toLowerCase().trim());

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(120),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const googleReviewUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine(
    (u) => {
      try {
        const parsed = new URL(u);
        const host = parsed.hostname.toLowerCase();
        return (
          host === 'g.page' ||
          host.endsWith('.google.com') ||
          host === 'maps.app.goo.gl' ||
          host === 'goo.gl' ||
          host === 'search.google.com'
        );
      } catch {
        return false;
      }
    },
    { message: 'Must be a Google Maps / review URL' },
  );

export const businessProfileSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(BUSINESS_CATEGORIES),
  phone: z.string().trim().min(5).max(30),
  country: z.string().trim().length(2).toUpperCase(),
  timezone: z.string().trim().min(1).max(64),
  googleReviewUrl: googleReviewUrlSchema.optional(),
  googlePlaceId: z.string().trim().min(5).max(256).optional(),
  description: z.string().trim().max(1000).optional(),
});

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(30),
  email: emailSchema.optional(),
  consentGiven: z.boolean(),
  consentSource: z.enum(['manual', 'import', 'webform', 'verbal']).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const reviewRequestCreateSchema = z.object({
  customerId: z.string().min(1),
  confirm: z.literal(true),
});

export const privateFeedbackSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const draftUpdateSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  consent: z.enum(['granted', 'revoked', 'unknown']).optional(),
});

export const analyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  timezone: z.string().max(64).optional(),
});

export const whatsappManualConnectSchema = z.object({
  phoneNumberId: z.string().trim().min(5).max(64),
  wabaId: z.string().trim().min(5).max(64),
  accessToken: z.string().trim().min(10).max(2048),
  displayPhoneNumber: z.string().trim().min(5).max(30).optional(),
  templateName: z.string().trim().min(1).max(100).default('review_request'),
  templateLanguage: z.string().trim().min(2).max(15).default('en_US'),
});

export const planIdSchema = z.enum(
  Object.keys(PLANS) as [keyof typeof PLANS, ...Array<keyof typeof PLANS>],
);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
