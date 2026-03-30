// Routes/Notification/NotificationRouter.js

import express from 'express';
import {
  protect,
  requireEmployee,
  requireClient,
} from '../../Middleware/authMiddleware.js';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  getRecommendedJobsForEmployee,
  getRecommendedEmployeesForJob,
} from '../../Controller/Notification.Controller/notificationController.js';
import {
  registerPushToken,
  unregisterPushToken,
  getMyDevices,
  removeDevice,
  sendTestNotification,
  sendNotificationToUser,
  sendBatchNotifications,
  sendJobNotification,
} from '../../Controller/Notification.Controller/pushTokenController.js';

export const NotificationRouter = express.Router();

// ══════════════════════════════════════════════════════════════
// NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════════

// ── Static routes first (before /:id) ────────────────────────
NotificationRouter.get(   '/',                             protect,                  getNotifications);
NotificationRouter.get(   '/unread-count',                 protect,                  getUnreadCount);
NotificationRouter.get(   '/recommended-jobs',             protect, requireEmployee, getRecommendedJobsForEmployee);
NotificationRouter.get(   '/recommended-employees/:jobId', protect, requireClient,   getRecommendedEmployeesForJob);
NotificationRouter.patch( '/read-all',                     protect,                  markAllNotificationsAsRead);
NotificationRouter.delete('/clear-all',                    protect,                  clearAllNotifications);

// ── Parameterized routes last ─────────────────────────────────
NotificationRouter.patch( '/:id/read',                     protect,                  markNotificationAsRead);
NotificationRouter.delete('/:id',                          protect,                  deleteNotification);

// ══════════════════════════════════════════════════════════════
// PUSH NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════════

// ── Device registration ───────────────────────────────────────
NotificationRouter.post(   '/push/register-token',         protect,                  registerPushToken);
NotificationRouter.delete( '/push/unregister-token/:token',protect,                  unregisterPushToken);

// ── Device management ─────────────────────────────────────────
NotificationRouter.get(    '/push/my-devices',             protect,                  getMyDevices);
NotificationRouter.delete( '/push/device/:deviceId',       protect,                  removeDevice);

// ── Send test notification ────────────────────────────────────
NotificationRouter.post(   '/push/send-test',              protect,                  sendTestNotification);

// ── Admin routes (send to users) ──────────────────────────────
NotificationRouter.post(   '/push/send-to-user',           protect,                  sendNotificationToUser);
NotificationRouter.post(   '/push/send-batch',             protect,                  sendBatchNotifications);
NotificationRouter.post(   '/push/send-job-notification',  protect,                  sendJobNotification);

export default NotificationRouter;