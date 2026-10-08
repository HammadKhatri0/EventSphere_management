import { io } from 'socket.io-client';
import { getAccessToken, ASSET_BASE } from './api.js';

let socket = null;
const joined = new Set();

/** One shared websocket. The token is read at (re)connect time so refreshed tokens are used automatically. */
export function getSocket() {
  if (!socket) {
    socket = io(ASSET_BASE || undefined, {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 8000,
      auth: (cb) => cb({ token: getAccessToken() }),
    });
    // re-join expo rooms after a reconnect
    socket.on('connect', () => joined.forEach((id) => socket.emit('expo:join', id)));
  }
  return socket;
}

export const connectSocket = () => { const s = getSocket(); if (!s.connected) s.connect(); return s; };
export const disconnectSocket = () => { socket?.disconnect(); joined.clear(); };
/** Force a reconnect so the server sees the current user (after login / logout). */
export const reconnectSocket = () => { const s = getSocket(); s.disconnect(); s.connect(); };

export function joinExpo(expoId) {
  if (!expoId) return () => {};
  joined.add(expoId);
  const s = connectSocket();
  if (s.connected) s.emit('expo:join', expoId);
  return () => { joined.delete(expoId); socket?.emit('expo:leave', expoId); };
}
