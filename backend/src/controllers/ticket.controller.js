import { Ticket, User, Expo } from '../models/index.js';
import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId, escapeRegex, parsePagination, paginated } from '../utils/helpers.js';
import { notify, notifyAdmins } from '../services/notification.service.js';
import { emitToUser, emitToAdmins } from '../services/realtime.js';

const isAdmin = (u) => u.role === ROLES.ADMIN;

async function loadTicket(id, user) {
  assertObjectId(id, 'ticket id');
  const ticket = await Ticket.findById(id);
  if (!ticket || (!isAdmin(user) && String(ticket.exhibitor) !== String(user._id))) throw ApiError.notFound('Ticket not found');
  return ticket;
}

export const createTicket = asyncHandler(async (req, res) => {
  const { message, expoId, ...rest } = req.body;
  if (expoId && !(await Expo.exists({ _id: expoId }))) throw ApiError.badRequest('Unknown expo');
  const ticket = await Ticket.create({ ...rest, expo: expoId, exhibitor: req.user._id, messages: [{ sender: req.user._id, body: message }] });
  notifyAdmins({ type: 'ticket', title: `New support ticket: ${ticket.subject}`, body: `${req.user.company || req.user.name} · ${ticket.priority} priority`, link: '/admin/support' });
  emitToAdmins('ticket:new', { ticketId: ticket._id });
  res.status(201).json({ success: true, data: { ticket } });
});

export const listTickets = asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const pg = parsePagination(req.query);
  const filter = isAdmin(req.user) ? {} : { exhibitor: req.user._id };
  if (status) filter.status = status;
  if (q) filter.subject = new RegExp(escapeRegex(q), 'i');
  const [items, total, counts] = await Promise.all([
    Ticket.find(filter).sort({ updatedAt: -1 }).skip(pg.skip).limit(pg.limit).select('-messages').populate('exhibitor', 'name email company').populate('assignedTo', 'name').lean(),
    Ticket.countDocuments(filter),
    Ticket.aggregate([{ $match: isAdmin(req.user) ? {} : { exhibitor: req.user._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  res.json({ success: true, data: { ...paginated(items, total, pg), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) } });
});

export const getTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicket(req.params.id, req.user);
  await ticket.populate([{ path: 'exhibitor', select: 'name email company' }, { path: 'assignedTo', select: 'name' }, { path: 'messages.sender', select: 'name role' }]);
  res.json({ success: true, data: { ticket } });
});

export const addMessage = asyncHandler(async (req, res) => {
  const ticket = await loadTicket(req.params.id, req.user);
  if (ticket.status === 'closed') throw ApiError.badRequest('This ticket is closed');
  ticket.messages.push({ sender: req.user._id, body: req.body.body });
  if (isAdmin(req.user) && ticket.status === 'open') ticket.status = 'in_progress';
  if (!isAdmin(req.user) && ticket.status === 'resolved') ticket.status = 'open';
  await ticket.save();

  if (isAdmin(req.user)) {
    notify(ticket.exhibitor, { type: 'ticket', title: `Support replied: ${ticket.subject}`, body: req.body.body.slice(0, 120), link: '/exhibitor/support' });
    emitToUser(ticket.exhibitor, 'ticket:updated', { ticketId: ticket._id });
  } else {
    emitToAdmins('ticket:updated', { ticketId: ticket._id });
    if (ticket.assignedTo) notify(ticket.assignedTo, { type: 'ticket', title: `Reply on: ${ticket.subject}`, body: req.body.body.slice(0, 120), link: '/admin/support' });
  }
  res.status(201).json({ success: true, data: { message: ticket.messages.at(-1), status: ticket.status } });
});

export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicket(req.params.id, req.user);
  const { status, priority, assignedTo } = req.body;
  if (!isAdmin(req.user)) {
    // Exhibitors may only close/reopen their own tickets
    if (!status || !['closed', 'open'].includes(status) || priority || assignedTo !== undefined) throw ApiError.forbidden();
    ticket.status = status;
  } else {
    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assignedTo !== undefined) {
      if (assignedTo && !(await User.exists({ _id: assignedTo, role: ROLES.ADMIN }))) throw ApiError.badRequest('Assignee must be an organizer');
      ticket.assignedTo = assignedTo;
    }
  }
  await ticket.save();
  if (isAdmin(req.user) && status) {
    notify(ticket.exhibitor, { type: 'ticket', title: `Ticket ${status.replace('_', ' ')}: ${ticket.subject}`, link: '/exhibitor/support' });
    emitToUser(ticket.exhibitor, 'ticket:updated', { ticketId: ticket._id });
  }
  res.json({ success: true, data: { ticket } });
});
