const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

/**
 * Enterprise-grade Anthropic Claude integration with:  
 * - HIPAA compliance controls
 * - Performance optimization
 * - Automatic retries for API failures
 * - Comprehensive error handling
 * - Audit logging for regulatory compliance
 */

// Initialize Anthropic client with enterprise configuration
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Additional enterprise options
  maxRetries: 3,                    // Retry failed API calls
  timeout: 120 * 1000,              // Extended timeout for complex healthcare requests
});

// Security validation patterns
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,                   // SSN pattern
  /\b\d{3}-\d{3}-\d{4}\b/,                   // Phone number pattern
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,  // Email pattern
  /\b(MRN|Medical Record Number|Record Number)\s*[:.]?\s*\d+\b/i  // Medical record numbers
];

/**
 * Sanitize input to prevent PII/PHI from being sent to external AI services
 * @param {string} text - Input text to sanitize
 * @returns {string} - Sanitized text
 */
const sanitizeInput = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  let sanitized = text;
  
  // Replace potential PHI patterns with placeholders
  PHI_PATTERNS.forEach((pattern, index) => {
    sanitized = sanitized.replace(pattern, `[REDACTED-${index}]`);
  });
  
  return sanitized;
};

/**
 * Audit log for AI API calls (HIPAA compliance)
 * @param {string} operation - The operation being performed
 * @param {string} resourceType - The FHIR resource type being processed
 * @param {Object} metadata - Additional metadata for audit purposes
 */
const auditLog = (operation, resourceType, metadata = {}) => {
  // Create HIPAA-compliant audit record - no PHI included
  const auditRecord = {
    timestamp: new Date().toISOString(),
    operation,
    resourceType,
    userId: metadata.userId || 'system',
    success: metadata.success || true,
    // Explicitly avoid logging any content that might contain PHI
  };
  
  // Log using the HIPAA-compliant logger
  logger.info(`AI Service: ${operation} on ${resourceType}`, { audit: auditRecord });
};

/**
 * Generate FHIR-compliant resource based on natural language input
 * @param {string} prompt - User's natural language request
 * @param {string} resourceType - FHIR resource type (Patient, Observation, etc.)
 * @param {string} fhirVersion - FHIR version (R4, STU3, etc.)
 * @returns {Object} FHIR-compliant resource JSON
 */
/**
 * Generate FHIR-compliant resource based on natural language input with HIPAA safeguards
 * @param {string} prompt - User's natural language request (sanitized before processing)
 * @param {string} resourceType - FHIR resource type (Patient, Observation, etc.)
 * @param {string} fhirVersion - FHIR version (R4, STU3, etc.)
 * @param {object} options - Additional options including user context for audit logging
 * @returns {Object} FHIR-compliant resource JSON
 */
