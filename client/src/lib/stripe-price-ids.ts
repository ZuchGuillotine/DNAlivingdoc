
/**
 * Stripe product and price information
 * 
 * These values need to match what is set up in your Stripe dashboard.
 * 
 * Usage: 
 * - TIERS: used directly in the subscription UI to display plans and prices
 * - PRODUCTS: used to map product IDs to their respective tiers
 */

// Tier info type for TypeScript support
export type TierInfo = {
  id: string;
  price: number;
  url: string;
};

// Subscription tiers with direct Stripe checkout URLs
export const TIERS = {
  starter: {
    MONTHLY: {
      id: 'price_1RKZsdAIJBVVerrJhsQhpig2',
      price: 21.99,
      url: 'https://buy.stripe.com/6oEdTTeEQaWT76028b'
    },
    YEARLY: {
      id: 'price_1RKZsdAIJBVVerrJmp9neLDz',
      price: 184.71,
      url: 'https://buy.stripe.com/eVa177aoAfd94XSbIM'
    }
  },
  pro: {
    MONTHLY: {
      id: 'price_1RFrkBAIJBVVerrJNDRc9xSL',
      price: 49.99,
      url: 'https://buy.stripe.com/5kA5nn8gs7KH8a428e'
    },
    YEARLY: {
      id: 'price_1RKZwJAIJBVVerrJjGTuhgbG',
      price: 479.88,
      url: 'https://buy.stripe.com/8wM8zzfIU6GD760bIP'
    }
  }
};

// Product information for server-side tier mapping
export const PRODUCTS = {
  'prod_SF40NCVtZWsX05': {
    name: 'Starter AI Essentials',
    tier: 'starter'
  },
  'prod_RtcuCvjOY9gHvm': {
    name: 'Pro Biohacker Suite',
    tier: 'pro'
  }
};

// Map price IDs to their tier for utilities
const PRICE_TO_TIER: Record<string, 'starter' | 'pro'> = {
  // Starter plan price IDs
  'price_1OpGHMAIJBVVerrJCXB9LK8z': 'starter', // Monthly
  'price_1RKZsdAIJBVVerrJmp9neLDz': 'starter', // Yearly

  // Pro plan price IDs
  'price_1RFrkBAIJBVVerrJNDRc9xSL': 'pro',    // Monthly
  'price_1RKZwJAIJBVVerrJjGTuhgbG': 'pro'     // Yearly
};

/**
 * Helper to get the tier from a price ID
 * @param priceId Stripe price ID
 * @returns 'starter', 'pro', or 'free' if not found
 */
export function getTierFromPriceId(priceId: string): 'free' | 'starter' | 'pro' {
  return PRICE_TO_TIER[priceId] || 'free';
}
