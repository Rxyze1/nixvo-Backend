import { verifyAccessToken, verifyRefreshToken, generateAccessToken } from '../Config/tokenUtils.js';
import User from '../Models/USER-Auth/User-Auth.-Model.js';
import RefreshToken from '../Models/RefreshTokenModel.js';
import { unauthorizedResponse, forbiddenResponse } from '../Config/responseUtils.js';

// Middlewares/requireProfileCompleted.js

import Client   from '../Models/USER-Auth/Client-Model.js';
import Employee from '../Models/USER-Auth/Employee-Model.js';


export const COOKIE_OPTIONS = {
    ACCESS_TOKEN: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
    },
    REFRESH_TOKEN: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    }
};

// ✅ FIX 1 — supports both cookie (web) and header (mobile)
const extractToken = (req, tokenName = 'accessToken') => {
    // 1. PRIORITY: Check Headers (Required for Expo React Native Mobile)
    if (tokenName === 'accessToken') {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.split(' ')[1];
        }
    }
    if (tokenName === 'refreshToken') {
        const refreshHeader = req.headers['x-refresh-token'];
        if (refreshHeader) return refreshHeader;
    }

    // 2. FALLBACK: Check Cookies (Used by Web Browsers)
    if (req.cookies && req.cookies[tokenName]) {
        return req.cookies[tokenName];
    }

    return null;
};
export const protect = async (req, res, next) => {
    // ⭐ BACKUP ORIGINAL RES.JSON SO WE CAN INTERCEPT IT
    const originalJson = res.json.bind(res);

    try {
        const accessToken = extractToken(req, 'accessToken');

        if (!accessToken) {
            return unauthorizedResponse(res, 'No token provided');
        }

        try {
            const tokenResult = verifyAccessToken(accessToken);
            
            if (!tokenResult.valid) {
                throw new Error(tokenResult.error);
            }

            const decoded = tokenResult.decoded;

            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                return unauthorizedResponse(res, 'User not found');
            }

            if (!user.canLogin) {
                return forbiddenResponse(res, 'Account access denied');
            }

            req.user     = user;
            req.userId   = user._id;
            req.userType = user.userType;
            req.role     = user.role;

            user.lastActive = new Date();
            await user.save({ validateBeforeSave: false });

            return next();

        } catch (err) {
            console.error('⚠️ TOKEN VERIFICATION ERROR:', err.message);
            
            if (err.message === 'jwt expired' || err.message === 'Access token expired') {
                
                const refreshToken = extractToken(req, 'refreshToken');

                if (!refreshToken) {
                    return unauthorizedResponse(res, 'Token expired. Please login again');
                }

                try {
                    const refreshResult = verifyRefreshToken(refreshToken);
                    
                    if (!refreshResult.valid) {
                        throw new Error(refreshResult.error);
                    }

                    const decoded = refreshResult.decoded;

                    const storedToken = await RefreshToken.findOne({
                        token: refreshToken,
                        isRevoked: false,
                        expiresAt: { $gt: new Date() },
                    });

                    if (!storedToken) {
                        return unauthorizedResponse(res, 'Refresh token invalid or expired');
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

                    // 1. Give it to Web via HttpOnly Cookie
                    res.cookie('accessToken', newAccessToken, COOKIE_OPTIONS.ACCESS_TOKEN);
                    
                    // 2. Give it to Expo via Header
                    res.setHeader('x-new-access-token', newAccessToken);

                    // 3. Save it to req object
                    req.newAccessToken = newAccessToken; 

                    req.user          = user;
                    req.userId        = user._id;
                    req.userType      = user.userType;
                    req.role          = user.role;
                    req.tokenRefreshed = true;

                    console.log(`✅ Token auto-refreshed for ${user.email}`);

                    // ════════════════════════════════════════════════════════
                    // ⭐⭐⭐ THE MAGIC TRICK FOR EXPO (4 LINES OF CODE) ⭐⭐⭐
                    // We override res.json. If a new token was generated, 
                    // we secretly sneak it into the response body for Expo,
                    // while Web safely uses the HttpOnly cookie above.
                    // ════════════════════════════════════════════════════════
                    res.json = (data) => {
                        if (req.newAccessToken && data && data.data) {
                            data.data.newAccessToken = req.newAccessToken;
                        }
                        return originalJson(data);
                    };

                    return next();

                } catch (refreshErr) {
                    console.error('❌ Refresh token error:', refreshErr.message);
                    return unauthorizedResponse(res, 'Session expired. Please login again');
                }
            }

            return unauthorizedResponse(res, 'Invalid token');
        }

    } catch (error) {
        console.error('❌ Auth Error:', error.message);
        return unauthorizedResponse(res, 'Authentication failed');
    }
};

