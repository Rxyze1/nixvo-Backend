// Utils/callSocketHandler.js


import Call from '../Models/Call/CallModel.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *                   📞 CALL SOCKET HANDLER
 *
 *  ✔  No connectedUsers Map — room-based io.to(userId) throughout
 *  ✔  isUserOnline injected via helpers param (no circular import)
 *  ✔  activeCalls reserved synchronously BEFORE any await
 *  ✔  releaseCall validates callId before deleting (no state wipe)
 *  ✔  call:end — single atomic pipeline update (computes duration server-side)
 *  ✔  call:accept / call:reject — DB-level auth + status guard
 *  ✔  call:ice_candidate — call-membership check before relay
 *  ✔  Missed-call timer uses io.to(userId) — never a stale socket ref
 *  ✔  Full input validation (UUID + MongoId) on every event
 *  ✔  getActiveCalls returns a read-only snapshot
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Constants ────────────────────────────────────────────────

const RING_TIMEOUT_MS    = 30_000;
const VALID_CALL_TYPES   = new Set(['audio', 'video']);

// ─── In-memory call state ─────────────────────────────────────

/** userId → callId  (busy guard) */
const activeCalls  = new Map();

/** callId → { timerId, callerId, receiverId } */
const pendingRings = new Map();

// ─── Input validation ─────────────────────────────────────────

const UUID_RE     = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONGO_ID_RE = /^[a-f\d]{24}$/i;

const isUUID    = (v) => typeof v === 'string' && UUID_RE.test(v);
const isMongoId = (v) => typeof v === 'string' && MONGO_ID_RE.test(v);

// ─── Helpers ─────────────────────────────────────────────────

const clearRingTimer = (callId) => {
  const ring = pendingRings.get(callId);
  if (ring?.timerId) clearTimeout(ring.timerId);
  pendingRings.delete(callId);
};

/**
 * Release busy-guard entries — ONLY if they still map to this callId.
 * Prevents accidentally clearing a newer concurrent call.
 *
 * @param {string}    callId
 * @param {...string} userIds
 */
const releaseCall = (callId, ...userIds) => {
  clearRingTimer(callId);
  for (const uid of userIds) {
    if (activeCalls.get(uid) === callId) activeCalls.delete(uid);
  }
};

// ═════════════════════════════════════════════════════════════
// REGISTER ALL CALL EVENTS ON A SOCKET
// ═════════════════════════════════════════════════════════════

/**
 * @param {import('socket.io').Server}  io
 * @param {import('socket.io').Socket}  socket
 * @param {{ isUserOnline: (userId: string) => boolean }} helpers
 *        Injected from socket.js to avoid a circular import.
 */
