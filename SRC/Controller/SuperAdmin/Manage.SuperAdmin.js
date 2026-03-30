// controllers/SuperAdmin/SuperAdmin.Controller.js

import User from '../../Models/USER-Auth/User-Auth.Model.js';
const { validationResult } = require('express-validator');

// ═══════════════════════════════════════════════════════════════
// APPROVE ADMIN / MODERATOR (Officials)
// ═══════════════════════════════════════════════════════════════

exports.approveOfficial = async (req, res) => {
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { officialId } = req.params;
    const { adminNotes } = req.body;
    const superAdminId = req.user._id; // Current logged-in super admin

    // ✅ Find the official (admin/moderator)
    const official = await User.findById(officialId);
    if (!official) {
      return res.status(404).json({ 
        success: false, 
        message: 'Official not found' 
      });
    }

    // ✅ Verify it's actually an official
    if (official.userType !== 'officials') {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not an official' 
      });
    }

    // ✅ Check if already approved
    if (official.status === 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Official is already approved' 
      });
    }

    // ✅ Update official status
    official.status = 'active';
    official.adminVerificationStatus = 'approved';
    official.isAdminVerified = true;
    official.adminMetadata.approvedAt = new Date();
    official.adminMetadata.approvedBy = superAdminId;
    official.adminMetadata.approvalNotes = adminNotes || '';

    await official.save();

    res.status(200).json({
      success: true,
      message: `${official.role.toUpperCase()} approved successfully`,
      data: {
        id: official._id,
        name: official.name,
        email: official.email,
        role: official.role,
        status: official.status,
        approvedAt: official.adminMetadata.approvedAt,
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error approving official',
      error: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// REJECT ADMIN / MODERATOR (Officials)
// ═══════════════════════════════════════════════════════════════

exports.rejectOfficial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { officialId } = req.params;
    const { rejectionReason } = req.body;
    const superAdminId = req.user._id;

    const official = await User.findById(officialId);
    if (!official) {
      return res.status(404).json({ 
        success: false, 
        message: 'Official not found' 
      });
    }

    if (official.userType !== 'officials') {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not an official' 
      });
    }

    official.status = 'rejected';
    official.adminVerificationStatus = 'rejected';
    official.isAdminVerified = false;
    official.adminMetadata.rejectedAt = new Date();
    official.adminMetadata.rejectedBy = superAdminId;
    official.adminMetadata.rejectionReason = rejectionReason || '';

    await official.save();

    res.status(200).json({
      success: true,
      message: `${official.role} rejected`,
      data: {
        id: official._id,
        name: official.name,
        email: official.email,
        status: official.status,
        rejectionReason: rejectionReason
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error rejecting official',
      error: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// APPROVE EMPLOYEE
// ═══════════════════════════════════════════════════════════════

exports.approveEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { employeeId } = req.params;
    const { adminNotes } = req.body;
    const superAdminId = req.user._id;

    // ✅ Find the employee
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    // ✅ Verify it's actually an employee
    if (employee.userType !== 'employee') {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not an employee' 
      });
    }

    // ✅ Check if already approved
    if (employee.status === 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Employee is already approved' 
      });
    }

    // ✅ Update employee status
    employee.status = 'active';
    employee.adminVerificationStatus = 'approved';
    employee.isAdminVerified = true;
    employee.adminMetadata.approvedAt = new Date();
    employee.adminMetadata.approvedBy = superAdminId;
    employee.adminMetadata.approvalNotes = adminNotes || '';

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Employee approved successfully',
      data: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        userType: employee.userType,
        status: employee.status,
        approvedAt: employee.adminMetadata.approvedAt,
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error approving employee',
      error: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// REJECT EMPLOYEE
// ═══════════════════════════════════════════════════════════════

exports.rejectEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { employeeId } = req.params;
    const { rejectionReason } = req.body;
    const superAdminId = req.user._id;

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    if (employee.userType !== 'employee') {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not an employee' 
      });
    }

    employee.status = 'rejected';
    employee.adminVerificationStatus = 'rejected';
    employee.isAdminVerified = false;
    employee.adminMetadata.rejectedAt = new Date();
    employee.adminMetadata.rejectedBy = superAdminId;
    employee.adminMetadata.rejectionReason = rejectionReason || '';

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Employee rejected',
      data: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        status: employee.status,
        rejectionReason: rejectionReason
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error rejecting employee',
      error: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET PENDING OFFICIALS (Admins/Moderators)
// ═══════════════════════════════════════════════════════════════

exports.getPendingOfficials = async (req, res) => {
  try {
    const pendingOfficials = await User.find({
      userType: 'officials',
      status: 'pending'
    }).select('-password').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pendingOfficials.length,
      data: pendingOfficials
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching pending officials',
      error: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET PENDING EMPLOYEES
// ═══════════════════════════════════════════════════════════════

exports.getPendingEmployees = async (req, res) => {
  try {
    const pendingEmployees = await User.find({
      userType: 'employee',
      status: 'pending'
    }).select('-password').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pendingEmployees.length,
      data: pendingEmployees
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching pending employees',
      error: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET ALL USERS (Approved/Rejected/Pending)
// ═══════════════════════════════════════════════════════════════

exports.getAllUsers = async (req, res) => {
  try {
    const { userType, status, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    if (userType) filter.userType = userType;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    
    const users = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      total,
      count: users.length,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: users
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching users',
      error: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET USER DETAILS
// ═══════════════════════════════════════════════════════════════

// 🔟 GET USER/EMPLOYEE DETAILS — requirePermission('view_all_users')
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ Validate ObjectId format first
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return errorResponse(res, 'Invalid user ID format', 400);
    }

    const user = await User.findById(userId)
      .select('-password')
      .lean();

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Don't expose officials via this endpoint
    if (user.userType === 'officials') {
      return forbiddenResponse(res, 'Cannot fetch official details via this endpoint');
    }

    return successResponse(
      res,
      {
        user: {
          id:              user._id,
          fullname:        user.fullname,
          username:        user.username,
          email:           user.email,
          phone:           user.phone,
          userType:        user.userType,
          status:          user.status,
          isEmailVerified: user.isEmailVerified,
          createdAt:       user.createdAt,
          lastLogin:       user.lastLogin,
          appliedAt:       user.adminMetadata?.appliedAt,
        },
      },
      'User details retrieved'
    );
  } catch (error) {
    logger.error('GET USER DETAILS ERROR', error.message);
    return errorResponse(res, 'Failed to retrieve user details', 500);
  }
};