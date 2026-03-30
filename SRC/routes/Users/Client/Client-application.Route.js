// Routes/Client/ClientApplicationRoute.js

import express from 'express';
import {
  getAllApplicants,
  acceptApplication,
  rejectApplication
} from '../../../Controller/user/client/applicationController.js';
import { protect, requireClient,requireProfileCompleted } from '../../../Middleware/authMiddleware.js';

const ClientJobAplicationRouter = express.Router();

// ════════════════════════════════════════════════════════════════════════════
// 🔒 ALL ROUTES PROTECTED - CLIENT ONLY
// ════════════════════════════════════════════════════════════════════════════

ClientJobAplicationRouter.use(protect, requireClient,requireProfileCompleted);

// ════════════════════════════════════════════════════════════════════════════
// 📋 GET ALL APPLICANTS (AUTOMATIC)
// ════════════════════════════════════════════════════════════════════════════

ClientJobAplicationRouter.get('/all-applicants', getAllApplicants);

// ════════════════════════════════════════════════════════════════════════════
// ✅ ACCEPT APPLICATION
// ════════════════════════════════════════════════════════════════════════════

ClientJobAplicationRouter.post('/:applicationId/accept', acceptApplication);

// ════════════════════════════════════════════════════════════════════════════
// 🚫 REJECT APPLICATION
// ════════════════════════════════════════════════════════════════════════════

ClientJobAplicationRouter.post('/:applicationId/reject', rejectApplication);

export default ClientJobAplicationRouter;