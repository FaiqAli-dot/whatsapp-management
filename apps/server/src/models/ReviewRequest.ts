import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { MESSAGE_STATUSES } from '@wrs/shared';

const reviewRequestSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    status: { type: String, enum: MESSAGE_STATUSES, default: 'CREATED', index: true },
    simulated: { type: Boolean, default: false, index: true },
    providerMessageId: { type: String, default: null },
    idempotencyKey: { type: String, required: true },
    failureReason: { type: String, default: null },
    rating: { type: Number, min: 1, max: 5, default: null },
    feedbackText: { type: String, default: null },
    draftText: { type: String, default: null },
    draftSource: { type: String, enum: ['template', 'llm', null], default: null },
    landingTokenHash: { type: String, default: null, index: true },
    landingTokenExpiresAt: { type: Date, default: null },
    landingRevokedAt: { type: Date, default: null },
    clarificationSentAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    repliedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

reviewRequestSchema.index({ businessId: 1, createdAt: -1 });
reviewRequestSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });
reviewRequestSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true });
reviewRequestSchema.index({ providerMessageId: 1 }, { sparse: true });

export type ReviewRequestDoc = InferSchemaType<typeof reviewRequestSchema> & {
  _id: Types.ObjectId;
};

export const ReviewRequest = mongoose.model('ReviewRequest', reviewRequestSchema);
