// Routes/call.routes.js

import express from 'express';
import { protect } from '../../Middleware/authMiddleware.js';
import { protectAdmin } from '../../Controller/Admin/Admin.middlewares/adminAuthMiddleware.js';
import {
  // GET - CALL HISTORY
  getMyCallHistory,
  getSingleCall,
  getCallsWithUser,
  
  // ACTIONS - CALL MANAGEMENT
  initiateCall,
  answerCall,
  rejectCall,
  endCall,
  missCall,
  
  // GET - CALL MESSAGES
  getCallMessage,
  getCallMessages,
  
  // ADMIN - CALL MANAGEMENT
  adminGetAllCalls,
  adminGetUserCalls,
  adminGetCallSummary,
} from '../../Controller/Call-Controller/call.controller.js';

export const CallRouter = express.Router();

// ====================================================================
// ⚠️ AUTHENTICATION MIDDLEWARE - Applied to all routes
// ====================================================================
CallRouter.use(protect);

// ====================================================================
// 📞 USER - CALL ACTIONS (POST / PUT) — SPECIFIC LITERAL PATHS FIRST
// ====================================================================
CallRouter.post('/initiate', initiateCall);

// ====================================================================
// 💬 USER - CALL MESSAGES (GET) — MORE SPECIFIC PATHS
// ====================================================================
// ⚠️ /messages/user/:otherUserId MUST be BEFORE /messages/:callId
CallRouter.get('/messages/user/:otherUserId', getCallMessages);
CallRouter.get('/messages/:callId', getCallMessage);

// ====================================================================
// 📜 USER - CALL HISTORY (GET) — SPECIFIC LITERAL PATHS
// ====================================================================
CallRouter.get('/my', getMyCallHistory);
CallRouter.get('/with/:otherUserId', getCallsWithUser);

// ====================================================================
// 👨‍💼 ADMIN ROUTES — BEFORE WILDCARD :callId
// ====================================================================
// ⚠️ Most specific admin routes FIRST
CallRouter.get('/admin/all', protectAdmin, adminGetAllCalls);
CallRouter.get('/admin/summary', protectAdmin, adminGetCallSummary);
CallRouter.get('/admin/user/:userId', protectAdmin, adminGetUserCalls);

// ====================================================================
// ⚡ WILDCARD - Single Call (MUST BE LAST)
// ====================================================================
CallRouter.put('/:callId/answer', answerCall);
CallRouter.put('/:callId/reject', rejectCall);
CallRouter.put('/:callId/end', endCall);
CallRouter.put('/:callId/miss', missCall);
CallRouter.get('/:callId', getSingleCall);

export default CallRouter;