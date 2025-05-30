/**
 * Enterprise EHR Integration Controller
 * 
 * Provides centralized management of EHR integrations and data exchange
 * with major healthcare systems. This controller implements enterprise-grade
 * features required for healthcare organization adoption:
 * 
 * - Multi-vendor EHR support (Epic, Cerner)
 * - Unified FHIR API interface regardless of source system
 * - HIPAA-compliant audit logging
 * - Error handling with detailed diagnostics
 * - Performance monitoring
 */

const EpicConnector = require('../../services/integration/EpicConnector');
const CernerConnector = require('../../services/integration/CernerConnector');
const logger = require('../../utils/logger');
const AuditService = require('../../services/audit');
const { v4: uuidv4 } = require('uuid');

// Initialize EHR connectors based on environment configuration
const ehrConnectors = {
  epic: process.env.EPIC_CLIENT_ID ? new EpicConnector({
    clientId: process.env.EPIC_CLIENT_ID,
    clientSecret: process.env.EPIC_CLIENT_SECRET,
    endpoint: process.env.EPIC_FHIR_ENDPOINT,
    fhirVersion: 'R4'
  }) : null,
  
  cerner: process.env.CERNER_CLIENT_ID ? new CernerConnector({
    clientId: process.env.CERNER_CLIENT_ID,
    clientSecret: process.env.CERNER_CLIENT_SECRET,
    endpoint: process.env.CERNER_FHIR_ENDPOINT,
    tenant: process.env.CERNER_TENANT_ID,
    fhirVersion: 'R4'
  }) : null
};

/**
 * Get available EHR connectors
 * @route GET /api/integration/vendors
 * @returns {Array} List of available EHR vendors
 */
exports.getAvailableVendors = async (req, res) => {
  try {
    // Generate operation ID for audit trail
    const operationId = uuidv4();
    
    // Log the operation request
    logger.info(`Retrieving available EHR vendors [${operationId}]`, {
      userId: req.user.id,
      operationId
    });
    
    // Get active connectors
    const vendors = Object.entries(ehrConnectors)
      .filter(([_, connector]) => connector !== null)
      .map(([key, _]) => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        status: 'available'
      }));
    
    // Create audit log entry
    await AuditService.logSecurityEvent(
      'CONFIGURATION_CHANGE',
      req.user,
      { resourceType: 'EHRIntegration', resourceId: operationId },
      req,
      { success: true, message: 'Retrieved available EHR vendors' }
    );
    
    return res.status(200).json({
      success: true,
      data: vendors
    });
  } catch (error) {
    logger.error(`Error retrieving available EHR vendors: ${error.message}`, {
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve available EHR vendors',
      requestId: req.requestId
    });
  }
};

/**
 * Get FHIR capability statement for a specific EHR vendor
 * @route GET /api/integration/:vendor/metadata
 * @param {string} vendor - EHR vendor (epic, cerner)
 * @returns {Object} FHIR capability statement
 */
