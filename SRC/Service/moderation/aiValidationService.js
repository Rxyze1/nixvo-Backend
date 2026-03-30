/**
 * ════════════════════════════════════════════════════════════════
 *           🤖 AI VALIDATION SERVICE v2.0 - GROQ POWERED
 *        MAXIMUM SECURITY | ZERO-TOLERANCE | SMART DETECTION
 * ════════════════════════════════════════════════════════════════
 */

import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

class AIValidationService {
  constructor() {
    // Initialize Groq client
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || 'your-groq-api-key'
    });
    
    this.model = 'llama-3.3-70b-versatile';
    
    // ✅ Smart caching for repeated patterns
    this.violationCache = new Map();
    this.cacheMaxSize = 1000;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // ✅ Performance tracking
    this.stats = {
      totalValidations: 0,
      blocked: 0,
      allowed: 0,
      avgResponseTime: 0,
      fastestResponse: Infinity,
      slowestResponse: 0
    };
    
    console.log('✅ AI Validation Service v2.0 initialized');
    console.log('   Model: Llama 3.3 70B Versatile');
    console.log('   Mode: ULTRA-STRICT | ZERO-TOLERANCE');
    console.log('   Cache: Enabled (max 1000 entries)');
  }

  /**
   * ✅ Simple validate method with smart caching
   * @param {string} text - Text to validate
   * @param {string} field - Field name
   * @returns {Promise<object>} - Validation result
   */
  async validateContent(text, field = 'content') {
    const startTime = Date.now();
    this.stats.totalValidations++;
    
    // ✅ Check cache first
    const cacheKey = this._generateCacheKey(text);
    const cached = this.violationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      this.cacheHits++;
      console.log('⚡ CACHE HIT - Instant result');
      
      return {
        ...cached.result,
        cached: true,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) + 's'
      };
    }
    
    this.cacheMisses++;
    
    try {
      console.log('\n🤖 AI VALIDATION v2.0 (Smart Mode)');
      console.log('📝 Text length:', text.length);
      console.log('📋 Field:', field);
      console.log('🎯 Cache: MISS - Running AI check');
      
      // ✅ Pre-scan with enhanced patterns
      const preScanResult = this._intelligentPreScan(text);
      
      if (preScanResult.instantBlock) {
        console.log('⚡ INSTANT BLOCK - Pre-scan detected:', preScanResult.reason);
        
        const result = {
          action: 'BLOCK',
          reason: preScanResult.reason,
          confidence: 100,
          violations: preScanResult.violations,
          matches: preScanResult.matches,
          blocked: true,
          layer: 'pre-scan',
          duration: Date.now() - startTime
        };
        
        this._cacheResult(cacheKey, result);
        this._updateStats(result, startTime);
        
        return result;
      }
      
      // ✅ Build enhanced prompts
      const systemPrompt = this._buildEnhancedSystemPrompt();
      const userPrompt = this._buildEnhancedUserPrompt(text, field, preScanResult);
      
      // Call Groq API
      console.log('📡 Calling Groq API with enhanced context...');
      
      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: this.model,
        temperature: 0.0, // ✅ Zero temperature for consistency
        max_tokens: 600,
        top_p: 0.9,
        response_format: { type: 'json_object' }
      });

      const aiResponse = completion.choices[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error('Empty AI response');
      }

      const aiResult = JSON.parse(aiResponse);
      const duration = Date.now() - startTime;
      
      console.log('🤖 AI Decision:', aiResult.decision);
      console.log('📊 Confidence:', aiResult.confidence + '%');
      console.log('⏱️  Duration:', duration + 'ms');
      
      // ✅ Enhanced result with multiple layers
      const result = {
        action: aiResult.decision,
        reason: aiResult.reasoning,
        confidence: aiResult.confidence,
        violations: aiResult.violations || [],
        matches: aiResult.matches || [],
        blocked: aiResult.decision === 'BLOCK',
        layer: 'ai',
        preScanFlags: preScanResult.flags || [],
        duration
      };
      
      this._cacheResult(cacheKey, result);
      this._updateStats(result, startTime);
      
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('❌ AI Validation Error:', error.message);
      
      // ✅ STRICT FAILSAFE: Block on any error
      const result = {
        action: 'BLOCK',
        reason: 'AI validation failed - BLOCKING as safety precaution',
        confidence: 75,
        violations: ['AI_ERROR', 'SAFETY_BLOCK'],
        matches: [],
        blocked: true,
        layer: 'error',
        error: error.message,
        duration
      };
      
      this._updateStats(result, startTime);
      
      return result;
    }
  }

  /**
   * ✅ Full validation with regex cross-check (for audio)
   * @param {string} text - Text to validate
   * @param {object} regexResults - Regex results
   * @returns {Promise<object>} - Validation result
   */
  async validateWithGroq(text, regexResults = {}) {
    const startTime = Date.now();
    this.stats.totalValidations++;
    
    try {
      console.log('\n🤖 AI VALIDATION v2.0 (Regex Cross-Check Mode)');
      console.log('📝 Text length:', text.length);
      console.log('🔍 Regex violations:', regexResults.violations?.length || 0);
      
      // ✅ If regex already confident, skip AI
      if (regexResults.confidence >= 95) {
        console.log('⚡ REGEX CONFIDENCE HIGH - Instant block');
        
        const result = {
          confidence: 100,
          decision: 'BLOCK',
          violations: regexResults.violations.map(v => v.type),
          reasoning: `Regex detected: ${regexResults.violations.map(v => v.type).join(', ')}`,
          matches: regexResults.violations.map(v => v.matched || v.type),
          blocked: true,
          layer: 'regex-only',
          duration: Date.now() - startTime
        };
        
        this._updateStats(result, startTime);
        return result;
      }
      
      // Build prompts
      const systemPrompt = this._buildEnhancedSystemPrompt();
      const userPrompt = this._buildRegexCrossCheckPrompt(text, regexResults);
      
      // Call Groq API
      console.log('📡 Calling Groq API...');
      
      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: this.model,
        temperature: 0.0,
        max_tokens: 600,
        top_p: 0.9,
        response_format: { type: 'json_object' }
      });

      const aiResponse = completion.choices[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error('Empty AI response');
      }

      const aiResult = JSON.parse(aiResponse);
      const duration = Date.now() - startTime;
      
      console.log('🤖 AI Decision:', aiResult.decision);
      console.log('📊 Confidence:', aiResult.confidence + '%');
      console.log('⏱️  Duration:', duration + 'ms');
      
      // ✅ STRICT CROSS-CHECK: If regex found violations, AI MUST confirm or block anyway
      if (regexResults.violations?.length > 0 && aiResult.decision !== 'BLOCK') {
        console.warn('⚠️  OVERRIDE: Regex found violations - FORCING BLOCK');
        aiResult.confidence = 100;
        aiResult.decision = 'BLOCK';
        aiResult.reasoning = `Regex detected violations (${regexResults.violations.map(v => v.type).join(', ')}) - AI override for safety`;
        aiResult.violations = [...new Set([...(aiResult.violations || []), ...regexResults.violations.map(v => v.type)])];
      }

      const result = {
        confidence: aiResult.confidence || 50,
        decision: aiResult.decision || 'BLOCK',
        violations: aiResult.violations || [],
        reasoning: aiResult.reasoning || 'No reasoning provided',
        matches: aiResult.matches || [],
        blocked: aiResult.decision === 'BLOCK',
        layer: 'ai+regex',
        model: this.model,
        duration
      };
      
      this._updateStats(result, startTime);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('❌ AI Validation Error:', error.message);
      
      // ✅ FAILSAFE: Trust regex if available
      if (regexResults.violations?.length > 0) {
        console.warn('⚠️  AI FAILED - Using regex (BLOCK)');
        
        const result = {
          confidence: 100,
          decision: 'BLOCK',
          violations: regexResults.violations.map(v => v.type),
          reasoning: 'AI failed - regex detected violations',
          matches: [],
          blocked: true,
          layer: 'failsafe-regex',
          duration,
          error: error.message
        };
        
        this._updateStats(result, startTime);
        return result;
      }
      
      // ✅ STRICT: Block if both failed
      console.warn('⚠️  CRITICAL: BOTH SYSTEMS FAILED - BLOCKING');
      
      const result = {
        confidence: 75,
        decision: 'BLOCK',
        violations: ['AI_ERROR', 'SYSTEM_FAILURE'],
        reasoning: 'Both AI and regex failed - BLOCKING as safety precaution',
        matches: [],
        blocked: true,
        layer: 'error',
        duration,
        error: error.message
      };
      
      this._updateStats(result, startTime);
      return result;
    }
  }

