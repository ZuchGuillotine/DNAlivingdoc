/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 14/06/2025 - 00:21:27
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 14/06/2025
    * - Author          : 
    * - Modification    : 
**/
import { Router, type Request, type Response, type NextFunction } from 'express';
import passport from 'passport';
import { db } from '@db';
import { users } from '@db/schema';
import { eq, or } from 'drizzle-orm';
import { insertUserSchema } from '@db/schema';
import { crypto } from './crypto';
import { sendWelcomeEmail } from '../services/emailService';
import Stripe from 'stripe';
import type { IVerifyOptions } from 'passport-local';

const router = Router();

// Google OAuth routes
router.get('/auth/google', (req: Request, res: Response, next: NextFunction) => {
  const state = Buffer.from(JSON.stringify({ 
    signup: req.query.signup === 'true',
    plan: req.query.plan || null 
  })).toString('base64');
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state
  })(req, res, next);
});

router.get('/auth/google/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', (err: any, user: Express.User | false, info: any) => {
    if (err) {
      console.error('Google auth callback error:', err);
      return res.redirect('/auth?error=google_auth_failed');
    }
    
    if (!user) {
      // Check if it's because account exists with different auth method
      if (info?.message?.includes('email and password')) {
        return res.redirect('/auth?error=account_exists_manual');
      }
      return res.redirect('/auth?error=google_auth_failed');
    }
    
    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error('Session login error after Google auth:', loginErr);
        return next(loginErr);
      }
      
      // Save session before redirecting
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return next(saveErr);
        }
        
        // Decode state to check if there was a plan selection
        try {
          const state = req.query.state as string;
          if (state) {
            const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
            if (decoded.plan) {
              // Redirect to payment flow with plan
              return res.redirect(`/pricing?plan=${decoded.plan}`);
            }
          }
        } catch (e) {
          // Ignore state decode errors
        }
        
        res.redirect('/');
      });
    });
  })(req, res, next);
});

// Local authentication routes
router.post('/api/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: result.error.issues.map(i => i.message).join(', ')
      });
    }

    const { email, username, password, stripeSessionId } = result.data;

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    if (existingUser) {
      if (existingUser.email === email) {
        // Check if they used Google OAuth
        if (existingUser.password === 'google_oauth') {
          return res.status(400).json({
            error: 'This email is already registered with Google. Please use "Sign in with Google".'
          });
        }
        return res.status(400).json({ error: 'Email already registered' });
      }
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await crypto.hash(password);

    // Default values for new user
    let userValues: any = {
      email,
      username,
      password: hashedPassword,
      emailVerified: true, // Auto-verify for now
      subscriptionTier: 'free',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Handle Stripe session if provided
    if (stripeSessionId) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
        
        if (session.payment_status === 'paid' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          
          // Determine tier based on product
          if (subscription.items.data[0]?.price?.product) {
            const productId = subscription.items.data[0].price.product;
            if (productId === process.env.STRIPE_STARTER_PRODUCT_ID) {
              userValues.subscriptionTier = 'starter';
            } else if (productId === process.env.STRIPE_PRO_PRODUCT_ID) {
              userValues.subscriptionTier = 'pro';
            }
          }
          
          userValues.stripeCustomerId = session.customer as string;
          userValues.stripeSubscriptionId = session.subscription as string;
        }
      } catch (error) {
        console.error('Error processing Stripe session:', error);
        // Continue with free tier
      }
    }

    // Create user
    const [newUser] = await db.insert(users).values(userValues).returning();

    // Send welcome email (don't block on this)
    sendWelcomeEmail(email, username).catch(err => 
      console.error('Failed to send welcome email:', err)
    );

    // Log the user in
    req.login(newUser, (err) => {
      if (err) return next(err);
      
      res.json({
        message: 'Registration successful',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          subscriptionTier: newUser.subscriptionTier
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/api/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: Error, user: Express.User, info: IVerifyOptions) => {
    if (err) {
      console.error('Login error:', err);
      return next(err);
    }

    if (!user) {
      // Check for specific error messages
      if (info.message?.includes('Google sign-in')) {
        return res.status(401).json({ 
          error: info.message,
          authMethod: 'google'
        });
      }
      return res.status(401).json({ error: info.message });
    }

    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error('Session login error:', loginErr);
        return next(loginErr);
      }

      // Force session save
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return next(saveErr);
        }

        console.log('User logged in successfully:', {
          userId: user.id,
          sessionID: req.sessionID
        });

        res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            subscriptionTier: user.subscriptionTier,
            isAdmin: user.isAdmin
          }
        });
      });
    });
  })(req, res, next);
});

router.post('/api/logout', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.sessionID;
  const userBeforeLogout = req.user;

  console.log(`Attempting to log out user: ${userBeforeLogout?.id}, session: ${sessionId}`);

  try {
    // Step 1: Use a Promise to wrap req.logout()
    await new Promise<void>((resolve, reject) => {
      req.logout((err: any) => {
        if (err) {
          console.error(`Logout error for user ${userBeforeLogout?.id}:`, err);
          return reject(err);
        }
        console.log(`req.logout() successful for user: ${userBeforeLogout?.id}`);
        resolve();
      });
    });

    // Step 2: Use a Promise to wrap req.session.destroy()
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err: any) => {
        if (err) {
          console.error(`Session destruction error for session ${sessionId}:`, err);
          return reject(new Error('Session could not be destroyed.'));
        }
        console.log(`Session ${sessionId} destroyed successfully.`);
        resolve();
      });
    });

    // Step 3: Clear the cookie and send the response
    res.clearCookie('stacktracker.sid', { path: '/' });
    console.log(`Cookie cleared for session ${sessionId}.`);
    res.status(200).json({ message: 'Logged out successfully' });

  } catch (err) {
    console.error(`An error occurred during the logout process for user ${userBeforeLogout?.id}:`, err);
    return res.status(500).json({ error: 'Logout failed.' });
  }
});

router.get('/api/user', (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Normalize tier naming - convert 'core' to 'starter' for frontend consistency
  const normalizedTier = req.user!.subscriptionTier === 'core' ? 'starter' : req.user!.subscriptionTier;
  
  res.json({
    user: {
      id: req.user!.id,
      username: req.user!.username,
      email: req.user!.email,
      name: req.user!.name,
      phoneNumber: req.user!.phoneNumber,
      subscriptionTier: normalizedTier,
      subscriptionId: req.user!.subscriptionId,
      stripeCustomerId: req.user!.stripeCustomerId,
      isAdmin: req.user!.isAdmin,
      // Usage tracking
      aiInteractionsCount: req.user!.aiInteractionsCount || 0,
      aiInteractionsReset: req.user!.aiInteractionsReset,
      labUploadsCount: req.user!.labUploadsCount || 0,
      labUploadsReset: req.user!.labUploadsReset,
      // Computed subscription fields
      isPro: normalizedTier === 'pro',
      trialEndsAt: normalizedTier === 'free' && req.user!.createdAt ? 
        new Date(new Date(req.user!.createdAt).getTime() + 28 * 24 * 60 * 60 * 1000).toISOString() : null,
      subscriptionEndsAt: (normalizedTier === 'pro' || normalizedTier === 'starter') ? 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null, // Mock next billing date
    }
  });
});

export default router; 