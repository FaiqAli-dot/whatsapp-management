import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { loadEnv, resetEnvCache } from '../config/env.js';

let mongo: MongoMemoryServer | null = null;

export async function setupTestDb(): Promise<string> {
  process.env.NODE_ENV = 'test';
  process.env.WHATSAPP_MODE = 'simulator';
  process.env.BILLING_MODE = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars!!';
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-cred-encryption-key-32chars!!';
  process.env.APP_URL = 'http://localhost:4000';
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.LOG_LEVEL = 'error';
  resetEnvCache();
  loadEnv();

  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('wrs_test');
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
  return uri;
}

export async function teardownTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
}

export async function clearCollections(): Promise<void> {
  const cols = mongoose.connection.collections;
  for (const key of Object.keys(cols)) {
    await cols[key]!.deleteMany({});
  }
}
