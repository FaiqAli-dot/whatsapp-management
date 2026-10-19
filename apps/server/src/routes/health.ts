import { Router } from 'express';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/ready', async (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  let pendingJobs = 0;
  try {
    pendingJobs = await Job.countDocuments({ status: { $in: ['pending', 'processing'] } });
  } catch {
    /* ignore */
  }
  if (!dbOk) {
    return res.status(503).json({ status: 'not_ready', db: false });
  }
  res.json({ status: 'ready', db: true, pendingJobs });
});
