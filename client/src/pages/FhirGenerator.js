import React, { useState } from 'react';
import axios from 'axios';

const FhirGenerator = () => {
  const [formData, setFormData] = useState({
    prompt: '',
    resourceType: 'Patient',
    fhirVersion: 'R4'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  const { prompt, resourceType, fhirVersion } = formData;

  const resourceTypes = [
    'Patient',
    'Practitioner',
    'Organization',
    'Observation',
    'Medication',
    'MedicationRequest',
    'Encounter',
    'AllergyIntolerance',
    'Condition',
    'Procedure',
    'DiagnosticReport',
    'Immunization'
  ];

  const fhirVersions = ['DSTU2', 'STU3', 'R4', 'R5'];

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setAlert({ type: '', message: '' });
    
    if (!prompt) {
      setAlert({ type: 'error', message: 'Please provide a description of the FHIR resource to generate' });
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post('/api/ai/generate', formData);
      setResult(res.data.data);
      setAlert({ type: 'success', message: 'FHIR resource generated successfully' });
    } catch (err) {
      setAlert({ 
        type: 'error', 
        message: err.response?.data?.error || 'Error generating FHIR resource' 
      });
    } finally {
      setLoading(false);
    }
  };

  const validateResource = async () => {
    if (!result) return;
    
    setLoading(true);
    setAlert({ type: '', message: '' });
    
    try {
      const res = await axios.post('/api/ai/validate', {
        resource: result,
        fhirVersion
      });
      
      if (res.data.data.issues && res.data.data.issues.length > 0) {
        setAlert({ 
          type: 'warning', 
          message: `Validation found ${res.data.data.issues.length} issues` 
        });
      } else {
        setAlert({ 
          type: 'success', 
          message: 'Resource validation passed successfully' 
        });
      }
    } catch (err) {
      setAlert({ 
        type: 'error', 
        message: err.response?.data?.error || 'Error validating FHIR resource' 
      });
    } finally {
      setLoading(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!result) return;
    
    // Navigate to template creation with pre-populated data
    // This would typically be implemented with React Router's navigate function
    // but for simplicity we'll just alert
    alert('This would save the current resource as a template');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setAlert({ type: 'success', message: 'Copied to clipboard' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Generate FHIR Resources with AI
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Create standards-compliant FHIR resources using natural language descriptions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
            {alert.message && (
              <div className={`mb-4 p-4 rounded-md ${
                alert.type === 'error' ? 'bg-red-50 text-red-800' : 
                alert.type === 'success' ? 'bg-green-50 text-green-800' : 
                'bg-yellow-50 text-yellow-800'
              }`}>
                {alert.message}
              </div>
            )}
            
            <form onSubmit={onSubmit}>
              <div className="mb-4">
                <label htmlFor="resourceType" className="block text-sm font-medium text-gray-700">
                  Resource Type
                </label>
                <select
                  id="resourceType"
                  name="resourceType"
                  value={resourceType}
                  onChange={onChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  {resourceTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the type of FHIR resource you want to generate
                </p>
              </div>
              
              <div className="mb-4">
                <label htmlFor="fhirVersion" className="block text-sm font-medium text-gray-700">
                  FHIR Version
                </label>
                <select
                  id="fhirVersion"
                  name="fhirVersion"
                  value={fhirVersion}
                  onChange={onChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  {fhirVersions.map(version => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
                  Describe the Resource
                </label>
                <textarea
                  id="prompt"
                  name="prompt"
                  rows={5}
                  value={prompt}
                  onChange={onChange}
                  placeholder="Describe the FHIR resource you want to generate in natural language. For example: 'Create a patient resource for a 45-year-old male with diabetes type 2 and hypertension'"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : 'Generate FHIR Resource'}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              What is FHIR?
            </h3>
            <p className="text-sm text-gray-500">
              Fast Healthcare Interoperability Resources (FHIR) is a standard for healthcare data exchange, published by HL7. 
              It defines how healthcare information can be exchanged between different systems regardless of how it is stored.
            </p>
            <h4 className="text-md leading-6 font-medium text-gray-900 mt-4 mb-2">
              Tips for creating good FHIR resources:
            </h4>
            <ul className="list-disc pl-5 text-sm text-gray-500 space-y-1">
              <li>Be specific about the patient demographics</li>
              <li>Include relevant clinical information</li>
              <li>Specify any identifiers or coding systems</li>
              <li>Mention relationships to other resources if applicable</li>
              <li>Include dates in ISO format (YYYY-MM-DD) when possible</li>
            </ul>
          </div>
        </div>

        <div>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                Generated FHIR Resource
              </h2>
              {result && (
                <div className="flex space-x-2">
                  <button
                    onClick={validateResource}
                    disabled={loading}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Validate
                  </button>
                  <button
                    onClick={saveAsTemplate}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Save as Template
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>

            {result ? (
              <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-[70vh]">
                <pre className="text-xs text-gray-800">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No resource generated yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Fill out the form and generate a FHIR resource to see the result here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FhirGenerator;
