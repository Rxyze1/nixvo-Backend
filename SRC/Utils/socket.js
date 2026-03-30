// Utils/socket.js

import { Server } from 'socket.io';
import jwt       from 'jsonwebtoken';
import User      from '../Models/USER-Auth/User-Auth.-Model.js';
import { registerCallHandlers } from './callSocketHandler.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *                   ⚡ SOCKET.IO — PRODUCTION CONFIG
 *
 *  ✔  JWT authentication middleware with lean DB query
 *  ✔  Multi-tab / multi-device presence (Set per user)
 *  ✔  Room-based emission — io.to(userId) across all tabs
 *  ✔  First-connection guard (no duplicate online broadcasts)
 *  ✔  Fully-offline detection on disconnect (last tab closed)
 *  ✔  Per-socket sliding-window rate limiter
 *  ✔  Input validation on every inbound event
 *  ✔  O(1) disconnect cleanup via reverse socket map
 *  ✔  Guard against double initialization
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Module-level state ───────────────────────────────────────

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Primary presence registry.
 * userId (string) → Set<socketId>
 *
 * A user is "online" iff the Set exists AND size > 0.
 * Supports multiple simultaneous sockets (multi-tab / multi-device).
 */
const connectedUsers = new Map();

/**
 * Reverse lookup for O(1) disconnect resolution.
 * socketId → userId
 */
const socketToUser = new Map();

/**
 * Per-socket rate-limit state.
 * socketId → { count: number, resetAt: number }
 */
const rateLimits = new Map();

// ─── Constants ────────────────────────────────────────────────

const CFG = Object.freeze({
  PING_TIMEOUT_MS     : 60_000,
  PING_INTERVAL_MS    : 25_000,
  MAX_PAYLOAD_BYTES   : 1_000_000, // 1 MB
  CONNECT_TIMEOUT_MS  : 10_000,
  RATE_WINDOW_MS      : 1_000,
  RATE_MAX_EVENTS     : 15,        // per socket per second
  MAX_STATUS_IDS      : 100,       // cap on get_online_status batch
});

// ═══════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════

const MONGO_ID_RE = /^[a-f\d]{24}$/i;

/** 24-char hex string — MongoDB ObjectId */
const isMongoId = (v) => typeof v === 'string' && MONGO_ID_RE.test(v);

/** Non-empty, non-whitespace string */
const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;

// ═══════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════

/**
 * Sliding-window rate limiter.
 * Returns true when the socket exceeds its event quota.
 *
 * @param {string} socketId
 * @returns {boolean}
 */
const isRateLimited = (socketId) => {
  const now   = Date.now();
  const state = rateLimits.get(socketId) ?? { count: 0, resetAt: now + CFG.RATE_WINDOW_MS };

  if (now > state.resetAt) {
    state.count   = 1;
    state.resetAt = now + CFG.RATE_WINDOW_MS;
  } else {
    state.count  += 1;
  }

  rateLimits.set(socketId, state);
  return state.count > CFG.RATE_MAX_EVENTS;
};

// ═══════════════════════════════════════════════════════════════
// PRESENCE HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Register a new socket connection for a user.
 *
 * @param   {string}  userId
 * @param   {string}  socketId
 * @returns {boolean} true → this is the user's FIRST active socket (first tab)
 */
const registerSocket = (userId, socketId) => {
  const isFirst = !connectedUsers.has(userId);
  if (isFirst) connectedUsers.set(userId, new Set());
  connectedUsers.get(userId).add(socketId);
  socketToUser.set(socketId, userId);
  return isFirst;
};

/**
 * Remove a socket and clean up all associated state.
 *
 * @param   {string}      socketId
 * @returns {string|null} userId when the user is now FULLY offline; null otherwise
 */
const unregisterSocket = (socketId) => {
  const userId = socketToUser.get(socketId);
  if (!userId) return null;

  // Always clean up rate-limit and reverse-lookup state
  socketToUser.delete(socketId);
  rateLimits.delete(socketId);

  const sockets = connectedUsers.get(userId);
  if (!sockets) return null;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    connectedUsers.delete(userId);
    return userId; // ← signals "fully offline"
  }

  return null; // ← user still has other active tabs
};

// ═══════════════════════════════════════════════════════════════
// DB HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Persist online/offline status.
 * Errors are caught internally — never throws.
 *
 * @param {string} userId
 * @param {'online'|'offline'} status
 */
