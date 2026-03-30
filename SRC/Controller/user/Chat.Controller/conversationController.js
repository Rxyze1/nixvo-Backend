// Controllers/Chat/conversationController.js

import Conversation from '../../../Models/Chat/ConversationModel.js';
import User from '../../../Models/USER-Auth/User-Auth.-Model.js';
import chatValidationService from '../../../Service/Chat/chatValidationService.js';
import Client   from '../../../Models/USER-Auth/Client-Model.js';
import Employee from '../../../Models/USER-Auth/Employee-Model.js';
import mongoose from 'mongoose';

import {
  successResponse,
  createdResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse,
  forbiddenResponse,
  serverErrorResponse
} from '../../../Config/responseUtils.js';

import { getIO } from '../../../Utils/socket.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *              💬 CONVERSATION CONTROLLER
 *         Handles all conversation operations
 * ═══════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════
// SOCKET HELPER — safe emit, never throws
// ═════════════════════════════════════════════════════════════

/**
 * Emit a socket event to a user room safely.
 * Errors are caught and logged — never propagates to the HTTP response.
 *
 * @param {string} userId
 * @param {string} event
 * @param {object} data
 */
const safeEmit = (userId, event, data) => {
  try {
    const io = getIO();
    io.to(userId.toString()).emit(event, data);
    console.log(`📡 Socket emit: '${event}' → ${userId}`);
  } catch (err) {
    console.error(`⚠️  Socket emit failed ('${event}' → ${userId}):`, err.message);
  }
};

// ═════════════════════════════════════════════════════════════
// ASYNC HANDLER WRAPPER
// ═════════════════════════════════════════════════════════════

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('❌ Controller Error:', error);
    return serverErrorResponse(res, error);
  });
};

// ═════════════════════════════════════════════════════════════
// 💬 CREATE OR GET CONVERSATION
// ═════════════════════════════════════════════════════════════

export const createOrGetConversation = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { recipientId } = req.body;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💬 [CREATE/GET CONVERSATION]');
  console.log(`👤 Current User: ${currentUser.fullname} (${currentUser.userType})`);
  console.log(`👥 Recipient ID: ${recipientId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!recipientId) {
    return badRequestResponse(res, '❌ Recipient ID is required');
  }

  if (recipientId === currentUser._id.toString()) {
    return badRequestResponse(res, '❌ Cannot create conversation with yourself');
  }

  const recipient = await User.findById(recipientId).select(
    'fullname username userType email profilePic status'
  );

  if (!recipient) {
    return notFoundResponse(res, '❌ Recipient user not found');
  }

  if (recipient.status !== 'active') {
    return badRequestResponse(res, '❌ Cannot start conversation with inactive user');
  }

  console.log(`✅ Recipient found: ${recipient.fullname} (${recipient.userType})`);

  const canChat = await chatValidationService.canUsersChat(currentUser._id, recipientId);

  if (!canChat.allowed) {
    console.log('🚫 Chat not allowed:', canChat.reason);
    return forbiddenResponse(res, canChat.reason);
  }

  console.log('✅ Users can chat with each other');


// ✅ Cast both to ObjectId so $all comparison works
let conversation = await Conversation.findOne({
  'participants.userId': {
    $all: [
      new mongoose.Types.ObjectId(currentUser._id),
      new mongoose.Types.ObjectId(recipientId)
    ]
  }
}).populate('participants.userId', 'fullname username userType email profilePic name');

  if (conversation) {
    console.log('✅ Existing conversation found:', conversation._id);

    const currentUserParticipant = conversation.participants.find(
      p => p.userId._id.toString() === currentUser._id.toString()
    );

    if (currentUserParticipant && currentUserParticipant.isDeleted) {
      currentUserParticipant.isDeleted = false;
      currentUserParticipant.deletedAt = null;
      await conversation.save();
      console.log('♻️ Conversation restored for current user');
    }

    return successResponse(res, { conversation, isNew: false }, '✅ Conversation retrieved');
  }

  console.log('📝 Creating new conversation...');

  conversation = await Conversation.create({
    participants: [
      { userId: currentUser._id, userType: currentUser.userType },
      { userId: recipient._id,   userType: recipient.userType  }
    ],
    metadata: {
      totalMessages: 0,
      lastActivity: new Date()
    }
  });

  await conversation.populate('participants.userId', 'fullname username userType email profilePic');

  console.log('✅ New conversation created:', conversation._id);
  console.log(`   Between: ${currentUser.userType} ↔️ ${recipient.userType}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // safeEmit — already wrapped in try/catch internally
  safeEmit(recipientId.toString(), 'new_conversation', {
    conversation: conversation.toObject(),
    from: {
      _id:        currentUser._id,
      fullname:   currentUser.fullname,
      username:   currentUser.username,
      userType:   currentUser.userType,
      profilePic: currentUser.profilePic
    }
  });

  return createdResponse(res, { conversation, isNew: true }, '✅ Conversation created successfully');
});

