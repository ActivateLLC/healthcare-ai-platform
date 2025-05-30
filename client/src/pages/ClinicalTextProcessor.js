import React, { useState } from 'react';
import axios from 'axios';

const ClinicalTextProcessor = () => {
  const [formData, setFormData] = useState({
    text: '',
    outputResourceTypes: ['Condition', 'Observation', 'Procedure']
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });
  const [activeTab, setActiveTab] = useState(0);

  const { text, outputResourceTypes } = formData;

  const availableResourceTypes = [
    'Condition',
    'Observation',
    'Procedure',
    'MedicationStatement',
    'AllergyIntolerance',
    'DiagnosticReport',
    'Immunization'
  ];

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleResourceType = type => {
    const updatedTypes = [...outputResourceTypes];
    
    if (updatedTypes.includes(type)) {
      // Remove type
      const index = updatedTypes.indexOf(type);
      updatedTypes.splice(index, 1);
    } else {
      // Add type
      updatedTypes.push(type);
    }
    
    setFormData({ ...formData, outputResourceTypes: updatedTypes });
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setAlert({ type: '', message: '' });
    
    if (!text) {
      setAlert({ type: 'error', message: 'Please provide clinical text to process' });
      setLoading(false);
      return;
    }

    if (outputResourceTypes.length === 0) {
      setAlert({ type: 'error', message: 'Please select at least one resource type to extract' });
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post('/api/ai/process-clinical-text', formData);
      setResults(res.data.data);
      setActiveTab(0);
      setAlert({ type: 'success', message: `Successfully extracted ${res.data.data.length} FHIR resources` });
    } catch (err) {
      setAlert({ 
        type: 'error', 
        message: err.response?.data?.error || 'Error processing clinical text' 
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (index) => {
    navigator.clipboard.writeText(JSON.stringify(results[index], null, 2));
    setAlert({ type: 'success', message: 'Copied to clipboard' });
  };

  const saveAsTemplate = (index) => {
    // Navigate to template creation with pre-populated data
    // This would typically be implemented with React Router's navigate function
    alert(`This would save resource #${index + 1} as a template`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Process Clinical Text
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Extract structured FHIR resources from clinical narratives using AI
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
                <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
                  Clinical Text
                </label>
                <textarea
                  id="text"
                  name="text"
                  rows={12}
                  value={text}
                  onChange={onChange}
                  placeholder="Paste clinical notes, discharge summaries, or other medical text here to extract structured FHIR resources"
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="mb-4">
                <span className="block text-sm font-medium text-gray-700 mb-2">
                  Resources to Extract
                </span>
                <div className="flex flex-wrap gap-2">
                  {availableResourceTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleResourceType(type)}
                      className={`inline-flex items-center px-3 py-1.5 border ${
                        outputResourceTypes.includes(type)
                          ? 'bg-blue-100 border-blue-500 text-blue-800'
                          : 'bg-white border-gray-300 text-gray-700'
                      } text-xs font-medium rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Select the types of FHIR resources you want to extract from the clinical text
                </p>
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
                  ) : 'Process Clinical Text'}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Tips for Best Results
            </h3>
            <ul className="list-disc pl-5 text-sm text-gray-500 space-y-2">
              <li>Include patient demographics when available (age, gender)</li>
              <li>Provide complete sentences rather than bullet points</li>
              <li>Include specific measurements with units (e.g., "blood pressure 120/80 mmHg")</li>
              <li>Mention specific dates when available</li>
              <li>Include medication dosages and frequencies when relevant</li>
              <li>For complex clinical text, select fewer resource types for more accurate extraction</li>
            </ul>
          </div>
        </div>

        <div>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Extracted FHIR Resources
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {results.length > 0 
                  ? `${results.length} resources extracted from clinical text` 
                  : 'Process clinical text to see extracted resources here'}
              </p>
            </div>

            {results.length > 0 ? (
              <>
                <div className="border-t border-gray-200">
                  <div className="flex overflow-x-auto">
                    {results.map((result, index) => (
                      <button
                        key={index}
                        className={`px-4 py-2 text-sm font-medium ${
                          activeTab === index
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                        onClick={() => setActiveTab(index)}
                      >
                        {result.resourceType || `Resource ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-end space-x-2 mb-2">
                    <button
                      onClick={() => copyToClipboard(activeTab)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => saveAsTemplate(activeTab)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Save as Template
                    </button>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-[60vh]">
                    <pre className="text-xs text-gray-800">
                      {JSON.stringify(results[activeTab], null, 2)}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 px-4 sm:px-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No resources extracted yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Process clinical text to extract structured FHIR resources.
                </p>
                <p className="mt-4 text-sm text-gray-500">
                  Example: "John Smith is a 45-year-old male with a history of type 2 diabetes diagnosed in 2020. Recent A1C was 7.2% on 2025-03-15. Currently taking Metformin 1000mg twice daily."
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicalTextProcessor;
