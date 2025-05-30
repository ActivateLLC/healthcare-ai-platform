const mongoose = require('mongoose');

const FhirTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a template name'],
    unique: true,
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  resourceType: {
    type: String,
    required: [true, 'Please specify the FHIR resource type'],
    enum: [
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
    ]
  },
  template: {
    type: Object,
    required: [true, 'Please provide the FHIR resource template']
  },
  version: {
    type: String,
    default: 'R4',
    enum: ['DSTU2', 'STU3', 'R4', 'R5']
  },
  creator: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: String,
    required: [true, 'Please add the organization']
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create index for faster queries
FhirTemplateSchema.index({ name: 1, organization: 1 });

// Update the updatedAt field on save
FhirTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('FhirTemplate', FhirTemplateSchema);