/**
 * ✅ SMART PRE-SCAN with MULTILINGUAL DETECTION
 * @param {string} text
 * @returns {object}
 */
_intelligentPreScan(text) {
  const lower = text.toLowerCase();
  const flags = [];
  const matches = [];
  const violations = [];
  
  // ✅ Enhanced URL patterns
  const urlPatterns = [
    /https?:\/\/[^\s]+/gi,
    /www\.[^\s]+\.[a-z]{2,}/gi,
    /[a-z0-9-]+\.(com|net|org|io|co|in|xyz|app|dev|ai|me|tv|cc|biz)[^\s]*/gi,
    /bit\.ly\/[^\s]+/gi,
    /tinyurl\.com\/[^\s]+/gi
  ];
  
  for (const pattern of urlPatterns) {
    const found = text.match(pattern);
    if (found) {
      flags.push('URL_DETECTED');
      matches.push(...found);
      violations.push('URL');
    }
  }
  
  // ✅ Email patterns (enhanced)
  const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const emails = text.match(emailPattern);
  if (emails) {
    flags.push('EMAIL_DETECTED');
    matches.push(...emails);
    violations.push('EMAIL');
  }
  
  // ✅ Phone patterns (global)
  const phonePatterns = [
    /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    /\d{10,}/g,
    /\(\d{3}\)\s?\d{3}-\d{4}/g
  ];
  
  for (const pattern of phonePatterns) {
    const found = text.match(pattern);
    if (found && found.some(m => m.replace(/\D/g, '').length >= 10)) {
      flags.push('PHONE_DETECTED');
      matches.push(...found);
      violations.push('PHONE');
      break;
    }
  }
  
  // ✅ Social media handles
  if (/@[a-z0-9_]{3,}/i.test(text)) {
    flags.push('SOCIAL_HANDLE');
    matches.push(text.match(/@[a-z0-9_]{3,}/gi)?.[0]);
    violations.push('SOCIAL_MEDIA');
  }
  
  // ✅ Messaging app + action (ZERO TOLERANCE)
  const messagingPatterns = [
    /\b(whatsapp|telegram|discord|signal|wechat|line|viber)\b/i,
    /\b(dm|message|contact|chat|reach)\s+(me|us|outside|on|via|in|at)\b/i,
    /\b(talk|discuss|chat)\s+(outside|off|on)\b/i,
    /\b(add me|find me|reach out)\s+(on|at|via)\b/i
  ];
  
  for (const pattern of messagingPatterns) {
    if (pattern.test(lower)) {
      flags.push('MESSAGING_APP_REDIRECT');
      matches.push(text.match(pattern)?.[0]);
      violations.push('OFF_PLATFORM_REDIRECT');
    }
  }
  
  // ✅ MULTILINGUAL OFF-PLATFORM PHRASES
  const multilingualPatterns = {
    // Hindi
    'bahaar baat karte hai': 'OFF_PLATFORM_REDIRECT',
    'bahar baat': 'OFF_PLATFORM_REDIRECT',
    'dm karo': 'OFF_PLATFORM_REDIRECT',
    'whatsapp par baat': 'OFF_PLATFORM_REDIRECT',
    
    // Spanish
    'hablemos afuera': 'OFF_PLATFORM_REDIRECT',
    'contactame fuera': 'OFF_PLATFORM_REDIRECT',
    
    // Portuguese
    'falar fora': 'OFF_PLATFORM_REDIRECT',
    'conversar fora': 'OFF_PLATFORM_REDIRECT',
    
    // French
    'parlons ailleurs': 'OFF_PLATFORM_REDIRECT',
    'contactez moi dehors': 'OFF_PLATFORM_REDIRECT',
    
    // German
    'lass uns draußen reden': 'OFF_PLATFORM_REDIRECT',
    
    // Arabic (transliterated)
    'kalam barra': 'OFF_PLATFORM_REDIRECT',
    
    // Urdu
    'bahir baat karte': 'OFF_PLATFORM_REDIRECT',
    
    // Bengali
    'baire kotha': 'OFF_PLATFORM_REDIRECT',
    
    // General patterns
    'baat karte': 'SUSPICIOUS_PHRASE',
    'dm me': 'OFF_PLATFORM_REDIRECT',
    'contact outside': 'OFF_PLATFORM_REDIRECT'
  };
  
  for (const [phrase, violationType] of Object.entries(multilingualPatterns)) {
    if (lower.includes(phrase)) {
      flags.push('MULTILINGUAL_REDIRECT');
      matches.push(phrase);
      violations.push(violationType);
    }
  }
  
  // ✅ Obfuscation attempts
  const obfuscationPatterns = [
    /\[at\]|\(at\)|\{at\}/gi,
    /\[dot\]|\(dot\)|\{dot\}/gi,
    /\b[a-z]+\s*@\s*[a-z]+\s*\.\s*[a-z]{2,}/gi
  ];
  
  for (const pattern of obfuscationPatterns) {
    if (pattern.test(text)) {
      flags.push('OBFUSCATION_DETECTED');
      matches.push(text.match(pattern)?.[0]);
      violations.push('OBFUSCATION');
    }
  }
  
  // ✅ Decide if instant block
  const instantBlock = violations.length > 0;
  
  return {
    instantBlock,
    flags,
    matches: [...new Set(matches)].filter(Boolean),
    violations: [...new Set(violations)],
    reason: instantBlock 
      ? `Pre-scan detected: ${violations.join(', ')}` 
      : 'Pre-scan clean'
  };
}

  /**
   * ✅ ENHANCED SYSTEM PROMPT (Maximum strictness)
   * @returns {string}
   */
  _buildEnhancedSystemPrompt() {
    return `You are an ULTRA-STRICT content moderation AI with ZERO TOLERANCE for policy violations.

CORE MISSION: Protect users by BLOCKING ALL attempts to share contact info or redirect OFF-PLATFORM.

════════════════════════════════════════════════════════════════════════════════
❌ INSTANT BLOCK (confidence 100%) - NO EXCEPTIONS:
════════════════════════════════════════════════════════════════════════════════

1. CONTACT INFORMATION:
   ❌ Phone numbers (ANY format: +1-234-567-8900, 1234567890, etc)
   ❌ Email addresses (ANY format: user@domain.com, user[at]domain.com)
   ❌ URLs/domains (example.com, www.site.net, bit.ly/xxx)
   ❌ IP addresses

2. SOCIAL MEDIA:
   ❌ Handles: @username, ig_username, TikTok: username
   ❌ Profile links or IDs

3. MESSAGING APPS + ACTION:
   ❌ "talk on WhatsApp" / "chat via Telegram" / "DM on Discord"
   ❌ "message me on [app]" / "reach out via [app]"
   ❌ "add me on [app]" / "find me on [app]"

4. OFF-PLATFORM REQUESTS:
   ❌ "contact outside platform"
   ❌ "DM me" / "message elsewhere"
   ❌ "let's talk privately"
   ❌ "reach out directly"

5. OBFUSCATION ATTEMPTS:
   ❌ email[at]domain[dot]com
   ❌ Spaces in emails/URLs
   ❌ Unicode tricks

════════════════════════════════════════════════════════════════════════════════
✅ ALLOW (confidence 0%) - Professional context ONLY:
════════════════════════════════════════════════════════════════════════════════

✅ "I create content for YouTube and Instagram" (platform names OK)
✅ "Experienced in social media marketing" (skill mention OK)
✅ "I edit videos for content creators" (service description OK)

⚠️ CRITICAL RULES:
✅ Mentioning platforms as SKILLS = OK
❌ Mentioning platforms to REDIRECT = BLOCK
❌ ANY contact info = INSTANT BLOCK
❌ When in doubt = BLOCK

════════════════════════════════════════════════════════════════════════════════
📊 JSON RESPONSE FORMAT:
════════════════════════════════════════════════════════════════════════════════

{
  "confidence": 0-100,
  "decision": "BLOCK" or "ALLOW",
  "violations": ["VIOLATION_TYPE", ...],
  "reasoning": "Clear explanation of decision",
  "matches": ["exact text matched", ...]
}

REMEMBER: YOU ARE THE LAST LINE OF DEFENSE. BLOCK AGGRESSIVELY.`;
  }

  /**
   * ✅ Enhanced user prompt (simple mode)
   * @param {string} text
   * @param {string} field
   * @param {object} preScan
   * @returns {string}
   */
  _buildEnhancedUserPrompt(text, field, preScan) {
    return `Analyze this ${field} with MAXIMUM STRICTNESS:

TEXT:
"${text}"

PRE-SCAN RESULTS:
- Flags: ${preScan.flags.join(', ') || 'None'}
- Violations: ${preScan.violations.join(', ') || 'None'}
- Matches: ${preScan.matches.join(', ') || 'None'}

YOUR MISSION:
1. Verify pre-scan findings
2. Look for hidden patterns
3. Check for obfuscation
4. Detect context manipulation

BLOCK if you find:
- ANY contact info (email, phone, URL)
- ANY social media handles
- ANY redirect attempts ("DM me", "contact outside")
- ANY obfuscation tricks

WHEN IN DOUBT → BLOCK!

Respond with JSON only.`;
  }

  /**
   * ✅ Regex cross-check prompt
   * @param {string} text
   * @param {object} regexResults
   * @returns {string}
   */
  _buildRegexCrossCheckPrompt(text, regexResults) {
    return `CRITICAL ANALYSIS - Regex detected violations!

TEXT:
"${text}"

REGEX FINDINGS:
- Violations: ${regexResults.violations?.length || 0}
- Types: ${regexResults.violations?.map(v => v.type).join(', ') || 'None'}
- Confidence: ${regexResults.confidence || 0}%
- Matched: ${regexResults.violations?.map(v => v.matched || v.type).join(', ') || 'None'}

YOUR TASK:
1. VERIFY regex findings (are they real violations?)
2. Find ADDITIONAL violations regex might have missed
3. Check for FALSE POSITIVES (rare, but possible)

⚠️ IMPORTANT:
- If regex found violations, they are HIGHLY LIKELY real
- You should CONFIRM them unless clearly wrong
- Look for additional violations
- Be ULTRA-STRICT

Respond with JSON only.`;
  }

  /**
   * ✅ Generate cache key
   * @param {string} text
   * @returns {string}
   */
  _generateCacheKey(text) {
    // Simple hash for caching
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * ✅ Cache result
   * @param {string} key
   * @param {object} result
   */
  _cacheResult(key, result) {
    // Limit cache size
    if (this.violationCache.size >= this.cacheMaxSize) {
      const firstKey = this.violationCache.keys().next().value;
      this.violationCache.delete(firstKey);
    }
    
    this.violationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * ✅ Update statistics
   * @param {object} result
   * @param {number} startTime
   */
  _updateStats(result, startTime) {
    const duration = Date.now() - startTime;
    
    if (result.blocked) {
      this.stats.blocked++;
    } else {
      this.stats.allowed++;
    }
    
    // Update timing stats
    this.stats.fastestResponse = Math.min(this.stats.fastestResponse, duration);
    this.stats.slowestResponse = Math.max(this.stats.slowestResponse, duration);
    
    const prevAvg = this.stats.avgResponseTime;
    const count = this.stats.totalValidations;
    this.stats.avgResponseTime = (prevAvg * (count - 1) + duration) / count;
  }

  /**
   * ✅ Get enhanced statistics
   * @returns {object}
   */
  getStats() {
    return {
      totalValidations: this.stats.totalValidations,
      blocked: this.stats.blocked,
      allowed: this.stats.allowed,
      blockRate: ((this.stats.blocked / (this.stats.totalValidations || 1)) * 100).toFixed(2) + '%',
      avgResponseTime: Math.round(this.stats.avgResponseTime) + 'ms',
      fastestResponse: this.stats.fastestResponse === Infinity ? 'N/A' : this.stats.fastestResponse + 'ms',
      slowestResponse: this.stats.slowestResponse + 'ms',
      cacheHitRate: ((this.cacheHits / (this.cacheHits + this.cacheMisses || 1)) * 100).toFixed(2) + '%',
      cacheSize: this.violationCache.size,
      model: this.model
    };
  }

  /**
   * ✅ Clear cache
   */
  clearCache() {
    this.violationCache.clear();
    console.log('🗑️  Cache cleared');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: 'health check' }],
        model: this.model,
        max_tokens: 10
      });
      
      return {
        status: 'healthy',
        model: this.model,
        provider: 'Groq',
        stats: this.getStats()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new AIValidationService();