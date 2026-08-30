/**
 * Utils Index
 * Export all utility functions
 */

export {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  isValidEmail,
  generateVerificationUrl,
  generatePasswordResetUrl,
  templates,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_FROM,
} from './email';
