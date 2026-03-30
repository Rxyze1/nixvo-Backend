// Utils/logger.js

import pino from 'pino';
import pinoHttp from 'pino-http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

// ─────────────────────────────────────────────────────────────
// CUSTOM SERIALIZERS
// ─────────────────────────────────────────────────────────────

const serializers = {
  /**
   * Serialize error objects with stack trace
   */
  err: (err) => {
    if (!err) return null;

    return {
      type: err.name || 'Error',
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: isDev ? err.stack : undefined,
      details: err.details,
    };
  },

  /**
   * Serialize request objects (safe subset)
   */
  req: (req) => {
    if (!req) return null;

    return {
      method: req.method,
      url: req.url,
      path: req.path,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      requestId: req.id,
    };
  },

  /**
   * Serialize response objects
   */
  res: (res) => {
    if (!res) return null;

    return {
      statusCode: res.statusCode,
      responseTime: res.responseTime,
    };
  },
};

// ─────────────────────────────────────────────────────────────
// PINO CONFIGURATION
// ─────────────────────────────────────────────────────────────

let pinoConfig;

if (isTest) {
  // Silent logger for tests
  pinoConfig = {
    level: 'silent',
  };
} else if (isDev) {
  // Pretty print for development
  pinoConfig = {
    level: process.env.LOG_LEVEL || 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: false,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        sinks: ['stdout'],
      },
    },
    serializers,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
      bindings: (bindings) => {
        return {};
      },
    },
  };
} else {
  // JSON format for production
  pinoConfig = {
    level: process.env.LOG_LEVEL || 'info',
    serializers,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    base: {
      service: process.env.SERVICE_NAME || 'payment-service',
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '1.0.0',
    },
  };
}

// ─────────────────────────────────────────────────────────────
// CREATE LOGGER INSTANCE
// ─────────────────────────────────────────────────────────────

const logger = pino(pinoConfig);

// ─────────────────────────────────────────────────────────────
// HTTP REQUEST LOGGER MIDDLEWARE
// ─────────────────────────────────────────────────────────────

export const httpLogger = pinoHttp({
  logger,
  serializers,
  customSuccessMessage: (req, res) => {
    if (req.path === '/health') return null; // Skip health checks
    return `${req.method} ${req.path} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.path} - ${res.statusCode} - ${err.message}`;
  },
  quietReqLogger: false,
  autoLogging: {
    ignorePaths: ['/health', '/metrics'],
  },
  wantFulfilledPipeline: true,
});

// ─────────────────────────────────────────────────────────────
// LOGGER CONTEXT (for request-scoped data)
// ─────────────────────────────────────────────────────────────

class LoggerContext {
  constructor(requestId = null) {
    this.requestId = requestId || this.generateRequestId();
    this.metadata = {};
    this.startTime = Date.now();
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add metadata to context
   */
  addMeta(key, value) {
    this.metadata[key] = value;
    return this;
  }

  /**
   * Get all metadata
   */
  getMeta() {
    return {
      requestId: this.requestId,
      duration: Date.now() - this.startTime,
      ...this.metadata,
    };
  }

  /**
   * Log with context
   */
  log(level, message, data = {}) {
    const logData = {
      ...this.getMeta(),
      ...data,
    };

    logger[level](logData, message);
  }
}

// ─────────────────────────────────────────────────────────────
// ENHANCED LOGGER METHODS
// ─────────────────────────────────────────────────────────────

/**
 * Log info with consistent formatting
 */
logger.logInfo = (message, data = {}) => {
  logger.info(
    {
      timestamp: new Date().toISOString(),
      ...data,
    },
    message
  );
};

/**
 * Log warning with consistent formatting
 */
logger.logWarn = (message, data = {}) => {
  logger.warn(
    {
      timestamp: new Date().toISOString(),
      ...data,
    },
    message
  );
};

/**
 * Log error with consistent formatting
 */
logger.logError = (message, err, data = {}) => {
  logger.error(
    {
      timestamp: new Date().toISOString(),
      error: err,
      ...data,
    },
    message
  );
};

/**
 * Log debug with consistent formatting
 */
logger.logDebug = (message, data = {}) => {
  if (isDev || process.env.LOG_LEVEL === 'debug') {
    logger.debug(
      {
        timestamp: new Date().toISOString(),
        ...data,
      },
      message
    );
  }
};

/**
 * Log performance metrics
 */
logger.logPerformance = (operationName, duration, data = {}) => {
  const level = duration > 5000 ? 'warn' : 'info';
  logger[level](
    {
      operation: operationName,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...data,
    },
    `Operation completed: ${operationName}`
  );
};

/**
 * Log database operation
 */
logger.logDbOperation = (operation, collection, duration, data = {}) => {
  logger.debug(
    {
      type: 'database',
      operation,
      collection,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...data,
    },
    `DB ${operation} on ${collection}`
  );
};

/**
 * Log API call
 */
logger.logApiCall = (method, url, statusCode, duration, data = {}) => {
  const level = statusCode >= 400 ? 'warn' : 'debug';
  logger[level](
    {
      type: 'api_call',
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...data,
    },
    `API ${method} ${url} - ${statusCode}`
  );
};

/**
 * Log payment transaction
 */
logger.logPayment = (type, amount, status, data = {}) => {
  logger.info(
    {
      type: 'payment',
      transactionType: type,
      amount,
      status,
      timestamp: new Date().toISOString(),
      ...data,
    },
    `Payment ${type}: ₹${amount} - ${status}`
  );
};

/**
 * Log security event
 */
logger.logSecurityEvent = (event, severity = 'medium', data = {}) => {
  const level = severity === 'critical' ? 'error' : 'warn';
  logger[level](
    {
      type: 'security',
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...data,
    },
    `SECURITY: ${event}`
  );
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export { logger, LoggerContext };