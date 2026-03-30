// middlewares/adminAuthMiddleware.js

import {
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
} from '../../../Config/tokenUtils.js';
import User         from '../../../Models/USER-Auth/User-Auth.-Model.js';
import RefreshToken from '../../../Models/RefreshTokenModel.js';
import AdminLog     from '../Models/AdminLogModel.js';
import { unauthorizedResponse, forbiddenResponse } from '../../../Config/responseUtils.js';
import { COOKIE_OPTIONS } from '../../../Middleware/authMiddleware.js';
import { isValidObjectId } from 'mongoose';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const ADMIN_ROLES = ['admin', 'super_admin', 'moderator'];

const ADMIN_ROLE_LEVELS = {
  super_admin: 3,
  admin:       2,
  moderator:   1,
};

// ✅ These roles bypass permission checks entirely
const BYPASS_PERMISSION_ROLES = ['super_admin', 'admin'];

// ✅ Throttle lastActive updates (prevents excessive DB writes)
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

const hasAdminRoleLevel = (userRole, requiredRole) =>
  (ADMIN_ROLE_LEVELS[userRole] || 0) >= (ADMIN_ROLE_LEVELS[requiredRole] || 0);

// ✅ Resolves target ID from multiple possible param names
const resolveTargetId = (req) =>
  req.params.employeeId       ||
  req.params.adminIdToApprove ||
  req.params.adminIdToReject  ||
  req.params.userId           ||
  req.params.id               ||
  req.body?.userId            ||
  null;

// ─── Shared validation for admin user ──

const STATUS_BLOCKS = {
  pending:   '⏳ Your account is pending Super Admin approval. Cannot access admin features until approved.',
  rejected:  '❌ Your admin application was rejected. Contact support.',
  suspended: '🚫 Your account is suspended. Contact Super Admin.',
  banned:    '🚫 Your account is banned. Contact Super Admin.',
};

const validateAdminUser = (user, res) => {
  // ✅ Check role exists
  if (!user?.role || !ADMIN_ROLES.includes(user.role)) {
    forbiddenResponse(res, 'Access denied. Admin privileges required.');
    return false;
  }

  // ✅ Check status is active
  if (user.status !== 'active') {
    forbiddenResponse(res, STATUS_BLOCKS[user.status] || `Cannot access. Account status: ${user.status}`);
    return false;
  }

  // ✅ Check email verification
  if (!user.isEmailVerified) {
    forbiddenResponse(res, 'Please verify your email first');
    return false;
  }

  return true;
};

const attachAdminToRequest = (req, user) => {
  req.user             = user;
  req.userId           = user._id;
  req.userType         = user.userType;
  req.role             = user.role;
  req.adminStatus      = user.status;
  req.adminPermissions = user.adminMetadata?.permissions || [];
};

