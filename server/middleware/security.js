const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

/**
 * Enterprise-grade security middleware configuration
 * Implements HIPAA-compliant security controls for healthcare applications
 */

// Configure rate limiting to prevent brute force attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 429,
    message: 'Too many requests, please try again later.'
  },
  // Store for tracking request counts - would use Redis in production
  // store: new RedisStore({...})
});

// Set security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", process.env.NODE_ENV === 'production' ? 'https://*.anthropic.com' : '*'],
    }
  },
  // Force HTTPS in production
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  // Set appropriate X-Frame-Options
  frameguard: {
    action: 'deny'
  }
});

// Configure CORS for healthcare API security
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://healthcare-ai-platform.com', /\.healthcare-ai-platform\.com$/] 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id', 'X-HIPAA-Audit-Id'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

/**
 * Request audit middleware - generates unique request IDs and logs requests
 * for HIPAA compliance and debugging
 */
const requestAudit = (req, res, next) => {
  // Generate unique request ID (would use UUID in production)
  const requestId = Math.random().toString(36).substring(2, 15);
  req.requestId = requestId;
  
  // Set headers for tracking
  res.setHeader('X-Request-Id', requestId);
  
  // For HIPAA audit compliance
  if (req.user) {
    const auditId = `${Date.now()}-${req.user.id}-${requestId}`;
    res.setHeader('X-HIPAA-Audit-Id', auditId);
    req.auditId = auditId;
  }
  
  // Log request (sanitized - no PHI)
  logger.info(`API Request: ${req.method} ${req.originalUrl}`, {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user.id : 'unauthenticated',
    userAgent: req.get('user-agent'),
    // Explicitly avoid logging request body which might contain PHI
  });
  
  // Track response time
  const start = Date.now();
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[level](`API Response: ${res.statusCode} (${duration}ms)`, {
      requestId,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      // Explicitly avoid logging response body which might contain PHI
    });
  });
  
  next();
};

/**
 * Enhanced JWT authentication middleware with security controls
 * and HIPAA-compliant logging
 */
const authenticateJWT = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Authentication failed: No token provided', {
      requestId: req.requestId,
      path: req.originalUrl
    });
    
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }
  
  // Extract token
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token with enhanced security options
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'], // Explicitly specify algorithm
      maxAge: '1d' // Enforce 1 day maximum age
    });
    
    // Attach user info to request
    req.user = decoded;
    
    // Log authentication success (HIPAA audit trail)
    logger.info('Authentication successful', {
      requestId: req.requestId,
      userId: decoded.id,
      role: decoded.role || 'user'
    });
    
    next();
  } catch (error) {
    // Enhance security by providing different error messages
    // for different failure modes
    let message = 'Authentication failed. Please log in again.';
    let statusCode = 401;
    
    if (error.name === 'TokenExpiredError') {
      message = 'Your session has expired. Please log in again.';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid authentication token. Please log in again.';
    } else if (error.name === 'NotBeforeError') {
      message = 'Token not yet active. Please try again.';
    }
    
    logger.warn(`Authentication failed: ${error.name}`, {
      requestId: req.requestId,
      errorType: error.name,
      path: req.originalUrl
    });
    
    return res.status(statusCode).json({
      success: false,
      message
    });
  }
};

/**
 * Role-based access control middleware
 * Restricts access based on user role
 * @param {Array} roles - Array of roles allowed to access the route
 */
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        requestId: req.requestId,
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    
    next();
  };
};

// Export all middleware for use in main app
module.exports = {
  apiLimiter,
  securityHeaders,
  corsOptions,
  xssProtection: xss(),
  parameterPollution: hpp(),
  requestAudit,
  authenticateJWT,
  authorizeRoles,
  // Configure all security middleware in the correct order
  configureAppSecurity: (app) => {
    // Apply security headers
    app.use(securityHeaders);
    
    // Apply CORS configuration
    app.use(cors(corsOptions));
    
    // Apply rate limiting to all requests
    app.use('/api/', apiLimiter);
    
    // Prevent XSS attacks
    app.use(xss());
    
    // Prevent HTTP Parameter Pollution
    app.use(hpp());
    
    // Add request auditing for all requests
    app.use(requestAudit);
    
    logger.info('Enterprise security middleware configured successfully');
  }
};
