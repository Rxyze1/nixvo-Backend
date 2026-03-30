// controllers/adminControllers/employeeManagementController.js

import mongoose from 'mongoose';
import User from '../../../../Models/USER-Auth/User-Auth.-Model.js';
import AdminLog from '../../Models/AdminLogModel.js';
import Official from '../../../../Models/USER-Auth/Official-Model.js';
import {
  sendEmployeeApproval,
  sendEmployeeRejection,
} from '../../../../Email/emailService.js';
import {
  successResponse,
  errorResponse,
} from '../../../../Config/responseUtils.js';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════

const sanitizeEmail = (email) => email.toLowerCase().trim();
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
};

const logger = {
  info: (msg, data) =>
    console.log(`\n✅ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  warn: (msg, data) =>
    console.warn(`\n⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg, data) =>
    console.error(`\n❌ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
};

// ─── Private helpers ──────────────────────────────────────────

const logAdminActivity = async (adminId, action, targetType, targetId, details = {}) => {
  try {
    await AdminLog.create({
      adminId,
      action,
      targetType,
      targetId,
      details,
      timestamp: new Date(),
    });

    await Official.findOneAndUpdate(
      { userId: adminId },
      {
        $push: {
          activityLog: {
            $each: [
              {
                action,
                targetUserId: targetId,
                reason: details.reason || '',
                timestamp: new Date(),
              },
            ],
            $slice: -100,
          },
        },
        $set: { 'audit.lastActivityAt': new Date() },
      }
    );
  } catch (err) {
    logger.error('Failed to log activity', err.message);
  }
};

const updateOfficialStats = async (adminId, statField) => {
  try {
    await Official.findOneAndUpdate(
      { userId: adminId },
      { $inc: { [`adminStats.${statField}`]: 1 } }
    );
  } catch (err) {
    logger.error('Failed to update stats', err.message);
  }
};

// ══════════════════════════════════════════════════════════════
// GET PENDING EMPLOYEES
// ══════════════════════════════════════════════════════════════

export const getPendingEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const cappedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const query = {
      userType: 'employee',
      status: 'pending',
    };

    if (search && typeof search === 'string' && search.trim()) {
      const safe = escapeRegex(search.trim());
      query.$or = [
        { fullname: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { username: { $regex: safe, $options: 'i' } },
      ];
    }

    const [totalCount, pendingEmployees] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('fullname username email phone createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * cappedLimit)
        .limit(cappedLimit)
        .lean(),
    ]);

    logger.info('📋 PENDING EMPLOYEES FETCHED', {
      count: pendingEmployees.length,
      total: totalCount,
    });

    return successResponse(
      res,
      {
        count: pendingEmployees.length,
        totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / cappedLimit),
        employees: pendingEmployees.map((emp) => ({
          id: emp._id.toString(),
          fullname: emp.fullname,
          username: emp.username,
          email: emp.email,
          phone: emp.phone,
          appliedAt: emp.createdAt,
        })),
      },
      `${totalCount} pending employee(s)`
    );
  } catch (error) {
    logger.error('GET PENDING EMPLOYEES ERROR', error.message);
    return errorResponse(res, 'Failed to retrieve pending employees', 500);
  }
};

// ══════════════════════════════════════════════════════════════
// APPROVE EMPLOYEE
// ══════════════════════════════════════════════════════════════

export const approveEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const adminId = req.user._id;

    // ✅ Validate ObjectId
    if (!validateObjectId(employeeId)) {
      return errorResponse(res, 'Invalid employee ID format', 400);
    }

    const employee = await User.findOne({
      _id: employeeId,
      userType: 'employee',
      status: 'pending',
    });

    if (!employee) {
      return errorResponse(
        res,
        'Pending employee not found or already processed',
        404
      );
    }

    // ✅ Use transaction for safety
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const empInTx = await User.findOne({
          _id: employeeId,
          userType: 'employee',
          status: 'pending',
        }).session(session);

        if (!empInTx) {
          throw new Error('Employee already processed by another admin');
        }

        empInTx.status = 'active';
        empInTx.isAdminVerified = true;
        empInTx.adminVerificationStatus = 'approved';
        empInTx.adminMetadata = {
          ...empInTx.adminMetadata,
          approvedAt: new Date(),
          approvedBy: adminId,
        };
        await empInTx.save({ session });
      });
    } catch (txErr) {
      logger.error('TRANSACTION ERROR IN APPROVE EMPLOYEE', txErr.message);
      if (txErr.message === 'Employee already processed by another admin') {
        return errorResponse(res, 'Employee already processed', 409);
      }
      throw txErr;
    } finally {
      await session.endSession();
    }

    logger.info('✅ EMPLOYEE APPROVED', {
      id: employeeId,
      email: employee.email,
    });

    // ✅ Log admin activity
    await logAdminActivity(adminId, 'APPROVE_EMPLOYEE', 'employee', employeeId, {
      approvedEmail: employee.email,
      approvedName: employee.fullname,
    });

    // ✅ Update admin stats
    await updateOfficialStats(adminId, 'usersVerified');

    // ✅ Send email notification using correct function from emailService
    await sendEmployeeApproval(
      employee.email,
      employee.fullname
    ).catch((err) => {
      logger.warn('Approval email failed', err.message);
    });

    return successResponse(
      res,
      {
        employee: {
          id: employee._id,
          fullname: employee.fullname,
          email: employee.email,
          status: 'active',
          approvedAt: new Date(),
        },
      },
      '✅ Employee approved. They can now login.'
    );
  } catch (error) {
    logger.error('APPROVE EMPLOYEE ERROR', error.message);
    return errorResponse(res, 'Failed to approve employee', 500);
  }
};

// ══════════════════════════════════════════════════════════════
// REJECT EMPLOYEE
// ══════════════════════════════════════════════════════════════

export const rejectEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    // ✅ Validate ObjectId
    if (!validateObjectId(employeeId)) {
      return errorResponse(res, 'Invalid employee ID format', 400);
    }

    // ✅ Validate reason
    if (!reason || reason.trim().length < 10) {
      return errorResponse(
        res,
        'Rejection reason of at least 10 characters required',
        400
      );
    }

    const employee = await User.findOne({
      _id: employeeId,
      userType: 'employee',
      status: 'pending',
    });

    if (!employee) {
      return errorResponse(
        res,
        'Pending employee not found or already processed',
        404
      );
    }

    const rejectionReason = reason.trim();

    // ✅ Use transaction for safety
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const empInTx = await User.findOne({
          _id: employeeId,
          userType: 'employee',
          status: 'pending',
        }).session(session);

        if (!empInTx) {
          throw new Error('Employee already processed');
        }

        empInTx.status = 'rejected';
        empInTx.adminVerificationStatus = 'rejected';
        empInTx.adminMetadata = {
          ...empInTx.adminMetadata,
          rejectedAt: new Date(),
          rejectedBy: adminId,
          rejectionReason,
        };
        await empInTx.save({ session });
      });
    } finally {
      await session.endSession();
    }

    logger.info('✅ EMPLOYEE REJECTED', {
      id: employeeId,
      reason: rejectionReason,
    });

    // ✅ Log admin activity
    await logAdminActivity(adminId, 'REJECT_EMPLOYEE', 'employee', employeeId, {
      reason: rejectionReason,
      rejectedEmail: employee.email,
    });

    // ✅ Send email notification using correct function from emailService
    await sendEmployeeRejection(
      employee.email,
      employee.fullname,
      rejectionReason
    ).catch((err) => {
      logger.warn('Rejection email failed', err.message);
    });

    return successResponse(
      res,
      {
        employee: {
          id: employee._id,
          fullname: employee.fullname,
          email: employee.email,
          status: 'rejected',
          rejectionReason,
        },
      },
      '❌ Employee application rejected'
    );
  } catch (error) {
    logger.error('REJECT EMPLOYEE ERROR', error.message);
    return errorResponse(res, 'Failed to reject employee', 500);
  }
};

// ══════════════════════════════════════════════════════════════
// GET EMPLOYEE DETAILS
// ══════════════════════════════════════════════════════════════

export const getEmployeeDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!validateObjectId(employeeId)) {
      return errorResponse(res, 'Invalid employee ID format', 400);
    }

    const employee = await User.findOne({
      _id: employeeId,
      userType: 'employee',
    }).select('-password -passwordResetToken -passwordResetExpires');

    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    return successResponse(
      res,
      {
        employee: {
          id: employee._id,
          fullname: employee.fullname,
          username: employee.username,
          email: employee.email,
          phone: employee.phone,
          status: employee.status,
          isAdminVerified: employee.isAdminVerified,
          adminVerificationStatus: employee.adminVerificationStatus,
          createdAt: employee.createdAt,
          approvedAt: employee.adminMetadata?.approvedAt,
          approvedBy: employee.adminMetadata?.approvedBy,
          rejectionReason: employee.adminMetadata?.rejectionReason,
        },
      },
      'Employee details retrieved'
    );
  } catch (error) {
    logger.error('GET EMPLOYEE DETAILS ERROR', error.message);
    return errorResponse(res, 'Failed to retrieve employee details', 500);
  }
};

// ══════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════

export const getAllEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const cappedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const query = {
      userType: 'employee',
    };

    // Filter by status if provided
    if (status && ['pending', 'active', 'rejected', 'suspended', 'banned'].includes(status)) {
      query.status = status;
    }

    // Search functionality
    if (search && typeof search === 'string' && search.trim()) {
      const safe = escapeRegex(search.trim());
      query.$or = [
        { fullname: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { username: { $regex: safe, $options: 'i' } },
      ];
    }

    const [totalCount, employees] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select(
          'fullname username email phone status isAdminVerified adminVerificationStatus createdAt adminMetadata'
        )
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * cappedLimit)
        .limit(cappedLimit)
        .lean(),
    ]);

    logger.info('📋 ALL EMPLOYEES FETCHED', {
      count: employees.length,
      total: totalCount,
      status: status || 'all',
    });

    return successResponse(
      res,
      {
        count: employees.length,
        totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / cappedLimit),
        employees: employees.map((emp) => ({
          id: emp._id.toString(),
          fullname: emp.fullname,
          username: emp.username,
          email: emp.email,
          phone: emp.phone,
          status: emp.status,
          isAdminVerified: emp.isAdminVerified,
          adminVerificationStatus: emp.adminVerificationStatus,
          createdAt: emp.createdAt,
          approvedAt: emp.adminMetadata?.approvedAt || null,
          approvedBy: emp.adminMetadata?.approvedBy || null,
          rejectionReason: emp.adminMetadata?.rejectionReason || null,
        })),
      },
      `Retrieved ${employees.length} employee(s) out of ${totalCount}`
    );
  } catch (error) {
    logger.error('GET ALL EMPLOYEES ERROR', error.message);
    return errorResponse(res, 'Failed to retrieve employees', 500);
  }
};












// ══════════════════════════════════════════════════════════════
// GET REJECTED EMPLOYEES
// ══════════════════════════════════════════════════════════════

export const getRejectedEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const cappedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const query = {
      userType: 'employee',
      status: 'rejected',
    };

    if (search && typeof search === 'string' && search.trim()) {
      const safe = escapeRegex(search.trim());
      query.$or = [
        { fullname: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { username: { $regex: safe, $options: 'i' } },
      ];
    }

    const [totalCount, rejectedEmployees] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('fullname username email phone createdAt adminMetadata')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * cappedLimit)
        .limit(cappedLimit)
        .lean(),
    ]);

    logger.info('📋 REJECTED EMPLOYEES FETCHED', {
      count: rejectedEmployees.length,
      total: totalCount,
    });

    return successResponse(
      res,
      {
        count: rejectedEmployees.length,
        totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / cappedLimit),
        employees: rejectedEmployees.map((emp) => ({
          id: emp._id.toString(),
          fullname: emp.fullname,
          username: emp.username,
          email: emp.email,
          phone: emp.phone,
          appliedAt: emp.createdAt,
          rejectedAt: emp.adminMetadata?.rejectedAt,
          rejectionReason: emp.adminMetadata?.rejectionReason,
          rejectedBy: emp.adminMetadata?.rejectedBy,
        })),
      },
      `${totalCount} rejected employee(s)`
    );
  } catch (error) {
    logger.error('GET REJECTED EMPLOYEES ERROR', error.message);
    return errorResponse(res, 'Failed to retrieve rejected employees', 500);
  }
};

// ══════════════════════════════════════════════════════════════
// APPROVE REJECTED EMPLOYEE (REINSTATE)
// ══════════════════════════════════════════════════════════════

export const approveRejectedEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { approvalNotes } = req.body;
    const adminId = req.user._id;

    // ✅ Validate ObjectId
    if (!validateObjectId(employeeId)) {
      return errorResponse(res, 'Invalid employee ID format', 400);
    }

    // ✅ Validate approval notes (optional but good to have reason for reinstatement)
    if (!approvalNotes || approvalNotes.trim().length < 5) {
      return errorResponse(
        res,
        'Approval notes of at least 5 characters required',
        400
      );
    }

    const employee = await User.findOne({
      _id: employeeId,
      userType: 'employee',
      status: 'rejected',
    });

    if (!employee) {
      return errorResponse(
        res,
        'Rejected employee not found or already processed',
        404
      );
    }

    const cleanApprovalNotes = approvalNotes.trim();

    // ✅ Use transaction for safety
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const empInTx = await User.findOne({
          _id: employeeId,
          userType: 'employee',
          status: 'rejected',
        }).session(session);

        if (!empInTx) {
          throw new Error('Employee already processed by another admin');
        }

        // ✅ Update to active and clear rejection metadata
        empInTx.status = 'active';
        empInTx.isAdminVerified = true;
        empInTx.adminVerificationStatus = 'approved';
        empInTx.adminMetadata = {
          ...empInTx.adminMetadata,
          approvedAt: new Date(),
          approvedBy: adminId,
          approvalNotes: cleanApprovalNotes,
          reinstatedAt: new Date(),
          reinstatedBy: adminId,
          // Keep rejection history for audit purposes
          previousRejectionReason: empInTx.adminMetadata?.rejectionReason,
          previousRejectedBy: empInTx.adminMetadata?.rejectedBy,
          previousRejectedAt: empInTx.adminMetadata?.rejectedAt,
        };
        await empInTx.save({ session });
      });
    } catch (txErr) {
      logger.error('TRANSACTION ERROR IN APPROVE REJECTED EMPLOYEE', txErr.message);
      if (txErr.message === 'Employee already processed by another admin') {
        return errorResponse(res, 'Employee already processed', 409);
      }
      throw txErr;
    } finally {
      await session.endSession();
    }

    logger.info('✅ REJECTED EMPLOYEE APPROVED', {
      id: employeeId,
      email: employee.email,
      approvalNotes: cleanApprovalNotes,
    });

    // ✅ Log admin activity
    await logAdminActivity(
      adminId,
      'APPROVE_REJECTED_EMPLOYEE',
      'employee',
      employeeId,
      {
        approvalNotes: cleanApprovalNotes,
        approvedEmail: employee.email,
        approvedName: employee.fullname,
        previouslyRejected: true,
      }
    );

    // ✅ Update admin stats
    await updateOfficialStats(adminId, 'usersVerified');

    // ✅ Send email notification - Employee approved after rejection
    await sendEmployeeApproval(
      employee.email,
      employee.fullname
    ).catch((err) => {
      logger.warn('Approval email failed', err.message);
    });

    return successResponse(
      res,
      {
        employee: {
          id: employee._id,
          fullname: employee.fullname,
          email: employee.email,
          status: 'active',
          approvedAt: new Date(),
          approvalNotes: cleanApprovalNotes,
          previousRejectionReason: employee.adminMetadata?.rejectionReason,
        },
      },
      '✅ Rejected employee approved and reinstated. They can now login.'
    );
  } catch (error) {
    logger.error('APPROVE REJECTED EMPLOYEE ERROR', error.message);
    return errorResponse(res, 'Failed to approve rejected employee', 500);
  }
};




export default {
  getPendingEmployees,
  approveEmployee,
  rejectEmployee,
  getEmployeeDetails,
  getAllEmployees,
  approveRejectedEmployee,
  getRejectedEmployees,
};