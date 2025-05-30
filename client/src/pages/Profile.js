import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Profile = () => {
  const [user, setUser] = useState({
    name: '',
    email: '',
    role: '',
    organization: '',
    specialty: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const config = {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        };

        const res = await axios.get('/api/users/me', config);
        setUser(res.data.data);
        setLoading(false);
      } catch (err) {
        setError('Error fetching profile. Please try again.');
        setLoading(false);
        console.error('Profile fetch error:', err);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
          <h1 className="text-white text-2xl font-bold">User Profile</h1>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        <div className="p-6">
          <div className="flex items-center mb-6">
            <div className="bg-blue-100 rounded-full p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-semibold text-gray-800">{user.name || 'Healthcare Professional'}</h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Role</h3>
              <p className="text-gray-800 font-medium">{user.role || 'Not specified'}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Organization</h3>
              <p className="text-gray-800 font-medium">{user.organization || 'Not specified'}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Specialty</h3>
              <p className="text-gray-800 font-medium">{user.specialty || 'Not specified'}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Account Created</h3>
              <p className="text-gray-800 font-medium">{new Date(user.createdAt || Date.now()).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 py-4">
          <h2 className="text-white text-xl font-bold">Platform Usage</h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">12</p>
              <p className="text-sm text-gray-600">FHIR Resources Generated</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-700">5</p>
              <p className="text-sm text-gray-600">Templates Created</p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-700">8</p>
              <p className="text-sm text-gray-600">Clinical Documents Processed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
