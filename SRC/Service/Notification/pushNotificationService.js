// Services/pushNotificationService.js

import axios from 'axios';
import PushToken from '../../Models/Notification-Model/PushToken-Model.js';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * ✅ Core: Send push notifications to a user's all active devices
 * 
 * @param {Object} options
 * @param {string} options.userId - Target user ID
 * @param {string} options.type - Notification type
 * @param {string} options.title - Push notification title
 * @param {string} options.body - Push notification body
 * @param {Object} options.data - Custom data payload
 * @returns {Promise<{ sent: number, failed: number, errors: string[] }>}
 */
export const sendPushNotificationsToUser = async ({
  userId,
  type,
  title,
  body,
  data = {}
}) => {
  try {
    // ✅ Get all active tokens for user
    const tokens = await PushToken.getActiveTokens(userId);

    if (!tokens.length) {
      console.log(`⚠️  No active push tokens for user ${userId}`);
      return { sent: 0, failed: 0, errors: [] };
    }

    console.log(`📱 Sending push to ${tokens.length} device(s) for user ${userId}`);

    // ✅ Build notification payload for Expo
    const notifications = tokens.map(tokenDoc => ({
      to: tokenDoc.token,
      sound: 'default',
      title,
      body,
      badge: 1,
      data: {
        type,
        timestamp: new Date().toISOString(),
        ...data
      },
      android: {
        channelId: 'default',
        priority: 'high',
        sound: true
      },
      ios: {
        sound: true,
        badge: 1,
        alert: {
          title,
          body
        }
      }
    }));

    // ✅ Send to Expo Push Service
    const response = await axios.post(EXPO_PUSH_API, notifications, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (!response.data?.data) {
      throw new Error('Invalid Expo API response');
    }

    // ✅ Process results and track failures
    let sent = 0, failed = 0;
    const errors = [];

    response.data.data.forEach(async (result, index) => {
      if (result.status === 'ok') {
        sent++;
        // Update token usage stats
        await PushToken.findOneAndUpdate(
          { token: tokens[index].token },
          {
            notificationsSent: tokens[index].notificationsSent + 1,
            lastNotificationAt: new Date()
          }
        ).catch(err => console.error('Failed to update token stats:', err.message));

      } else {
        failed++;
        errors.push(`[${tokens[index].token.substring(0, 20)}...] ${result.message}`);
        console.error(`❌ Push failed for token ${index}:`, result.message);

        // ✅ Deactivate token if permanently invalid
        const shouldDeactivate = 
          result.message?.includes('ExpiredToken') ||
          result.message?.includes('InvalidCredentials') ||
          result.message?.includes('DeviceNotRegistered');

        if (shouldDeactivate) {
          await PushToken.deactivateToken(
            tokens[index].token,
            'token_expired'
          ).catch(err => console.error('Failed to deactivate token:', err.message));
        }
      }
    });

    console.log(`✅ Push results: ${sent} sent, ${failed} failed`);
    return { sent, failed, errors };

  } catch (error) {
    console.error('❌ sendPushNotificationsToUser error:', error.message);
    return { sent: 0, failed: 0, errors: [error.message] };
  }
};

/**
 * ✅ Send batch push notifications to multiple users
 */
export const sendBatchPushNotifications = async (userIds, notificationConfig) => {
  const results = [];

  for (const userId of userIds) {
    const result = await sendPushNotificationsToUser({
      userId,
      ...notificationConfig
    });
    results.push({ userId, result });
  }

  return results;
};

export default { sendPushNotificationsToUser, sendBatchPushNotifications };