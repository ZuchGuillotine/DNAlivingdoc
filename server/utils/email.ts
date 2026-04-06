
import { sendEmail } from '../services/emailService';
import logger from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends a verification email to a new user.
 */
export async function sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
  const verificationUrl = `${process.env.APP_BASE_URL}/verify-email?token=${verificationToken}`;

  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Verify Your Email Address',
    html: `
      <p>Thank you for signing up!</p>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you did not sign up, please ignore this email.</p>
    `,
  };

  try {
    await sendEmail(msg);
    logger.info(`Verification email sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send verification email to ${to}: ${error}`);
    throw error;
  }
}

/**
 * Sends a 2FA code via email.
 */
export async function send2FACodeEmail(to: string, code: string): Promise<void> {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Your Two-Factor Authentication Code',
    html: `
      <p>Your Two-Factor Authentication code is: <strong>${code}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `,
  };

  try {
    await sendEmail(msg);
    logger.info(`2FA code sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send 2FA code email to ${to}: ${error}`);
    throw error;
  }
}

/**
 * Sends a password reset email.
 */
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env.APP_BASE_URL}/reset-password?token=${resetToken}`;

  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Reset Your Password',
    html: `
      <p>You requested to reset your password.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  };

  try {
    await sendEmail(msg);
    logger.info(`Password reset email sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send password reset email to ${to}: ${error}`);
    throw error;
  }
}

/**
 * Sends a welcome email after successful registration.
 */
export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Welcome to Stack Tracker!',
    html: `
      <h1>Welcome to Stack Tracker, ${username}!</h1>
      <p>Thank you for joining our community. Here's what you can do next:</p>
      <ul>
        <li>Complete your profile</li>
        <li>Add your supplements</li>
        <li>Track your health metrics</li>
        <li>Set up reminders</li>
      </ul>
      <p>If you have any questions, our support team is here to help!</p>
    `,
  };

  try {
    await sendEmail(msg);
    logger.info(`Welcome email sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send welcome email to ${to}: ${error}`);
    throw error;
  }
}

/**
 * Sends a notification about suspicious login activity.
 */
export async function sendSecurityAlertEmail(to: string, location: string, device: string): Promise<void> {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Security Alert - New Login Detected',
    html: `
      <p>We detected a new login to your Stack Tracker account.</p>
      <p>Location: ${location}</p>
      <p>Device: ${device}</p>
      <p>If this wasn't you, please reset your password immediately.</p>
    `,
  };

  try {
    await sendEmail(msg);
    logger.info(`Security alert email sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send security alert email to ${to}: ${error}`);
    throw error;
  }
}

export function generateVerificationToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}
