const mongoose = require('mongoose');

const deletionRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'rejected'],
      default: 'pending',
    },
    source: {
      type: String,
      enum: ['web_form', 'in_app', 'email_support'],
      default: 'web_form',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeletionRequest', deletionRequestSchema);
