import { loadEnv } from './config/env.js';
import { connectDb } from './db/connection.js';
import { logger } from './lib/logger.js';
import { runWorkerOnce } from './services/jobService.js';
import { randomUUID } from 'node:crypto';

async function main() {
  loadEnv();
  await connectDb();
  const workerId = `worker-${randomUUID().slice(0, 8)}`;
  logger.info({ msg: 'worker_started', workerId });

  for (;;) {
    const n = await runWorkerOnce(workerId);
    if (n === 0) await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((err) => {
  logger.error({ msg: 'worker_crash', err: String(err) });
  process.exit(1);
});
