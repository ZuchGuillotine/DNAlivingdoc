import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { type Express } from 'express';
import session from 'express-session';
import { db } from '@db';
import { users } from '@db/schema';
import { eq, or } from 'drizzle-orm';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Simple crypto functions
const crypto = {
  compare: async (suppliedPassword: string, storedPassword: string): Promise<boolean> => {
    if (storedPassword === 'google_oauth') return false;
    
    const [hashedPassword, salt] = storedPassword.split('.');
    if (!hashedPassword || !salt) return false;
    
    const hashedPasswordBuf = Buffer.from(hashedPassword, 'hex');
    const suppliedPasswordBuf = (await scryptAsync(suppliedPassword, salt, 64)) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  }
};

// Track if auth has been initialized
let authInitialized = false;

export function setupAuthentication(app: Express): void {
  if (authInitialized) {
    console.warn('Authentication already initialized, skipping duplicate setup');
    return;
  }

  console.log('Setting up SIMPLE authentication middleware...');

  // 1. Session middleware with memory store
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-this',
    name: 'stacktracker.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Always false for debugging
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    }
  }));
  console.log('Session middleware added (memory store)');

  // 2. Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());
  console.log('Passport middleware added');

  // 3. Passport serialization
  passport.serializeUser((user: any, done) => {
    console.log('Serializing user:', { userId: user.id });
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
        console.log('User not found during deserialization:', { id });
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      console.error('Deserialization error:', err);
      done(err);
    }
  });

  // 4. Local Strategy only
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          console.log('Local strategy login attempt:', { email });
          
          const [user] = await db
            .select()
            .from(users)
            .where(or(eq(users.email, email), eq(users.username, email)))
            .limit(1);

          if (!user) {
            console.log('User not found:', { email });
            return done(null, false, { message: 'Incorrect email or username.' });
          }

          if (!user.password || user.password === 'google_oauth') {
            return done(null, false, { 
              message: 'This account uses Google sign-in.' 
            });
          }

          const isValid = await crypto.compare(password, user.password);
          if (!isValid) {
            console.log('Invalid password for user:', { email });
            return done(null, false, { message: 'Incorrect password.' });
          }

          console.log('Login successful:', { userId: user.id, email });
          return done(null, user);
        } catch (err) {
          console.error('Local strategy error:', err);
          return done(err);
        }
      }
    )
  );

  authInitialized = true;
  console.log('SIMPLE Authentication setup complete');
}

export function isAuthInitialized(): boolean {
  return authInitialized;
} 