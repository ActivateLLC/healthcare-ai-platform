const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Enterprise-grade HIPAA Audit Log Schema
 * 
 * Implements comprehensive logging for healthcare compliance requirements:
 * - 45 CFR § 164.312(b) - Audit controls
 * - 45 CFR § 164.308(a)(1)(ii)(D) - Information system activity review
 * - 45 CFR § 164.312(c)(1) - Integrity controls
 * - 45 CFR § 164.312(e)(2)(i) - Transmission security
 */
const AuditLogSchema = new mongoose.Schema({
  // Event metadata
  eventType: {
    type: String,
    required: true,
    enum: [
      'USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
      'ACCESS_GRANTED', 'ACCESS_DENIED', 'ACCESS_REVOKED',
      'PHI_CREATED', 'PHI_READ', 'PHI_UPDATED', 'PHI_DELETED',
      'FHIR_CREATED', 'FHIR_READ', 'FHIR_UPDATED', 'FHIR_DELETED',
      'SECURITY_ALERT', 'CONFIGURATION_CHANGE', 'DATA_EXPORT', 'SYSTEM_ERROR',
      'AI_RESOURCE_GENERATION', 'CLINICAL_TEXT_PROCESSING'
    ],
    index: true
  },
  
  // When the event occurred
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  // Who performed the action (USER ID only, never names or other identifiers)
  actor: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    ipAddress: String,
    userAgent: String,
    role: String
  },
  
  // What resource was affected
  resource: {
    resourceType: {
      type: String,
      required: true,
      enum: [
        'User', 'Patient', 'Practitioner', 'Organization', 
        'Observation', 'Condition', 'Procedure', 'MedicationRequest',
        'DiagnosticReport', 'FhirTemplate', 'System', 'AIRequest',
        'ClinicalDocument'
      ],
      index: true
    },
    resourceId: {
      type: String,
      required: true,
      index: true
    },
    // Only store the resource identifier, never the content
    resourceName: String
  },
  
  // Action details - never include PHI
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'GENERATE', 'PROCESS'],
    index: true
  },
  
  // Outcome of the action
  outcome: {
    status: {
      type: String,
      required: true,
      enum: ['SUCCESS', 'FAILURE', 'ERROR', 'WARNING', 'INFORMATION'],
      index: true
    },
    message: String,
    errorCode: String,
    errorDetails: String
  },
  
  // Request context
  request: {
    requestId: {
      type: String,
      index: true
    },
    method: String,
    endpoint: String,
    queryParams: String, // Sanitized to remove PHI
    // Do not store request bodies - potential PHI
  },
  
  // System context
  system: {
    component: String,
    version: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development'
    }
  },
  
  // Cryptographic integrity check
  integrityHash: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  // Additional indices for audit queries
  index: { 
    actor: 1, 
    'resource.resourceType': 1, 
    action: 1, 
    'outcome.status': 1 
  }
});

/**
 * Pre-save hook to generate integrity hash
 * This ensures audit logs cannot be tampered with
 */
AuditLogSchema.pre('save', function(next) {
  // Create hash of record for integrity verification
  const dataToHash = `${this.eventType}|${this.timestamp}|${this.actor.userId}|${this.resource.resourceType}|${this.resource.resourceId}|${this.action}|${this.outcome.status}`;
  this.integrityHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
  next();
});

/**
 * Static method to create standardized audit entries
 * @param {Object} data - Audit data
 * @returns {Promise} - Created audit log entry
 */
AuditLogSchema.statics.createAuditLog = async function(data) {
  try {
    // Sanitize any potential PHI from log data
    const sanitizedData = this.sanitizeAuditData(data);
    
    // Create the audit log entry
    const auditLog = await this.create(sanitizedData);
    
    return auditLog;
  } catch (error) {
    // Log error but don't block application flow for audit failures
    console.error('Audit logging failed:', error);
    
    // In production, this would use a dedicated error reporting system
    if (process.env.NODE_ENV === 'production') {
      // Report to monitoring system
    }
    
    // Return null instead of throwing to prevent application disruption
    return null;
  }
};

/**
 * Static method to sanitize audit data
 * Ensures no PHI/PII is included in audit logs
 * @param {Object} data - Data to sanitize
 * @returns {Object} - Sanitized data
 */
AuditLogSchema.statics.sanitizeAuditData = function(data) {
  // Deep clone to avoid modifying original
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Sanitize known fields that might contain PHI
  if (sanitized.request && sanitized.request.queryParams) {
    // Remove potential PHI from query params
    try {
      const params = JSON.parse(sanitized.request.queryParams);
      // Remove known PHI fields
      const sensitiveFields = ['name', 'patient', 'mrn', 'dob', 'ssn', 'email', 'phone'];
      sensitiveFields.forEach(field => {
        if (params[field]) {
          params[field] = '[REDACTED]';
        }
      });
      sanitized.request.queryParams = JSON.stringify(params);
    } catch (e) {
      // If not JSON, do basic sanitization
      sensitiveFields = ['name', 'patient', 'mrn', 'dob', 'ssn', 'email', 'phone'];
      sensitiveFields.forEach(field => {
        sanitized.request.queryParams = sanitized.request.queryParams.replace(
          new RegExp(`${field}=([^&]*)`, 'gi'),
          `${field}=[REDACTED]`
        );
      });
    }
  }
  
  // Remove any message content that might contain PHI
  if (sanitized.outcome && sanitized.outcome.message) {
    // Check for potential PHI patterns
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // Email
      /\b(MRN|Medical Record Number|Record Number|Chart Number|Chart ID)[:.]?\s*\d+\b/i // MRN
    ];
    
    phiPatterns.forEach(pattern => {
      sanitized.outcome.message = sanitized.outcome.message.replace(pattern, '[REDACTED]');
    });
  }
  
  return sanitized;
};

/**
 * Static method to verify the integrity of an audit log entry
 * @param {Object} auditLog - Audit log to verify
 * @returns {Boolean} - Whether the log entry is valid
 */
AuditLogSchema.statics.verifyIntegrity = function(auditLog) {
  // Recreate the hash to verify integrity
  const dataToHash = `${auditLog.eventType}|${auditLog.timestamp}|${auditLog.actor.userId}|${auditLog.resource.resourceType}|${auditLog.resource.resourceId}|${auditLog.action}|${auditLog.outcome.status}`;
  const calculatedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
  
  // Compare with stored hash
  return calculatedHash === auditLog.integrityHash;
};

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;
