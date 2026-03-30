// Controllers/pushNotificationController.js

import {
  sendPushNotificationsToUser,
  sendBatchPushNotifications
} from '../../Service/Notification/pushNotificationService.js';
import PushToken from '../../Models/Notification-Model/PushToken-Model.js';

// ══════════════════════════════════════════════════════════════
// POST /api/push-notifications/register-token
// Register/update push notification token for device
// ══════════════════════════════════════════════════════════════

export const registerPushToken = async (req, res) => {
  try {
    const { token, deviceId, deviceName, platform } = req.body;

    // ── Validation ────────────────────────────────────────────
    if (!token || !deviceId || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: token, deviceId, platform'
      });
    }

    // ── Check if token already exists ──────────────────────────
    let pushToken = await PushToken.findOne({ token });

    if (pushToken) {
      // ── Update existing token ─────────────────────────────
      pushToken = await PushToken.findOneAndUpdate(
        { token },
        {
          userId: req.user._id,
          deviceId,
          deviceName,
          platform,
          isActive: true,
          lastUsedAt: new Date()
        },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Push token updated successfully',
        data: pushToken
      });
    }

    // ── Create new token ──────────────────────────────────────
    const newToken = await PushToken.create({
      userId: req.user._id,
      token,
      deviceId,
      deviceName,
      platform,
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: 'Push token registered successfully',
      data: newToken
    });

  } catch (error) {
    console.error('❌ registerPushToken error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to register push token'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// DELETE /api/push-notifications/unregister-token/:token
// Unregister push notification token (logout from device)
// ══════════════════════════════════════════════════════════════

export const unregisterPushToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // ── Deactivate token ──────────────────────────────────────
    await PushToken.deactivateToken(token, 'user_logout');

    return res.status(200).json({
      success: true,
      message: 'Push token unregistered successfully'
    });

  } catch (error) {
    console.error('❌ unregisterPushToken error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to unregister push token'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// GET /api/push-notifications/my-devices
// Get all registered devices for logged-in user
// ══════════════════════════════════════════════════════════════

export const getMyDevices = async (req, res) => {
  try {
    const devices = await PushToken.find({
      userId: req.user._id,
      isActive: true
    })
      .select('_id token deviceId deviceName platform lastUsedAt notificationsSent')
      .sort({ lastUsedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: devices.length,
      devices
    });

  } catch (error) {
    console.error('❌ getMyDevices error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch devices'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// DELETE /api/push-notifications/device/:deviceId
// Remove a specific device
// ══════════════════════════════════════════════════════════════

export const removeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    const result = await PushToken.findOneAndDelete({
      deviceId,
      userId: req.user._id  // ✅ Security: user can only delete their own devices
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device removed successfully'
    });

  } catch (error) {
    console.error('❌ removeDevice error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove device'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// POST /api/push-notifications/send-test
// Send a test push notification to current user
// ══════════════════════════════════════════════════════════════

export const sendTestNotification = async (req, res) => {
  try {
    const { title = 'Test Notification', body = 'This is a test push notification' } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title and body are required'
      });
    }

    const result = await sendPushNotificationsToUser({
      userId: req.user._id,
      type: 'test',
      title,
      body,
      data: {
        testNotification: true,
        sentAt: new Date().toISOString()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Test notification sent',
      result
    });

  } catch (error) {
    console.error('❌ sendTestNotification error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// POST /api/push-notifications/send-to-user (Admin/Internal)
// Send push notification to a specific user
// ══════════════════════════════════════════════════════════════

export const sendNotificationToUser = async (req, res) => {
  try {
    const { userId, type, title, body, data = {} } = req.body;

    // ── Validation ────────────────────────────────────────────
    if (!userId || !type || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, type, title, body'
      });
    }

    // ── Note: You might want to add role-based authorization here
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ success: false, message: 'Unauthorized' });
    // }

    const result = await sendPushNotificationsToUser({
      userId,
      type,
      title,
      body,
      data
    });

    return res.status(200).json({
      success: true,
      message: 'Push notification sent',
      result
    });

  } catch (error) {
    console.error('❌ sendNotificationToUser error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// POST /api/push-notifications/send-batch (Admin/Internal)
// Send push notifications to multiple users
// ══════════════════════════════════════════════════════════════

export const sendBatchNotifications = async (req, res) => {
  try {
    const { userIds, type, title, body, data = {} } = req.body;

    // ── Validation ────────────────────────────────────────────
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds must be a non-empty array'
      });
    }

    if (!type || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, title, body'
      });
    }

    // ── Note: Role-based check recommended for production
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ success: false, message: 'Unauthorized' });
    // }

    const results = await sendBatchPushNotifications(userIds, {
      type,
      title,
      body,
      data
    });

    // ── Summary stats ─────────────────────────────────────────
    let totalSent = 0, totalFailed = 0;
    results.forEach(r => {
      totalSent += r.result.sent;
      totalFailed += r.result.failed;
    });

    return res.status(200).json({
      success: true,
      message: `Batch notifications sent to ${userIds.length} users`,
      summary: {
        totalUsers: userIds.length,
        totalSent,
        totalFailed
      },
      details: results
    });

  } catch (error) {
    console.error('❌ sendBatchNotifications error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send batch notifications'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// POST /api/push-notifications/send-job-notification (Internal)
// Send notification about new job matches to employees
// ══════════════════════════════════════════════════════════════

export const sendJobNotification = async (req, res) => {
  try {
    const { userIds, jobTitle, jobId } = req.body;

    if (!userIds || !Array.isArray(userIds) || !jobTitle || !jobId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userIds, jobTitle, jobId'
      });
    }

    const results = await sendBatchPushNotifications(userIds, {
      type: 'job_match',
      title: '💼 New Job Match',
      body: `A new job matching your skills: ${jobTitle}`,
      data: {
        jobId,
        action: 'view_job'
      }
    });

    let totalSent = 0;
    results.forEach(r => totalSent += r.result.sent);

    return res.status(200).json({
      success: true,
      message: 'Job notifications sent',
      sentCount: totalSent
    });

  } catch (error) {
    console.error('❌ sendJobNotification error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send job notification'
    });
  }
};

export default {
  registerPushToken,
  unregisterPushToken,
  getMyDevices,
  removeDevice,
  sendTestNotification,
  sendNotificationToUser,
  sendBatchNotifications,
  sendJobNotification
};