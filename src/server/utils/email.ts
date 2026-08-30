/**
 * Email Service
 * Email sending utilities (mock implementation for now)
 */

import nodemailer from 'nodemailer';

// Configuration
const SMTP_HOST = process.env["SMTP_HOST"] || '';
const SMTP_PORT = parseInt(process.env["SMTP_PORT"] || '587');
const SMTP_USER = process.env["SMTP_USER"] || '';
const SMTP_PASS = process.env["SMTP_PASS"] || '';
const SMTP_FROM = process.env["SMTP_FROM"] || 'noreply@eden.dev';
const NODE_ENV = process.env["NODE_ENV"] || 'development';

// Email templates
const templates: Record<string, { subject: string; html: (data: any) => string }> = {
  welcome: {
    subject: 'Welcome to EDEN - Visual AI Graph IDE',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f8fafc; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to EDEN</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name || 'there'},</p>
          <p>Thank you for signing up for EDEN - Visual AI Graph IDE with Ternary VM.</p>
          <p>Start building your first AI agent today!</p>
          <p><a href="${data.url || 'https://eden.dev'}" class="button">Get Started</a></p>
          <p>If you didn't create this account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} EDEN. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  },
  verification: {
    subject: 'Verify Your EDEN Account',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f8fafc; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #06b6d4; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Verify Your Account</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name || 'there'},</p>
          <p>Please click the button below to verify your EDEN account:</p>
          <p><a href="${data.verificationUrl}" class="button">Verify Account</a></p>
          <p>Or copy this link into your browser:</p>
          <p><code>${data.verificationUrl}</code></p>
          <p>This link will expire in 24 hours.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} EDEN. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  },
  passwordReset: {
    subject: 'Reset Your EDEN Password',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f8fafc; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name || 'there'},</p>
          <p>We received a request to reset your EDEN password. Click the button below to reset it:</p>
          <p><a href="${data.resetUrl}" class="button">Reset Password</a></p>
          <p>Or copy this link into your browser:</p>
          <p><code>${data.resetUrl}</code></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} EDEN. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  },
  notification: {
    subject: (data: any) => data.subject || 'EDEN Notification',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f8fafc; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>EDEN Notification</h1>
        </div>
        <div class="content">
          <p>Hello ${data.name || 'there'},</p>
          ${data.message}
          ${data.buttonText && data.buttonUrl ? `<p><a href="${data.buttonUrl}" class="button">${data.buttonText}</a></p>` : ''}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} EDEN. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
  },
};

// Email transporter
let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter
 */
function initializeTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  // Skip in test environment or if SMTP is not configured
  if (NODE_ENV === 'test' || !SMTP_HOST) {
    console.log('⚠️ Email service not configured. Using mock implementation.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: NODE_ENV === 'production',
      },
    });

    console.log('✅ Email transporter initialized');
    return transporter;
  } catch (error) {
    console.error('❌ Failed to initialize email transporter:', error);
    return null;
  }
}

/**
 * Send email
 */
export async function sendEmail(
  to: string | string[],
  template: string,
  data: any = {}
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // In development, log the email instead of sending
    if (NODE_ENV === 'development' || !transporter) {
      console.log(`[Email] To: ${to}`);
      console.log(`[Email] Template: ${template}`);
      console.log(`[Email] Data:`, data);
      return { success: true, messageId: 'mock-message-id' };
    }

    // Get template
    const templateConfig = templates[template];
    if (!templateConfig) {
      return { success: false, error: `Template '${template}' not found` };
    }

    // Get transporter
    const emailTransporter = initializeTransporter();
    if (!emailTransporter) {
      return { success: false, error: 'Email service not configured' };
    }

    // Prepare email options
    const subject = typeof templateConfig.subject === 'function' 
      ? templateConfig.subject(data) 
      : templateConfig.subject;
    const html = templateConfig.html(data);

    const mailOptions: nodemailer.SendMailOptions = {
      from: SMTP_FROM,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
    };

    // Send email
    const info = await emailTransporter.sendMail(mailOptions);

    console.log(`✅ Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(to: string, name: string, url?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail(to, 'welcome', { name, url });
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(to: string, name: string, verificationUrl: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail(to, 'verification', { name, verificationUrl });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail(to, 'passwordReset', { name, resetUrl });
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  to: string,
  name: string,
  subject: string,
  message: string,
  buttonText?: string,
  buttonUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail(to, 'notification', { name, subject, message, buttonText, buttonUrl });
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[\w.-]+@[\w.-]+\.[a-z]{2,}$/i;
  return emailRegex.test(email);
}

/**
 * Generate verification URL
 */
export function generateVerificationUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/auth/verify?token=${token}`;
}

/**
 * Generate password reset URL
 */
export function generatePasswordResetUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/auth/reset-password?token=${token}`;
}

export { templates, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM };
