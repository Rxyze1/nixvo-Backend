// Routes/Notification/NotificationRouter.js

import express from 'express';
import {
  protect,
  requireEmployee,
  requireClient,
} from '../../Middleware/authMiddleware.js';
import {

  getRecommendedJobsForEmployee,
  getRecommendedEmployeesForJob,
} from '../../Controller/Notification.Controller/notificationController.js';


export const NotificationRouter = express.Router();

// ══════════════════════════════════════════════════════════════
// NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════════

// ── Static routes first (before /:id) ────────────────────────

NotificationRouter.get(   '/recommended-jobs',             protect, requireEmployee, getRecommendedJobsForEmployee);
NotificationRouter.get(   '/recommended-employees/:jobId', protect, requireClient,   getRecommendedEmployeesForJob);

// ══════════════════════════════════════════════════════════════
// PUSH NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════════

export default NotificationRouter;