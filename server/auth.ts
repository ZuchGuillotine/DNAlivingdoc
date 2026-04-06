/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 17/05/2025 - 01:14:44
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 17/05/2025
    * - Author          : 
    * - Modification    : 
**/
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { users, healthStats } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { insertUserSchema } from "@db/schema";
import { or } from "drizzle-orm";

// Constants
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Get the environment-specific callback URL
const getCallbackURL = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const customDomain = process.env.CUSTOM_DOMAIN;

  // In production, with a custom domain, use the domain.
  if (isProd && customDomain) {
    // Ensure the domain doesn't have a protocol or quotes for this construction
    const domain = customDomain.replace(/^https?:\/\//, '').replace(/["']/g, "").replace(/\/$/, '');
    return `https://${domain}/auth/google/callback`;
  }
  
  // For production without custom domain, use APP_URL if available
  if (isProd && process.env.APP_URL) {
    // Ensure the domain doesn't have a protocol or quotes for this construction
    const appUrl = process.env.APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/["']/g, "");
    return `https://${appUrl}/auth/google/callback`;
  }
  
  // For all other cases (development, local, staging without custom domain), use localhost.
  return 'http://localhost:3001/auth/google/callback';
};

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
  randomBytes: randomBytes,
};

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

export function setupAuth(app: Express) {
  // Initialize Passport authentication
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup Local Strategy for username/password login
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          const [user] = await db
            .select()
            .from(users)
            .where(or(eq(users.email, email), eq(users.username, email)))
            .limit(1);

          if (!user) {
            return done(null, false, { message: 'Incorrect email or username.' });
          }

          if (!user.password) {
            return done(null, false, { message: 'Password not set for this account.' });
          }

          const isValid = await crypto.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: 'Incorrect password.' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Passport serialization
  passport.serializeUser((user: Express.User, done) => {
    console.log('Serializing user:', { userId: user.id, timestamp: new Date().toISOString() });
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log('User not found during deserialization:', { id, timestamp: new Date().toISOString() });
        return done(null, false);
      }

      console.log('User deserialized:', { userId: user.id, timestamp: new Date().toISOString() });
      done(null, user);
    } catch (err) {
      console.error('Deserialization error:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      });
      done(err);
    }
  });

  // Google OAuth Strategy Configuration
  const isProd = process.env.NODE_ENV === 'production';
  const CALLBACK_URL = getCallbackURL();
  
  // Use test credentials if we're using a localhost callback URL
  const useTestCredentials = CALLBACK_URL.includes('localhost');
  
  // Try multiple naming patterns for Google credentials, and strip any quotes
  const rawClientId = useTestCredentials
    ? (process.env.GOOGLE_CLIENT_ID_TEST || process.env.GOOGLE_CLIENT_ID_DEV || process.env.GOOGLE_CLIENT_ID)
    : (process.env.GOOGLE_CLIENT_ID_PROD || process.env.GOOGLE_CLIENT_ID);
  const GOOGLE_CLIENT_ID = rawClientId?.replace(/["']/g, '');

  const rawClientSecret = useTestCredentials
    ? (process.env.GOOGLE_CLIENT_SECRET_TEST || process.env.GOOGLE_CLIENT_SECRET_DEV || process.env.GOOGLE_CLIENT_SECRET)
    : (process.env.GOOGLE_CLIENT_SECRET_PROD || process.env.GOOGLE_CLIENT_SECRET);
  const GOOGLE_CLIENT_SECRET = rawClientSecret?.replace(/["']/g, '');

  console.log('Google OAuth Configuration:', {
    environment: process.env.NODE_ENV,
    usingTestCredentials: useTestCredentials,
    callbackUrl: CALLBACK_URL,
    clientId: GOOGLE_CLIENT_ID ? 'Loaded' : 'Missing',
    clientSecret: GOOGLE_CLIENT_SECRET ? 'Loaded' : 'Missing',
    customDomain: process.env.CUSTOM_DOMAIN,
  });

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Google OAuth credentials are not configured. Google login will not work.');
    console.error('For local development, please set one of these in your .env file:');
    console.error('- GOOGLE_CLIENT_ID_TEST and GOOGLE_CLIENT_SECRET_TEST');
    console.error('- GOOGLE_CLIENT_ID_DEV and GOOGLE_CLIENT_SECRET_DEV');
    console.error('- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    console.error('Current callback URL:', CALLBACK_URL);
    // Don't register the strategy if credentials are missing
  } else {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: CALLBACK_URL,
          passReqToCallback: true,
        },
        async (req: Request, accessToken: string, refreshToken: string, profile: any, done: any) => {
          try {
            console.log('Google OAuth callback received:', {
              profileId: profile.id,
              email: profile.emails?.[0]?.value,
              timestamp: new Date().toISOString()
            });

            if (!profile.emails || !profile.emails[0]?.value) {
              console.error('OAuth Error: No email found in Google profile', {
                profileId: profile.id,
                timestamp: new Date().toISOString()
              });
              return done(new Error('No email found in Google profile'));
            }

            const email = profile.emails[0].value;

            // Find existing user
            let [user] = await db
              .select()
              .from(users)
              .where(eq(users.email, email))
              .limit(1);

            // If user doesn't exist, create new user
            if (!user) {
              console.log('Creating new user from Google OAuth:', {
                email,
                displayName: profile.displayName,
                timestamp: new Date().toISOString()
              });

              await db.transaction(async (tx) => {
                const [newUser] = await tx
                  .insert(users)
                  .values({
                    email: email,
                    username: profile.displayName?.replace(/\s+/g, '_').toLowerCase() || email.split('@')[0],
                    name: profile.displayName || null,
                    emailVerified: true, // Google has already verified the email
                    password: crypto.randomBytes(32).toString('hex'), // Generate random password
                    subscriptionTier: 'free',
                    createdAt: new Date(),
                    updatedAt: new Date()
                  })
                  .returning();

                if (profile.photos?.[0]?.value) {
                  await tx.insert(healthStats).values({
                    userId: newUser.id,
                    profilePhotoUrl: profile.photos[0].value,
                  });
                }

                user = newUser;

                console.log('New user created successfully:', {
                  userId: user.id,
                  email: user.email,
                  timestamp: new Date().toISOString()
                });
              });
            }

            return done(null, user);
          } catch (error) {
            console.error('Google OAuth callback error:', error);
            return done(error);
          }
        }
      )
    );
  }

  // Google OAuth Routes
  app.get(
    '/auth/google',
    (req: Request, res: Response, next: NextFunction) => {
      const state = Buffer.from(JSON.stringify({ signup: req.query.signup === 'true' })).toString('base64');
      passport.authenticate('google', {
        scope: ['profile', 'email'],
        state
      })(req, res, next);
    }
  );

  app.get(
    '/auth/google/callback',
    (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate('google', (err: any, user: Express.User | false, info: any) => {
        if (err) {
          console.error('Google auth callback error:', err);
          return res.redirect('/auth?error=google_auth_failed');
        }
        if (!user) {
          console.log('Google auth failed, no user returned.', { info });
          return res.redirect('/auth?error=google_auth_failed');
        }
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error('Session login error after Google auth:', loginErr);
            return next(loginErr);
          }
          // Explicitly save the session before redirecting
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('Session save error:', saveErr);
              return next(saveErr);
            }
            console.log('User authenticated and session saved. Redirecting to /.');
            // Check for a plan stored in sessionStorage and redirect accordingly
            // This part is client-side logic, but we redirect to a generic place
            // and let the client handle it.
            res.redirect('/'); 
          });
        });
      })(req, res, next);
    }
  );

  // Local auth routes 
  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
      }

      const { email, username, password, stripeSessionId, purchaseIdentifier } = result.data;
      
      console.log('Registration request:', {
        username,
        email,
        hasStripeSession: !!stripeSessionId,
        hasPurchaseId: !!purchaseIdentifier,
        timestamp: new Date().toISOString()
      });

      // Check if user already exists with either email or username
      const [existingUser] = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.email, email),
            eq(users.username, username)
          )
        )
        .limit(1);

      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(400).send("Email already registered");
        }
        return res.status(400).send("Username already taken");
      }

      // Hash password
      const hashedPassword = await crypto.hash(password);

      // Set up default user values
      let userValues: any = {
        ...result.data,
        password: hashedPassword,
      };
      
      // Check if this user is registering after a payment (has stripeSessionId)
      if (stripeSessionId) {
        try {
          // Import Stripe to get the session
          const Stripe = require('stripe');
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          
          // Retrieve the checkout session
          const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
          
          if (session.payment_status === 'paid') {
            console.log('Found paid session for new user:', {
              sessionId: stripeSessionId,
              email,
              subscriptionId: session.subscription,
              timestamp: new Date().toISOString()
            });
            
            // Extract subscription information
            userValues.subscriptionTier = 'pro'; // Depends on your pricing, adjust as needed
            
            // If subscription was created, store subscription and customer IDs
            if (session.subscription) {
              // Get subscription details
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              userValues.stripeSubscriptionId = session.subscription;
              userValues.stripeCustomerId = session.customer;
              
              console.log('Added subscription info to new user:', {
                customerId: session.customer,
                subscriptionId: session.subscription,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            console.log('Stripe session not paid:', {
              sessionId: stripeSessionId,
              status: session.payment_status,
              timestamp: new Date().toISOString()
            });
            
            // Set up free tier for users who didn't complete payment
            userValues.subscriptionTier = 'free'; // Free tier with no trial end date
          }
        } catch (error) {
          console.error('Error processing Stripe session during registration:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            sessionId: stripeSessionId,
            timestamp: new Date().toISOString()
          });
          
          // Default to free tier if there's an error processing the session
          userValues.subscriptionTier = 'free';
        }
      } else {
        // For regular signups without payment, set up free tier
        userValues.subscriptionTier = 'free';
      }

      // Create user with appropriate status based on registration path
      const [newUser] = await db
        .insert(users)
        .values(userValues)
        .returning();

      // Send welcome email
      try {
        console.log('Attempting to send welcome email to:', email);
        const { sendWelcomeEmail } = require('./services/emailService');
        await sendWelcomeEmail(email, username);
        console.log('Welcome email sent successfully to:', email);
      } catch (error) {
        console.error('Failed to send welcome email:', error);
        const err = error as Error;
        console.error('Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack,
          response: (err as any).response?.body
        });
        // Don't block registration if email fails
      }

      req.login(newUser, (err) => {
        if (err) return next(err);
        return res.json({
          message: "Registration successful",
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            name: newUser.name,
            phoneNumber: newUser.phoneNumber,
            subscriptionTier: newUser.subscriptionTier,
          },
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: Express.User, info: IVerifyOptions) => {
      if (err) {
        console.error('Login error:', {
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        });
        return next(err);
      }

      if (!user) {
        return res.status(401).json({ error: info.message });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('Session login error:', {
            error: loginErr.message,
            stack: loginErr.stack,
            timestamp: new Date().toISOString()
          });
          return next(loginErr);
        }

        console.log('User logged in successfully:', {
          userId: user.id,
          email: user.email,
          sessionID: req.sessionID,
          timestamp: new Date().toISOString()
        });

        // Force session save before sending response
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return next(saveErr);
          }

          return res.json({
            message: "Login successful",
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              name: user.name,
              phoneNumber: user.phoneNumber,
              subscriptionTier: user.subscriptionTier,
            },
            redirectUrl: "/" // Add explicit redirect URL
          });
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    console.log('Logging out user:', {
      userId: req.user?.id,
      email: req.user?.email,
      timestamp: new Date().toISOString()
    });

    req.logout((err) => {
      if (err) {
        console.error('Logout error:', {
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        });
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // User info endpoint
  app.get("/api/user", (req, res) => {
    console.log('User info request:', {
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      userId: req.user?.id,
      sessionID: req.sessionID,
      session: req.session ? {
        cookie: req.session.cookie,
        passport: (req.session as any).passport
      } : 'No session',
      headers: {
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        referer: req.headers.referer
      },
      timestamp: new Date().toISOString()
    });

    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Debug endpoint to check session
  app.get("/api/debug/session", (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      hasSession: !!req.session,
      sessionID: req.sessionID,
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
      } : null,
    });
  });
}