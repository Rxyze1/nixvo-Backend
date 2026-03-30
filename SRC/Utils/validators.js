// Utils/validators.js

import { logger } from './logger.js';

// ─────────────────────────────────────────────────────────────
// ERROR CLASS
// ─────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.statusCode = 400;
  }
}

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE VALIDATION
// ─────────────────────────────────────────────────────────────

/**
 * Validate required environment variables exist
 * @param {string[]} requiredVars - Array of required env var names
 * @throws {Error} If any required variable is missing
 */
export const validateEnvVars = (requiredVars) => {
  const missing = requiredVars.filter((varName) => {
    const value = process.env[varName];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info('Environment variables validated', {
    count: requiredVars.length,
  });
};

/**
 * Validate environment with schema
 * @param {Object} schema - Validation schema {varName: {type, required, default}}
 * @returns {Object} Validated env object
 */
export const validateEnv = (schema) => {
  const validated = {};
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = process.env[key];

    // Check required
    if (rules.required && !value) {
      errors.push(`${key} is required`);
      continue;
    }

    // Use default if not provided
    if (!value && rules.default !== undefined) {
      validated[key] = rules.default;
      continue;
    }

    // Validate type
    if (value && rules.type) {
      const actualType = typeof value;
      let valid = false;

      switch (rules.type) {
        case 'string':
          valid = actualType === 'string';
          break;
        case 'number':
          valid = !isNaN(Number(value));
          validated[key] = Number(value);
          break;
        case 'boolean':
          valid =
            value === 'true' ||
            value === 'false' ||
            value === '1' ||
            value === '0';
          validated[key] = value === 'true' || value === '1';
          break;
        case 'array':
          valid = Array.isArray(value) || typeof value === 'string';
          validated[key] = typeof value === 'string' ? value.split(',') : value;
          break;
        default:
          valid = true;
      }

      if (!valid) {
        errors.push(`${key} must be of type ${rules.type}, got ${actualType}`);
        continue;
      }
    }

    if (value) {
      validated[key] =
        rules.type === 'number' && !isNaN(Number(value))
          ? Number(value)
          : rules.type === 'boolean'
            ? value === 'true' || value === '1'
            : value;
    }
  }

  if (errors.length > 0) {
    const errorMsg = `Environment validation failed:\n${errors.join('\n')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  return validated;
};

// ─────────────────────────────────────────────────────────────
// STRING VALIDATORS
// ─────────────────────────────────────────────────────────────

/**
 * Validate email address
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required and must be a string', 'email', email);
  }

  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'email', email);
  }

  if (email.length > 254) {
    throw new ValidationError('Email is too long (max 254 characters)', 'email', email);
  }

  return email.toLowerCase();
};

/**
 * Validate phone number (Indian format)
 */
export const validatePhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;

  if (!phone || typeof phone !== 'string') {
    throw new ValidationError(
      'Phone number is required and must be a string',
      'phone',
      phone
    );
  }

  const cleaned = phone.replace(/\D/g, '');

  if (!phoneRegex.test(cleaned)) {
    throw new ValidationError(
      'Invalid phone number (must be 10 digits starting with 6-9)',
      'phone',
      phone
    );
  }

  return cleaned;
};

/**
 * Validate UPI ID
 */
export const validateUpiId = (upiId) => {
  const upiRegex = /^[a-zA-Z0-9._-]{3,}@[a-zA-Z]{2,}$/;

  if (!upiId || typeof upiId !== 'string') {
    throw new ValidationError('UPI ID is required and must be a string', 'upiId', upiId);
  }

  if (!upiRegex.test(upiId)) {
    throw new ValidationError('Invalid UPI ID format', 'upiId', upiId);
  }

  return upiId.toLowerCase();
};

/**
 * Validate bank account number
 */
export const validateBankAccountNumber = (accountNumber) => {
  const accountRegex = /^\d{9,18}$/;

  if (!accountNumber || typeof accountNumber !== 'string') {
    throw new ValidationError(
      'Bank account number is required',
      'accountNumber',
      accountNumber
    );
  }

  const cleaned = accountNumber.replace(/\s/g, '');

  if (!accountRegex.test(cleaned)) {
    throw new ValidationError(
      'Invalid bank account number (9-18 digits)',
      'accountNumber',
      accountNumber
    );
  }

  return cleaned;
};

/**
 * Validate IFSC code (Indian bank code)
 */
export const validateIfsc = (ifsc) => {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

  if (!ifsc || typeof ifsc !== 'string') {
    throw new ValidationError('IFSC code is required', 'ifsc', ifsc);
  }

  const uppercase = ifsc.toUpperCase().trim();

  if (!ifscRegex.test(uppercase)) {
    throw new ValidationError(
      'Invalid IFSC code format (e.g., SBIN0001234)',
      'ifsc',
      ifsc
    );
  }

  return uppercase;
};

/**
 * Validate PAN (Permanent Account Number)
 */
export const validatePan = (pan) => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  if (!pan || typeof pan !== 'string') {
    throw new ValidationError('PAN is required', 'pan', pan);
  }

  const uppercase = pan.toUpperCase().trim();

  if (!panRegex.test(uppercase)) {
    throw new ValidationError(
      'Invalid PAN format (e.g., AAAAA1234A)',
      'pan',
      pan
    );
  }

  return uppercase;
};

/**
 * Validate Aadhar number
 */
export const validateAadhar = (aadhar) => {
  const aadharRegex = /^\d{12}$/;

  if (!aadhar || typeof aadhar !== 'string') {
    throw new ValidationError('Aadhar number is required', 'aadhar', aadhar);
  }

  const cleaned = aadhar.replace(/\s/g, '');

  if (!aadharRegex.test(cleaned)) {
    throw new ValidationError(
      'Invalid Aadhar number (12 digits)',
      'aadhar',
      aadhar
    );
  }

  return cleaned;
};

/**
 * Validate URL
 */
export const validateUrl = (url) => {
  try {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('URL is required', 'url', url);
    }

    new URL(url);
    return url;
  } catch (err) {
    throw new ValidationError('Invalid URL format', 'url', url);
  }
};

/**
 * Validate password strength
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true,
  } = options;

  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letter');
  }

  if (requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain number');
  }

  if (requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain special character');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '), 'password');
  }

  return password;
};

// ─────────────────────────────────────────────────────────────
// NUMBER VALIDATORS
// ─────────────────────────────────────────────────────────────

/**
 * Validate amount (currency)
 */
export const validateAmount = (amount, options = {}) => {
  const { min = 0, max = Infinity, allowDecimal = false, field = 'amount' } =
    options;

  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new ValidationError(
      `${field} must be a valid number`,
      field,
      amount
    );
  }

  if (!allowDecimal && !Number.isInteger(amount)) {
    throw new ValidationError(
      `${field} must be an integer`,
      field,
      amount
    );
  }

  if (amount < min) {
    throw new ValidationError(
      `${field} must be at least ${min}`,
      field,
      amount
    );
  }

  if (amount > max) {
    throw new ValidationError(
      `${field} must not exceed ${max}`,
      field,
      amount
    );
  }

  return amount;
};

/**
 * Validate percentage
 */
export const validatePercentage = (percentage) => {
  return validateAmount(percentage, {
    min: 0,
    max: 100,
    allowDecimal: true,
    field: 'percentage',
  });
};

/**
 * Validate integer ID
 */
export const validateId = (id, field = 'id') => {
  if (
    typeof id !== 'string' &&
    typeof id !== 'number' &&
    id.toString === undefined
  ) {
    throw new ValidationError(`${field} must be a valid identifier`, field, id);
  }

  const idStr = id.toString().trim();

  if (idStr.length === 0) {
    throw new ValidationError(`${field} cannot be empty`, field, id);
  }

  // MongoDB ObjectId format
  if (!/^[a-f0-9]{24}$/.test(idStr) && !/^\d+$/.test(idStr)) {
    throw new ValidationError(`${field} format is invalid`, field, id);
  }

  return idStr;
};

// ─────────────────────────────────────────────────────────────
// OBJECT/ARRAY VALIDATORS
// ─────────────────────────────────────────────────────────────

/**
 * Validate object against schema
 */
export const validateObject = (obj, schema) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new ValidationError('Input must be a valid object');
  }

  const errors = {};
  const validated = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = obj[key];

    try {
      // Check required
      if (rules.required && (value === undefined || value === null)) {
        throw new ValidationError(`${key} is required`, key);
      }

      // Skip if not required and missing
      if (!rules.required && (value === undefined || value === null)) {
        if (rules.default !== undefined) {
          validated[key] = rules.default;
        }
        continue;
      }

      // Apply custom validator if provided
      if (rules.validate && typeof rules.validate === 'function') {
        validated[key] = rules.validate(value);
      } else {
        validated[key] = value;
      }
    } catch (err) {
      errors[key] = err.message;
    }
  }

  if (Object.keys(errors).length > 0) {
    const err = new ValidationError('Object validation failed');
    err.errors = errors;
    throw err;
  }

  return validated;
};

/**
 * Validate array
 */
export const validateArray = (arr, options = {}) => {
  const { minLength = 0, maxLength = Infinity, itemValidator = null } = options;

  if (!Array.isArray(arr)) {
    throw new ValidationError('Input must be an array');
  }

  if (arr.length < minLength) {
    throw new ValidationError(`Array must have at least ${minLength} items`);
  }

  if (arr.length > maxLength) {
    throw new ValidationError(`Array must not exceed ${maxLength} items`);
  }

  if (itemValidator) {
    return arr.map((item, index) => {
      try {
        return itemValidator(item);
      } catch (err) {
        throw new ValidationError(`Item ${index}: ${err.message}`);
      }
    });
  }

  return arr;
};

/**
 * Validate enum value
 */
export const validateEnum = (value, allowedValues, field = 'value') => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${field} must be one of: ${allowedValues.join(', ')}`,
      field,
      value
    );
  }

  return value;
};

