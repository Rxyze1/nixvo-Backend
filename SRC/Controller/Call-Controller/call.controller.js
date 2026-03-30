// Controller/Call-Controller/call.controller.js

import Call from '../../Models/Call/CallModel.js';
import CallMessage from '../../Models/Call/CallMessage.js';
import { getIO } from '../../Utils/socket.js';
import { Types } from 'mongoose';
import User from '../../Models/USER-Auth/User-Auth.-Model.js';
import {
  successResponse,
  createdResponse,
  notFoundResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse
} from '../../Config/responseUtils.js';

// ====================================================================
// ASYNC HANDLER - Wraps all async functions with error catching
// ====================================================================

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('❌ Call Controller Error:', error);
    return serverErrorResponse(res, error);
  });
};

// ====================================================================
// CALL STATE MACHINE - Define valid transitions
// ====================================================================

// ✅ Add it
const VALID_TRANSITIONS = {
  ringing: ['active', 'rejected', 'missed', 'failed', 'busy'],
  active:  ['ended', 'failed'],
  rejected: [], missed: [], busy: [], failed: [], ended: [],
};

const validateStateTransition = (currentStatus, newStatus) => {
  const validNextStates = VALID_TRANSITIONS[currentStatus];
  return validNextStates && validNextStates.includes(newStatus);
};

// ====================================================================
// HELPER: Send call message to message system
// ====================================================================

const createCallMessage = async (callData, messageText = '') => {
  try {
    const callMessage = await CallMessage.create({
      callId: callData.callId,
      caller: callData.caller,
      receiver: callData.receiver,
      callType: callData.callType,
      status: callData.status,
      startTime: callData.startTime,
      endTime: callData.endTime,
      duration: callData.duration || 0,
      endedBy: callData.endedBy,
      rejectedBy: callData.rejectedBy,
      missedAt: callData.missedAt,
      failureReason: callData.failureReason,
      messageText,
    });
    console.log('✅ Call message saved:', callMessage._id);
    return callMessage;
  } catch (error) {
    console.error('⚠️ Error saving call message:', error.message);
  }
};

// ====================================================================
// HELPER: Emit socket event with fallback
// ====================================================================

const emitSocketEvent = async (io, roomId, eventName, data) => {
  try {
    const sockets = await io.in(roomId.toString()).fetchSockets();
    if (sockets.length === 0) {
      console.warn(`⚠️ No socket connection for user: ${roomId}`);
      return false; // User not connected
    }
    io.to(roomId.toString()).emit(eventName, data);
    return true; // Success
  } catch (e) {
    console.error(`⚠️ Socket emit error for ${eventName}:`, e.message);
    return false;
  }
};

// ====================================================================
// INITIATE CALL → POST /api/user/calls/initiate
// ====================================================================

export const initiateCall = asyncHandler(async (req, res) => {
  const caller = req.user;
  const { receiverId, callType = 'audio' } = req.body;

  // Validation
  if (!receiverId)
    return badRequestResponse(res, 'Receiver ID is required');

  if (receiverId === caller._id.toString())
    return badRequestResponse(res, 'You cannot call yourself');

  if (!['audio', 'video'].includes(callType))
    return badRequestResponse(res, 'callType must be audio or video');

  // Check receiver exists and is active
  const receiver = await User.findById(receiverId)
    .select('fullname username userType profilePic status');

  if (!receiver)
    return notFoundResponse(res, 'Receiver not found');

  if (receiver.status !== 'active')
    return badRequestResponse(res, 'User is not available');

  // Check for existing active calls
  const activeCall = await Call.findOne({
    $or: [
      { caller: caller._id },
      { receiver: caller._id }
    ],
    status: { $in: ['ringing', 'active'] }
  });

  if (activeCall)
    return badRequestResponse(res, 'You already have an active call');

  // Create call
 // ✅ Let the model default handle it, then transition to ringing via socket
const call = await Call.create({
  caller: caller._id,
  receiver: receiver._id,
  callType,
 status: 'ringing',
});
  // Create call message (initial state)
  await createCallMessage(
    {
      callId: call.callId,
      caller: caller._id,
      receiver: receiver._id,
      callType,
      status: 'ringing',
    },
    `${caller.fullname} ringing you for a ${callType} call`
  );

  // Emit socket event
  const io = getIO();


// FIX - remove connectedToSocket
return createdResponse(res, {
  callId: call.callId,
  call,
  receiver: {
    _id: receiver._id,
    fullname: receiver.fullname,
    profilePic: receiver.profilePic
  }
}, 'Call initiated successfully');


});