const persistUserStatus = async (userId, status) => {
  try {
    await User.findByIdAndUpdate(userId, {
      onlineStatus : status,
      lastSeen     : new Date(),
    });
    console.log(`✅ Status persisted: ${userId} → ${status}`);
  } catch (err) {
    console.error(`❌ Status persist failed [${userId}]:`, err.message);
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅  initializeSocket
// ═══════════════════════════════════════════════════════════════

/**
 * Create and configure the Socket.IO server.
 * Safe to import anywhere — returns the existing instance on repeat calls.
 *
 * @param   {import('http').Server} server
 * @returns {import('socket.io').Server}
 */
export const initializeSocket = (server) => {
  if (io) {
    console.warn('⚠️  Socket.IO already initialized — returning existing instance');
    return io;
  }

  io = new Server(server, {
   // socket.js — initializeSocket()
cors: {
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:19006',
    'exp://10.26.205.107:8081',
    'http://10.26.205.107:8081',  // ← add this
  ],
  methods: ['GET', 'POST'],
  credentials: true,
},

    pingTimeout       : CFG.PING_TIMEOUT_MS,
    pingInterval      : CFG.PING_INTERVAL_MS,
    maxHttpBufferSize : CFG.MAX_PAYLOAD_BYTES,
    connectTimeout    : CFG.CONNECT_TIMEOUT_MS,
    transports        : ['websocket', 'polling'],
  });

  console.log('⚡ Socket.IO server created');

  // ═════════════════════════════════════════════════════════════
  // 🔐 AUTHENTICATION MIDDLEWARE
  // ═════════════════════════════════════════════════════════════

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) return next(new Error('AUTH_NO_TOKEN'));

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return next(new Error('AUTH_INVALID_TOKEN'));
      }

      if (!decoded?.id || !isMongoId(decoded.id)) {
        return next(new Error('AUTH_MALFORMED_PAYLOAD'));
      }

      // .lean() → plain JS object, avoids full Mongoose hydration on every connect
      const user = await User.findById(decoded.id)
        .select('_id fullname username userType status')
        .lean();

      if (!user)                    return next(new Error('AUTH_USER_NOT_FOUND'));
      if (user.status !== 'active') return next(new Error('AUTH_USER_INACTIVE'));

      socket.userId = user._id.toString();
      socket.user   = user;

      console.log(`🔐 Authenticated: ${user.fullname} [${user.userType}] → ${socket.id}`);
      next();

    } catch (err) {
      console.error('❌ Auth middleware error:', err.message);
      next(new Error('AUTH_INTERNAL_ERROR'));
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 📡 CONNECTION HANDLER
  // ═════════════════════════════════════════════════════════════

  io.on('connection', async (socket) => {
    const { userId, user } = socket;

    // ── Presence registration ─────────────────────────────────

    const isFirstTab = registerSocket(userId, socket.id);

    /**
     * Every socket joins the user's personal room.
     * All emit helpers use io.to(userId) — automatically reaches
     * every tab without storing individual socket IDs.
     */
    socket.join(userId);

    console.log(
      `\n🔌 Connected   | ${user.fullname} [${user.userType}]` +
      ` | socket=${socket.id}` +
      ` | activeTabs=${connectedUsers.get(userId)?.size ?? 1}`
    );

    // ── DB update + presence broadcast ───────────────────────
    // Only fires when the FIRST tab connects.
    // Subsequent tabs are silent — no duplicate 'user_online' events.

    if (isFirstTab) {
      await persistUserStatus(userId, 'online');

      socket.broadcast.emit('user_online', {
        userId,
        username  : user.username,
        fullname  : user.fullname,
        timestamp : new Date(),
      });
    }

    // ── Register call handlers ────────────────────────────────
    // NOTE: callSocketHandler.js must be updated to use
    //   io.to(userId)      instead of  io.to(connectedUsers.get(userId))
    //   isUserOnline(id)   instead of  connectedUsers.has(id)
    // because connectedUsers is now Map<userId, Set<socketId>>.

    registerCallHandlers(io, socket, { isUserOnline });

    // ═════════════════════════════════════════════════════════
    // 📨 join_conversation
    // ═════════════════════════════════════════════════════════

    socket.on('join_conversation', (conversationId) => {
      if (!isNonEmptyStr(conversationId)) return;
      if (isRateLimited(socket.id)) return;

      socket.join(conversationId);
      console.log(`👥 ${user.fullname} → joined conversation ${conversationId}`);

      socket.emit('conversation_joined', { conversationId, timestamp: new Date() });
    });

    // ═════════════════════════════════════════════════════════
    // 📨 leave_conversation
    // ═════════════════════════════════════════════════════════

    socket.on('leave_conversation', (conversationId) => {
      if (!isNonEmptyStr(conversationId)) return;

      socket.leave(conversationId);
      console.log(`👋 ${user.fullname} ← left conversation ${conversationId}`);
    });

    // ═════════════════════════════════════════════════════════
    // 📨 typing_start
    // ═════════════════════════════════════════════════════════

    socket.on('typing_start', ({ conversationId, recipientId } = {}) => {
      if (!isNonEmptyStr(conversationId)) return;
      if (isRateLimited(socket.id)) return;

      const payload = {
        conversationId,
        userId,
        username : user.username,
        fullname : user.fullname,
      };

      if (recipientId && isMongoId(recipientId)) {
        // DM — room-based, reaches all recipient tabs
        io.to(recipientId).emit('user_typing', payload);
      } else {
        // Group conversation — excludes the sender automatically
        socket.to(conversationId).emit('user_typing', payload);
      }
    });

    // ═════════════════════════════════════════════════════════
    // 📨 typing_stop
    // ═════════════════════════════════════════════════════════

    socket.on('typing_stop', ({ conversationId, recipientId } = {}) => {
      if (!isNonEmptyStr(conversationId)) return;
      if (isRateLimited(socket.id)) return;

      const payload = { conversationId, userId };

      if (recipientId && isMongoId(recipientId)) {
        io.to(recipientId).emit('user_stopped_typing', payload);
      } else {
        socket.to(conversationId).emit('user_stopped_typing', payload);
      }
    });

    // ═════════════════════════════════════════════════════════
    // 📨 message_delivered
    // ═════════════════════════════════════════════════════════

    socket.on('message_delivered', ({ messageId, conversationId, senderId } = {}) => {
      if (!isNonEmptyStr(messageId) || !isNonEmptyStr(conversationId)) return;
      if (!isMongoId(senderId)) return;

      // Room-based → receipt lands on ALL sender's tabs
      io.to(senderId).emit('message_status_update', {
        messageId,
        conversationId,
        status      : 'delivered',
        deliveredTo : userId,
        timestamp   : new Date(),
      });

      console.log(`📬 Delivery receipt: msg=${messageId} → sender=${senderId}`);
    });

    // ═════════════════════════════════════════════════════════
    // 📨 get_online_status
    // ═════════════════════════════════════════════════════════

    socket.on('get_online_status', ({ userIds } = {}) => {
      if (!Array.isArray(userIds)) return;

      // Clamp batch size and validate each ID before processing
      const safeIds  = userIds.slice(0, CFG.MAX_STATUS_IDS).filter(isMongoId);
      const statuses = Object.fromEntries(
        safeIds.map((id) => [id, isUserOnline(id) ? 'online' : 'offline'])
      );

      socket.emit('online_statuses', statuses);
    });

    // ═════════════════════════════════════════════════════════
    // 📨 request_online_users
    // ═════════════════════════════════════════════════════════

    socket.on('request_online_users', () => {
      const list = Array.from(connectedUsers.keys());
      socket.emit('online_users_list', list);
      console.log(`📋 ${user.fullname} → sent ${list.length} online user IDs`);
    });

    // ═════════════════════════════════════════════════════════
    // 📨 ping  (application-level keep-alive)
    // ═════════════════════════════════════════════════════════

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // ═════════════════════════════════════════════════════════
    // 🔌 disconnect
    // ═════════════════════════════════════════════════════════

    socket.on('disconnect', async (reason) => {
      console.log(
        `\n🔌 Disconnected | ${user.fullname}` +
        ` | socket=${socket.id} | reason=${reason}`
      );

      // unregisterSocket returns userId only when the LAST socket closes
      const fullyOfflineUserId = unregisterSocket(socket.id);

      if (fullyOfflineUserId) {
        // User closed their last tab — genuinely offline
        await persistUserStatus(fullyOfflineUserId, 'offline');

        socket.broadcast.emit('user_offline', {
          userId   : fullyOfflineUserId,
          username : user.username,
          fullname : user.fullname,
          lastSeen : new Date(),
        });

        console.log(`👻 ${user.fullname} → fully offline`);
      } else {
        const remaining = connectedUsers.get(userId)?.size ?? 0;
        console.log(`ℹ️  ${user.fullname} → still has ${remaining} active tab(s)`);
      }
    });

    // ═════════════════════════════════════════════════════════
    // ❌ error
    // ═════════════════════════════════════════════════════════

    socket.on('error', (err) => {
      console.error(`❌ Socket error [${user.fullname}]:`, err?.message ?? err);
    });
  });

  console.log('✅ Socket.IO fully configured\n');
  return io;
};

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Return the active Socket.IO instance.
 * Throws if called before initializeSocket().
 *
 * @returns {import('socket.io').Server}
 */
