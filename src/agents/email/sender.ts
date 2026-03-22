import { Resend } from 'resend';
import { config } from '../../config/index.js';

const resend = new Resend(config.RESEND_API_KEY);

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

export async function sendEmail(options: EmailOptions): Promise<string> {
  const { to, subject, body, replyTo, tags } = options;

  try {
    const response = await resend.emails.send({
      from: `${config.FROM_NAME} <${config.FROM_EMAIL}>`,
      to: [to],
      subject: subject,
      text: body,
      reply_to: replyTo || config.FROM_EMAIL,
      headers: {
        'X-Entity-Ref-ID': tags?.campaignId || '',
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.data?.id || 'sent';
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

// Validate email address format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check if email domain is deliverable (basic check)
export async function checkEmailDeliverability(email: string): Promise<{
  valid: boolean;
  reason?: string;
}> {
  // Basic validation
  if (!isValidEmail(email)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  // Check for disposable email domains
  const disposableDomains = [
    'tempmail.com',
    'throwaway.com',
    'mailinator.com',
    'guerrillamail.com',
    '10minutemail.com',
  ];

  const domain = email.split('@')[1].toLowerCase();
  if (disposableDomains.includes(domain)) {
    return { valid: false, reason: 'Disposable email domain' };
  }

  return { valid: true };
}

// Add unsubscribe footer to email
export function addUnsubscribeFooter(body: string, unsubscribeUrl: string): string {
  return `${body}

---
If you no longer wish to receive these emails, click here to unsubscribe: ${unsubscribeUrl}`;
}

// Generate tracking pixel URL (for open tracking)
export function generateTrackingPixel(emailLogId: string, baseUrl: string): string {
  return `${baseUrl}/api/track/open/${emailLogId}`;
}

// Generate tracked link
export function generateTrackedLink(
  originalUrl: string,
  emailLogId: string,
  baseUrl: string
): string {
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${baseUrl}/api/track/click/${emailLogId}?url=${encodedUrl}`;
}
