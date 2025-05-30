/**
 * Epic EHR Integration Connector
 * 
 * Provides specialized integration with Epic EHR systems via FHIR API.
 * Implements the SMART on FHIR authorization flow specific to Epic's implementation.
 * 
 * Epic is the market leader with approximately 40% of the US hospital market.
 * This integration enables access to clinical data for 240+ million patients.
 */

const axios = require('axios');
const qs = require('querystring');
const logger = require('../../utils/logger');
const EhrConnector = require('./EhrConnector');

class EpicConnector extends EhrConnector {
  /**
   * Create a new Epic connector
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - Epic SMART App client ID
   * @param {string} config.clientSecret - Epic SMART App client secret 
   * @param {string} config.fhirVersion - FHIR version (R4, STU3, DSTU2)
   * @param {string} config.endpoint - Epic FHIR API endpoint URL
   * @param {string} config.nonProductionMode - Flag for Epic's non-production environments
   */
  constructor(config) {
    super({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      fhirVersion: config.fhirVersion || 'R4',
      baseUrl: config.endpoint,
      vendor: 'Epic'
    });
    
    this.nonProductionMode = config.nonProductionMode || false;
    
    // Epic-specific configuration
    this.epicMetadata = null;
    this.capabilities = [];
    
    // Add Epic-specific headers
    this.httpClient.defaults.headers['Epic-Client-ID'] = this.clientId;
    if (this.nonProductionMode) {
      this.httpClient.defaults.headers['Epic-Client-NonProductionMode'] = 'true';
    }
  }
  
  /**
   * Authenticate with Epic FHIR API using client credentials flow
   * @returns {Promise<void>}
   */
  async authenticate() {
    try {
      logger.info('Authenticating with Epic FHIR API');
      
      // First, fetch the conformance statement to get the token endpoint
      if (!this.epicMetadata) {
        await this.fetchCapabilityStatement();
      }
      
      // Extract token URL from metadata
      const tokenUrl = this.epicMetadata.rest[0].security.extension.find(
        ext => ext.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris'
      )?.extension.find(
        ext => ext.url === 'token'
      )?.valueUri;
      
      if (!tokenUrl) {
        throw new Error('Unable to determine Epic token endpoint from capability statement');
      }
      
      // Request access token
      const response = await axios.post(tokenUrl,
        qs.stringify({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'system/*.read system/*.write'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      // Update token information
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      logger.info('Successfully authenticated with Epic FHIR API');
    } catch (error) {
      logger.error(`Epic authentication error: ${error.message}`);
      throw new Error(`Epic authentication failed: ${error.message}`);
    }
  }
  
  /**
   * Fetch Epic FHIR capability statement (conformance resource)
   * to determine available endpoints and features
   * @returns {Promise<Object>} Capability statement
   */
  async fetchCapabilityStatement() {
    try {
      logger.info('Fetching Epic FHIR capability statement');
      
      // Epic uses the /metadata endpoint for capability statement
      const response = await axios.get(`${this.baseUrl}/metadata`, {
        headers: {
          'Accept': 'application/fhir+json'
        }
      });
      
      // Store metadata for future use
      this.epicMetadata = response.data;
      
      // Extract supported resource types and operations
      this.capabilities = response.data.rest[0].resource.map(resource => ({
        type: resource.type,
        interactions: resource.interaction.map(i => i.code),
        searchParams: resource.searchParam?.map(p => p.name) || []
      }));
      
      logger.info(`Epic FHIR capability statement loaded with ${this.capabilities.length} resources`);
      return this.epicMetadata;
    } catch (error) {
      logger.error(`Error fetching Epic capability statement: ${error.message}`);
      throw new Error(`Failed to fetch Epic capability statement: ${error.message}`);
    }
  }
  
  /**
   * Check if a specific resource type and operation are supported
   * @param {string} resourceType - FHIR resource type
   * @param {string} operation - FHIR operation (read, search, create, etc.)
   * @returns {boolean} Whether the operation is supported
   */
  isSupported(resourceType, operation) {
    if (!this.capabilities.length) {
      logger.warn('Capability statement not yet loaded');
      return true; // Assume supported if we haven't checked yet
    }
    
    const resource = this.capabilities.find(r => r.type === resourceType);
    if (!resource) {
      return false;
    }
    
    return resource.interactions.includes(operation);
  }
  
  /**
   * Get patient data from Epic
   * @param {string} patientId - Epic patient ID or MRN
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Patient resource
   */
  async getPatient(patientId, options = {}) {
    // Epic-specific implementation for patient retrieval
    // This handles Epic's specific patient identifier systems
    try {
      // First try direct ID lookup
      return await this.getResource('Patient', patientId, options);
    } catch (error) {
      // If not found, try searching by MRN
      if (error.status === 404) {
        logger.info(`Patient not found by ID, trying MRN search: ${patientId}`);
        
        const searchResult = await this.search('Patient', {
          identifier: `MRN|${patientId}`
        }, options);
        
        if (searchResult.entry && searchResult.entry.length > 0) {
          return searchResult.entry[0].resource;
        }
        
        throw new Error(`Patient not found with ID or MRN: ${patientId}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Get clinical data for a patient
   * @param {string} patientId - Epic patient ID
   * @param {string} resourceType - FHIR resource type
   * @param {Object} params - Additional search parameters
   * @param {Object} options - Request options
   * @returns {Promise<Array>} Array of clinical resources
   */
  async getPatientData(patientId, resourceType, params = {}, options = {}) {
    // Validate resource type is supported
    if (!this.isSupported(resourceType, 'search-type')) {
      throw new Error(`Resource type ${resourceType} is not supported by this Epic instance`);
    }
    
    // Build Epic-specific query parameters
    const searchParams = {
      patient: patientId,
      ...params
    };
    
    // If date filtering isn't specified, default to recent data
    if (!params.date && !params._lastUpdated) {
      searchParams._lastUpdated = 'gt2022-01-01';
    }
    
    // Execute search with patient context
    const results = await this.search(resourceType, searchParams, options);
    
    // Transform results to standardized format
    return results.entry ? results.entry.map(e => e.resource) : [];
  }
  
  /**
   * Create a document in Epic
   * @param {Object} documentReference - FHIR DocumentReference resource
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created document reference
   */
  async createDocument(documentReference, options = {}) {
    // Epic has specific requirements for document submission
    if (!documentReference.content || !documentReference.content.length) {
      throw new Error('Document content is required');
    }
    
    // Add Epic-specific extensions if not present
    if (!documentReference.extension) {
      documentReference.extension = [];
    }
    
    // Add required Epic metadata
    documentReference.extension.push({
      url: 'http://open.epic.com/FHIR/StructureDefinition/document-source',
      valueString: 'Healthcare AI Platform'
    });
    
    // Submit document
    return this.createResource('DocumentReference', documentReference, options);
  }
}

module.exports = EpicConnector;
