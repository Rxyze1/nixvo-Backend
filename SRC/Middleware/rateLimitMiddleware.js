// middleware/rateLimitMiddleware.js
import rateLimit from 'express-rate-limit';

/**
 * ════════════════════════════════════════════════════════════════
 *                    🛡️ HYBRID RATE LIMITER
 *   IP-based + Email-based rate limiting
 *   ✅ IPv6 Support Fixed
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Create IP-based rate limiter with IPv6 support
 */
export const rateLimiter = (name, max, windowMs) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message: `Too many ${name} attempts from this IP. Please try again later.`,
            retryAfter: Math.ceil(windowMs / 1000 / 60),
        },
        standardHeaders: true,
        legacyHeaders: false,
        // ✅ FIXED: No custom keyGenerator (uses default with IPv6 support)
        handler: (req, res) => {
            console.log(`⚠️ IP Rate limit exceeded for ${name} from IP: ${req.ip}`);
            res.status(429).json({
                success: false,
                message: `Too many ${name} attempts from this IP. Please try again later.`,
                retryAfter: Math.ceil(windowMs / 1000 / 60),
                limitType: 'IP-based'
            });
        },
    });
};

/**
 * Create Email-based rate limiter
 */
export const emailRateLimiter = (name, max, windowMs) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message: `Too many ${name} attempts for this email. Please try again later.`,
            retryAfter: Math.ceil(windowMs / 1000 / 60),
        },
        standardHeaders: true,
        legacyHeaders: false,
        // ✅ FIXED: Proper keyGenerator for email
        keyGenerator: (req) => {
            const email = req.body.email || req.query.email || 'unknown';
            return `email:${email.toLowerCase()}`;
        },
        skip: (req) => {
            // Skip if no email in request
            return !req.body.email && !req.query.email;
        },
        handler: (req, res) => {
            const email = req.body.email || req.query.email;
            console.log(`⚠️ Email Rate limit exceeded for ${name} from email: ${email}`);
            res.status(429).json({
                success: false,
                message: `Too many ${name} attempts for this email. Please try again later.`,
                retryAfter: Math.ceil(windowMs / 1000 / 60),
                limitType: 'Email-based'
            });
        },
    });
};

/**
 * Create Hybrid rate limiter (IP + Email)
 */
export const hybridRateLimiter = (name, maxPerIP, maxPerEmail, windowMs) => {
    const ipLimiter = rateLimiter(name, maxPerIP, windowMs);
    const emailLimiter = emailRateLimiter(name, maxPerEmail, windowMs);
    
    // Return array of middleware
    return [ipLimiter, emailLimiter];
};

// ═══════════════════ PRE-CONFIGURED LIMITERS ═══════════════════

/**
 * Signup limiter: 10 per IP + 3 per email per 15 min
 */
export const signupLimiter = hybridRateLimiter('signup', 10, 3, 15 * 60 * 1000);

/**
 * OTP limiter: 15 per IP + 3 per email per 15 min
 */
export const otpLimiter = hybridRateLimiter('OTP', 15, 3, 15 * 60 * 1000);

/**
 * Login limiter: 20 per IP + 5 per email per 15 min
 */
export const loginLimiter = hybridRateLimiter('login', 20, 5, 15 * 60 * 1000);

/**
 * General auth limiter: 20 per IP per 15 min
 */
export const authLimiter = rateLimiter('auth', 20, 15 * 60 * 1000);

export default {
    rateLimiter,
    emailRateLimiter,
    hybridRateLimiter,
    signupLimiter,
    otpLimiter,
    loginLimiter,
    authLimiter,
};