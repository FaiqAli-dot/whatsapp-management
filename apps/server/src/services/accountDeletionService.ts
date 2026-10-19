import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { WhatsAppConnection } from '../models/WhatsAppConnection.js';
import { Customer } from '../models/Customer.js';
import { ReviewRequest } from '../models/ReviewRequest.js';
import { Message } from '../models/Message.js';
import { Feedback } from '../models/Feedback.js';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { Job } from '../models/Job.js';
import { audit } from './auditService.js';

/**
 * Account deletion per documented policy:
 * - Soft-delete user & business
 * - Hard-delete encrypted credentials
 * - Anonymize/remove customers, messages, feedback, analytics, jobs for tenant
 * Never called against production data from tests (tests use disposable DB).
 */
export async function deleteAccount(userId: string, businessId: string | null): Promise<void> {
  if (businessId) {
    await WhatsAppConnection.deleteMany({ businessId });
    await Job.deleteMany({ businessId });
    await Message.deleteMany({ businessId });
    await Feedback.deleteMany({ businessId });
    await AnalyticsEvent.deleteMany({ businessId });
    await ReviewRequest.deleteMany({ businessId });
    await Customer.deleteMany({ businessId });
    await Business.updateOne(
      { _id: businessId },
      {
        $set: {
          deletedAt: new Date(),
          name: '[deleted]',
          googleReviewUrl: null,
          description: '',
        },
      },
    );
  }

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        deletedAt: new Date(),
        email: `deleted-${userId}@invalid.local`,
        passwordHash: '!',
        name: '[deleted]',
        resetTokenHash: null,
        emailVerifyTokenHash: null,
        businessId: null,
      },
    },
  );

  await audit({
    userId,
    businessId,
    action: 'account.delete',
    resourceType: 'user',
    resourceId: userId,
  });
}
