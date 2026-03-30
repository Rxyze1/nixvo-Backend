// Controllers/Chat/searchController.js

import Conversation from '../../../Models/Chat/ConversationModel.js';
import User         from '../../../Models/USER-Auth/User-Auth.-Model.js';
import Client       from '../../../Models/USER-Auth/Client-Model.js';
import Employee     from '../../../Models/USER-Auth/Employee-Model.js';

export const searchUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const searchTerm = q.trim();
    const skip       = (Number(page) - 1) * Number(limit);
    const escaped    = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex      = new RegExp(escaped, 'i');

    const searchQuery = {
      _id:      { $ne: currentUserId },
      canLogin: true,
      // ✅ officials/admin filter out — client/employee cannot view their profile
      userType: { $nin: ['officials', 'admin'] },
      status:   { $nin: ['banned', 'rejected', 'deleted'] },
      $or: [
        { fullname: regex },
        { username: regex },
        { email:    regex },
      ],
    };

    const [users, total] = await Promise.all([
      User.find(searchQuery)
        .select('fullname username email userType status')
        .sort({ fullname: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(searchQuery),
    ]);

    const userIds = users.map(u => u._id.toString());



    // ── Fetch profilePic from Client + Employee ───────────────
  // TO ✅
const [clients, employees] = await Promise.all([
  Client.find({ userId: { $in: userIds } }).select('userId profilePic isPremium').lean(),
  Employee.find({ userId: { $in: userIds } }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified').lean(),
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

employees.forEach(doc => {
  const id = doc.userId.toString();
  if (doc.profilePic) picMap[id] = doc.profilePic;
  const isPremium = doc.blueVerified?.status === true;
  badgeMap[id] = {
    badge: doc.hasBadge ? {
      show:  true, type: doc.badgeType, label: doc.badgeLabel,
      icon:  doc.badgeType === 'blue-verified' ? 'verified'     : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
      color: doc.badgeType === 'blue-verified' ? '#0066FF'       : doc.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
      bg:    doc.badgeType === 'blue-verified' ? '#EBF5FF'       : doc.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
    } : { show: false },
    blueVerified:  isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
    adminVerified: { status: doc.adminVerified?.status ?? false },
    tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
  };
});



    // ── Existing conversations ────────────────────────────────
    const existingConversations = await Conversation.find({
      type  : 'direct',
      status: { $ne: 'deleted' },
      $and  : [
        { 'participants.userId': currentUserId },
        { 'participants.userId': { $in: userIds } },
      ],
    }).select('participants').lean();

    const convoMap = {};
    for (const conv of existingConversations) {
      const other = conv.participants.find(
        p => p.userId.toString() !== currentUserId.toString()
      );
      if (other) convoMap[other.userId.toString()] = conv._id.toString();
    }

    // ── Enrich ───────────────────────────────────────────────
  // TO ✅
const enriched = users.map(user => ({
  ...user,
  profilePic:             picMap[user._id.toString()]   ?? null,
  existingConversationId: convoMap[user._id.toString()] ?? null,
  ...(badgeMap[user._id.toString()] ?? {}),
}));

    return res.status(200).json({
      success: true,
      data: {
        users: enriched,
        pagination: {
          total,
          page:       Number(page),
          limit:      Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
          hasMore:    skip + users.length < total,
        },
      },
    });

  } catch (err) {
    console.error('searchUsers error:', err);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
};
// ─────────────────────────────────────────────────────────────
// START / FIND DIRECT CONVERSATION  —  POST /api/chat/conversations/direct
// Called when user taps a search result to open a chat
// ─────────────────────────────────────────────────────────────

export const startDirectConversation = async (req, res) => {
  try {
    const userId      = req.user._id;
    const currentUser = req.user;
    const { targetUserId } = req.body;

    // ── Validate ──────────────────────────────────────────────
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId is required' });
    }

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start a conversation with yourself' });
    }

    // ── Verify target user ────────────────────────────────────
    const targetUser = await User.findById(targetUserId)
      .select('fullname username userType status canLogin profilePic');

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (['banned', 'rejected', 'deleted'].includes(targetUser.status)) {
      return res.status(403).json({ success: false, message: 'Cannot message this user' });
    }

    // ── Fetch profilePic + badge for target user ──────────────
    const [tClients, tEmployees] = await Promise.all([
      Client.find({ userId: targetUserId }).select('userId profilePic isPremium').lean(),
      Employee.find({ userId: targetUserId }).select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified').lean(),
    ]);

    const tClient   = tClients[0]   ?? null;
    const tEmployee = tEmployees[0] ?? null;

    const tPic       = tClient?.profilePic ?? tEmployee?.profilePic ?? targetUser.profilePic ?? null;
    const tIsPremium = tClient
      ? (tClient.isPremium ?? false)
      : (tEmployee?.blueVerified?.status === true);

    const tBadge = tEmployee?.hasBadge ? {
      show:  true,
      type:  tEmployee.badgeType,
      label: tEmployee.badgeLabel,
      icon:  tEmployee.badgeType === 'blue-verified'  ? 'verified'     : tEmployee.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
      color: tEmployee.badgeType === 'blue-verified'  ? '#0066FF'       : tEmployee.badgeType === 'admin-verified' ? '#00B37E'      : '#888',
      bg:    tEmployee.badgeType === 'blue-verified'  ? '#EBF5FF'       : tEmployee.badgeType === 'admin-verified' ? '#E6FAF5'      : '#f0f0f0',
    } : { show: false };

    // ── Find or create conversation ───────────────────────────
    const conversation = await Conversation.findOrCreateDirect(
      userId,
      targetUserId,
      { userType: currentUser.userType },
      { userType: targetUser.userType }
    );

    // ── Restore if soft-deleted by current user ───────────────
    const myParticipant = conversation.participants.find(
      p => (p.userId._id ?? p.userId).toString() === userId.toString()
    );
    if (myParticipant?.isDeleted) {
      await conversation.restoreForUser(userId);
    }

    // ── Return conversation + enriched target user ────────────
    return res.status(200).json({
      success: true,
      message: 'Conversation ready',
      data: {
        conversation,
        participant: {
          _id:          targetUser._id,
          fullname:     targetUser.fullname,
          username:     targetUser.username,
          userType:     targetUser.userType,
          status:       targetUser.status,
          profilePic:   tPic,
          isPremium:    tIsPremium,
          badge:        tBadge,
          blueVerified: tIsPremium
            ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
            : { status: false },
          adminVerified: { status: tEmployee?.adminVerified?.status ?? false },
          tier: tIsPremium ? 'premium' : tEmployee?.adminVerified?.status ? 'verified' : 'free',
        },
      },
    });

  } catch (err) {
    console.error('startDirectConversation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to start conversation' });
  }
};