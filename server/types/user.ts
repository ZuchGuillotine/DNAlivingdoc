import type { InferSelectModel } from 'drizzle-orm';
import type { users, healthStats, supplements, labResults, biomarkerResults, qualitativeLogs, queryChatLogs } from '@db/schema';

export type User = Omit<InferSelectModel<typeof users>, 'password' | 'verificationToken' | 'verificationTokenExpiry'> & {
    password?: string | null;
    emailVerified?: boolean | null;
    name?: string | null;
    phoneNumber?: string | null;
    trialEndsAt?: Date | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
};

export type HealthStats = InferSelectModel<typeof healthStats>;
export type Supplement = InferSelectModel<typeof supplements>;
export type LabResult = InferSelectModel<typeof labResults>;
export type BiomarkerResult = InferSelectModel<typeof biomarkerResults>;
export type QualitativeLog = InferSelectModel<typeof qualitativeLogs>;
export type QueryChatLog = InferSelectModel<typeof queryChatLogs>;

// Extend Express types
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      name?: string | null;
      phoneNumber?: string | null;
      subscriptionTier?: string;
      isAdmin?: boolean | null;
      trialEndsAt?: Date | null;
    }
  }
} 