export const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized. Call initializeSocket() first.');
  return io;
};

/**
 * Emit an event to ALL active sockets of a user (all tabs / all devices).
 * Uses room-based io.to(userId) — no per-socket ID lookup needed.
 *
 * @param {string} userId
 * @param {string} event
 * @param {*}      data
 * @returns {boolean} false when user is offline or io is not ready
 */
export const emitToUser = (userId, event, data) => {
  if (!io) {
    console.error('❌ emitToUser: io not initialized');
    return false;
  }

  const uid = userId.toString();

  if (!isUserOnline(uid)) {
    console.log(`⚠️  emitToUser: ${uid} is offline — skipping '${event}'`);
    return false;
  }

  // Room hit — reaches all tabs for this user automatically
  io.to(uid).emit(event, data);
  console.log(`📤 emitToUser: '${event}' → ${uid}`);
  return true;
};

/**
 * Emit an event to a conversation room.
 * Optionally exclude a user (all their tabs) using their userId room.
 *
 * @param {string}      conversationId
 * @param {string}      event
 * @param {*}           data
 * @param {string|null} excludeUserId  Exclude this user's entire room (multi-tab safe)
 * @returns {boolean}
 */
export const emitToConversation = (conversationId, event, data, excludeUserId = null) => {
  if (!io) {
    console.error('❌ emitToConversation: io not initialized');
    return false;
  }

  const base   = io.to(conversationId);
  // .except() accepts room names — excludes ALL sockets in that room
  const target = excludeUserId ? base.except(excludeUserId.toString()) : base;

  target.emit(event, data);
  console.log(
    `📤 emitToConversation: '${event}' → ${conversationId}` +
    (excludeUserId ? ` (excluding ${excludeUserId})` : '')
  );
  return true;
};

