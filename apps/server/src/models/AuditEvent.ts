import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

const auditEventSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: null },
    ip: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

auditEventSchema.index({ createdAt: -1 });

export type AuditEventDoc = InferSchemaType<typeof auditEventSchema> & { _id: Types.ObjectId };

export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