// ====================================================================
// ANSWER CALL → PUT /api/user/calls/:callId/answer
// ====================================================================

export const answerCall = asyncHandler(async (req, res) => {
const currentUser = req.user;                    // ← Gets user from auth
  const { callId } = req.params;                   // ← Gets callId from URL

  
  const call = await Call.findOne({ callId })
    .populate('caller', 'fullname username');

  if (!call)
    return notFoundResponse(res, 'Call not found');

  if (call.receiver.toString() !== currentUser._id.toString())
    return forbiddenResponse(res, 'You are not the receiver of this call');

  if (!validateStateTransition(call.status, 'active'))
  return badRequestResponse(res, `Cannot answer a call with status: ${call.status}`);

  // Update call status
  call.status = 'active';
  call.startTime = new Date();
  await call.save();

  // Update call message
 await CallMessage.findOneAndUpdate(
  { callId },
  { status: 'active', startTime: new Date(),
    messageText: `${currentUser.fullname} answered the call` },
);

  // Emit socket event
  const io = getIO();
await emitSocketEvent(io, call.caller._id.toString(), 'call:answered', {
  callId: call.callId,
  startTime: call.startTime,
  answeredBy: {
    _id: currentUser._id,
    fullname: currentUser.fullname
  }
});

  return successResponse(res, { call }, 'Call answered successfully');
});

// ====================================================================
// REJECT CALL → PUT /api/user/calls/:callId/reject
// ====================================================================

export const rejectCall = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { callId } = req.params;

  const call = await Call.findOne({ callId })
    .populate('caller', 'fullname username');

  if (!call)
    return notFoundResponse(res, 'Call not found');

  if (call.receiver.toString() !== currentUser._id.toString())
    return forbiddenResponse(res, 'You are not the receiver of this call');

  if (!validateStateTransition(call.status, 'rejected'))
    return badRequestResponse(
      res,
      `Cannot reject a call with status: ${call.status}`
    );

  // Update call
  call.status = 'rejected';
  call.endTime = new Date();
  call.endedBy = currentUser._id;
  await call.save();

  // Update call message
// ✅ Add to call:reject after releaseCall
await CallMessage.findOneAndUpdate(
  { callId },
  { status: 'rejected', endTime: call.endTime, rejectedBy: currentUser._id },
);

  // Emit socket event
  const io = getIO();
await emitSocketEvent(io, call.caller._id.toString(), 'call:rejected', {
  callId: call.callId,
  rejectedBy: {
    _id: currentUser._id,
    fullname: currentUser.fullname
  }
});

  return successResponse(res, { call }, 'Call rejected');
});

// ====================================================================
// END CALL → PUT /api/user/calls/:callId/end
// ====================================================================

export const endCall = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { callId } = req.params;

  const call = await Call.findOne({ callId });

  if (!call)
    return notFoundResponse(res, 'Call not found');

  const isParticipant =
    call.caller.toString() === currentUser._id.toString() ||
    call.receiver.toString() === currentUser._id.toString();

  if (!isParticipant)
    return forbiddenResponse(res, 'You are not a participant in this call');

  if (!validateStateTransition(call.status, 'ended'))
    return badRequestResponse(
      res,
      `Call already ended with status: ${call.status}`
    );

  // Update call
  call.status = 'ended';
  call.endTime = new Date();
  call.endedBy = currentUser._id;

  if (call.startTime) {
    call.duration = Math.round((call.endTime - call.startTime) / 1000);
  }

  await call.save();

  // Update call message
// ✅ Add to call:end after releaseCall
await CallMessage.findOneAndUpdate(
  { callId },
 { status: 'ended', endTime: call.endTime, duration: call.duration || 0, endedBy: currentUser._id }
);

  // Notify other user
  const otherUserId =
    call.caller.toString() === currentUser._id.toString()
      ? call.receiver
      : call.caller;

  const io = getIO();
  await emitSocketEvent(io, otherUserId, 'call:ended', {
    callId: call.callId,
    endedBy: {
      _id: currentUser._id,
      fullname: currentUser.fullname
    },
    duration: call.duration || 0,
    endTime: call.endTime
  });

  return successResponse(
    res,
    {
      callId: call.callId,
      duration: call.duration || 0,
      endTime: call.endTime,
      status: call.status
    },
    'Call ended'
  );
});

