const sgMail = require('@sendgrid/mail');
// Consider updating to ES6 import:
// import sgMail from '@sendgrid/mail';

// Add proper error handling and timeout configuration
export const sendEmail = async (to: string, subject: string, content: string) => {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME,
      },
      subject,
      html: content,
    };

    // Add timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email request timeout')), 10000); // 10s timeout
    });

    // Race between SendGrid request and timeout
    const response = await Promise.race([
      sgMail.send(msg),
      timeoutPromise
    ]);

    return response;
  } catch (error) {
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}; 