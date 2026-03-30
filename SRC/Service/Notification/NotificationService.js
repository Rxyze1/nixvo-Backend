// Services/NotificationService.js

import Employee from '../../Models/USER-Auth/Employee-Model.js';
import Job from '../../Models/USER-Auth/Client/Job.js';
import Notification from '../../Models/Notification-Model/Notification.js';
import {
  sendJobMatchNotification,
  sendNewApplicationToClient,
  sendApplicationAccepted,
  sendApplicationRejected,
  sendJobCompleted,
  sendJobClosingSoonNotification
} from '../../Email/emailService.js';
import { sendPushNotificationsToUser, sendBatchPushNotifications } from './pushNotificationService.js'; // ✅ NEW

// ══════════════════════════════════════════════════════════════
// CORE: Create notification (DB + Push)
// ══════════════════════════════════════════════════════════════

export const createNotification = async (
  userId,
  type,
  title,
  message,
  data = {},
  pushTitle = null,
  pushBody = null
) => {
  try {
    // ✅ Save to DB
    const notification = await Notification.create({ userId, type, title, message, data });

    // ✅ Send push notification (if provided)
    if (pushTitle && pushBody) {
      setImmediate(() => {
        sendPushNotificationsToUser({
          userId,
          type,
          title: pushTitle,
          body: pushBody,
          data: { notificationId: notification._id.toString(), ...data }
        }).catch(err => {
          console.error(`⚠️  Push notification failed for ${userId}:`, err.message);
          // Update notification record with error
          Notification.findByIdAndUpdate(
            notification._id,
            { pushSent: false, pushError: err.message }
          ).catch(e => console.error('Failed to log push error:', e.message));
        });
      });
    }

    return notification;

  } catch (error) {
    console.error('❌ createNotification failed:', error.message);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════
// CORE: Bulk create notifications (DB + Push)
// ══════════════════════════════════════════════════════════════

export const createBulkNotifications = async (
  notifications,
  pushConfig = null // { type, title, body }
) => {
  try {
    if (!notifications.length) return [];

    // ✅ Save all to DB
    const created = await Notification.insertMany(notifications, { ordered: false });

    // ✅ Send push notifications (if config provided)
    if (pushConfig) {
      const userIds = [...new Set(notifications.map(n => n.userId.toString()))];

      setImmediate(() => {
        sendBatchPushNotifications(userIds, {
          type: pushConfig.type,
          title: pushConfig.title,
          body: pushConfig.body,
          data: pushConfig.data || {}
        }).catch(err => {
          console.error('⚠️  Batch push notifications failed:', err.message);
        });
      });
    }

    return created;

  } catch (error) {
    console.error('❌ createBulkNotifications failed:', error.message);
    return [];
  }
};

// ══════════════════════════════════════════════════════════════
// 🔔 JOB POSTED: Notify matching employees (DB + Email + Push)
// ══════════════════════════════════════════════════════════════

export const notifyMatchingEmployees = async (job) => {
  try {
    const {
      _id: jobId,
      jobTitle,
      clientId,
      requiredSkills,
      price,
      currency,
      needFor
    } = job;

    console.log(`\n🔔 Job Match Notification`);
    console.log(`   Job: "${jobTitle}"`);
    console.log(`   Required Skills: ${requiredSkills.join(', ')}`);

    const employeeQuery = {
      'availability.status': { $in: ['available', 'busy'] }
    };

    if (!requiredSkills.includes('all')) {
      employeeQuery.skills = { $in: requiredSkills };
    }

    const matchingEmployees = await Employee.find(employeeQuery)
      .select('userId skills')
      .populate('userId', 'email fullname')
      .lean();

    if (!matchingEmployees.length) {
      console.log('   ℹ️  No matching employees found\n');
      return 0;
    }

    console.log(`   ✅ ${matchingEmployees.length} matching employees found`);

    const client = await Job.findById(jobId)
      .select('userId')
      .populate('userId', 'fullname')
      .lean();
    const clientName = client?.userId?.fullname || 'A Client';

    // ✅ DB Notifications (bulk with push)
    const dbNotifications = matchingEmployees.map(emp => ({
      userId: emp.userId._id,
      type: 'job_match',
      title: `🎯 New Job: ${jobTitle}`,
      message: `A new ${needFor} job matching your skills was posted. Budget: ${currency} ${price}.`,
      data: { jobId, clientId }
    }));

    const created = await createBulkNotifications(
      dbNotifications,
      {
        type: 'job_match',
        title: `🎯 New Job: ${jobTitle}`,
        body: `${currency} ${price} • ${requiredSkills.join(', ')}`,
        data: { jobId, clientId }
      }
    );

    console.log(`   📬 ${created.length} notifications saved`);

    // ✅ Emails (parallel)
    await Promise.allSettled(
      matchingEmployees.map(emp =>
        sendJobMatchNotification(
          emp.userId.email,
          emp.userId.fullname,
          jobTitle,
          needFor,
          currency,
          price,
          requiredSkills,
          clientName,
          jobId
        )
      )
    );

    console.log(`   📧 Emails dispatched\n`);
    return created.length;

  } catch (error) {
    console.error('❌ notifyMatchingEmployees error:', error.message);
    return 0;
  }
};

// ══════════════════════════════════════════════════════════════
// 📩 NEW APPLICATION: Notify client (DB + Email + Push)
// ══════════════════════════════════════════════════════════════

export const notifyNewApplication = async (job, applicantUser, applicantEmployee) => {
  try {
    await Promise.allSettled([
      createNotification(
        job.userId._id,
        'new_application',
        `📩 New Application: ${job.jobTitle}`,
        `${applicantUser.fullname} has applied to your job.`,
        { jobId: job._id, employeeId: applicantEmployee._id },
        `📩 New Application`,           // ✅ push title
        `${applicantUser.fullname} applied to "${job.jobTitle}"`  // ✅ push body
      ),
      sendNewApplicationToClient(
        job.userId.email,
        job.userId.fullname,
        applicantUser.fullname,
        job.jobTitle,
        job._id,
        applicantEmployee.skills || []
      )
    ]);
  } catch (error) {
    console.error('❌ notifyNewApplication error:', error.message);
  }
};

// ══════════════════════════════════════════════════════════════
// ✅ APPLICATION ACCEPTED: Notify employee (DB + Email + Push)
// ══════════════════════════════════════════════════════════════

export const notifyApplicationAccepted = async (job, employeeUser, applicationDetails = {}) => {
  try {
    await Promise.allSettled([
      createNotification(
        employeeUser._id,
        'application_accepted',
        `✅ Application Accepted: ${job.jobTitle}`,
        `Your application for "${job.jobTitle}" was accepted!`,
        { jobId: job._id, clientId: job.clientId },
        `✅ Application Accepted`,      // ✅ push title
        `"${job.jobTitle}" • ${job.price} ${job.currency}`  // ✅ push body
      ),
      sendApplicationAccepted(
        employeeUser.email,
        employeeUser.fullname,
        job.jobTitle,
        job.description,
        applicationDetails.clientName || 'Client',
        job.price,
        applicationDetails.expectedDelivery || 'To be confirmed',
        job._id,
        applicationDetails.clientMessage || null,
        job.images?.[0]?.url || null
      )
    ]);
  } catch (error) {
    console.error('❌ notifyApplicationAccepted error:', error.message);
  }
};

// ══════════════════════════════════════════════════════════════
// ❌ APPLICATION REJECTED: Notify employee (DB + Email + Push)
// ══════════════════════════════════════════════════════════════

export const notifyApplicationRejected = async (
  job,
  employeeUser,
  applicationId,
  clientMessage = null,
  clientName = 'Client'
) => {
  try {
    await Promise.allSettled([
      createNotification(
        employeeUser._id,
        'application_rejected',
        `❌ Application Update: ${job.jobTitle}`,
        `Your application for "${job.jobTitle}" was not selected.`,
        { jobId: job._id, clientId: job.clientId },
        `Application Update`,           // ✅ push title
        `Not selected for "${job.jobTitle}"`  // ✅ push body
      ),
      sendApplicationRejected(
        employeeUser.email,
        employeeUser.fullname,
        job.jobTitle,
        job.description,
        clientName,
        applicationId,
        clientMessage,
        job.images?.[0]?.url || null
      )
    ]);
  } catch (error) {
    console.error('❌ notifyApplicationRejected error:', error.message);
  }
};

// ══════════════════════════════════════════════════════════════
// 🎉 JOB COMPLETED: Notify both (DB + Email + Push)
// ══════════════════════════════════════════════════════════════

export const notifyJobCompleted = async (job, clientUser, employeeUser) => {
  try {
    await Promise.allSettled([
      createNotification(
        clientUser._id,
        'job_completed',
        `🎉 Job Completed: ${job.jobTitle}`,
        `Your job "${job.jobTitle}" has been marked as complete.`,
        { jobId: job._id },
        `🎉 Job Completed`,
        `"${job.jobTitle}" is complete`
      ),
      createNotification(
        employeeUser._id,
        'job_completed',
        `🎉 Job Completed: ${job.jobTitle}`,
        `The job "${job.jobTitle}" has been marked as complete.`,
        { jobId: job._id },
        `🎉 Job Completed`,
        `"${job.jobTitle}" is complete`
      ),
      sendJobCompleted(clientUser.email, clientUser.fullname, job.jobTitle, 'client', job._id),
      sendJobCompleted(employeeUser.email, employeeUser.fullname, job.jobTitle, 'employee', job._id)
    ]);
  } catch (error) {
    console.error('❌ notifyJobCompleted error:', error.message);
  }
};

// ══════════════════════════════════════════════════════════════
// ⏳ JOB CLOSING SOON: Notify employees (DB + Email + Push)
// ══════════════════════════════════════════════════════════════

export const notifyJobClosingSoon = async (job) => {
  try {
    const {
      _id: jobId,
      jobTitle,
      clientId,
      requiredSkills,
      price,
      currency,
      needFor,
      closingAt
    } = job;

    console.log(`\n⏳ Closing-Soon Notification`);
    console.log(`   Job: "${jobTitle}"`);

    const employeeQuery = {
      'availability.status': { $in: ['available', 'busy'] }
    };
    if (!requiredSkills.includes('all')) {
      employeeQuery.skills = { $in: requiredSkills };
    }

    const matchingEmployees = await Employee.find(employeeQuery)
      .select('userId skills')
      .populate('userId', 'email fullname')
      .lean();

    if (!matchingEmployees.length) {
      console.log('   ℹ️  No matching employees found\n');
      return 0;
    }

    const clientDoc = await Job.findById(jobId)
      .select('userId')
      .populate('userId', 'fullname')
      .lean();
    const clientName = clientDoc?.userId?.fullname || 'A Client';

    const dbNotifications = matchingEmployees.map(emp => ({
      userId: emp.userId._id,
      type: 'job_closing_soon',
      title: `⏳ Closing Soon: ${jobTitle}`,
      message: `The job "${jobTitle}" is closing in 24 hours. Apply now! Budget: ${currency} ${price}.`,
      data: { jobId, clientId }
    }));

    const created = await createBulkNotifications(
      dbNotifications,
      {
        type: 'job_closing_soon',
        title: `⏳ Hurry: ${jobTitle}`,
        body: `Closes in 24 hours • ${currency} ${price}`,
        data: { jobId, clientId }
      }
    );

    console.log(`   📬 ${created.length} notifications saved`);

    await Promise.allSettled(
      matchingEmployees.map(emp =>
        sendJobClosingSoonNotification(
          emp.userId.email,
          emp.userId.fullname,
          jobTitle,
          needFor,
          currency,
          price,
          requiredSkills,
          clientName,
          jobId,
          closingAt
        )
      )
    );

    console.log(`   📧 Closing-soon emails dispatched\n`);
    return created.length;

  } catch (error) {
    console.error('❌ notifyJobClosingSoon error:', error.message);
    return 0;
  }
};

// ══════════════════════════════════════════════════════════════
// 👥 RECOMMENDED EMPLOYEES (unchanged)
// ══════════════════════════════════════════════════════════════

export const getRecommendedEmployees = async (jobId, limit = 10) => {
  try {
    const job = await Job.findById(jobId).select('requiredSkills').lean();
    if (!job) return [];

    const query = {
      'availability.status': 'available',
      'verificationDetails.status': 'approved'
    };

    if (!job.requiredSkills.includes('all')) {
      query.skills = { $in: job.requiredSkills };
    }

    return await Employee.find(query)
      .select('userId skills bio profilePic hourlyRate jobStats verifiedBadge hasBadge badgeType badgeLabel blueVerified adminVerified availability')
      .populate('userId', 'fullname username ratings')
      .sort({ verifiedBadge: -1, 'jobStats.completionRate': -1, 'jobStats.totalCompleted': -1 })
      .limit(limit)
      .lean()
      .then(employees => employees.map(emp => {
        const isPremium = emp.blueVerified?.status === true;
        return {
          ...emp,
          badge: emp.hasBadge ? {
            show: true, type: emp.badgeType, label: emp.badgeLabel,
            icon: emp.badgeType === 'blue-verified' ? 'verified' : emp.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
            color: emp.badgeType === 'blue-verified' ? '#0066FF' : emp.badgeType === 'admin-verified' ? '#00B37E' : '#888',
            bg: emp.badgeType === 'blue-verified' ? '#EBF5FF' : emp.badgeType === 'admin-verified' ? '#E6FAF5' : '#f0f0f0',
          } : { show: false },
          blueVerified: isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
          adminVerified: { status: emp.adminVerified?.status ?? false },
          tier: isPremium ? 'premium' : emp.adminVerified?.status ? 'verified' : 'free',
        };
      }));
  } catch (error) {
    console.error('❌ getRecommendedEmployees error:', error.message);
    return [];
  }
};

// ══════════════════════════════════════════════════════════════
// 💼 RECOMMENDED JOBS (unchanged)
// ══════════════════════════════════════════════════════════════

export const getRecommendedJobs = async (employeeId, limit = 10) => {
  try {
    const employee = await Employee.findById(employeeId).select('skills').lean();
    if (!employee) return [];

    return await Job.find({
      isActive: true,
      status: { $in: ['open', 'approved'] },
      $or: [
        { requiredSkills: { $in: employee.skills } },
        { requiredSkills: 'all' }
      ]
    })
      .populate('userId', 'fullname username ratings')
      .populate('clientId', 'bio profilePic')
      .sort({ postedAt: -1 })
      .limit(limit)
      .lean();

  } catch (error) {
    console.error('❌ getRecommendedJobs error:', error.message);
    return [];
  }
};

// ══════════════════════════════════════════════════════════════
// 📥 GET USER NOTIFICATIONS (unchanged)
// ══════════════════════════════════════════════════════════════

export const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('data.jobId', 'jobTitle status price currency needFor')
        .populate('data.employeeId', 'userId profilePic hasBadge badgeType badgeLabel blueVerified adminVerified')
        .populate('data.clientId', 'userId profilePic isPremium')
        .lean(),
      Notification.countDocuments({ userId }),
      Notification.getUnreadCount(userId)
    ]);

    const enrichedNotifications = notifications.map(notif => {
      const emp = notif.data?.employeeId;
      const cli = notif.data?.clientId;
      const enrichedData = { ...notif.data };

      if (emp && typeof emp === 'object') {
        const isPremium = emp.blueVerified?.status === true;
        enrichedData.employeeId = {
          ...emp,
          badge: emp.hasBadge ? {
            show: true, type: emp.badgeType, label: emp.badgeLabel,
            icon: emp.badgeType === 'blue-verified' ? 'verified' : emp.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
            color: emp.badgeType === 'blue-verified' ? '#0066FF' : emp.badgeType === 'admin-verified' ? '#00B37E' : '#888',
            bg: emp.badgeType === 'blue-verified' ? '#EBF5FF' : emp.badgeType === 'admin-verified' ? '#E6FAF5' : '#f0f0f0',
          } : { show: false },
          blueVerified: isPremium ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' } : { status: false },
          adminVerified: { status: emp.adminVerified?.status ?? false },
          tier: isPremium ? 'premium' : emp.adminVerified?.status ? 'verified' : 'free',
        };
      }

      if (cli && typeof cli === 'object') {
        enrichedData.clientId = {
          ...cli,
          isPremium: cli.isPremium ?? false,
          blueVerified: cli.isPremium
            ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
            : { status: false },
          tier: cli.isPremium ? 'premium' : 'free',
        };
      }

      return { ...notif, data: enrichedData };
    });

    return {
      notifications: enrichedNotifications,
      unreadCount,
      pagination: { total, page, pages: Math.ceil(total / limit), limit }
    };

  } catch (error) {
    console.error('❌ getUserNotifications error:', error.message);
    return { notifications: [], unreadCount: 0, pagination: {} };
  }
};

// ══════════════════════════════════════════════════════════════
// ✅ MARK AS READ (unchanged)
// ══════════════════════════════════════════════════════════════

export const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOne({ _id: notificationId, userId });
    if (!notification) return false;
    await notification.markRead();
    return true;
  } catch (error) {
    return false;
  }
};

export const markAllAsRead = async (userId) => {
  try {
    await Notification.markAllRead(userId);
    return true;
  } catch (error) {
    return false;
  }
};

export default {
  createNotification,
  createBulkNotifications,
  notifyMatchingEmployees,
  notifyNewApplication,
  notifyApplicationAccepted,
  notifyApplicationRejected,
  notifyJobCompleted,
  notifyJobClosingSoon,
  getRecommendedEmployees,
  getRecommendedJobs,
  getUserNotifications,
  markAsRead,
  markAllAsRead
};