import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { ROLES, MAX_FAILED_LOGINS, LOCK_MINUTES } from '../config/constants.js';
import { User, ExhibitorProfile, ExpoRegistration, SessionRegistration, Inquiry, Notification, Feedback, Application, Ticket, Booth, RefreshToken } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { startSession, rotateSession, endSession, revokeAllForUser, hashToken } from '../services/token.service.js';
import { sendMail, passwordResetEmail, emailConfigured } from '../services/email.service.js';
import { notifyAdmins } from '../services/notification.service.js';

const safeEqual = (a = '', b = '') => {
  const ha = hashToken(a); const hb = hashToken(b);
  return crypto.timingSafeEqual(Buffer.from(ha), Buffer.from(hb));
};
// Used to equalise response time when the email does not exist (prevents user enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(8).toString('hex'), 12);
const ROLE_LABEL = { admin: 'an organizer', exhibitor: 'an exhibitor', attendee: 'an attendee' };

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, company, phone, organizerCode, marketingConsent } = req.body;

  if (role === ROLES.ADMIN) {
    if (!env.ORGANIZER_INVITE_CODE || !organizerCode || !safeEqual(organizerCode, env.ORGANIZER_INVITE_CODE)) {
      throw ApiError.forbidden('A valid organizer access code is required to register as an organizer');
    }
  }
  if (role === ROLES.EXHIBITOR && !company) throw ApiError.badRequest('Validation failed', [{ field: 'company', message: 'Company name is required for exhibitors' }]);

  const user = await User.create({ name, email, password, role, company, phone, consentAt: new Date(), marketingConsent: !!marketingConsent });
  if (role === ROLES.EXHIBITOR) {
    await ExhibitorProfile.create({ user: user._id, companyName: company, contact: { email, phone } });
    notifyAdmins({ type: 'exhibitor', title: 'New exhibitor registered', body: `${company} (${name}) just signed up.`, link: '/admin/applications' });
  }

  const accessToken = await startSession(user, req, res);
  res.status(201).json({ success: true, data: { user, accessToken } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(423, `Account temporarily locked after too many failed attempts. Try again in ${mins} minute(s).`);
  }

  if (!(await user.comparePassword(password))) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
      user.failedLoginAttempts = 0;
    }
    await user.save({ validateBeforeSave: false });
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Please contact support.');
  if (role && role !== user.role) {
    throw ApiError.forbidden(`This account is registered as ${ROLE_LABEL[user.role]}. Select the correct portal to sign in.`);
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const accessToken = await startSession(user, req, res);
  res.json({ success: true, data: { user, accessToken } });
});

export const refresh = asyncHandler(async (req, res) => {
  const { userId, family } = await rotateSession(req, res);
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    await endSession(req, res);
    throw ApiError.unauthorized('Account is not available');
  }
  const accessToken = await startSession(user, req, res, family);
  res.json({ success: true, data: { user, accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  await endSession(req, res);
  res.json({ success: true, message: 'Signed out' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  const response = { success: true, message: 'If an account exists for that email, a reset link has been sent.' };
  if (!user) return res.json(response);

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + 30 * 60000);
  await user.save({ validateBeforeSave: false });

  const url = `${env.clientOrigins[0]}/reset-password?token=${token}`;
  await sendMail({ to: user.email, ...passwordResetEmail(user.name, url) });
  // Development convenience only: lets the flow be tested without an SMTP server.
  if (!env.isProd && !emailConfigured) response.devResetUrl = url;
  res.json(response);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    passwordResetToken: hashToken(req.body.token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();
  await revokeAllForUser(user._id);
  res.json({ success: true, message: 'Password updated. You can now sign in.' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

export const updateMe = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ success: true, data: { user: req.user } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  user.password = req.body.newPassword;
  await user.save();
  await revokeAllForUser(user._id);
  const accessToken = await startSession(user, req, res);
  res.json({ success: true, message: 'Password changed', data: { accessToken } });
});

/** GDPR: right of access / portability */
export const exportMyData = asyncHandler(async (req, res) => {
  const id = req.user._id;
  const [profile, expoRegistrations, sessions, inquiries, notifications, feedback, applications, tickets] = await Promise.all([
    ExhibitorProfile.findOne({ user: id }).lean(),
    ExpoRegistration.find({ user: id }).lean(),
    SessionRegistration.find({ user: id }).lean(),
    Inquiry.find({ $or: [{ attendee: id }, { exhibitor: id }] }).lean(),
    Notification.find({ user: id }).lean(),
    Feedback.find({ user: id }).lean(),
    Application.find({ exhibitor: id }).lean(),
    Ticket.find({ exhibitor: id }).lean(),
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="eventsphere-my-data.json"');
  res.json({ exportedAt: new Date(), user: req.user, profile, expoRegistrations, sessions, inquiries, notifications, feedback, applications, tickets });
});

/** GDPR: right to erasure. Removes personal data and frees any booths held. */
export const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.password))) throw ApiError.badRequest('Password is incorrect');
  if (user.role === ROLES.ADMIN && (await User.countDocuments({ role: ROLES.ADMIN, isActive: true })) <= 1) {
    throw ApiError.badRequest('You are the only organizer. Promote another organizer before deleting this account.');
  }
  const id = user._id;
  await Promise.all([
    Booth.updateMany({ exhibitor: id, status: { $in: ['reserved', 'booked'] } }, { $set: { status: 'available', exhibitor: null, application: null, showcase: {} }, $unset: { reservedAt: '' } }),
    ExhibitorProfile.deleteOne({ user: id }),
    ExpoRegistration.deleteMany({ user: id }),
    SessionRegistration.deleteMany({ user: id }),
    Notification.deleteMany({ user: id }),
    Feedback.deleteMany({ user: id }),
    Application.deleteMany({ exhibitor: id }),
    RefreshToken.deleteMany({ user: id }),
  ]);
  await User.deleteOne({ _id: id });
  await endSession(req, res);
  res.json({ success: true, message: 'Your account and personal data have been deleted.' });
});
