const Anthropic = require('anthropic');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate FHIR-compliant resource based on natural language input
 * @param {string} prompt - User's natural language request
 * @param {string} resourceType - FHIR resource type (Patient, Observation, etc.)
 * @param {string} fhirVersion - FHIR version (R4, STU3, etc.)
 * @returns {Object} FHIR-compliant resource JSON
 */
exports.generateFhirResource = async (prompt, resourceType, fhirVersion = 'R4') => {
  try {
    const systemPrompt = `You are a FHIR-compliant healthcare data expert. Your task is to generate valid ${fhirVersion} FHIR resources based on user requests.
    
For the resource type "${resourceType}", create a complete and valid FHIR resource that includes all required fields and appropriate optional fields.
Follow these rules:
1. Ensure the resource follows the official ${fhirVersion} FHIR specification exactly
2. Include proper resource type, id, and metadata
3. Use realistic but synthetic data (never use real PHI)
4. Return only the JSON resource without explanations or markdown formatting
5. Ensure all dates are in proper ISO format
6. Include appropriate extensions where needed
7. Follow FHIR best practices for references between resources`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2
    });

    // Extract JSON from the response
    const content = response.content[0].text;
    
    // Try to parse the response as JSON
    try {
      // If the response is already JSON, just parse it
      const fhirResource = JSON.parse(content);
      return fhirResource;
    } catch (parseError) {
      // If parsing fails, try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // If no JSON found, throw error
      throw new Error("Failed to extract valid JSON from AI response");
    }
  } catch (error) {
    console.error('AI service error:', error);
    throw error;
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
      model: "claude-3-5-sonnet-20240620",
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
      model: "claude-3-5-sonnet-20240620",
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
