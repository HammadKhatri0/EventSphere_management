import { SessionRegistration } from '../models/index.js';
import { notify } from './notification.service.js';
import { logger } from '../utils/logger.js';

const TICK_MS = 30_000;

/**
 * Sends reminders for bookmarked / registered sessions.
 * Each reminder is claimed with an atomic findOneAndUpdate, so running several server
 * instances (horizontal scaling) never produces duplicate notifications.
 */
export async function processReminders() {
  let sent = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const reg = await SessionRegistration.findOneAndUpdate(
      { reminderSent: false, remindAt: { $ne: null, $lte: new Date() } },
      { $set: { reminderSent: true } },
      { returnDocument: 'after' }
    ).populate('session', 'title startTime location expo');
    if (!reg) break;
    if (reg.session && reg.session.startTime > new Date()) {
      await notify(reg.user, {
        type: 'reminder',
        title: `Starting soon: ${reg.session.title}`,
        body: `Begins in about ${reg.reminderMinutes >= 60 ? `${Math.round(reg.reminderMinutes / 60)} hour(s)` : `${reg.reminderMinutes} minutes`} - ${reg.session.location}.`,
        link: '/attendee/agenda',
      });
      sent += 1;
    }
  }
  return sent;
}

export function startReminderScheduler() {
  const timer = setInterval(() => processReminders().catch((e) => logger.error('reminder tick failed', e)), TICK_MS);
  timer.unref();
  return () => clearInterval(timer);
}
