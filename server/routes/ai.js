const express = require('express');
const {
  generateResource,
  explainResource,
  validateResource,
  processClinicalText
} = require('../controllers/ai');

const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

router.post('/generate', generateResource);
router.post('/explain', explainResource);
router.post('/validate', validateResource);
router.post('/process-clinical-text', processClinicalText);

module.exports = router;
