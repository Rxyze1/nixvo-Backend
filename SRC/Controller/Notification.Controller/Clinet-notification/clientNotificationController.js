// Controllers/Notification/clientNotificationController.js

import Notification from '../../../Models/Notification-Model/Notification.js';
import Message         from '../../../Models/Chat/MessageModel.js';
import Conversation    from '../../../Models/Chat/ConversationModel.js';
import Application     from '../../../Models/USER-Auth/Employee/ApplicationModel.js';
import Job             from '../../../Models/USER-Auth/Client/Job.js';
import Employee        from '../../../Models/USER-Auth/Employee-Model.js';
import Client          from '../../../Models/USER-Auth/Client-Model.js';

import { sendPushNotification } from '../Notification-Helper/pushSender.js';
import { sendPush } from '../../../Service/Notification/firebasePushService.js';

import {
  successResponse,
  notFoundResponse,
  serverErrorResponse
} from '../../../Config/responseUtils.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *        🔔 CLIENT NOTIFICATION CONTROLLER (FIXED)
 *   Shows: Messages (grouped by conversation) + Applications + System Notifications
 * ═══════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
// HELPER: Enrich User with ProfilePic + Badge (Client or Employee)
// ══════════════════════════════════════════════════════════════

const enrichUsersWithBadges = async (userIds) => {
  try {
    const [clients, employees] = await Promise.all([
      Client.find({ userId: { $in: userIds } })
        .select('userId profilePic isPremium')
        .lean(),
      Employee.find({ userId: { $in: userIds } })
        .select('userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified subscription')
        .populate({
          path: 'subscription',
          select: 'plan subscriptionStatus planExpiresAt'
        })
        .lean(),
    ]);

    const picMap = {};
    const badgeMap = {};

    clients.forEach(doc => {
      const id = doc.userId.toString();
      if (doc.profilePic) picMap[id] = doc.profilePic;
      badgeMap[id] = {
        isPremium: doc.isPremium ?? false,
        blueVerified: doc.isPremium
          ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
          : { status: false },
        tier: doc.isPremium ? 'premium' : 'free',
      };
    });

    employees.forEach(doc => {
      const id = doc.userId.toString();
      if (doc.profilePic) picMap[id] = doc.profilePic;
      const isPremium = doc.blueVerified?.status === true ||
        (doc.subscription?.plan === 'premium' &&
         ['active', 'cancelled'].includes(doc.subscription?.subscriptionStatus) &&
         new Date() < new Date(doc.subscription?.planExpiresAt));

      badgeMap[id] = {
        badge: doc.hasBadge ? {
          show: true,
          type: doc.badgeType,
          label: doc.badgeLabel,
          icon: doc.badgeType === 'blue-verified' ? 'verified' : doc.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
          color: doc.badgeType === 'blue-verified' ? '#0066FF' : doc.badgeType === 'admin-verified' ? '#00B37E' : '#888',
          bg: doc.badgeType === 'blue-verified' ? '#EBF5FF' : doc.badgeType === 'admin-verified' ? '#E6FAF5' : '#f0f0f0',
        } : { show: false },
        blueVerified: isPremium
          ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
          : { status: false },
        adminVerified: { status: doc.adminVerified?.status ?? false },
        tier: isPremium ? 'premium' : doc.adminVerified?.status ? 'verified' : 'free',
      };
    });

    return { picMap, badgeMap };
  } catch (error) {
    console.error('❌ enrichUsersWithBadges error:', error.message);
    return { picMap: {}, badgeMap: {} };
  }
};

// ══════════════════════════════════════════════════════════════
// HELPER: Time Ago Formatter
// ══════════════════════════════════════════════════════════════

const getTimeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + 'y ago';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + 'm ago';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + 'd ago';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + 'h ago';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + 'min ago';
  return 'just now';
};

const isMessageUnreadByUser = (message, userIdStr) => {
  if (!message?.readBy || message.readBy.length === 0) return true;

  return !message.readBy.some(entry =>
    entry.userId?.toString() === userIdStr
  );
};