exports.generateFhirResource = async (prompt, resourceType, fhirVersion = 'R4', options = {}) => {
  // Start performance timing for analytics
  const startTime = Date.now();
  
  try {
    // HIPAA compliance: Sanitize input to prevent PHI transmission
    const sanitizedPrompt = sanitizeInput(prompt);
    
    // Create audit log entry for this operation
    auditLog('generateFhirResource', resourceType, {
      userId: options.userId || 'anonymous',
      fhirVersion
    });
    
    // Enhanced system prompt with enterprise healthcare focus
    const systemPrompt = `You are a FHIR-compliant healthcare data expert working in an enterprise healthcare environment. Your task is to generate valid ${fhirVersion} FHIR resources based on user requests.
    
For the resource type "${resourceType}", create a complete and valid FHIR resource that includes all required fields and appropriate optional fields.
Follow these strict enterprise healthcare rules:
1. Ensure the resource follows the official ${fhirVersion} FHIR specification exactly
2. Include proper resource type, id, and metadata with enterprise-appropriate identifiers
3. Use realistic but completely synthetic data (never use real PHI)
4. Return only the JSON resource without explanations or markdown formatting
5. Ensure all dates are in proper ISO format with timezone information
6. Include appropriate extensions where needed for enterprise interoperability
7. Follow FHIR best practices for references between resources
8. Include appropriate security tags for enterprise environments
9. Ensure all terminologies use standard coding systems (SNOMED CT, LOINC, RxNorm)
10. Include proper versioning information for enterprise tracking`;

    // Enhanced API call with retry capability and timeout management
    logger.debug(`Calling Claude API for ${resourceType} generation`, { resourceType, fhirVersion });
    
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: sanitizedPrompt
        }
      ],
      temperature: 0.2,
      // Enterprise-grade request configuration
      metadata: {
        // Include metadata for audit and tracking, but no PHI
        user_id: options.userId || 'anonymous',
        resource_type: resourceType,
        fhir_version: fhirVersion
      }
    });

    // Extract JSON from the response
    const content = response.content[0].text;
    
    // Try to parse the response as JSON
    let fhirResource;
    try {
      // If the response is already JSON, just parse it
      fhirResource = JSON.parse(content);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        fhirResource = JSON.parse(jsonMatch[1]);
      } else {
        // If no JSON found, throw error
        throw new Error("Failed to extract valid JSON from AI response");
      }
    }
    
    // Validate the generated resource has the correct resourceType
    if (fhirResource.resourceType !== resourceType) {
      logger.warn(`Generated resource type mismatch: requested ${resourceType} but got ${fhirResource.resourceType}`);
      // Auto-correct the resource type for consistency
      fhirResource.resourceType = resourceType;
    }
    
    // Log success (with no PHI)
    const duration = Date.now() - startTime;
    logger.info(`Successfully generated ${resourceType} FHIR resource in ${duration}ms`, {
      resourceType,
      fhirVersion,
      duration,
      // No content/PHI logged
    });
    
    return fhirResource;
  } catch (error) {
    // Enhanced error handling and logging
    const duration = Date.now() - startTime;
    logger.error(`Error generating FHIR resource: ${error.message}`, {
      resourceType,
      fhirVersion,
      duration,
      errorType: error.name,
      errorCode: error.status || error.code,
      // Never include the original prompt (might contain PHI)
    });
    
    // Update audit log with failure
    auditLog('generateFhirResource_failure', resourceType, {
      userId: options.userId || 'anonymous',
      errorType: error.name,
      duration
    });
    
    // Throw a sanitized error for API response
    throw new Error(`Failed to generate FHIR ${resourceType} resource: ${error.message}`);
  }
};

/**
 * Generate explanations for FHIR resources in plain English
 * @param {Object} fhirResource - FHIR resource JSON
 * @returns {string} Plain English explanation
 */
exports.explainFhirResource = async (fhirResource) => {
  try {
    const systemPrompt = `You are a FHIR-compliant healthcare data expert who explains complex FHIR resources in plain English for healthcare professionals.
    
Provide a clear, concise explanation of the FHIR resource that:
1. Identifies the resource type and key identifiers
2. Highlights the important clinical/administrative information
3. Explains the relationships to other resources
4. Notes any extensions or unusual elements
5. Uses healthcare terminology appropriate for professionals`;

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Explain this FHIR resource in plain English:\n\n${JSON.stringify(fhirResource, null, 2)}`
        }
      ],
      temperature: 0.3
    });

    return response.content[0].text;
  } catch (error) {
    console.error('AI explanation service error:', error);
    throw error;
  }
};

/**
 * Generate FHIR validation issues and improvement suggestions
 * @param {Object} fhirResource - FHIR resource JSON
 * @param {string} fhirVersion - FHIR version (R4, STU3, etc.)
 * @returns {Object} Validation results with issues and suggestions
 */
exports.validateFhirResource = async (fhirResource, fhirVersion = 'R4') => {
  try {
    const systemPrompt = `You are a FHIR validation expert with deep knowledge of the ${fhirVersion} specification.
    
Analyze the provided FHIR resource and identify:
1. Compliance issues with the ${fhirVersion} specification
2. Missing required elements
3. Inconsistencies in data types or references
4. Suggestions for better adherence to FHIR best practices
5. Potential improvements for interoperability

Return your analysis as structured JSON with 'issues' (array of specific problems) and 'suggestions' (array of improvements).`;

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Validate this FHIR resource against ${fhirVersion} standards:\n\n${JSON.stringify(fhirResource, null, 2)}`
        }
      ],
      temperature: 0.2
    });

    // Extract JSON from the response
    const content = response.content[0].text;
    
    // Try to parse the response as JSON
    try {
      // If the response is already JSON, just parse it
      const validationResults = JSON.parse(content);
      return validationResults;
    } catch (parseError) {
      // If parsing fails, try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // If no JSON found, return a structured error
      return {
        issues: ["Failed to extract valid JSON from AI validation response"],
        suggestions: ["Try restructuring the resource and validating again"]
      };
    }
  } catch (error) {
    console.error('AI validation service error:', error);
    throw error;
  }
};
