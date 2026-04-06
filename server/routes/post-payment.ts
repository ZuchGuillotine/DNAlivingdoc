import express from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { db } from '@db';
import { users } from '@db/schema';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { fromZodError } from 'zod-validation-error';

const router = express.Router();
const scryptAsync = promisify(scrypt);

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
  apiVersion: '2023-10-16' 
});

/**
 * Hash a password using scrypt
 * @param password Password to hash
 * @returns Hashed password with salt
 */
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

/**
 * Registration schema for post-payment user registration
 */
const postPaymentRegistrationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  sessionId: z.string().min(1, 'Session ID is required'),
  subscriptionTier: z.enum(['free', 'starter', 'pro']),
  purchaseId: z.string().optional(),
});

/**
 * Register a user after payment
 * POST /api/register-post-payment
 */
router.post('/register-post-payment', async (req, res) => {
  try {
    // Validate request body
    const result = postPaymentRegistrationSchema.safeParse(req.body);
    if (!result.success) {
      const error = fromZodError(result.error);
      return res.status(400).json({ message: error.toString() });
    }

    const { username, email, password, sessionId, subscriptionTier, purchaseId } = result.data;

    // Verify the session with Stripe
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items', 'line_items.data.price.product']
      });
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ message: 'Payment has not been completed' });
      }
      
      // Verify email matches if available in session
      if (session.customer_details?.email && session.customer_details.email !== email) {
        return res.status(400).json({ 
          message: 'Email does not match the one used for payment' 
        });
      }

      // Get product ID and determine subscription tier
      const productId = session.line_items?.data[0]?.price?.product as string;
      if (productId) {
        const stripeService = new StripeService();
        const derivedTier = stripeService.getTierFromProductId(productId);
        if (derivedTier !== subscriptionTier) {
          console.log(`Updating tier from ${subscriptionTier} to ${derivedTier} based on product`);
          req.body.subscriptionTier = derivedTier;
        }
      }
    } catch (err: any) {
      console.error('Error verifying Stripe session:', err);
      return res.status(400).json({ 
        message: 'Unable to verify payment session. Please contact support.' 
      });
    }

    // Check if username or email already exists
    const existingUser = await db.query.users.findFirst({
      where: (users, { or, eq }) => or(
        eq(users.username, username),
        eq(users.email, email)
      )
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Username or email already exists' 
      });
    }

    // Get or create Stripe customer
    let stripeCustomerId = '';
    try {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          username
        }
      });
      stripeCustomerId = customer.id;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
    }

    // Create user record
    const [user] = await db.insert(users).values({
      username,
      email,
      password: await hashPassword(password),
      subscriptionTier,
      stripeCustomerId,
      purchaseId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // Log the user in and establish session
    req.logIn(user, (err) => {
      if (err) {
        console.error('Error logging in user:', err);
        return res.status(500).json({ message: 'Failed to log in' });
      }
      
      // Success - return user without password
      const { password, ...userWithoutPassword } = user;
      return res.status(201).json({
        ...userWithoutPassword,
        isAuthenticated: true
      });
    });
  } catch (err: any) {
    console.error('Post-payment registration error:', err);
    return res.status(500).json({ 
      message: 'Registration failed. Please try again or contact support.' 
    });
  }
});

export default router;