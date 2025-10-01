const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: ['ticket_issued', 'ticket_validated', 'user_created', 'user_deleted', 'login', 'logout'],
    required: true,
  },
  details: {
    ticketID: String,
    ticketEmail: String,
    targetUser: String,
    ipAddress: String,
    userAgent: String,
  },
  result: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success',
  },
  errorMessage: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
activityLogSchema.index({ user: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);