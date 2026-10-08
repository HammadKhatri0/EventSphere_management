// Thin wrapper around socket.io so controllers can emit events without importing the server.
// All emits are no-ops until the socket layer is initialised (e.g. during tests/scripts).
let io = null;

export const setIO = (instance) => { io = instance; };

export const emitToExpo = (expoId, event, payload) => io?.to(`expo:${expoId}`).emit(event, payload);
export const emitToUser = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload);
export const emitToAdmins = (event, payload) => io?.to('admins').emit(event, payload);
