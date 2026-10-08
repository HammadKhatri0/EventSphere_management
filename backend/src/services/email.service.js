import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const emailConfigured = Boolean(env.SMTP_HOST);

const transporter = emailConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** Sends an email; without SMTP configured the message is logged (development convenience). */
export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    logger.info(`[email not configured] To: ${to} | ${subject}\n${text}`);
    return { logged: true };
  }
  try {
    await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text, html: html || text });
    return { sent: true };
  } catch (err) {
    logger.error('Email delivery failed', err);
    return { sent: false };
  }
}

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const passwordResetEmail = (name, url) => ({
  subject: 'Reset your EventSphere password',
  text: `Hi ${name},\n\nUse the link below to reset your password. It expires in 30 minutes.\n${url}\n\nIf you did not request this, you can ignore this email.`,
  html: `<p>Hi ${esc(name)},</p><p>Use the button below to reset your password. The link expires in 30 minutes.</p><p><a href="${url}" style="background:#4F46E5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
});
