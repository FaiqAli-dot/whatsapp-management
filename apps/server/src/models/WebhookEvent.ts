import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

const webhookEventSchema = new Schema(
  {
    provider: { type: String, enum: ['meta', 'simulator', 'billing'], required: true },
    eventId: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    payloadHash: { type: String, required: true },
    processedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['received', 'processed', 'ignored', 'failed'],
      default: 'received',
    },
    error: { type: String, default: null },
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export type WebhookEventDoc = InferSchemaType<typeof webhookEventSchema> & {
  _id: Types.ObjectId;
};

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
