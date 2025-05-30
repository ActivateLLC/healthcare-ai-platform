import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import FhirTemplates from './pages/FhirTemplates';
import TemplateDetail from './pages/TemplateDetail';
import FhirGenerator from './pages/FhirGenerator';
import ClinicalTextProcessor from './pages/ClinicalTextProcessor';
import Profile from './pages/Profile';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PrivateRoute from './components/PrivateRoute';

const App = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
          
          <Route path="/templates" element={
            <PrivateRoute>
              <FhirTemplates />
            </PrivateRoute>
          } />
          
          <Route path="/templates/:id" element={
            <PrivateRoute>
              <TemplateDetail />
            </PrivateRoute>
          } />
          
          <Route path="/generate" element={
            <PrivateRoute>
              <FhirGenerator />
            </PrivateRoute>
          } />
          
          <Route path="/process-clinical-text" element={
            <PrivateRoute>
              <ClinicalTextProcessor />
            </PrivateRoute>
          } />
          
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default App;
