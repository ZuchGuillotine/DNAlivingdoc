import { Request, Response, NextFunction } from 'express';

// Placeholder for future email integration
async function sendTwoFactorAuthEmail(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  res.status(501).json({ 
    message: "Email service not implemented",
    details: "Email functionality is currently unavailable"
  });
}

export { sendTwoFactorAuthEmail };