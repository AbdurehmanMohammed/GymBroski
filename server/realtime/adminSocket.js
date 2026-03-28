import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { setAdminIo } from './adminHub.js';

/**
 * App realtime: any valid JWT joins `user:<userId>`. Admins also join `admins`.
 * Events:
 * - `session:invalidate` → target user(s) must log out (delete / suspend).
 * - `admin:refresh` → admins refresh dashboards.
 */
export function attachAdminSocket(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
    transports: ['websocket', 'polling'],
  });

  setAdminIo(io);

  io.use((socket, next) => {
    (async () => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token || !process.env.JWT_SECRET) {
          next(new Error('Unauthorized'));
          return;
        }
        const decoded = jwt.verify(String(token), process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('role suspended');
        if (!user) {
          next(new Error('Unauthorized'));
          return;
        }
        if (user.suspended) {
          next(new Error('Forbidden'));
          return;
        }
        socket.data.userId = String(decoded.userId);
        socket.data.isAdmin = user.role === 'admin';
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    })();
  });

  io.on('connection', (socket) => {
    const uid = socket.data.userId;
    socket.join(`user:${uid}`);
    if (socket.data.isAdmin) {
      socket.join('admins');
    }
  });

  return io;
}
