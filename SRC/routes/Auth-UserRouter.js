import express from 'express'
import { forgotPassword, login, logout, resendOTP, signup, verifyResetOTP, verifySignupOTP } from '../Controller/user/User-Auth.Controller.js';
import { protect } from '../Middleware/authMiddleware.js';
import getProfileCompleted from '../Middleware/authMiddleware.js';

const AuthRouter = express.Router();

AuthRouter.post('/signup',signup)
AuthRouter.post('/login',login)
AuthRouter.post('/verify-signup-otp',verifySignupOTP)
AuthRouter.post('/resend-otp',resendOTP)
AuthRouter.post('/logout',protect,logout)
AuthRouter.post('/forget-pass',forgotPassword)
AuthRouter.post('/reset-Pass',verifyResetOTP)

// ✅ NEW — session restore endpoint
AuthRouter.get('/me', protect, async (req, res) => {
  const profileCompleted = await getProfileCompleted(req.user._id, req.user.userType);
  return res.status(200).json({
    success: true,
    data: {
      user: {
        ...req.user.toObject(),
        profileCompleted,
      },
    },
  });
});

export default AuthRouter