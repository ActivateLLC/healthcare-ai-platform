const AuditLog = require('../models/audit/AuditLog');
const logger = require('../utils/logger');

/**
 * Enterprise Healthcare Audit Service
 * 
 * Provides comprehensive HIPAA-compliant audit logging for healthcare applications
 * Implements requirements from:
 * - 45 CFR § 164.312(b) - Audit controls
 * - 45 CFR § 164.308(a)(1)(ii)(D) - Information system activity review
 */
class AuditService {
  /**
   * Log user authentication events
   * @param {String} eventType - LOGIN, LOGOUT, etc.
   * @param {Object} user - User object
   * @param {Object} request - HTTP request object
   * @param {Object} outcome - Outcome of the authentication
   */
  static async logAuthEvent(eventType, user, request, outcome) {
    try {
      const auditData = {
        eventType,
        actor: {
          userId: user._id || 'unknown',
          ipAddress: request.ip || request.connection.remoteAddress,
          userAgent: request.headers['user-agent'],
          role: user.role || 'user'
        },
        resource: {
          resourceType: 'User',
          resourceId: user._id || 'unknown',
          resourceName: `User:${user._id}` // Never include actual user names
        },
        action: this._mapEventToAction(eventType),
        outcome: {
          status: outcome.success ? 'SUCCESS' : 'FAILURE',
          message: outcome.message || '',
          errorCode: outcome.errorCode || ''
        },
        request: {
          requestId: request.requestId || `req-${Date.now()}`,
          method: request.method,
          endpoint: request.originalUrl
        },
        system: {
          component: 'AuthenticationService',
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      // Create audit log entry
      await AuditLog.createAuditLog(auditData);
      
      // Log success at debug level (no PHI)
      logger.debug(`Audit: ${eventType} logged successfully`);
      
      return true;
    } catch (error) {
      // Log error but continue application flow
      logger.error(`Error creating auth audit log: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Log FHIR resource access and modifications
   * @param {String} eventType - FHIR_CREATED, FHIR_READ, etc.
   * @param {Object} user - User performing the action
   * @param {Object} resource - Resource being accessed/modified
   * @param {Object} request - HTTP request object
   * @param {Object} outcome - Outcome of the operation
   */
  static async logFhirActivity(eventType, user, resource, request, outcome) {
    try {
      // Extract only non-PHI resource identifiers
      const resourceId = resource._id || resource.id || 'unknown';
      const resourceType = resource.resourceType || 'Unknown';
      
      const auditData = {
        eventType,
        actor: {
          userId: user._id,
          ipAddress: request.ip || request.connection.remoteAddress,
          userAgent: request.headers['user-agent'],
          role: user.role || 'user'
        },
        resource: {
          resourceType,
          resourceId: resourceId.toString(),
          resourceName: `${resourceType}:${resourceId}` // Never include PHI
        },
        action: this._mapEventToAction(eventType),
        outcome: {
          status: outcome.success ? 'SUCCESS' : 'FAILURE',
          message: outcome.message || '',
          errorCode: outcome.errorCode || ''
        },
        request: {
          requestId: request.requestId || `req-${Date.now()}`,
          method: request.method,
          endpoint: request.originalUrl,
          // Sanitize query parameters to remove PHI
          queryParams: this._sanitizeQueryParams(request.query)
        },
        system: {
          component: 'FhirService',
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      // Create audit log entry
      await AuditLog.createAuditLog(auditData);
      
      // Log success at debug level (no PHI)
      logger.debug(`Audit: ${eventType} for ${resourceType} logged successfully`);
      
      return true;
    } catch (error) {
      // Log error but continue application flow
      logger.error(`Error creating FHIR audit log: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Log AI operations (FHIR generation, clinical text processing)
   * @param {String} eventType - AI_RESOURCE_GENERATION, CLINICAL_TEXT_PROCESSING
   * @param {Object} user - User performing the action
   * @param {Object} details - Details about the AI operation
   * @param {Object} request - HTTP request object
   * @param {Object} outcome - Outcome of the operation
   */
  static async logAIOperation(eventType, user, details, request, outcome) {
    try {
      const auditData = {
        eventType,
        actor: {
          userId: user._id,
          ipAddress: request.ip || request.connection.remoteAddress,
          userAgent: request.headers['user-agent'],
          role: user.role || 'user'
        },
        resource: {
          resourceType: details.resourceType || 'AIRequest',
          resourceId: details.requestId || `ai-${Date.now()}`,
          resourceName: `AI:${details.operation || eventType}`
        },
        action: 'GENERATE',
        outcome: {
          status: outcome.success ? 'SUCCESS' : 'FAILURE',
          message: outcome.message || '',
          errorCode: outcome.errorCode || '',
          // Include performance metrics but no content/PHI
          errorDetails: outcome.error ? (outcome.error.message || '') : ''
        },
        request: {
          requestId: request.requestId || `req-${Date.now()}`,
          method: request.method,
          endpoint: request.originalUrl
        },
        system: {
          component: 'AIService',
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      // Add performance metrics if available (no PHI)
      if (details.duration) {
        auditData.outcome.message += ` (Duration: ${details.duration}ms)`;
      }
      
      // Create audit log entry
      await AuditLog.createAuditLog(auditData);
      
      // Log success at debug level
      logger.debug(`Audit: ${eventType} logged successfully`);
      
      return true;
    } catch (error) {
      // Log error but continue application flow
      logger.error(`Error creating AI audit log: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Log security events (access control, configuration changes)
   * @param {String} eventType - SECURITY_ALERT, CONFIGURATION_CHANGE, etc.
   * @param {Object} user - User performing the action
   * @param {Object} details - Details about the security event
   * @param {Object} request - HTTP request object
   * @param {Object} outcome - Outcome of the operation
   */
  static async logSecurityEvent(eventType, user, details, request, outcome) {
    try {
      const auditData = {
        eventType,
        actor: {
          userId: user ? user._id : 'system',
          ipAddress: request ? (request.ip || request.connection.remoteAddress) : 'system',
          userAgent: request ? request.headers['user-agent'] : 'system',
          role: user ? (user.role || 'user') : 'system'
        },
        resource: {
          resourceType: details.resourceType || 'System',
          resourceId: details.resourceId || `security-${Date.now()}`,
          resourceName: details.resourceName || `Security:${eventType}`
        },
        action: this._mapEventToAction(eventType),
        outcome: {
          status: outcome.success ? 'SUCCESS' : 'FAILURE',
          message: outcome.message || '',
          errorCode: outcome.errorCode || ''
        },
        request: request ? {
          requestId: request.requestId || `req-${Date.now()}`,
          method: request.method,
          endpoint: request.originalUrl
        } : {
          requestId: `sys-${Date.now()}`,
          method: 'SYSTEM',
          endpoint: 'INTERNAL'
        },
        system: {
          component: details.component || 'SecurityService',
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      // Create audit log entry
      await AuditLog.createAuditLog(auditData);
      
      // For security events, also log to application logs at appropriate level
      const logLevel = outcome.success ? 'info' : 'warn';
      logger[logLevel](`Security: ${eventType} - ${outcome.message}`);
      
      return true;
    } catch (error) {
      // Log error but continue application flow
      logger.error(`Error creating security audit log: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Generate compliance reports for regulatory requirements
   * @param {Object} criteria - Search criteria for report
   * @param {Date} startDate - Start date for report
   * @param {Date} endDate - End date for report
   * @returns {Promise<Array>} - Audit records matching criteria
   */
  static async generateComplianceReport(criteria, startDate, endDate) {
    try {
      // Build query with date range
      const query = {
        ...criteria,
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      };
      
      // Execute query with pagination
      const auditRecords = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .lean();
      
      // Verify integrity of all records
      const verifiedRecords = auditRecords.map(record => {
        const isValid = AuditLog.verifyIntegrity(record);
        return {
          ...record,
          _verified: isValid
        };
      });
      
      // Log report generation (no PHI)
      logger.info(`Compliance report generated: ${startDate.toISOString()} to ${endDate.toISOString()}`, {
        recordCount: verifiedRecords.length,
        criteria: JSON.stringify(criteria)
      });
      
      return verifiedRecords;
    } catch (error) {
      logger.error(`Error generating compliance report: ${error.message}`);
      throw error;
    }
  }
  
  // Private helper methods
  
  /**
   * Map event types to action types
   * @private
   * @param {String} eventType - Event type
   * @returns {String} - Corresponding action
   */
  static _mapEventToAction(eventType) {
    const actionMap = {
      'USER_LOGIN': 'READ',
      'USER_LOGOUT': 'READ',
      'USER_CREATED': 'CREATE',
      'USER_UPDATED': 'UPDATE',
      'USER_DELETED': 'DELETE',
      'ACCESS_GRANTED': 'UPDATE',
      'ACCESS_DENIED': 'READ',
      'ACCESS_REVOKED': 'UPDATE',
      'PHI_CREATED': 'CREATE',
      'PHI_READ': 'READ',
      'PHI_UPDATED': 'UPDATE',
      'PHI_DELETED': 'DELETE',
      'FHIR_CREATED': 'CREATE',
      'FHIR_READ': 'READ',
      'FHIR_UPDATED': 'UPDATE',
      'FHIR_DELETED': 'DELETE',
      'SECURITY_ALERT': 'READ',
      'CONFIGURATION_CHANGE': 'UPDATE',
      'DATA_EXPORT': 'EXPORT',
      'SYSTEM_ERROR': 'READ',
      'AI_RESOURCE_GENERATION': 'GENERATE',
      'CLINICAL_TEXT_PROCESSING': 'PROCESS'
    };
    
    return actionMap[eventType] || 'READ';
  }
  
  /**
   * Sanitize query parameters to remove PHI
   * @private
   * @param {Object} query - Query parameters
   * @returns {String} - Sanitized query parameters as JSON string
   */
  static _sanitizeQueryParams(query) {
    if (!query) return '';
    
    // Clone to avoid modifying original
    const sanitized = { ...query };
    
    // List of parameters that might contain PHI
    const sensitiveParams = [
      'name', 'firstName', 'lastName', 'patient', 'patientName',
      'mrn', 'medicalRecordNumber', 'ssn', 'socialSecurityNumber',
      'dob', 'dateOfBirth', 'birthDate', 'phone', 'email',
      'address', 'city', 'state', 'zip', 'postalCode'
    ];
    
    // Redact sensitive parameters
    sensitiveParams.forEach(param => {
      if (sanitized[param]) {
        sanitized[param] = '[REDACTED]';
      }
    });
    
    return JSON.stringify(sanitized);
  }
}

module.exports = AuditService;
