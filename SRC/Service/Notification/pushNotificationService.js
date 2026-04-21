import axios from 'axios';
import PushToken from '../../Models/Notification-Model/PushToken-Model.js';
import admin from '../../Config/firebase.js'; // You already have this!

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

export const sendPushNotificationsToUser = async ({
  userId,
  type,
  title,
  body,
  data = {}
}) => {
  try {
    const tokens = await PushToken.getActiveTokens(userId);

    if (!tokens.length) {
      console.log(`⚠️  No active push tokens for user ${userId}`);
      return { sent: 0, failed: 0, errors: [] };
    }

    // ✅ STEP 1: Separate Expo Go tokens from Prebuild (FCM) tokens
    const expoTokens = tokens.filter(t => t.token.startsWith('ExponentPushToken'));
    const fcmTokens = tokens.filter(t => !t.token.startsWith('ExponentPushToken'));

    let sent = 0, failed = 0;
    const errors = [];

    // ✅ STEP 2: Handle EXPO GO Tokens (Old Way)
    if (expoTokens.length > 0) {

      // const expoPayload = expoTokens.map(tokenDoc => ({
      //   to: tokenDoc.token,
      //   sound: 'default',
      //   title,
      //   body,
      //   data: { type, timestamp: new Date().toISOString(), ...data },
      //   android: { channelId: 'default', priority: 'high' },
      //   ios: { sound: true, badge: 1 }
      // }));

      // AFTER (CORRECT):
const expoPayload = expoTokens.map(tokenDoc => ({
  to: tokenDoc.token,
  sound: 'default',
  title,
  body,
  data: { type, timestamp: new Date().toISOString(), ...data },
  ios: { sound: true, badge: 1 }
}));




      const expoResponse = await axios.post(EXPO_PUSH_API, expoPayload, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        timeout: 30000
      });

      if (expoResponse.data?.data) {
        expoResponse.data.data.forEach(async (result, index) => {
          if (result.status === 'ok') {
            sent++;
            await updateTokenStats(expoTokens[index].token, expoTokens[index]);
          } else {
            failed++;
            errors.push(`[Expo] ${result.message}`);
            await handleFailedToken(expoTokens[index].token, result.message);
          }
        });
      }
    }

    // ✅ STEP 3: Handle PREBUILD (Firebase) Tokens (NEW WAY)
    if (fcmTokens.length > 0) {



      // const fcmMessages = fcmTokens.map(tokenDoc => ({
      //   token: tokenDoc.token,
      //   notification: { title, body },
      //   data: { type, timestamp: new Date().toISOString(), ...data },
      //   android: { priority: 'high', channelId: 'default', sound: true },
      //   apns: { payload: { aps: { sound: 'default', badge: 1 } } }
      // }));



      const fcmMessages = fcmTokens.map(tokenDoc => ({
  token: tokenDoc.token,
  notification: { title, body },
  data: { type, timestamp: new Date().toISOString(), ...data },
  android: { 
    priority: 'high', 
    notification: {
      clickAction: "com.takeshi001.Nixvo", // ADD THIS LINE: Forces it to open YOUR app
      channelId: 'default',
      sound: true
    }
  },
  apns: { payload: { aps: { sound: 'default', badge: 1 } } }
}));






      // Send via Firebase Admin
      const fcmResponse = await admin.messaging().sendEach(fcmMessages);

      sent += fcmResponse.successCount;
      failed += fcmResponse.failureCount;

      // Process FCM failures
      fcmResponse.responses.forEach((resp, index) => {
        if (!resp.success) {
          errors.push(`[FCM] ${resp.error.message}`);
          handleFailedToken(fcmTokens[index].token, resp.error.code);
        } else {
          updateTokenStats(fcmTokens[index].token, fcmTokens[index]);
        }
      });
    }

    console.log(`✅ Push results: ${sent} sent, ${failed} failed`);
    return { sent, failed, errors };

  } catch (error) {
    console.error('❌ sendPushNotificationsToUser error:', error.message);
    return { sent: 0, failed: 0, errors: [error.message] };
  }
};

// ✅ Helper functions to keep code clean
const updateTokenStats = async (token, tokenDoc) => {
  await PushToken.findOneAndUpdate(
    { token },
    { notificationsSent: (tokenDoc.notificationsSent || 0) + 1, lastNotificationAt: new Date() }
  ).catch(err => console.error('Failed to update token stats:', err.message));
};

const handleFailedToken = async (token, errorMessage) => {
  console.error(`❌ Push failed for token:`, errorMessage);
  const shouldDeactivate = 
    errorMessage?.includes('ExpiredToken') ||
    errorMessage?.includes('InvalidCredentials') ||
    errorMessage?.includes('DeviceNotRegistered') ||
    errorMessage?.includes('not-registered');

  if (shouldDeactivate) {
    await PushToken.deactivateToken(token, 'token_expired').catch(err => console.error('Failed to deactivate token:', err.message));
  }
};

export const sendBatchPushNotifications = async (userIds, notificationConfig) => {
  const results = [];
  for (const userId of userIds) {
    const result = await sendPushNotificationsToUser({ userId, ...notificationConfig });
    results.push({ userId, result });
  }
  return results;
};

export default { sendPushNotificationsToUser, sendBatchPushNotifications };