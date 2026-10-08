/**
 * Sends a test email with the SMTP settings from .env.
 *   npm run test:email                 (sends to the SMTP_USER address or a placeholder)
 *   npm run test:email -- you@mail.com
 */
import { env } from '../config/env.js';
import { emailConfigured, sendMail } from '../services/email.service.js';

if (!emailConfigured) {
  console.error('SMTP is not configured: set SMTP_HOST (and SMTP_USER / SMTP_PASS) in backend/.env');
  process.exit(1);
}

const to = process.argv[2] || env.SMTP_USER || 'test@example.com';
console.log(`Sending via ${env.SMTP_HOST}:${env.SMTP_PORT} as ${env.SMTP_USER || '(no auth)'} ...`);
const result = await sendMail({
  to,
  subject: 'EventSphere SMTP test',
  text: 'If you can read this, EventSphere email delivery works.',
});
console.log(result.sent ? `Sent to ${to}. Check your inbox (Mailtrap: open your sandbox inbox).` : 'Failed - see the error logged above.');
process.exit(result.sent ? 0 : 1);
