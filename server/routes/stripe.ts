/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 13/06/2025 - 19:25:16
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 13/06/2025
    * - Author          : 
    * - Modification    : 
**/
import { Router } from 'express';
import Stripe from 'stripe';
import { db } from '@db';
import { users } from '@db/schema';
import { eq } from 'drizzle-orm';
import stripeService from '../services/stripe';

const router = Router();

// Allow custom domain and Replit domain
router.use((req, res, next) => {
  const allowedOrigins = [
    'https://stacktracker.io',
    process.env.REPLIT_URL || 'https://stacktracker.replit.app'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Stripe webhook handler
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Retrieve session with expanded line items
      const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items', 'line_items.data.price.product']
      });

      const productId = expandedSession.line_items?.data[0]?.price?.product as string;
      const customerEmail = expandedSession.customer_details?.email;

      if (productId && customerEmail) {
        const stripeService = new StripeService();
        const subscriptionTier = stripeService.getTierFromProductId(productId);

        // Update user's subscription tier
        await db
          .update(users)
          .set({ 
            subscriptionTier,
            stripeCustomerId: expandedSession.customer as string,
            subscriptionId: expandedSession.subscription as string,
            updatedAt: new Date()
          })
          .where(eq(users.email, customerEmail));

        console.log(`Updated subscription tier to ${subscriptionTier} for ${customerEmail}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Create a checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl, customerEmail } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    // Add debug logging
    console.log('Creating checkout session:', {
      priceId,
      isAuthenticated: req.isAuthenticated?.(),
      user: req.user,
      timestamp: new Date().toISOString()
    });

    // Get the price from Stripe to verify it exists
    const price = await stripe.prices.retrieve(priceId);
    
    if (!price) {
      return res.status(404).json({ error: 'Price not found' });
    }

    // Create checkout session options
    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.protocol}://${req.get('host')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}`,
    };

    // If user is logged in, use their email
    if (req.isAuthenticated() && req.user?.email) {
      sessionOptions.customer_email = req.user.email;
    } 
    // If email was provided in request, use that (for non-authenticated users)
    else if (customerEmail) {
      sessionOptions.customer_email = customerEmail;
    }

    // Add metadata to track guest checkouts
    sessionOptions.metadata = {
      ...sessionOptions.metadata,
      isGuestCheckout: (!req.isAuthenticated()).toString()
    };

    const session = await stripe.checkout.sessions.create(sessionOptions);

    // Store session ID for guest users
    if (!req.isAuthenticated()) {
      // Store in redis or session store that this is a pending guest checkout
      req.session.pendingCheckoutId = session.id;
    }

    res.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating checkout session:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get a checkout session by ID
router.get('/checkout-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'line_items', 'line_items.data.price.product'],
    });

    // If the session doesn't exist or is not complete, return an error
    if (!session || session.status !== 'complete') {
      return res.status(404).json({ 
        error: 'Invalid or incomplete session', 
        status: session?.status 
      });
    }

    const priceId = session.line_items?.data[0]?.price?.id;
    const productId = session.line_items?.data[0]?.price?.product as string;
    const customerEmail = session.customer_email || (session.customer as Stripe.Customer)?.email;

    // Return the session data
    res.json({
      sessionId,
      customerEmail,
      priceId,
      productId,
      status: session.status,
    });
  } catch (error: any) {
    console.error('Error retrieving checkout session:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update existing user's subscription from checkout session
router.post('/update-subscription', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'line_items', 'line_items.data.price.product'],
    });

    // If the session doesn't exist or is not complete, return an error
    if (!session || session.status !== 'complete') {
      return res.status(404).json({ 
        error: 'Invalid or incomplete session', 
        status: session?.status 
      });
    }

    const subscriptionId = session.subscription as string;
    
    // Get the product details to determine the tier
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const productId = subscription.items.data[0].price.product as string;
    
    // Get the customer ID from the subscription
    const customerId = subscription.customer as string;

    // Update the user's subscription details
    const [updatedUser] = await db
      .update(users)
      .set({
        subscriptionId,
        stripeCustomerId: customerId,
        subscriptionTier: stripeService.getTierFromProductId(productId),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.id))
      .returning();

    res.json({ 
      success: true, 
      user: { 
        id: updatedUser.id, 
        subscriptionTier: updatedUser.subscriptionTier 
      } 
    });
  } catch (error: any) {
    console.error('Error updating subscription:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;