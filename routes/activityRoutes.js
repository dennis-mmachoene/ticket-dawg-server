const express = require('express');
const {
  getActivityLogs,
  getUserStats,
  getSystemStats,
} = require('../controllers/activityController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require admin authentication
router.use(authenticate);
router.use(requireAdmin);

// Activity log routes
router.get('/logs', getActivityLogs);
router.get('/user-stats/:userId', getUserStats);
router.get('/system-stats', getSystemStats);

module.exports = router;