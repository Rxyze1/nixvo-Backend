import express from 'express'
import { getClientPublicProfile } from '../../../Controller/user/employee/employeeClient.Controller.js';
import { protect, requireEmployee ,requireProfileCompleted} from '../../../Middleware/authMiddleware.js';

export const employeeClientRouter = express.Router();

employeeClientRouter.get('/:clientId',protect,requireEmployee,requireProfileCompleted, getClientPublicProfile)