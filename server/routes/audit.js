const express = require('express');
const router = express.Router();
const AuditLog = require('../models/audit/AuditLog');
const AuditService = require('../services/audit');
const { authenticateJWT, authorizeRoles } = require('../middleware/security');
const logger = require('../utils/logger');

/**
 * Enterprise Audit Routes
 * HIPAA-Compliant Audit Trail API
 * 
 * These routes provide enterprise-grade audit capabilities required for:
 * - HIPAA Security Rule compliance (45 CFR § 164.312(b))
 * - SOC 2 compliance audits
 * - HITRUST certification
 * - ONC Health IT certification
 */

/**
 * @route   GET /api/audit/logs
 * @desc    Get audit logs with filtering (admin/compliance officer only)
 * @access  Private/Admin
 */
router.get('/logs', 
  authenticateJWT, 
  authorizeRoles(['admin', 'compliance_officer']), 
  async (req, res) => {
    try {
      // Extract query parameters
      const { 
        startDate,
        endDate, 
        eventType, 
        userId,
        resourceType,
        action,
        outcome,
        page = 1,
        limit = 50
      } = req.query;
      
      // Build query object
      const query = {};
      
      // Apply date range filter
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }
      
      // Apply event type filter
      if (eventType) query.eventType = eventType;
      
      // Apply user filter
      if (userId) query['actor.userId'] = userId;
      
      // Apply resource type filter
      if (resourceType) query['resource.resourceType'] = resourceType;
      
      // Apply action filter
      if (action) query.action = action;
      
      // Apply outcome filter
      if (outcome) query['outcome.status'] = outcome;
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Execute query with pagination
      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      
      // Get total count for pagination
      const total = await AuditLog.countDocuments(query);
      
      // Log the audit search itself (meta-audit)
      logger.info(`Audit log search performed by ${req.user.id}`, {
        requestId: req.requestId,
        userId: req.user.id,
        query: JSON.stringify(query)
      });
      
      // Return results
      return res.status(200).json({
        success: true,
        count: logs.length,
        total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        data: logs
      });
    } catch (error) {
      logger.error(`Error retrieving audit logs: ${error.message}`, {
        stack: error.stack,
        requestId: req.requestId
      });
      
      return res.status(500).json({
        success: false,
        error: 'Error retrieving audit logs',
        requestId: req.requestId
      });
    }
  }
);

/**
 * @route   GET /api/audit/stats
 * @desc    Get audit statistics for compliance dashboard
 * @access  Private/Admin
 */
router.get('/stats', 
  authenticateJWT, 
  authorizeRoles(['admin', 'compliance_officer']), 
  async (req, res) => {
    try {
      // Get current date and 30 days ago
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      // Get total events in last 30 days
      const totalEvents = await AuditLog.countDocuments({
        timestamp: { $gte: thirtyDaysAgo }
      });
      
      // Get events by type
      const eventsByType = await AuditLog.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Get events by outcome
      const eventsByOutcome = await AuditLog.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$outcome.status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Get events by resource type
      const eventsByResource = await AuditLog.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$resource.resourceType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Get daily event counts for trend analysis
      const dailyTrends = await AuditLog.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { 
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } 
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Return statistics
      return res.status(200).json({
        success: true,
        data: {
          totalEvents,
          eventsByType,
          eventsByOutcome,
          eventsByResource,
          dailyTrends
        }
      });
    } catch (error) {
      logger.error(`Error retrieving audit statistics: ${error.message}`, {
        stack: error.stack,
        requestId: req.requestId
      });
      
      return res.status(500).json({
        success: false,
        error: 'Error retrieving audit statistics',
        requestId: req.requestId
      });
    }
  }
);

/**
 * @route   GET /api/audit/compliance-report
 * @desc    Generate HIPAA compliance report
 * @access  Private/Admin
 */
router.get('/compliance-report', 
  authenticateJWT, 
  authorizeRoles(['admin', 'compliance_officer']), 
  async (req, res) => {
    try {
      // Extract date range
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }
      
      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Validate date range
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
      }
      
      // Generate report using audit service
      const report = await AuditService.generateComplianceReport({}, start, end);
      
      // Log report generation
      logger.info(`Compliance report generated by ${req.user.id}`, {
        requestId: req.requestId,
        userId: req.user.id,
        dateRange: `${startDate} to ${endDate}`
      });
      
      // Return report data
      return res.status(200).json({
        success: true,
        dateRange: {
          startDate,
          endDate
        },
        reportGeneratedAt: new Date().toISOString(),
        generatedBy: req.user.id,
        data: report
      });
    } catch (error) {
      logger.error(`Error generating compliance report: ${error.message}`, {
        stack: error.stack,
        requestId: req.requestId
      });
      
      return res.status(500).json({
        success: false,
        error: 'Error generating compliance report',
        requestId: req.requestId
      });
    }
  }
);

/**
 * @route   GET /api/audit/user-activity/:userId
 * @desc    Get activity history for a specific user
 * @access  Private/Admin
 */
router.get('/user-activity/:userId', 
  authenticateJWT, 
  authorizeRoles(['admin', 'compliance_officer']), 
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, page = 1, limit = 50 } = req.query;
      
      // Build query
      const query = { 'actor.userId': userId };
      
      // Apply date range filter
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Get user activity logs
      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      
      // Get total count for pagination
      const total = await AuditLog.countDocuments(query);
      
      // Return user activity
      return res.status(200).json({
        success: true,
        userId,
        count: logs.length,
        total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        data: logs
      });
    } catch (error) {
      logger.error(`Error retrieving user activity: ${error.message}`, {
        stack: error.stack,
        requestId: req.requestId
      });
      
      return res.status(500).json({
        success: false,
        error: 'Error retrieving user activity',
        requestId: req.requestId
      });
    }
  }
);

/**
 * @route   GET /api/audit/resource-activity/:resourceType/:resourceId
 * @desc    Get activity history for a specific resource
 * @access  Private/Admin
 */
router.get('/resource-activity/:resourceType/:resourceId', 
  authenticateJWT, 
  authorizeRoles(['admin', 'compliance_officer']), 
  async (req, res) => {
    try {
      const { resourceType, resourceId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      // Build query
      const query = {
        'resource.resourceType': resourceType,
        'resource.resourceId': resourceId
      };
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Get resource activity logs
      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      
      // Get total count for pagination
      const total = await AuditLog.countDocuments(query);
      
      // Return resource activity
      return res.status(200).json({
        success: true,
        resourceType,
        resourceId,
        count: logs.length,
        total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        },
        data: logs
      });
    } catch (error) {
      logger.error(`Error retrieving resource activity: ${error.message}`, {
        stack: error.stack,
        requestId: req.requestId
      });
      
      return res.status(500).json({
        success: false,
        error: 'Error retrieving resource activity',
        requestId: req.requestId
      });
    }
  }
);

module.exports = router;
