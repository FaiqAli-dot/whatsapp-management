import { loadEnv } from './config/env.js';
import { connectDb } from './db/connection.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { ensureIndexes } from './db/migrate.js';
import { runWorkerOnce } from './services/jobService.js';
import './models/index.js';

async function main() {
  const env = loadEnv();
  await connectDb();
  await ensureIndexes();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info({ msg: 'server_listening', port: env.PORT, mode: env.WHATSAPP_MODE });
  });

  // Lightweight embedded worker for single-process deploys; use `npm run worker` for dedicated
  const workerId = `embedded-${process.pid}`;
  setInterval(() => {
    void runWorkerOnce(workerId).catch((err) =>
      logger.error({ msg: 'worker_tick_failed', err: String(err) }),
    );
  }, 2000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
