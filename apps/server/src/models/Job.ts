import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

/**
 * Durable outbox / job queue — not in-memory.
 * Survives worker restarts; uses claim locking for concurrency.
 */
const jobSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    type: {
      type: String,
      enum: ['send_review_request', 'send_clarification', 'send_draft_link'],
      required: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'dead'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    runAfter: { type: Date, default: () => new Date(), index: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    lastError: { type: String, default: null },
    idempotencyKey: { type: String, required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobSchema.index({ status: 1, runAfter: 1 });
jobSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true });

export type JobDoc = InferSchemaType<typeof jobSchema> & { _id: Types.ObjectId };

export const Job = mongoose.model('Job', jobSchema);
