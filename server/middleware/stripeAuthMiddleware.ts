import { Request, Response, NextFunction } from 'express';
import { db } from '@db';
import { users } from '@db/schema';
import { eq } from 'drizzle-orm';

/**
 * Middleware to handle Stripe checkout session continuity
 * This middleware checks for a session_id parameter in redirects from Stripe
 * and maintains the user's authentication state
 */
export const handleStripeRedirects = async (req: Request, res: Response, next: NextFunction) => {
  // Check for Stripe redirect parameters
  const isStripeRedirect = req.query.session_id;
  
  if (!isStripeRedirect) {
    return next();
  }

  try {
    const sessionId = req.query.session_id as string;
    console.log('Processing Stripe redirect with session ID:', {
      sessionId,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    // If user is already authenticated, no need to re-authenticate
    if (req.isAuthenticated()) {
      console.log('User already authenticated during Stripe redirect', {
        userId: req.user?.id,
        sessionId,
        timestamp: new Date().toISOString()
      });
      
      // If this is a success redirect and we have setup_complete parameter,
      // redirect the user to the dashboard after updating subscription
      if (req.query.setup_complete === 'true') {
        // Process the subscription and ensure user status is updated
        try {
          const stripe = await import('stripe').then(module => 
            new module.default(process.env.STRIPE_SECRET_KEY!));
            
          const session = await stripe.checkout.sessions.retrieve(sessionId);
          
          // Update user subscription status based on the session
          if (session.subscription) {
            const { stripeService } = await import('../services/stripe');
            await stripeService.handleSubscriptionUpdated(session.subscription as any);
            
            console.log('Updated subscription status after Stripe redirect', {
              userId: req.user?.id,
              subscriptionId: session.subscription,
              timestamp: new Date().toISOString()
            });
          }
        } catch (subError) {
          console.error('Error processing subscription after redirect:', {
            error: subError,
            userId: req.user?.id,
            sessionId,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      return next();
    }

    // If session exists but user data is missing, we need to re-establish the user data
    if (req.session) {
      // Try to get user ID from Stripe's client_reference_id (stored during checkout creation)
      const stripe = await import('stripe').then(module => 
        new module.default(process.env.STRIPE_SECRET_KEY!));
      
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription']
      });
      
      // Get user ID from client_reference_id 
      const userId = parseInt(session.client_reference_id || '0', 10);
      
      if (userId) {
        // Get user from database
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
          
        if (user) {
          // Update subscription status
          if (session.subscription) {
            const { stripeService } = await import('../services/stripe');
            await stripeService.handleSubscriptionUpdated(session.subscription as any);
          }
          
          // Re-establish session auth
          req.login(user, (err) => {
            if (err) {
              console.error('Error restoring user session after Stripe redirect:', {
                error: err.message,
                userId,
                sessionId,
                timestamp: new Date().toISOString()
              });
            } else {
              console.log('Successfully restored user session after Stripe redirect', {
                userId,
                sessionId,
                timestamp: new Date().toISOString()
              });
              
              // If this was a setup_complete redirect, redirect to the dashboard
              if (req.query.setup_complete === 'true') {
                return res.redirect('/');
              }
            }
            next();
          });
          return;
        }
      }
    }
    
    console.log('Unable to restore user session from Stripe redirect', {
      sessionId,
      hasSession: !!req.session,
      timestamp: new Date().toISOString()
    });
    next();
  } catch (error: any) {
    console.error('Error processing Stripe redirect:', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      timestamp: new Date().toISOString()
    });
    next();
  }
};