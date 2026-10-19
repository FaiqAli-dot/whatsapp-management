import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const env = getEnv();
  if (env.EMAIL_MODE === 'console' || !env.SMTP_URL) {
    logger.info({
      msg: 'email_console',
      to: opts.to,
      subject: opts.subject,
      // do not log full reset links containing tokens in production logs at info — truncate
      textPreview: opts.text.slice(0, 80),
    });
    return;
  }
  // SMTP path documented; adapter stub for when SMTP_URL is configured
  logger.info({ msg: 'email_smtp_queued', to: opts.to, subject: opts.subject });
}