const getMessagePreviewText = (message) => {
  if (!message) return 'Sent a message';

  if (message.messageType === 'text') {
    const text = message.content?.text || 'Sent a message';
    return text.length > 100 ? `${text.substring(0, 100)}...` : text;
  }

  if (message.messageType === 'image') return '📷 Sent a photo';
  if (message.messageType === 'video') return '🎥 Sent a video';
  if (message.messageType === 'file') return '📎 Sent a file';
  if (message.messageType === 'audio' || message.messageType === 'voice') return '🎤 Sent a voice message';
  if (message.messageType === 'portfolio' || message.messageType === 'project') return '🔗 Shared something';

  return 'Sent a message';
};

// ══════════════════════════════════════════════════════════════
// 1️⃣ GET ALL CLIENT NOTIFICATIONS (Unified Feed)
// Shows: Messages (grouped by conversation) + Applications + System Notifications
// ═════════════════════════════════════════════════════════════

export const getClientNotifications = async (req, res) => {
  try {
    const clientId = req.user._id;
    const clientIdStr = clientId.toString();
    const { page = 1, limit = 20, type, unreadOnly = false } = req.query;
    const normalizedType = type === 'messages' ? 'message' : type;

    console.log('\n🔔 [GET CLIENT NOTIFICATIONS]');
    console.log(`👤 Client: ${req.user.fullname}`);
    console.log(`📄 Page: ${page}, Type: ${type || 'all'}, UnreadOnly: ${unreadOnly}\n`);

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // ── STEP 1: Get Conversations where client is participant ───
    const conversations = await Conversation.find({
      'participants.userId': clientId,
      'participants.isDeleted': false,
      status: { $ne: 'deleted' }
    })
    .populate('participants.userId', 'fullname username profilePic')
      .select('_id participants lastMessage metadata')
      .sort({ 'metadata.lastActivity': -1 })
      .lean();

    const conversationIds = conversations.map(c => c._id);
    const conversationById = new Map(
      conversations.map(conversation => [conversation._id.toString(), conversation])
    );

    // ── STEP 2: Get Messages from these conversations ───────────────
    let incomingMessages = [];
    let unreadIncomingMessages = [];

    if (conversationIds.length > 0) {
      incomingMessages = await Message.find({
        conversationId: { $in: conversationIds },
        isDeleted: false,
        senderId: { $ne: clientId },
      })
        .populate('senderId', 'fullname username userType email profilePic')
        .sort({ createdAt: -1 })
        .lean();

      unreadIncomingMessages = incomingMessages.filter(message =>
        isMessageUnreadByUser(message, clientIdStr)
      );
    }

    console.log(`📨 Fetched ${incomingMessages.length} incoming messages`);
    console.log(`🆕 Unread incoming messages: ${unreadIncomingMessages.length}\n`);

    // ── STEP 3: Get System Notifications ─────────────────────
    const notifQuery = { userId: clientId };
    
    if (normalizedType && normalizedType !== 'all' && normalizedType !== 'message') {
      notifQuery.type = normalizedType;
    }
    if (unreadOnly === 'true') {
      notifQuery.isRead = false;
    }

    const systemNotifications = await Notification.find(notifQuery)
      .sort({ createdAt: -1 })
      .limit(limitNum * 2)
      .lean();

    // ── STEP 4: Get Recent Applications on Client's Jobs ─────
    const clientJobs = await Job.find({ userId: clientId })
      .select('_id jobTitle')
      .lean();
    const clientJobIds = clientJobs.map(j => j._id);

    const recentApplications = await Application.find({
      jobId: { $in: clientJobIds },
      status: 'pending'
    })
      // ✅ FIX: Removed double populate. Just populate the employee, 
      // then we grab the userId info safely in the formatting step below.
      .populate({
        path: 'employeeId',
        select: 'userId fullname username email profilePicture',
      })
      .sort({ appliedAt: -1 })
      .limit(10)
      .lean();

    // ── STEP 5: Collect all User IDs for batch enrichment ─────
    const unreadConversationStats = new Map();

    unreadIncomingMessages.forEach(message => {
      const conversationId = message.conversationId?.toString();
      if (!conversationId) return;

      if (!unreadConversationStats.has(conversationId)) {
        unreadConversationStats.set(conversationId, {
          latestMessage: message,
          unreadCount: 0,
        });
      }

      unreadConversationStats.get(conversationId).unreadCount += 1;
    });

    const latestUnreadMessages = Array.from(unreadConversationStats.values()).map(
      stats => stats.latestMessage
    );

    const messageSenderIds = [
      ...new Set(latestUnreadMessages.map(m => 
        (m.senderId?._id || m.senderId)?.toString()
      ).filter(Boolean))
    ];

    const applicationEmployeeIds = [
      ...new Set(recentApplications.map(app =>
        app.employeeId?.userId?._id?.toString()
      ).filter(Boolean))
    ];

    const allUserIds = [...new Set([...messageSenderIds, ...applicationEmployeeIds])];

    const { picMap, badgeMap } = await enrichUsersWithBadges(allUserIds);

    // ══════════════════════════════════════════════════════════════
    // STEP 6: Format MESSAGE NOTIFICATIONS
    // ══════════════════════════════════════════════════════════════

    const formattedMessages = Array.from(unreadConversationStats.entries()).map(([convId, stats]) => {
      const message = stats.latestMessage;
      const sender = message.senderId;
      const parentConversation = conversationById.get(convId);
      const otherParticipant = parentConversation?.participants?.find(participant => {
        const participantId = (participant.userId?._id || participant.userId)?.toString();
        return participantId !== clientIdStr;
      })?.userId;
      const senderRef = sender || otherParticipant;
      const senderIdStr = (senderRef?._id || senderRef)?.toString();
      const senderName = sender?.fullname || otherParticipant?.fullname || 'Someone';

      return {
        id: `msg_${message._id}`,
        type: 'message',
        title: `💬 New message from ${senderName}`,
        message: getMessagePreviewText(message),
        
        sender: senderRef ? {
          id: senderRef._id || senderRef,
          _id: senderRef._id || senderRef,
          fullname: senderRef.fullname || otherParticipant?.fullname,
          username: senderRef.username || otherParticipant?.username,
          userType: senderRef.userType || otherParticipant?.userType,
          profilePicture: picMap[senderIdStr] || senderRef.profilePic || otherParticipant?.profilePic || null,
          profilePic: picMap[senderIdStr] || senderRef.profilePic || otherParticipant?.profilePic || null,
          ...(badgeMap[senderIdStr] || {}),
        } : null,

        related: {
          conversationId: message.conversationId,
          messageId: message._id,
        },
        actionUrl: `/chat/${message.conversationId}`,
        priority: 'normal',
        isRead: false,
        createdAt: message.createdAt,
        timeAgo: getTimeAgo(message.createdAt),
        source: 'message',
        unreadCount: stats.unreadCount,
      };
    });
    // ── STEP 7: Format APPLICATION NOTIFICATIONS ─────────────────────
    const formattedApplications = recentApplications.map(app => {
      const empUserId = app.employeeId?.userId?._id?.toString();
      
      return {
        id: `app_${app._id}`,
        type: 'new_application',
        title: `📬 New Application Received`,
        message: `${app.applicantName || app.employeeId?.userId?.fullname || 'Someone'} applied to "${app.jobTitle}"`,
        
        sender: app.employeeId?.userId ? {
          id: app.employeeId.userId._id,
          fullname: app.employeeId.userId.fullname || app.applicantName,
          username: app.employeeId.userId.username,
          userType: 'employee',
          profilePicture: picMap[empUserId] || app.employeeId?.profilePic || app.applicantProfilePicture || null,
          ...(badgeMap[empUserId] || {}),
        } : null,

        related: {
          jobId: app.jobId,
          applicationId: app._id,
          jobTitle: app.jobTitle,
        },

        actionUrl: `/client/applications/${app._id}`,
        priority: 'high',
        isRead: false,
        createdAt: app.appliedAt,
        timeAgo: getTimeAgo(app.appliedAt),
        source: 'application',
      };
    });

    // ── STEP 8: Format SYSTEM NOTIFICATIONS ───────────────────
    const formattedSystemNotifications = systemNotifications.map(notif => ({
      id: notif._id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      sender: notif.data?.senderId ? {
        id: notif.data.senderId,
      } : null,
      related: {
        jobId: notif.data?.jobId,
        applicationId: notif.data?.applicationId,
        conversationId: notif.data?.conversationId,
      },
      actionUrl: notif.actionUrl || null,
      priority: notif.priority || 'normal',
      isRead: notif.isRead,
      createdAt: notif.createdAt,
      timeAgo: getTimeAgo(notif.createdAt),
      source: 'system',
    }));

    // ── STEP 9: Merge & Sort by Date (newest first) ───────────
    let mergedNotifications = [
      ...formattedMessages,
      ...formattedApplications,
      ...formattedSystemNotifications,
    ];

    mergedNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (normalizedType && normalizedType !== 'all') {
      mergedNotifications = mergedNotifications.filter(notification => notification.type === normalizedType);
    }

    const totalCount = mergedNotifications.length;
    const finalNotifications = mergedNotifications.slice(skip, skip + limitNum);

    // Group by category for UI tabs
    const grouped = {
      messages: finalNotifications.filter(n => n.source === 'message'),
      applications: finalNotifications.filter(n => n.source === 'application'),
      system: finalNotifications.filter(n => n.source === 'system'),
    };

    // Summary counts
    const summary = {
      total: totalCount,
      unread: mergedNotifications.filter(n => !n.isRead).length,
      messages: formattedMessages.filter(n => !n.isRead).length, // ✅ Fixed: only count unread
      applications: formattedApplications.length,
      system: formattedSystemNotifications.filter(n => !n.isRead).length,
    };

    console.log(`✅ Found ${finalNotifications.length} notifications for client`);
    console.log(`   📨 Messages: ${formattedMessages.length} (grouped by conversation)`);
    console.log(`   📋 Applications: ${formattedApplications.length}`);
    console.log(`   🔔 System: ${formattedSystemNotifications.length}\n`);

    return successResponse(res, {
      notifications: finalNotifications,
      grouped,
      summary,
      pagination: {
        currentPage: pageNum,
        itemsPerPage: limitNum,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNextPage: skip + finalNotifications.length < totalCount,
      }
    }, '✅ Client notifications retrieved');

  } catch (error) {
    console.error('❌ getClientNotifications error:', error);
    return serverErrorResponse(res, error, 'Failed to fetch client notifications');
  }
};

