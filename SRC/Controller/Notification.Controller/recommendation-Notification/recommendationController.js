// Controllers/Notification/recommendationController.js

import mongoose from 'mongoose';
import {
  getRecommendedJobs,
  getRecommendedEmployees
} from '../../../Service/Notification/NotificationService.js';
import Employee from '../../../Models/USER-Auth/Employee-Model.js';
import Client from '../../../Models/USER-Auth/Client-Model.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *        🎯 RECOMMENDATION CONTROLLER
 * ═══════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
// ✅ HELPER: buildBadge (EXACT copy from ClientEmployee.Controller.js)
// ══════════════════════════════════════════════════════════════

const buildBadge = (emp) => {
  const isPremium = emp?.blueVerified?.status ?? false;
  
  return {
    badge: emp?.hasBadge ? {
      show: true,
      type: emp.badgeType,
      label: emp.badgeLabel,
      icon: emp.badgeType === 'blue-verified' ? 'verified' : emp.badgeType === 'admin-verified' ? 'shield-check' : 'badge',
      color: emp.badgeType === 'blue-verified' ? '#0066FF' : emp.badgeType === 'admin-verified' ? '#00B37E' : '#888',
      bg: emp.badgeType === 'blue-verified' ? '#EBF5FF' : emp.badgeType === 'admin-verified' ? '#E6FAF5' : '#f0f0f0',
    } : { show: false },
    blueVerified: isPremium 
      ? { 
          status: true, 
          icon: 'verified', 
          color: '#0066FF', 
          bg: '#EBF5FF', 
          label: 'Premium Member' 
        } 
      : { status: false },
    adminVerified: { status: emp?.adminVerified?.status ?? false },
    tier: isPremium ? 'premium' : emp?.adminVerified?.status ? 'verified' : 'free',
  };
};

// ══════════════════════════════════════════════════════════════
// 1️⃣ GET RECOMMENDED JOBS FOR EMPLOYEE
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// 1️⃣ GET RECOMMENDED JOBS FOR EMPLOYEE (FIXED)
// ══════════════════════════════════════════════════════════════

export const getRecommendedJobsForEmployee = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

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

    let jobs = await getRecommendedJobs(employee._id, Number(limit));

    if (!jobs || jobs.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        jobs: [],
        message: 'No matching jobs found'
      });
    }

    // ── Get Client IDs (FIXED: handle both Object and String) ─────
    const clientUserIds = [
      ...new Set(
        jobs
          .filter(job => job.userId)
          .map(job => {
            // ✅ FIX: Handle both cases
            if (typeof job.userId === 'string') {
              return job.userId;
            } else if (job.userId?._id) {
              return job.userId._id.toString();
            } else if (job.userId?.toString && job.userId.toString() !== '[object Object]') {
              return job.userId.toString();
            }
            return null;
          })
          .filter(Boolean)
      )
    ];

    console.log('📋 Client User IDs:', clientUserIds);

    // Fetch clients with badge fields
    const clients = await Client.find({ 
      userId: { $in: clientUserIds.map(id => id.toString()) }  // ✅ Ensure all are strings
    })
      .select('userId isPremium hasBadge badgeType badgeLabel blueVerified adminVerified profilePic company_name')
      .lean();

    const clientMap = {};
    clients.forEach(doc => {
      clientMap[doc.userId.toString()] = doc;
    });

    // Enrich jobs with badge info
    const enrichedJobs = jobs.map(job => {
      // ✅ FIX: Safe extraction of userId
      let clientUserId = null;
      
      if (typeof job.userId === 'string') {
        clientUserId = job.userId;
      } else if (job.userId?._id) {
        clientUserId = job.userId._id.toString();
      }

      const clientDoc = clientMap[clientUserId];

      if (!clientDoc) {
        return {
          ...job,
          isPremium: false,
          blueVerified: { status: false },
          tier: 'free',
          badge: { show: false, type: 'none', label: null, blueVerified: { status: false }, adminVerified: { status: false }, tier: 'free' }
        };
      }

      const isPremium = clientDoc.isPremium ?? false;
      
      const badgeData = {
        badge: clientDoc.hasBadge ? {
          show: true,
          type: clientDoc.badgeType || 'admin-verified',
          label: clientDoc.badgeLabel || 'Verified',
          icon: clientDoc.badgeType === 'blue-verified' ? 'verified' : 'shield-check',
          color: clientDoc.badgeType === 'blue-verified' ? '#0066FF' : '#00B37E',
          bg: clientDoc.badgeType === 'blue-verified' ? '#EBF5FF' : '#E6FAF5',
        } : { show: false },
        
        blueVerified: isPremium 
          ? { status: true, icon: 'verified', color: '#0066FF', bg: '#EBF5FF', label: 'Premium Member' }
          : { status: false },
        
        adminVerified: { status: clientDoc.adminVerified?.status ?? false },
        tier: isPremium ? 'premium' : (clientDoc.adminVerified?.status ? 'verified' : 'free'),
      };

      return {
        ...job,
        isPremium: isPremium,
        ...badgeData,
        
        senderDetails: {
          id: clientUserId,
          fullname: job.clientName || job.companyName || null,
          profilePicture: clientDoc.profilePic || null,
          userType: 'client',
          badge: badgeData.badge,
        }
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedJobs.length,
      jobs: enrichedJobs
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
// 2️⃣ GET RECOMMENDED EMPLOYEES FOR JOB
// ══════════════════════════════════════════════════════════════

export const getRecommendedEmployeesForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 10 } = req.query;

    if (req.user.userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can access recommended employees'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Job ID format'
      });
    }

    let employees = await getRecommendedEmployees(jobId, Number(limit));

    if (!employees || employees.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        employees: [],
        message: 'No matching employees found'
      });
    }

    // ── Enrich employees with buildBadge (SAME as reference controller)
    
    const enrichedEmployees = employees.map(emp => {
      return {
        ...emp,
        
        // ✅ Use buildBadge - EXACT same as ClientEmployee.Controller.js
        ...buildBadge(emp),
        
        // Also add senderDetails like Notification schema
        senderDetails: {
          id: emp.userId?._id || emp.userId,
          fullname: emp.fullname || null,
          username: emp.username || null,
          profilePicture: emp.profilePic || emp.profilePicture || null,
          userType: 'employee',
          
          // Badge inside senderDetails matches Notification schema
          badge: buildBadge(emp).badge,
        }
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedEmployees.length,
      employees: enrichedEmployees
    });

  } catch (error) {
    console.error('❌ getRecommendedEmployeesForJob error:', error.message);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid Job ID format'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recommended employees'
    });
  }
};

// ══════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════

export default {
  getRecommendedJobsForEmployee,
  getRecommendedEmployeesForJob
};