// ─────────────────────────────────────────────────────────────
// BUSINESS LOGIC VALIDATORS
// ─────────────────────────────────────────────────────────────

/**
 * Validate bank details object
 */
export const validateBankDetails = (bankDetails) => {
  if (!bankDetails || typeof bankDetails !== 'object') {
    throw new ValidationError('Bank details must be a valid object');
  }

  return {
    accountNumber: validateBankAccountNumber(bankDetails.accountNumber),
    ifsc: validateIfsc(bankDetails.ifsc),
    accountHolderName: validateName(bankDetails.accountHolderName),
  };
};

/**
 * Validate person name
 */
export const validateName = (name, field = 'name') => {
  if (!name || typeof name !== 'string') {
    throw new ValidationError(`${field} is required`, field, name);
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    throw new ValidationError(`${field} must be at least 2 characters`, field, name);
  }

  if (trimmed.length > 100) {
    throw new ValidationError(
      `${field} must not exceed 100 characters`,
      field,
      name
    );
  }

  if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) {
    throw new ValidationError(
      `${field} contains invalid characters`,
      field,
      name
    );
  }

  return trimmed;
};

/**
 * Validate date range
 */
export const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    throw new ValidationError('Invalid start date', 'startDate', startDate);
  }

  if (isNaN(end.getTime())) {
    throw new ValidationError('Invalid end date', 'endDate', endDate);
  }

  if (start > end) {
    throw new ValidationError('Start date must be before end date');
  }

  return { start, end };
};

