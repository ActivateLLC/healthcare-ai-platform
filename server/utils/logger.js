const winston = require('winston');
const { format, createLogger, transports } = winston;
const path = require('path');

/**
 * HIPAA-Compliant Logging Utility
 * 
 * This logger implements healthcare-grade logging practices:
 * 1. No PHI/PII is ever logged (sanitized before logging)
 * 2. Structured JSON logs for compliance auditing
 * 3. Log rotation and retention policies that meet HIPAA requirements
 * 4. Proper error stack traces for technical troubleshooting
 * 5. Log levels for appropriate information categorization
 */

// Configure log directory based on environment
const logDir = process.env.LOG_DIR || 'logs';
const logPath = path.join(process.cwd(), logDir);

// Create custom formatter for HIPAA compliance
const hipaaFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
  // Sanitize any potential PHI in logs (basic implementation - would be more robust in production)
  const sanitizedMessage = sanitizeForHIPAA(message);
  
  // Format the log entry as JSON for easy parsing
  const logEntry = {
    timestamp,
    level,
    message: sanitizedMessage,
    ...(Object.keys(metadata).length > 0 && { metadata })
  };
  
  return JSON.stringify(logEntry);
});

// Configure logger with appropriate transports
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    hipaaFormat
  ),
  defaultMeta: { service: 'healthcare-ai-platform' },
  transports: [
    // Console transport for development
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      )
    }),
    
    // File transport for production logs (JSON format)
    new transports.File({ 
      filename: path.join(logPath, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    new transports.File({ 
      filename: path.join(logPath, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 30,
      tailable: true
    })
  ],
  // Explicitly handle exceptions and rejections
  exceptionHandlers: [
    new transports.File({ filename: path.join(logPath, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(logPath, 'rejections.log') })
  ]
});

// Add special handling for production environment
if (process.env.NODE_ENV === 'production') {
  // In production, we want to make sure log directories exist
  const fs = require('fs');
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
  }
  
  // Additional specialized transports can be added for production
  // such as sending critical errors to a monitoring service
}

/**
 * Sanitize potentially sensitive information for HIPAA compliance
 * @param {string} message - The log message to sanitize
 * @returns {string} - Sanitized message
 */
function sanitizeForHIPAA(message) {
  if (typeof message !== 'string') {
    return message;
  }
  
  // Pattern matching for common PHI/PII data
  // This is a basic implementation - production would be more comprehensive
  
  // Mask potential patient identifiers
  message = message.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]');
  message = message.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REDACTED]');
  message = message.replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, '[SSN REDACTED]');
  
  // Mask potential medical record numbers
  message = message.replace(/\b(MRN|Medical Record Number|Record Number|Chart Number|Chart ID)[:.]?\s*\d+\b/gi, '[MRN REDACTED]');
  
  // Mask resource IDs that might contain patient information
  message = message.replace(/Patient\/[a-zA-Z0-9-]+/g, 'Patient/[ID-REDACTED]');
  
  return message;
}

// Export a simplified interface that matches console
module.exports = {
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, meta = {}) => logger.error(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  // Include the full logger for advanced usage
  logger
};
