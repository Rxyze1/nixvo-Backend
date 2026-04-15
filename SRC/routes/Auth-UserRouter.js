import express from 'express'
import { forgotPassword, login, logout, resendOTP, signup, verifyResetOTP, verifySignupOTP } from '../Controller/user/User-Auth.Controller.js';
import { protect } from '../Middleware/authMiddleware.js';
import getProfileCompleted from '../Middleware/authMiddleware.js';

// ✅ Import User Model
import User from '../Models/USER-Auth/User-Auth.-Model.js';

const AuthRouter = express.Router();

// ─── EXISTING AUTH ROUTES ──────────────────────────────
AuthRouter.post('/signup', signup)
AuthRouter.post('/login', login)
AuthRouter.post('/verify-signup-otp', verifySignupOTP)
AuthRouter.post('/resend-otp', resendOTP)
AuthRouter.post('/logout', protect, logout)
AuthRouter.post('/forget-pass', forgotPassword)
AuthRouter.post('/reset-Pass', verifyResetOTP)

// ─── SESSION RESTORE ──────────────────────────────────
AuthRouter.get('/me', protect, async (req, res) => {
  try {
    const profileCompleted = await getProfileCompleted(req.user._id, req.user.userType);
    return res.status(200).json({
      success: true,
      data: {
        user: {
          ...req.user.toObject(),
          profileCompleted,
        },
      },
    });
  } catch (error) {
    console.error('❌ /me error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════
// 🆕 SAVE PUSH TOKEN - PRODUCTION READY FOR ALL USERS
// Uses 'protect' middleware to get user from JWT token
// No need to send userId from frontend! Token tells us who it is.
// ══════════════════════════════════════════════════════════

/**
 * POST /api/v1/auth-user/save-push-token
 * 
 * Headers: Authorization: Bearer <jwt_token>  ← Same as other protected routes!
 * Body: { "pushToken": "ExponentPushToken[xxx]" }
 * 
 * Automatically saves to the authenticated user's document
 */
AuthRouter.post('/save-push-token', protect, async (req, res) => {
  
  const authenticatedUserId = req.user?._id;
  
  console.log('\n📱╔══════════════════════════════════════════════╗');
  console.log('📱║     💾 SAVING PUSH TOKEN                       ║');
  console.log('📱╠══════════════════════════════════════════════╣');
  console.log(`📱║ User: ${req.user?.fullname || req.user?.email || 'Unknown'}`);
  console.log(`📱║ ID: ${authenticatedUserId}`);

  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Push token is required in request body' 
      });
    }

    if (!pushToken.startsWith('ExponentPushToken[')) {
      return res.status(400).json({ 
        success: false, 
        message: '❌ Invalid Expo push token format' 
      });
    }

    // ⭐⭐⭐ FIX #1: FIRST - Remove this token from ALL other users! ⭐⭐⭐
    // This prevents ghost tokens when switching accounts
    const nukeResult = await User.updateMany(
      { 
        expoPushToken: pushToken, 
        _id: { $ne: authenticatedUserId }  // Exclude current user
      },
      { $unset: { expoPushToken: 1, pushTokenUpdatedAt: 1, pushTokenPlatform: 1 } }
    );
    
    if (nukeResult.modifiedCount > 0) {
      console.log(`📱║ 🧹 Ghost tokens cleared from ${nukeResult.modifiedCount} other user(s)`);
    }

    // ⭐⭐⭐ FIX #2: THEN - Save to current user ⭐⭐⭐
    const updateResult = await User.findByIdAndUpdate(
      authenticatedUserId,
      { 
        $set: { 
          expoPushToken: pushToken,
          pushTokenUpdatedAt: new Date(),
          pushTokenPlatform: 'expo'
        } 
      },
      { new: true }
    ).select('fullname email userType expoPushToken').lean();

    if (!updateResult) {
      return res.status(404).json({ 
        success: false, 
        message: '❌ User not found' 
      });
    }

    console.log(`📱║ ✅ SAVED SUCCESSFULLY!`);
    console.log(`📱║ Token: ${pushToken.substring(0, 35)}...`);
    console.log('📱╚══════════════════════════════════════════════╝\n');

    return res.json({ 
      success: true, 
      message: '✅ Push token saved!',
      data: {
        userId: authenticatedUserId,
        userFullname: updateResult.fullname,
        ghostTokensCleared: nukeResult.modifiedCount,  // Helpful for debugging
        savedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Save error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while saving token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


export default AuthRouter