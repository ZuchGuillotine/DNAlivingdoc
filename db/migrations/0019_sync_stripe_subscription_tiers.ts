
import { db } from '../index';
import { sql } from 'drizzle-orm';
import Stripe from 'stripe';

console.log('Migration script starting...');

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Map price IDs to subscription tiers
const PRICE_TIERS: Record<string, 'free' | 'starter' | 'pro'> = {
  'price_1RKZsdAIJBVVerrJhsQhpig2': 'starter', // Starter Monthly
  'price_1RKZsdAIJBVVerrJmp9neLDz': 'starter', // Starter Yearly
  'price_1RFrkBAIJBVVerrJNDRc9xSL': 'pro',     // Pro Monthly
  'price_1RKZwJAIJBVVerrJjGTuhgbG': 'pro'      // Pro Yearly
};

export async function up() {
  console.log('Starting subscription tier sync migration...');
  
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    console.log('Database connection verified');

    // First get all Stripe customers
    const customers = await stripe.customers.list({
      limit: 100,
      expand: ['data.subscriptions']
    });

    console.log(`Found ${customers.data.length} customers in Stripe`);

    // Process each Stripe customer
    for (const customer of customers.data) {
      try {
        console.log(`Processing Stripe customer: ${customer.email}`);
        
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 1
        });

        if (!subscriptions.data.length) {
          console.log(`No active subscriptions for customer ${customer.email}`);
          continue;
        }

        const subscription = subscriptions.data[0];
        const priceId = subscription.items.data[0].price.id;
        const newTier = PRICE_TIERS[priceId] || 'free';

        // Try to find user by subscription ID first
        let [user] = await db.execute(sql`
          SELECT id, email, subscription_tier 
          FROM users 
          WHERE subscription_id = ${subscription.id}
        `);

        // If no match, try by email
        if (!user) {
          [user] = await db.execute(sql`
            SELECT id, email, subscription_tier 
            FROM users 
            WHERE email = ${customer.email}
          `);
        }

        // If no match by email, try by stripe_customer_id
        if (!user) {
          [user] = await db.execute(sql`
            SELECT id, email, subscription_tier 
            FROM users 
            WHERE stripe_customer_id = ${customer.id}
          `);
        }

        if (user) {
          console.log(`Found matching user: ${user.email}`);
          
          // Update user with all Stripe info
          await db.execute(sql`
            UPDATE users 
            SET subscription_tier = ${newTier},
                stripe_customer_id = ${customer.id},
                subscription_id = ${subscription.id},
                updated_at = NOW()
            WHERE id = ${user.id}
          `);
          
          console.log(`Updated ${user.email} from ${user.subscription_tier} to ${newTier}`);
        } else {
          console.log(`WARNING: No matching user found for Stripe customer ${customer.email}`);
        }

      } catch (err) {
        console.error(`Error processing Stripe customer ${customer.email}:`, err);
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function down() {
  console.log('No down migration implemented');
}

// Auto-execute if this file is the entry point
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  up()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
