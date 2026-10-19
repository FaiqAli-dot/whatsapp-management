import { Job } from '../models/Job.js';
import { logger } from '../lib/logger.js';

const LOCK_MS = 60_000;

export async function enqueueJob(input: {
  businessId: string;
  type: 'send_review_request' | 'send_clarification' | 'send_draft_link';
  payload: Record<string, unknown>;
  idempotencyKey: string;
  runAfter?: Date;
}): Promise<{ id: string; created: boolean }> {
  try {
    const job = await Job.create({
      businessId: input.businessId,
      type: input.type,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      runAfter: input.runAfter ?? new Date(),
      status: 'pending',
    });
    return { id: String(job._id), created: true };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      const existing = await Job.findOne({
        businessId: input.businessId,
        idempotencyKey: input.idempotencyKey,
      }).lean();
      return { id: String(existing?._id), created: false };
    }
    throw err;
  }
}

/** Claim next due jobs with atomic lock — safe across worker restarts. */
export async function claimJobs(workerId: string, limit = 10) {
  const now = new Date();
  const claimed = [];
  for (let i = 0; i < limit; i++) {
    const job = await Job.findOneAndUpdate(
      {
        status: 'pending',
        runAfter: { $lte: now },
        $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(now.getTime() - LOCK_MS) } }],
      },
      {
        $set: { status: 'processing', lockedAt: now, lockedBy: workerId },
        $inc: { attempts: 1 },
      },
      { sort: { runAfter: 1 }, new: true },
    );
    if (!job) break;
    claimed.push(job);
  }
  return claimed;
}

export async function processJob(job: InstanceType<typeof Job>): Promise<void> {
  // Dynamic import avoids circular dependency with reviewRequestService
  const { processOutboundJob } = await import('./reviewRequestService.js');
  try {
    await processOutboundJob(job);
    job.status = 'completed';
    job.completedAt = new Date();
    job.lockedAt = null;
    job.lockedBy = null;
    await job.save();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.lastError = message.slice(0, 500);
    job.lockedAt = null;
    job.lockedBy = null;
    if (job.attempts >= job.maxAttempts) {
      job.status = 'dead';
      logger.error({ msg: 'job_dead', jobId: String(job._id), error: message });
    } else {
      job.status = 'pending';
      const backoff = Math.min(300_000, 2000 * 2 ** job.attempts);
      job.runAfter = new Date(Date.now() + backoff);
      logger.warn({ msg: 'job_retry_scheduled', jobId: String(job._id), backoff });
    }
    await job.save();
  }
}

export async function runWorkerOnce(workerId: string): Promise<number> {
  const jobs = await claimJobs(workerId);
  for (const job of jobs) {
    await processJob(job);
  }
  return jobs.length;
}
