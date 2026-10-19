import { loadEnv } from '../config/env.js';
import { connectDb, disconnectDb } from './connection.js';
import { logger } from '../lib/logger.js';
import '../models/index.js';

/**
 * Versioned index/migration ensure — non-destructive.
 * Does NOT drop collections or delete production data.
 */
export async function ensureIndexes(): Promise<void> {
  const mod = await import('mongoose');
  const mongoose = mod.default ?? mod;
  const names = Object.keys(mongoose.models ?? {});
  if (names.length === 0) {
    logger.warn({ msg: 'indexes_skipped_no_models' });
    return;
  }
  for (const name of names) {
    await mongoose.models[name]!.syncIndexes();
  }
  logger.info({ msg: 'indexes_synced', migration: 'v1', models: names.length });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnv();
  connectDb()
    .then(() => ensureIndexes())
    .then(() => disconnectDb())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