// ═════════════════════════════════════════════════════════════════
// 2️⃣ GET UNREAD COUNT (Lightweight — for bell icon) - ✅ FIXED
// ═══════════════════════════════════════════════════════════

export const getClientUnreadCount = async (req, res) => {
  try {
    const clientId = req.user._id;
    const clientIdStr = clientId.toString();

    // Count unread messages (grouped by conversation)
    const conversations = await Conversation.find({
      'participants.userId': clientId,
      'participants.isDeleted': false,
      status: { $ne: 'deleted' }
    }).select('_id participants').lean();

    const conversationIds = conversations.map(c => c._id);
    
    // ✅ FIX #1: Use JavaScript filtering (100% accurate like Employee controller)
    let unreadMessagesCount = 0;

    if (conversationIds.length > 0) {
      const allMessages = await Message.find({
        conversationId: { $in: conversationIds },
        senderId: { $ne: clientId },
        isDeleted: false,
      }).select('readBy').lean();

      // Count where user is NOT in readBy array
      unreadMessagesCount = allMessages.filter(message =>
        isMessageUnreadByUser(message, clientIdStr)
      ).length;
    }

    // Count unread system notifications
    const unreadSystemCount = await Notification.countDocuments({
      userId: clientId,
      isRead: false,
    });

    // Count pending applications using timestamp
    const clientProfile = await Client.findOne({ userId: clientId })
      .select('lastViewedApplicationUpdates')
      .lean();
    
    const lastViewedAt = clientProfile?.lastViewedApplicationUpdates;

    let pendingAppsCount;

    if (!lastViewedAt) {
      // Never viewed → show only last 3 days worth
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      const clientJobs = await Job.find({ userId: clientId }).select('_id').lean();
      const clientJobIds = clientJobs.map(j => j._id);
      
      pendingAppsCount = await Application.countDocuments({
        jobId: { $in: clientJobIds },
        status: 'pending',
        createdAt: { $gte: threeDaysAgo },
      });
    } else {
      // Viewed before → only count NEW applications since then
      const clientJobs = await Job.find({ userId: clientId }).select('_id').lean();
      const clientJobIds = clientJobs.map(j => j._id);
      
      pendingAppsCount = await Application.countDocuments({
        jobId: { $in: clientJobIds },
        status: 'pending',
        createdAt: { $gt: lastViewedAt },
      });
    }

    const totalUnread = unreadMessagesCount + unreadSystemCount + pendingAppsCount;

    console.log(`📊 Unread breakdown:`);
    console.log(`   Messages: ${unreadMessagesCount}`);
    console.log(`   System: ${unreadSystemCount}`);
    console.log(`   Applications: ${pendingAppsCount}`);
    console.log(`   TOTAL: ${totalUnread}\n`);

    return successResponse(res, {
      unreadCount: totalUnread,
      breakdown: {
        messages: unreadMessagesCount,
        system: unreadSystemCount,
        applications: pendingAppsCount,
      }
    }, '✅ Unread count retrieved');

  } catch (error) {
    console.error('❌ getClientUnreadCount error:', error);
    return serverErrorResponse(res, error, 'Failed to fetch unread count');
  }
};

