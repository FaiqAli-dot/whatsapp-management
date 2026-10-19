import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { BUSINESS_CATEGORIES, PLANS } from '@wrs/shared';

const businessSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: BUSINESS_CATEGORIES, required: true },
    phone: { type: String, required: true },
    phoneE164: { type: String, required: true },
    country: { type: String, required: true, uppercase: true },
    timezone: { type: String, required: true },
    googleReviewUrl: { type: String, default: null },
    googlePlaceId: { type: String, default: null },
    googleUrlValidatedAt: { type: Date, default: null },
    googleUrlValidationStatus: {
      type: String,
      enum: ['unknown', 'valid', 'invalid', 'unreachable'],
      default: 'unknown',
    },
    description: { type: String, default: '' },
    onboardingComplete: { type: Boolean, default: false },
    planId: { type: String, enum: Object.keys(PLANS), default: 'free' },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'grace', 'cancelled', 'past_due'],
      default: 'active',
    },
    billingCustomerId: { type: String, default: null },
    usagePeriodStart: { type: Date, default: () => new Date() },
    usageRequestsThisPeriod: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type BusinessDoc = InferSchemaType<typeof businessSchema> & { _id: Types.ObjectId };

export const Business = mongoose.model('Business', businessSchema);
