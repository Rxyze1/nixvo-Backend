// utils/rateLimiter.js

/**
 * ════════════════════════════════════════════════════════════════
 *                    ⏱️ RATE LIMITER
 *          Keeps you within Groq's free tier limits
 * ════════════════════════════════════════════════════════════════
 * 
 * WHAT IT DOES:
 * ✅ Tracks API calls per minute
 * ✅ Blocks requests if limit exceeded
 * ✅ Auto-resets every minute
 * ✅ Prevents you from hitting Groq rate limits
 * 
 * GROQ FREE TIER LIMITS:
 * - 14,400 requests/day
 * - ~30 requests/minute (to be safe, we use 20)
 * 
 * EXAMPLE:
 * - Minute 1: 20 requests made → canMakeRequest() = false
 * - Minute 2: Counter resets → canMakeRequest() = true
 * - Prevents 429 "Too Many Requests" errors
 * ════════════════════════════════════════════════════════════════
 */

class RateLimiter {
  constructor(maxPerMinute = 20) {
    this.requests = [];             // Array of timestamps
    this.maxPerMinute = maxPerMinute; // Max requests per minute
    
    console.log('✅ Rate Limiter initialized');
    console.log(`   └─ Max: ${maxPerMinute} requests/minute\n`);
  }

  /**
   * Check if we can make a request
   * Removes old timestamps (>60 seconds old)
   * 
   * @returns {boolean} - True if under limit
   */
  canMakeRequest() {
    const now = Date.now();
    
    // Remove requests older than 60 seconds
    this.requests = this.requests.filter(timestamp => {
      return (now - timestamp) < 60000; // 60,000ms = 1 minute
    });
    
    const canProceed = this.requests.length < this.maxPerMinute;
    
    if (!canProceed) {
      const oldestRequest = Math.min(...this.requests);
      const resetIn = Math.ceil((60000 - (now - oldestRequest)) / 1000);
      console.log(`⏱️ RATE LIMITED - ${this.requests.length}/${this.maxPerMinute} requests used`);
      console.log(`   └─ Resets in: ${resetIn} seconds`);
    }
    
    return canProceed;
  }

  /**
   * Record a request
   * Call this AFTER making API call
   */
  recordRequest() {
    this.requests.push(Date.now());
    console.log(`📊 Rate limiter: ${this.requests.length}/${this.maxPerMinute} requests used this minute`);
  }

  /**
   * Get current status
   * 
   * @returns {object} - Status info
   */
  getStatus() {
    const now = Date.now();
    
    // Clean old requests
    this.requests = this.requests.filter(t => (now - t) < 60000);
    
    const remaining = this.maxPerMinute - this.requests.length;
    const available = this.canMakeRequest();
    
    return {
      requestsLastMinute: this.requests.length,
      maxPerMinute: this.maxPerMinute,
      remaining: remaining,
      available: available,
      status: available ? '🟢 Available' : '🔴 Rate Limited'
    };
  }

  /**
   * Reset all counters (for testing)
   */
  reset() {
    this.requests = [];
    console.log('🔄 Rate limiter reset');
  }

  /**
   * Get time until next request is allowed
   * 
   * @returns {number} - Seconds until reset (0 if available)
   */
  getResetTime() {
    if (this.canMakeRequest()) {
      return 0;
    }
    
    const now = Date.now();
    const oldestRequest = Math.min(...this.requests);
    const resetIn = Math.ceil((60000 - (now - oldestRequest)) / 1000);
    
    return resetIn;
  }
}

// Export singleton instance
export default new RateLimiter(20); // Conservative limit: 20/minute