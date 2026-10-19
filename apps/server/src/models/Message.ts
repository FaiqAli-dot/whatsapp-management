import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { MESSAGE_STATUSES } from '@wrs/shared';

const messageSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    reviewRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'ReviewRequest',
      required: true,
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    direction: { type: String, enum: ['outbound', 'inbound'], required: true },
    channel: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
    status: { type: String, enum: MESSAGE_STATUSES, default: 'CREATED' },
    body: { type: String, default: '' },
    templateName: { type: String, default: null },
    providerMessageId: { type: String, default: null },
    simulated: { type: Boolean, default: false },
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ businessId: 1, createdAt: -1 });
messageSchema.index({ providerMessageId: 1 }, { sparse: true });

export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId };

export const Message = mongoose.model('Message', messageSchema);
