import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    emailVerifiedAt: { type: Date, default: null },
    emailVerifyTokenHash: { type: String, default: null },
    emailVerifyExpiresAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ resetTokenHash: 1 }, { sparse: true });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

export const User = mongoose.model('User', userSchema);
