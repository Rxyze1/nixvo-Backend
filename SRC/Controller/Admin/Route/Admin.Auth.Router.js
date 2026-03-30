import express from 'express';
import {
    // ✅ PUBLIC ENDPOINTS
    adminSignup,
    verifyAdminSignupOTP,
    adminLogin,
    
    // ✅ PROTECTED ENDPOINTS
    adminLogout,
    getMyProfile,
    getMyActivity,
    
    // ✅ SUPER ADMIN ENDPOINTS
    getPendingAdmins,
    approveAdmin,
    rejectAdmin,
    adminApproveAdmin,
    
    // ✅ ADMIN ENDPOINTS
    getAllUsers,
    getAdminDashboard,
    getAdminLogs,
} from '../Admin.Controller/Auth/adminAuthController.js';

import {
    protectAdmin,
    requireSuperAdmin,
    requireAdminOrAbove,
    requirePermission,
    trackAdminActivity,
    autoLogAdminAction,
    validateObjectId,
} from '../Admin.middlewares/adminAuthMiddleware.js';

export const AdminAuthRoutes = express.Router();

// ═══════════════════════════════════════════════════════════════
// 🟢 PUBLIC ROUTES — No auth required
// ═══════════════════════════════════════════════════════════════

// ✅ 1️⃣ SIGNUP — Send OTP
AdminAuthRoutes.post('/signup', adminSignup);

// ✅ 2️⃣ VERIFY OTP — Create PENDING account
AdminAuthRoutes.post('/verify-otp', verifyAdminSignupOTP);

// ✅ 3️⃣ LOGIN — Create session
AdminAuthRoutes.post('/login', adminLogin);

// ═══════════════════════════════════════════════════════════════
// 🔵 PROTECTED ROUTES — All admins (active status required)
// ═══════════════════════════════════════════════════════════════

// ✅ 4️⃣ LOGOUT
AdminAuthRoutes.post(
    '/logout',
    protectAdmin,
    autoLogAdminAction('LOGOUT', (req) => ({
        targetType: 'admin',
        targetId: req.user._id,
        details: {
            action: 'Admin logged out',
            email: req.user.email,
            ipAddress: req.ip,
            timestamp: new Date(),
        },
    })),
    adminLogout
);

// ✅ 5️⃣ GET MY PROFILE
AdminAuthRoutes.get(
    '/profile',
    protectAdmin,
    trackAdminActivity,
    getMyProfile
);

// ✅ 6️⃣ GET MY ACTIVITY LOG
AdminAuthRoutes.get(
    '/my-activity',
    protectAdmin,
    trackAdminActivity,
    getMyActivity
);

// ═══════════════════════════════════════════════════════════════
// 🔴 SUPER ADMIN ROUTES — requireSuperAdmin
// ═══════════════════════════════════════════════════════════════

// ✅ 7️⃣ GET PENDING OFFICIALS
AdminAuthRoutes.get(
    '/pending',
    protectAdmin,
    requireSuperAdmin,
    trackAdminActivity,
    getPendingAdmins
);

// ✅ 8️⃣ APPROVE OFFICIAL — Super Admin only
AdminAuthRoutes.patch(
    '/admins/:adminIdToApprove/approve',
    protectAdmin,
    requireSuperAdmin,
    validateObjectId('adminIdToApprove'),
    autoLogAdminAction('APPROVE_ADMIN', (req) => ({
        targetType: 'admin',
        targetId: req.params.adminIdToApprove,
        details: {
            action: 'Official approved by Super Admin',
            approverEmail: req.user.email,
            timestamp: new Date(),
        },
    })),
    approveAdmin
);

// ✅ 9️⃣ REJECT OFFICIAL — Super Admin only
//    Body: { reason: string (min 10 chars) }
AdminAuthRoutes.patch(
    '/admins/:adminIdToReject/reject',
    protectAdmin,
    requireSuperAdmin,
    validateObjectId('adminIdToReject'),
    autoLogAdminAction('REJECT_ADMIN', (req) => ({
        targetType: 'admin',
        targetId: req.params.adminIdToReject,
        details: {
            action: 'Official rejected by Super Admin',
            reason: req.body.reason?.substring(0, 100),
            timestamp: new Date(),
        },
    })),
    rejectAdmin
);

// ═══════════════════════════════════════════════════════════════
// 🟣 ADMIN+ ROUTES — requireAdminOrAbove + permission check
// ═══════════════════════════════════════════════════════════════

// ✅ 🔟 PEER APPROVE — Admin can approve other pending admins
//    Requires: approve_admins permission
AdminAuthRoutes.patch(
    '/admins/:adminIdToApprove/peer-approve',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('approve_admins'),
    validateObjectId('adminIdToApprove'),
    autoLogAdminAction('PEER_APPROVE_ADMIN', (req) => ({
        targetType: 'admin',
        targetId: req.params.adminIdToApprove,
        details: {
            action: 'Official peer-approved by Admin',
            approverEmail: req.user.email,
            timestamp: new Date(),
        },
    })),
    adminApproveAdmin
);

// ✅ 1️⃣1️⃣ GET ALL USERS — paginated + filtered
//     Requires: view_all_users permission
AdminAuthRoutes.get(
    '/users',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('view_all_users'),
    trackAdminActivity,
    getAllUsers
);

// ✅ 1️⃣2️⃣ GET DASHBOARD
//     Requires: view_analytics permission
AdminAuthRoutes.get(
    '/dashboard',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('view_analytics'),
    trackAdminActivity,
    getAdminDashboard
);

// ✅ 1️⃣3️⃣ GET ADMIN LOGS
//     Requires: view_logs permission
AdminAuthRoutes.get(
    '/logs',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('view_logs'),
    trackAdminActivity,
    getAdminLogs
);

export default AdminAuthRoutes;