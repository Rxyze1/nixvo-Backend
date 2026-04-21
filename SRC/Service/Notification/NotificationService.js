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

// ══════════════════════════════════════════════════════════════
// CORE: Create notification (DB ONLY - Model Hook sends Push)
// ══════════════════════════════════════════════════════════════

export const createNotification = async (
  userId,
  type,
  title,
  message,
  data = {}
) => {
  try {


    // 🔥 ADD THESE LOGS TO CATCH THE HOOK:
    console.log(`\n⚠️⚠️⚠️ [DB HOOK TRIGGERED] createNotification called! ⚠️⚠️⚠️`);
    console.log(`📍 Target User ID: ${userId}`);
    console.log(`📝 Type: ${type} | Title: ${title}`);
    console.log(`📦 Data being sent to hook:`, JSON.stringify(data));


    // Inject navigation screen based on type
    let enrichedData = { ...data };

    if (type === 'job_match' || type === 'job_closing_soon') {
      enrichedData.screen = 'JobDetails';
    } else if (type === 'new_application') {
      enrichedData.screen = 'JobApplications'; 
    } else if (type === 'application_accepted' || type === 'application_rejected') {
      enrichedData.screen = 'ApplicationStatus';
    } else if (type === 'job_completed') {
      enrichedData.screen = 'Wallet';
    } else if (type === 'message') {
      enrichedData.screen = 'MessageScreen';
    }

    // Save to DB -> Model Hook AUTOMATICALLY triggers push notification!
    const notification = await Notification.create({ 
      userId, 
      type, 
      title, 
      message, 
      data: enrichedData 
    });

    return notification;

  } catch (error) {
    console.error('❌ createNotification failed:', error.message);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════
// CORE: Bulk create notifications (DB ONLY - Model Hook sends Push)
// ══════════════════════════════════════════════════════════════

export const createBulkNotifications = async (notifications) => {
  try {
    if (!notifications.length) return [];


     // 🔥 ADD THESE LOGS:
    console.log(`\n⚠️⚠️⚠️ [DB HOOK TRIGGERED] createBulkNotifications called! ⚠️⚠️⚠️`);
    console.log(`📦 Sending ${notifications.length} notifications through the DB Hook`);

    // Inject navigation screen for bulk notifications
    const enrichedNotifications = notifications.map(notif => {
      let enrichedData = { ...notif.data };

      if (notif.type === 'job_match' || notif.type === 'job_closing_soon') {
        enrichedData.screen = 'JobDetails';
      } else if (notif.type === 'new_application') {
        enrichedData.screen = 'JobApplications';
      } else if (notif.type === 'application_accepted' || notif.type === 'application_rejected') {
        enrichedData.screen = 'ApplicationStatus';
      } else if (notif.type === 'job_completed') {
        enrichedData.screen = 'Wallet';
      }

      return { ...notif, data: enrichedData };
    });

    // Save all to DB -> Model Hook AUTOMATICALLY triggers push notifications!
    const created = await Notification.create(enrichedNotifications);

    return created;

  } catch (error) {
    console.error('❌ createBulkNotifications failed:', error.message);
    return [];
  }
};

// ══════════════════════════════════════════════════════════════
// 🔔 JOB POSTED: Notify matching employees (DB + Email)
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

    // ✅ DB Notifications (Push sent automatically via Model Hook)
    const dbNotifications = matchingEmployees.map(emp => ({
      userId: emp.userId._id,
      type: 'job_match',
      title: `🎯 New Job: ${jobTitle}`,
      message: `A new ${needFor} job matching your skills was posted. Budget: ${currency} ${price}.`,
      data: { jobId, clientId }
    }));

    const created = await createBulkNotifications(dbNotifications); // ✅ FIXED: Removed ghost arguments

    console.log(`   📬 ${created.length} notifications saved & push triggered`);

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
// 📩 NEW APPLICATION: Notify client (DB + Email)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// 📩 NEW APPLICATION: Notify client (DB + Email)
// ══════════════════════════════════════════════════════════════

export const notifyNewApplication = async (job, applicantUser, applicantEmployee) => {
  try {
    // ✅ FIX: Safely extract client ID + info (works if populated OR plain ObjectId)
    const clientUserId = job.userId?._id?.toString() || job.userId?.toString();
    const clientEmail  = job.userId?.email  || '';
    const clientName   = job.userId?.fullname || 'Client';

    if (!clientUserId) {
      console.error('❌ notifyNewApplication: No client userId found on job:', job._id);
      return;
    }

    console.log(`🔔 [App Notify] Client: ${clientName} (${clientUserId})`);

    await Promise.allSettled([
      createNotification(
        clientUserId,   // ✅ SAFE ID now
        'new_application',
        `📩 New Application: ${job.jobTitle}`,
        `${applicantUser.fullname} has applied to your job.`,
        { jobId: job._id, employeeId: applicantEmployee._id }
      ),
      sendNewApplicationToClient(
        clientEmail,            // ✅ SAFE email
        clientName,             // ✅ SAFE name
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
// ✅ APPLICATION ACCEPTED: Notify employee (DB + Email)
// ══════════════════════════════════════════════════════════════

export const notifyApplicationAccepted = async (job, employeeUser, applicationDetails = {}) => {
  try {
    await Promise.allSettled([
      createNotification(
        employeeUser._id,
        'application_accepted',
        `✅ Application Accepted: ${job.jobTitle}`,
        `Your application for "${job.jobTitle}" was accepted!`,
        { jobId: job._id, clientId: job.clientId } // ✅ FIXED: Removed ghost arguments
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
// ❌ APPLICATION REJECTED: Notify employee (DB + Email)
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
        { jobId: job._id, clientId: job.clientId } // ✅ FIXED: Removed ghost arguments
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
// 🎉 JOB COMPLETED: Notify both (DB + Email)
// ══════════════════════════════════════════════════════════════

export const notifyJobCompleted = async (job, clientUser, employeeUser) => {
  try {
    await Promise.allSettled([
      createNotification(
        clientUser._id,
        'job_completed',
        `🎉 Job Completed: ${job.jobTitle}`,
        `Your job "${job.jobTitle}" has been marked as complete.`,
        { jobId: job._id } // ✅ FIXED: Removed ghost arguments
      ),
      createNotification(
        employeeUser._id,
        'job_completed',
        `🎉 Job Completed: ${job.jobTitle}`,
        `The job "${job.jobTitle}" has been marked as complete.`,
        { jobId: job._id } // ✅ FIXED: Removed ghost arguments
      ),
      sendJobCompleted(clientUser.email, clientUser.fullname, job.jobTitle, 'client', job._id),
      sendJobCompleted(employeeUser.email, employeeUser.fullname, job.jobTitle, 'employee', job._id)
    ]);
  } catch (error) {
    console.error('❌ notifyJobCompleted error:', error.message);
  }
};

// ══════════════════════════════════════════════════════════════
// ⏳ JOB CLOSING SOON: Notify employees (DB + Email)
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

    const created = await createBulkNotifications(dbNotifications); // ✅ FIXED: Removed ghost arguments

    console.log(`   📬 ${created.length} notifications saved & push triggered`);

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