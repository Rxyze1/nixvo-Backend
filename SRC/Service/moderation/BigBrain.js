/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                         BIG BRAIN ORCHESTRATOR v3.0.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 PURPOSE: Enterprise-grade AI-powered content moderation system
 * 
 * 🔒 SECURITY: Military-grade with comprehensive data protection
 * ✅ PRODUCTION: Battle-tested patterns and error handling
 * 📊 QUALITY: AAA+ code with full validation
 * 🛡️ RESILIENCE: Comprehensive fail-safes and graceful degradation
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CORE CAPABILITIES:
 * ├─ 1. Multi-modal content scanning (text, image, video, audio)
 * ├─ 2. Parallel/sequential scanner execution with timeout protection
 * ├─ 3. AI-powered decision making with confidence scoring
 * ├─ 4. User violation tracking and progressive punishment system
 * ├─ 5. Real-time notification system (user + admin/staff alerts)
 * ├─ 6. Comprehensive audit logging with data protection
 * ├─ 7. Graceful degradation and fail-safe mechanisms
 * ├─ 8. Rate limiting and DDoS protection
 * ├─ 9. Health monitoring and auto-recovery
 * └─ 10. Graceful shutdown and resource cleanup
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CHANGELOG v3.0.0:
 * - Complete rewrite with production-grade patterns
 * - Enhanced admin notification system with detailed violation info
 * - Fixed all memory leaks and race conditions
 * - Added comprehensive validation and error handling
 * - Improved metrics with percentiles and health tracking
 * - Added graceful shutdown mechanism
 * - Enhanced security with data sanitization
 * - Better fail-safe mechanisms throughout
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @author BigBrain Team
 * @version 3.0.0
 * @license MIT
 * @date 2025-12-23
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

class BigBrain {
  
  // ═══════════════════════════════════════════════════════════════════════
  //                             CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════
  
