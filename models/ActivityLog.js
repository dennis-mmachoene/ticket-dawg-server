const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  // Optional: a failed login for an unknown username has no user.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
  action: {
    type: String,
    enum: ['ticket_issued', 'ticket_validated', 'user_created', 'user_updated', 'user_deleted', 'login', 'logout'],
    required: true,
  },
  // Flexible so any detail (username, qrCode, targetUser, note, ...) is stored, not silently dropped.
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  result: { type: String, enum: ['success', 'failure', 'warning'], default: 'success' },
  errorMessage: String,
  timestamp: { type: Date, default: Date.now },
});

activityLogSchema.index({ user: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
