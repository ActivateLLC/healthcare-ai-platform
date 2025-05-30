import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const FhirTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: '', message: '' });
  const [filters, setFilters] = useState({
    resourceType: '',
    searchTerm: '',
    version: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/fhir/templates');
      setTemplates(res.data.data);
      setLoading(false);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.error || 'Error fetching templates'
      });
      setLoading(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await axios.delete(`/api/fhir/templates/${id}`);
      setTemplates(templates.filter(template => template._id !== id));
      setAlert({
        type: 'success',
        message: 'Template deleted successfully'
      });
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.error || 'Error deleting template'
      });
    }
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const resetFilters = () => {
    setFilters({
      resourceType: '',
      searchTerm: '',
      version: ''
    });
  };

  const filteredTemplates = templates.filter(template => {
    // Filter by resource type
    if (filters.resourceType && template.resourceType !== filters.resourceType) {
      return false;
    }
    
    // Filter by version
    if (filters.version && template.version !== filters.version) {
      return false;
    }
    
    // Filter by search term (name or description)
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      return (
        template.name.toLowerCase().includes(searchTerm) ||
        template.description.toLowerCase().includes(searchTerm)
      );
    }
    
    return true;
  });

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
    'Immunization',
    'Custom'
  ];

  const fhirVersions = ['DSTU2', 'STU3', 'R4', 'R5'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            FHIR Templates
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage reusable FHIR resource templates
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            to="/templates/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create Template
          </Link>
        </div>
      </div>

      {alert.message && (
        <div className={`mb-4 p-4 rounded-md ${
          alert.type === 'error' ? 'bg-red-50 text-red-800' : 
          'bg-green-50 text-green-800'
        }`}>
          {alert.message}
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Filter Templates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                name="searchTerm"
                id="searchTerm"
                value={filters.searchTerm}
                onChange={handleFilterChange}
                placeholder="Search by name or description"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="resourceType" className="block text-sm font-medium text-gray-700">
                Resource Type
              </label>
              <select
                id="resourceType"
                name="resourceType"
                value={filters.resourceType}
                onChange={handleFilterChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">All Types</option>
                {resourceTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-gray-700">
                FHIR Version
              </label>
              <select
                id="version"
                name="version"
                value={filters.version}
                onChange={handleFilterChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">All Versions</option>
                {fhirVersions.map(version => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-4 text-right">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredTemplates.map((template) => (
              <li key={template._id}>
                <div className="px-4 py-4 flex items-center sm:px-6">
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <div className="flex text-sm">
                        <Link
                          to={`/templates/${template._id}`}
                          className="font-medium text-blue-600 truncate hover:text-blue-500"
                        >
                          {template.name}
                        </Link>
                        <p className="ml-1 flex-shrink-0 font-normal text-gray-500">
                          {template.isPublic ? '(Public)' : '(Private)'}
                        </p>
                      </div>
                      <div className="mt-2 flex">
                        <div className="flex items-center text-sm text-gray-500">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            template.resourceType === 'Patient' ? 'bg-green-100 text-green-800' :
                            template.resourceType === 'Observation' ? 'bg-blue-100 text-blue-800' :
                            template.resourceType === 'Condition' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {template.resourceType}
                          </span>
                          <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            {template.version}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        {template.description.length > 100
                          ? template.description.substring(0, 100) + '...'
                          : template.description}
                      </p>
                    </div>
                    <div className="mt-4 flex-shrink-0 sm:mt-0">
                      <div className="flex overflow-hidden">
                        <Link
                          to={`/templates/${template._id}`}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          View
                        </Link>
                        <Link
                          to={`/templates/${template._id}/edit`}
                          className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => deleteTemplate(template._id)}
                          className="ml-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-12 bg-white shadow overflow-hidden sm:rounded-md">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No templates found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new template.
          </p>
          <div className="mt-6">
            <Link
              to="/templates/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Template
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default FhirTemplates;