// ====================================================================
// MARK CALL AS MISSED (Call should be marked as missed if not answered within timeout)
// This can be triggered by frontend or a scheduled job
// ====================================================================

export const missCall = asyncHandler(async (req, res) => {
  const { callId } = req.params;

  const call = await Call.findOne({ callId })
    .populate('caller', 'fullname')
    .populate('receiver', 'fullname');

  if (!call)
    return notFoundResponse(res, 'Call not found');

  if (!validateStateTransition(call.status, 'missed'))
    return badRequestResponse(
      res,
      `Cannot mark call as missed with status: ${call.status}`
    );
const missedAt = new Date();
call.status = 'missed';
call.endTime = missedAt;
await call.save();

// Update call message
// ✅ Add to disconnect cleanup after Call.findOneAndUpdate
await CallMessage.findOneAndUpdate(
  { callId },
{ status: 'missed', missedAt, messageText: `${call.receiver.fullname} missed the call from ${call.caller.fullname}` }
);

// Notify both users
const io = getIO();
await emitSocketEvent(io, call.caller._id.toString(), 'call:missed', {
  callId: call.callId,
  missedAt,
});
await emitSocketEvent(io, call.receiver._id.toString(), 'call:missed_incoming', {
  callId: call.callId,
  missedAt,
});


  return successResponse(res, { call }, 'Call marked as missed');
});

// ====================================================================
// GET MY CALL HISTORY → GET /api/calls/my?page=1&limit=20&status=&callType=
// ====================================================================

export const getMyCallHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { page = 1, limit = 20, status, callType } = req.query;

  const filter = {
    $or: [
  { caller: new Types.ObjectId(userId) },
  { receiver: new Types.ObjectId(userId) }
]
  };

  if (status) filter.status = status;
  if (callType) filter.callType = callType;

  const [calls, total] = await Promise.all([
    Call.find(filter)
      .populate('caller', 'fullname username userType profilePic')
      .populate('receiver', 'fullname username userType profilePic')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-__v')
      .lean(),
    Call.countDocuments(filter),
  ]);

  const tagged = calls.map((call) => ({
    ...call,
    direction:
      call.caller?._id?.toString() === userId ? 'outgoing' : 'incoming',
    callerExists: !!call.caller,
    receiverExists: !!call.receiver,
  }));

  return successResponse(
    res,
    {
      calls: tagged,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    },
    'Call history retrieved'
  );
});

// ====================================================================
// GET SINGLE CALL → GET /api/calls/:callId
// ====================================================================

export const getSingleCall = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  const call = await Call.findOne({ callId: req.params.callId })
    .populate('caller', 'fullname username userType profilePic')
    .populate('receiver', 'fullname username userType profilePic')
    .select('-__v')
    .lean();

  if (!call)
    return notFoundResponse(res, 'Call not found');

  const isParticipant =
    call.caller?._id?.toString() === userId ||
    call.receiver?._id?.toString() === userId;

  if (!isParticipant)
    return forbiddenResponse(res, 'Access denied');

  // Also fetch the call message for this call
  const callMessage = await CallMessage.findOne({ callId: call.callId })
    .lean();

  return successResponse(
    res,
    {
      call,
      message: callMessage,
    },
    'Call retrieved'
  );
});

// ====================================================================
// GET CALLS WITH USER → GET /api/calls/with/:otherUserId
// ====================================================================

export const getCallsWithUser = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const otherUserId = req.params.otherUserId;
  const { page = 1, limit = 20 } = req.query;

  try {
    new Types.ObjectId(otherUserId);
  } catch {
    return badRequestResponse(res, 'Invalid user ID');
  }

  const filter = {

    
   $or: [
  { caller: new Types.ObjectId(userId),      receiver: new Types.ObjectId(otherUserId) },
  { caller: new Types.ObjectId(otherUserId), receiver: new Types.ObjectId(userId) },
],


    
  };

  const [calls, total] = await Promise.all([
    Call.find(filter)
      .populate('caller', 'fullname username userType profilePic')
      .populate('receiver', 'fullname username userType profilePic')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-__v')
      .lean(),
    Call.countDocuments(filter),
  ]);

  return successResponse(
    res,
    {
      calls,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    },
    'Calls retrieved'
  );
});

// ====================================================================
// ADMIN - GET ALL CALLS → GET /api/calls/admin/all
// ====================================================================