// All other exports stay exactly the same...
export const requireEmployee      = (req, res, next) => { if (req.userType !== 'employee') return forbiddenResponse(res, 'Only employees can access this'); next(); };
export const requireClient        = (req, res, next) => { if (req.userType !== 'client') return forbiddenResponse(res, 'Only clients can access this'); next(); };
export const requireOfficials     = (req, res, next) => { if (req.userType !== 'officials') return forbiddenResponse(res, 'Only officials can access this'); next(); };
export const requireEmployeeOrClient = (req, res, next) => { if (req.userType !== 'employee' && req.userType !== 'client') return forbiddenResponse(res, 'Access denied'); next(); };

const ROLE_LEVELS = { superadmin: 4, admin: 3, staff: 2, user: 1 };
const hasRoleLevel = (userRole, requiredRole) => (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 0);

export const requireSuperAdmin   = (req, res, next) => { if (!hasRoleLevel(req.role, 'superadmin')) return forbiddenResponse(res, 'Only superadmins can access this'); next(); };
export const requireAdmin        = (req, res, next) => { if (!hasRoleLevel(req.role, 'admin')) return forbiddenResponse(res, 'Only admins and above can access this'); next(); };
export const requireStaff        = (req, res, next) => { if (!hasRoleLevel(req.role, 'staff')) return forbiddenResponse(res, 'Only staff and above can access this'); next(); };
export const requireAdminOrAbove = (req, res, next) => { if (!hasRoleLevel(req.role, 'admin')) return forbiddenResponse(res, 'Insufficient permissions'); next(); };

export const optionalAuth = async (req, res, next) => {
    try {
        const accessToken = extractToken(req, 'accessToken');
        if (accessToken) {
            try {
                const tokenResult = verifyAccessToken(accessToken);
                if (tokenResult.valid) {
                    const user = await User.findById(tokenResult.decoded.id).select('-password');
                    if (user && user.canLogin) {
                        req.user     = user;
                        req.userId   = user._id;
                        req.userType = user.userType;
                        req.role     = user.role;
                    }
                }
            } catch (err) {
                console.log('ℹ️ Optional auth failed (non-critical):', err.message);
            }
        }
    } catch (error) {
        console.log('ℹ️ Optional auth error (non-critical):', error.message);
    }
    next();
};

export const requireProfileCompleted = async (req, res, next) => {
  try {
    const userId   = req.userId;
    const userType = req.userType;

    // ── Officials skip all checks ────────────────────────
    if (userType === 'officials') return next();

    // ── Check profileCompleted ───────────────────────────
    let profileCompleted = false;

    if (userType === 'client') {
      const client = await Client.findOne({ userId }, { profileCompleted: 1 }).lean();
      profileCompleted = client?.profileCompleted ?? false;
    }

    if (userType === 'employee') {
      const employee = await Employee.findOne({ userId }, { profileCompleted: 1 }).lean();
      profileCompleted = employee?.profileCompleted ?? false;
    }

    if (!profileCompleted) {
      return res.status(403).json({
        success: false,
        code:    'PROFILE_INCOMPLETE',
        message: '❌ Please complete your profile before accessing this feature',
        data: {
          profileCompleted: false,
          redirectTo:       '/profile/setup',
        },
      });
    }

    // ── Employee pending admin review ────────────────────
    if (userType === 'employee' && req.user.status === 'pending') {
      return res.status(403).json({
        success: false,
        code:    'PENDING_REVIEW',
        message: '⏳ Your profile is under review. You will be notified once approved.',
        data: {
          status:     'pending',
          redirectTo: '/profile/pending',
        },
      });
    }

    next();

  } catch (error) {
    console.error('❌ requireProfileCompleted error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Profile check failed',
    });
  }
};

export default { protect,requireProfileCompleted, requireEmployee, requireClient, requireOfficials, requireEmployeeOrClient, requireSuperAdmin, requireAdmin, requireStaff, requireAdminOrAbove, optionalAuth };