// ═══════════════════════════════════════════════════════════════
// 3️⃣ MARK NOTIFICATION AS READ
// Works for both messages and system notifications
// ═══════════════════════════════════════════════════════════

export const markClientNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params; // Can be msg_123 or notif_123
    const clientId = req.user._id;
    const clientIdStr = clientId.toString();

    console.log(`\n✅ [MARK AS READ] ${notificationId}`);

    if (notificationId.startsWith('msg_')) {
      const messageId = notificationId.replace('msg_', '');
      const message = await Message.findById(messageId);

      if (!message) {
        return notFoundResponse(res, 'Message not found');
      }

      const conversationMessages = await Message.find({
        conversationId: message.conversationId,
        senderId: { $ne: clientId },
        isDeleted: false,
      }).select('_id readBy').lean();

      const unreadConversationMessages = conversationMessages.filter(convMessage =>
        isMessageUnreadByUser(convMessage, clientIdStr)
      );

      if (unreadConversationMessages.length > 0) {
        await Message.bulkWrite(
          unreadConversationMessages.map(convMessage => ({
            updateOne: {
              filter: { _id: convMessage._id },
              update: {
                $push: { readBy: { userId: clientId, readAt: new Date() } },
                $set: { status: 'read' }
              }
            }
          }))
        );
      }

      await Conversation.updateOne(
        { _id: message.conversationId },
        { $set: { 'participants.$[elem].unreadCount': 0, 'participants.$[elem].lastReadAt': new Date() } },
        { arrayFilters: [{ 'elem.userId': clientId }] }
      );

    } else if (notificationId.startsWith('app_')) {
      // It's an application - acknowledge it
      return successResponse(res, null, 'Application viewed');

    } else {
      // It's a system notification
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: clientId },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true }
      );

      if (!notification) {
        return notFoundResponse(res, 'Notification not found');
      }
    }

    return successResponse(res, null, '✅ Marked as read');

  } catch (error) {
    console.error('❌ markClientNotificationAsRead error:', error);
    return serverErrorResponse(res, error, 'Failed to mark as read');
  }
};