exports.getCapabilityStatement = async (req, res) => {
  try {
    const { vendor } = req.params;
    
    // Check if vendor is supported
    if (!ehrConnectors[vendor]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported EHR vendor: ${vendor}`
      });
    }
    
    // Generate operation ID for audit trail
    const operationId = uuidv4();
    
    // Log the operation request
    logger.info(`Retrieving capability statement for ${vendor} [${operationId}]`, {
      userId: req.user.id,
      vendor,
      operationId
    });
    
    // Get capability statement
    const connector = ehrConnectors[vendor];
    const metadata = await connector.fetchCapabilityStatement();
    
    // Create audit log entry
    await AuditService.logFhirActivity(
      'FHIR_READ',
      req.user,
      { resourceType: 'CapabilityStatement', resourceId: vendor },
      req,
      { success: true }
    );
    
    return res.status(200).json({
      success: true,
      vendor,
      data: metadata
    });
  } catch (error) {
    logger.error(`Error retrieving capability statement: ${error.message}`, {
      stack: error.stack,
      vendor: req.params.vendor
    });
    
    return res.status(500).json({
      success: false,
      error: `Failed to retrieve capability statement: ${error.message}`,
      requestId: req.requestId
    });
  }
};

/**
 * Search for patients in EHR system
 * @route GET /api/integration/:vendor/Patient
 * @param {string} vendor - EHR vendor (epic, cerner)
 * @returns {Array} Matching patients
 */
exports.searchPatients = async (req, res) => {
  try {
    const { vendor } = req.params;
    const searchParams = req.query;
    
    // Check if vendor is supported
    if (!ehrConnectors[vendor]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported EHR vendor: ${vendor}`
      });
    }
    
    // Generate operation ID for audit trail
    const operationId = uuidv4();
    
    // Log the operation request
    logger.info(`Searching for patients in ${vendor} [${operationId}]`, {
      userId: req.user.id,
      vendor,
      operationId
    });
    
    // Get patient search results
    const connector = ehrConnectors[vendor];
    const searchResults = await connector.search('Patient', searchParams, {
      user: req.user
    });
    
    // Create audit log entry
    await AuditService.logFhirActivity(
      'FHIR_READ',
      req.user,
      { resourceType: 'Patient', resourceId: 'search' },
      req,
      { success: true }
    );
    
    return res.status(200).json({
      success: true,
      vendor,
      count: searchResults.total || (searchResults.entry ? searchResults.entry.length : 0),
      data: searchResults
    });
  } catch (error) {
    logger.error(`Error searching for patients: ${error.message}`, {
      stack: error.stack,
      vendor: req.params.vendor
    });
    
    return res.status(500).json({
      success: false,
      error: `Failed to search for patients: ${error.message}`,
      requestId: req.requestId
    });
  }
};

/**
 * Get patient by ID from EHR system
 * @route GET /api/integration/:vendor/Patient/:id
 * @param {string} vendor - EHR vendor (epic, cerner)
 * @param {string} id - Patient ID
 * @returns {Object} Patient resource
 */
exports.getPatient = async (req, res) => {
  try {
    const { vendor, id } = req.params;
    
    // Check if vendor is supported
    if (!ehrConnectors[vendor]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported EHR vendor: ${vendor}`
      });
    }
    
    // Generate operation ID for audit trail
    const operationId = uuidv4();
    
    // Log the operation request
    logger.info(`Retrieving patient from ${vendor} [${operationId}]`, {
      userId: req.user.id,
      vendor,
      patientId: id,
      operationId
    });
    
    // Get patient resource
    const connector = ehrConnectors[vendor];
    const patient = await connector.getResource('Patient', id, {
      user: req.user
    });
    
    // Create audit log entry
    await AuditService.logFhirActivity(
      'FHIR_READ',
      req.user,
      { resourceType: 'Patient', resourceId: id },
      req,
      { success: true }
    );
    
    return res.status(200).json({
      success: true,
      vendor,
      data: patient
    });
  } catch (error) {
    logger.error(`Error retrieving patient: ${error.message}`, {
      stack: error.stack,
      vendor: req.params.vendor,
      patientId: req.params.id
    });
    
    return res.status(500).json({
      success: false,
      error: `Failed to retrieve patient: ${error.message}`,
      requestId: req.requestId
    });
  }
};

/**
 * Get patient clinical data from EHR system
 * @route GET /api/integration/:vendor/Patient/:id/:resourceType
 * @param {string} vendor - EHR vendor (epic, cerner)
 * @param {string} id - Patient ID
 * @param {string} resourceType - FHIR resource type
 * @returns {Array} Clinical resources
 */
exports.getPatientData = async (req, res) => {
  try {
    const { vendor, id, resourceType } = req.params;
    const searchParams = req.query;
    
    // Check if vendor is supported
    if (!ehrConnectors[vendor]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported EHR vendor: ${vendor}`
      });
    }
    
    // Generate operation ID for audit trail
    const operationId = uuidv4();
    
    // Log the operation request
    logger.info(`Retrieving patient ${resourceType} from ${vendor} [${operationId}]`, {
      userId: req.user.id,
      vendor,
      patientId: id,
      resourceType,
      operationId
    });
    
    // Get clinical data
    const connector = ehrConnectors[vendor];
    
    // Prepare search parameters
    const params = {
      patient: id,
      ...searchParams
    };
    
    // Execute search
    const results = await connector.search(resourceType, params, {
      user: req.user
    });
    
    // Create audit log entry
    await AuditService.logFhirActivity(
      'FHIR_READ',
      req.user,
      { resourceType, resourceId: `patient/${id}` },
      req,
      { success: true }
    );
    
    return res.status(200).json({
      success: true,
      vendor,
      resourceType,
      patientId: id,
      count: results.total || (results.entry ? results.entry.length : 0),
      data: results
    });
  } catch (error) {
    logger.error(`Error retrieving patient data: ${error.message}`, {
      stack: error.stack,
      vendor: req.params.vendor,
      patientId: req.params.id,
      resourceType: req.params.resourceType
    });
    
    return res.status(500).json({
      success: false,
      error: `Failed to retrieve patient data: ${error.message}`,
      requestId: req.requestId
    });
  }
};

