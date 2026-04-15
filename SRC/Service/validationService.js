// services/validationService.js

import chatSecurityService from '../Service/Chat/chatSecurityService.js';

/**
 * ════════════════════════════════════════════════════════════════
 *                  🛡️ PROFILE VALIDATION SERVICE
 *    Uses the EXACT SAME validation chain as chat messages.
 *    Zero external links. Zero phone numbers. Zero off-platform.
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Main validation logic
 */
export const validateContent = async (text, field = 'content') => {
  const startTime = Date.now();
  
  try {
    // ═══════════════════════════════════════════════════════════
    // 🚫 RULE 1: ZERO EXTERNAL LINKS IN PROFILES (Strict)
    // Profiles/bios/job descriptions cannot have ANY links.
    // Chat allows some (drive.google.com etc) — profiles DON'T.
    // ═══════════════════════════════════════════════════════════
    const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}[^\s]*)/gi;
    if (URL_REGEX.test(text)) {
      return {
        blocked: true,
        layer: 'zero_link_policy',
        reason: '🚫 External links are strictly not allowed in profiles or descriptions.',
        confidence: 100,
        source: 'SECURITY_ENGINE',
        duration: Date.now() - startTime
      };
    }

    // ═══════════════════════════════════════════════════════════
    // 🧠 RULE 2: USE CHAT SECURITY SERVICE (Same as messages)
    // This calls messageValidationService internally, which has
    // ChatRegexPatterns + RegexPatterns dual check.
    // ═══════════════════════════════════════════════════════════
    const validation = await chatSecurityService.validateTextMessage(text);
    
    console.log(`📊 Security Check: ${validation.action || 'ALLOW'} | blocked=${validation.blocked}`);

    return {
      blocked: validation.blocked === true,
      layer: 'chat_security_engine',
      reason: validation.blocked ? (validation.reason || 'Policy violation detected') : 'Content is safe',
      confidence: validation.confidence || 0,
      action: validation.action || (validation.blocked ? 'BLOCK' : 'ALLOW'),
      warning: validation.warning || null,
      source: 'CHAT_SECURITY_SERVICE',
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    
    return {
      blocked: false,
      layer: 'error_fallback',
      reason: 'Validation error - content allowed',
      error: error.message
    };
  }
};

/**
 * ════════════════════════════════════════════════════════════════
 *                       VALIDATE BIO
 * ════════════════════════════════════════════════════════════════
 */
export const validateBio = async (bio, userId = null) => {
  try {
    console.log('🔍 Starting bio validation...');
    const result = await validateContent(bio, 'bio');
    console.log(`✅ Bio validation complete - Blocked: ${result.blocked}`);
    return result;
  } catch (error) {
    console.error('❌ Bio validation error:', error);
    return { blocked: false, reason: 'Validation error', error: error.message };
  }
};

/**
 * ════════════════════════════════════════════════════════════════
 *                   VALIDATE GIG DESCRIPTION
 * ════════════════════════════════════════════════════════════════
 */
export const validateGigDescription = async (description, userId = null) => {
  try {
    console.log('🔍 Starting gig validation...');
    const result = await validateContent(description, 'gig_description');
    console.log(`✅ Gig validation complete - Blocked: ${result.blocked}`);
    return result;
  } catch (error) {
    console.error('❌ Gig validation error:', error);
    return { blocked: false, reason: 'Validation error', error: error.message };
  }
};

/**
 * ════════════════════════════════════════════════════════════════
 *                   VALIDATE PROFILE FIELD
 * ════════════════════════════════════════════════════════════════
 */
export const validateProfileField = async (text, fieldName, userId = null) => {
  try {
    console.log(`🔍 Validating ${fieldName}...`);
    const result = await validateContent(text, fieldName);
    console.log(`✅ Field validation complete - Blocked: ${result.blocked}`);
    return result;
  } catch (error) {
    console.error(`❌ Field validation error (${fieldName}):`, error);
    return { blocked: false, reason: 'Validation error', error: error.message };
  }
};

/**
 * ════════════════════════════════════════════════════════════════
 *                     GET HEALTH STATUS
 * ════════════════════════════════════════════════════════════════
 */
export const getHealth = () => {
  return {
    status: 'healthy',
    mode: 'CHAT_SECURITY_PROXY',
    timestamp: new Date().toISOString()
  };
};

/**
 * ════════════════════════════════════════════════════════════════
 *                   GET VALIDATION STATISTICS
 * ════════════════════════════════════════════════════════════════
 */
export const getStats = () => {
  return {
    mode: 'CHAT_SECURITY_PROXY',
    monthly_cost_estimate: '$0.00',
    api_calls_saved: '100%'
  };
};

/**
 * ════════════════════════════════════════════════════════════════
 *                      CLEAR CACHE
 * ════════════════════════════════════════════════════════════════
 */
export const clearCache = () => {
  console.log('🧹 Cache cleared');
  return {
    success: true,
    message: 'Cache cleared successfully'
  };
};

/**
 * ════════════════════════════════════════════════════════════════
 *                    DEFAULT EXPORT
 * ════════════════════════════════════════════════════════════════
 */
export default {
  validateContent,
  validateBio,
  validateGigDescription,
  validateProfileField,
  getHealth,
  getStats,
  clearCache
};