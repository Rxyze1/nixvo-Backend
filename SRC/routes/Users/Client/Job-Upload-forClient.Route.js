// routes/Users/Client/Job-Upload-forClient.Route.js

import express from 'express';
import { protect, requireClient, requireProfileCompleted }            from '../../../Middleware/authMiddleware.js';
import { uploadJobMedia, handleUploadError } from '../../../Middleware/uploadMiddleware.js';
import {
  createJob,
  getMyJobs,
  getMyJobById,
  updateMyJob,
  closeMyJob,
  deleteMyJob,
  markClosingSoon,
  triggerClosingJobsCron,
} from '../../../Controller/user/client/jobController.js';

export const JobUploadForClientRouter = express.Router();

// ═══════════════════════════════════════════════════════════════
// CRON TRIGGER  —  GET /jobs/cron/closing-soon
// ⚠️  Must be ABOVE /:jobId — static routes first
// ═══════════════════════════════════════════════════════════════

JobUploadForClientRouter.get(
  '/cron/closing-soon',
  protect,
  requireClient,        // 🔒 swap for requireAdmin before production
  requireProfileCompleted,
  triggerClosingJobsCron
);

// ═══════════════════════════════════════════════════════════════
// CREATE JOB  —  POST /jobs/create
// ═══════════════════════════════════════════════════════════════

JobUploadForClientRouter.post(
  '/create',
  protect,
  requireClient,
  requireProfileCompleted,
  uploadJobMedia,
  handleUploadError,
  createJob
);

// ═══════════════════════════════════════════════════════════════
// GET ALL MY JOBS  —  GET /jobs/my-jobs
// ═══════════════════════════════════════════════════════════════

JobUploadForClientRouter.get(
  '/my-jobs',
  protect,
  requireClient,
  requireProfileCompleted,
  getMyJobs
);

// ═══════════════════════════════════════════════════════════════
// GET SINGLE JOB  —  GET /jobs/:jobId
// ═══════════════════════════════════════════════════════════════

JobUploadForClientRouter.get(
  '/:jobId',
  protect,
  requireClient,
  requireProfileCompleted,
  getMyJobById
);

// ═══════════════════════════════════════════════════════════════
// MARK CLOSING SOON  —  PATCH /jobs/:jobId/closing-soon
// ⚠️  Must be ABOVE PATCH /:jobId — more specific routes first
// ═══════════════════════════════════════════════════════════════

JobUploadForClientRouter.patch(
  '/:jobId/closing-soon',
  protect,
  requireClient,
  requireProfileCompleted,
  markClosingSoon
);

// ═══════════════════════════════════════════════════════════════
// CLOSE JOB  —  PATCH /jobs/:jobId/close
// ⚠️  Must be ABOVE PATCH /:jobId — more specific routes first
// ═══════════════════════════════════════════════════════════════

JobUploadForClientRouter.patch(
  '/:jobId/close',
  protect,
  requireClient,
  requireProfileCompleted,
  closeMyJob
);

// ═══════════════════════════════════════════════════════════════
// UPDATE JOB  —  PATCH /jobs/:jobId
// ═══════════════════════════════════════════════════════════════

JobUploadForClientRouter.patch(
  '/:jobId',
  protect,
  requireClient,
  requireProfileCompleted,
  uploadJobMedia,
  handleUploadError,
  updateMyJob
);

// ═══════════════════════════════════════════════════════════════
// DELETE JOB  —  DELETE /jobs/:jobId
// ═══════════════════════════════════════════════════════════════

JobUploadForClientRouter.delete(
  '/:jobId',
  protect,
  requireClient,
  requireProfileCompleted,
  deleteMyJob
);

export default JobUploadForClientRouter;