// Routes/Employee/portfolioRoutes.js

import express from 'express';
import { protect, requireEmployee, requireProfileCompleted } from '../../../Middleware/authMiddleware.js';
import { uploadPortfolio, handleUploadError } from '../../../Middleware/uploadMiddleware.js';
import {
  createPortfolio,
  getMyPortfolios,
  getPortfolioById,
  updatePortfolio
} from '../../../Controller/user/employee/portfolio.Controller.js';

export const PortfolioRouter = express.Router();

// ═══════════════════════════════════════════════════════════════
// 🔒 PROTECTED ROUTES (EMPLOYEE ONLY)
// ═══════════════════════════════════════════════════════════════

// Create Portfolio (Images + Videos)
PortfolioRouter.post('/create', protect, requireEmployee, requireProfileCompleted,uploadPortfolio, handleUploadError, createPortfolio);

// Get My Portfolios
PortfolioRouter.get('/my-portfolios', protect, requireEmployee,requireProfileCompleted, getMyPortfolios);

// Get Single Portfolio by ID
PortfolioRouter.get('/:portfolioId', protect, requireEmployee,requireProfileCompleted, getPortfolioById);

// Update Portfolio (Text + Add/Remove Images/Videos)
PortfolioRouter.put('/update', protect, requireEmployee,requireProfileCompleted, uploadPortfolio, handleUploadError, updatePortfolio);

export default PortfolioRouter;