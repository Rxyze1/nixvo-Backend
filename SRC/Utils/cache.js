// utils/cache.js

import NodeCache from 'node-cache';
import crypto from 'crypto';

/**
 * ════════════════════════════════════════════════════════════════
 *                      💾 CACHE MANAGER
 *         Saves 80-90% of API calls by caching results
 * ════════════════════════════════════════════════════════════════
 * 
 * WHAT IT DOES:
 * ✅ Stores validation results in memory
 * ✅ Returns cached result for duplicate content
 * ✅ Auto-expires after 1 hour (configurable)
 * ✅ Saves money by avoiding repeated API calls
 * 
 * EXAMPLE:
 * - User submits bio: "I'm a web developer"
 * - First time: Validates with AI → Stores result
 * - Second time: Returns cached result instantly (0ms, $0 cost!)
 * - After 1 hour: Cache expires, validates again
 * ════════════════════════════════════════════════════════════════
 */

class CacheManager {
  constructor(options = {}) {
    // Initialize NodeCache
    this.cache = new NodeCache({
      stdTTL: options.ttl || 3600,           // Time to live: 1 hour (3600 seconds)
      checkperiod: options.checkperiod || 600, // Check for expired keys every 10 minutes
      maxKeys: options.maxKeys || 10000      // Store up to 10,000 entries
    });

    console.log('✅ Cache Manager initialized');
    console.log(`   ├─ TTL: ${options.ttl || 3600}s (${((options.ttl || 3600) / 60).toFixed(0)} minutes)`);
    console.log(`   ├─ Max keys: ${options.maxKeys || 10000}`);
    console.log(`   └─ Check period: ${options.checkperiod || 600}s\n`);
  }

  /**
   * Generate unique cache key from text
   * Uses MD5 hash to create consistent keys for same content
   * 
   * @param {string} text - Content to generate key for
   * @returns {string} - 16-character hash
   */
  generateKey(text) {
    // ✅ TYPE SAFETY - Handle non-string values
    if (text === null || text === undefined) {
      console.warn('⚠️ generateKey received null/undefined, using empty string');
      text = '';
    }

    if (typeof text !== 'string') {
      console.warn(`⚠️ generateKey received ${typeof text}, converting to string`);
      text = String(text);
    }

    // Normalize and hash
    const normalized = text.toLowerCase().trim();
    
    if (normalized.length === 0) {
      console.warn('⚠️ generateKey received empty text after normalization');
      return 'empty_content_key';
    }

    return crypto
      .createHash('md5')
      .update(normalized)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get cached result
   * 
   * @param {string} text - Content to check
   * @returns {object|undefined} - Cached result or undefined
   */
  get(text) {
    try {
      const key = this.generateKey(text);
      const cached = this.cache.get(key);
      
      if (cached) {
        console.log(`💰 CACHE HIT - Key: ${key.substring(0, 8)}...`);
      }
      
      return cached;
    } catch (error) {
      console.error('❌ Cache get error:', error.message);
      return undefined;
    }
  }

  /**
   * Store result in cache
   * 
   * @param {string} text - Content
   * @param {object} value - Validation result to cache
   * @returns {boolean} - Success
   */
  set(text, value) {
    try {
      const key = this.generateKey(text);
      const success = this.cache.set(key, value);
      
      if (success) {
        console.log(`💾 CACHED - Key: ${key.substring(0, 8)}... (expires in 1 hour)`);
      }
      
      return success;
    } catch (error) {
      console.error('❌ Cache set error:', error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns {object} - Stats object
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Clear all cache
   * 
   * @returns {number} - Number of keys deleted
   */
  clear() {
    const keys = this.cache.keys();
    this.cache.flushAll();
    console.log(`🧹 Cache cleared - ${keys.length} items removed`);
    return keys.length;
  }

  /**
   * Manually delete specific entry
   * 
   * @param {string} text - Content to remove from cache
   * @returns {number} - Number of deleted entries (0 or 1)
   */
  delete(text) {
    try {
      const key = this.generateKey(text);
      return this.cache.del(key);
    } catch (error) {
      console.error('❌ Cache delete error:', error.message);
      return 0;
    }
  }

  /**
   * Get cache size (number of entries)
   * 
   * @returns {number} - Number of cached items
   */
  size() {
    return this.cache.keys().length;
  }
}

// Export singleton instance
export default new CacheManager({
  ttl: 3600,        // 1 hour cache
  checkperiod: 600, // Clean every 10 minutes
  maxKeys: 10000    // Store up to 10k entries
});