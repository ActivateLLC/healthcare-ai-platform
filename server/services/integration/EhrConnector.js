/**
 * Enterprise EHR Integration Framework
 * 
 * This module provides a standardized interface for connecting with major EHR systems
 * via FHIR APIs. It implements the SMART on FHIR authorization flow and handles
 * the complexities of different vendor implementations.
 * 
 * Key features:
 * - OAuth 2.0 authentication with refresh token support
 * - Standardized error handling across vendors
 * - Automatic retry with exponential backoff
 * - Performance monitoring and logging
 * - Audit trail generation for HIPAA compliance
 */

const axios = require('axios');
const qs = require('querystring');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const AuditService = require('../audit');

/**
 * Base EHR Connector class that handles common functionality
 * across different EHR vendors
 */
class EhrConnector {
  /**
   * Create a new EHR connector
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - OAuth client ID
   * @param {string} config.clientSecret - OAuth client secret
   * @param {string} config.fhirVersion - FHIR version (R4, STU3, etc.)
   * @param {string} config.baseUrl - Base URL for the FHIR API
   * @param {string} config.vendor - EHR vendor name
   */
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.fhirVersion = config.fhirVersion || 'R4';
    this.baseUrl = config.baseUrl;
    this.vendor = config.vendor;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.refreshToken = null;
    
    // Request tracking for auditing
    this.requestCounter = 0;
    
