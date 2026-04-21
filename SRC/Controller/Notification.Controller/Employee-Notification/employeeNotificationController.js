// Controllers/Notification/employeeNotificationController.js

import Notification from '../../../Models/Notification-Model/Notification.js';
import Message         from '../../../Models/Chat/MessageModel.js';
import Conversation    from '../../../Models/Chat/ConversationModel.js';
import Application     from '../../../Models/USER-Auth/Employee/ApplicationModel.js';
import Job             from '../../../Models/USER-Auth/Client/Job.js';
import User            from '../../../Models/USER-Auth/User-Auth.-Model.js';
import Employee        from '../../../Models/USER-Auth/Employee-Model.js';
import Client          from '../../../Models/USER-Auth/Client-Model.js';

import { sendPushNotification } from '../Notification-Helper/pushSender.js';
import { sendPush } from '../../../Service/Notification/firebasePushService.js';

import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse
} from '../../../Config/responseUtils.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *      👷 EMPLOYEE NOTIFICATION CONTROLLER (FIXED)
 *  Shows: Messages (grouped by conversation) + Application Status + System
 * ═══════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
// HELPER: Enrich User with ProfilePic + Badge (same as client)
// ══════════════════════════════════════════════════════════════

const enrichUsersWithBadges = async (userIds) => {
  try {
    const [clients, employees] = await Promise.all([
      Client.find({ userId: { $in: userIds } })
        .select('userId profilePic isPremium company_name')
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
        companyName: doc.company_name || null,
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

// ══════════════════════════════════════════════════════════════
// 1️⃣ GET ALL EMPLOYEE NOTIFICATIONS (Unified Feed)
// ══════════════════════════════════════════════════════════════

export const getEmployeeNotifications = async (req, res) => {
  try {
    const employeeUserId = req.user._id;
    const employeeUserIdStr = employeeUserId.toString();
    const { page = 1, limit = 20, type, unreadOnly = false } = req.query;

    console.log('\n🔔 [GET EMPLOYEE NOTIFICATIONS]');
    console.log(`👤 Employee: ${req.user.fullname}`);
    console.log(`📄 Page: ${page}, Type: ${type || 'all'}, UnreadOnly: ${unreadOnly}\n`);

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // ── STEP 1: Get Conversations ──────────────────────────────
    const conversations = await Conversation.find({
      'participants.userId': employeeUserId,
      'participants.isDeleted': false,
      status: { $ne: 'deleted' }
    })
      .select('_id participants lastMessage metadata')
      .sort({ 'metadata.lastActivity': -1 })
      .lean();

    const conversationIds = conversations.map(c => c._id);
    console.log(`💬 Found ${conversationIds.length} conversations`);

    // ── STEP 2: Get Messages ─────────────────────────────────
    const messageQuery = {
      conversationId: { $in: conversationIds },
      isDeleted: false,
      senderId: { $ne: employeeUserId },
    };

    let allMessages = await Message.find(messageQuery)
      .populate('senderId', 'fullname username userType email profilePic')
      .sort({ createdAt: -1 })
      .limit(limitNum * 3) // Fetch extra for grouping
      .lean();

    console.log(`📨 Fetched ${allMessages.length} total messages`);

    // ✅ Filter unread in JavaScript (100% accurate)
    if (unreadOnly === 'true') {
      const beforeFilter = allMessages.length;
      allMessages = allMessages.filter(msg => {
        if (!msg.readBy || msg.readBy.length === 0) return true;
        return !msg.readBy.some(r => r.userId?.toString() === employeeUserIdStr);
      });
      console.log(`🔍 After unread filter: ${allMessages.length} (removed ${beforeFilter - allMessages.length} read messages)`);
    }

    // ── STEP 3: Get System Notifications ──────────────────────
    const notifQuery = { userId: employeeUserId };
    
    if (type && type !== 'all' && type !== 'messages') {
      notifQuery.type = type;
    }
    if (unreadOnly === 'true') {
      notifQuery.isRead = false;
    }

    const systemNotifications = await Notification.find(notifQuery)
      .sort({ createdAt: -1 })
      .limit(limitNum * 2)
      .lean();

    // ── STEP 4: Get Application Status Changes ─────────────────
    const myApplications = await Application.find({
      applicantId: employeeUserId,
    })
      .populate('jobId', 'jobTitle price currency userId status')
      .populate({
        path: 'jobId',
        populate: {
          path: 'userId',
          select: 'fullname username company_name profilePic'
        }
      })
      .sort({ updatedAt: -1 })
      .limit(15)
      .lean();

    // ✅ Use saved timestamp instead of hardcoded 7 days
    const employeeProfile = await Employee.findOne({ userId: employeeUserId })
      .select('lastViewedApplicationUpdates')
      .lean();
    
    const lastViewedAppsAt = employeeProfile?.lastViewedApplicationUpdates;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Only show apps updated AFTER user last viewed them
    const recentStatusChanges = myApplications.filter(app => {
      if (!['accepted', 'rejected'].includes(app.status)) return false;
      
      const appUpdatedAt = new Date(app.updatedAt);
      
      if (!lastViewedAppsAt) {
        return appUpdatedAt > sevenDaysAgo;
      }
      
      return appUpdatedAt > new Date(lastViewedAppsAt);
    });

    console.log(`📋 Application updates: ${recentStatusChanges.length}`);

    // ── STEP 5: Collect User IDs for enrichment ───────────────
    const messageSenderIds = [
      ...new Set(allMessages.map(m => 
        (m.senderId?._id || m.senderId)?.toString()
      ).filter(Boolean))
    ];

    const applicationClientIds = [
      ...new Set(recentStatusChanges.map(app =>
        app.jobId?.userId?._id?.toString()
      ).filter(Boolean))
    ];

    const allUserIds = [...new Set([...messageSenderIds, ...applicationClientIds])];

    const { picMap, badgeMap } = await enrichUsersWithBadges(allUserIds);

    // ══════════════════════════════════════════════════════════════
    // ✅✅✅ STEP 6: Format MESSAGES (GROUPED BY CONVERSATION)
    // Shows: Only NEW people who messaged you (1 per conversation)
    // ══════════════════════════════════════════════════════════════

    // Group messages by conversation (keep only latest per conversation)
    const conversationMap = new Map();
    
    allMessages.forEach(msg => {
      const convId = msg.conversationId?.toString();
      
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, msg); // Only keep latest message
      }
    });

    // Convert to array and format
    const formattedMessages = Array.from(conversationMap.values()).map(msg => {
      const senderIdStr = (msg.senderId?._id || msg.senderId)?.toString();
      const convId = msg.conversationId?.toString(); // Define here for use below
      
      let previewText = '';
      if (msg.messageType === 'text') {
        previewText = msg.content?.text || 'Sent a message';
        if (previewText.length > 100) previewText = previewText.substring(0, 100) + '...';
      } else if (msg.messageType === 'image') {
        previewText = '📷 Sent a photo';
      } else if (msg.messageType === 'video') {
        previewText = '🎥 Sent a video';
      } else if (msg.messageType === 'file') {
        previewText = '📎 Sent a file';
      } else {
        previewText = 'Sent a message';
      }

      // Count unread messages in this conversation
      const totalInConv = allMessages.filter(m => 
        m.conversationId?.toString() === convId
      ).length;

      // Accurate read check using string comparison
      const isActuallyRead = msg.readBy?.some(r => 
        r.userId?.toString() === employeeUserIdStr
      ) || false;

      return {
        id: `msg_${msg._id}`,
        type: 'message',
        title: `💬 New message from ${msg.senderId?.fullname || 'Someone'}`,
        message: previewText,
        
        sender: msg.senderId ? {
          id: msg.senderId._id || msg.senderId,
          fullname: msg.senderId.fullname,
          username: msg.senderId.username,
          userType: msg.senderId.userType,
          profilePicture: picMap[senderIdStr] || msg.senderId.profilePicture || null,
          ...(badgeMap[senderIdStr] || {}),
        } : null,

        related: {
          conversationId: msg.conversationId,
          messageId: msg._id,
        },

        actionUrl: `/chat/${msg.conversationId}`,
        priority: 'normal',
        isRead: isActuallyRead,
        createdAt: msg.createdAt,
        timeAgo: getTimeAgo(msg.createdAt),
        source: 'message',
        
        // Unread count for this conversation
        unreadCount: totalInConv - (isActuallyRead ? 1 : 0),
      };
    });

    // ── STEP 7: Format APPLICATION UPDATES ─────────────────────
    const formattedApplicationUpdates = recentStatusChanges.map(app => {
      const clientUserId = app.jobId?.userId?._id?.toString();
      
      return {
        id: `app_update_${app._id}`,
        type: app.status === 'accepted' ? 'application_accepted' : 'application_rejected',
        title: app.status === 'accepted' 
          ? '🎉 Application Accepted!' 
          : '📋 Application Updated',
        message: app.status === 'accepted'
          ? `${app.jobId?.userId?.fullname || 'Client'} accepted your application for "${app.jobId?.jobTitle}"`
          : `${app.jobId?.userId?.fullname || 'Client'} has made a decision on your application for "${app.jobId?.jobTitle}"`,
        
        sender: app.jobId?.userId ? {
          id: app.jobId.userId._id,
          fullname: app.jobId.userId.fullname,
          username: app.jobId.userId.username,
          userType: 'client',
          profilePicture: picMap[clientUserId] || app.jobId.userId.profilePic || null,
          companyName: badgeMap[clientUserId]?.companyName || null,
          ...(badgeMap[clientUserId] || {}),
        } : null,

        related: {
          jobId: app.jobId?._id,
          applicationId: app._id,
          jobTitle: app.jobId?.jobTitle,
          status: app.status,
        },

        actionUrl: `/jobs/${app.jobId?._id}`,
        priority: 'high',
        isRead: false, // Always "new" until explicitly viewed
        createdAt: app.updatedAt || app.appliedAt,
        timeAgo: getTimeAgo(app.updatedAt || app.appliedAt),
        source: 'application_update',
      };
    });

    // ── STEP 8: Format SYSTEM NOTIFICATIONS ────────────────────
    const formattedSystemNotifications = systemNotifications.map(notif => ({
      id: notif._id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      sender: notif.data?.senderId ? { id: notif.data.senderId } : null,
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

    // ── STEP 9: Merge & Sort ──────────────────────────────────
    let mergedNotifications = [
      ...formattedMessages,
      ...formattedApplicationUpdates,
      ...formattedSystemNotifications,
    ];

    mergedNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply unread filter AGAIN after merge (for safety)
    if (unreadOnly === 'true') {
      mergedNotifications = mergedNotifications.filter(n => !n.isRead);
    }


if (type && type !== 'all') {
  mergedNotifications = mergedNotifications.filter(n => n.type === type);
}
const totalCount = mergedNotifications.length;
const finalNotifications = mergedNotifications.slice(skip, skip + limitNum);

    const grouped = {
      messages: finalNotifications.filter(n => n.source === 'message'),
      applications: finalNotifications.filter(n => n.source === 'application_update'),
      system: finalNotifications.filter(n => n.source === 'system'),
    };

    // Accurate summary counts
    const summary = {
      total: totalCount,
      unread: mergedNotifications.filter(n => !n.isRead).length,
      messages: formattedMessages.filter(n => !n.isRead).length,
      applications: formattedApplicationUpdates.length, // Always counted as "unread"
      system: formattedSystemNotifications.filter(n => !n.isRead).length,
    };

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total notifications: ${totalCount}`);
    console.log(`   Unread: ${summary.unread}`);
    console.log(`   Messages (unread): ${summary.messages}`);
    console.log(`   Applications: ${summary.applications}`);
    console.log(`   System (unread): ${summary.system}\n`);
    console.log(`✅ Returning ${finalNotifications.length} notifications\n`);

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
    }, '✅ Employee notifications retrieved');

  } catch (error) {
    console.error('❌ getEmployeeNotifications error:', error);
    return serverErrorResponse(res, error, 'Failed to fetch employee notifications');
  }
};

// ══════════════════════════════════════════════════════════════
// 2️⃣ GET UNREAD COUNT
// ══════════════════════════════════════════════════════════════

export const getEmployeeUnreadCount = async (req, res) => {
  try {
    const employeeUserId = req.user._id;
    const employeeUserIdStr = employeeUserId.toString();

    const conversations = await Conversation.find({
      'participants.userId': employeeUserId,
      'participants.isDeleted': false,
      status: { $ne: 'deleted' }
    }).select('_id').lean();

    const conversationIds = conversations.map(c => c._id);
    
    let unreadMessagesCount = 0;

    if (conversationIds.length > 0) {
      const allMessages = await Message.find({
        conversationId: { $in: conversationIds },
        senderId: { $ne: employeeUserId },
        isDeleted: false,
      })
        .select('readBy')
        .lean();

      unreadMessagesCount = allMessages.filter(msg => {
        if (!msg.readBy || msg.readBy.length === 0) return true;
        return !msg.readBy.some(r => r.userId?.toString() === employeeUserIdStr);
      }).length;
    }

    const unreadSystemCount = await Notification.countDocuments({
      userId: employeeUserId,
      isRead: false,
    });

    const employeeProfile = await Employee.findOne({ userId: employeeUserId })
      .select('lastViewedApplicationUpdates')
      .lean();
    
    const lastViewedAt = employeeProfile?.lastViewedApplicationUpdates;
    
    let recentStatusChanges = 0;
    
    if (!lastViewedAt) {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      recentStatusChanges = await Application.countDocuments({
        applicantId: employeeUserId,
        status: { $in: ['accepted', 'rejected'] },
        updatedAt: { $gte: threeDaysAgo },
      });
    } else {
      recentStatusChanges = await Application.countDocuments({
        applicantId: employeeUserId,
        status: { $in: ['accepted', 'rejected'] },
        updatedAt: { $gt: lastViewedAt },
      });
    }

    const totalUnread = unreadMessagesCount + unreadSystemCount + recentStatusChanges;

    console.log(`📊 Unread breakdown:`);
    console.log(`   Messages: ${unreadMessagesCount}`);
    console.log(`   System: ${unreadSystemCount}`);
    console.log(`   App Updates: ${recentStatusChanges}`);
    console.log(`   TOTAL: ${totalUnread}\n`);

    return successResponse(res, {
      unreadCount: totalUnread,
      breakdown: {
        messages: unreadMessagesCount,
        system: unreadSystemCount,
        applicationUpdates: recentStatusChanges,
      }
    }, '✅ Unread count retrieved');

  } catch (error) {
    console.error('❌ getEmployeeUnreadCount error:', error);
    return serverErrorResponse(res, error, 'Failed to fetch unread count');
  }
};

// ══════════════════════════════════════════════════════════════
// 3️⃣ MARK AS READ
// ══════════════════════════════════════════════════════════════

export const markEmployeeNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const employeeUserId = req.user._id;

    
if (notificationId.startsWith('msg_')) {

  const messageId = notificationId.replace('msg_', '');
  const message = await Message.findById(messageId);
  if (!message) return notFoundResponse(res, 'Message not found');

  // Mark ALL messages in this conversation as read, not just the one
  const allConvMsgs = await Message.find({
    conversationId: message.conversationId,
    senderId: { $ne: employeeUserId },
    isDeleted: false,
  }).select('_id readBy').lean();

  const bulkOps = allConvMsgs
    .filter(m => !m.readBy?.some(r => r.userId?.toString() === employeeUserId.toString()))
    .map(m => ({
      updateOne: {
        filter: { _id: m._id },
        update: {
          $push: { readBy: { userId: employeeUserId, readAt: new Date() } },
          $set: { status: 'read' }
        }
      }
    }));

  if (bulkOps.length > 0) await Message.bulkWrite(bulkOps);

  // Reset unread count on conversation using arrayFilters (same fix as Bug 1)
  await Conversation.updateOne(
    { _id: message.conversationId },
    { $set: { 'participants.$[elem].unreadCount': 0, 'participants.$[elem].lastReadAt': new Date() } },
    { arrayFilters: [{ 'elem.userId': employeeUserId }] }
  );
    } else if (notificationId.startsWith('app_update_')) {
      
  await Employee.findOneAndUpdate(
  { userId: employeeUserId },
  { $set: { lastViewedApplicationUpdates: new Date() } },
  { upsert: true }
)
  
    } else {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: employeeUserId },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true }
      );

      if (!notification) return notFoundResponse(res, 'Notification not found');
    }

    return successResponse(res, null, '✅ Marked as read');

  } catch (error) {
    console.error('❌ markEmployeeNotificationAsRead error:', error);
    return serverErrorResponse(res, error, 'Failed to mark as read');
  }
};

// ══════════════════════════════════════════════════════════════
// 4️⃣ MARK ALL AS READ (Fixed duplicate code)
// ══════════════════════════════════════════════════════════════

export const markAllEmployeeAsRead = async (req, res) => {
  try {
    const employeeUserId = req.user._id;
    const employeeUserIdStr = employeeUserId.toString();

    console.log('\n✅ [MARK ALL AS READ]');
    console.log(`👤 User ID: ${employeeUserIdStr}\n`);

    // ── 1. Mark system notifications ──────────────────────────
    const notifResult = await Notification.updateMany(
      { userId: employeeUserId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    console.log(`📔 System notifications marked: ${notifResult.modifiedCount}`);

    // ── 2. Get all conversations ──────────────────────────────
    const conversations = await Conversation.find({
      'participants.userId': employeeUserId,
      'participants.isDeleted': false,
    }).select('_id').lean();

    const conversationIds = conversations.map(c => c._id);
    console.log(`💬 Found ${conversationIds.length} conversations`);

    if (conversationIds.length > 0) {
      // ── 3. Mark ALL messages as read (bulletproof loop) ──
      const allMessages = await Message.find({
        conversationId: { $in: conversationIds },
        senderId: { $ne: employeeUserId },
        isDeleted: false,
      }).select('_id readBy').lean();

      console.log(`📨 Found ${allMessages.length} total messages from others`);

     const unreadMsgs = allMessages.filter(msg =>
  !msg.readBy?.some(r => r.userId?.toString() === employeeUserIdStr)
);

if (unreadMsgs.length > 0) {
  const bulkOps = unreadMsgs.map(msg => ({
    updateOne: {
      filter: { _id: msg._id },
      update: {
        $push: { readBy: { userId: employeeUserId, readAt: new Date() } },
        $set: { status: 'read' }
      }
    }
  }));
  await Message.bulkWrite(bulkOps);
}

console.log(`✅ Updated ${unreadMsgs.length} messages to READ`);

      // ── 4. Reset conversation unread counts ───────────────────
     await Conversation.updateMany(
  { _id: { $in: conversationIds } },
  { 
    $set: { 
      'participants.$[elem].unreadCount': 0, 
      'participants.$[elem].lastReadAt': new Date() 
    } 
  },
  { arrayFilters: [{ 'elem.userId': employeeUserId }] }
);
      console.log('🔄 Reset conversation unread counts');
    }

    // ── 5. Save timestamp for application updates ─────────────
   await Employee.findOneAndUpdate(
  { userId: employeeUserId },
  { $set: { lastViewedApplicationUpdates: new Date() } },
  { upsert: true }
);
    console.log('⏰ Saved lastViewedApplicationUpdates');

    return successResponse(res, null, '✅ All marked as read');

  } catch (error) {
    console.error('❌ markAllEmployeeAsRead error:', error);
    return serverErrorResponse(res, error, 'Failed to mark all as read');
  }
};

// ══════════════════════════════════════════════════════════════
// 5️⃣ DELETE NOTIFICATION
// ══════════════════════════════════════════════════════════════

export const deleteEmployeeNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const employeeUserId = req.user._id;

if (notificationId.startsWith('app_update_')) {
  await Employee.findOneAndUpdate(
    { userId: employeeUserId },
    { $set: { lastViewedApplicationUpdates: new Date() } },
    { upsert: true }
  );
  return successResponse(res, null, '✅ Deleted successfully');

} else if (notificationId.startsWith('msg_')) {
      const messageId = notificationId.replace('msg_', '');
     // Just find by ID, then verify the conversation belongs to them
const message = await Message.findById(messageId);

      if (!message) return notFoundResponse(res, 'Message not found');

      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedBy = employeeUserId;
      await message.save();

    } else {
      const result = await Notification.findOneAndDelete({
        _id: notificationId,
        userId: employeeUserId,
      });

      if (!result) return notFoundResponse(res, 'Notification not found');
    }

    return successResponse(res, null, '✅ Deleted successfully');

  } catch (error) {
    console.error('❌ deleteEmployeeNotification error:', error);
    return serverErrorResponse(res, error, 'Failed to delete');
  }
};




export const triggerEmployeePush = async (type, payload) => {
  let title = '';
  let body = '';
  let navData = {};

  switch (type) {
    case 'STATUS_CHANGE':
      if (payload.status === 'accepted') {
        title = `🎉 Congratulations!`;
        body = `You got the job: "${payload.jobTitle}"`;
        navData = { 
          screen: 'MessageScreen', 
          conversationId: payload.conversationId, 
          senderId: payload.clientId || '', 
          senderName: payload.clientName || 'Client', 
          senderProfilePic: payload.clientProfilePic || '', 
        };
      } else {
        title = `📋 Application Update`;
        body = `Application for "${payload.jobTitle}" was ${payload.status}.`;
        navData = { screen: 'ApplicationStatus', appId: payload.applicationId };
      }
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
      
    case 'PAYMENT_RECEIVED':
      title = `💰 Payment Received`;
      body = `You received payment for "${payload.jobTitle}".`;
      navData = { screen: 'Wallet' };
      break;

    default:
      return;
  }

  // ✅ NEW CLEAN CALL -> Notice we pass payload.employeeId here!!!
  await sendPush({ 
      userId: payload.employeeId, // <--- EMPLOYEE ID
      title, 
      body, 
      data: navData 
  });
};

// ══════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════

export default {
  getEmployeeNotifications,
  getEmployeeUnreadCount,
  markEmployeeNotificationAsRead,
  markAllEmployeeAsRead,
  deleteEmployeeNotification,
  triggerEmployeePush,
};