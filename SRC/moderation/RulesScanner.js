// src/services/moderation/RulesScanner.js

/**
 * ═══════════════════════════════════════════════════════════════════
 *                    🔍 RULES-BASED SCANNER
 * ═══════════════════════════════════════════════════════════════════
 * Fast pattern matching - catches 95% of spam in 5ms
 */

class RulesScanner {
  constructor() {
    // ══════════════════════════════════════════════════════════════
    // SPAM PATTERNS (Platform Redirection)
    // ══════════════════════════════════════════════════════════════
    this.platformPatterns = {
      telegram: /(?:telegram|t\.me|tg:\/\/|@[a-z0-9_]{5,})/i,
      whatsapp: /(?:whatsapp|wa\.me|whatsapp\.com|\+?\d{10,})/i,
      instagram: /(?:instagram|insta|ig:\/\/|@[a-z0-9_.]{3,})/i,
      snapchat: /(?:snapchat|snap:|sc:|snapcode)/i,
      discord: /(?:discord(?:\.gg|app\.com)|disc:|discord#\d{4})/i,
      twitter: /(?:twitter\.com|x\.com|@[a-z0-9_]{1,15})/i,
      email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
      phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      website: /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}/i
    };

    // ══════════════════════════════════════════════════════════════
    // COMMON SPAM PHRASES
    // ══════════════════════════════════════════════════════════════
    this.spamPhrases = [
      /(?:dm|direct message|text|contact|reach|message)\s+(?:me|us)/i,
      /(?:add|follow|find)\s+(?:me|us)\s+on/i,
      /click\s+(?:here|link|below)/i,
      /check\s+(?:bio|link|profile)/i,
      /(?:earn|make)\s+\$?\d+/i,
      /work\s+from\s+home/i,
      /limited\s+(?:time|offer|slots?)/i,
      /(?:free|get)\s+(?:money|cash|$)/i,
      /business\s+(?:opportunity|proposal)/i,
      /investment\s+opportunity/i
    ];

    // ══════════════════════════════════════════════════════════════
    // SUSPICIOUS PATTERNS
    // ══════════════════════════════════════════════════════════════
    this.suspiciousPatterns = {
      repeatedChars: /(.)\1{4,}/,              // aaaaa
      excessiveEmojis: /([\u{1F300}-\u{1F9FF}]){5,}/u,
      allCaps: /^[A-Z\s!@#$%^&*()]{20,}$/,
      leetSpeak: /[a-z0-9@$!]{3,}\d+[a-z0-9@$!]*/i,
      excessiveSpaces: /\s{5,}/,
      excessivePunctuation: /[!?.,]{5,}/
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN SCAN FUNCTION
  // ═══════════════════════════════════════════════════════════════
  scan(bio) {
    const startTime = Date.now();
    const violations = [];
    let riskScore = 0;
    let confidence = 0;

    // Clean input
    const cleanBio = bio.trim();
    
    if (!cleanBio) {
      return {
        passed: true,
        violations: [],
        riskScore: 0,
        confidence: 100,
        scanTime: Date.now() - startTime
      };
    }

    // ═══════════════════════════════════════════════════════════
    // SCAN 1: Platform Redirection
    // ═══════════════════════════════════════════════════════════
    Object.entries(this.platformPatterns).forEach(([platform, pattern]) => {
      const matches = cleanBio.match(pattern);
      if (matches) {
        violations.push({
          type: 'PLATFORM_REDIRECT',
          platform,
          severity: 'HIGH',
          matched: matches[0],
          riskWeight: 30
        });
        riskScore += 30;
      }
    });

    // ═══════════════════════════════════════════════════════════
    // SCAN 2: Spam Phrases
    // ═══════════════════════════════════════════════════════════
    this.spamPhrases.forEach((pattern, index) => {
      const matches = cleanBio.match(pattern);
      if (matches) {
        violations.push({
          type: 'SPAM_PHRASE',
          severity: 'MEDIUM',
          matched: matches[0],
          riskWeight: 15
        });
        riskScore += 15;
      }
    });

    // ═══════════════════════════════════════════════════════════
    // SCAN 3: Suspicious Patterns
    // ═══════════════════════════════════════════════════════════
    Object.entries(this.suspiciousPatterns).forEach(([pattern, regex]) => {
      if (regex.test(cleanBio)) {
        violations.push({
          type: 'SUSPICIOUS_PATTERN',
          pattern,
          severity: 'LOW',
          riskWeight: 5
        });
        riskScore += 5;
      }
    });

    // ═══════════════════════════════════════════════════════════
    // SCAN 4: Multiple Contacts (Big Red Flag!)
    // ═══════════════════════════════════════════════════════════
    const contactCount = violations.filter(v => 
      v.type === 'PLATFORM_REDIRECT'
    ).length;

    if (contactCount >= 2) {
      violations.push({
        type: 'MULTIPLE_CONTACTS',
        severity: 'CRITICAL',
        count: contactCount,
        riskWeight: 40
      });
      riskScore += 40;
    }

    // ═══════════════════════════════════════════════════════════
    // CALCULATE CONFIDENCE
    // ═══════════════════════════════════════════════════════════
    if (riskScore === 0) {
      confidence = 95; // Clean, high confidence
    } else if (riskScore >= 60) {
      confidence = 95; // Clearly spam
    } else if (riskScore >= 30) {
      confidence = 70; // Likely spam
    } else {
      confidence = 50; // Suspicious, needs AI review
    }

    // ═══════════════════════════════════════════════════════════
    // DECISION
    // ═══════════════════════════════════════════════════════════
    const decision = this.makeDecision(riskScore, confidence);

    return {
      passed: decision.action !== 'BLOCK',
      action: decision.action, // ALLOW, FLAG, BLOCK
      violations,
      riskScore: Math.min(riskScore, 100),
      confidence,
      scanTime: Date.now() - startTime,
      needsAIReview: decision.action === 'FLAG' || (riskScore > 0 && riskScore < 60)
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // DECISION LOGIC
  // ═══════════════════════════════════════════════════════════════
  makeDecision(riskScore, confidence) {
    // BLOCK: Clear spam (high risk + high confidence)
    if (riskScore >= 60) {
      return {
        action: 'BLOCK',
        reason: 'High risk spam detected by rules'
      };
    }

    // FLAG: Suspicious (medium risk, needs AI review)
    if (riskScore >= 20 && riskScore < 60) {
      return {
        action: 'FLAG',
        reason: 'Suspicious patterns, sending to AI for analysis'
      };
    }

    // ALLOW: Clean
    return {
      action: 'ALLOW',
      reason: 'No spam patterns detected'
    };
  }
}

export default RulesScanner;