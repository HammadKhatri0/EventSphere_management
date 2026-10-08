import { Conversation, Message, ExhibitorProfile, Application, User } from '../models/index.js';
import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/helpers.js';
import { emitToUser } from '../services/realtime.js';
import { notify } from '../services/notification.service.js';

const pairKey = (a, b) => [String(a), String(b)].sort().join(':');

async function loadConversation(id, user) {
  assertObjectId(id, 'conversation id');
  const convo = await Conversation.findById(id);
  if (!convo || !convo.participants.some((p) => String(p) === String(user._id))) throw ApiError.notFound('Conversation not found');
  return convo;
}

export const listConversations = asyncHandler(async (req, res) => {
  const convos = await Conversation.find({ participants: req.user._id }).sort('-lastAt').limit(100).lean();
  const otherIds = convos.map((c) => c.participants.find((p) => String(p) !== String(req.user._id)));
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: otherIds } }).select('name').lean(),
    ExhibitorProfile.find({ user: { $in: otherIds } }).select('user companyName logo').lean(),
  ]);
  const uMap = new Map(users.map((u) => [String(u._id), u]));
  const pMap = new Map(profiles.map((p) => [String(p.user), p]));
  const items = convos.map((c, i) => ({
    _id: c._id, lastMessage: c.lastMessage, lastAt: c.lastAt,
    unread: c.unread?.[String(req.user._id)] || 0,
    with: { userId: otherIds[i], name: uMap.get(String(otherIds[i]))?.name || 'Deleted user', companyName: pMap.get(String(otherIds[i]))?.companyName, logo: pMap.get(String(otherIds[i]))?.logo },
  }));
  res.json({ success: true, data: { items } });
});

/** Exhibitors may only message other exhibitors that share an approved expo with them. */
export const startConversation = asyncHandler(async (req, res) => {
  const other = req.body.userId;
  if (String(other) === String(req.user._id)) throw ApiError.badRequest('You cannot message yourself');
  const target = await User.findOne({ _id: other, role: ROLES.EXHIBITOR, isActive: true }).select('_id').lean();
  if (!target) throw ApiError.notFound('Exhibitor not found');

  const mine = await Application.find({ exhibitor: req.user._id, status: 'approved' }).select('expo').lean();
  const shared = await Application.exists({ exhibitor: other, status: 'approved', expo: { $in: mine.map((a) => a.expo) } });
  if (!shared) throw ApiError.forbidden('You can only message exhibitors taking part in the same expo');

  const key = pairKey(req.user._id, other);
  const convo = await Conversation.findOneAndUpdate(
    { pairKey: key },
    { $setOnInsert: { pairKey: key, participants: [req.user._id, other] } },
    { returnDocument: 'after', upsert: true }
  );
  res.status(201).json({ success: true, data: { conversationId: convo._id } });
});

export const getMessages = asyncHandler(async (req, res) => {
  const convo = await loadConversation(req.params.id, req.user);
  const messages = await Message.find({ conversation: convo._id }).sort('-createdAt').limit(200).lean();
  if (convo.unread?.get(String(req.user._id))) {
    convo.unread.set(String(req.user._id), 0);
    await convo.save();
  }
  res.json({ success: true, data: { items: messages.reverse() } });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const convo = await loadConversation(req.params.id, req.user);
  const message = await Message.create({ conversation: convo._id, sender: req.user._id, body: req.body.body });
  const recipient = convo.participants.find((p) => String(p) !== String(req.user._id));

  await Conversation.updateOne({ _id: convo._id }, { $set: { lastMessage: req.body.body.slice(0, 120), lastAt: message.createdAt }, $inc: { [`unread.${recipient}`]: 1 } });
  emitToUser(recipient, 'message:new', { conversationId: convo._id, message });
  emitToUser(req.user._id, 'message:new', { conversationId: convo._id, message });
  notify(recipient, { type: 'message', title: `New message from ${req.user.company || req.user.name}`, body: req.body.body.slice(0, 100), link: '/exhibitor/messages' });
  res.status(201).json({ success: true, data: { message } });
});
