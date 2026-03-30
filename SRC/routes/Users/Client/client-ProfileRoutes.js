// routes/Users/Client/client-ProfileRoutes.js

import express from 'express';
import {
  createOrUpdateClientProfile,
  getClientProfile,
  getEmployeeProfileForClient,
  deleteClientProfileImage,
} from '../../../Controller/user/client/ClientProfileController.js';
import {
  uploadClientProfile,  // ✅ Changed from uploadMedia
  handleUploadError,
} from '../../../Middleware/uploadMiddleware.js';
import {
  protect,
  requireClient,
  requireProfileCompleted,
} from '../../../Middleware/authMiddleware.js';

const ClientProfileRoutes = express.Router();

// ═══════════════════════════════════════════════════════════════
// PROTECT ALL ROUTES
// ═══════════════════════════════════════════════════════════════

ClientProfileRoutes.use(protect);
ClientProfileRoutes.use(requireClient);

// ═══════════════════════════════════════════════════════════════
// SPECIFIC ROUTES (MUST BE FIRST!)
// ═══════════════════════════════════════════════════════════════

// Get own profile
ClientProfileRoutes.get('/profile/me', (req, res) => {
  req.params.userId = req.userId;
  return getClientProfile(req, res);
});

// Update own profile (with optional images)
ClientProfileRoutes.put(
  '/profile',
  uploadClientProfile,  // ✅ Changed from uploadMedia
  handleUploadError,
  createOrUpdateClientProfile
);

// Delete own profile image
ClientProfileRoutes.delete('/profile/image', deleteClientProfileImage);

// ═══════════════════════════════════════════════════════════════
// GENERIC ROUTES (MUST BE LAST!)
// ═══════════════════════════════════════════════════════════════

// View any client profile by userId
ClientProfileRoutes.get('/profile/:userId',requireProfileCompleted, getClientProfile);

// View any employee profile by userId (cross-reference)
ClientProfileRoutes.get('/employee/:userId',requireProfileCompleted, getEmployeeProfileForClient);

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export default ClientProfileRoutes;