// ═════════════════════════════════════════════════════════════
// 📋 GET ALL CONVERSATIONS
// ═════════════════════════════════════════════════════════════

export const getConversations = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { page = 1, limit = 20, search = '' } = req.query;

  console.log('\n📋 [GET CONVERSATIONS]');
  console.log(`👤 User: ${req.user.fullname}`);
  console.log(`📄 Page: ${page}, Limit: ${limit}`);

  const skip = (page - 1) * limit;

  const query = {
    participants: {
      $elemMatch: { userId: currentUserId, isDeleted: false }
    }
  };

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    const users = await User.find({
      $or: [{ fullname: searchRegex }, { username: searchRegex }]
    }).select('_id');

    const userIds = users.map(u => u._id);

    query.$and = [
      { participants: { $elemMatch: { userId: currentUserId, isDeleted: false } } },
      { 'participants.userId': { $in: [...userIds, currentUserId] } }
    ];
    delete query.participants;
  }

  const conversations = await Conversation.find(query)
    .populate('participants.userId', 'fullname username userType email name canLogin')
    .populate('lastMessage.senderId', 'fullname username')
    .sort({ 'metadata.lastActivity': -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Conversation.countDocuments(query);

  // ── Fetch profilePic from Client + Employee models ──────────
  const allUserIds = conversations.flatMap(c =>
    c.participants.map(p => p.userId?._id?.toString()).filter(Boolean)
  );


  
// TO ✅
const [clients, employees] = await Promise.all([
  Client.find({ userId: { $in: allUserIds } }).select('userId profilePic isPremium').lean(),
  Employee.find({ userId: { $in: allUserIds } }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified subscription').lean(),
]);

const picMap   = {};
const badgeMap = {};

clients.forEach(doc => {
  const id = doc.userId.toString();
  if (doc.profilePic) picMap[id] = doc.profilePic;
  badgeMap[id] = {
    isPremium:    doc.isPremium ?? false,
    blueVerified: doc.isPremium
      ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
      : { status: false },
    tier: doc.isPremium ? 'premium' : 'free',
  };
});

// TO ✅ — use stored blueVerified.status directly
employees.forEach(doc => {
  const id = doc.userId.toString();
  if (doc.profilePic) picMap[id] = doc.profilePic;
  const isPremium = doc.blueVerified?.status === true;  // ← stored field, accurate enough for chat
  badgeMap[id] = {
    badge: doc.hasBadge ? {
      show: true, type: doc.badgeType, label: doc.badgeLabel,
      icon:  doc.badgeType === 'blue-verified' ? 'verified'     : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
      color: doc.badgeType === 'blue-verified' ? '#0066FF'       : doc.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
      bg:    doc.badgeType === 'blue-verified' ? '#EBF5FF'       : doc.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
    } : { show: false },
    blueVerified:  isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
    adminVerified: { status: doc.adminVerified?.status ?? false },
    tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
  };
});




  // ── Build response ───────────────────────────────────────────
  const conversationsWithUnread = conversations.map(conv => {
    const participant = conv.participants.find(
      p => p.userId._id.toString() === currentUserId.toString()
    );

    return {
      ...conv.toObject(),
      participants: conv.participants.map(p => ({
  ...p.toObject(),
  userId: {
    ...p.userId.toObject(),
    profilePic: picMap[p.userId._id.toString()]  ?? null,
    ...(badgeMap[p.userId._id.toString()] ?? {}),
  }
})),
      unreadCount: participant ? participant.unreadCount : 0,
      isPinned:    participant ? participant.isPinned    : false,
      isMuted:     participant ? participant.isMuted     : false
    };
  });

  console.log(`✅ Found ${conversations.length} conversations\n`);

  return successResponse(res, {
    conversations: conversationsWithUnread,
    pagination: {
      page:    parseInt(page),
      limit:   parseInt(limit),
      total,
      pages:   Math.ceil(total / limit),
      hasMore: skip + conversations.length < total
    }
  }, '✅ Conversations retrieved');
});

// ═════════════════════════════════════════════════════════════
// 📖 GET SINGLE CONVERSATION
// ═════════════════════════════════════════════════════════════

export const getConversation = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { conversationId } = req.params;

  console.log('\n📖 [GET CONVERSATION]');
  console.log(`👤 User: ${req.user.fullname}`);
  console.log(`💬 Conversation ID: ${conversationId}`);

  const conversation = await Conversation.findById(conversationId)
    .populate('participants.userId', 'fullname username userType email profilePic');

  if (!conversation) {
    return notFoundResponse(res, '❌ Conversation not found');
  }

  if (!conversation.isParticipant(currentUserId)) {
    return forbiddenResponse(res, '❌ You are not a participant in this conversation');
  }

  const participant = conversation.participants.find(
    p => p.userId._id.toString() === currentUserId.toString()
  );

  // ── Enrich with profilePic + badge ───────────────────────
  const allUserIds = conversation.participants
    .map(p => p.userId?._id?.toString())
    .filter(Boolean);

  const [clients, employees] = await Promise.all([
    Client.find({ userId: { $in: allUserIds } }).select('userId profilePic isPremium').lean(),
    Employee.find({ userId: { $in: allUserIds } }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified').lean(),
  ]);

  const picMap = {}, badgeMap = {};

  clients.forEach(doc => {
    const id = doc.userId.toString();
    if (doc.profilePic) picMap[id] = doc.profilePic;
    badgeMap[id] = {
      isPremium:    doc.isPremium ?? false,
      blueVerified: doc.isPremium
        ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
        : { status: false },
      tier: doc.isPremium ? 'premium' : 'free',
    };
  });

  employees.forEach(doc => {
    const id = doc.userId.toString();
    if (doc.profilePic) picMap[id] = doc.profilePic;
    const isPremium = doc.blueVerified?.status === true;
    badgeMap[id] = {
      badge: doc.hasBadge ? {
        show: true, type: doc.badgeType, label: doc.badgeLabel,
        icon:  doc.badgeType === 'blue-verified' ? 'verified'     : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
        color: doc.badgeType === 'blue-verified' ? '#0066FF'       : doc.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
        bg:    doc.badgeType === 'blue-verified' ? '#EBF5FF'       : doc.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
      } : { show: false },
      blueVerified:  isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
      adminVerified: { status: doc.adminVerified?.status ?? false },
      tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
    };
  });

  const conversationData = {
    ...conversation.toObject(),
    participants: conversation.participants.map(p => ({
      ...p.toObject(),
      userId: {
        ...p.userId.toObject(),
        profilePic: picMap[p.userId._id.toString()] ?? null,
        ...(badgeMap[p.userId._id.toString()] ?? {}),
      }
    })),
    unreadCount: participant ? participant.unreadCount : 0,
    isPinned:    participant ? participant.isPinned    : false,
    isMuted:     participant ? participant.isMuted     : false,
  };

  console.log('✅ Conversation retrieved\n');

  return successResponse(res, { conversation: conversationData }, '✅ Conversation retrieved');
});

