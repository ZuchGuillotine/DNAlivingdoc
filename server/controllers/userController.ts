import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { sendEmail } from '../services/emailService';
import { db } from '@db/index';
import { users } from '@db/schema';
import { eq } from 'drizzle-orm';
import stripeService from '../services/stripe';

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'Missing required fields',
        details: {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined
        }
      });
      return;
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');

    // Create new user with trial status
    const [user] = await db.insert(users).values({
      email,
      password, // Note: Password should be hashed before saving
      username: email.split('@')[0],
      verificationToken,
      emailVerified: false,
      isAdmin: false,
      subscriptionTier: 'trial',
      subscriptionId: null, // Explicitly set to null for trial users
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // Ensure trial status is set
    await stripeService.updateTrialStatus(user.id);

    // Send verification email
    const verificationUrl = `${process.env.APP_URL}/verify?token=${verificationToken}`;

    const subject = 'Verify Your StackTracker Account';
    const text = `Please verify your account by clicking the following link: ${verificationUrl}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to StackTracker!</h2>
        <p>Please verify your account to complete your registration.</p>
        <p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 4px;">
            Verify Account
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          ${verificationUrl}
        </p>
      </div>
    `.trim();

    await sendEmail({
      to: email,
      from: 'accounts@stacktracker.io', // Add the from field
      subject,
      text,
      html
    });

    console.log('Signup verification email sent:', {
      to: email,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({ 
      message: 'Signup successful. Please check your email to verify your account.',
      userId: user.id,
      requiresVerification: true
    });
  } catch (error) {
    console.error('Signup error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    next(error);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Invalid verification token' });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.verificationToken, token)
    });

    if (!user) {
      res.status(404).json({ error: 'Invalid verification token' });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: 'Account already verified' });
      return;
    }

    await db
      .update(users)
      .set({ 
        emailVerified: true, 
        verificationToken: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    next(error);
  }
}