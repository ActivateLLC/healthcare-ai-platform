const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Enterprise-grade MongoDB connection with automatic retries,
 * connection pooling, and HIPAA-compliant logging
 */
const connectDB = async () => {
  try {
    // Configure MongoDB connection options for healthcare enterprise use
    const options = {
      // These are deprecated but left for backward compatibility
      useNewUrlParser: true,
      useUnifiedTopology: true,
      
      // Enterprise-grade connection options
      maxPoolSize: 50, // Increased connection pool for enterprise load
      minPoolSize: 10, // Maintain minimum connections for availability
      serverSelectionTimeoutMS: 30000, // Longer timeout for high availability
      socketTimeoutMS: 45000, // Longer socket timeout for larger transactions
      family: 4, // Force IPv4 (more reliable in some enterprise environments)
      ssl: process.env.NODE_ENV === 'production', // SSL in production
      retryWrites: true, // Auto-retry failed write operations
      retryReads: true, // Auto-retry failed read operations
      writeConcern: { w: 'majority' }, // Ensure data durability across replicas
      readPreference: 'secondaryPreferred', // Optimize read performance
    };

    // Connect with enhanced options
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    // HIPAA-compliant logging (no PHI)
    logger.info(`MongoDB Connected: ${conn.connection.host} (DB: ${conn.connection.name})`);
    
    // Set up connection monitoring for high availability
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });

    return conn;
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    // Don't exit process in production - allow for graceful recovery
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    throw err; // Re-throw for handling by caller in production
  }
};

module.exports = connectDB;
