import { Notification, User } from '../models/index.js';
import { ROLES } from '../config/constants.js';
import { emitToUser } from './realtime.js';
import { logger } from '../utils/logger.js';

/** Creates a persistent notification and pushes it to the user's live sockets. Never throws. */
export async function notify(userId, { type = 'info', title, body = '', link }) {
  try {
    const doc = await Notification.create({ user: userId, type, title, body, link });
    emitToUser(userId, 'notification:new', doc);
    return doc;
  } catch (err) {
    logger.error('notify failed', err);
    return null;
  }
}

export async function notifyMany(userIds, payload) {
  await Promise.all([...new Set(userIds.map(String))].map((id) => notify(id, payload)));
}

export async function notifyAdmins(payload) {
  const admins = await User.find({ role: ROLES.ADMIN, isActive: true }).select('_id').lean();
  await notifyMany(admins.map((a) => a._id), payload);
}