/**
 * Returns true if the user has at least one active socket connection.
 *
 * @param  {string}  userId
 * @returns {boolean}
 */
export const isUserOnline = (userId) => {
  const sockets = connectedUsers.get(userId.toString());
  return !!(sockets && sockets.size > 0);
};

/**
 * Returns an array of all currently online user IDs.
 *
 * @returns {string[]}
 */
export const getOnlineUsers = () => Array.from(connectedUsers.keys());

/**
 * Server metrics snapshot.
 *
 * @returns {object}
 */
export const getSocketStats = () => {
  if (!io) return { initialized: false, onlineUsers: 0, connections: 0 };
  return {
    initialized : true,
    onlineUsers : connectedUsers.size,
    connections : io.engine.clientsCount,
    rooms       : io.sockets.adapter.rooms.size,
    timestamp   : new Date(),
  };
};

/**
 * Send a notification event to a user (all tabs).
 *
 * @param {string} userId
 * @param {object} notification
 */
export const sendNotification = (userId, notification) =>
  emitToUser(userId, 'notification', notification);

/**
 * Gracefully shut down Socket.IO and reset all in-memory state.
 */
export const shutdownSocket = () => {
  if (!io) return;

  console.log('🛑 Shutting down Socket.IO…');
  io.disconnectSockets(true);
  io.close(() => console.log('✅ Socket.IO closed'));

  connectedUsers.clear();
  socketToUser.clear();
  rateLimits.clear();
  io = null;
};

export default {
  initializeSocket,
  getIO,
  emitToUser,
  emitToConversation,
  isUserOnline,
  getOnlineUsers,
  getSocketStats,
  sendNotification,
  shutdownSocket,
};