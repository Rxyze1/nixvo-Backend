import express from 'express';
import { protect, requireEmployee, requireClient } from '../../../Middleware/authMiddleware.js';
import {
  getRecommendedJobsForEmployee,

  getRecommendedEmployeesForJob,

} from '../../../Controller/Notification.Controller/recommendation-Notification/recommendationController.js';

export const RecomendationNotificationRouter = express.Router();

// All routes require authentication
RecomendationNotificationRouter.use(protect);

// 👷 EMPLOYEE: Get recommended jobs
RecomendationNotificationRouter.get('/jobs', requireEmployee, getRecommendedJobsForEmployee);
// RecomendationNotificationRouter.get('/jobs/detailed', requireEmployee, getRecommendedJobsWithDetails); no need For THis

// 👔 CLIENT: Get recommended employees for a job
RecomendationNotificationRouter.get('/employees/:jobId', requireClient, getRecommendedEmployeesForJob);

// RecomendationNotificationRouter.get('/employees/:jobId/detailed', requireClient, getRecommendedEmployeesWithDetails);  No need for This

export default RecomendationNotificationRouter;