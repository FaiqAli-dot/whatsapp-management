import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

const whatsappConnectionSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      unique: true,
      index: true,
    },
    mode: { type: String, enum: ['simulator', 'meta'], required: true },
    status: {
      type: String,
      enum: ['disconnected', 'connected', 'error', 'token_expired'],
      default: 'disconnected',
    },
    phoneNumberId: { type: String, default: null },
    wabaId: { type: String, default: null },
    displayPhoneNumber: { type: String, default: null },
    /** AES-GCM encrypted access token — never plaintext */
    accessTokenEncrypted: { type: String, default: null },
    templateName: { type: String, default: 'review_request' },
    templateLanguage: { type: String, default: 'en_US' },
    lastHealthCheckAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    connectedAt: { type: Date, default: null },
    disconnectedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type WhatsAppConnectionDoc = InferSchemaType<typeof whatsappConnectionSchema> & {
  _id: Types.ObjectId;
};

export const WhatsAppConnection = mongoose.model('WhatsAppConnection', whatsappConnectionSchema);
