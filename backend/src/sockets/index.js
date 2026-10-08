import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { setIO } from '../services/realtime.js';
import { logger } from '../utils/logger.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Real-time layer. Public expo rooms (booth / schedule updates) are open to everyone;
 * private rooms (`user:<id>`, `admins`) require a valid access token.
 * For multi-instance deployments plug in @socket.io/redis-adapter here.
 */
export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e5,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // anonymous: public rooms only
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
      const user = await User.findById(payload.sub).select('role isActive').lean();
      if (user?.isActive) socket.data.user = { id: String(user._id), role: user.role };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user) {
      socket.join(`user:${user.id}`);
      if (user.role === 'admin') socket.join('admins');
    }
    socket.on('expo:join', (expoId) => { if (typeof expoId === 'string' && OBJECT_ID.test(expoId)) socket.join(`expo:${expoId}`); });
    socket.on('expo:leave', (expoId) => { if (typeof expoId === 'string') socket.leave(`expo:${expoId}`); });
  });

  setIO(io);
  logger.info('Socket.IO ready');
  return io;
}