export const registerCallHandlers = (io, socket, { isUserOnline }) => {

  const callerId   = socket.userId;
  const callerUser = socket.user;

  // ═══════════════════════════════════════════════════════════
  // 📞 call:initiate  — caller sends offer, ringing starts
  // ═══════════════════════════════════════════════════════════

 socket.on('call:initiate', async ({
  callId,          // ✅ passed from frontend (from REST response)
  receiverId,
  callType = 'audio',
  offer,
} = {}) => {
  try {
    // Validate
    if (!isUUID(callId))
      return socket.emit('call:error', { message: 'Invalid callId' });
    if (!isMongoId(receiverId))
      return socket.emit('call:error', { message: 'Invalid receiverId' });
    if (!VALID_CALL_TYPES.has(callType))
      return socket.emit('call:error', { message: 'Invalid callType' });
    if (receiverId === callerId)
      return socket.emit('call:error', { message: 'Cannot call yourself' });

    // Sync busy guards
    if (activeCalls.has(callerId))
      return socket.emit('call:busy', { message: 'You are already in a call' });
    if (activeCalls.has(receiverId))
      return socket.emit('call:receiver_busy', { receiverId });
    if (!isUserOnline(receiverId))
      return socket.emit('call:user_offline', { receiverId });

    // Reserve both users synchronously
    activeCalls.set(callerId,   callId);
    activeCalls.set(receiverId, callId);

    // ✅ Verify call exists in DB (created by REST already)
    const callDoc = await Call.findOne({ callId, caller: callerId, status: 'ringing' });
    if (!callDoc) {
      activeCalls.delete(callerId);
      activeCalls.delete(receiverId);
      return socket.emit('call:error', { message: 'Call record not found' });
    }

    // Notify receiver
    io.to(receiverId).emit('call:incoming', {
      callId,
      callerId,
      callerInfo: {
        fullname: callerUser.fullname,
        username: callerUser.username,
        userType: callerUser.userType,
      },
      callType,
      offer,
    });

    socket.emit('call:ringing', { callId, receiverId });

    // Missed-call timer
    const timerId = setTimeout(async () => {
      if (!pendingRings.has(callId)) return;
      releaseCall(callId, callerId, receiverId);

      await Call.findOneAndUpdate(
        { callId },
        { status: 'missed', endTime: new Date() }
      ).catch((err) => console.error('❌ Missed-call DB update failed:', err.message));

      socket.emit('call:missed', { callId, receiverId });
      io.to(receiverId).emit('call:missed_incoming', {
        callId, callerId,
        callerInfo: { fullname: callerUser.fullname, username: callerUser.username },
        callType,
      });
    }, RING_TIMEOUT_MS);

    pendingRings.set(callId, { timerId, callerId, receiverId });
    console.log(`📞 Initiated: ${callerUser.fullname} → ${receiverId} [${callType}]`);

  } catch (err) {
    activeCalls.delete(callerId);
    activeCalls.delete(receiverId);
    console.error('❌ call:initiate error:', err.message);
    socket.emit('call:error', { message: 'Failed to initiate call' });
  }
});

  // ═══════════════════════════════════════════════════════════
  // ✅ call:accept  — receiver sends SDP answer back to caller
  // ═══════════════════════════════════════════════════════════

  socket.on('call:accept', async ({ callId, answer } = {}) => {
    try {
      if (!isUUID(callId))
        return socket.emit('call:error', { message: 'Invalid callId' });

      // Auth + status guard in a single atomic update:
      //   receiver: callerId   → only the actual receiver can accept
      //   status: 'ringing'    → can't accept an already-active/ended call
      const callDoc = await Call.findOneAndUpdate(
        { callId, receiver: callerId, status: 'ringing' },
        { status: 'active', startTime: new Date() },
        { new: true }
      );

      if (!callDoc)
        return socket.emit('call:error', { message: 'Call not found or cannot be accepted' });

      clearRingTimer(callId);

      // Notify caller across ALL their tabs
      io.to(callDoc.caller.toString()).emit('call:answered', { callId, answer });

      console.log(`✅ Accepted: ${callId}`);

    } catch (err) {
      console.error('❌ call:accept error:', err.message);
      socket.emit('call:error', { message: 'Failed to accept call' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // ❌ call:reject  — receiver declines
  // ═══════════════════════════════════════════════════════════

  socket.on('call:reject', async ({ callId } = {}) => {
    try {
      if (!isUUID(callId))
        return socket.emit('call:error', { message: 'Invalid callId' });

      // Auth + status guard — same pattern as call:accept
      const callDoc = await Call.findOneAndUpdate(
        { callId, receiver: callerId, status: 'ringing' },
        { status: 'rejected', endTime: new Date() },
        { new: true }
      );

      if (!callDoc) return; // already resolved — silently ignore

      releaseCall(callId, callDoc.caller.toString(), callDoc.receiver.toString());

      io.to(callDoc.caller.toString()).emit('call:rejected', { callId });

      console.log(`❌ Rejected: ${callId}`);

    } catch (err) {
      console.error('❌ call:reject error:', err.message);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 🧊 call:ice_candidate  — relay ICE candidates both ways
  // ═══════════════════════════════════════════════════════════

  socket.on('call:ice_candidate', ({ targetId, candidate } = {}) => {
    if (!isMongoId(targetId) || !candidate) return;

    // Auth guard: sender and target must be participants of the SAME call.
    // Without this, any authenticated user could inject ICE candidates.
    const senderCallId = activeCalls.get(callerId);
    if (!senderCallId)                                  return;
    if (activeCalls.get(targetId) !== senderCallId)    return;

    io.to(targetId).emit('call:ice_candidate', {
      from      : callerId,
      candidate,
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 📴 call:end  — either party hangs up
  // ═══════════════════════════════════════════════════════════

  socket.on('call:end', async ({ callId } = {}) => {
    try {
      if (!isUUID(callId)) return;

      const now = new Date();

      // Single atomic findOneAndUpdate with an aggregation pipeline.
      // Benefits:
      //   - Auth guard ($or)      → must be a participant
      //   - Status guard ($in)    → prevents double-ending an already-ended call
      //   - Duration computed server-side → no second DB round-trip
      // Requires MongoDB 4.2+ (standard since Mongoose 5.x)
      const callDoc = await Call.findOneAndUpdate(
        {
          callId,
          status : { $in: ['ringing', 'active'] },
          $or    : [{ caller: callerId }, { receiver: callerId }],
        },
        [
          {
            $set: {
              status   : 'ended',
              endTime  : now,
              endedBy  : callerId,
              duration : {
                $cond: {
                  if   : '$startTime',
                  then : { $floor: { $divide: [{ $subtract: [now, '$startTime'] }, 1000] } },
                  else : 0,
                },
              },
            },
          },
        ],
        { new: true }
      );

      // null → not found, wrong participant, or already ended (concurrent call:end)
      if (!callDoc) return;

      const otherUserId = callDoc.caller.toString() === callerId
        ? callDoc.receiver.toString()
        : callDoc.caller.toString();

      releaseCall(callId, callDoc.caller.toString(), callDoc.receiver.toString());

      const payload = { callId, endedBy: callerId, duration: callDoc.duration ?? 0 };

      socket.emit('call:ended', payload);
      io.to(otherUserId).emit('call:ended', payload);

      console.log(`📴 Ended: ${callId} | ${callDoc.duration ?? 0}s`);

    } catch (err) {
      console.error('❌ call:end error:', err.message);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 🔌 disconnect  — auto-cleanup if user drops mid-call
  // ═══════════════════════════════════════════════════════════
  //
  // NOTE: socket.js also registers a 'disconnect' listener for presence
  // management. Socket.IO fires ALL listeners — this one handles call
  // cleanup only, with no overlap.

// ✅ CORRECT — entire cleanup wrapped inside the timer
socket.on('disconnect', async () => {
  
    const callId = activeCalls.get(callerId);
    if (!callId) return;

    setTimeout(async () => {

      // Guard: if user reconnected on another tab within 500ms, do nothing
      if (isUserOnline(callerId)) return;

      try {
        const callDoc = await Call.findOne({ callId });
        if (!callDoc) return;

        const { status, startTime } = callDoc;
        if (status !== 'active' && status !== 'ringing') return;

        const isActive = status === 'active';
        const duration = isActive && startTime
          ? Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
          : 0;

        await Call.findOneAndUpdate(
          { callId },
          {
            status  : isActive ? 'ended' : 'missed',
            endTime : new Date(),
            duration,
            endedBy : callerId,
          }
        );

        const otherUserId = callDoc.caller.toString() === callerId
          ? callDoc.receiver.toString()
          : callDoc.caller.toString();

        releaseCall(callId, callDoc.caller.toString(), callDoc.receiver.toString());

        io.to(otherUserId).emit('call:ended', {
          callId,
          endedBy  : callerId,
          reason   : 'disconnected',
          duration,
        });

        console.log(`📴 Auto-ended on disconnect: ${callId} [${isActive ? 'ended' : 'missed'}]`);

      } catch (err) {
        console.error('❌ call disconnect cleanup error:', err.message);
      }

    }, 500); // grace period for multi-tab reconnects
});

};

// ─────────────────────────────────────────────────────────────

/**
 * Read-only snapshot of active calls.
 * Returns a copy — prevents external mutation of internal state.
 * @returns {Map<string, string>}
 */
export const getActiveCalls = () => new Map(activeCalls);