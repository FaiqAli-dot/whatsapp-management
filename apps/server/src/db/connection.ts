import mongoose from 'mongoose';
import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';

export async function connectDb(uri?: string): Promise<typeof mongoose> {
  const env = getEnv();
  const mongoUri = uri ?? env.MONGODB_URI;
  mongoose.set('strictQuery', true);
  // NOTE: do not enable sanitizeFilter globally — it strips legitimate $lte/$nin operators
  // used by the job worker and status queries. Operator injection is prevented by never
  // spreading client JSON into Mongo filters (Zod-validated scalars only).
  await mongoose.connect(mongoUri);
  logger.info({ msg: 'mongodb_connected' });
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
