
import { sendEmail } from '../services/emailService';
import * as sgMail from '@sendgrid/mail';

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

describe('SendGrid Email Service', () => {
  test('should send an email successfully', async () => {
    // Arrange
    const emailData = {
      to: 'test@example.com',
      subject: 'Test Email',
      text: 'This is a test email',
      html: '<p>This is a test email</p>'
    };

    // Act
    const result = await sendEmail(emailData);

    // Assert
    expect(sgMail.send).toHaveBeenCalled();
    expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@example.com',
      subject: 'Test Email'
    }));
    expect(result).toBe(true);
  });

  test('should handle errors when sending emails', async () => {
    // Arrange
    const emailData = {
      to: 'test@example.com',
      subject: 'Error Test Email',
      text: 'This should fail',
      html: '<p>This should fail</p>'
    };

    // Mock a failure for this test
    (sgMail.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Send failed');
    });

    // Act & Assert
    await expect(async () => {
      await sendEmail(emailData);
    }).rejects.toThrow('Send failed');
  });
});
