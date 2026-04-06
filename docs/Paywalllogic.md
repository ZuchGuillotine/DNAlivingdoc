Let me break down how the paywalls are implemented, how tier status is tracked, and what features each tier has access to.

Current Tier Structure
Looking at your code, you actually have a 3-tier system but with some naming inconsistencies across files:

Free Tier - Basic supplement tracking
Starter/Core Tier - AI essentials package
Pro Tier - Full biohacker suite
How Tier Status is Known by the Application
Database Schema
User tier information is stored in the users table with these key columns:

subscription_tier (TEXT) - stores 'free', 'core'/'starter', or 'pro'
stripe_customer_id (TEXT) - links to Stripe customer
subscription_id (TEXT) - active Stripe subscription ID
ai_interactions_count (INTEGER) - tracks AI usage
ai_interactions_reset (TIMESTAMPTZ) - monthly reset date
lab_uploads_count (INTEGER) - tracks lab uploads
lab_uploads_reset (TIMESTAMPTZ) - yearly reset date
Tier Detection Flow
Stripe Integration: When users purchase through Stripe, webhooks update their tier in server/routes/stripe.ts
Authentication: The tier is loaded with user data during authentication in server/auth.ts
Client Access: Frontend components access tier info through the user context
Paywall Implementation
Middleware-Based Protection
The main paywall enforcement happens through middleware in server/middleware/tierLimitMiddleware.ts:

checkLLMLimit - Protects AI chat features
checkLabUploadLimit - Protects lab upload functionality
Service-Level Enforcement
server/services/tierLimitService.ts contains the core logic:

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    aiInteractions: 100, // 100 chats per month
    labUploads: 0        // No lab uploads
  },
  core: {
    aiInteractions: 100, // 100 chats per month  
    labUploads: 3        // 3 lab uploads per year
  },
  pro: {
    aiInteractions: Infinity,  // Unlimited
    labUploads: Infinity       // Unlimited
  }
};
Feature Access by Tier
Free Tier
✅ Basic supplement tracking
✅ 100 AI interactions per month (but middleware blocks this - potential bug)
❌ No lab uploads
❌ No premium AI features
Core/Starter Tier ($21.99/month or $184.71/year)
✅ All free tier features
✅ 100 AI interactions per month
✅ 3 lab uploads per year
✅ AI essentials package
Pro Tier ($49.99/month or $479.88/year)
✅ All core tier features
✅ Unlimited AI interactions
✅ Unlimited lab uploads
✅ Full biohacker suite
Implementation Issues I Notice
1. Naming Inconsistency
Your codebase has inconsistent tier naming:

Database/backend: uses 'core'
Stripe integration: uses 'starter'
Client-side: uses 'starter'
2. Free Tier AI Access Bug
In tierLimitService.ts, free tier has aiInteractions: 100 but the middleware blocks free tier access entirely:

// Free tier has no access
if (user.subscriptionTier === 'free') return false;
This seems inconsistent with your intention.

3. Usage Counter Management
The service automatically resets counters:

AI interactions: Monthly reset (1st of next month)
Lab uploads: Yearly reset (January 1st)
How Paywalls Trigger
AI Features
User attempts to use AI chat
checkLLMLimit middleware runs
Calls tierLimitService.canUseAI()
Returns 429 error if limit exceeded with upgrade message
Lab Uploads
User attempts to upload lab results
checkLabUploadLimit middleware runs
Calls tierLimitService.canUploadLab()
Returns 429 error if limit exceeded with upgrade message
Frontend Integration
The client-side components use the tier information to:

Show/hide premium features
Display upgrade prompts
Handle limit-reached notifications via LimitReachedNotification.tsx