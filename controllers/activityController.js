const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// Helper function to log activity
const logActivity = async (userId, action, details = {}, result = 'success', errorMessage = null) => {
  try {
    const activity = new ActivityLog({
      user: userId,
      action,
      details,
      result,
      errorMessage,
    });
    await activity.save();
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// @desc    Get activity logs with filters
// @route   GET /api/activity/logs
// @access  Private (Admin only)
const getActivityLogs = async (req, res) => {
  try {
    const { 
      userId, 
      action, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query;

    const filter = {};

    if (userId) filter.user = userId;
    if (action) filter.action = action;
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, totalCount] = await Promise.all([
      ActivityLog.find(filter)
        .populate('user', 'username email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ActivityLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({
      error: 'Server error fetching activity logs',
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/activity/user-stats/:userId
// @access  Private (Admin only)
const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const stats = await ActivityLog.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
    ]);

    const recentActivity = await ActivityLog.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(10);

    const successCount = await ActivityLog.countDocuments({
      user: userId,
      result: 'success',
    });

    const failureCount = await ActivityLog.countDocuments({
      user: userId,
      result: 'failure',
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        statistics: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        recentActivity,
        summary: {
          totalActions: successCount + failureCount,
          successCount,
          failureCount,
          successRate: successCount + failureCount > 0 
            ? ((successCount / (successCount + failureCount)) * 100).toFixed(2) 
            : 0,
        },
      },
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Server error fetching user statistics',
    });
  }
};

// @desc    Get overall system statistics
// @route   GET /api/activity/system-stats
// @access  Private (Admin only)
const getSystemStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    // Action breakdown
    const actionStats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
    ]);

    // User activity breakdown
    const userActivityStats = await ActivityLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          username: '$user.username',
          email: '$user.email',
          role: '$user.role',
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Daily activity for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyActivity = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        actionBreakdown: actionStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        topUsers: userActivityStats,
        dailyActivity,
      },
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      error: 'Server error fetching system statistics',
    });
  }
};

module.exports = {
  logActivity,
  getActivityLogs,
  getUserStats,
  getSystemStats,
};