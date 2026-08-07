const { Server } = require('socket.io');
const { verifyToken } = require('./token');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });
  io.on('connection', (socket) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    try {
      const payload = verifyToken(token);
      socket.join(`user:${payload.id}`);
    } catch {
      socket.disconnect(true);
    }
  });
  return io;
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initSocket, emitToUser };
