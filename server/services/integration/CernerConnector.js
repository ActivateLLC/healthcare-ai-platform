/**
 * Cerner EHR Integration Connector
 * 
 * Provides specialized integration with Cerner EHR systems via FHIR API.
 * Implements the SMART on FHIR authorization flow specific to Cerner's implementation.
 * 
 * Cerner is the second largest EHR vendor with approximately 25% of the US hospital market.
 * This integration enables access to clinical data for 150+ million patients.
 */

const axios = require('axios');
const qs = require('querystring');
const logger = require('../../utils/logger');
const EhrConnector = require('./EhrConnector');

class CernerConnector extends EhrConnector {
  /**
   * Create a new Cerner connector
   * @param {Object} config - Configuration object
   * @param {string} config.clientId - Cerner SMART App client ID
   * @param {string} config.clientSecret - Cerner SMART App client secret
   * @param {string} config.fhirVersion - FHIR version (R4, STU3)
   * @param {string} config.endpoint - Cerner FHIR API endpoint URL
   * @param {string} config.tenant - Cerner tenant ID
   */
  constructor(config) {
    super({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      fhirVersion: config.fhirVersion || 'R4',
      baseUrl: config.endpoint,
      vendor: 'Cerner'
    });
    
    this.tenant = config.tenant;
    this.tokenUrl = 'https://authorization.cerner.com/tenants/' + 
                    this.tenant + '/protocols/oauth2/profiles/smart-v1/token';
    
    // Cerner-specific configuration
    this.cernerMetadata = null;
    this.practitionerContext = null;
    
    // Add Cerner-specific headers
    this.httpClient.defaults.headers['Cerner-Tenant'] = this.tenant;
    this.httpClient.defaults.headers['Accept-Charset'] = 'utf-8';
  }
  
  /**
   * Authenticate with Cerner FHIR API using client credentials flow
   * @returns {Promise<void>}
   */
  async authenticate() {
    try {
      logger.info('Authenticating with Cerner FHIR API');
      
      // Request access token
      const response = await axios.post(this.tokenUrl,
        qs.stringify({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'system/Patient.read system/Observation.read system/Condition.read'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );
      
      // Update token information
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      logger.info('Successfully authenticated with Cerner FHIR API');
    } catch (error) {
      logger.error(`Cerner authentication error: ${error.message}`);
      throw new Error(`Cerner authentication failed: ${error.message}`);
    }
  }
  
  /**
   * Fetch Cerner FHIR capability statement (conformance resource)
   * to determine available endpoints and features
   * @returns {Promise<Object>} Capability statement
   */
  async fetchCapabilityStatement() {
    try {
      logger.info('Fetching Cerner FHIR capability statement');
      
      // Cerner uses the /metadata endpoint for capability statement
      const response = await this.httpClient.get('/metadata');
      
      // Store metadata for future use
      this.cernerMetadata = response.data;
      
      logger.info(`Cerner FHIR capability statement loaded`);
      return this.cernerMetadata;
    } catch (error) {
      logger.error(`Error fetching Cerner capability statement: ${error.message}`);
      throw new Error(`Failed to fetch Cerner capability statement: ${error.message}`);
    }
  }
  
  /**
   * Get patient data by MRN from Cerner
   * @param {string} mrn - Medical Record Number
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Patient resource
   */
  async getPatientByMRN(mrn, options = {}) {
    try {
      logger.info(`Searching for Cerner patient with MRN: ${mrn}`);
      
      // Cerner uses identifier search for MRN lookup
      const searchResults = await this.search('Patient', {
        identifier: `https://fhir.cerner.com/id/mrn|${mrn}`
      }, options);
      
      if (!searchResults.entry || searchResults.entry.length === 0) {
        throw new Error(`No patient found with MRN: ${mrn}`);
      }
      
      // Return the first matching patient
      return searchResults.entry[0].resource;
    } catch (error) {
      logger.error(`Error retrieving patient by MRN: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get clinical documents for a patient
   * @param {string} patientId - Cerner patient ID
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Array of document references
   */
  async getPatientDocuments(patientId, options = {}) {
    try {
      // Cerner-specific implementation for document retrieval
      const results = await this.search('DocumentReference', {
        patient: patientId,
        _count: 50,
        _sort: '-date'
      }, options);
      
      return results.entry ? results.entry.map(e => e.resource) : [];
    } catch (error) {
      logger.error(`Error retrieving patient documents: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get clinical data from multiple resource types for a patient
   * Optimized for Cerner's implementation
   * @param {string} patientId - Cerner patient ID
   * @param {Array} resourceTypes - Array of FHIR resource types to retrieve
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Object with resources by type
   */
  async getPatientClinicalData(patientId, resourceTypes, options = {}) {
    const results = {};
    const promises = [];
    
    // Queue up requests for each resource type
    for (const resourceType of resourceTypes) {
      const promise = this.search(resourceType, {
        patient: patientId,
        _count: 100
      }, options).then(data => {
        results[resourceType] = data.entry ? data.entry.map(e => e.resource) : [];
      }).catch(error => {
        logger.error(`Error retrieving ${resourceType} for patient: ${error.message}`);
        results[resourceType] = { error: error.message };
      });
      
      promises.push(promise);
    }
    
    // Wait for all requests to complete
    await Promise.all(promises);
    
    return results;
  }
  
  /**
   * Create a FHIR Observation in Cerner
   * @param {Object} observation - FHIR Observation resource
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created observation
   */
  async createObservation(observation, options = {}) {
    // Cerner has specific requirements for observation creation
    
    // Ensure required Cerner-specific elements are present
    if (!observation.status) {
      observation.status = 'final';
    }
    
    if (!observation.category) {
      observation.category = [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      }];
    }
    
    // Add Cerner-specific extensions if not present
    if (!observation.extension) {
      observation.extension = [];
    }
    
    // Add source extension
    observation.extension.push({
      url: 'https://fhir.cerner.com/extension/source',
      valueUri: 'Healthcare AI Platform'
    });
    
    // Create the observation
    return this.createResource('Observation', observation, options);
  }
}

module.exports = CernerConnector;