export const adminGetAllCalls = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, callType, userId, from, to } =
    req.query;

  const filter = {};

  if (status) filter.status = status;
  if (callType) filter.callType = callType;

  if (userId) {
    try {
      const userObjectId = new Types.ObjectId(userId);
      filter.$or = [{ caller: userObjectId }, { receiver: userObjectId }];
    } catch {
      return badRequestResponse(res, 'Invalid user ID');
    }
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const [calls, total] = await Promise.all([
    Call.find(filter)
      .populate('caller', 'fullname username userType')
      .populate('receiver', 'fullname username userType')
      .populate('endedBy', 'fullname username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean(),
    Call.countDocuments(filter),
  ]);

  return successResponse(
    res,
    {
      calls,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    },
    'All calls retrieved'
  );
});

// ====================================================================
// ADMIN - GET USER CALLS → GET /api/calls/admin/user/:userId
// ====================================================================

export const adminGetUserCalls = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  let userObjectId;
  try {
    userObjectId = new Types.ObjectId(userId);
  } catch {
    return badRequestResponse(res, 'Invalid user ID');
  }

  const filter = {
    $or: [{ caller: userObjectId }, { receiver: userObjectId }],
  };

  const [calls, total, stats] = await Promise.all([
    Call.find(filter)
      .populate('caller', 'fullname username userType')
      .populate('receiver', 'fullname username userType')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean(),
    Call.countDocuments(filter),
    Call.aggregate([
      {
        $match: {
          $or: [{ caller: userObjectId }, { receiver: userObjectId }],
        },
      },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          answered: {
            $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] },
          },
          missed: {
            $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  return successResponse(
    res,
    {
      calls,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      stats: stats[0] || {
        totalCalls: 0,
        totalDuration: 0,
        answered: 0,
        missed: 0,
        rejected: 0,
      },
    },
    'User calls retrieved'
  );
});

// ====================================================================
// ADMIN - CALL SUMMARY → GET /api/calls/admin/summary
// ====================================================================

export const adminGetCallSummary = asyncHandler(async (req, res) => {
  const result = await Call.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        avgDuration: { $avg: '$duration' },
        answered: {
          $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] },
        },
        missed: {
          $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
        },
        busy: {
          $sum: { $cond: [{ $eq: ['$status', 'busy'] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
        },
        audio: {
          $sum: { $cond: [{ $eq: ['$callType', 'audio'] }, 1, 0] },
        },
        video: {
          $sum: { $cond: [{ $eq: ['$callType', 'video'] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        totalDuration: 1,
        avgDuration: { $round: ['$avgDuration', 0] },
        answered: 1,
        missed: 1,
        rejected: 1,
        busy: 1,
        failed: 1,
        audio: 1,
        video: 1,
      },
    },
  ]);

  const summary = result[0] || {
    total: 0,
    totalDuration: 0,
    avgDuration: 0,
    answered: 0,
    missed: 0,
    rejected: 0,
    busy: 0,
    failed: 0,
    audio: 0,
    video: 0,
  };

  return successResponse(res, summary, 'Summary retrieved');
});

// ====================================================================
// GET CALL MESSAGES → GET /api/calls/messages/:callId
// ====================================================================

export const getCallMessage = asyncHandler(async (req, res) => {
  const { callId } = req.params;

  const callMessage = await CallMessage.findOne({ callId })
    .populate('caller', 'fullname username profilePic')
    .populate('receiver', 'fullname username profilePic')
    .populate('endedBy', 'fullname username')
    .lean();

  if (!callMessage)
    return notFoundResponse(res, 'Call message not found');

  return successResponse(res, callMessage, 'Call message retrieved');
});

// ====================================================================
// GET ALL CALL MESSAGES (for a conversation) → GET /api/calls/messages/user/:otherUserId
// ====================================================================

export const getCallMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { otherUserId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    new Types.ObjectId(otherUserId);
  } catch {
    return badRequestResponse(res, 'Invalid user ID');
  }

  const filter = {
   $or: [
  { caller: new Types.ObjectId(userId),      receiver: new Types.ObjectId(otherUserId) },
  { caller: new Types.ObjectId(otherUserId), receiver: new Types.ObjectId(userId) },
],
  };

  const [messages, total] = await Promise.all([
    CallMessage.find(filter)
      .populate('caller', 'fullname username profilePic')
      .populate('receiver', 'fullname username profilePic')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean(),
    CallMessage.countDocuments(filter),
  ]);

  return successResponse(
    res,
    {
      messages,
      total,
      page: Number(page),
     pages: Math.ceil(total / Number(limit))
    },
    'Call messages retrieved'
  );
});