// ✅ FIXED: Better error handling + only fires if needed
const throttledLastActive = async (user) => {
  try {
    if (!user?._id) return;

    const lastActive  = user.lastActive ? new Date(user.lastActive).getTime() : 0;
    const shouldUpdate = Date.now() - lastActive > LAST_ACTIVE_THROTTLE_MS;

    if (shouldUpdate) {
      // ✅ Fire-and-forget but with proper error handling
      User.findByIdAndUpdate(user._id, { lastActive: new Date() }, { new: false })
        .catch(err => console.error(`⚠️  lastActive update failed for ${user._id}:`, err.message));
    }
  } catch (error) {
    console.error('❌ throttledLastActive error:', error.message);
    // Don't throw — allow request to continue even if tracking fails
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ ADDED: OBJECTID VALIDATOR (Used in all dynamic routes)
// ═══════════════════════════════════════════════════════════════

export const validateObjectId = (paramName) => (req, res, next) => {
  try {
    const id = req.params[paramName];

    // ✅ Allow query routes (no param value)
    if (!id) return next();

    // ✅ Validate ObjectId format
    if (!isValidObjectId(id)) {
      console.error(`❌ Invalid ObjectId for ${paramName}: ${id}`);
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
        error: `Expected MongoDB ObjectId, got: ${id}`,
      });
    }

    next();
  } catch (error) {
    console.error(`❌ validateObjectId error (${paramName}):`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Validation error',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ ADDED: REQUEST BODY VALIDATOR
// ═══════════════════════════════════════════════════════════════

export const validateRequestBody = (schema) => (req, res, next) => {
  try {
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body?.[field];

      // ✅ Required field check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors[field] = rules.errorMsg || `${field} is required`;
        continue;
      }

      // ✅ Skip validation if optional and absent
      if (!rules.required && !value) continue;

      // ✅ Type check
      if (rules.type && typeof value !== rules.type) {
        errors[field] = rules.errorMsg || `${field} must be type ${rules.type}, got ${typeof value}`;
        continue;
      }

      // ✅ String length validation
      if (typeof value === 'string') {
        if (rules.minLength && value.trim().length < rules.minLength) {
          errors[field] = rules.errorMsg || `${field} must be at least ${rules.minLength} characters`;
          continue;
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          errors[field] = `${field} must not exceed ${rules.maxLength} characters`;
          continue;
        }

        // ✅ Pattern (regex) validation
        if (rules.pattern && !rules.pattern.test(value)) {
          errors[field] = rules.errorMsg || `${field} format is invalid`;
          continue;
        }
      }

      // ✅ Array validation
      if (Array.isArray(value)) {
        if (rules.minItems && value.length < rules.minItems) {
          errors[field] = `${field} must have at least ${rules.minItems} items`;
          continue;
        }

        if (rules.maxItems && value.length > rules.maxItems) {
          errors[field] = `${field} must not have more than ${rules.maxItems} items`;
          continue;
        }
      }

      // ✅ Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors[field] = `${field} must be one of: ${rules.enum.join(', ')}`;
        continue;
      }
    }

    // ✅ Return validation errors
    if (Object.keys(errors).length > 0) {
      console.warn(`⚠️  Request validation failed for:`, errors);
      return res.status(400).json({
        success: false,
        message: 'Request validation failed',
        errors,
      });
    }

    next();
  } catch (error) {
    console.error('❌ validateRequestBody error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Validation error',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔐 protectAdmin — Main Auth Middleware
// ═══════════════════════════════════════════════════════════════

export const protectAdmin = async (req, res, next) => {
  try {
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      return unauthorizedResponse(res, 'No token provided. Please login.');
    }

    // ── Happy path: valid access token ──────────────────────────
    try {
      const tokenResult = verifyAccessToken(accessToken);
      if (!tokenResult.valid) throw new Error(tokenResult.error);

      const user = await User.findById(tokenResult.decoded.id).select('-password');
      if (!user) return unauthorizedResponse(res, 'Admin account not found');

      if (!validateAdminUser(user, res)) return;

      attachAdminToRequest(req, user);
      await throttledLastActive(user);

      return next();

    } catch (err) {

      // ── Auto-refresh path: expired access token ──────────────
      if (err.message !== 'jwt expired' && err.message !== 'Access token expired') {
        console.error('⚠️  Admin token error:', err.message);
        return unauthorizedResponse(res, 'Invalid admin token');
      }

      console.log('🔄 Access token expired — attempting refresh...');

      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return unauthorizedResponse(res, 'Session expired. Please login again.');
      }

      try {
        const refreshResult = verifyRefreshToken(refreshToken);
        if (!refreshResult.valid) throw new Error(refreshResult.error);

        const storedToken = await RefreshToken.findOne({
          token:     refreshToken,
          isRevoked: false,
          expiresAt: { $gt: new Date() },
        });

        if (!storedToken) {
          return unauthorizedResponse(res, 'Refresh token invalid or expired');
        }

        const user = await User.findById(refreshResult.decoded.id).select('-password');
        if (!user) return unauthorizedResponse(res, 'Admin account not found');

        if (!validateAdminUser(user, res)) return;

        const newAccessToken = generateAccessToken(
          user._id.toString(),
          user.userType,
          user.email,
          user.role
        );

        res.cookie('accessToken', newAccessToken, COOKIE_OPTIONS.ACCESS_TOKEN);

        attachAdminToRequest(req, user);
        await throttledLastActive(user);
        req.tokenRefreshed = true;

        console.log(`✅ Token auto-refreshed for ${user.email}`);
        return next();

      } catch (refreshErr) {
        console.error('❌ Refresh token error:', refreshErr.message);
        return unauthorizedResponse(res, 'Session expired. Please login again.');
      }
    }

  } catch (error) {
    console.error('❌ Admin Auth Error:', error.message);
    return unauthorizedResponse(res, 'Admin authentication failed');
  }
};

// ═══════════════════════════════════════════════════════════════
// 👑 ROLE HIERARCHY MIDDLEWARES
// ═══════════════════════════════════════════════════════════════

export const requireSuperAdmin = (req, res, next) => {
  if (!hasAdminRoleLevel(req.role, 'super_admin')) {
    return forbiddenResponse(res, 'Only Super Admins can access this resource');
  }
  next();
};

export const requireAdminOrAbove = (req, res, next) => {
  if (!hasAdminRoleLevel(req.role, 'admin')) {
    return forbiddenResponse(res, 'Only Admins and Super Admins can access this resource');
  }
  next();
};

export const requireStaffOrAbove = (req, res, next) => {
  if (!hasAdminRoleLevel(req.role, 'moderator')) {
    return forbiddenResponse(res, 'Insufficient admin privileges');
  }
  next();
};

// ═══════════════════════════════════════════════════════════════
// 🔑 PERMISSION-BASED MIDDLEWARES
// ═══════════════════════════════════════════════════════════════

export const requirePermission = (permission) => (req, res, next) => {
  if (BYPASS_PERMISSION_ROLES.includes(req.role)) return next();

  if (!req.adminPermissions?.includes(permission)) {
    return forbiddenResponse(res, `Permission denied. Required: ${permission}`);
  }
  next();
};

export const requireAnyPermission = (permissions) => (req, res, next) => {
  if (BYPASS_PERMISSION_ROLES.includes(req.role)) return next();

  if (!permissions.some(p => req.adminPermissions?.includes(p))) {
    return forbiddenResponse(res, `Permission denied. Required any of: ${permissions.join(', ')}`);
  }
  next();
};

export const requireAllPermissions = (permissions) => (req, res, next) => {
  if (BYPASS_PERMISSION_ROLES.includes(req.role)) return next();

  if (!permissions.every(p => req.adminPermissions?.includes(p))) {
    return forbiddenResponse(res, `Permission denied. Required all of: ${permissions.join(', ')}`);
  }
  next();
};

// ═══════════════════════════════════════════════════════════════
// 🚫 SELF / HIGHER-ROLE PROTECTION
// ═══════════════════════════════════════════════════════════════

export const preventSelfModification = (req, res, next) => {
  const targetId = resolveTargetId(req);

  if (targetId && targetId.toString() === req.userId.toString()) {
    return forbiddenResponse(res, 'You cannot perform this action on your own account');
  }
  next();
};

// ✅ FIXED: Added user existence check + defensive coding
export const preventTargetingHigherRole = async (req, res, next) => {
  try {
    const targetId = resolveTargetId(req);
    if (!targetId) return next();

    // ✅ Validate targetId is a valid ObjectId
    if (!isValidObjectId(targetId)) {
      console.warn(`⚠️  Invalid targetId in preventTargetingHigherRole: ${targetId}`);
      return next();
    }

    const targetUser = await User.findById(targetId).select('role');
    
    // ✅ If user doesn't exist, allow next() (controller will handle 404)
    if (!targetUser) return next();

    const currentLevel = ADMIN_ROLE_LEVELS[req.role]       || 0;
    const targetLevel  = ADMIN_ROLE_LEVELS[targetUser.role] || 0;

    if (targetLevel >= currentLevel) {
      return forbiddenResponse(res, 'You cannot perform this action on admins of equal or higher level');
    }

    next();
  } catch (error) {
    console.error('❌ preventTargetingHigherRole error:', error.message);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════
// 📝 LOGGING MIDDLEWARES
// ═══════════════════════════════════════════════════════════════

export const logAdminAction = (action, getTargetInfo) => async (req, res, next) => {
  try {
    const targetInfo   = getTargetInfo?.(req) ?? {};
    req.adminActionLog = {
      adminId:    req.userId,
      action,
      targetType: targetInfo.targetType || 'unknown',
      targetId:   targetInfo.targetId   || null,
      details: {
        ...targetInfo.details,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'] || '',
      },
    };
    next();
  } catch (error) {
    console.error('❌ logAdminAction error:', error.message);
    next();
  }
};

export const saveAdminLog = async (req, additionalDetails = {}) => {
  try {
    if (!req.adminActionLog) return;
    await AdminLog.create({
      ...req.adminActionLog,
      details: { ...req.adminActionLog.details, ...additionalDetails },
    });
    console.log(`✅ Admin action logged: ${req.adminActionLog.action}`);
  } catch (error) {
    console.error('❌ saveAdminLog error:', error.message);
  }
};

// ✅ FIXED: Better intercept handling + proper error handling
export const autoLogAdminAction = (action, getTargetInfo) => (req, res, next) => {
  try {
    // ✅ Store ORIGINAL res.json only once
    if (!res._originalJson) {
      res._originalJson = res.json;
    }

    res.json = function (data) {
      const statusCode = res.statusCode;
      
      // ✅ Always call the ORIGINAL
      const result = res._originalJson.call(this, data);

      // ✅ Fire-and-forget logging for successful responses
      if (statusCode >= 200 && statusCode < 300 && req.userId) {
        try {
          const targetInfo = getTargetInfo?.(req) ?? {};
          AdminLog.create({
            adminId:    req.userId,
            action,
            targetType: targetInfo.targetType || 'unknown',
            targetId:   targetInfo.targetId   || null,
            details: {
              ...targetInfo.details,
              statusCode,
              ipAddress: req.ip || req.socket?.remoteAddress,
              userAgent: req.headers['user-agent'] || '',
            },
          }).catch(err => {
            console.error(`❌ autoLogAdminAction DB error (${action}):`, err.message);
          });
        } catch (err) {
          console.error(`❌ autoLogAdminAction setup error (${action}):`, err.message);
        }
      }

      return result;
    };

    next();
    
  } catch (error) {
    console.error('❌ autoLogAdminAction setup error:', error.message);
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════
// 📊 ACTIVITY TRACKING
// ✅ protectAdmin already calls throttledLastActive()
//    trackAdminActivity is for explicit use on non-protected routes
// ═══════════════════════════════════════════════════════════════

export const trackAdminActivity = (req, res, next) => {
  try {
    if (req.userId && req.user) {
      throttledLastActive(req.user).catch(err => {
        console.error('⚠️  trackAdminActivity error:', err.message);
      });
    }
    next();
  } catch (error) {
    console.error('❌ trackAdminActivity error:', error.message);
    next();
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ EXPORTS — All middlewares + added missing ones
// ═══════════════════════════════════════════════════════════════

export default {
  protectAdmin,
  requireSuperAdmin,
  requireAdminOrAbove,
  requireStaffOrAbove,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  logAdminAction,
  saveAdminLog,
  autoLogAdminAction,
  preventSelfModification,
  preventTargetingHigherRole,
  trackAdminActivity,
  validateObjectId,        // ✅ ADDED
  validateRequestBody,     // ✅ ADDED
};