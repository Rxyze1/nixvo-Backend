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
import Client from '../../Models/USER-Auth/Client-Model.js';

























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