// ═════════════════════════════════════════════════════════════
// 🗑️ DELETE CONVERSATION
// ═════════════════════════════════════════════════════════════

export const deleteConversation = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { conversationId } = req.params;

  console.log('\n🗑️ [DELETE CONVERSATION]');
  console.log(`👤 User: ${req.user.fullname}`);
  console.log(`💬 Conversation ID: ${conversationId}`);

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return notFoundResponse(res, '❌ Conversation not found');
  }

  if (!conversation.isParticipant(currentUserId)) {
    return forbiddenResponse(res, '❌ You are not a participant in this conversation');
  }

  await conversation.markAsDeleted(currentUserId);

  console.log('✅ Conversation deleted for user\n');

  // ✅ FIX: safeEmit — never throws, non-critical for HTTP response
  safeEmit(currentUserId.toString(), 'conversation_deleted', {
    conversationId: conversation._id
  });

  return successResponse(res, null, '✅ Conversation deleted successfully');
});

// ═════════════════════════════════════════════════════════════
// 📌 TOGGLE PIN CONVERSATION
// ═════════════════════════════════════════════════════════════

export const togglePin = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { conversationId } = req.params;

  console.log('\n📌 [TOGGLE PIN]');
  console.log(`👤 User: ${req.user.fullname}`);
  console.log(`💬 Conversation ID: ${conversationId}`);

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return notFoundResponse(res, '❌ Conversation not found');
  }

  if (!conversation.isParticipant(currentUserId)) {
    return forbiddenResponse(res, '❌ You are not a participant in this conversation');
  }

  const participant = conversation.participants.find(
    p => p.userId.toString() === currentUserId.toString()
  );

  participant.isPinned = !participant.isPinned;
  participant.pinnedAt = participant.isPinned ? new Date() : null;

  await conversation.save();

  console.log(`✅ Conversation ${participant.isPinned ? 'pinned' : 'unpinned'}\n`);

  // ✅ FIX: safeEmit — never throws
  safeEmit(currentUserId.toString(), 'conversation_pinned', {
    conversationId: conversation._id,
    isPinned:       participant.isPinned
  });

  return successResponse(res, {
    isPinned: participant.isPinned,
    pinnedAt: participant.pinnedAt
  }, participant.isPinned ? '✅ Conversation pinned' : '✅ Conversation unpinned');
});

