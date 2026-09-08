const jwt = require('jsonwebtoken');
const User = require('../models/User');

// How often to refresh "last active" (throttled to avoid a DB write per request)
const SESSION_TOUCH_MS = 60 * 1000;

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No valid token provided.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token or user is inactive.' });
    }

    // Single active session: the token must carry the session id currently on the user.
    if (!decoded.sid || user.activeSessionId !== decoded.sid) {
      return res.status(401).json({
        error: 'Session ended. This account was signed in on another device.',
        code: 'SESSION_REPLACED',
      });
    }

    // Keep the session "alive" so an abandoned one frees up after the idle window.
    const now = Date.now();
    const last = user.sessionLastActiveAt ? new Date(user.sessionLastActiveAt).getTime() : 0;
    if (now - last > SESSION_TOUCH_MS) {
      user.sessionLastActiveAt = new Date(now);
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

const hasPerm = (user, perm) =>
  user.role === 'admin' || (user.permissions || []).includes(perm);

const requireIssue = (req, res, next) => {
  if (!hasPerm(req.user, 'issue')) {
    return res.status(403).json({ error: 'Access denied. You do not have permission to issue tickets.' });
  }
  next();
};

const requireScan = (req, res, next) => {
  if (!hasPerm(req.user, 'scan')) {
    return res.status(403).json({ error: 'Access denied. You do not have permission to scan tickets.' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireIssue, requireScan };
