// Controllers/notificationController.js
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getRecommendedJobs,
  getRecommendedEmployees
} from '../../Service/Notification/NotificationService.js';
import Employee from '../../Models/USER-Auth/Employee-Model.js';
import Notification from '../../Models/Notification-Model/Notification.js';

// ══════════════════════════════════════════════════════════════
// GET /api/notifications
// Get all notifications for logged-in user (paginated)
// ══════════════════════════════════════════════════════════════

export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const result = await getUserNotifications(
      req.user._id,
      Number(page),
      Number(limit)
    );

    // ── Optional: filter unread only ──────────────────────────
    if (unreadOnly === 'true') {
      result.notifications = result.notifications.filter(n => !n.isRead);
    }

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ getNotifications error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// GET /api/notifications/unread-count
// Get unread notification count only (lightweight — for bell icon)
// ══════════════════════════════════════════════════════════════

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);

    return res.status(200).json({
      success: true,
      unreadCount: count
    });

  } catch (error) {
    console.error('❌ getUnreadCount error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// PATCH /api/notifications/:id/read
// Mark a single notification as read
// ══════════════════════════════════════════════════════════════

export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const success = await markAsRead(id, req.user._id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('❌ markNotificationAsRead error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// PATCH /api/notifications/read-all
// Mark ALL notifications as read for logged-in user
// ══════════════════════════════════════════════════════════════

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    await markAllAsRead(req.user._id);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('❌ markAllNotificationsAsRead error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all as read'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// DELETE /api/notifications/:id
// Delete a single notification
// ══════════════════════════════════════════════════════════════

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user._id   // ✅ Security: user can only delete their own
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });

  } catch (error) {
    console.error('❌ deleteNotification error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// DELETE /api/notifications/clear-all
// Delete ALL notifications for logged-in user
// ══════════════════════════════════════════════════════════════

export const clearAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user._id });

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} notifications cleared`
    });

  } catch (error) {
    console.error('❌ clearAllNotifications error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear notifications'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// GET /api/notifications/recommended-jobs
// Recommended jobs for employee based on their skills
// ── Employee only ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export const getRecommendedJobsForEmployee = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // ── Guard: must be an employee ────────────────────────────
    if (req.user.userType !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Only employees can access recommended jobs'
      });
    }

    const employee = await Employee.findOne({ userId: req.user._id })
      .select('_id')
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found'
      });
    }

    const jobs = await getRecommendedJobs(employee._id, Number(limit));

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs
    });

  } catch (error) {
    console.error('❌ getRecommendedJobsForEmployee error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recommended jobs'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// GET /api/notifications/recommended-employees/:jobId
// Recommended employees for a specific job based on required skills
// ── Client only ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export const getRecommendedEmployeesForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 10 } = req.query;

    // ── Guard: must be a client ───────────────────────────────
    if (req.user.userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can access recommended employees'
      });
    }

    const employees = await getRecommendedEmployees(jobId, Number(limit));

    return res.status(200).json({
      success: true,
      count: employees.length,
      employees
    });

  } catch (error) {
    console.error('❌ getRecommendedEmployeesForJob error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recommended employees'
    });
  }
};