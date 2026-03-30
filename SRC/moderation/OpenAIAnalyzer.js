// src/services/moderation/OpenAIAnalyzer.js

import OpenAI from 'openai';

/**
 * ═══════════════════════════════════════════════════════════════════
 *                    🤖 OPENAI AI ANALYZER
 * ═══════════════════════════════════════════════════════════════════
 * Uses OpenAI Moderation API + GPT-4o-mini for context analysis
 */

class OpenAIAnalyzer {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.chatModel = 'gpt-4o-mini';
    this.moderationModel = 'omni-moderation-latest';
  }

  // ═══════════════════════════════════════════════════════════════
  // DUAL ANALYSIS: Moderation API + Context Analysis
  // ═══════════════════════════════════════════════════════════════
  async analyze(bio, rulesResult) {
    const startTime = Date.now();

    try {
      // STEP 1: Run OpenAI Moderation API first (fast & cheap)
      const moderation = await this.moderateContent(bio);
      
      // STEP 2: If moderation flags issues, run detailed analysis
      if (moderation.flagged || rulesResult.riskScore > 30) {
        const contextAnalysis = await this.analyzeContext(bio, rulesResult, moderation);
        return {
          ...contextAnalysis,
          moderation,
          scanTime: Date.now() - startTime
        };
      }

      // STEP 3: Clean content - return early
      return {
        classification: 'LEGITIMATE',
        confidence: 95,
        isSpam: false,
        reasoning: 'No violations detected by OpenAI Moderation API',
        moderation,
        scanTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('OpenAI analysis failed:', error);
      
      return {
        classification: 'UNKNOWN',
        confidence: 0,
        isSpam: rulesResult.riskScore >= 60,
        reasoning: 'AI analysis failed, using rules decision',
        error: error.message,
        scanTime: Date.now() - startTime
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // OPENAI MODERATION API (Fast content screening)
  // ═══════════════════════════════════════════════════════════════
  async moderateContent(bio) {
    try {
      const response = await this.openai.moderations.create({
        model: this.moderationModel,
        input: bio
      });

      const result = response.results[0];
      
      return {
        flagged: result.flagged,
        categories: result.categories,
        categoryScores: result.category_scores,
        relevantFlags: this.getRelevantFlags(result)
      };

    } catch (error) {
      console.error('Moderation API error:', error.message);
      return {
        flagged: false,
        error: error.message
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EXTRACT RELEVANT FLAGS FOR DATING APP
  // ═══════════════════════════════════════════════════════════════
  getRelevantFlags(result) {
    const relevant = [];
    
    // Check categories relevant to dating app spam
    const watchCategories = {
      'harassment': 0.5,
      'sexual': 0.7,
      'violence': 0.5,
      'self-harm': 0.5,
      'illicit': 0.5
    };

    for (const [category, threshold] of Object.entries(watchCategories)) {
      if (result.category_scores[category] > threshold) {
        relevant.push({
          category,
          score: result.category_scores[category],
          flagged: result.categories[category]
        });
      }
    }

    return relevant;
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTEXT ANALYSIS WITH GPT-4O-MINI
  // ═══════════════════════════════════════════════════════════════
  async analyzeContext(bio, rulesResult, moderation) {
    const prompt = this.buildPrompt(bio, rulesResult, moderation);
    
    const response = await this.openai.chat.completions.create({
      model: this.chatModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: this.getSystemPrompt()
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      ...result,
      tokensUsed: response.usage.total_tokens,
      cost: this.calculateCost(response.usage)
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM PROMPT (Instructions for AI)
  // ═══════════════════════════════════════════════════════════════
  getSystemPrompt() {
    return `You are an expert content moderator for a dating app. Analyze bios for:

**SPAM INDICATORS:**
1. Off-platform redirects (Telegram, WhatsApp, Instagram, Snapchat)
2. Selling products/services (OnlyFans, premium content, MLM)
3. Business promotions, advertisements
4. Requests for money or gifts

**LEGITIMATE CONTENT:**
1. Hobbies, interests, personality traits
2. Career/job mentions (without promotion)
3. Music, travel, food preferences
4. Looking for genuine connections

**CRITICAL RULES:**
- Be lenient with legitimate users
- Only flag CLEAR spam attempts
- Consider context and intent
- Don't hallucinate violations that don't exist
- Professional descriptions (video editor, etc.) are LEGITIMATE unless promoting services

**OUTPUT (JSON only):**
{
  "classification": "SPAM" | "SUSPICIOUS" | "LEGITIMATE",
  "confidence": 0-100,
  "isSpam": true/false,
  "reasoning": "specific explanation with exact quotes",
  "recommendation": "BLOCK" | "FLAG" | "ALLOW"
}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD PROMPT WITH CONTEXT
  // ═══════════════════════════════════════════════════════════════
  buildPrompt(bio, rulesResult, moderation) {
    let prompt = `**BIO TO ANALYZE:**
"${bio}"

**RULES SCANNER:**
- Risk Score: ${rulesResult.riskScore}/100
- Violations: ${rulesResult.violations.length}`;

    if (moderation.relevantFlags.length > 0) {
      prompt += `\n\n**MODERATION FLAGS:**
${moderation.relevantFlags.map(f => 
  `- ${f.category}: ${(f.score * 100).toFixed(1)}%`
).join('\n')}`;
    }

    if (rulesResult.violations.length > 0) {
      prompt += `\n\n**DETECTED VIOLATIONS:**
${rulesResult.violations.map(v => 
  `- ${v.type}: "${v.matched || v.pattern}"`
).join('\n')}`;
    }

    prompt += `\n\n**YOUR TASK:**
Carefully analyze this bio. Quote the EXACT text if you find violations. Make your final decision.`;

    return prompt;
  }

  // ═══════════════════════════════════════════════════════════════
  // CALCULATE API COST
  // ═══════════════════════════════════════════════════════════════
  calculateCost(usage) {
    const inputCost = (usage.prompt_tokens / 1000000) * 0.150;
    const outputCost = (usage.completion_tokens / 1000000) * 0.600;
    return {
      total: inputCost + outputCost,
      formatted: `$${(inputCost + outputCost).toFixed(6)}`
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // BULK PATTERN ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  async analyzePatterns(spamExamples) {
    const response = await this.openai.chat.completions.create({
      model: this.chatModel,
      messages: [{
        role: "system",
        content: "Analyze these spam bios and find common patterns for rule creation."
      }, {
        role: "user",
        content: JSON.stringify(spamExamples)
      }]
    });

    return response.choices[0].message.content;
  }
}

export default OpenAIAnalyzer;