// ═════════════════════════════════════════════════════════════
// 🔕 TOGGLE MUTE CONVERSATION
// ═════════════════════════════════════════════════════════════

export const toggleMute = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { conversationId } = req.params;

  console.log('\n🔕 [TOGGLE MUTE]');
  console.log(`👤 User: ${req.user.fullname}`);
  console.log(`💬 Conversation ID: ${conversationId}`);

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return notFoundResponse(res, '❌ Conversation not found');
  }

  if (!conversation.isParticipant(currentUserId)) {
    return forbiddenResponse(res, '❌ You are not a participant in this conversation');
  }

  const participant = conversation.participants.find(
    p => p.userId.toString() === currentUserId.toString()
  );

  participant.isMuted = !participant.isMuted;
  participant.mutedAt = participant.isMuted ? new Date() : null;

  await conversation.save();

  console.log(`✅ Conversation ${participant.isMuted ? 'muted' : 'unmuted'}\n`);

  // ✅ FIX: safeEmit — never throws
  safeEmit(currentUserId.toString(), 'conversation_muted', {
    conversationId: conversation._id,
    isMuted:        participant.isMuted
  });

  return successResponse(res, {
    isMuted: participant.isMuted,
    mutedAt: participant.mutedAt
  }, participant.isMuted ? '✅ Conversation muted' : '✅ Conversation unmuted');
});

// ═════════════════════════════════════════════════════════════
// ✅ MARK CONVERSATION AS READ
// ═════════════════════════════════════════════════════════════

export const markAsRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { conversationId } = req.params;

  console.log('\n✅ [MARK AS READ]');
  console.log(`👤 User: ${req.user.fullname}`);
  console.log(`💬 Conversation ID: ${conversationId}`);

  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    return notFoundResponse(res, '❌ Conversation not found');
  }

  if (!conversation.isParticipant(currentUserId)) {
    return forbiddenResponse(res, '❌ You are not a participant in this conversation');
  }

  await conversation.markAsRead(currentUserId);

  console.log('✅ Conversation marked as read\n');

  // ✅ FIX: safeEmit — never throws
  safeEmit(currentUserId.toString(), 'conversation_read', {
    conversationId: conversation._id
  });

  return successResponse(res, null, '✅ Conversation marked as read');
});

// ═════════════════════════════════════════════════════════════
// 🔍 SEARCH CONVERSATIONS
// ═════════════════════════════════════════════════════════════













