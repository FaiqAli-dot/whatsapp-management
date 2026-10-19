import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

const feedbackSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    reviewRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'ReviewRequest',
      required: true,
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    kind: { type: String, enum: ['public_draft_source', 'private'], required: true },
    rating: { type: Number, min: 1, max: 5, default: null },
    text: { type: String, required: true },
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true },
);

feedbackSchema.index({ businessId: 1, createdAt: -1 });

export type FeedbackDoc = InferSchemaType<typeof feedbackSchema> & { _id: Types.ObjectId };

export const Feedback = mongoose.model('Feedback', feedbackSchema);
