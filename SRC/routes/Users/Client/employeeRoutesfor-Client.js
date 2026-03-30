// Routes/Client/ClientEmployeeRoutes.js

import express from 'express';
import { protect, requireClient, requireProfileCompleted } from '../../../Middleware/authMiddleware.js';
import {
  getAllEmployees,
  getRecommendedEmployees,
  searchEmployeesBySkills,
  getEmployeeProfile,
  
  
} from '../../../Controller/user/client/ClientEmployee.Controller.js';

export const ClientEmployeeRouter = express.Router();

// GET /employees/all
// ?page=1&limit=10&sortBy=ratings.average&order=desc
// ?availability=available&minRate=500&maxRate=5000&currency=INR
// ?isVerified=true&search=react developer
ClientEmployeeRouter.get('/all',         protect, requireClient,requireProfileCompleted, getAllEmployees);

// GET /employees/recommended
// Reads client's hiringPreferences + lookingSkillsFor automatically
// ?page=1&limit=10
ClientEmployeeRouter.get('/recommended', protect, requireClient, requireProfileCompleted, getRecommendedEmployees);

// GET /employees/search
// ?skills=React,Node.js&matchType=any
// ?skills=Python&availability=available&isVerified=true
// ?skills=UI/UX&minRate=200&maxRate=2000&currency=INR
ClientEmployeeRouter.get('/search',      protect, requireClient,requireProfileCompleted, searchEmployeesBySkills);

// GET /employees/profile/:userId
ClientEmployeeRouter.get('/Employee-profile/:employeeId', protect, requireClient,requireProfileCompleted, getEmployeeProfile);



export default ClientEmployeeRouter;