export const searchConversations = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const {
    query = '',
    q = '',
    search = '',
    type = 'all',
    userType = 'all',
    conversationType = 'all',
    sortBy = 'relevance',
    page = 1,
    limit = 20,
    includeInactive = false
  } = req.query;

  const searchTerm = query || q || search;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 [SEARCH CONVERSATIONS - ENHANCED]');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 User: ${req.user.fullname} (${currentUserId})`);
  console.log(`🔎 Search term: "${searchTerm}"`);
  console.log(`📋 Filters:`, { type, userType, conversationType, sortBy });
  console.log(`📄 Pagination:`, { page, limit });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!searchTerm || searchTerm.trim().length === 0) {
    if (type === 'conversations' || type === 'all') {
      return getRecentConversations(req, res, {
        page: parseInt(page),
        limit: parseInt(limit),
        conversationType
      });
    }

    return successResponse(res, {
      conversations: [],
      matchedUsers: [],
      query: '',
      filters: { type, userType, conversationType, sortBy },
      stats: { totalUsers: 0, existingConversations: 0, newContacts: 0 }
    }, 'ℹ️  Enter a name to search');
  }

  if (searchTerm.trim().length < 2) {
    return badRequestResponse(res, '❌ Search query must be at least 2 characters');
  }

  const validTypes             = ['all', 'users', 'conversations'];
  const validUserTypes         = ['all', 'student', 'tutor'];
  const validConversationTypes = ['all', 'direct', 'group'];
  const validSortOptions       = ['relevance', 'recent', 'name', 'unread'];

  if (!validTypes.includes(type))
    return badRequestResponse(res, `❌ Invalid type. Must be: ${validTypes.join(', ')}`);

  if (!validUserTypes.includes(userType))
    return badRequestResponse(res, `❌ Invalid userType. Must be: ${validUserTypes.join(', ')}`);

  if (!validConversationTypes.includes(conversationType))
    return badRequestResponse(res, `❌ Invalid conversationType. Must be: ${validConversationTypes.join(', ')}`);

  if (!validSortOptions.includes(sortBy))
    return badRequestResponse(res, `❌ Invalid sortBy. Must be: ${validSortOptions.join(', ')}`);

  const escapedTerm = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const searchRegex = new RegExp(escapedTerm, 'i');

  const pageInt  = Math.max(1, parseInt(page));
  const limitInt = Math.min(Math.max(1, parseInt(limit)), 100);
  const skip     = (pageInt - 1) * limitInt;

 try {
  let users         = [];
  let conversations = [];

  // ── STEP 1: SEARCH USERS ────────────────────────────────
  if (type === 'all' || type === 'users') {
    console.log(`👥 Searching for users...`);

    const userQuery = {
      _id: { $ne: currentUserId },
      $or: [
        { fullname: searchRegex },
        { username: searchRegex },
        { email:    searchRegex }
      ]
    };

    if (userType !== 'all') userQuery.userType = userType;

    if (!includeInactive || includeInactive === 'false') {
      userQuery.status = { $ne: 'inactive' };
    }

    users = await User.find(userQuery)
      .select('_id fullname username userType email profilePic status lastActive bio')
      .limit(limitInt)
      .sort(getSortOptions('name'))
      .lean();

    console.log(`✅ Found ${users.length} matching user(s)`);
  }

  // ── STEP 2: SEARCH CONVERSATIONS ────────────────────────
  if (type === 'all' || type === 'conversations') {
    console.log(`💬 Searching for conversations...`);

    let userIds = [];

    if (users.length > 0) {
      userIds = users.map(u => u._id);
    } else {
      const tempUsers = await User.find({
        _id: { $ne: currentUserId },
        $or: [
          { fullname: searchRegex },
          { username: searchRegex },
          { email:    searchRegex }
        ]
      }).select('_id').lean();

      userIds = tempUsers.map(u => u._id);
    }

    if (userIds.length > 0) {
      const conversationQuery = {
        status: { $ne: 'deleted' },
        $and: [
          { participants: { $elemMatch: { userId: currentUserId, isDeleted: false } } },
          { 'participants.userId': { $in: userIds } }
        ]
      };

      if (conversationType !== 'all') conversationQuery.type = conversationType;

      conversations = await Conversation.find(conversationQuery)
        .populate({ path: 'participants.userId', select: 'fullname username userType email profilePic status lastActive' })
        .populate({ path: 'lastMessage.senderId', select: 'fullname username' })
        .sort(getSortOptions(sortBy, conversationType))
        .limit(limitInt)
        .lean();

      console.log(`✅ Found ${conversations.length} matching conversation(s)`);
    }
  }

  // ── STEP 2.5: BUILD BADGE & PIC MAPS ────────────────────
  // Collect all userIds from both conversations and matched users
  // so we can enrich otherParticipant, matchedUsers, and newContacts
  const searchUserIds = [
    ...conversations.flatMap(c =>
      c.participants.map(p => p.userId?._id?.toString() || p.userId?.toString())
    ),
    ...users.map(u => u._id.toString()),
  ].filter(Boolean);

  const [sClients, sEmployees] = await Promise.all([
    Client.find({ userId: { $in: searchUserIds } }).select('userId profilePic isPremium').lean(),
    Employee.find({ userId: { $in: searchUserIds } }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified').lean(),
  ]);

  const sPicMap   = {};
  const sBadgeMap = {};

  sClients.forEach(doc => {
    const id = doc.userId.toString();
    if (doc.profilePic) sPicMap[id] = doc.profilePic;
    sBadgeMap[id] = {
      isPremium:    doc.isPremium ?? false,
      blueVerified: doc.isPremium
        ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
        : { status: false },
      tier: doc.isPremium ? 'premium' : 'free',
    };
  });

  sEmployees.forEach(doc => {
    const id = doc.userId.toString();
    if (doc.profilePic) sPicMap[id] = doc.profilePic;
    const isPremium = doc.blueVerified?.status === true;
    sBadgeMap[id] = {
      badge: doc.hasBadge ? {
        show:  true,
        type:  doc.badgeType,
        label: doc.badgeLabel,
        icon:  doc.badgeType === 'blue-verified'  ? 'verified'     : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
        color: doc.badgeType === 'blue-verified'  ? '#0066FF'       : doc.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
        bg:    doc.badgeType === 'blue-verified'  ? '#EBF5FF'       : doc.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
      } : { show: false },
      blueVerified:  isPremium
        ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
        : { status: false },
      adminVerified: { status: doc.adminVerified?.status ?? false },
      tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
    };
  });

  // ── STEP 3: ENRICH CONVERSATIONS ────────────────────────
  // Attach profilePic + badge to otherParticipant in each conversation
  const enrichedConversations = conversations.map(conv => {
    const otherParticipant = conv.participants.find(p => {
      const pUserId = p.userId?._id || p.userId;
      return pUserId.toString() !== currentUserId.toString();
    });

    const currentParticipant = conv.participants.find(p => {
      const pUserId = p.userId?._id || p.userId;
      return pUserId.toString() === currentUserId.toString();
    });

    let relevanceScore = 0;
    if (otherParticipant?.userId) {
      const otherUser = otherParticipant.userId;

      if (otherUser.username?.toLowerCase() === searchTerm.toLowerCase())
        relevanceScore = 100;
      else if (otherUser.fullname?.toLowerCase().startsWith(searchTerm.toLowerCase()))
        relevanceScore = 80;
      else if (otherUser.fullname?.toLowerCase().includes(searchTerm.toLowerCase()))
        relevanceScore = 60;
      else
        relevanceScore = 40;

      if (currentParticipant?.unreadCount > 0) relevanceScore += 10;

      const hoursSinceLastActivity =
        (Date.now() - new Date(conv.metadata?.lastActivity || 0)) / (1000 * 60 * 60);
      if (hoursSinceLastActivity < 24) relevanceScore += 5;
    }

    // Resolve the other participant's userId string for map lookup
    const otherUid = otherParticipant?.userId?._id?.toString()
      || otherParticipant?.userId?.toString();

    return {
      _id:         conv._id,
      type:        conv.type,
      status:      conv.status,
      lastMessage: conv.lastMessage,
      metadata:    conv.metadata,
      createdAt:   conv.createdAt,
      updatedAt:   conv.updatedAt,

      // ✅ Enrich otherParticipant with profilePic + badge
      otherParticipant: otherParticipant?.userId ? {
        ...otherParticipant.userId,
        profilePic: sPicMap[otherUid] ?? null,
        ...(sBadgeMap[otherUid] ?? {}),
      } : null,

      unreadCount: currentParticipant?.unreadCount || 0,
      lastReadAt:  currentParticipant?.lastReadAt  || null,
      isPinned:    currentParticipant?.isPinned    || false,
      isMuted:     currentParticipant?.isMuted     || false,
      relevanceScore,
    };
  });

  if (sortBy === 'relevance') {
    enrichedConversations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } else if (sortBy === 'unread') {
    enrichedConversations.sort((a, b) => b.unreadCount - a.unreadCount);
  }

  // ── STEP 4: NEW CONTACTS ────────────────────────────────
  const conversationUserIds = enrichedConversations
    .map(conv => conv.otherParticipant?._id?.toString())
    .filter(Boolean);

  const newContacts = users.filter(user =>
    !conversationUserIds.includes(user._id.toString())
  );

  if (sortBy === 'relevance') {
    newContacts.sort((a, b) =>
      calculateUserRelevance(b, searchTerm) - calculateUserRelevance(a, searchTerm)
    );
  }

  // ── STEP 5: PAGINATION ──────────────────────────────────
  const totalConversations = enrichedConversations.length;
  const totalUsers         = users.length;
  const totalNewContacts   = newContacts.length;

  const paginatedConversations = enrichedConversations.slice(skip, skip + limitInt);
  const paginatedUsers         = type === 'users' ? users.slice(skip, skip + limitInt) : users;
  const paginatedNewContacts   = newContacts.slice(0, limitInt);

  console.log(`\n📊 RESULTS:`);
  console.log(`   - Total users         : ${totalUsers}`);
  console.log(`   - Total conversations : ${totalConversations}`);
  console.log(`   - New contacts        : ${totalNewContacts}`);
  console.log(`   - Page: ${pageInt}/${Math.ceil(Math.max(totalConversations, totalUsers) / limitInt)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return successResponse(res, {
    conversations: paginatedConversations,

    // ✅ Enrich matchedUsers with profilePic + badge
    matchedUsers: paginatedUsers.map(u => ({
      ...u,
      profilePic: sPicMap[u._id.toString()] ?? u.profilePic ?? null,
      ...(sBadgeMap[u._id.toString()] ?? {}),
    })),

    // ✅ Enrich newContacts with profilePic + badge
    newContacts: paginatedNewContacts.map(u => ({
      ...u,
      profilePic: sPicMap[u._id.toString()] ?? u.profilePic ?? null,
      ...(sBadgeMap[u._id.toString()] ?? {}),
    })),

    query: searchTerm.trim(),
    filters: {
      type,
      userType,
      conversationType,
      sortBy,
      includeInactive: includeInactive === 'true' || includeInactive === true
    },
    pagination: {
      page:                 pageInt,
      limit:                limitInt,
      totalConversations,
      totalUsers,
      totalNewContacts,
      totalPages:           Math.ceil(Math.max(totalConversations, totalUsers) / limitInt),
      hasNextPage:          skip + limitInt < Math.max(totalConversations, totalUsers)
    },
    stats: {
      totalUsers,
      existingConversations: totalConversations,
      newContacts:           totalNewContacts
    }
  }, `✅ Found ${totalUsers} user(s) and ${totalConversations} conversation(s)`);

} catch (error) {
  console.error('❌ Search error:', error);
  console.error('Stack:', error.stack);
  return serverErrorResponse(res, error, 'Failed to search conversations');
}



});


// ═════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════

function getSortOptions(sortBy) {
  switch (sortBy) {
    case 'recent':    return { 'metadata.lastActivity': -1 };
    case 'name':      return { 'participants.userId.fullname': 1 };
    case 'unread':    return { 'participants.unreadCount': -1, 'metadata.lastActivity': -1 };
    case 'relevance':
    default:          return { 'metadata.lastActivity': -1 };
  }
}

function calculateUserRelevance(user, searchTerm) {
  const term = searchTerm.toLowerCase();
  let score  = 0;

  if      (user.username?.toLowerCase() === term)            score = 100;
  else if (user.fullname?.toLowerCase() === term)            score = 90;
  else if (user.username?.toLowerCase().startsWith(term))   score = 80;
  else if (user.fullname?.toLowerCase().startsWith(term))   score = 70;
  else if (user.username?.toLowerCase().includes(term))     score = 60;
  else if (user.fullname?.toLowerCase().includes(term))     score = 50;
  else if (user.email?.toLowerCase().includes(term))        score = 40;
  else                                                        score = 20;

  if (user.status === 'online') score += 10;

  return score;
}

async function getRecentConversations(req, res, options = {}) {
  const currentUserId = req.user._id;
  const { page = 1, limit = 20, conversationType = 'all' } = options;

  const query = {
    participants: { $elemMatch: { userId: currentUserId, isDeleted: false } },
    status: { $ne: 'deleted' }
  };

  if (conversationType !== 'all') query.type = conversationType;

  const conversations = await Conversation.find(query)
    .populate({ path: 'participants.userId', select: 'fullname username userType email name canLogin' })
    .populate({ path: 'lastMessage.senderId', select: 'fullname username' })
    .sort({ 'metadata.lastActivity': -1 })
    .limit(limit)
    .skip((page - 1) * limit);  // ← .lean() hata diya

  const total = await Conversation.countDocuments(query);

  // ── profilePic enrich ──
  const allUserIds = conversations.flatMap(c =>
    c.participants.map(p => p.userId?._id?.toString()).filter(Boolean)
  );



// TO ✅ — same badgeMap logic as getConversations
const [clients, employees] = await Promise.all([
  Client.find({ userId: { $in: allUserIds } }).select('userId profilePic isPremium').lean(),
  Employee.find({ userId: { $in: allUserIds } }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified subscription').lean(),
]);

const picMap   = {};
const badgeMap = {};

clients.forEach(doc => {
  const id = doc.userId.toString();
  if (doc.profilePic) picMap[id] = doc.profilePic;
  badgeMap[id] = {
    isPremium:    doc.isPremium ?? false,
    blueVerified: doc.isPremium
      ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
      : { status: false },
    tier: doc.isPremium ? 'premium' : 'free',
  };
});




// TO ✅ — use stored blueVerified.status directly
employees.forEach(doc => {
  const id = doc.userId.toString();
  if (doc.profilePic) picMap[id] = doc.profilePic;
  const isPremium = doc.blueVerified?.status === true;  // ← stored field, accurate enough for chat
  badgeMap[id] = {
    badge: doc.hasBadge ? {
      show: true, type: doc.badgeType, label: doc.badgeLabel,
      icon:  doc.badgeType === 'blue-verified' ? 'verified'     : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
      color: doc.badgeType === 'blue-verified' ? '#0066FF'       : doc.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
      bg:    doc.badgeType === 'blue-verified' ? '#EBF5FF'       : doc.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
    } : { show: false },
    blueVerified:  isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
    adminVerified: { status: doc.adminVerified?.status ?? false },
    tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
  };
});




const enriched = conversations.map(conv => ({
  ...conv.toObject(),
  participants: conv.participants.map(p => ({
    ...p.toObject(),
    userId: {
      ...p.userId.toObject(),
      profilePic: picMap[p.userId._id.toString()]  ?? null,
      ...(badgeMap[p.userId._id.toString()] ?? {}),
    }
  }))
}));



  return successResponse(res, {
    conversations: enriched,
    matchedUsers: [], newContacts: [], query: '',
    filters: { conversationType },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: (page * limit) < total }
  }, '✅ Recent conversations retrieved');
}

// ═════════════════════════════════════════════════════════════
// 📊 GET CONVERSATION STATS
// ═════════════════════════════════════════════════════════════

export const getConversationStats = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  console.log('\n📊 [GET CONVERSATION STATS]');
  console.log(`👤 User: ${req.user.fullname}`);

  // ✅ FIX: same $elemMatch fix as getConversations —
  // flat query returned wrong results when another participant had isDeleted:false
  const conversations = await Conversation.find({
    participants: {
      $elemMatch: { userId: currentUserId, isDeleted: false }
    }
  });

  let totalUnread  = 0;
  let pinnedCount  = 0;
  let mutedCount   = 0;

  conversations.forEach(conv => {
    const participant = conv.participants.find(
      p => p.userId.toString() === currentUserId.toString()
    );

    if (participant) {
      totalUnread += participant.unreadCount || 0;
      if (participant.isPinned) pinnedCount++;
      if (participant.isMuted)  mutedCount++;
    }
  });

  const stats = {
    totalConversations: conversations.length,
    totalUnread,
    pinnedCount,
    mutedCount
  };

  console.log('✅ Stats calculated:', stats, '\n');

  return successResponse(res, stats, '✅ Conversation stats retrieved');
});