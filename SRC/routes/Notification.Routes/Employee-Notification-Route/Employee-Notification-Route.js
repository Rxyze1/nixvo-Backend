// Routes/Notification/EmployeeNotificationRouter.js

import express from 'express';
import employeeNotificationController from '../../../Controller/Notification.Controller/Employee-Notification/employeeNotificationController.js';
import { protect, requireEmployee } from '../../../Middleware/authMiddleware.js';

export const EmployeeNotificationRouter = express.Router();

// ══════════════════════════════════════════════════════════════
// 👷 EMPLOYEE NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════════

// ── GET: All notifications (messages + application updates + system) ──
EmployeeNotificationRouter.get(
  '/',
  protect,
  requireEmployee,
  employeeNotificationController.getEmployeeNotifications
);

// ── GET: Unread count (lightweight — for bell icon) ─────────────
EmployeeNotificationRouter.get(
  '/unread-count',
  protect,
  requireEmployee,
  employeeNotificationController.getEmployeeUnreadCount
);

// ── PATCH: Mark single notification as read ─────────────────────
EmployeeNotificationRouter.patch(
  '/:notificationId/read',
  protect,
  requireEmployee,
  employeeNotificationController.markEmployeeNotificationAsRead
);

// ── PATCH: Mark ALL notifications as read ────────────────────────
EmployeeNotificationRouter.patch(
  '/read-all',
  protect,
  requireEmployee,
  employeeNotificationController.markAllEmployeeAsRead
);

// ── DELETE: Single notification ─────────────────────────────────
EmployeeNotificationRouter.delete(
  '/:notificationId',
  protect,
  requireEmployee,
  employeeNotificationController.deleteEmployeeNotification
);