/**
 * Validate date is not in past
 */
export const validateFutureDate = (date, field = 'date') => {
  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    throw new ValidationError(`Invalid ${field}`, field, date);
  }

  if (dateObj < new Date()) {
    throw new ValidationError(`${field} cannot be in the past`, field, date);
  }

  return dateObj;
};

// ─────────────────────────────────────────────────────────────
// UTILITY VALIDATORS
// ─────────────────────────────────────────────────────────────

/**
 * Validate all inputs exist and are not empty
 */
export const validateRequired = (...values) => {
  const missing = values.filter(
    (val) => val === undefined || val === null || val === ''
  );

  if (missing.length > 0) {
    throw new ValidationError('Some required fields are missing');
  }

  return true;
};

/**
 * Validate input matches pattern
 */
export const validatePattern = (value, pattern, field = 'value') => {
  if (!pattern.test(value)) {
    throw new ValidationError(`${field} format is invalid`, field, value);
  }

  return value;
};

/**
 * Batch validate multiple fields
 */
export const validateBatch = (data, validations) => {
  const errors = {};
  const validated = {};

  for (const [field, validator] of Object.entries(validations)) {
    try {
      validated[field] = validator(data[field]);
    } catch (err) {
      errors[field] = err.message;
    }
  }

  if (Object.keys(errors).length > 0) {
    const err = new ValidationError('Batch validation failed');
    err.errors = errors;
    logger.warn('Batch validation failed', { errors });
    throw err;
  }

  return validated;
};

export default {
  validateEnvVars,
  validateEnv,
  validateEmail,
  validatePhone,
  validateUpiId,
  validateBankAccountNumber,
  validateIfsc,
  validateAmount,
  validatePassword,
  validateId,
  validateObject,
  validateArray,
  validateEnum,
  ValidationError,
};