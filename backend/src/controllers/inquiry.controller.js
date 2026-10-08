import { Inquiry, Booth, ExhibitorProfile } from '../models/index.js';
import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/helpers.js';
import { loadVisibleExpo } from '../services/access.js';
import { notify } from '../services/notification.service.js';
import { emitToUser } from '../services/realtime.js';

const populateAll = (q) => q
  .populate('attendee', 'name email avatar company')
  .populate('exhibitor', 'name email company')
  .populate('expo', 'title');

const exhibitorCompany = async (userIds) => {
  const profiles = await ExhibitorProfile.find({ user: { $in: userIds } }).select('user companyName logo').lean();
  return new Map(profiles.map((p) => [String(p.user), p]));
};

async function loadParticipantInquiry(id, user) {
  assertObjectId(id, 'inquiry id');
  const inquiry = await populateAll(Inquiry.findById(id));
  if (!inquiry) throw ApiError.notFound('Inquiry not found');
  const uid = String(user._id);
  if (String(inquiry.attendee?._id) !== uid && String(inquiry.exhibitor?._id) !== uid) throw ApiError.notFound('Inquiry not found');
  return inquiry;
}

export const createInquiry = asyncHandler(async (req, res) => {
  const { expoId, exhibitorId, type, subject, message, appointmentAt } = req.body;
  await loadVisibleExpo(expoId, req.user);
  const hasBooth = await Booth.exists({ expo: expoId, exhibitor: exhibitorId, status: 'booked' });
  if (!hasBooth) throw ApiError.badRequest('That exhibitor is not exhibiting at this expo');
  const inquiry = await Inquiry.create({
    expo: expoId, attendee: req.user._id, exhibitor: exhibitorId, type, subject, appointmentAt,
    messages: [{ sender: req.user._id, body: message }],
  });
  notify(exhibitorId, {
    type: 'inquiry',
    title: type === 'appointment' ? `Appointment request from ${req.user.name}` : `New inquiry from ${req.user.name}`,
    body: subject, link: '/exhibitor/inquiries',
  });
  res.status(201).json({ success: true, data: { inquiry } });
});

export const listInquiries = asyncHandler(async (req, res) => {
  const filter = req.user.role === ROLES.EXHIBITOR ? { exhibitor: req.user._id } : { attendee: req.user._id };
  const items = await populateAll(Inquiry.find(filter).sort('-updatedAt').limit(100)).select('-messages').lean();
  const companies = await exhibitorCompany(items.map((i) => i.exhibitor?._id).filter(Boolean));
  res.json({ success: true, data: { items: items.map((i) => ({ ...i, company: companies.get(String(i.exhibitor?._id)) })) } });
});

export const getInquiry = asyncHandler(async (req, res) => {
  const inquiry = await loadParticipantInquiry(req.params.id, req.user);
  await inquiry.populate('messages.sender', 'name role');
  const companies = await exhibitorCompany([inquiry.exhibitor?._id]);
  res.json({ success: true, data: { inquiry: { ...inquiry.toObject(), company: companies.get(String(inquiry.exhibitor?._id)) } } });
});

export const addMessage = asyncHandler(async (req, res) => {
  const inquiry = await loadParticipantInquiry(req.params.id, req.user);
  inquiry.messages.push({ sender: req.user._id, body: req.body.body });
  await inquiry.save();
  const other = String(inquiry.attendee._id) === String(req.user._id) ? inquiry.exhibitor?._id : inquiry.attendee?._id;
  if (other) {
    notify(other, { type: 'inquiry', title: `New reply from ${req.user.name}`, body: inquiry.subject, link: req.user.role === ROLES.EXHIBITOR ? '/attendee/inquiries' : '/exhibitor/inquiries' });
    emitToUser(other, 'inquiry:updated', { inquiryId: inquiry._id });
  }
  res.status(201).json({ success: true, data: { message: inquiry.messages.at(-1) } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const inquiry = await loadParticipantInquiry(req.params.id, req.user);
  if (String(inquiry.exhibitor._id) !== String(req.user._id)) throw ApiError.forbidden('Only the exhibitor can change the status');
  inquiry.status = req.body.status;
  await inquiry.save();
  notify(inquiry.attendee._id, {
    type: 'inquiry',
    title: `Your ${inquiry.type} was ${req.body.status}`,
    body: inquiry.subject, link: '/attendee/inquiries',
  });
  emitToUser(inquiry.attendee._id, 'inquiry:updated', { inquiryId: inquiry._id });
  res.json({ success: true, data: { status: inquiry.status } });
});