// ═══════════════════════════════════════════════════════════════
// 4️⃣ MARK ALL AS READ - ✅ FIXED (#2)
// ═══════════════════════════════════════════════════════════

export const markAllClientAsRead = async (req, res) => {
  try {
    const clientId = req.user._id;
    const clientIdStr = clientId.toString();

    console.log('\n✅ [MARK ALL AS READ - CLIENT]');
    console.log(`👤 Client ID: ${clientIdStr}\n`);

    // ── 1. Mark all system notifications as read ──────────────
    const notifResult = await Notification.updateMany(
      { userId: clientId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    console.log(`📔 System notifications marked: ${notifResult.modifiedCount}`);

    // ── 2. Get all conversations ──────────────────────────────
    const conversations = await Conversation.find({
      'participants.userId': clientId,
      'participants.isDeleted': false,
    }).select('_id').lean();

    const conversationIds = conversations.map(c => c._id);
    console.log(`💬 Found ${conversationIds.length} conversations`);

    if (conversationIds.length > 0) {
      // ── 3. Mark ALL messages as read (bulletproof loop approach) ──
      
      // Step A: Find all messages from OTHERS in these conversations
      const allMessages = await Message.find({
        conversationId: { $in: conversationIds },
        senderId: { $ne: clientId },
        isDeleted: false,
      }).select('_id readBy').lean();

      console.log(`📨 Found ${allMessages.length} total messages from others`);

      let updatedCount = 0;

      // Step B: Update each message individually (100% accurate)
      for (const msg of allMessages) {
        const alreadyRead = msg.readBy?.some(r => 
          r.userId?.toString() === clientIdStr
        );

        if (!alreadyRead) {
          await Message.updateOne(
            { _id: msg._id },
            {
              $push: { readBy: { userId: clientId, readAt: new Date() } },
              $set: { status: 'read' }
            }
          );
          updatedCount++;
        }
      }

      console.log(`✅ Updated ${updatedCount} messages to READ`);

      // ── 4. Reset conversation unread counts ───────────────────
      await Conversation.updateMany(
        { _id: { $in: conversationIds }, 'participants.userId': clientId },
        { 
          $set: { 
            'participants.$.unreadCount': 0, 
            'participants.$.lastReadAt': new Date() 
          } 
        }
      );
      console.log('🔄 Reset conversation unread counts');
    }

    // ── 5. Save timestamp for application tracking ─────────────
    await Client.findOneAndUpdate(
      { userId: clientId },
      { $set: { lastViewedApplicationUpdates: new Date() } }
    );
    console.log('⏰ Saved lastViewedApplicationUpdates');

    return successResponse(res, null, '✅ All marked as read');

  } catch (error) {
    console.error('❌ markAllClientAsRead error:', error);
    return serverErrorResponse(res, error, 'Failed to mark all as read');
  }
};

// ═══════════════════════════════════════════════════════════════
// 5️⃣ DELETE NOTIFICATION
// ═════════════════════════════════════════════════════════════

export const deleteClientNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const clientId = req.user._id;

    if (notificationId.startsWith('msg_')) {
      const messageId = notificationId.replace('msg_', '');
      const message = await Message.findOne({
        _id: messageId,
        senderId: clientId,
      });

      if (!message) {
        return notFoundResponse(res, 'Message not found');
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedBy = clientId;
      await message.save();

    } else {
      const result = await Notification.findOneAndDelete({
        _id: notificationId,
        userId: clientId,
      });

      if (!result) {
        return notFoundResponse(res, 'Notification not found');
      }
    }

    return successResponse(res, null, '✅ Deleted successfully');

  } catch (error) {
    console.error('❌ deleteClientNotification error:', error);
    return serverErrorResponse(res, error, 'Failed to delete');
  }
};


// ═══════════════════════════════════════════════════════════════
// 🚀 TRIGGER FUNCTION FOR CLIENT NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

export const triggerClientPush = async (type, payload) => {
  let title = '';
  let body = '';
  let navData = {};

  switch (type) {
    case 'NEW_APPLICATION':
      title = `📬 New Application`;
      body = `${payload.employeeName || 'Someone'} applied to "${payload.jobTitle || 'your job'}"`;
      navData = { screen: 'JobApplications', jobId: payload.jobId };
      break;

    case 'NEW_MESSAGE':
      title = `💬 ${payload.senderName || 'Someone'}`;
      body = payload.messagePreview || 'Sent you a message';
      navData = { 
        screen: 'MessageScreen', 
        conversationId: payload.conversationId,
        senderId: payload.senderId || '', 
        senderName: payload.senderName || '', 
        senderProfilePic: payload.senderProfilePic || '', 
        senderType: payload.senderType || '',
      };
      break;

    case 'APPLICATION_ACCEPTED':
      title = `✅ Hired!`;
      body = `You accepted ${payload.employeeName}'s application.`;
      navData = { 
        screen: 'MessageScreen', 
        conversationId: payload.conversationId,
        senderId: payload.employeeId || payload.employeeUserId || '', 
        senderName: payload.employeeName || 'Employee',
        senderProfilePic: payload.employeeProfilePic || '',
      };
      break;
      
    default:
      console.log(`[Client Push] Unknown type: ${type}`);
      return;
  }

  // ✅ NEW CLEAN CALL -> Notice we pass payload.clientId here!!!
  await sendPush({ 
      userId: payload.clientId, 
      title, 
      body, 
      data: navData 
  });
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════

export default {
  getClientNotifications,
  getClientUnreadCount,
  markClientNotificationAsRead,
  markAllClientAsRead,
  deleteClientNotification,
   triggerClientPush, 
};
