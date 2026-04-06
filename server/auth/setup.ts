/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 13/06/2025 - 20:59:39
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 13/06/2025
    * - Author          : 
    * - Modification    : 
**/
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import { type Express } from 'express';
import session from 'express-session';
import path from 'path';
import { db } from '@db';
import { users, healthStats } from '@db/schema';
import { eq, or } from 'drizzle-orm';
import { authConfig } from '../config/auth.config';
import { crypto } from './crypto';
import type { User } from '../types/user';

// Extend Express.User to include our custom fields
declare global {
  namespace Express {
    interface User extends Omit<import('../types/user').User, 'password'> {}
  }
}

// Track if auth has been initialized to prevent double initialization
let authInitialized = false;

export async function setupAuthentication(app: Express): Promise<void> {
  if (authInitialized) {
    console.warn('Authentication already initialized, skipping duplicate setup');
    return;
  }

  console.log('Setting up authentication middleware...');

  // 1. Session middleware (must come before passport)
  let sessionStore: any;
  
  // Try to use file store in production, memory store in development
  if (process.env.NODE_ENV === 'production') {
    try {
      // Dynamic import for ESM compatibility
      const fileStoreModule = await import('session-file-store');
      const FileStore = fileStoreModule.default(session);
      
      sessionStore = new FileStore({
        path: path.join(process.cwd(), '.sessions'),
        ttl: 86400, // 24 hours in seconds
        retries: 0,
        reapInterval: 3600, // Clean up expired sessions every hour
        logFn: () => {} // Quiet in production
      });
      
      console.log('Using file-based session store');
    } catch (error) {
      console.warn('Could not load session-file-store, using memory store:', error);
    }
  } else {
    console.log('Development mode: Using memory session store');
  }

  const sessionConfig: any = {
    ...authConfig.session,
    store: sessionStore // undefined will use memory store
  };

  app.use(session(sessionConfig));

  // 2. Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // 3. Passport serialization
  passport.serializeUser((user, done) => {
    const u = user as User;
    console.log('Serializing user:', { userId: u.id, timestamp: new Date().toISOString() });
    done(null, u.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log('User not found during deserialization:', { id });
        return done(null, false);
      }

      // Map database fields to match the User interface
      const mappedUser: User = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name ?? null,
        phoneNumber: user.phoneNumber ?? null,
        subscriptionTier: user.subscriptionTier,
        isAdmin: user.isAdmin,
        trialEndsAt: null, // Not in database schema
        stripeCustomerId: user.stripeCustomerId ?? null,
        stripeSubscriptionId: user.subscriptionId ?? null,
        emailVerified: user.emailVerified,
        password: user.password,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      done(null, mappedUser);
    } catch (err) {
      console.error('Deserialization error:', err);
      done(err);
    }
  });

  // 4. Local Strategy
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

          // Check if user signed up with Google
          if (!user.password || user.password === 'google_oauth') {
            return done(null, false, { 
              message: 'This account uses Google sign-in. Please use the "Sign in with Google" button.' 
            });
          }

          const isValid = await crypto.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: 'Incorrect password.' });
          }

          // Map database fields to match the User interface
          const mappedUser: User = {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name ?? null,
            phoneNumber: user.phoneNumber ?? null,
            subscriptionTier: user.subscriptionTier,
            isAdmin: user.isAdmin,
            trialEndsAt: null,
            stripeCustomerId: user.stripeCustomerId ?? null,
            stripeSubscriptionId: user.subscriptionId ?? null,
            emailVerified: user.emailVerified,
            password: user.password,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          };

          return done(null, mappedUser);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // 5. Google Strategy (only if credentials are configured)
  if (authConfig.google.clientId && authConfig.google.clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: authConfig.google.clientId,
          clientSecret: authConfig.google.clientSecret,
          callbackURL: authConfig.google.callbackURL,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            if (!profile.emails?.[0]?.value) {
              return done(new Error('No email found in Google profile'));
            }

            const email = profile.emails[0].value;

            // Check for existing user
            let [user] = await db
              .select()
              .from(users)
              .where(eq(users.email, email))
              .limit(1);

            if (!user) {
              // Create new user
              await db.transaction(async (tx) => {
                const [newUser] = await tx
                  .insert(users)
                  .values({
                    email,
                    username: profile.displayName?.replace(/\s+/g, '_').toLowerCase() || email.split('@')[0],
                    name: profile.displayName || null,
                    emailVerified: true,
                    password: 'google_oauth', // Special marker for OAuth users
                    subscriptionTier: 'free',
                    createdAt: new Date(),
                    updatedAt: new Date()
                  })
                  .returning();

                // Add profile photo if available
                if (profile.photos?.[0]?.value) {
                  await tx.insert(healthStats).values({
                    userId: newUser.id,
                    profilePhotoUrl: profile.photos[0].value,
                  });
                }

                user = newUser;
              });

              console.log('Created new user via Google OAuth:', { userId: user.id, email });
            } else if (user.password && user.password !== 'google_oauth') {
              // User exists with email/password auth
              return done(null, false, { 
                message: 'An account with this email already exists. Please sign in with your email and password.' 
              });
            }

            // Map database fields to match the User interface
            const mappedUser: User = {
              id: user.id,
              username: user.username,
              email: user.email,
              name: user.name ?? null,
              phoneNumber: user.phoneNumber ?? null,
              subscriptionTier: user.subscriptionTier,
              isAdmin: user.isAdmin,
              trialEndsAt: null,
              stripeCustomerId: user.stripeCustomerId ?? null,
              stripeSubscriptionId: user.subscriptionId ?? null,
              emailVerified: user.emailVerified,
              password: user.password,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            };

            return done(null, mappedUser);
          } catch (error) {
            console.error('Google OAuth error:', error);
            return done(error);
          }
        }
      )
    );
  } else {
    console.warn('Google OAuth not configured - missing client ID or secret');
  }

  authInitialized = true;
  console.log('Authentication setup complete');
}

// Export a function to check if auth is initialized
export function isAuthInitialized(): boolean {
  return authInitialized;
} 