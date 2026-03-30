// config/permissions.js

/**
 * ════════════════════════════════════════════════════════════════
 *                    📋 COMPLETE PERMISSION SYSTEM
 * ════════════════════════════════════════════════════════════════
 */

// ═══════════════════ ROLE HIERARCHY ═══════════════════
export const ROLE_HIERARCHY = {
    superadmin: 4,
    admin: 3,
    staff: 2,
    user: 1,
};

// ═══════════════════ ROLE PERMISSIONS ═══════════════════
export const ROLE_PERMISSIONS = {
    superadmin: [
        // System Management
        'system:manage',
        'system:settings',
        'system:backup',
        
        // User Management
        'users:create',
        'users:read',
        'users:update',
        'users:delete',
        'users:ban',
        'users:unban',
        'users:impersonate',
        
        // Admin Management
        'admins:create',
        'admins:read',
        'admins:update',
        'admins:delete',
        
        // Role Management
        'roles:assign',
        'roles:revoke',
        
        // Employee Management
        'employees:approve',
        'employees:reject',
        'employees:view',
        'employees:manage',
        
        // Client Management
        'clients:view',
        'clients:manage',
        
        // Financial
        'wallet:view_all',
        'wallet:modify',
        'transactions:view_all',
        'withdrawals:approve',
        'withdrawals:reject',
        
        // Disputes
        'disputes:view_all',
        'disputes:resolve',
        
        // Reports & Analytics
        'reports:view',
        'reports:generate',
        'analytics:view',
        
        // All sections
        'section:employee',
        'section:client',
        'section:officials',
        'section:admin',
    ],

    admin: [
        // User Management
        'users:read',
        'users:update',
        'users:ban',
        'users:unban',
        
        // Employee Management
        'employees:approve',
        'employees:reject',
        'employees:view',
        'employees:manage',
        
        // Client Management
        'clients:view',
        'clients:manage',
        
        // Financial (limited)
        'wallet:view',
        'transactions:view',
        'withdrawals:review',
        
        // Disputes
        'disputes:view',
        'disputes:resolve',
        
        // Reports
        'reports:view',
        'reports:generate',
        
        // Sections
        'section:employee',
        'section:client',
        'section:officials',
        'section:admin',
    ],

    staff: [
        // User Management (read-only)
        'users:read',
        
        // Support
        'support:tickets',
        'support:respond',
        
        // Employee & Client (view)
        'employees:view',
        'clients:view',
        
        // Disputes (escalate only)
        'disputes:view',
        'disputes:escalate',
        
        // Reports (view)
        'reports:view',
        
        // Sections (limited)
        'section:employee',
        'section:client',
    ],

    user: [
        // Own profile
        'profile:read',
        'profile:update',
        
        // Own wallet
        'wallet:view_own',
        
        // Own transactions
        'transactions:view_own',
    ],
};

// ═══════════════════ USER TYPE PERMISSIONS ═══════════════════
export const USER_TYPE_PERMISSIONS = {
    employee: [
        // Job Applications
        'jobs:search',
        'jobs:view',
        'jobs:apply',
        
        // Applications
        'applications:view_own',
        'applications:withdraw',
        
        // Wallet & Earnings
        'wallet:view_own',
        'wallet:withdraw',
        'earnings:view',
        
        // Messages
        'messages:send',
        'messages:receive',
        
        // Profile
        'profile:update',
        'profile:skills',
        'profile:portfolio',
        
        // Reviews
        'reviews:receive',
        
        // Section Access
        'section:employee',
        
        // Premium Features (if approved)
        'disputes:raise', // Only if premium
        'priority:support', // Only if premium
    ],

    client: [
        // Job Management
        'jobs:create',
        'jobs:view_own',
        'jobs:update_own',
        'jobs:delete_own',
        'jobs:close',
        
        // Applications
        'applications:view',
        'applications:accept',
        'applications:reject',
        
        // Hiring
        'employees:hire',
        'employees:rate',
        'employees:review',
        
        // Wallet
        'wallet:view_own',
        'wallet:add_funds',
        'payments:make',
        
        // Messages
        'messages:send',
        'messages:receive',
        
        // Profile
        'profile:update',
        'company:manage',
        
        // Section Access
        'section:client',
        
        // Premium Features
        'disputes:raise', // Only if premium
        'priority:listing', // Only if premium
    ],

    officials: [
        // Oversight
        'employees:view',
        'clients:view',
        'jobs:view_all',
        
        // Reports & Analytics
        'reports:view',
        'reports:request',
        'analytics:view',
        
        // Audits
        'audits:request',
        'audits:view',
        
        // Compliance
        'compliance:check',
        'compliance:report',
        
        // Monitoring
        'monitoring:platform',
        'monitoring:users',
        
        // Section Access
        'section:officials',
    ],
};

