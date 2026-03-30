import express from 'express';
import {
  getPendingEmployees,
  getAllEmployees,
  getEmployeeDetails,
  approveEmployee,
  rejectEmployee,
  approveRejectedEmployee,
    getRejectedEmployees,
} from '../Admin.Controller/Employee-Managemnet/employeeManagementController.js';

import {
    protectAdmin,
    requireAdminOrAbove,
    requirePermission,
    trackAdminActivity,
    autoLogAdminAction,
    validateObjectId,
} from '../Admin.middlewares/adminAuthMiddleware.js';

export const EmployeeManagementRouter = express.Router();

// ✅ GET PENDING EMPLOYEES — requires permission
EmployeeManagementRouter.get(
    '/pending',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('approve_employees'),
    trackAdminActivity,
    getPendingEmployees
);

// ✅ GET ALL EMPLOYEES — requires permission
EmployeeManagementRouter.get(
    '/all',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('view_all_employees'),
    trackAdminActivity,
    getAllEmployees
);

// ✅ GET REJECTED EMPLOYEES — requires permission
EmployeeManagementRouter.get(
    '/rejected',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('approve_employees'),
    trackAdminActivity,
    getRejectedEmployees
);

// ✅ APPROVE REJECTED EMPLOYEE — with action logging
EmployeeManagementRouter.patch(
    '/:employeeId/approve-rejected',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('approve_employees'),
    validateObjectId('employeeId'),
    autoLogAdminAction('APPROVE_REJECTED_EMPLOYEE', (req) => ({
        targetType: 'employee',
        targetId: req.params.employeeId,
        details: {
            action: 'Rejected employee approved',
            approvalNotes: req.body.approvalNotes,
            approverEmail: req.user.email,
            timestamp: new Date(),
        },
    })),
    approveRejectedEmployee
);


// ✅ GET EMPLOYEE DETAILS
EmployeeManagementRouter.get(
    '/:employeeId',
    protectAdmin,
    requireAdminOrAbove,
    validateObjectId('employeeId'),
    trackAdminActivity,
    getEmployeeDetails
);

// ✅ APPROVE EMPLOYEE — with action logging
EmployeeManagementRouter.patch(
    '/:employeeId/approve',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('approve_employees'),
    validateObjectId('employeeId'),
    autoLogAdminAction('APPROVE_EMPLOYEE', (req) => ({
        targetType: 'employee',
        targetId: req.params.employeeId,
        details: {
            action: 'Employee approved',
            approverEmail: req.user.email,
            timestamp: new Date(),
        },
    })),
    approveEmployee
);

// ✅ REJECT EMPLOYEE — with action logging
EmployeeManagementRouter.patch(
    '/:employeeId/reject',
    protectAdmin,
    requireAdminOrAbove,
    requirePermission('approve_employees'),
    validateObjectId('employeeId'),
    autoLogAdminAction('REJECT_EMPLOYEE', (req) => ({
        targetType: 'employee',
        targetId: req.params.employeeId,
        details: {
            action: 'Employee rejected',
            reason: req.body.reason,
            rejectorEmail: req.user.email,
            timestamp: new Date(),
        },
    })),
    rejectEmployee
);







export default EmployeeManagementRouter;