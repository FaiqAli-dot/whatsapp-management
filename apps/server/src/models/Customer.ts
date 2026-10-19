import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

const customerSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    phoneE164: { type: String, required: true },
    email: { type: String, default: null, lowercase: true },
    consentStatus: {
      type: String,
      enum: ['granted', 'revoked', 'unknown'],
      default: 'unknown',
    },
    consentSource: {
      type: String,
      enum: ['manual', 'import', 'webform', 'verbal', null],
      default: null,
    },
    consentAt: { type: Date, default: null },
    optedOutAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

customerSchema.index({ businessId: 1, phoneE164: 1 }, { unique: true });
customerSchema.index({ businessId: 1, name: 'text' });
customerSchema.index({ businessId: 1, createdAt: -1 });

export type CustomerDoc = InferSchemaType<typeof customerSchema> & { _id: Types.ObjectId };

export const Customer = mongoose.model('Customer', customerSchema);
