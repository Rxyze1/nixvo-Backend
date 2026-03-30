// routes/Users/Employee/employee-ProfileRoutes.js

import express from 'express';
import {
  createOrUpdateEmployeeProfile,
  getEmployeeProfile,
} from '../../../Controller/user/employee/EmployeeProfileController.js';
import {
  uploadEmployeeProfile,
  handleUploadError,
} from '../../../Middleware/uploadMiddleware.js';
import {
  protect,
  requireEmployee,
  requireProfileCompleted,
} from '../../../Middleware/authMiddleware.js';

const EmployeeProfileRoutes = express.Router();

// ═══════════════════════════════════════════════════════════════
// PROTECT ALL ROUTES
// ═══════════════════════════════════════════════════════════════

EmployeeProfileRoutes.use(protect);

// ═══════════════════════════════════════════════════════════════
// EMPLOYEE-ONLY ROUTES
// ═══════════════════════════════════════════════════════════════


// Update own profile (with optional images)
EmployeeProfileRoutes.put(
  '/profile',
  requireEmployee,
  uploadEmployeeProfile,
  handleUploadError,
  createOrUpdateEmployeeProfile
);


// Get own profile
EmployeeProfileRoutes.get('/profile/me',requireEmployee, (req, res) => {
  req.params.userId = req.userId;
  return getEmployeeProfile(req, res);
});


// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES (Anyone can view employee profiles)               
// ═══════════════════════════════════════════════════════════════

// // View any employee profile by userId
EmployeeProfileRoutes.get('/profile/:userId', requireProfileCompleted, getEmployeeProfile);

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export default EmployeeProfileRoutes;