const FhirTemplate = require('../models/FhirTemplate');

// @desc    Get all FHIR templates
// @route   GET /api/fhir/templates
// @access  Private
exports.getTemplates = async (req, res) => {
  try {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Finding resource
    query = FhirTemplate.find(JSON.parse(queryStr));

    // Only return templates created by the user or public templates
    query = query.find({
      $or: [
        { creator: req.user.id },
        { isPublic: true }
      ]
    });

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await FhirTemplate.countDocuments({
      $or: [
        { creator: req.user.id },
        { isPublic: true }
      ]
    });

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const templates = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: templates.length,
      pagination,
      data: templates
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Get single FHIR template
// @route   GET /api/fhir/templates/:id
// @access  Private
exports.getTemplate = async (req, res) => {
  try {
    const template = await FhirTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Make sure user is template owner or template is public
    if (template.creator.toString() !== req.user.id && !template.isPublic) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this template'
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Create new FHIR template
// @route   POST /api/fhir/templates
// @access  Private
exports.createTemplate = async (req, res) => {
  try {
    // Add user to req.body
    req.body.creator = req.user.id;
    req.body.organization = req.user.organization;

    const template = await FhirTemplate.create(req.body);

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Update FHIR template
// @route   PUT /api/fhir/templates/:id
// @access  Private
exports.updateTemplate = async (req, res) => {
  try {
    let template = await FhirTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Make sure user is template owner
    if (template.creator.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to update this template'
      });
    }

    template = await FhirTemplate.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Delete FHIR template
// @route   DELETE /api/fhir/templates/:id
// @access  Private
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await FhirTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Make sure user is template owner
    if (template.creator.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to delete this template'
      });
    }

    await template.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};
