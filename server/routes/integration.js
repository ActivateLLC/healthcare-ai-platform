/**
 * Enterprise EHR Integration Routes
 * 
 * This module defines routes for integrating with major EHR systems via FHIR API.
 * These routes enable secure, HIPAA-compliant data exchange with healthcare systems.
 * 
 * Strategic partners supported:
 * - Epic Systems (40% market share)
 * - Cerner/Oracle Health (25% market share)
 * 
 * Combined coverage: 65% of US hospital market
 */

const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRoles } = require('../middleware/security');
const ehrController = require('../controllers/integration/ehrController');

// Secure all integration routes
router.use(authenticateJWT);

/**
 * @route   GET /api/integration/vendors
 * @desc    Get available EHR vendors
 * @access  Private
 */
router.get('/vendors', ehrController.getAvailableVendors);

/**
 * @route   GET /api/integration/:vendor/metadata
 * @desc    Get FHIR capability statement for a specific EHR vendor
 * @access  Private
 */
router.get('/:vendor/metadata', ehrController.getCapabilityStatement);

/**
 * @route   GET /api/integration/:vendor/Patient
 * @desc    Search for patients in EHR system
 * @access  Private
 */
router.get('/:vendor/Patient', authorizeRoles(['admin', 'clinician']), ehrController.searchPatients);

/**
 * @route   GET /api/integration/:vendor/Patient/:id
 * @desc    Get patient by ID from EHR system
 * @access  Private
 */
router.get('/:vendor/Patient/:id', authorizeRoles(['admin', 'clinician']), ehrController.getPatient);

/**
 * @route   GET /api/integration/:vendor/Patient/:id/:resourceType
 * @desc    Get patient clinical data from EHR system
 * @access  Private
 */
router.get('/:vendor/Patient/:id/:resourceType', authorizeRoles(['admin', 'clinician']), ehrController.getPatientData);

/**
 * @route   POST /api/integration/:vendor/:resourceType
 * @desc    Create a FHIR resource in EHR system
 * @access  Private/Admin
 */
router.post('/:vendor/:resourceType', authorizeRoles(['admin', 'clinician']), ehrController.createResource);

/**
 * @route   PUT /api/integration/:vendor/:resourceType/:id
 * @desc    Update a FHIR resource in EHR system
 * @access  Private/Admin
 */
router.put('/:vendor/:resourceType/:id', authorizeRoles(['admin', 'clinician']), ehrController.updateResource);

module.exports = router;
