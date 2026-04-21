import express from 'express';
export const notirouter = express.Router();
import { sendPush } from '../Service/Notification/firebasePushService.js';
import PushToken from '../Models/Notification-Model/PushToken-Model.js'; // ✅ CORRECT DATABASE
import { protect } from '../Middleware/authMiddleware.js';

// ⚠️ TEMPORARY TEST ROUTE - DELETE LATER
notirouter.post('/test-firebase-push', protect, async (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'Send targetUserId' });

  await sendPush({
    userId: targetUserId, 
    title: '🔥 Direct Firebase Test', 
    body: 'Firebase is perfectly connected!',
    data: { screen: 'MessageScreen', testNotification: true }
  });

  res.json({ success: true, message: 'Check your terminal!' });
});

// ═════════════════════════════════════════════════════════════
// ✅ REGISTER / UPDATE TOKEN 
// ═════════════════════════════════════════════════════════════
notirouter.post('/register-token', protect, async (req, res) => {
  try {
    const { token, platform, deviceId } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ success: false, message: 'Token and platform required' });
    }

    // ✅ Uses the PushToken model's built-in smart method!
    // It automatically creates a new token OR updates it if it already exists.
    await PushToken.registerToken(req.user._id, token, platform, {
      deviceName: deviceId || 'expo-device',
    });

    console.log(`✅ Token saved to PushTokens DB for User: ${req.user._id}`);
    return res.status(200).json({ success: true, message: 'Push token registered' });

  } catch (error) {
    console.error('❌ Register token error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to save token' });
  }
});

// ═════════════════════════════════════════════════════════════
// 🚪 UNREGISTER TOKEN (Logout)
// ═════════════════════════════════════════════════════════════
notirouter.post('/unregister-token', protect, async (req, res) => {
  try {
    // ✅ Deletes ALL tokens for this user (safe logout)
    await PushToken.removeUserTokens(req.user._id);

    console.log(`🔕 All tokens wiped for User: ${req.user._id}`);
    return res.status(200).json({ success: true, message: 'Push tokens unregistered' });

  } catch (error) {
    console.error('❌ Unregister error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to unregister' });
  }
});