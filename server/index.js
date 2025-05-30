/**
 * Healthcare AI Platform - Enterprise Server
 * HIPAA-Compliant | FHIR-Compatible | Enterprise-Ready
 * 
 * This application implements comprehensive security controls required for
 * healthcare applications handling Protected Health Information (PHI):
 * - 45 CFR § 164.312(a)(1) - Access control
 * - 45 CFR § 164.312(b) - Audit controls
 * - 45 CFR § 164.312(c)(1) - Integrity
 * - 45 CFR § 164.312(e)(1) - Transmission security
 */

// Load environment variables
require('dotenv').config();

// Core dependencies
const express = require('express');
const path = require('path');

// Enterprise security & optimization
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');

// Custom modules
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { configureAppSecurity, requestAudit } = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const fhirRoutes = require('./routes/fhir');
const aiRoutes = require('./routes/ai');

// Import enterprise-grade routes (HIPAA & enterprise features)
const auditRoutes = require('./routes/audit');
const integrationRoutes = require('./routes/integration');

// Initialize express with enterprise configuration
const app = express();

// Enterprise startup banner
logger.info('╔════════════════════════════════════════════════════════════════╗');
logger.info('║               HEALTHCARE AI PLATFORM - ENTERPRISE             ║');
logger.info('║       HIPAA-Compliant | FHIR-Compatible | AI-Powered          ║');
logger.info('╚════════════════════════════════════════════════════════════════╝');

// Connect to Database with enterprise configuration
logger.info('Connecting to MongoDB Atlas with enterprise configuration...');
connectDB()
  .then(() => {
    logger.info('Database connection established successfully');
  })
  .catch(err => {
    logger.error(`Database connection failed: ${err.message}`);
    // In production, we would implement auto-recovery here
  });

// Enterprise-grade middleware stack

// 1. Basic request parsing
app.use(express.json({ limit: '1mb' })); // Limit payload size for security
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 2. Configure all security middleware
configureAppSecurity(app);

// 3. Performance optimization
app.use(compression()); // Compress all responses

// 4. Data sanitization
app.use(mongoSanitize()); // Prevent NoSQL injection

// 5. Request auditing - HIPAA compliance
app.use(requestAudit);

// Define Routes with enterprise configuration
logger.info('Initializing API routes...');

// Standard API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/fhir', fhirRoutes);
app.use('/api/ai', aiRoutes);

// Enterprise features
app.use('/api/audit', auditRoutes); // HIPAA audit capabilities
app.use('/api/integration', integrationRoutes); // EHR integration capabilities

// Health check endpoint for monitoring systems
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
  });
}

// Enterprise-grade error handling middleware
// Must be defined after all routes
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  // Log error with appropriate severity
  if (statusCode >= 500) {
    logger.error(`Server error: ${err.message}`, {
      stack: err.stack,
      requestId: req.requestId
    });
  } else {
    logger.warn(`Client error: ${err.message}`, {
      requestId: req.requestId
    });
  }
  
  // Send appropriate response
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' // Generic message in production
      : err.message, // Detailed message in development
    requestId: req.requestId // For tracking in logs
  });
});

// 404 handler - must be defined after all routes
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
    requestId: req.requestId
  });
  
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    requestId: req.requestId
  });
});

// Server configuration
const PORT = process.env.PORT || 5001; // Default to 5001 per previous update

// Enterprise-grade server startup with graceful shutdown
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  logger.info(`API Documentation: http://localhost:${PORT}/api/docs`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Promise Rejection: ${err.message}`, { stack: err.stack });
  
  // Graceful shutdown in production, immediate exit in development
  if (process.env.NODE_ENV === 'production') {
    logger.info('Gracefully shutting down server...');
    server.close(() => {
      logger.info('Server shutdown complete');
      process.exit(1);
    });
    
    // Force shutdown after timeout if graceful shutdown fails
    setTimeout(() => {
      logger.error('Forced server shutdown due to timeout');
      process.exit(1);
    }, 10000);
  } else {
    // In development, exit immediately to show the error clearly
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

// Handle SIGTERM (e.g., from Kubernetes)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Graceful shutdown initiated...');
  server.close(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

module.exports = server; // Export for testing
