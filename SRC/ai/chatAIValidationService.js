// Services/Chat/chatAIValidationService.js

import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

/**
 * ════════════════════════════════════════════════════════════════
 *         🤖 CHAT AI VALIDATION SERVICE - GROQ POWERED
 *     Specialized for chat messages with cloud storage support
 * ════════════════════════════════════════════════════════════════
 */

class ChatAIValidationService {
  constructor() {
    // Initialize Groq client
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || 'your-groq-api-key'
    });
    
    this.model = 'llama-3.3-70b-versatile';
    
    // ✅ Cache for chat validations
    this.cache = new Map();
    this.cacheMaxSize = 500;
    this.cacheTTL = 3600000; // 1 hour
    
    // ✅ Statistics
    this.stats = {
      totalValidations: 0,
      blocked: 0,
      allowed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0
    };
    
    console.log('✅ Chat AI Validation Service initialized');
    console.log('   Model: Llama 3.3 70B Versatile');
    console.log('   Mode: CHAT-OPTIMIZED (Cloud Links Allowed)');
  }

  /**
   * ✅ Validate chat message content
   * @param {string} text - Message text
   * @param {object} context - Additional context (links, etc.)
   * @returns {Promise<object>} - Validation result
   */
  async validateChatMessage(text, context = {}) {
    const startTime = Date.now();
    this.stats.totalValidations++;
    
    // ═══════════════════════════════════════════════════════════
    // CHECK CACHE
    // ═══════════════════════════════════════════════════════════
    const cacheKey = this._generateCacheKey(text);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.stats.cacheHits++;
      console.log('⚡ CACHE HIT - Instant result');
      
      return {
        ...cached.result,
        cached: true,
        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) + 's'
      };
    }
    
    this.stats.cacheMisses++;
    
    try {
      console.log('\n🤖 [Chat AI] Validating message...');
      console.log('   📝 Text length:', text.length);
      console.log('   🔗 Has cloud links:', context.hasCloudLinks || false);
      console.log('   🚫 Has blocked links:', context.hasBlockedLinks || false);
      
      // ═══════════════════════════════════════════════════════════
      // INSTANT DECISIONS (No AI needed)
      // ═══════════════════════════════════════════════════════════
      
      // If already has blocked links, don't waste AI call
      if (context.hasBlockedLinks) {
        console.log('   ⚡ INSTANT BLOCK - Blocked links already detected');
        
        const result = {
          action: 'BLOCK',
          reason: 'Contains prohibited social media or messaging app links',
          confidence: 100,
          violations: ['BLOCKED_LINKS'],
          layer: 'pre-check',
          duration: Date.now() - startTime
        };
        
        this._cacheResult(cacheKey, result);
        this._updateStats('blocked', startTime);
        
        return result;
      }
      
      // If ONLY has cloud links and nothing else suspicious, allow
      if (context.hasOnlyCloudLinks && text.length < 200) {
        console.log('   ⚡ INSTANT ALLOW - Only cloud links detected');
        
        const result = {
          action: 'ALLOW',
          reason: 'Cloud storage links are allowed',
          confidence: 95,
          violations: [],
          layer: 'pre-check',
          duration: Date.now() - startTime
        };
        
        this._cacheResult(cacheKey, result);
        this._updateStats('allowed', startTime);
        
        return result;
      }
      
      // ═══════════════════════════════════════════════════════════
      // BUILD CHAT-SPECIFIC PROMPTS
      // ═══════════════════════════════════════════════════════════
      const systemPrompt = this._buildChatSystemPrompt();
      const userPrompt = this._buildChatUserPrompt(text, context);
      
      // ═══════════════════════════════════════════════════════════
      // CALL GROQ API
      // ═══════════════════════════════════════════════════════════
      console.log('   📡 Calling Groq API...');
      
      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: this.model,
        temperature: 0.0,
        max_tokens: 400,
        top_p: 0.9,
        response_format: { type: 'json_object' }
      });

      const aiResponse = completion.choices[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error('Empty AI response');
      }

      const aiResult = JSON.parse(aiResponse);
      const duration = Date.now() - startTime;
      
      console.log('   🤖 AI Decision:', aiResult.decision);
      console.log('   📊 Confidence:', aiResult.confidence + '%');
      console.log('   ⏱️  Duration:', duration + 'ms');
      
       // ═══════════════════════════════════════════════════════════
      // OVERRIDE LOGIC: Allow UPI handles even if AI blocks ← ADD HERE
      // ═══════════════════════════════════════════════════════════
      if (context.hasUpiHandle && aiResult.decision === 'BLOCK') {
        const violationTypes = aiResult.violations || [];
        
        const onlyPaymentViolations = violationTypes.every(v =>
          v.includes('PAYMENT') ||
          v.includes('CONTACT') ||
          v.includes('SOCIAL_MEDIA') ||
          v === 'OFF_PLATFORM_REDIRECT'
        );
        
        if (onlyPaymentViolations) {
          console.log('   ✅ OVERRIDE: AI blocked payment, but it is UPI handle — ALLOWING');
          
          const result = {
            action: 'ALLOW',
            reason: 'UPI payment handle allowed (AI override)',
            confidence: 90,
            violations: [],
            originalDecision: aiResult.decision,
            layer: 'upi-override',
            duration
          };
          
          this._cacheResult(cacheKey, result);
          this._updateStats('allowed', startTime);
          return result;
        }
      }

      
      // ═══════════════════════════════════════════════════════════
      // RETURN AI DECISION
      // ═══════════════════════════════════════════════════════════
      const result = {
        action: aiResult.decision,
        reason: aiResult.reasoning || aiResult.reason,
        confidence: aiResult.confidence || 50,
        violations: aiResult.violations || [],
        matches: aiResult.matches || [],
        layer: 'ai',
        duration
      };
      
      this._cacheResult(cacheKey, result);
      this._updateStats(aiResult.decision === 'BLOCK' ? 'blocked' : 'allowed', startTime);
      
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('   ❌ AI Validation Error:', error.message);
      
      // ═══════════════════════════════════════════════════════════
      // FAILSAFE: If has cloud links, ALLOW. Otherwise, BLOCK.
      // ═══════════════════════════════════════════════════════════
      if (context.hasCloudLinks) {
        console.log('   ⚠️  AI FAILED - Has cloud links - ALLOWING');
        
        const result = {
          action: 'ALLOW',
          reason: 'AI validation failed, but cloud links detected - allowing with warning',
          confidence: 60,
          violations: [],
          layer: 'error-fallback',
          error: error.message,
          duration
        };
        
        this._updateStats('allowed', startTime);
        return result;
      } else {
        console.log('   ⚠️  AI FAILED - No cloud links - BLOCKING for safety');
        
        const result = {
          action: 'BLOCK',
          reason: 'AI validation failed - blocking as safety precaution',
          confidence: 75,
          violations: ['AI_ERROR'],
          layer: 'error-fallback',
          error: error.message,
          duration
        };
        
        this._updateStats('blocked', startTime);
        return result;
      }
    }
  }

  /**
   * ✅ Build chat-specific system prompt
   * @returns {string}
   */
  _buildChatSystemPrompt() {
    return `You are a content moderation AI for a FREELANCING PLATFORM's chat system.

Your job is to protect users while allowing legitimate business communication.

════════════════════════════════════════════════════════════════════════════════
✅ ALLOW - Business Communication (THESE ARE OK):
════════════════════════════════════════════════════════════════════════════════

✅ Cloud Storage Links:
   - Google Drive, Dropbox, OneDrive, WeTransfer, Mega, Box, etc.
   - "Here are the files: https://drive.google.com/..."
   - "Portfolio: https://dropbox.com/..."

✅ Professional Conversation:
   - Project discussions
   - File sharing via cloud storage
   - Portfolio sharing
   - Work-related questions
   - Price negotiations
   - Delivery timelines

✅ Platform Mentions (as skills):
   - "I create content for YouTube"
   - "I manage Instagram accounts"
   - "I design for TikTok"


✅ Platform Payments (ALLOWED - India UPI & Standard):
   
   UPI Apps (ALLOW these by name):
   - GPay / Google Pay / "pay on gpay"
   - PhonePe / "phonepe karo" / "phonepe pe bhejo"
   - Paytm / "paytm karo" / "paytm pe bhejo"
   - BHIM / BHIM UPI
   - Amazon Pay
   - Cred / Cred Pay
   - Mobikwik
   - Freecharge
   - Airtel Payments Bank
   - BHIM SBI Pay / SBI Pay
   - iMobile Pay (ICICI)
   
   UPI Links & IDs (ALLOW):
   - rzp.io links (Razorpay payment links)
   - upi:// deep links
   - UPI IDs: name@paytm, name@okaxis, name@ybl, name@ibl,
              name@okhdfcbank, name@okicici, name@apl,
              name@waicici, name@wahdfcbank, name@axl
   
   Indian Payment Jargons (ALLOW):
   - "UPI bhejo" / "UPI karo" / "UPI pe do"
   - "paisa bhejo" / "payment bhejo" / "paise transfer karo"
   - "link bhejo payment ka" / "payment link share karo"
   - "QR bhejo" / "QR code share karo" / "scan karo"
   - "NEFT" / "IMPS" / "bank transfer" (discussion only)
   - "advance do" / "advance bhejo"
   - "baki payment" / "remaining payment"
   - "half pehle" / "50% upfront"
   - "milestone payment" / "milestone pe dunga"


════════════════════════════════════════════════════════════════════════════════
❌ BLOCK - Off-Platform Redirects (THESE ARE NOT OK):
════════════════════════════════════════════════════════════════════════════════

❌ Contact Information:
   - Phone numbers: +1-234-567-8900, 9876543210
   - Emails (non-mainstream): user@customdomain.com
   - Personal addresses

❌ Social Media/Messaging Redirects:
   - "Message me on WhatsApp"
   - "Add me on Telegram"
   - "DM on Instagram"
   - "Contact me on Discord"
   - Links to: WhatsApp, Telegram, Discord, Signal, etc.

❌ Off-Platform Meeting:
   - "Let's talk outside platform"
   - "Contact me directly"
   - "DM me privately"

════════════════════════════════════════════════════════════════════════════════
🎯 KEY RULES:
════════════════════════════════════════════════════════════════════════════════

1. ✅ Cloud storage links = ALLOW (they're for file sharing)
2. ❌ Social media/messaging links = BLOCK (they redirect off-platform)
3. ✅ Casual typos/spelling = OK (natural conversation)
4. ❌ Contact info = BLOCK (phone, email, payment)
5. ⚠️  When unsure = ALLOW (favor communication)

════════════════════════════════════════════════════════════════════════════════
📊 JSON RESPONSE FORMAT:
════════════════════════════════════════════════════════════════════════════════

{
  "decision": "ALLOW" or "BLOCK",
  "confidence": 0-100,
  "reasoning": "Clear explanation",
  "violations": ["VIOLATION_TYPE", ...],
  "matches": ["exact text matched", ...]
}

REMEMBER: This is a FREELANCING CHAT. Allow business communication. Block off-platform redirects.`;
  }

  /**
   * ✅ Build chat-specific user prompt
   * @param {string} text
   * @param {object} context
   * @returns {string}
   */
  _buildChatUserPrompt(text, context) {
    let prompt = `Analyze this FREELANCING CHAT message:

MESSAGE:
"${text}"

CONTEXT:
- Has cloud storage links: ${context.hasCloudLinks ? 'YES' : 'NO'}
- Has unknown links: ${context.hasUnknownLinks ? 'YES' : 'NO'}
- Message length: ${text.length} characters

YOUR TASK:
1. Check for contact information (phone, email, payment details) → BLOCK
2. Check for social media/messaging redirects → BLOCK
3. Check for off-platform meeting requests → BLOCK
4. Ignore cloud storage links → They are ALLOWED for file sharing
5. Allow professional business communication

IMPORTANT:
- Cloud storage links (Google Drive, Dropbox, etc.) are ALLOWED
- Casual spelling/typos are OK in chat
- Focus on blocking OFF-PLATFORM REDIRECTS, not file sharing`;

    if (context.hasCloudLinks) {
      prompt += `

⚠️  NOTE: This message contains CLOUD STORAGE LINKS (Google Drive, Dropbox, etc.)
These are ALLOWED for file sharing. Only block if there are OTHER violations.`;
    }

    prompt += `

Respond with JSON only.`;

    return prompt;
  }

  /**
   * ✅ Generate cache key
   * @param {string} text
   * @returns {string}
   */
  _generateCacheKey(text) {
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
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * ✅ Update statistics
   * @param {string} decision - 'blocked' or 'allowed'
   * @param {number} startTime
   */
  _updateStats(decision, startTime) {
    const duration = Date.now() - startTime;
    
    if (decision === 'blocked') {
      this.stats.blocked++;
    } else {
      this.stats.allowed++;
    }
    
    // Update average response time
    const count = this.stats.totalValidations;
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (count - 1) + duration) / count;
  }

  /**
   * ✅ Get statistics
   * @returns {object}
   */
  getStats() {
    const total = this.stats.totalValidations;
    const cacheTotal = this.stats.cacheHits + this.stats.cacheMisses;
    
    return {
      totalValidations: total,
      blocked: this.stats.blocked,
      allowed: this.stats.allowed,
      blockRate: total > 0 ? ((this.stats.blocked / total) * 100).toFixed(2) + '%' : '0%',
      avgResponseTime: Math.round(this.stats.avgResponseTime) + 'ms',
      cacheHitRate: cacheTotal > 0 ? ((this.stats.cacheHits / cacheTotal) * 100).toFixed(2) + '%' : '0%',
      cacheSize: this.cache.size,
      model: this.model
    };
  }

  /**
   * ✅ Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Chat AI validation cache cleared');
  }

  /**
   * ✅ Health check
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
        mode: 'Chat-Optimized',
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
export default new ChatAIValidationService();