// ═══════════════════ PREMIUM PERMISSIONS ═══════════════════
export const PREMIUM_PERMISSIONS = {
    employee_premium: [
        'disputes:raise',
        'priority:support',
        'profile:badge',
        'applications:priority',
        'withdrawals:instant',
    ],

    client_premium: [
        'disputes:raise',
        'priority:support',
        'jobs:featured',
        'jobs:priority_listing',
        'analytics:advanced',
    ],
};

// ════════════════════════════════════════════════════════════════
//                    PERMISSION CHECKER FUNCTIONS
// ════════════════════════════════════════════════════════════════

/**
 * Check if role has permission
 */
export const roleHasPermission = (role, permission) => {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
};

/**
 * Check if user type has permission
 */
export const userTypeHasPermission = (userType, permission) => {
    const permissions = USER_TYPE_PERMISSIONS[userType] || [];
    return permissions.includes(permission);
};

/**
 * Check if premium plan has permission
 */
export const premiumHasPermission = (plan, permission) => {
    const permissions = PREMIUM_PERMISSIONS[plan] || [];
    return permissions.includes(permission);
};

/**
 * Check role hierarchy
 */
export const hasHigherRole = (userRole, requiredRole) => {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
};

/**
 * Get all permissions for a user
 */
export const getUserPermissions = (user) => {
    const rolePerms = ROLE_PERMISSIONS[user.role] || [];
    const typePerms = USER_TYPE_PERMISSIONS[user.userType] || [];
    const premiumPerms = user.subscription?.plan !== 'free' 
        ? (PREMIUM_PERMISSIONS[user.subscription.plan] || []) 
        : [];

    // Combine and deduplicate
    return [...new Set([...rolePerms, ...typePerms, ...premiumPerms])];
};

/**
 * Check if user has specific permission
 */
export const userHasPermission = (user, permission) => {
    const allPermissions = getUserPermissions(user);
    
    // Check for wildcard permissions (e.g., 'users:*' grants all user permissions)
    const hasWildcard = allPermissions.some(perm => {
        if (!perm.includes('*')) return false;
        const prefix = perm.split(':')[0];
        return permission.startsWith(prefix + ':');
    });

    return allPermissions.includes(permission) || hasWildcard;
};

/**
 * Check if user has ANY of the permissions
 */
export const userHasAnyPermission = (user, permissions) => {
    return permissions.some(perm => userHasPermission(user, perm));
};

/**
 * Check if user has ALL permissions
 */
export const userHasAllPermissions = (user, permissions) => {
    return permissions.every(perm => userHasPermission(user, perm));
};

/**
 * Get sections user can access
 */
export const getUserSections = (user) => {
    const permissions = getUserPermissions(user);
    const sections = {
        employee: permissions.includes('section:employee'),
        client: permissions.includes('section:client'),
        officials: permissions.includes('section:officials'),
        admin: permissions.includes('section:admin'),
    };

    return sections;
};

export default {
    ROLE_HIERARCHY,
    ROLE_PERMISSIONS,
    USER_TYPE_PERMISSIONS,
    PREMIUM_PERMISSIONS,
    roleHasPermission,
    userTypeHasPermission,
    premiumHasPermission,
    hasHigherRole,
    getUserPermissions,
    userHasPermission,
    userHasAnyPermission,
    userHasAllPermissions,
    getUserSections,
};