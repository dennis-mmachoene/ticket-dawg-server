const ActivityLog = require('../models/ActivityLog');

// Single shared activity logger. userId may be null (e.g. failed login for an unknown username).
const logActivity = async (userId, action, details = {}, result = 'success', errorMessage = null) => {
  try {
    await ActivityLog.create({ user: userId || null, action, details, result, errorMessage });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

module.exports = { logActivity };
