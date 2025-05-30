const { 
  generateFhirResource, 
  explainFhirResource, 
  validateFhirResource 
} = require('../services/ai');

// @desc    Generate FHIR resource from natural language
// @route   POST /api/ai/generate
// @access  Private
exports.generateResource = async (req, res) => {
  try {
    const { prompt, resourceType, fhirVersion = 'R4' } = req.body;

    if (!prompt || !resourceType) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a prompt and resourceType'
      });
    }

    const fhirResource = await generateFhirResource(prompt, resourceType, fhirVersion);

    res.status(200).json({
      success: true,
      data: fhirResource
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Error generating FHIR resource'
    });
  }
};

// @desc    Explain FHIR resource in plain English
// @route   POST /api/ai/explain
// @access  Private
exports.explainResource = async (req, res) => {
  try {
    const { resource } = req.body;

    if (!resource) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a FHIR resource'
      });
    }

    const explanation = await explainFhirResource(resource);

    res.status(200).json({
      success: true,
      data: explanation
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Error explaining FHIR resource'
    });
  }
};

// @desc    Validate FHIR resource
// @route   POST /api/ai/validate
// @access  Private
exports.validateResource = async (req, res) => {
  try {
    const { resource, fhirVersion = 'R4' } = req.body;

    if (!resource) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a FHIR resource'
      });
    }

    const validationResults = await validateFhirResource(resource, fhirVersion);

    res.status(200).json({
      success: true,
      data: validationResults
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Error validating FHIR resource'
    });
  }
};

// @desc    Process clinical text to structured FHIR
// @route   POST /api/ai/process-clinical-text
// @access  Private
exports.processClinicalText = async (req, res) => {
  try {
    const { text, outputResourceTypes = ['Condition', 'Observation', 'Procedure'] } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Please provide clinical text'
      });
    }

    // For each requested resource type, generate a FHIR resource
    const resources = [];
    for (const resourceType of outputResourceTypes) {
      const prompt = `Extract relevant ${resourceType} information from this clinical text and create a valid FHIR resource: ${text}`;
      const resource = await generateFhirResource(prompt, resourceType, 'R4');
      resources.push(resource);
    }

    res.status(200).json({
      success: true,
      data: resources
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Error processing clinical text'
    });
  }
};
