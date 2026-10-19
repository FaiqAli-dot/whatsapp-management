import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

const analyticsEventSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    reviewRequestId: { type: Schema.Types.ObjectId, ref: 'ReviewRequest', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    type: {
      type: String,
      required: true,
      enum: [
        'request_created',
        'submitted_to_provider',
        'delivered',
        'read',
        'reply',
        'rating',
        'landing_visit',
        'draft_copy',
        'google_click',
        'private_feedback',
        'failure',
      ],
    },
    /** Deduplicate repeated clicks/events */
    dedupeKey: { type: String, required: true },
    ratingValue: { type: Number, default: null },
    simulated: { type: Boolean, default: false },
    meta: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

analyticsEventSchema.index({ businessId: 1, dedupeKey: 1 }, { unique: true });
analyticsEventSchema.index({ businessId: 1, type: 1, occurredAt: -1 });

export type AnalyticsEventDoc = InferSchemaType<typeof analyticsEventSchema> & {
  _id: Types.ObjectId;
};

export const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