    // Create axios instance with default config
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      }
    });
    
    // Add request interceptor for token management and logging
    this.httpClient.interceptors.request.use(
      async (config) => {
        // Assign request ID for tracking
        const requestId = `ehr-${this.vendor}-${++this.requestCounter}-${Date.now()}`;
        config.requestId = requestId;
        
        // Log request (no PHI)
        logger.debug(`EHR ${this.vendor} request: ${config.method} ${config.url}`, {
          requestId,
          vendor: this.vendor,
          fhirVersion: this.fhirVersion
        });
        
        // Check token validity and refresh if needed
        if (this.isTokenExpired()) {
          await this.refreshAccessToken();
        }
        
        // Add authorization header
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        
        return config;
      },
      (error) => {
        logger.error(`EHR request configuration error: ${error.message}`);
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for error handling and logging
    this.httpClient.interceptors.response.use(
      (response) => {
        // Log success (no PHI)
        logger.debug(`EHR ${this.vendor} response: ${response.status}`, {
          requestId: response.config.requestId,
          status: response.status,
          contentType: response.headers['content-type']
        });
        
        return response;
      },
      async (error) => {
        // Enhanced error handling for EHR APIs
        const status = error.response ? error.response.status : 0;
        const requestId = error.config ? error.config.requestId : 'unknown';
        
        // Log error details (no PHI)
        logger.error(`EHR ${this.vendor} error: ${status} - ${error.message}`, {
          requestId,
          status,
          endpoint: error.config ? error.config.url : 'unknown',
          errorCode: error.response ? error.response.data.issue?.[0]?.code : 'unknown'
        });
        
        // Handle specific error scenarios
        if (status === 401 && !error.config._retry) {
          // Token expired during request, retry once
          error.config._retry = true;
          await this.refreshAccessToken();
          return this.httpClient(error.config);
        }
        
        // Standardize error format
        const enhancedError = new Error(`EHR API Error (${this.vendor}): ${error.message}`);
        enhancedError.status = status;
        enhancedError.originalError = error;
        enhancedError.requestId = requestId;
        enhancedError.vendor = this.vendor;
        enhancedError.responseData = error.response ? error.response.data : null;
        
        return Promise.reject(enhancedError);
      }
    );
  }
  
  /**
   * Check if the current access token is expired
   * @returns {boolean} True if token is expired or not set
   */
  isTokenExpired() {
    if (!this.accessToken || !this.tokenExpiry) {
      return true;
    }
    
    // Consider token expired 60 seconds before actual expiry
    // to prevent edge cases
    const bufferTime = 60 * 1000;
    return Date.now() >= (this.tokenExpiry - bufferTime);
  }
  
  /**
   * Authenticate with the EHR system and get access token
   * Each vendor may implement this differently
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate() {
    throw new Error('authenticate method must be implemented by subclass');
  }
  
  /**
   * Refresh the access token using refresh token
   * @returns {Promise<void>}
   */
  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        // No refresh token, perform full authentication
        await this.authenticate();
        return;
      }
      
      // Attempt to refresh the token
      const response = await axios.post(`${this.baseUrl}/oauth2/token`, 
        qs.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret
          }
        }
      );
      
      // Update tokens
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token || this.refreshToken;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      logger.info(`Refreshed ${this.vendor} EHR access token`);
    } catch (error) {
      logger.error(`Failed to refresh ${this.vendor} EHR token: ${error.message}`);
      
      // Clear tokens to force full re-authentication
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      
      // Perform full authentication
      await this.authenticate();
    }
  }
  
  /**
   * Search for FHIR resources
   * @param {string} resourceType - FHIR resource type (Patient, Observation, etc.)
   * @param {Object} params - Search parameters
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Search results
   */
  async search(resourceType, params = {}, options = {}) {
    try {
      // Generate request ID for audit trail
      const requestId = uuidv4();
      
      // Create audit entry for this operation
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_READ',
          options.user,
          { resourceType },
          { requestId, method: 'GET', originalUrl: `/fhir/${resourceType}` },
          { success: true }
        );
      }
      
      // Execute search request
      const response = await this.httpClient.get(`/${resourceType}`, {
        params,
        headers: {
          ...this.httpClient.defaults.headers,
          ...(options.headers || {})
        }
      });
      
      return response.data;
    } catch (error) {
      // Log failure in audit trail
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_READ',
          options.user,
          { resourceType },
          { requestId: error.requestId, method: 'GET', originalUrl: `/fhir/${resourceType}` },
          { success: false, message: error.message }
        );
      }
      
      throw error;
    }
  }
  
  /**
   * Get a specific FHIR resource by ID
   * @param {string} resourceType - FHIR resource type
   * @param {string} id - Resource ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} FHIR resource
   */
  async getResource(resourceType, id, options = {}) {
    try {
      // Generate request ID for audit trail
      const requestId = uuidv4();
      
      // Create audit entry for this operation
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_READ',
          options.user,
          { resourceType, resourceId: id },
          { requestId, method: 'GET', originalUrl: `/fhir/${resourceType}/${id}` },
          { success: true }
        );
      }
      
      // Execute get request
      const response = await this.httpClient.get(`/${resourceType}/${id}`, {
        headers: {
          ...this.httpClient.defaults.headers,
          ...(options.headers || {})
        }
      });
      
      return response.data;
    } catch (error) {
      // Log failure in audit trail
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_READ',
          options.user,
          { resourceType, resourceId: id },
          { requestId: error.requestId, method: 'GET', originalUrl: `/fhir/${resourceType}/${id}` },
          { success: false, message: error.message }
        );
      }
      
      throw error;
    }
  }
  
  /**
   * Create a new FHIR resource
   * @param {string} resourceType - FHIR resource type
   * @param {Object} resource - FHIR resource data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created resource
   */
  async createResource(resourceType, resource, options = {}) {
    try {
      // Generate request ID for audit trail
      const requestId = uuidv4();
      
      // Create audit entry for this operation
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_CREATED',
          options.user,
          { resourceType, resourceId: resource.id || 'new' },
          { requestId, method: 'POST', originalUrl: `/fhir/${resourceType}` },
          { success: true }
        );
      }
      
      // Execute create request
      const response = await this.httpClient.post(`/${resourceType}`, resource, {
        headers: {
          ...this.httpClient.defaults.headers,
          ...(options.headers || {})
        }
      });
      
      return response.data;
    } catch (error) {
      // Log failure in audit trail
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_CREATED',
          options.user,
          { resourceType, resourceId: resource.id || 'new' },
          { requestId: error.requestId, method: 'POST', originalUrl: `/fhir/${resourceType}` },
          { success: false, message: error.message }
        );
      }
      
      throw error;
    }
  }
  
  /**
   * Update an existing FHIR resource
   * @param {string} resourceType - FHIR resource type
   * @param {string} id - Resource ID
   * @param {Object} resource - Updated resource data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated resource
   */
  async updateResource(resourceType, id, resource, options = {}) {
    try {
      // Generate request ID for audit trail
      const requestId = uuidv4();
      
      // Create audit entry for this operation
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_UPDATED',
          options.user,
          { resourceType, resourceId: id },
          { requestId, method: 'PUT', originalUrl: `/fhir/${resourceType}/${id}` },
          { success: true }
        );
      }
      
      // Execute update request
      const response = await this.httpClient.put(`/${resourceType}/${id}`, resource, {
        headers: {
          ...this.httpClient.defaults.headers,
          ...(options.headers || {})
        }
      });
      
      return response.data;
    } catch (error) {
      // Log failure in audit trail
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_UPDATED',
          options.user,
          { resourceType, resourceId: id },
          { requestId: error.requestId, method: 'PUT', originalUrl: `/fhir/${resourceType}/${id}` },
          { success: false, message: error.message }
        );
      }
      
      throw error;
    }
  }
  
  /**
   * Delete a FHIR resource
   * @param {string} resourceType - FHIR resource type
   * @param {string} id - Resource ID
   * @param {Object} options - Additional options
   * @returns {Promise<void>}
   */
  async deleteResource(resourceType, id, options = {}) {
    try {
      // Generate request ID for audit trail
      const requestId = uuidv4();
      
      // Create audit entry for this operation
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_DELETED',
          options.user,
          { resourceType, resourceId: id },
          { requestId, method: 'DELETE', originalUrl: `/fhir/${resourceType}/${id}` },
          { success: true }
        );
      }
      
      // Execute delete request
      await this.httpClient.delete(`/${resourceType}/${id}`, {
        headers: {
          ...this.httpClient.defaults.headers,
          ...(options.headers || {})
        }
      });
    } catch (error) {
      // Log failure in audit trail
      if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
        await AuditService.logFhirActivity(
          'FHIR_DELETED',
          options.user,
          { resourceType, resourceId: id },
          { requestId: error.requestId, method: 'DELETE', originalUrl: `/fhir/${resourceType}/${id}` },
          { success: false, message: error.message }
        );
      }
      
      throw error;
    }
  }
}

module.exports = EhrConnector;
