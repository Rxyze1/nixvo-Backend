// Routes/Client/portfolioRoutes.js

import express from 'express';
import { protect, requireClient,requireProfileCompleted } from '../../../Middleware/authMiddleware.js';
import {
  getAllPortfolios,
  searchPortfoliosBySkillsAndTags,
  getPortfolioById
} from '../../../Controller/user/client/Clientportfolio.Controller.js';

export const ClientPortfolioRouter = express.Router();

// ═══════════════════════════════════════════════════════════════
// 🔒 PROTECTED ROUTES (CLIENT ONLY)
// ═══════════════════════════════════════════════════════════════

// Get all portfolios with filters and pagination
ClientPortfolioRouter.get(
  '/all',
  protect,
  requireClient,
  requireProfileCompleted,
  getAllPortfolios
);

// Search portfolios by skills and tags
ClientPortfolioRouter.get(
  '/search',
  protect,
  requireClient,
  requireProfileCompleted,
  searchPortfoliosBySkillsAndTags
);

// Get single portfolio by ID
ClientPortfolioRouter.get(
  '/:portfolioId',
  protect,
  requireClient,
  requireProfileCompleted,
  getPortfolioById
);

export default ClientPortfolioRouter;