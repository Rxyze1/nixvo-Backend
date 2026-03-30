// Routes/employeeRoutes.js

import express from 'express';
import {
  getAllJobs,
  getJobById,
  applyToJob,
} from '../../../Controller/user/employee/employeeJob.Controller.js';
import { protect, requireEmployee , requireProfileCompleted} from '../../../Middleware/authMiddleware.js';
import { uploadJobApplication, handleUploadError } from '../../../Middleware/uploadMiddleware.js';

export const GetAllJobAndApplyForEmployee = express.Router();

// GET /api/employee/jobs
GetAllJobAndApplyForEmployee.get(
  '/jobs',
  protect,
  requireEmployee,
  requireProfileCompleted,
  getAllJobs
);

// GET /api/employee/jobs/:jobId        ← THIS WAS MISSING
GetAllJobAndApplyForEmployee.get(
  '/jobs/:jobId',
  protect,
  requireEmployee,
  requireProfileCompleted,
  getJobById
);

// POST /api/employee/jobs/:jobId/apply
GetAllJobAndApplyForEmployee.post(
  '/jobs/:jobId/apply',
  protect,
  requireEmployee,
  requireProfileCompleted,
  uploadJobApplication,
  applyToJob,
  handleUploadError
);

export default GetAllJobAndApplyForEmployee;