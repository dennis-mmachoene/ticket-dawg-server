const ActivityLog = require('../models/ActivityLog');

// Single shared activity logger. userId may be null (e.g. failed login for an unknown username).
// Every failure/warning is also printed to stdout so it shows up in the live server logs
// (morgan logs the HTTP line + status; this adds the human reason, e.g. "Invalid password").
const logActivity = async (userId, action, details = {}, result = 'success', errorMessage = null) => {
  try {
    if (result === 'failure' || result === 'warning') {
      const who = (details && (details.username || details.targetUser)) || userId || 'unknown';
      const extra = details && Object.keys(details).length ? ` ${JSON.stringify(details)}` : '';
      const line = `[activity] ${result.toUpperCase()} ${action} user=${who} reason=${errorMessage || '-'}${extra}`;
      if (result === 'failure') console.error(line);
      else console.warn(line);
    }
    await ActivityLog.create({ user: userId || null, action, details, result, errorMessage });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

module.exports = { logActivity };
