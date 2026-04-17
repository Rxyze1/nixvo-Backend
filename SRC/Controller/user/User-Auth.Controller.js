// controllers/authController.js

import User from '../../Models/USER-Auth/User-Auth.-Model.js';
import Client from '../../Models/USER-Auth/Client-Model.js';
import Employee from '../../Models/USER-Auth/Employee-Model.js';
import OTP from '../../Models/otpModel.js';
import RefreshToken from '../../Models/RefreshTokenModel.js';
import { validateContent } from '../../Service/validationService.js';
import {
  sendSignupOTP,
  sendResendOTP,
  sendWelcomeEmail,
  sendPasswordResetOTP,
  sendPasswordResetSuccess,
} from '../../Email/emailService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../Config/tokenUtils.js';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '../../Config/responseUtils.js';
import { COOKIE_OPTIONS } from '../../Middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';

// ═══════════════════════════════════════════════════════════════
// HELPERS & CONSTANTS
// ═══════════════════════════════════════════════════════════════

const sanitizeEmail = (email) => email.toLowerCase().trim();

const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days

const logger = {
  info:  (msg, data) => console.log(`\n✅ ${msg}`,  data ? JSON.stringify(data, null, 2) : ''),
  warn:  (msg, data) => console.warn(`\n⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg, data) => console.error(`\n❌ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
};

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

const isStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{8,}$/.test(password);

// ═══════════════════════════════════════════════════════════════
// HELPER: Get profileCompleted from Client or Employee
// ═══════════════════════════════════════════════════════════════

const getProfileCompleted = async (userId, userType) => {
  try {
    if (userType === 'client') {
      const doc = await Client.findOne({ userId }, { profileCompleted: 1 }).lean();
      return doc?.profileCompleted ?? false;
    }
    if (userType === 'employee') {
      const doc = await Employee.findOne({ userId }, { profileCompleted: 1 }).lean();
      return doc?.profileCompleted ?? false;
    }
    // officials — no profile needed
    return true;
  } catch {
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════
// 1️⃣ SIGNUP - Send OTP
// ═══════════════════════════════════════════════════════════════

export const signup = async (req, res) => {
  try {
    const { fullname, username, email, password, userType, phone } = req.body;

    if (!fullname || !username || !email || !password || !userType || !phone) {
      return errorResponse(res, 400, 'Required fields missing: fullname, username, email, password, userType, phone');
    }

    if (fullname.length < 3 || fullname.length > 20) {
      return errorResponse(res, 400, 'Fullname must be 3-20 characters');
    }

    try {
      const fullnameValidation = await validateContent(fullname, 'fullname');
      if (fullnameValidation.blocked) {
        return errorResponse(res, 400, 'Fullname contains invalid content');
      }
    } catch {
      return errorResponse(res, 400, 'Fullname contains invalid content');
    }

    if (!/^[a-zA-Z0-9_]{3,15}$/.test(username)) {
      return errorResponse(res, 400, 'Username: 3-15 chars, alphanumeric + underscore only');
    }

    try {
      const usernameValidation = await validateContent(username, 'username');
      if (usernameValidation.blocked) {
        return errorResponse(res, 400, 'Username contains invalid content');
      }
    } catch {
      return errorResponse(res, 500, 'Validation service error');
    }

    if (!isValidEmail(email)) {
      return errorResponse(res, 400, 'Invalid email format');
    }

    const sanitizedEmail    = sanitizeEmail(email);
    const sanitizedUsername = username.toLowerCase();

    if (!isStrongPassword(password)) {
      return errorResponse(res, 400, 'Password: min 8 chars, uppercase, lowercase, number, special char (@$!%*?&)');
    }

    if (!['employee', 'client', 'officials'].includes(userType)) {
      return errorResponse(res, 400, 'Invalid user type');
    }

    const existingEmail = await User.findOne({ email: sanitizedEmail }).lean().maxTimeMS(5000);
    if (existingEmail) {
      logger.warn('Email already registered', { email: sanitizedEmail });
      return errorResponse(res, 400, 'Email already registered');
    }

    const existingUsername = await User.findOne({ username: sanitizedUsername }).lean().maxTimeMS(5000);
    if (existingUsername) {
      logger.warn('Username already taken', { username: sanitizedUsername });
      return errorResponse(res, 400, 'Username already taken');
    }

    const otpResult = await OTP.createNew(sanitizedEmail, 'registration', userType, {
      fullname:  fullname.trim(),
      username:  sanitizedUsername,
      email:     sanitizedEmail,
      phone,
      password,
    });

    if (!otpResult?.otp) {
      return errorResponse(res, 500, 'Failed to send OTP');
    }

    try {
      await sendSignupOTP(sanitizedEmail, otpResult.otp, fullname);
      logger.info('Signup OTP sent', { email: sanitizedEmail });
    } catch (emailError) {
      logger.error('Email send failed', emailError.message);
      return errorResponse(res, 500, 'Failed to send OTP email');
    }

    return successResponse(
      res,
      { email: sanitizedEmail, expiresIn: '10 minutes' },
      'OTP sent successfully. Check your email'
    );

  } catch (error) {
    logger.error('SIGNUP ERROR', error.message);
    return errorResponse(res, 500, 'Signup failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// 2️⃣ VERIFY SIGNUP OTP - Create User + Profile
// ═══════════════════════════════════════════════════════════════

export const verifySignupOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return errorResponse(res, 400, 'Email and OTP required');
    }

    const sanitizedEmail = sanitizeEmail(email);
    logger.info('VERIFY SIGNUP OTP REQUEST', { email: sanitizedEmail });

    const result = await OTP.verifyCode(sanitizedEmail, otp, 'registration');
    if (!result.success) {
      return errorResponse(res, 400, result.message);
    }

    const otpDoc = result.otpDoc;

    if (!otpDoc.fullname || !otpDoc.username || !otpDoc.password) {
      return errorResponse(res, 400, 'Session expired. Register again.');
    }

    const existingUser = await User.findOne({
      $or: [{ email: sanitizedEmail }, { username: otpDoc.username.toLowerCase() }],
    }).lean();

    if (existingUser) {
      return errorResponse(res, 409, 'User already registered');
    }

    const hashedPassword = await bcrypt.hash(otpDoc.password, 12);

     const user = await User.create({
      fullname:        otpDoc.fullname.trim(),
      username:        otpDoc.username.toLowerCase(),
      email:           sanitizedEmail,
      phone:           otpDoc.phone || '',
      password:        hashedPassword,
      userType:        otpDoc.userType,

      isEmailVerified: true,
      isAdminVerified: otpDoc.userType === 'client',  // ✅ Auto-approve clients
      adminVerificationStatus: otpDoc.userType === 'client' ? 'approved' : 'pending', // ✅ FIX

      status: 'active',
      
      role:            'user',
    });

    logger.info('USER CREATED', { userId: user._id, userType: user.userType });

    // ── Create profile ──
    try {
      if (user.userType === 'client') {
        await Client.create({
          userId:             user._id,
          bio:                '',
          profilePic:         null,
          profileBannerImage: null,
          lookingSkillsFor:   null,
          profileCompleted:   false,
        });
        logger.info('CLIENT PROFILE CREATED', { userId: user._id });

      } else if (user.userType === 'employee') {
        await Employee.create({
          userId:             user._id,
          bio:                '',
          profilePic:         null,
          profileBannerImage: null,
          skills:             [],
          portfolio:          [],
          profileCompleted:   false,
        });
        logger.info('EMPLOYEE PROFILE CREATED', { userId: user._id });
      }
    } catch (profileError) {
      logger.error('PROFILE CREATION FAILED', profileError.message);
      // Don't block registration if profile creation fails
    }

    // ── Cleanup OTP ──
    await otpDoc.markAsUsed();
    await OTP.deleteMany({ email: sanitizedEmail }).catch(() => {});

    // ── Generate tokens ──
    const accessToken  = generateAccessToken(user._id.toString(), user.userType, user.email, user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.userType, user.email, user.role);

    if (!accessToken || !refreshToken) {
      return errorResponse(res, 500, 'Token generation failed');
    }

    res.cookie('accessToken',  accessToken,  COOKIE_OPTIONS.ACCESS_TOKEN);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);

    await RefreshToken.create({
      token:     refreshToken,
      userId:    user._id,
      userAgent: req.headers['user-agent'] || 'Unknown',
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN),
      isRevoked: false,
    }).catch((err) => logger.warn('Failed to store refresh token', err.message));

    try {
      await sendWelcomeEmail(user.email, user.fullname, user.userType);
    } catch (emailError) {
      logger.warn('Welcome email failed', emailError.message);
    }

    logger.info('SIGNUP COMPLETE', { userId: user._id, email: user.email });

    return successResponse(
      res,
      {
        accessToken,
        refreshToken,
        user: {
          id:               user._id,
          fullname:         user.fullname,
          username:         user.username,
          email:            user.email,
          userType:         user.userType,
          role:             user.role,
          status:           user.status,
          profileCompleted: false, // ✅ always false for new users
        },
      },
      'Account created successfully'
    );

  } catch (error) {
    logger.error('VERIFY SIGNUP OTP ERROR', error.message);
    return errorResponse(res, 500, 'Verification failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// 3️⃣ RESEND OTP
// ═══════════════════════════════════════════════════════════════

export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 400, 'Email required');
    }

    const sanitizedEmail = sanitizeEmail(email);
    logger.info('RESEND OTP REQUEST', { email: sanitizedEmail });

    const result = await OTP.resendCode(sanitizedEmail, 'registration');

    if (result.error) {
      return errorResponse(res, 400, result.message);
    }

    try {
      await sendResendOTP(sanitizedEmail, result.otp, 'User');
      logger.info('Resend OTP sent', { email: sanitizedEmail });
    } catch (emailError) {
      logger.error('Email send failed', emailError.message);
      return errorResponse(res, 500, 'Failed to send OTP');
    }

    return successResponse(res, { email: sanitizedEmail }, 'OTP sent to your email');

  } catch (error) {
    logger.error('RESEND OTP ERROR', error.message);
    return errorResponse(res, 500, 'Resend failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// 4️⃣ LOGIN
// ═══════════════════════════════════════════════════════════════

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password required');
    }

    const sanitizedEmail = sanitizeEmail(email);
    logger.info('LOGIN REQUEST', { email: sanitizedEmail });

    const user = await User.findOne({ email: sanitizedEmail })
      .select('+password')
      .maxTimeMS(5000);

    if (!user) {
      return unauthorizedResponse(res, 'Invalid email or password');
    }

    if (!user.isEmailVerified) {
      return errorResponse(res, 403, 'Please verify email first');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return unauthorizedResponse(res, 'Invalid email or password');
    }

    if (!user.canLogin) {
      return unauthorizedResponse(res, `Cannot login. Account status: ${user.status}`);
    }

    // ── Tokens ──
    const accessToken  = generateAccessToken(user._id.toString(), user.userType, user.email, user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.userType, user.email, user.role);

    if (!accessToken || !refreshToken) {
      return errorResponse(res, 500, 'Token generation failed');
    }

    res.cookie('accessToken',  accessToken,  COOKIE_OPTIONS.ACCESS_TOKEN);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);

    // ── Store refresh token ──
    try {
      await RefreshToken.create({
        token:     refreshToken,
        userId:    user._id,
        userAgent: req.headers['user-agent'] || 'Unknown',
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN),
        isRevoked: false,
      });
      logger.info('Refresh token stored', { userId: user._id });
    } catch (err) {
      logger.error('Failed to store refresh token', err.message);
      return errorResponse(res, 500, 'Token storage failed');
    }

    // ── Update last login ──
    user.lastLogin  = new Date();
    user.lastActive = new Date();
    await user.save({ validateBeforeSave: false }).catch((err) =>
      logger.warn('Failed to update login time', err.message)
    );

    // ── Read real profileCompleted from Client/Employee ──
    const profileCompleted = await getProfileCompleted(user._id, user.userType);

    logger.info('LOGIN SUCCESSFUL', {
      userId:           user._id,
      email:            user.email,
      userType:         user.userType,
      profileCompleted,
    });

    return successResponse(
      res,
      {
        accessToken,
        refreshToken,
        user: {
          id:               user._id,
          fullname:         user.fullname,
          username:         user.username,
          email:            user.email,
          userType:         user.userType,
          role:             user.role,
          status:           user.status,
          profileCompleted, // ✅ real value from Client/Employee doc
        },
      },
      'Login successful'
    );

  } catch (error) {
    logger.error('LOGIN ERROR', error.message);
    return errorResponse(res, 500, 'Login failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// 5️⃣ REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return errorResponse(res, 400, 'Refresh token required');
    }

    const refreshResult = verifyRefreshToken(refreshToken);
    if (!refreshResult.valid) {
      return errorResponse(res, 401, 'Invalid refresh token');
    }

    const decoded = refreshResult.decoded;

    const storedToken = await RefreshToken.findOne({
      token:     refreshToken,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!storedToken) {
      return errorResponse(res, 401, 'Refresh token expired');
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.canLogin) {
      return forbiddenResponse(res, 'Account access denied');
    }

    const newAccessToken = generateAccessToken(
      user._id.toString(),
      user.userType,
      user.email,
      user.role
    );

    if (!newAccessToken) {
      return errorResponse(res, 500, 'Token generation failed');
    }

    res.cookie('accessToken', newAccessToken, COOKIE_OPTIONS.ACCESS_TOKEN);

    logger.info('TOKEN REFRESHED', { userId: user._id });

    return successResponse(res, { accessToken: newAccessToken }, 'Token refreshed successfully');

  } catch (error) {
    logger.error('REFRESH TOKEN ERROR', error.message);
    return errorResponse(res, 500, 'Token refresh failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// 6️⃣ FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════════

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 400, 'Email required');
    }

    const sanitizedEmail = sanitizeEmail(email);
    logger.info('FORGOT PASSWORD REQUEST', { email: sanitizedEmail });

    const user = await User.findOne({ email: sanitizedEmail });

    // ✅ Don't reveal whether email exists
    if (!user) {
      return successResponse(res, { email: sanitizedEmail }, 'If email exists, OTP will be sent');
    }

    if (!user.canLogin) {
      return errorResponse(res, 403, 'Account is not active');
    }

    const otpResult = await OTP.createNew(sanitizedEmail, 'password_reset', user.userType, {
      email: sanitizedEmail,
    });

    if (!otpResult?.otp) {
      return errorResponse(res, 500, 'Failed to send OTP');
    }

    try {
      await sendPasswordResetOTP(sanitizedEmail, otpResult.otp, user.fullname);
      logger.info('Password reset OTP sent', { email: sanitizedEmail });
    } catch (emailError) {
      logger.error('Email send failed', emailError.message);
      return errorResponse(res, 500, 'Failed to send OTP');
    }

    return successResponse(res, { email: sanitizedEmail }, 'OTP sent to your email');

  } catch (error) {
    logger.error('FORGOT PASSWORD ERROR', error.message);
    return errorResponse(res, 500, 'Forgot password failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// 7️⃣ VERIFY RESET OTP - Password Reset + Auto Login
// ═══════════════════════════════════════════════════════════════

export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return errorResponse(res, 400, 'Email, OTP, and passwords required');
    }

    if (newPassword !== confirmPassword) {
      return errorResponse(res, 400, 'Passwords do not match');
    }

    if (!isStrongPassword(newPassword)) {
      return errorResponse(res, 400, 'Password: min 8 chars, uppercase, lowercase, number, special char (@$!%*?&)');
    }

    const sanitizedEmail = sanitizeEmail(email);
    logger.info('VERIFY RESET OTP REQUEST', { email: sanitizedEmail });

    const result = await OTP.verifyCode(sanitizedEmail, otp, 'password_reset');
    if (!result.success) {
      return errorResponse(res, 400, result.message);
    }

    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // ── Reset password ──
    user.password   = await bcrypt.hash(newPassword, 12);
    user.lastLogin  = new Date();
    user.lastActive = new Date();
    await user.save();

    logger.info('PASSWORD RESET', { userId: user._id });

    // ── Cleanup ──
    await OTP.deleteMany({ email: sanitizedEmail }).catch(() => {});
    await RefreshToken.updateMany(
      { userId: user._id },
      { isRevoked: true, revokedAt: new Date() }
    ).catch(() => {});

    // ── Generate new tokens ──
    const accessToken  = generateAccessToken(user._id.toString(), user.userType, user.email, user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.userType, user.email, user.role);

    if (!accessToken || !refreshToken) {
      return errorResponse(res, 500, 'Token generation failed');
    }

    res.cookie('accessToken',  accessToken,  COOKIE_OPTIONS.ACCESS_TOKEN);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);

    try {
      await RefreshToken.create({
        token:     refreshToken,
        userId:    user._id,
        userAgent: req.headers['user-agent'] || 'Unknown',
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN),
        isRevoked: false,
      });
    } catch (err) {
      logger.error('Failed to store refresh token', err.message);
      return errorResponse(res, 500, 'Token storage failed');
    }

    // ── Send success email ──
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';
      await sendPasswordResetSuccess(sanitizedEmail, user.fullname, ipAddress, 'Unknown');
    } catch (emailError) {
      logger.warn('Password reset success email failed', emailError.message);
    }

    // ── Read real profileCompleted ──
    const profileCompleted = await getProfileCompleted(user._id, user.userType);

    logger.info('AUTO LOGIN AFTER PASSWORD RESET', { userId: user._id });

    return successResponse(
      res,
      {
        accessToken,
        refreshToken,
        user: {
          id:               user._id,
          fullname:         user.fullname,
          username:         user.username,
          email:            user.email,
          userType:         user.userType,
          role:             user.role,
          status:           user.status,
          profileCompleted, // ✅ real value from Client/Employee doc
        },
      },
      'Password reset successfully. You are now logged in'
    );

  } catch (error) {
    logger.error('VERIFY RESET OTP ERROR', error.message);
    return errorResponse(res, 500, 'Password reset failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// 8️⃣ LOGOUT
// ═══════════════════════════════════════════════════════════════

// export const logout = async (req, res) => {
//   try {
//     const refreshToken = req.cookies.refreshToken;
//     const userId       = req.userId;

//     logger.info('LOGOUT REQUEST', { userId });
// // ✅ Revoke ALL sessions for this user + fallback for userId
// const resolvedUserId = req.userId ?? req.user?._id;

// if (resolvedUserId) {
//   await RefreshToken.updateMany(
//     { userId: resolvedUserId, isRevoked: false },
//     { isRevoked: true, revokedAt: new Date() }
//   ).catch(() => null);


//   // ⭐⭐⭐ ADD THIS: Nuke the push token from the database! ⭐⭐⭐
//       await User.findByIdAndUpdate(
//         resolvedUserId,
//         { $unset: { expoPushToken: 1, pushTokenUpdatedAt: 1, pushTokenPlatform: 1 } }
//       ).catch(() => null);
// }



//     res.clearCookie('accessToken',  COOKIE_OPTIONS.ACCESS_TOKEN);
//     res.clearCookie('refreshToken', COOKIE_OPTIONS.REFRESH_TOKEN);

//     logger.info('LOGOUT SUCCESSFUL', { userId });

//     return successResponse(res, { userId }, 'Logged out successfully');

//   } catch (error) {
//     logger.error('LOGOUT ERROR', error.message);
//     return errorResponse(res, 500, 'Logout failed');
//   }
// };


export const logout = async (req, res) => {
  try {
    const resolvedUserId = req.userId ?? req.user?._id;

    logger.info('LOGOUT REQUEST', { userId: resolvedUserId });

    if (resolvedUserId) {
      // 1. Revoke ALL refresh sessions for this user
      await RefreshToken.updateMany(
        { userId: resolvedUserId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() }
      );

      // 2. Nuke push token from database
      try {
        const result = await User.findByIdAndUpdate(
          resolvedUserId,
          { $unset: { expoPushToken: 1, pushTokenUpdatedAt: 1, pushTokenPlatform: 1 } }
        );
        
        if (result) {
          logger.info('Push token cleared', { userId: resolvedUserId });
        } else {
          logger.warn('User not found for token clear', { userId: resolvedUserId });
        }
      } catch (tokenErr) {
        logger.error('Push token clear failed', tokenErr.message);
      }
    }

    // 3. Clear cookies
    res.clearCookie('accessToken',  COOKIE_OPTIONS.ACCESS_TOKEN);
    res.clearCookie('refreshToken', COOKIE_OPTIONS.REFRESH_TOKEN);

    logger.info('LOGOUT SUCCESSFUL', { userId: resolvedUserId });

    return successResponse(res, { userId: resolvedUserId }, 'Logged out successfully');

  } catch (error) {
    logger.error('LOGOUT ERROR', error.message);
    return errorResponse(res, 500, 'Logout failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
  signup,
  verifySignupOTP,
  resendOTP,
  login,
  refreshAccessToken,
  verifyResetOTP,
  forgotPassword,
  logout,
};