// Routes/Notification/ClientNotificationRouter.js

import express from 'express';
import { protect, requireClient } from '../../../Middleware/authMiddleware.js';
import { 
  getClientNotifications,
  getClientUnreadCount,
  markClientNotificationAsRead,
  markAllClientAsRead,
  deleteClientNotification
} from '../../../Controller/Notification.Controller/Clinet-notification/clientNotificationController.js';

export const ClientNotificationRouter = express.Router();

// ══════════════════════════════════════════════════════════════
// 👔 CLIENT NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════════

// ── GET: All notifications (messages + applications + system) ──
ClientNotificationRouter.get(
  '/',
  protect,
  requireClient,
  getClientNotifications
);

// ── GET: Unread count (lightweight — for bell icon) ─────────────
ClientNotificationRouter.get(
  '/unread-count',
  protect,
  requireClient,
  getClientUnreadCount
);

// ── PATCH: Mark single notification as read ─────────────────────
ClientNotificationRouter.patch(
  '/:notificationId/read',
  protect,
  requireClient,
  markClientNotificationAsRead
);

// ── PATCH: Mark ALL notifications as read ────────────────────────
ClientNotificationRouter.patch(
  '/read-all',
  protect,
  requireClient,
  markAllClientAsRead
);

// ── DELETE: Single notification ────────────────────────────────────
ClientNotificationRouter.delete(
  '/:notificationId',
  protect,
  requireClient,
  deleteClientNotification
);