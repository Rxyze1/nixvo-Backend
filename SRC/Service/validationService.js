// services/validationService.js

import RegexPatterns from '../Utils/RegexPatterns.js';
import aiValidationService from './moderation/aiValidationService.js';
import cache from '../Utils/cache.js';
import rateLimiter from '../Utils/rateLimiter.js';

/**
 * ════════════════════════════════════════════════════════════════
 *                  🎯 SMART VALIDATION SERVICE
 *           Regex-first approach with AI fallback + caching
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Calculate Groq score from AI result
 */
const calculateGroqScore = (groqResult) => {
  if (!groqResult) return 0;
  
  const scores = {
    BLOCK: 100,
    WARN: 50,
    ALLOW: 0
  };
  
  return scores[groqResult.action] || 0;
};

/**
 * Main validation logic - Used by all validation functions
 */
export const validateContent = async (text, field = 'content') => {
  const startTime = Date.now();
  
  // Check cache first
  const cached = cache.get(text);
  if (cached) {
    console.log('✅ Cache hit');
    return {
      ...cached,
      cached: true,
      duration: Date.now() - startTime
    };
  }
  
  try {
    // ═══════════════════════════════════════════════════════════
    // LAYER 1: REGEX CHECK (FREE, INSTANT)
    // ═══════════════════════════════════════════════════════════
    const regexResult = RegexPatterns.checkAll(text);
    const regexScore = regexResult.confidence || 0;
    
    console.log(`📊 Regex score: ${regexScore}`);
    
    // Instant block on high regex score
    if (regexScore >= 75) {
      const result = {
        blocked: true,
        layer: 'regex',
        reason: regexResult.reasons?.[0] || 'Pattern matched',
        confidence: regexScore,
        regexScore,
        groqScore: 0,
        finalScore: regexScore,
        matched: regexResult.matched || [],
        source: 'REGEX',
        saved_api_call: true,
        cached: false,
        duration: Date.now() - startTime
      };
      
      cache.set(text, result);
      return result;
    }
    
    // ═══════════════════════════════════════════════════════════
    // LAYER 2: GROQ AI CHECK (FREE, with rate limiting)
    // ═══════════════════════════════════════════════════════════
    let groqScore = 0;
    let groqResult = null;
    let groqUsed = false;
    
    if (rateLimiter.canMakeRequest()) {
      try {
        console.log('🤖 Checking with Groq AI...');
        groqResult = await aiValidationService.validateContent(text, field);
        rateLimiter.recordRequest();
        groqScore = calculateGroqScore(groqResult);
        groqUsed = true;
        console.log(`📊 Groq score: ${groqScore}`);
      } catch (error) {
        console.log(`⚠️ Groq API error: ${error.message}`);
      }
    } else {
      console.log('⏱️ Groq rate limit reached');
      
      // Stricter when rate limited
      if (regexScore >= 50) {
        const result = {
          blocked: true,
          layer: 'regex_strict',
          reason: 'Rate limit reached, strict filtering applied',
          confidence: regexScore,
          regexScore,
          groqScore: 0,
          finalScore: regexScore,
          groqRateLimited: true,
          source: 'REGEX',
          saved_api_call: true,
          cached: false,
          duration: Date.now() - startTime
        };
        
        cache.set(text, result);
        return result;
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // CALCULATE FINAL SCORE
    // ═══════════════════════════════════════════════════════════
    const weights = groqUsed 
      ? { regex: 0.50, groq: 0.50 }
      : { regex: 1.0, groq: 0 };
    
    const finalScore = 
      (regexScore * weights.regex) +
      (groqScore * weights.groq);
    
    // Make decision
    const blocked = finalScore >= 15;
    
    const result = {
      blocked,
      layer: groqUsed ? 'regex+groq' : 'regex_only',
      reason: blocked 
        ? (regexResult.reasons?.[0] || groqResult?.reason || 'Inappropriate content')
        : 'Content is safe',
      confidence: Math.round(finalScore),
      regexScore,
      groqScore,
      finalScore: Math.round(finalScore),
      groqUsed,
      matched: regexResult.matched || [],
      source: groqUsed ? 'AI' : 'REGEX',
      saved_api_call: !groqUsed,
      cached: false,
      duration: Date.now() - startTime
    };
    
    cache.set(text, result);
    return result;
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    
    // Fallback to regex-only
    const regexResult = RegexPatterns.checkAll(text);
    const regexScore = regexResult.confidence || 0;
    
    return {
      blocked: regexScore >= 50,
      layer: 'regex_fallback',
      reason: 'Error occurred, using fallback validation',
      confidence: regexScore,
      regexScore,
      groqScore: 0,
      finalScore: regexScore,
      source: 'REGEX_FALLBACK',
      error: true,
      cached: false,
      duration: Date.now() - startTime
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
    
    // Use main validation logic
    const result = await validateContent(bio, 'bio');
    
    console.log(`✅ Bio validation complete - Source: ${result.source}`);
    return result;

  } catch (error) {
    console.error('❌ Bio validation error:', error);
    
    // Fallback
    const regexResult = RegexPatterns.checkAll(bio);
    return {
      blocked: (regexResult.confidence || 0) >= 50,
      source: 'REGEX_FALLBACK',
      confidence: regexResult.confidence || 0,
      reason: regexResult.reasons?.[0] || 'Validation failed',
      error: error.message
    };
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
    
    // Use main validation logic
    const result = await validateContent(description, 'gig_description');
    
    console.log(`✅ Gig validation complete - Source: ${result.source}`);
    return result;

  } catch (error) {
    console.error('❌ Gig validation error:', error);
    
    // Fallback
    const regexResult = RegexPatterns.checkAll(description);
    return {
      blocked: (regexResult.confidence || 0) >= 50,
      source: 'REGEX_FALLBACK',
      confidence: regexResult.confidence || 0,
      reason: regexResult.reasons?.[0] || 'Validation failed',
      error: error.message
    };
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
    
    // Use main validation logic
    const result = await validateContent(text, fieldName);
    
    console.log(`✅ Field validation complete - Source: ${result.source}`);
    return result;

  } catch (error) {
    console.error(`❌ Field validation error (${fieldName}):`, error);
    
    // Fallback
    const regexResult = RegexPatterns.checkAll(text);
    return {
      blocked: (regexResult.confidence || 0) >= 50,
      source: 'REGEX_FALLBACK',
      confidence: regexResult.confidence || 0,
      reason: regexResult.reasons?.[0] || 'Validation failed',
      error: error.message
    };
  }
};

/**
 * ════════════════════════════════════════════════════════════════
 *                     GET HEALTH STATUS
 * ════════════════════════════════════════════════════════════════
 */
export const getHealth = () => {
  const cacheStats = cache.getStats();
  const groqStatus = rateLimiter.getStatus();
  const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0;
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache: {
      keys: cacheStats.keys,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate: `${(hitRate * 100).toFixed(1)}%`
    },
    groq: {
      requestsLastMinute: groqStatus.requestsLastMinute,
      maxPerMinute: groqStatus.maxPerMinute,
      available: groqStatus.available,
      status: groqStatus.available ? '🟢 Available' : '🔴 Rate Limited'
    }
  };
};

/**
 * ════════════════════════════════════════════════════════════════
 *                   GET VALIDATION STATISTICS
 * ════════════════════════════════════════════════════════════════
 */
export const getStats = () => {
  const cacheStats = cache.getStats();
  const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0;
  
  return {
    cache_size: cacheStats.keys,
    cache_hits: cacheStats.hits,
    cache_misses: cacheStats.misses,
    cache_hit_rate: hitRate,
    estimated_savings: `${(hitRate * 100).toFixed(1)}% of API calls saved`,
    monthly_cost_estimate: calculateMonthlyCost(cacheStats)
  };
};

/**
 * Calculate estimated monthly cost
 */
const calculateMonthlyCost = (cacheStats) => {
  const totalRequests = cacheStats.hits + cacheStats.misses;
  const apiCallsMade = cacheStats.misses;
  const costPerCall = 0.0002; // $0.0002 per Groq call
  const estimatedMonthlyCalls = apiCallsMade * 30; // Rough estimate
  const monthlyCost = estimatedMonthlyCalls * costPerCall;
  
  return {
    apiCallsMade,
    estimatedMonthlyCalls,
    costPerMonth: `$${monthlyCost.toFixed(2)}`,
    freeTierRemaining: Math.max(0, 14400 - apiCallsMade) // Groq free tier limit
  };
};

/**
 * ════════════════════════════════════════════════════════════════
 *                      CLEAR CACHE (ADMIN)
 * ════════════════════════════════════════════════════════════════
 */
export const clearCache = () => {
  const cleared = cache.clear();
  console.log('🧹 Cache cleared');
  return {
    success: true,
    message: 'Cache cleared successfully',
    itemsCleared: cleared
  };
};

/**
 * ════════════════════════════════════════════════════════════════
 *                    DEFAULT EXPORT (FOR IMPORTS)
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