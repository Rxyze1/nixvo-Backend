// Routes/Certificate/CertificateRoute.js

import express  from 'express';
import Employee from '../../Models/USER-Auth/Employee-Model.js';


import {
  protect,
  requireEmployee,
  requireAdmin,
} from '../../Middleware/authMiddleware.js';

import {
  getQuestions,
applyCertificate,
  verifyCertificatePayment,
  publicVerify,
  myCertificates,
  getCertificate,
  revokeCertificate,
  adminGetAll,
  reissueCertificate,
} from '../../Controller/Certificate/CertificateController.js';

const Certificaterouter = express.Router();

// ═══════════════════════════════════════════════════════════════
// INLINE MIDDLEWARE
// Attaches Employee doc to req.employee
// Controller uses req.employee.name, .bio, .skills, .yearsExperience
// ═══════════════════════════════════════════════════════════════

const attachEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ userId: req.user._id }).lean();
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Employee profile not found. Only employees can apply for certificates.',
      });
    }
    req.employee = employee;
    next();
  } catch (e) {
    console.error('attachEmployee error:', e.message);
    return res.status(500).json({ success: false, message: 'Failed to load employee profile' });
  }
};

// ═══════════════════════════════════════════════════════════════
// PUBLIC — no auth
// ═══════════════════════════════════════════════════════════════

// GET /api/certificates/questions?skill=Video Editing&tier=pro
Certificaterouter.get('/questions', getQuestions);

// GET /api/certificates/verify/NIXVO-PRO-2026-XXXXXXXX
Certificaterouter.get('/verify/:certificateId', publicVerify);

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATED — employee users
// ═══════════════════════════════════════════════════════════════

// GET /api/certificates/my?status=issued&page=1&limit=10
Certificaterouter.get('/my', protect, myCertificates);




// ✅ ADD:
Certificaterouter.post('/apply', protect, requireEmployee, attachEmployee, applyCertificate);


// POST /api/certificates/payment/verify
Certificaterouter.post('/payment/verify', protect, verifyCertificatePayment);

// ═══════════════════════════════════════════════════════════════
// ADMIN  ⚠️ Must stay ABOVE /:certificateId wildcard
// ═══════════════════════════════════════════════════════════════

// GET /api/certificates/admin/all
Certificaterouter.get('/admin/all', protect, requireAdmin, adminGetAll);

// PATCH /api/certificates/:certificateId/revoke
Certificaterouter.patch('/:certificateId/revoke', protect, requireAdmin, revokeCertificate);

// POST /api/certificates/:certificateId/reissue
Certificaterouter.post('/:certificateId/reissue', protect, requireAdmin, reissueCertificate);

// ═══════════════════════════════════════════════════════════════
// OWNER — wildcard LAST
// ═══════════════════════════════════════════════════════════════

// GET /api/certificates/:certificateId
Certificaterouter.get('/:certificateId', protect, getCertificate);

export default Certificaterouter;