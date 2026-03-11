'use strict';

const { Server } = require('socket.io');
const logger = require('./logger');
const { verifyAccessToken } = require('../helpers/token.helper');

let io = null;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Authentication Middleware ───────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // ─── Connection Handler ──────────────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} | User: ${socket.userId}`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // ─── Room Management ───────────────────────────────────────────────────
    socket.on('join:room', (roomId) => {
      socket.join(roomId);
      logger.debug(`Socket ${socket.id} joined room: ${roomId}`);
    });

    socket.on('leave:room', (roomId) => {
      socket.leave(roomId);
      logger.debug(`Socket ${socket.id} left room: ${roomId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error: ${socket.id}`, error);
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

function emitToUser(userId, event, data) {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

function emitToRoom(room, event, data) {
  if (io) io.to(room).emit(event, data);
}

function broadcast(event, data) {
  if (io) io.emit(event, data);
}

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToRoom,
  broadcast,
};