/**
 * Create a FHIR resource in EHR system
 * @route POST /api/integration/:vendor/:resourceType
 * @param {string} vendor - EHR vendor (epic, cerner)
 * @param {string} resourceType - FHIR resource type
 * @returns {Object} Created resource
 */
exports.createResource = async (req, res) => {
  try {
    const { vendor, resourceType } = req.params;
    const resourceData = req.body;
    
    // Check if vendor is supported
    if (!ehrConnectors[vendor]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported EHR vendor: ${vendor}`
      });
    }
    
    // Generate operation ID for audit trail
    const operationId = uuidv4();
    
    // Log the operation request
    logger.info(`Creating ${resourceType} in ${vendor} [${operationId}]`, {
      userId: req.user.id,
      vendor,
      resourceType,
      operationId
    });
    
    // Create resource
    const connector = ehrConnectors[vendor];
    const createdResource = await connector.createResource(resourceType, resourceData, {
      user: req.user
    });
    
    // Create audit log entry
    await AuditService.logFhirActivity(
      'FHIR_CREATED',
      req.user,
      { resourceType, resourceId: createdResource.id || 'new' },
      req,
      { success: true }
    );
    
    return res.status(201).json({
      success: true,
      vendor,
      resourceType,
      data: createdResource
    });
  } catch (error) {
    logger.error(`Error creating resource: ${error.message}`, {
      stack: error.stack,
      vendor: req.params.vendor,
      resourceType: req.params.resourceType
    });
    
    return res.status(500).json({
      success: false,
      error: `Failed to create resource: ${error.message}`,
      requestId: req.requestId
    });
  }
};

/**
 * Update a FHIR resource in EHR system
 * @route PUT /api/integration/:vendor/:resourceType/:id
 * @param {string} vendor - EHR vendor (epic, cerner)
 * @param {string} resourceType - FHIR resource type
 * @param {string} id - Resource ID
 * @returns {Object} Updated resource
 */
exports.updateResource = async (req, res) => {
  try {
    const { vendor, resourceType, id } = req.params;
    const resourceData = req.body;
    
    // Check if vendor is supported
    if (!ehrConnectors[vendor]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported EHR vendor: ${vendor}`
      });
    }
    
    // Generate operation ID for audit trail
    const operationId = uuidv4();
    
    // Log the operation request
    logger.info(`Updating ${resourceType}/${id} in ${vendor} [${operationId}]`, {
      userId: req.user.id,
      vendor,
      resourceType,
      resourceId: id,
      operationId
    });
    
    // Update resource
    const connector = ehrConnectors[vendor];
    const updatedResource = await connector.updateResource(resourceType, id, resourceData, {
      user: req.user
    });
    
    // Create audit log entry
    await AuditService.logFhirActivity(
      'FHIR_UPDATED',
      req.user,
      { resourceType, resourceId: id },
      req,
      { success: true }
    );
    
    return res.status(200).json({
      success: true,
      vendor,
      resourceType,
      resourceId: id,
      data: updatedResource
    });
  } catch (error) {
    logger.error(`Error updating resource: ${error.message}`, {
      stack: error.stack,
      vendor: req.params.vendor,
      resourceType: req.params.resourceType,
      resourceId: req.params.id
    });
    
    return res.status(500).json({
      success: false,
      error: `Failed to update resource: ${error.message}`,
      requestId: req.requestId
    });
  }
};

module.exports = exports;