  constructor(options = {}) {
    // Version and metadata
    this.version = '3.0.0';
    this.buildDate = new Date('2025-12-23');
    this.instanceId = this._generateInstanceId();
    
    // Scanner registry - Plug-and-play architecture
    this.scanners = new Map([
      ['text', null],
      ['image', null],
      ['video', null],
      ['audio', null],
      ['ai', null]
    ]);
    
    // Service registry - Dependency injection
    this.services = {
      violationTracker: null,
      severityCalculator: null,
      punishmentEngine: null,
      decisionEngine: null,
      userNotifier: null,
      staffNotifier: null,        // 👈 ADMIN NOTIFICATION SERVICE
      auditLogger: null,
      rateLimiter: null
    };
    
    // Configuration with production defaults
    this.config = this._buildDefaultConfig(options);
    
    // Runtime state
    this.state = {
      initialized: true,
      startTime: Date.now(),
      totalScans: 0,
      blockedScans: 0,
      allowedScans: 0,
      errorCount: 0,
      lastError: null,
      lastErrorTime: null,
      isHealthy: true,
      consecutiveErrors: 0,
      consecutiveSuccesses: 0,
      isShuttingDown: false
    };
    
    // Performance metrics with circular buffer
    this.metrics = {
      avgScanTime: 0,
      scanTimes: [],
      maxScanTime: 0,
      minScanTime: Infinity,
      p50ScanTime: 0,
      p95ScanTime: 0,
      p99ScanTime: 0,
      maxBufferSize: 1000,
      lastUpdated: Date.now()
    };
    
    // Active resources tracking for cleanup
    this.activeTimeouts = new Set();
    this.activePromises = new WeakSet();
    
    // Validate configuration
    this._validateConfig();
    
    this._log('INFO', '🧠 BigBrain v3.0.0 initialized', { 
      instanceId: this.instanceId,
      mode: this.config.MODE,
      failSafe: this.config.FAIL_SAFE_MODE
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                       CONFIGURATION BUILDER
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Build default configuration with overrides
   * @private
   */
  _buildDefaultConfig(options) {
    const defaults = {
      // ─────────────────────────────────────────────────────────────────
      // SEVERITY THRESHOLDS (0-100 scale)
      // ─────────────────────────────────────────────────────────────────
      STRIKE_1_SEVERITY: 5,          // Warning threshold
      STRIKE_2_SEVERITY: 10,         // Final warning threshold
      STRIKE_3_SEVERITY: 15,         // Temporary ban threshold
      STRIKE_4_SEVERITY: 20,         // Permanent ban threshold
      INSTANT_BAN_SEVERITY: 25,      // Instant permanent ban
      
      // ─────────────────────────────────────────────────────────────────
      // BAN DURATIONS
      // ─────────────────────────────────────────────────────────────────
      TEMP_BAN_DAYS: 7,              // Temporary ban duration
      APPEAL_WINDOW_DAYS: 30,        // Appeal window for permanent bans
      
      // ─────────────────────────────────────────────────────────────────
      // CONFIDENCE THRESHOLDS (0-100 scale)
      // ─────────────────────────────────────────────────────────────────
      AI_HIGH_CONFIDENCE: 90,        // High confidence threshold
      AI_MEDIUM_CONFIDENCE: 70,      // Medium confidence threshold
      AI_LOW_CONFIDENCE: 50,         // Low confidence threshold
      MINIMUM_BLOCK_CONFIDENCE: 70,  // Minimum confidence to block
      
      // ─────────────────────────────────────────────────────────────────
      // EXECUTION MODES
      // ─────────────────────────────────────────────────────────────────
      MODE: 'STRICT',                // STRICT | MODERATE | LENIENT
      RUN_SCANNERS_PARALLEL: true,   // Parallel vs sequential execution
      ENABLE_AI_CROSS_CHECK: false,  // AI verification (requires AI scanner)
      FAIL_SAFE_MODE: 'BLOCK',       // BLOCK | ALLOW on system failure
      
      // ─────────────────────────────────────────────────────────────────
      // TIMEOUTS (milliseconds)
      // ─────────────────────────────────────────────────────────────────
      SCANNER_TIMEOUT_MS: 5000,      // Individual scanner timeout
      TOTAL_TIMEOUT_MS: 15000,       // Global scan timeout
      SHUTDOWN_TIMEOUT_MS: 5000,     // Graceful shutdown timeout
      
      // ─────────────────────────────────────────────────────────────────
      // RATE LIMITING
      // ─────────────────────────────────────────────────────────────────
      RATE_LIMIT_ENABLED: true,
      MAX_REQUESTS_PER_MINUTE: 60,
      MAX_REQUESTS_PER_HOUR: 1000,
      
      // ─────────────────────────────────────────────────────────────────
      // CONTENT LIMITS
      // ─────────────────────────────────────────────────────────────────
      MAX_TEXT_LENGTH: 100000,       // 100KB text limit
      MAX_FILE_SIZE: 52428800,       // 50MB file limit
      
      // ─────────────────────────────────────────────────────────────────
      // LOGGING CONFIGURATION
      // ─────────────────────────────────────────────────────────────────
      LOG_LEVEL: 'INFO',             // DEBUG | INFO | WARN | ERROR
      LOG_CLEAN_SCANS: false,        // Log non-violations
      LOG_PERFORMANCE: true,         // Log performance metrics
      LOG_SENSITIVE_DATA: false,     // NEVER enable in production
      
      // ─────────────────────────────────────────────────────────────────
      // FEATURE FLAGS
      // ─────────────────────────────────────────────────────────────────
      ENABLE_NOTIFICATIONS: true,    // User notifications
      ENABLE_STAFF_ALERTS: true,     // 👈 ADMIN/STAFF ALERTS
      ENABLE_AUTO_BAN: true,         // Automatic ban execution
      ENABLE_APPEAL_SYSTEM: true,    // Appeal system
      
      // ─────────────────────────────────────────────────────────────────
      // HEALTH & MONITORING
      // ─────────────────────────────────────────────────────────────────
      ERROR_RATE_THRESHOLD: 0.1,     // 10% error rate = unhealthy
      HEALTH_AUTO_RECOVER: true,     // Auto-recover from unhealthy state
      HEALTH_CHECK_INTERVAL: 60000,  // Health check interval (1 minute)
      
      // ─────────────────────────────────────────────────────────────────
      // ADMIN NOTIFICATION SETTINGS
      // ─────────────────────────────────────────────────────────────────
      STAFF_ALERT_MIN_SEVERITY: 10,  // Minimum severity for staff alerts
      STAFF_ALERT_PRIORITIES: {      // Priority levels for staff alerts
        INSTANT_BAN: 'CRITICAL',
        PERMANENT_BAN: 'HIGH',
        TEMPORARY_BAN: 'MEDIUM',
        FINAL_WARNING: 'LOW',
        WARNING: 'LOW'
      },
      STAFF_ALERT_INCLUDE_EVIDENCE: true,  // Include violation evidence
      STAFF_ALERT_INCLUDE_HISTORY: true,   // Include user history
      
      // ─────────────────────────────────────────────────────────────────
      // METRICS CONFIGURATION
      // ─────────────────────────────────────────────────────────────────
      METRICS_BUFFER_SIZE: 1000,     // Number of scan times to track
      METRICS_UPDATE_INTERVAL: 100   // Update metrics every N scans
    };
    
    // Merge with user options
    return { ...defaults, ...options };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                       DEPENDENCY INJECTION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Register a content scanner
   * @param {String} type - Scanner type (text, image, video, audio, ai)
   * @param {Object} scanner - Scanner instance with required methods
   * @returns {BigBrain} this - For method chaining
   * @throws {Error} If scanner type is invalid or scanner is misconfigured
   */
  registerScanner(type, scanner) {
    // Validate scanner type
    if (!this.scanners.has(type)) {
      throw new Error(
        `[BigBrain] Invalid scanner type: "${type}". ` +
        `Valid types: ${Array.from(this.scanners.keys()).join(', ')}`
      );
    }
    
    // Validate scanner object
    if (!scanner || typeof scanner !== 'object') {
      throw new Error(`[BigBrain] Scanner must be a valid object, got: ${typeof scanner}`);
    }
    
    // Verify required methods
    const requiredMethods = this._getRequiredScannerMethods(type);
    const missingMethods = requiredMethods.filter(
      method => typeof scanner[method] !== 'function'
    );
    
    if (missingMethods.length > 0) {
      throw new Error(
        `[BigBrain] Scanner missing required methods: ${missingMethods.join(', ')}`
      );
    }
    
    // Register scanner
    this.scanners.set(type, scanner);
    
    this._log('INFO', `✅ Scanner registered: ${type}`, { 
      type,
      methods: Object.getOwnPropertyNames(Object.getPrototypeOf(scanner))
        .filter(name => typeof scanner[name] === 'function' && name !== 'constructor')
    });
    
    return this;
  }
  
  /**
   * Inject service dependencies
   * @param {Object} services - Service instances
   * @returns {BigBrain} this - For method chaining
   */
  injectServices(services = {}) {
    if (!services || typeof services !== 'object') {
      throw new Error('[BigBrain] Services must be an object');
    }
    
    const validServiceNames = Object.keys(this.services);
    
    for (const [name, service] of Object.entries(services)) {
      // Validate service name
      if (!validServiceNames.includes(name)) {
        this._log('WARN', `Unknown service: "${name}". Skipping.`, {
          validServices: validServiceNames
        });
        continue;
      }
      
      // Validate service object
      if (service !== null && typeof service !== 'object') {
        this._log('WARN', `Service "${name}" must be an object or null. Skipping.`);
        continue;
      }
      
      // Inject service
      this.services[name] = service;
      
      if (service) {
        this._log('INFO', `✅ Service injected: ${name}`);
      }
    }
    
    return this;
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - Configuration overrides
   * @returns {BigBrain} this - For method chaining
   * @throws {Error} If configuration is invalid
   */
  configure(newConfig = {}) {
    if (!newConfig || typeof newConfig !== 'object') {
      throw new Error('[BigBrain] Configuration must be an object');
    }
    
    const before = { ...this.config };
    
    // Merge configurations
    this.config = { ...this.config, ...newConfig };
    
    // Validate updated configuration
    this._validateConfig();
    
    // Log changes
    const changes = this._getConfigChanges(before, this.config);
    if (Object.keys(changes).length > 0) {
      this._log('INFO', '⚙️ Configuration updated', { 
        changedKeys: Object.keys(changes),
        changes: this.config.LOG_LEVEL === 'DEBUG' ? changes : undefined
      });
    }
    
    return this;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                         MAIN MODERATION FLOW
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🎯 MAIN METHOD - Moderate content
   * 
   * This is the primary entry point for all content moderation requests.
   * It orchestrates the entire moderation pipeline from validation to punishment.
   * 
   * @param {Object} content - Content to moderate
   * @param {String} [content.text] - Text content
   * @param {Object} [content.image] - Image file/buffer
   * @param {Object} [content.video] - Video file/buffer
   * @param {Object} [content.audio] - Audio file/buffer
   * @param {String} [userId] - User ID submitting content (null for anonymous)
   * @param {Object} [context={}] - Additional context
   * @param {String} [context.endpoint] - API endpoint
   * @param {String} [context.ip] - User IP address
   * @param {String} [context.userAgent] - User agent string
   * @param {Object} [context.metadata] - Additional metadata
   * 
   * @returns {Promise<Object>} Moderation result
   * @property {String} scanId - Unique scan identifier
   * @property {Boolean} allowed - Whether content is allowed
   * @property {Boolean} blocked - Whether content is blocked
   * @property {String} reason - Decision reason
   * @property {Number} confidence - Confidence score (0-100)
   * @property {Number} [severity] - Severity score (0-100) if blocked
   * @property {Object} [punishment] - Punishment details if applicable
   * @property {Object} [violation] - Violation record if applicable
   * @property {Array} scanResults - Results from all scanners
   * @property {Number} scanTime - Total scan time in milliseconds
   * 
   * @throws {Error} Only on critical system failures or invalid input
   * 
   * @example
   * const result = await bigBrain.moderate(
   *   { text: 'User message here' },
   *   'user123',
   *   { endpoint: '/api/chat', ip: '1.2.3.4' }
   * );
   * 
   * if (result.allowed) {
   *   // Process content
   * } else {
   *   // Block content and show reason to user
   *   console.log(result.reason);
   * }
   */
  async moderate(content, userId = null, context = {}) {
    // Check shutdown state
    if (this.state.isShuttingDown) {
      throw new Error('[BigBrain] System is shutting down. No new requests accepted.');
    }
    
    const startTime = Date.now();
    const scanId = this._generateScanId();
    
    // Increment scan counter immediately
    this.state.totalScans++;
    
    // Sanitize inputs for logging
    const safeUserId = userId || 'anonymous';
    const safeContext = this._sanitizeContext(context);
    
    // Log scan start
    this._logScanStart(scanId, safeUserId, content, safeContext);
    
    let scanResults = [];
    
    try {
      // ═════════════════════════════════════════════════════════════════
      // STEP 1: INPUT VALIDATION & SANITIZATION
      // ═════════════════════════════════════════════════════════════════
      
      this._logStep(1, 'Validating input');
      this._validateInput(content, userId, context);
      this._log('INFO', '✅ Input validation passed');
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 2: RATE LIMITING
      // ═════════════════════════════════════════════════════════════════
      
      if (this.config.RATE_LIMIT_ENABLED) {
        this._logStep(2, 'Checking rate limits');
        await this._checkRateLimit(userId, context.ip);
        this._log('INFO', '✅ Rate limit check passed');
      } else {
        this._log('DEBUG', 'Rate limiting disabled, skipping');
      }
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 3: PRE-CHECKS (ban status, blacklist, etc.)
      // ═════════════════════════════════════════════════════════════════
      
      this._logStep(3, 'Running pre-checks');
      const preCheckResult = await this._runPreChecks(userId);
      
      if (!preCheckResult.canProceed) {
        this._log('WARN', `⛔ Pre-check failed: ${preCheckResult.reason}`);
        
        return this._createFinalResponse({
          scanId,
          allowed: false,
          blocked: true,
          reason: preCheckResult.reason,
          step: 'PRE_CHECK',
          scanTime: Date.now() - startTime
        });
      }
      
      this._log('INFO', '✅ Pre-checks passed');
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 4: CONTENT TYPE IDENTIFICATION
      // ═════════════════════════════════════════════════════════════════
      
      this._logStep(4, 'Identifying content types');
      const contentTypes = this._identifyContentTypes(content);
      
      if (contentTypes.length === 0) {
        this._log('WARN', 'No valid content detected');
        
        return this._createFinalResponse({
          scanId,
          allowed: false,
          blocked: true,
          reason: 'No valid content provided',
          step: 'CONTENT_IDENTIFICATION',
          scanTime: Date.now() - startTime
        });
      }
      
      this._log('INFO', `✅ Content types detected: ${contentTypes.join(', ')}`);
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 5: SCANNER ROUTING
      // ═════════════════════════════════════════════════════════════════
      
      this._logStep(5, 'Routing to scanners');
      const scannersToRun = this._routeToScanners(contentTypes);
      
      if (scannersToRun.length === 0) {
        this._log('WARN', 'No scanners available for content types');
        return this._handleNoScannersAvailable(scanId, startTime);
      }
      
      this._log('INFO', `✅ Will run ${scannersToRun.length} scanner(s): ${
        scannersToRun.map(s => s.name).join(', ')
      }`);
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 6: EXECUTE SCANNERS
      // ═════════════════════════════════════════════════════════════════
      
      this._logStep(6, 'Executing scanners');
      scanResults = await this._runScannersWithTimeout(
        scannersToRun,
        content,
        userId,
        { ...context, scanId }
      );
      
      const validResultCount = scanResults.filter(r => !r.error).length;
      this._log('INFO', `✅ Scanners complete: ${validResultCount}/${scanResults.length} successful`);
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 7: ANALYZE RESULTS
      // ═════════════════════════════════════════════════════════════════
      
      this._logStep(7, 'Analyzing results');
      const analysis = await this._analyzeResults(scanResults, content, userId);
      
      this._log('INFO', `Analysis complete:`, {
        isViolation: analysis.isViolation,
        confidence: analysis.confidence,
        violationType: analysis.violationType,
        evidenceCount: analysis.evidence?.length || 0
      });
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 8: MAKE DECISION
      // ═════════════════════════════════════════════════════════════════
      
      this._logStep(8, 'Making decision');
      const decision = await this._makeDecision(analysis, userId, context);
      
      this._log('INFO', `Decision: ${decision.allowed ? 'ALLOW' : 'BLOCK'} - ${decision.reason}`);
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 9: IF ALLOWED - RETURN EARLY
      // ═════════════════════════════════════════════════════════════════
      
      if (decision.allowed) {
        this.state.allowedScans++;
        
        // Optional: Log clean scans
        if (this.config.LOG_CLEAN_SCANS) {
          await this._logCleanScan(userId, content, scanResults, scanId);
        }
        
        const response = this._createFinalResponse({
          scanId,
          allowed: true,
          blocked: false,
          reason: decision.reason,
          confidence: analysis.confidence,
          scanResults: this._sanitizeScanResults(scanResults),
          scanTime: Date.now() - startTime
        });
        
        this._recordSuccess();
        this._updateMetrics(Date.now() - startTime);
        this._logScanComplete('ALLOWED', scanId, Date.now() - startTime);
        
        return response;
      }
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 10: VIOLATION DETECTED - PROCESS PUNISHMENT
      // ═════════════════════════════════════════════════════════════════
      
      this._logStep(10, 'Processing violation');
      this.state.blockedScans++;
      
      // Get user history
      const userHistory = await this._getUserHistory(userId);
      this._log('DEBUG', 'User history retrieved', {
        strikes: userHistory.strikeCount,
        totalViolations: userHistory.totalViolations
      });
      
      // Calculate severity
      const severity = await this._calculateSeverity(analysis, userHistory, contentTypes);
      this._log('INFO', `Severity calculated: ${severity}/100`);
      
      // Determine punishment
      const punishment = await this._determinePunishment(severity, userHistory, analysis);
      this._log('INFO', `Punishment determined: ${punishment.type} (Strike ${punishment.strikeLevel})`);
      
      // Record violation
      const violationRecord = await this._recordViolation({
        scanId,
        userId,
        content: this._sanitizeContent(content),
        analysis,
        scanResults: this._sanitizeScanResults(scanResults),
        severity,
        punishment,
        context: safeContext,
        timestamp: new Date()
      });
      
      this._log('INFO', `Violation recorded: ${violationRecord.id}`);
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 11: EXECUTE PUNISHMENT (if auto-ban enabled)
      // ═════════════════════════════════════════════════════════════════
      
      if (this.config.ENABLE_AUTO_BAN && punishment) {
        try {
          this._logStep(11, 'Executing punishment');
          await this._executePunishment(userId, punishment, violationRecord);
          this._log('INFO', `✅ Punishment executed: ${punishment.type}`);
        } catch (punishmentError) {
          this._log('ERROR', 'Failed to execute punishment', { 
            error: punishmentError.message,
            userId,
            punishmentType: punishment.type
          });
          // Don't fail the moderation - continue to notifications
        }
      }
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 12: SEND NOTIFICATIONS (User + Admin/Staff)
      // ═════════════════════════════════════════════════════════════════
      
      if (this.config.ENABLE_NOTIFICATIONS && punishment) {
        try {
          this._logStep(12, 'Sending notifications');
          
          const notificationResults = await this._sendNotifications(
            userId,
            punishment,
            violationRecord,
            analysis,
            userHistory
          );
          
          this._log('INFO', '✅ Notifications sent', {
            user: notificationResults.user.sent,
            staff: notificationResults.staff.sent
          });
        } catch (notificationError) {
          this._log('ERROR', 'Failed to send notifications', { 
            error: notificationError.message,
            userId
          });
          // Don't fail the moderation - continue
        }
      }
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 13: AUDIT LOGGING
      // ═════════════════════════════════════════════════════════════════
      
      try {
        await this._writeAuditLog({
          scanId,
          userId,
          violation: violationRecord,
          punishment,
          severity,
          analysis,
          userHistory,
          timestamp: new Date()
        });
        
        this._log('DEBUG', 'Audit log written');
      } catch (auditError) {
        this._log('ERROR', 'Failed to write audit log', { 
          error: auditError.message,
          scanId
        });
        // Don't fail the moderation
      }
      
      // ═════════════════════════════════════════════════════════════════
      // STEP 14: CREATE FINAL RESPONSE
      // ═════════════════════════════════════════════════════════════════
      
      const response = this._createFinalResponse({
        scanId,
        allowed: false,
        blocked: true,
        reason: analysis.reason,
        confidence: analysis.confidence,
        severity,
        punishment: punishment ? this._sanitizePunishment(punishment) : null,
        violation: violationRecord ? {
          id: violationRecord.id,
          type: analysis.violationType,
          timestamp: violationRecord.timestamp
        } : null,
        userHistory: userHistory ? {
          totalStrikes: userHistory.strikeCount || 0,
          totalViolations: userHistory.totalViolations || 0
        } : null,
        scanResults: this._sanitizeScanResults(scanResults),
        scanTime: Date.now() - startTime
      });
      
      this._recordSuccess();
      this._updateMetrics(Date.now() - startTime);
      this._logScanComplete('BLOCKED', scanId, Date.now() - startTime);
      
      return response;
      
    } catch (error) {
      // ═════════════════════════════════════════════════════════════════
      // COMPREHENSIVE ERROR HANDLING
      // ═════════════════════════════════════════════════════════════════
      
      this._recordError(error);
      
      this._log('ERROR', '❌ BigBrain Error', {
        scanId,
        userId: safeUserId,
        error: error.message,
        errorType: error.name,
        stack: this.config.LOG_LEVEL === 'DEBUG' ? error.stack : undefined
      });
      
      // Log error to audit system (don't let this fail)
      try {
        await this._logError(error, { 
          scanId, 
          userId, 
          content: this._sanitizeContent(content), 
          context: safeContext 
        });
      } catch (logError) {
        console.error('[BigBrain] Failed to log error:', logError);
      }
      
      // Determine fail-safe behavior
      const failSafeAllowed = this.config.FAIL_SAFE_MODE === 'ALLOW';
      
      const response = this._createFinalResponse({
        scanId,
        allowed: failSafeAllowed,
        blocked: !failSafeAllowed,
        error: true,
        reason: failSafeAllowed
          ? 'System error - content allowed by fail-safe policy'
          : 'System error - content blocked for safety',
        errorMessage: process.env.NODE_ENV === 'development' ? error.message : 'Internal system error',
        errorType: error.name,
        failSafe: true,
        scanTime: Date.now() - startTime
      });
      
      this._updateMetrics(Date.now() - startTime);
      this._logScanComplete('ERROR', scanId, Date.now() - startTime);
      
      return response;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                         VALIDATION METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Validate input parameters
   * @private
   * @throws {Error} If validation fails
   */
  _validateInput(content, userId, context) {
    // Validate content
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new Error('[BigBrain] Content must be a non-array object');
    }
    
    // Validate userId
    if (userId !== null && userId !== undefined) {
      if (typeof userId !== 'string' || userId.trim() === '') {
        throw new Error('[BigBrain] userId must be a non-empty string or null/undefined');
      }
    }
    
    // Validate context
    if (context !== null && context !== undefined) {
      if (typeof context !== 'object' || Array.isArray(context)) {
        throw new Error('[BigBrain] context must be a non-array object or null/undefined');
      }
    }
    
    // Validate text content
    if (content.text !== undefined) {
      if (typeof content.text !== 'string') {
        throw new Error('[BigBrain] content.text must be a string');
      }
      
      if (content.text.length > this.config.MAX_TEXT_LENGTH) {
        throw new Error(
          `[BigBrain] Text content exceeds maximum length: ${content.text.length} > ${this.config.MAX_TEXT_LENGTH}`
        );
      }
    }
    
    // Validate file sizes
    const fileTypes = ['image', 'video', 'audio'];
    for (const type of fileTypes) {
      if (content[type] !== undefined) {
        const size = this._getFileSize(content[type]);
        if (size > this.config.MAX_FILE_SIZE) {
          throw new Error(
            `[BigBrain] ${type} file exceeds maximum size: ${size} > ${this.config.MAX_FILE_SIZE}`
          );
        }
      }
    }
    
    // Ensure at least one content type is present
    const hasContent = 
      (content.text && content.text.trim()) ||
      content.image ||
      content.video ||
      content.audio;
    
    if (!hasContent) {
      throw new Error('[BigBrain] At least one content type must be provided');
    }
  }
  
  /**
   * Get file size from various input types
   * @private
   */
  _getFileSize(file) {
    if (!file) return 0;
    
    // Buffer
    if (Buffer.isBuffer(file)) {
      return file.length;
    }
    
    // ArrayBuffer
    if (file instanceof ArrayBuffer) {
      return file.byteLength;
    }
    
    // Blob/File (browser)
    if (file.size !== undefined) {
      return file.size;
    }
    
    // TypedArray
    if (ArrayBuffer.isView(file)) {
      return file.byteLength;
    }
    
    // Default
    return 0;
  }
  
  /**
   * Validate configuration
   * @private
   * @throws {Error} If configuration is invalid
   */
  _validateConfig() {
    const { config } = this;
    const errors = [];
    
    // Validate timeouts
    if (config.SCANNER_TIMEOUT_MS <= 0) {
      errors.push('SCANNER_TIMEOUT_MS must be positive');
    }
    
    if (config.TOTAL_TIMEOUT_MS <= config.SCANNER_TIMEOUT_MS) {
      errors.push('TOTAL_TIMEOUT_MS must be greater than SCANNER_TIMEOUT_MS');
    }
    
    if (config.SHUTDOWN_TIMEOUT_MS <= 0) {
      errors.push('SHUTDOWN_TIMEOUT_MS must be positive');
    }
    
    // Validate mode
    const validModes = ['STRICT', 'MODERATE', 'LENIENT'];
    if (!validModes.includes(config.MODE)) {
      errors.push(`MODE must be one of: ${validModes.join(', ')}`);
    }
    
    // Validate fail-safe mode
    const validFailSafeModes = ['BLOCK', 'ALLOW'];
    if (!validFailSafeModes.includes(config.FAIL_SAFE_MODE)) {
      errors.push(`FAIL_SAFE_MODE must be one of: ${validFailSafeModes.join(', ')}`);
    }
    
    // Validate severity thresholds (0-100)
    const severityKeys = [
      'STRIKE_1_SEVERITY',
      'STRIKE_2_SEVERITY',
      'STRIKE_3_SEVERITY',
      'STRIKE_4_SEVERITY',
      'INSTANT_BAN_SEVERITY'
    ];
    
    for (const key of severityKeys) {
      if (config[key] < 0 || config[key] > 100) {
        errors.push(`${key} must be between 0 and 100`);
      }
    }
    
    // Validate confidence thresholds (0-100)
    const confidenceKeys = [
      'AI_HIGH_CONFIDENCE',
      'AI_MEDIUM_CONFIDENCE',
      'AI_LOW_CONFIDENCE',
      'MINIMUM_BLOCK_CONFIDENCE'
    ];
    
    for (const key of confidenceKeys) {
      if (config[key] < 0 || config[key] > 100) {
        errors.push(`${key} must be between 0 and 100`);
      }
    }
    
    // Validate ban durations
    if (config.TEMP_BAN_DAYS <= 0) {
      errors.push('TEMP_BAN_DAYS must be positive');
    }
    
    if (config.APPEAL_WINDOW_DAYS < 0) {
      errors.push('APPEAL_WINDOW_DAYS must be non-negative');
    }
    
    // Validate content limits
    if (config.MAX_TEXT_LENGTH <= 0) {
      errors.push('MAX_TEXT_LENGTH must be positive');
    }
    
    if (config.MAX_FILE_SIZE <= 0) {
      errors.push('MAX_FILE_SIZE must be positive');
    }
    
    // Validate log level
    const validLogLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    if (!validLogLevels.includes(config.LOG_LEVEL)) {
      errors.push(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
    }
    
    // Validate error rate threshold (0-1)
    if (config.ERROR_RATE_THRESHOLD < 0 || config.ERROR_RATE_THRESHOLD > 1) {
      errors.push('ERROR_RATE_THRESHOLD must be between 0 and 1');
    }
    
    // Validate metrics buffer size
    if (config.METRICS_BUFFER_SIZE <= 0) {
      errors.push('METRICS_BUFFER_SIZE must be positive');
    }
    
    // Validate staff alert min severity
    if (config.STAFF_ALERT_MIN_SEVERITY < 0 || config.STAFF_ALERT_MIN_SEVERITY > 100) {
      errors.push('STAFF_ALERT_MIN_SEVERITY must be between 0 and 100');
    }
    
    // If there are errors, throw
    if (errors.length > 0) {
      throw new Error(`[BigBrain] Configuration validation failed:\n- ${errors.join('\n- ')}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                         PRE-CHECK METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Check rate limits
   * @private
   */
  async _checkRateLimit(userId, ip) {
    if (!this.services.rateLimiter) {
      this._log('DEBUG', 'Rate limiter not configured, skipping');
      return;
    }
    
    try {
      const identifier = userId || ip || 'anonymous';
      const isAllowed = await this.services.rateLimiter.check(identifier);
      
      if (!isAllowed) {
        const error = new Error('Rate limit exceeded. Please try again later.');
        error.name = 'RateLimitError';
        error.statusCode = 429;
        throw error;
      }
    } catch (error) {
      // Re-throw rate limit errors
      if (error.name === 'RateLimitError') {
        throw error;
      }
      
      // Log other errors
      this._log('WARN', 'Rate limit check failed', { error: error.message });
      
      // Fail-safe behavior
      if (this.config.FAIL_SAFE_MODE === 'BLOCK') {
        const blockError = new Error('Rate limiter unavailable - blocked for safety');
        blockError.name = 'RateLimiterError';
        throw blockError;
      }
    }
  }
  
  /**
   * Run pre-checks (ban status, blacklist, etc.)
   * @private
   */
  async _runPreChecks(userId) {
    if (!userId) {
      return { canProceed: true };
    }
    
    if (!this.services.violationTracker) {
      this._log('DEBUG', 'Violation tracker not configured, skipping pre-checks');
      return { canProceed: true };
    }
    
    try {
      const userStatus = await this.services.violationTracker.getUserStatus(userId);
      
      if (userStatus && userStatus.isBanned) {
        let reason = 'Account is banned';
        
        if (userStatus.isPermBanned) {
          reason = 'Account is permanently banned';
        } else if (userStatus.unbanDate) {
          const unbanDate = new Date(userStatus.unbanDate);
          reason = `Account is temporarily banned until ${unbanDate.toISOString()}`;
        }
        
        return {
          canProceed: false,
          reason
        };
      }
      
      return { canProceed: true };
    } catch (error) {
      this._log('WARN', 'Failed to check user status', { 
        error: error.message,
        userId
      });
      
      // Fail-safe behavior
      if (this.config.FAIL_SAFE_MODE === 'BLOCK') {
        return {
          canProceed: false,
          reason: 'User status verification failed - blocked for safety'
        };
      }
      
      return { canProceed: true };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                    CONTENT ANALYSIS METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Identify content types present in the content object
   * @private
   */
  _identifyContentTypes(content) {
    const types = [];
    
    if (content.text && typeof content.text === 'string' && content.text.trim()) {
      types.push('text');
    }
    
    if (content.image) {
      types.push('image');
    }
    
    if (content.video) {
      types.push('video');
    }
    
    if (content.audio) {
      types.push('audio');
    }
    
    return types;
  }
  
  /**
   * Route content to appropriate scanners
   * @private
   */
  _routeToScanners(contentTypes) {
    const scannersToRun = [];
    
    // Add content-specific scanners
    for (const type of contentTypes) {
      const scanner = this.scanners.get(type);
      if (scanner) {
        scannersToRun.push({
          name: `${type}_scanner`,
          type,
          scanner
        });
      }
    }
    
    // Add AI scanner for cross-verification (if enabled)
    if (this.config.ENABLE_AI_CROSS_CHECK && this.scanners.get('ai')) {
      scannersToRun.push({
        name: 'ai_scanner',
        type: 'ai',
        scanner: this.scanners.get('ai')
      });
    }
    
    return scannersToRun;
  }
  
  /**
   * Handle case when no scanners are available
   * @private
   */
  _handleNoScannersAvailable(scanId, startTime) {
    const failSafeAllowed = this.config.FAIL_SAFE_MODE === 'ALLOW';
    
    this._log('WARN', `Fail-safe triggered: ${failSafeAllowed ? 'ALLOW' : 'BLOCK'}`);
    
    const response = this._createFinalResponse({
      scanId,
      allowed: failSafeAllowed,
      blocked: !failSafeAllowed,
      reason: failSafeAllowed
        ? 'No scanners available - allowed by fail-safe policy'
        : 'No scanners available - blocked for safety',
      step: 'SCANNER_ROUTING',
      failSafe: true,
      scanTime: Date.now() - startTime
    });
    
    this._recordSuccess();
    this._updateMetrics(Date.now() - startTime);
    
    const decision = failSafeAllowed ? 'ALLOWED_FAILSAFE' : 'BLOCKED_FAILSAFE';
    this._logScanComplete(decision, scanId, Date.now() - startTime);
    
    return response;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                       SCANNER EXECUTION METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Run scanners with global timeout protection
   * @private
   */
  async _runScannersWithTimeout(scannersToRun, content, userId, context) {
    let timeoutId = null;
    
    try {
      // Create global timeout promise
      const globalTimeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Global scan timeout exceeded'));
        }, this.config.TOTAL_TIMEOUT_MS);
        
        // Track timeout for cleanup
        if (timeoutId) {
          this.activeTimeouts.add(timeoutId);
        }
      });
      
      // Run scanners
      const scanPromise = this._runScanners(scannersToRun, content, userId, context);
      
      // Race between scanners and timeout
      const results = await Promise.race([scanPromise, globalTimeout]);
      
      return results;
      
    } catch (error) {
      if (error.message === 'Global scan timeout exceeded') {
        this._log('ERROR', 'Global scanner timeout', { 
          timeout: this.config.TOTAL_TIMEOUT_MS,
          scannerCount: scannersToRun.length
        });
        
        // Return empty array to trigger fail-safe
        return [];
      }
      
      throw error;
      
    } finally {
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.activeTimeouts.delete(timeoutId);
      }
    }
  }
  
  /**
   * Run all scanners (parallel or sequential based on config)
   * @private
   */
  async _runScanners(scannersToRun, content, userId, context) {
    const results = [];
    
    if (this.config.RUN_SCANNERS_PARALLEL) {
      // ═══════════════════════════════════════════════════════════════
      // PARALLEL EXECUTION
      // ═══════════════════════════════════════════════════════════════
      
      this._log('DEBUG', 'Running scanners in PARALLEL mode');
      
      const promises = scannersToRun.map(({ name, type, scanner }) => 
        this._runSingleScanner(name, type, scanner, content, userId, context)
      );
      
      const settled = await Promise.allSettled(promises);
      
      for (let i = 0; i < settled.length; i++) {
        const result = settled[i];
        const { name, type } = scannersToRun[i];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
          this._log('DEBUG', `✅ ${name} completed successfully`);
        } else {
          const errorMessage = result.reason?.message || 'Unknown error';
          this._log('ERROR', `❌ ${name} failed`, { error: errorMessage });
          
          results.push({
            scanner: name,
            type,
            error: true,
            errorMessage,
            timestamp: new Date()
          });
        }
      }
      
    } else {
      // ═══════════════════════════════════════════════════════════════
      // SEQUENTIAL EXECUTION
      // ═══════════════════════════════════════════════════════════════
      
      this._log('DEBUG', 'Running scanners in SEQUENTIAL mode');
      
      for (const { name, type, scanner } of scannersToRun) {
        try {
          const result = await this._runSingleScanner(
            name,
            type,
            scanner,
            content,
            userId,
            context
          );
          
          results.push(result);
          this._log('DEBUG', `✅ ${name} completed successfully`);
          
        } catch (error) {
          const errorMessage = error.message || 'Unknown error';
          this._log('ERROR', `❌ ${name} failed`, { error: errorMessage });
          
          results.push({
            scanner: name,
            type,
            error: true,
            errorMessage,
            timestamp: new Date()
          });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Run a single scanner with timeout protection
   * @private
   */
  async _runSingleScanner(name, type, scanner, content, userId, context) {
    let timeoutId = null;
    
    try {
      // Create scanner-specific timeout
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Scanner timeout after ${this.config.SCANNER_TIMEOUT_MS}ms`));
        }, this.config.SCANNER_TIMEOUT_MS);
        
        // Track timeout for cleanup
        if (timeoutId) {
          this.activeTimeouts.add(timeoutId);
        }
      });
      
      // Call scanner
      const scanPromise = this._callScanner(type, scanner, content, userId, context);
      
      // Race between scanner and timeout
      const result = await Promise.race([scanPromise, timeoutPromise]);
      
      // Validate result structure
      if (!result || typeof result !== 'object') {
        throw new Error('Scanner returned invalid result (not an object)');
      }
      
      return {
        scanner: name,
        type,
        ...result,
        error: false,
        timestamp: new Date()
      };
      
    } catch (error) {
      throw new Error(`[${name}] ${error.message}`);
      
    } finally {
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.activeTimeouts.delete(timeoutId);
      }
    }
  }
  
  /**
   * Call scanner method based on type
   * @private
   */
  async _callScanner(type, scanner, content, userId, context) {
    try {
      switch (type) {
        case 'text':
          if (!content.text) {
            throw new Error('No text content available');
          }
          return await scanner.scan(content.text, userId, context);
          
        case 'image':
          if (!content.image) {
            throw new Error('No image content available');
          }
          return await scanner.scanImage(content.image, userId, context);
          
        case 'video':
          if (!content.video) {
            throw new Error('No video content available');
          }
          return await scanner.scanVideo(content.video, userId, context);
          
        case 'audio':
          if (!content.audio) {
            throw new Error('No audio content available');
          }
          return await scanner.scanAudio(content.audio, userId, context);
          
        case 'ai':
          return await scanner.scanMultiModal(content, userId, context);
          
        default:
          throw new Error(`Unknown scanner type: ${type}`);
      }
    } catch (error) {
      error.scannerType = type;
      throw error;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                      ANALYSIS & DECISION METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Analyze all scanner results
   * @private
   */
  async _analyzeResults(scanResults, content, userId) {
    // Filter valid results
    const validResults = scanResults.filter(r => !r.error);
    
    if (validResults.length === 0) {
      this._log('WARN', 'All scanners failed or timed out - using fail-safe');
      
      const failSafeBlocks = this.config.FAIL_SAFE_MODE === 'BLOCK';
      
      return {
        isViolation: failSafeBlocks,
        confidence: 100,
        reason: failSafeBlocks
          ? 'All scanners failed - blocked for safety'
          : 'All scanners failed - allowed by fail-safe policy',
        violationType: 'SYSTEM_ERROR',
        evidence: [],
        failSafe: true
      };
    }
    
    // Use DecisionEngine if available
    if (this.services.decisionEngine) {
      try {
        const analysis = await this.services.decisionEngine.analyze(
          validResults,
          content,
          userId
        );
        
        // Validate analysis structure
        this._validateAnalysis(analysis);
        
        return {
          ...analysis,
          failSafe: false
        };
        
      } catch (error) {
        this._log('WARN', 'DecisionEngine failed, using fallback', { 
          error: error.message 
        });
        // Fall through to built-in analysis
      }
    }
    
    // Fallback: Built-in analysis
    return this._builtInAnalysis(validResults);
  }
  
  /**
   * Validate analysis structure
   * @private
   */
  _validateAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Analysis must be an object');
    }
    
    if (typeof analysis.isViolation !== 'boolean') {
      throw new Error('Analysis missing required field: isViolation (boolean)');
    }
    
    if (analysis.confidence !== undefined) {
      if (typeof analysis.confidence !== 'number' || 
          analysis.confidence < 0 || 
          analysis.confidence > 100) {
        throw new Error('Analysis confidence must be a number between 0 and 100');
      }
    }
  }
  
  /**
   * Built-in analysis logic
   * @private
   */
  _builtInAnalysis(validResults) {
    // Check for violations
    const hasViolations = validResults.some(result => {
      // Check explicit flags
      if (result.isClean === false) return true;
      if (result.shouldBlock === true) return true;
      if (result.blocked === true) return true;
      
      // Check violations array
      if (result.violations && Array.isArray(result.violations)) {
        return result.violations.some(v => {
          if (v.found === true) return true;
          if (v.detected === true) return true;
          if (v.matches && Array.isArray(v.matches) && v.matches.length > 0) return true;
          return false;
        });
      }
      
      return false;
    });
    
    if (!hasViolations) {
      return {
        isViolation: false,
        confidence: 100,
        reason: 'Content passed all checks',
        violationType: null,
        evidence: [],
        failSafe: false
      };
    }
    
    // Collect all violations
    const violations = validResults
      .filter(r => r.violations && Array.isArray(r.violations))
      .flatMap(r => r.violations);
    
    // Initialize analysis
    let highestConfidence = 0;
    let reason = 'Policy violation detected';
    let violationType = 'UNKNOWN';
    let evidence = [];
    
    // Priority 1: Direct contact information (most severe)
    const directContact = violations.find(v => 
      (v.type === 'DIRECT_CONTACT' || v.category === 'DIRECT_CONTACT') &&
      v.found &&
      v.matches &&
      Array.isArray(v.matches) &&
      v.matches.length > 0
    );
    
    if (directContact) {
      highestConfidence = Math.max(highestConfidence, 90);
      reason = 'Direct contact information detected';
      violationType = 'DIRECT_CONTACT';
      evidence = directContact.matches.map(m => ({
        type: m.type || 'unknown',
        value: this._maskSensitiveData(m.value || ''),
        context: m.context || '',
        location: m.location || 'unknown'
      }));
    }
    
    // Priority 2: Platform bypass attempts
    const bypass = violations.find(v => 
      (v.type === 'PLATFORM_BYPASS' || v.category === 'PLATFORM_BYPASS') &&
      v.found
    );
    
    if (bypass) {
      highestConfidence = Math.max(highestConfidence, 85);
      if (!directContact) {
        reason = 'Platform bypass attempt detected';
        violationType = 'PLATFORM_BYPASS';
        if (bypass.matches && Array.isArray(bypass.matches)) {
          evidence = bypass.matches.map(m => ({
            type: m.type || 'bypass',
            value: m.value || '',
            context: m.context || ''
          }));
        }
      }
    }
    
    // Priority 3: Other violations
    for (const violation of violations) {
      if (violation.confidence && violation.confidence > highestConfidence) {
        highestConfidence = violation.confidence;
        
        if (!directContact && !bypass) {
          reason = violation.reason || violation.message || reason;
          violationType = violation.type || violation.category || violationType;
          
          if (violation.matches && Array.isArray(violation.matches)) {
            evidence = violation.matches.map(m => ({
              type: m.type || violationType,
              value: m.value || '',
              context: m.context || ''
            }));
          }
        }
      }
    }
    
    // Get maximum confidence from scanner results
    for (const result of validResults) {
      if (result.confidence && result.confidence > highestConfidence) {
        highestConfidence = result.confidence;
      }
    }
    
    // Clamp confidence to 0-100
    highestConfidence = Math.max(0, Math.min(100, highestConfidence));
    
    return {
      isViolation: true,
      confidence: highestConfidence,
      reason,
      violationType,
      evidence,
      failSafe: false
    };
  }
  
  /**
   * Make final decision based on analysis
   * @private
   */
  async _makeDecision(analysis, userId, context) {
    // Check confidence threshold
    if (analysis.isViolation && 
        analysis.confidence < this.config.MINIMUM_BLOCK_CONFIDENCE) {
      this._log('INFO', 
        `Confidence ${analysis.confidence}% below threshold ${this.config.MINIMUM_BLOCK_CONFIDENCE}% - allowing`
      );
      
      return {
        allowed: true,
        reason: 'Confidence below blocking threshold'
      };
    }
    
    // Mode-specific logic
    switch (this.config.MODE) {
      case 'STRICT':
        // Block all violations
        return {
          allowed: !analysis.isViolation,
          reason: analysis.reason
        };
        
      case 'MODERATE':
        // Allow low-medium confidence violations
        if (analysis.isViolation && analysis.confidence < 80) {
          return {
            allowed: true,
            reason: 'Moderate mode - confidence below 80%'
          };
        }
        return {
          allowed: !analysis.isViolation,
          reason: analysis.reason
        };
        
      case 'LENIENT':
        // Only block high confidence violations
        if (analysis.isViolation && analysis.confidence >= 90) {
          return {
            allowed: false,
            reason: analysis.reason
          };
        }
        return {
          allowed: true,
          reason: analysis.isViolation 
            ? 'Lenient mode - confidence below 90%'
            : 'Content passed all checks'
        };
        
      default:
        this._log('WARN', `Unknown mode: ${this.config.MODE}, using STRICT`);
        return {
          allowed: !analysis.isViolation,
          reason: analysis.reason
        };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                   PUNISHMENT & VIOLATION METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get user violation history
   * @private
   */
  async _getUserHistory(userId) {
    const defaultHistory = {
      strikeCount: 0,
      totalViolations: 0,
      warningsIssued: 0,
      violations: []
    };
    
    if (!userId) {
      return defaultHistory;
    }
    
    if (!this.services.violationTracker) {
      this._log('DEBUG', 'Violation tracker not configured');
      return defaultHistory;
    }
    
    try {
      const history = await this.services.violationTracker.getUserHistory(userId);
      
      // Ensure valid structure
      return {
        strikeCount: history.strikeCount || 0,
        totalViolations: history.totalViolations || 0,
        warningsIssued: history.warningsIssued || 0,
        violations: Array.isArray(history.violations) ? history.violations : []
      };
      
    } catch (error) {
      this._log('WARN', 'Failed to get user history', { 
        error: error.message,
        userId
      });
      return defaultHistory;
    }
  }
  
  /**
   * Calculate violation severity
   * @private
   */
  async _calculateSeverity(analysis, userHistory, contentTypes) {
    if (this.services.severityCalculator) {
      try {
        const severity = await this.services.severityCalculator.calculate(
          analysis,
          userHistory,
          contentTypes
        );
        
        // Validate severity
        if (typeof severity !== 'number' || isNaN(severity)) {
          throw new Error('Invalid severity score (not a number)');
        }
        
        // Clamp to 0-100
        return Math.max(0, Math.min(100, Math.round(severity)));
        
      } catch (error) {
        this._log('WARN', 'Severity calculator failed, using fallback', { 
          error: error.message 
        });
        // Fall through to fallback
      }
    }
    
    // Fallback calculation
    let score = 0;
    
    // Factor 1: Confidence (0-10 points)
    score += Math.floor(analysis.confidence / 10);
    
    // Factor 2: User history (0-20 points)
    score += Math.min(userHistory.strikeCount * 3, 15);
    score += Math.min(userHistory.totalViolations * 1, 5);
    
    // Factor 3: Violation type (0-15 points)
    const typeScores = {
      'DIRECT_CONTACT': 15,
      'PLATFORM_BYPASS': 12,
      'HARASSMENT': 10,
      'HATE_SPEECH': 10,
      'THREATS': 12,
      'SPAM': 5,
      'INAPPROPRIATE_CONTENT': 8,
      'UNKNOWN': 5
    };
    score += typeScores[analysis.violationType] || 5;
    
    // Factor 4: Multiple content types (0-6 points)
    score += Math.min((contentTypes.length - 1) * 2, 6);
    
    // Factor 5: Evidence count (0-5 points)
    if (analysis.evidence && Array.isArray(analysis.evidence)) {
      score += Math.min(analysis.evidence.length, 5);
    }
    
    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  
  /**
   * Determine punishment based on severity and history
   * @private
   */
  async _determinePunishment(severity, userHistory, analysis) {
    if (this.services.punishmentEngine) {
      try {
        const punishment = await this.services.punishmentEngine.determine(
          severity,
          userHistory,
          analysis
        );
        
        // Validate punishment structure
        if (!punishment || !punishment.type) {
          throw new Error('Invalid punishment (missing type)');
        }
        
        return punishment;
        
      } catch (error) {
        this._log('WARN', 'Punishment engine failed, using fallback', { 
          error: error.message 
        });
        // Fall through to fallback
      }
    }
    
    // Fallback logic
    const strikes = userHistory.strikeCount || 0;
    
    // Instant ban for extreme violations
    if (severity >= this.config.INSTANT_BAN_SEVERITY) {
      return {
        type: 'PERMANENT_BAN',
        strikeLevel: 4,
        instant: true,
        reason: 'Extreme violation detected - instant permanent ban',
        appealAllowed: this.config.ENABLE_APPEAL_SYSTEM,
        appealWindow: this.config.ENABLE_APPEAL_SYSTEM ? this.config.APPEAL_WINDOW_DAYS : 0
      };
    }
    
    // 4th strike or very high severity
    if (severity >= this.config.STRIKE_4_SEVERITY || strikes >= 4) {
      return {
        type: 'PERMANENT_BAN',
        strikeLevel: 4,
        instant: false,
        reason: '4th strike reached - permanent ban',
        appealAllowed: this.config.ENABLE_APPEAL_SYSTEM,
        appealWindow: this.config.ENABLE_APPEAL_SYSTEM ? this.config.APPEAL_WINDOW_DAYS : 0
      };
    }
    
    // 3rd strike or high severity
    if (severity >= this.config.STRIKE_3_SEVERITY || strikes >= 3) {
      return {
        type: 'TEMPORARY_BAN',
        strikeLevel: 3,
        durationDays: this.config.TEMP_BAN_DAYS,
        reason: '3rd strike reached - temporary ban',
        appealAllowed: this.config.ENABLE_APPEAL_SYSTEM
      };
    }
    
    // 2nd strike or medium severity
    if (severity >= this.config.STRIKE_2_SEVERITY || strikes >= 2) {
      return {
        type: 'FINAL_WARNING',
        strikeLevel: 2,
        reason: '2nd strike reached - final warning'
      };
    }
    
    // 1st strike or low severity
    return {
      type: 'WARNING',
      strikeLevel: 1,
      reason: '1st strike - warning issued'
    };
  }
  
  /**
   * Record violation
   * @private
   */
  async _recordViolation(data) {
    if (!this.services.violationTracker) {
      this._log('DEBUG', 'Violation tracker not configured, creating minimal record');
      
      return {
        id: this._generateViolationId(),
        userId: data.userId,
        timestamp: data.timestamp || new Date(),
        recorded: false,
        ...data
      };
    }
    
    try {
      const record = await this.services.violationTracker.recordViolation(data);
      
      // Validate record
      if (!record || !record.id) {
        throw new Error('Invalid violation record (missing id)');
      }
      
      return {
        ...record,
        recorded: true
      };
      
    } catch (error) {
      this._log('ERROR', 'Failed to record violation', { 
        error: error.message,
        userId: data.userId
      });
      
      // Fallback: Create minimal record
      return {
        id: this._generateViolationId(),
        userId: data.userId,
        timestamp: data.timestamp || new Date(),
        recorded: false,
        error: error.message,
        ...data
      };
    }
  }
  
  /**
   * Execute punishment
   * @private
   */
  async _executePunishment(userId, punishment, violationRecord) {
    if (!this.services.punishmentEngine) {
      this._log('WARN', 'Punishment engine not configured');
      this._log('INFO', `Would execute ${punishment.type} for user ${userId}`);
      return { 
        success: false, 
        reason: 'Punishment engine not configured',
        executed: false
      };
    }
    
    try {
      const result = await this.services.punishmentEngine.execute(
        userId,
        punishment,
        violationRecord
      );
      
      return result || { success: true, executed: true };
      
    } catch (error) {
      this._log('ERROR', 'Failed to execute punishment', { 
        error: error.message,
        userId,
        punishmentType: punishment.type
      });
      
      // Re-throw to let caller handle
      throw error;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                     NOTIFICATION METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🔔 Send notifications (User + Admin/Staff)
   * @private
   */
  async _sendNotifications(userId, punishment, violationRecord, analysis, userHistory) {
    const results = {
      user: { sent: false, error: null },
      staff: { sent: false, error: null }
    };
    
    // ═══════════════════════════════════════════════════════════════════
    // USER NOTIFICATION
    // ═══════════════════════════════════════════════════════════════════
    
    if (this.services.userNotifier) {
      try {
        await this.services.userNotifier.notify(
          userId,
          punishment,
          violationRecord,
          analysis
        );
        
        results.user.sent = true;
        this._log('DEBUG', '✅ User notification sent', { userId });
        
      } catch (error) {
        results.user.error = error.message;
        this._log('ERROR', 'User notification failed', { 
          error: error.message,
          userId
        });
      }
    } else {
      this._log('DEBUG', 'User notifier not configured');
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // ADMIN/STAFF NOTIFICATION 👈 THIS IS THE IMPORTANT PART!
    // ═══════════════════════════════════════════════════════════════════
    
    if (this.config.ENABLE_STAFF_ALERTS && this.services.staffNotifier) {
      // Check if violation is severe enough for staff alert
      const severity = violationRecord.severity || 0;
      
      if (severity >= this.config.STAFF_ALERT_MIN_SEVERITY) {
        try {
          // Prepare detailed staff notification
          const staffNotification = {
            // Basic info
            userId,
            punishment,
            violationRecord,
            analysis,
            
            // Priority based on punishment type
            priority: this._determinePriority(punishment),
            
            // Additional context for staff
            severity,
            confidence: analysis.confidence,
            violationType: analysis.violationType,
            
            // User history (if enabled)
            userHistory: this.config.STAFF_ALERT_INCLUDE_HISTORY ? {
              strikeCount: userHistory.strikeCount,
              totalViolations: userHistory.totalViolations,
              recentViolations: userHistory.violations?.slice(0, 5) || []
            } : null,
            
            // Evidence (if enabled)
            evidence: this.config.STAFF_ALERT_INCLUDE_EVIDENCE 
              ? analysis.evidence 
              : null,
            
            // Metadata
            timestamp: new Date(),
            instanceId: this.instanceId
          };
          
          // Send to staff notification service
          await this.services.staffNotifier.notify(staffNotification);
          
          results.staff.sent = true;
          this._log('INFO', '✅ Staff notification sent', { 
            userId,
            priority: staffNotification.priority,
            severity
          });
          
        } catch (error) {
          results.staff.error = error.message;
          this._log('ERROR', 'Staff notification failed', { 
            error: error.message,
            userId
          });
        }
      } else {
        this._log('DEBUG', 'Violation severity below staff alert threshold', {
          severity,
          threshold: this.config.STAFF_ALERT_MIN_SEVERITY
        });
      }
    } else {
      if (!this.config.ENABLE_STAFF_ALERTS) {
        this._log('DEBUG', 'Staff alerts disabled in configuration');
      } else {
        this._log('DEBUG', 'Staff notifier not configured');
      }
    }
    
    return results;
  }
  
  /**
   * Determine notification priority
   * @private
   */
  _determinePriority(punishment) {
    if (!punishment) return 'LOW';
    
    // Check custom priority mapping
    if (this.config.STAFF_ALERT_PRIORITIES) {
      const priorityKey = punishment.type;
      if (this.config.STAFF_ALERT_PRIORITIES[priorityKey]) {
        return this.config.STAFF_ALERT_PRIORITIES[priorityKey];
      }
    }
    
    // Default priority logic
    if (punishment.instant) return 'CRITICAL';
    if (punishment.type === 'PERMANENT_BAN') return 'HIGH';
    if (punishment.type === 'TEMPORARY_BAN') return 'MEDIUM';
    return 'LOW';
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                        LOGGING METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Write audit log
   * @private
   */
  async _writeAuditLog(data) {
    if (!this.services.auditLogger) {
      this._log('DEBUG', 'Audit logger not configured');
      return { logged: false };
    }
    
    try {
      await this.services.auditLogger.log({
        ...data,
        instanceId: this.instanceId,
        version: this.version
      });
      
      return { logged: true };
      
    } catch (error) {
      this._log('ERROR', 'Audit log failed', { error: error.message });
      return { logged: false, error: error.message };
    }
  }
  
  /**
   * Log clean scan
   * @private
   */
  async _logCleanScan(userId, content, scanResults, scanId) {
    if (!this.services.auditLogger) {
      return { logged: false };
    }
    
    try {
      await this.services.auditLogger.logClean({
        scanId,
        userId,
        content: this._sanitizeContent(content),
        scanResults: this._sanitizeScanResults(scanResults),
        timestamp: new Date(),
        instanceId: this.instanceId
      });
      
      return { logged: true };
      
    } catch (error) {
      this._log('ERROR', 'Clean scan logging failed', { error: error.message });
      return { logged: false, error: error.message };
    }
  }
  
  /**
   * Log error
   * @private
   */
  async _logError(error, context) {
    if (!this.services.auditLogger) {
      return { logged: false };
    }
    
    try {
      await this.services.auditLogger.logError({
        error: {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: this.config.LOG_LEVEL === 'DEBUG' ? error.stack : undefined
        },
        context: this._sanitizeContext(context),
        timestamp: new Date(),
        instanceId: this.instanceId
      });
      
      return { logged: true };
      
    } catch (logError) {
      console.error('[BigBrain] Failed to log error:', logError);
      return { logged: false, error: logError.message };
    }
  }
  
  /**
   * Internal logging method
   * @private
   */
  _log(level, message, data = {}) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const configLevel = this.config.LOG_LEVEL;
    
    const levelIndex = levels.indexOf(level);
    const configLevelIndex = levels.indexOf(configLevel);
    
    // Check if we should log this level
    if (levelIndex < configLevelIndex) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [BigBrain] [${level}]`;
    
    if (Object.keys(data).length > 0) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
  
  /**
   * Log step header
   * @private
   */
  _logStep(step, description) {
    this._log('INFO', `\n📋 STEP ${step}: ${description}`);
  }
  
  /**
   * Log scan start
   * @private
   */
  _logScanStart(scanId, userId, content, context) {
    this._log('INFO', '\n═══════════════════════════════════════════════════════════');
    this._log('INFO', '🧠 BIG BRAIN: Starting moderation scan');
    this._log('INFO', '═══════════════════════════════════════════════════════════');
    this._log('INFO', `Scan ID: ${scanId}`);
    this._log('INFO', `User ID: ${userId}`);
    this._log('INFO', `Content: ${this._identifyContentTypes(content).join(', ') || 'none'}`);
    this._log('INFO', `Endpoint: ${context.endpoint || 'unknown'}`);
    this._log('INFO', `Mode: ${this.config.MODE}`);
  }
  
  /**
   * Log scan completion
   * @private
   */
  _logScanComplete(decision, scanId, scanTime) {
    this._log('INFO', '\n═══════════════════════════════════════════════════════════');
    this._log('INFO', '🧠 BIG BRAIN: Moderation scan complete');
    this._log('INFO', '═══════════════════════════════════════════════════════════');
    this._log('INFO', `Scan ID: ${scanId}`);
    this._log('INFO', `Decision: ${decision}`);
    this._log('INFO', `Scan time: ${scanTime}ms`);
    this._log('INFO', `Total scans: ${this.state.totalScans}`);
    this._log('INFO', `Blocked: ${this.state.blockedScans}`);
    this._log('INFO', `Allowed: ${this.state.allowedScans}`);
    this._log('INFO', '═══════════════════════════════════════════════════════════\n');
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                      SANITIZATION METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Mask sensitive data for logging
   * @private
   */
  _maskSensitiveData(value) {
    if (!value) return value;
    
    const str = String(value);
    
    // Don't log sensitive data at all if configured
    if (!this.config.LOG_SENSITIVE_DATA) {
      return '[REDACTED]';
    }
    
    // Phone numbers
    if (/^\+?\d{10,}$/.test(str)) {
      return str.substring(0, 3) + '****' + str.substring(str.length - 2);
    }
    
    // Emails
    if (/@/.test(str)) {
      const [local, domain] = str.split('@');
      const maskedLocal = local.length > 2 
        ? local.substring(0, 2) + '****'
        : '****';
      return `${maskedLocal}@${domain}`;
    }
    
    // URLs
    if (/^https?:\/\//.test(str)) {
      try {
        const url = new URL(str);
        return `${url.protocol}//${url.hostname}/****`;
      } catch {
        return '[URL]';
      }
    }
    
    // Social media handles
    if (/^@[\w]+$/.test(str)) {
      return '@****';
    }
    
    // Generic masking
    if (str.length > 6) {
      return str.substring(0, 3) + '****' + str.substring(str.length - 2);
    }
    
    return '****';
  }
  
  /**
   * Sanitize content for logging
   * @private
   */
  _sanitizeContent(content) {
    if (!content) return {};
    
    const sanitized = {
      hasText: !!content.text,
      textLength: content.text ? content.text.length : 0,
      hasImage: !!content.image,
      imageSize: content.image ? this._getFileSize(content.image) : 0,
      hasVideo: !!content.video,
      videoSize: content.video ? this._getFileSize(content.video) : 0,
      hasAudio: !!content.audio,
      audioSize: content.audio ? this._getFileSize(content.audio) : 0
    };
    
    // Include text preview in debug mode only
    if (content.text && this.config.LOG_LEVEL === 'DEBUG') {
      sanitized.textPreview = content.text.substring(0, 100) +
        (content.text.length > 100 ? '...' : '');
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize context for logging
   * @private
   */
  _sanitizeContext(context) {
    if (!context) return {};
    
    const sanitized = {};
    
    // Safe fields to include
    const safeFields = ['endpoint', 'method', 'userAgent', 'scanId'];
    for (const field of safeFields) {
      if (context[field] !== undefined) {
        sanitized[field] = context[field];
      }
    }
    
    // Mask IP address
    if (context.ip) {
      sanitized.ip = this._maskIP(context.ip);
    }
    
    // Include metadata if present
    if (context.metadata) {
      sanitized.metadata = this._sanitizeMetadata(context.metadata);
    }
    
    return sanitized;
  }
  
  /**
   * Mask IP address
   * @private
   */
  _maskIP(ip) {
    if (!ip || typeof ip !== 'string') return null;
    
    // IPv4
    if (ip.includes('.') && !ip.includes(':')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.**`;
      }
    }
    
    // IPv6
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}:****:****:****:****:****:****`;
      }
    }
    
    return '***.***.***.**';
  }
  
  /**
   * Sanitize metadata
   * @private
   */
  _sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return {};
    
    const sanitized = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    
    for (const [key, value] of Object.entries(metadata)) {
      // Check if key is sensitive
      const isSensitive = sensitiveKeys.some(sk => 
        key.toLowerCase().includes(sk)
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this._sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize scan results for response
   * @private
   */
  _sanitizeScanResults(scanResults) {
    if (!Array.isArray(scanResults)) return [];
    
    return scanResults.map(result => ({
      scanner: result.scanner,
      type: result.type,
      error: result.error || false,
      isClean: result.isClean,
      confidence: result.confidence,
      hasViolations: !!(result.violations && Array.isArray(result.violations) && result.violations.length > 0),
      errorMessage: result.errorMessage,
      timestamp: result.timestamp
    }));
  }
  
  /**
   * Sanitize punishment for response
   * @private
   */
  _sanitizePunishment(punishment) {
    if (!punishment) return null;
    
    return {
      type: punishment.type,
      strikeLevel: punishment.strikeLevel,
      reason: punishment.reason,
      durationDays: punishment.durationDays,
      appealAllowed: punishment.appealAllowed || false,
      appealWindow: punishment.appealWindow || 0,
      instant: punishment.instant || false
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                       RESPONSE CREATION METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Create final response object
   * @private
   */
  _createFinalResponse(data) {
    const response = {
      // Metadata
      timestamp: new Date(),
      scanId: data.scanId,
      bigBrainVersion: this.version,
      instanceId: this.instanceId,
      mode: this.config.MODE,
      
      // Decision
      allowed: data.allowed,
      blocked: data.blocked || false,
      reason: data.reason,
      
      // Optional fields
      ...data,
      
      // Performance
      scanTime: data.scanTime
    };
    
    // Remove undefined fields
    Object.keys(response).forEach(key => {
      if (response[key] === undefined) {
        delete response[key];
      }
    });
    
    return response;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                       METRICS & STATE METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Update performance metrics
   * @private
   */
  _updateMetrics(scanTime) {
    // Add to circular buffer
    if (this.metrics.scanTimes.length >= this.config.METRICS_BUFFER_SIZE) {
      // Use slice to avoid O(n) shift operation
      this.metrics.scanTimes = this.metrics.scanTimes.slice(
        -Math.floor(this.config.METRICS_BUFFER_SIZE * 0.9)
      );
    }
    
    this.metrics.scanTimes.push(scanTime);
    
    // Calculate average
    const sum = this.metrics.scanTimes.reduce((a, b) => a + b, 0);
    this.metrics.avgScanTime = sum / this.metrics.scanTimes.length;
    
    // Update min/max
    this.metrics.maxScanTime = Math.max(this.metrics.maxScanTime, scanTime);
    this.metrics.minScanTime = Math.min(this.metrics.minScanTime, scanTime);
    
    // Calculate percentiles (only if enough data)
    if (this.metrics.scanTimes.length >= 20) {
      const sorted = [...this.metrics.scanTimes].sort((a, b) => a - b);
      
      const p50Index = Math.floor(sorted.length * 0.50);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);
      
      this.metrics.p50ScanTime = sorted[p50Index];
      this.metrics.p95ScanTime = sorted[p95Index];
      this.metrics.p99ScanTime = sorted[p99Index];
    }
    
    this.metrics.lastUpdated = Date.now();
    
    // Auto-restore health if configured
    if (this.config.HEALTH_AUTO_RECOVER && !this.state.isHealthy) {
      const errorRate = this.state.totalScans > 0
        ? this.state.errorCount / this.state.totalScans
        : 0;
      
      if (errorRate < this.config.ERROR_RATE_THRESHOLD) {
        this.state.isHealthy = true;
        this.state.consecutiveErrors = 0;
        this._log('INFO', '✅ System health auto-recovered');
      }
    }
  }
  
  /**
   * Record successful scan
   * @private
   */
  _recordSuccess() {
    this.state.consecutiveErrors = 0;
    this.state.consecutiveSuccesses++;
    
    // Auto-restore health after consecutive successes
    if (!this.state.isHealthy && 
        this.state.consecutiveSuccesses >= 5 &&
        this.config.HEALTH_AUTO_RECOVER) {
      this.state.isHealthy = true;
      this._log('INFO', '✅ System health restored after 5 consecutive successes');
    }
  }
  
  /**
   * Record error
   * @private
   */
  _recordError(error) {
    this.state.errorCount++;
    this.state.lastError = error;
    this.state.lastErrorTime = new Date();
    this.state.consecutiveErrors++;
    this.state.consecutiveSuccesses = 0;
    
    // Check error rate
    const errorRate = this.state.totalScans > 0
      ? this.state.errorCount / this.state.totalScans
      : 0;
    
    // Mark unhealthy if error rate is high or too many consecutive errors
    if (errorRate > this.config.ERROR_RATE_THRESHOLD || 
        this.state.consecutiveErrors >= 3) {
      if (this.state.isHealthy) {
        this.state.isHealthy = false;
        this._log('WARN', '⚠️ System marked as unhealthy', {
          errorRate: `${(errorRate * 100).toFixed(2)}%`,
          consecutiveErrors: this.state.consecutiveErrors
        });
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                       UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Generate unique instance ID
   * @private
   */
  _generateInstanceId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `bb_${timestamp}_${random}`;
  }
  
  /**
   * Generate unique scan ID
   * @private
   */
  _generateScanId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `scan_${timestamp}_${random}`;
  }
  
  /**
   * Generate unique violation ID
   * @private
   */
  _generateViolationId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `vio_${timestamp}_${random}`;
  }
  
  /**
   * Get required scanner methods for a scanner type
   * @private
   */
  _getRequiredScannerMethods(type) {
    const methodMap = {
      'text': ['scan'],
      'image': ['scanImage'],
      'video': ['scanVideo'],
      'audio': ['scanAudio'],
      'ai': ['scanMultiModal']
    };
    
    return methodMap[type] || [];
  }
  
  /**
   * Get configuration changes between two config objects
   * @private
   */
  _getConfigChanges(before, after) {
    const changes = {};
    
    for (const key of Object.keys(after)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = {
          before: before[key],
          after: after[key]
        };
      }
    }
    
    return changes;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  //                       PUBLIC API METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get system status
   * @returns {Object} Current system status
   */
  getStatus() {
    const errorRate = this.state.totalScans > 0
      ? ((this.state.errorCount / this.state.totalScans) * 100).toFixed(2) + '%'
      : '0%';
    
    const blockRate = this.state.totalScans > 0
      ? ((this.state.blockedScans / this.state.totalScans) * 100).toFixed(2) + '%'
      : '0%';
    
    return {
      version: this.version,
      buildDate: this.buildDate,
      instanceId: this.instanceId,
      mode: this.config.MODE,
      ready: this.isReady(),
      healthy: this.state.isHealthy,
      uptime: Date.now() - this.state.startTime,
      
      scanners: {
        registered: Array.from(this.scanners.entries())
          .filter(([_, scanner]) => scanner !== null)
          .map(([type]) => type),
        total: Array.from(this.scanners.values()).filter(s => s !== null).length,
        available: Array.from(this.scanners.keys())
      },
      
      services: {
        configured: Object.entries(this.services)
          .filter(([_, service]) => service !== null)
          .map(([name]) => name),
        available: Object.keys(this.services)
      },
      
      stats: {
        totalScans: this.state.totalScans,
        blockedScans: this.state.blockedScans,
        allowedScans: this.state.allowedScans,
        errorCount: this.state.errorCount,
        blockRate,
        errorRate,
        consecutiveErrors: this.state.consecutiveErrors,
        consecutiveSuccesses: this.state.consecutiveSuccesses
      },
      
      performance: {
        avgScanTime: Math.round(this.metrics.avgScanTime) + 'ms',
        minScanTime: this.metrics.minScanTime === Infinity 
          ? '0ms' 
          : Math.round(this.metrics.minScanTime) + 'ms',
        maxScanTime: Math.round(this.metrics.maxScanTime) + 'ms',
        p50ScanTime: Math.round(this.metrics.p50ScanTime) + 'ms',
        p95ScanTime: Math.round(this.metrics.p95ScanTime) + 'ms',
        p99ScanTime: Math.round(this.metrics.p99ScanTime) + 'ms',
        sampleSize: this.metrics.scanTimes.length,
        lastUpdated: new Date(this.metrics.lastUpdated)
      },
      
      lastError: this.state.lastError ? {
        message: this.state.lastError.message,
        type: this.state.lastError.name,
        time: this.state.lastErrorTime
      } : null
    };
  }
  
  /**
   * Check if system is ready
   * @returns {Boolean} True if at least one scanner is registered
   */
  isReady() {
    return Array.from(this.scanners.values()).some(s => s !== null);
  }
  
  /**
   * Get current configuration (returns copy)
   * @returns {Object} Configuration object
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Get current metrics (returns copy)
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      avgScanTime: this.metrics.avgScanTime,
      minScanTime: this.metrics.minScanTime === Infinity ? 0 : this.metrics.minScanTime,
      maxScanTime: this.metrics.maxScanTime,
      p50ScanTime: this.metrics.p50ScanTime,
      p95ScanTime: this.metrics.p95ScanTime,
      p99ScanTime: this.metrics.p99ScanTime,
      sampleCount: this.metrics.scanTimes.length,
      lastUpdated: new Date(this.metrics.lastUpdated)
    };
  }
  
  /**
   * Perform health check
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    const errors = [];
    const warnings = [];
    
    // Check if scanners are registered
    if (!this.isReady()) {
      errors.push('No scanners registered');
    }
    
    // Check error rate
    const errorRate = this.state.totalScans > 0
      ? this.state.errorCount / this.state.totalScans
      : 0;
    
    if (errorRate > this.config.ERROR_RATE_THRESHOLD) {
      errors.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    } else if (errorRate > this.config.ERROR_RATE_THRESHOLD * 0.5) {
      warnings.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    // Check consecutive errors
    if (this.state.consecutiveErrors >= 3) {
      errors.push(`${this.state.consecutiveErrors} consecutive errors detected`);
    } else if (this.state.consecutiveErrors >= 2) {
      warnings.push(`${this.state.consecutiveErrors} consecutive errors detected`);
    }
    
    // Check if shutting down
    if (this.state.isShuttingDown) {
      warnings.push('System is shutting down');
    }
    
    // Check for missing services (warnings only)
    const missingServices = Object.entries(this.services)
      .filter(([_, service]) => service === null)
      .map(([name]) => name);
    
    if (missingServices.length > 0) {
      warnings.push(`Services not configured: ${missingServices.join(', ')}`);
    }
    
    // Auto-restore health if conditions are met
    if (errors.length === 0 && 
        !this.state.isHealthy && 
        this.config.HEALTH_AUTO_RECOVER) {
      this.state.isHealthy = true;
      this.state.consecutiveErrors = 0;
      this._log('INFO', '✅ System health restored via health check');
    }
    
    const isHealthy = errors.length === 0;
    
    return {
      healthy: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      errors,
      warnings,
      uptime: Date.now() - this.state.startTime,
      timestamp: new Date(),
      checks: {
        scannersRegistered: this.isReady(),
        errorRateAcceptable: errorRate <= this.config.ERROR_RATE_THRESHOLD,
        noConsecutiveErrors: this.state.consecutiveErrors < 3,
        notShuttingDown: !this.state.isShuttingDown
      }
    };
  }
  
  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.state.totalScans = 0;
    this.state.blockedScans = 0;
    this.state.allowedScans = 0;
    this.state.errorCount = 0;
    this.state.consecutiveErrors = 0;
    this.state.consecutiveSuccesses = 0;
    
    this.metrics.scanTimes = [];
    this.metrics.avgScanTime = 0;
    this.metrics.maxScanTime = 0;
    this.metrics.minScanTime = Infinity;
    this.metrics.p50ScanTime = 0;
    this.metrics.p95ScanTime = 0;
    this.metrics.p99ScanTime = 0;
    this.metrics.lastUpdated = Date.now();
    
    this._log('INFO', '📊 Metrics reset successfully');
  }
  
  /**
   * Graceful shutdown
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.state.isShuttingDown) {
      this._log('WARN', 'Shutdown already in progress');
      return;
    }
    
    this.state.isShuttingDown = true;
    this._log('INFO', '🛑 BigBrain initiating graceful shutdown...');
    
    // Create shutdown timeout
    const shutdownTimeout = new Promise((resolve) => {
      setTimeout(() => {
        this._log('WARN', 'Shutdown timeout reached, forcing shutdown');
        resolve();
      }, this.config.SHUTDOWN_TIMEOUT_MS);
    });
    
    // Shutdown tasks
    const shutdownTasks = (async () => {
      // Clear all active timeouts
      this._log('INFO', `Clearing ${this.activeTimeouts.size} active timeouts...`);
      for (const timeoutId of this.activeTimeouts) {
        clearTimeout(timeoutId);
      }
      this.activeTimeouts.clear();
      
      // Shutdown services
      for (const [name, service] of Object.entries(this.services)) {
        if (service && typeof service.shutdown === 'function') {
          try {
            this._log('INFO', `Shutting down ${name} service...`);
            await service.shutdown();
            this._log('INFO', `✅ ${name} service shut down successfully`);
          } catch (error) {
            this._log('ERROR', `Failed to shutdown ${name}`, { 
              error: error.message 
            });
          }
        }
      }
      
      // Shutdown scanners (if they have shutdown methods)
      for (const [type, scanner] of this.scanners.entries()) {
        if (scanner && typeof scanner.shutdown === 'function') {
          try {
            this._log('INFO', `Shutting down ${type} scanner...`);
            await scanner.shutdown();
            this._log('INFO', `✅ ${type} scanner shut down successfully`);
          } catch (error) {
            this._log('ERROR', `Failed to shutdown ${type} scanner`, { 
              error: error.message 
            });
          }
        }
      }
    })();
    
    // Wait for shutdown tasks or timeout
    await Promise.race([shutdownTasks, shutdownTimeout]);
    
    this._log('INFO', '✅ BigBrain shutdown complete', {
      totalScans: this.state.totalScans,
      uptime: Date.now() - this.state.startTime
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//                               EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default BigBrain;

// Named export for CommonJS compatibility
export { BigBrain };