// config/tokenUtils.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ════════════════════════════════════════════════════════════════
 *                    🔐 TOKEN UTILITY FUNCTIONS
 *   JWT Token Generation, Verification, and Management
 * ════════════════════════════════════════════════════════════════
 */

// ═══════════════════ CONFIGURATION (YOUR ENV VARIABLES) ═══════════════════
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'; // ✅ Changed from 30d to 7d

// Validation
if (!JWT_SECRET || !REFRESH_SECRET) {
    throw new Error('❌ JWT_SECRET and REFRESH_SECRET must be defined in .env');
}

console.log('✅ Token configuration loaded:');
console.log(`  Access Token: ${ACCESS_TOKEN_EXPIRES_IN}`);
console.log(`  Refresh Token: ${REFRESH_TOKEN_EXPIRES_IN}`);

/**
 * ═══════════════════════════════════════════════════════════════
 *                    GENERATE TOKENS
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Generate Access Token (Short-lived)
 */
export const generateAccessToken = (userId, userType, email, role = 'user') => {
    const payload = {
        id: userId,
        userId: userId,  // ✅ Added for compatibility
        userType,
        email,
        role,
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    console.log(`🔑 Access token generated for: ${email} (role: ${role})`);
    return token;
};

/**
 * Generate Refresh Token (Long-lived)
 * ✅ FIXED: Now includes role parameter
 */
export const generateRefreshToken = (userId, userType, email, role = 'user') => {
    const payload = {
        id: userId,
        userId: userId,  // ✅ Added for compatibility
        userType,
        email,
        role,  // ✅ FIXED: Added role
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    console.log(`🔄 Refresh token generated for: ${email} (role: ${role})`);
    return token;
};

/**
 * Generate Both Tokens (Access + Refresh)
 */
export const generateTokenPair = (userId, userType, email, role = 'user') => {
    const accessToken = generateAccessToken(userId, userType, email, role);
    const refreshToken = generateRefreshToken(userId, userType, email, role); // ✅ Fixed: Pass role

    return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    };
};

/**
 * Generate Temporary Token (For special operations)
 */
export const generateTempToken = (userId, email, purpose, expiresIn = '1h') => {
    const payload = {
        id: userId,
        userId: userId,  // ✅ Added for compatibility
        email,
        purpose,
        type: 'temp',
        iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn,
    });

    console.log(`⏱️ Temp token generated for: ${email} (${purpose})`);
    return token;
};

/**
 * Generate Password Reset Token (Random string, not JWT)
 */
export const generatePasswordResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Alternative: Generate Reset Token (Alias)
 */
export const generateResetToken = () => {
    return generatePasswordResetToken();
};

/**
 * ═══════════════════════════════════════════════════════════════
 *                    VERIFY TOKENS
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Verify Access Token
 */
export const verifyAccessToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.type !== 'access') {
            throw new Error('Invalid token type');
        }

        console.log('✅ Access token verified:', decoded.email);

        return {
            valid: true,
            decoded,
            error: null
        };
    } catch (error) {
        console.warn('⚠️  Access token verification failed:', error.message);
        return {
            valid: false,
            decoded: null,
            error: error.message,
        };
    }
};

/**
 * Verify Refresh Token
 */
export const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, REFRESH_SECRET);

        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        console.log('✅ Refresh token verified:', decoded.email);

        return {
            valid: true,
            decoded,
            error: null
        };
    } catch (error) {
        console.warn('⚠️  Refresh token verification failed:', error.message);
        return {
            valid: false,
            decoded: null,
            error: error.message,
        };
    }
};

/**
 * Verify Any Token (Auto-detect type)
 */
export const verifyToken = (token, type = 'access') => {
    try {
        const secret = type === 'refresh' ? REFRESH_SECRET : JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        return {
            valid: true,
            decoded,
            error: null
        };
    } catch (error) {
        return {
            valid: false,
            decoded: null,
            error: error.message,
        };
    }
};

/**
 * Verify Reset Token (Just returns the token if valid format)
 */
export const verifyResetToken = (token) => {
    // Reset tokens are random hex strings, not JWTs
    // Just check if it's a valid hex string
    const isValidHex = /^[a-f0-9]{64}$/i.test(token);

    return {
        valid: isValidHex,
        token: isValidHex ? token : null,
    };
};

/**
 * ═══════════════════════════════════════════════════════════════
 *                    DECODE & INSPECT TOKENS
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Decode Token (Without verification)
 */
export const decodeToken = (token) => {
    try {
        const decoded = jwt.decode(token, { complete: true });
        return {
            success: true,
            header: decoded.header,
            payload: decoded.payload,
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Check if Token is Expired
 */
export const isTokenExpired = (token) => {
    try {
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.exp) {
            return true;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp < currentTime;
    } catch (error) {
        return true;
    }
};

/**
 * Get Token Expiry Time
 */
export const getTokenExpiry = (token) => {
    try {
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.exp) {
            return null;
        }

        return {
            exp: decoded.exp,
            expiresAt: new Date(decoded.exp * 1000),
            timeRemaining: decoded.exp - Math.floor(Date.now() / 1000),
        };
    } catch (error) {
        return null;
    }
};

/**
 * ═══════════════════════════════════════════════════════════════
 *                    EXTRACT TOKEN FROM HEADER
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Extract Bearer Token from Authorization Header
 */
export const extractTokenFromHeader = (authHeader) => {
    if (!authHeader) {
        return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }

    return parts[1];
};

/**
 * ═══════════════════════════════════════════════════════════════
 *                    TOKEN BLACKLIST HELPERS
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Get Token ID (jti - JWT ID)
 */
export const getTokenId = (token) => {
    try {
        const decoded = jwt.decode(token);
        return decoded?.jti || decoded?.id || null;
    } catch (error) {
        return null;
    }
};

/**
 * ═══════════════════════════════════════════════════════════════
 *                    EXPORTS
 * ═══════════════════════════════════════════════════════════════
 */
export default {
    // Generate
    generateAccessToken,
    generateRefreshToken,
    generateTokenPair,
    generateTempToken,
    generatePasswordResetToken,
    generateResetToken,
    
    // Verify
    verifyAccessToken,
    verifyRefreshToken,
    verifyToken,
    verifyResetToken,
    
    // Decode & Inspect
    decodeToken,
    isTokenExpired,
    getTokenExpiry,
    
    // Helpers
    extractTokenFromHeader,
    getTokenId,
};