const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

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

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
      });
    }

    // Find user
    const user = await User.findOne({ 
      username: username.toLowerCase() 
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid credentials or account inactive',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Log failed login attempt
      await logActivity(
        user._id,
        'login',
        { username: username.toLowerCase() },
        'failure',
        'Invalid password'
      );

      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Log successful login
    await logActivity(
      user._id,
      'login',
      { username: username.toLowerCase() },
      'success'
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Server error during login',
    });
  }
};

// @desc    Register new user (Admin only)
// @route   POST /api/auth/register
// @access  Private (Admin only)
const register = async (req, res) => {
  try {
    const { username, email, password, role = 'issuer' } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User with this username or email already exists',
      });
    }

    // Create user
    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      role,
      createdBy: req.user._id,
    });

    await newUser.save();

    // Log user creation
    await logActivity(
      req.user._id,
      'user_created',
      {
        targetUser: newUser.username,
        targetEmail: newUser.email,
        targetRole: newUser.role,
      },
      'success'
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        details: Object.values(error.errors).map(err => err.message),
      });
    }

    res.status(500).json({
      error: 'Server error during registration',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getProfile = async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private (Admin only)
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('-password')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        users,
        count: users.length,
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Server error fetching users',
    });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        error: 'Cannot delete your own account',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Soft delete by setting isActive to false
    user.isActive = false;
    await user.save();

    // Log user deletion
    await logActivity(
      req.user._id,
      'user_deleted',
      {
        targetUser: user.username,
        targetEmail: user.email,
      },
      'success'
    );

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Server error deleting user',
    });
  }
};

module.exports = {
  login,
  register,
  getProfile,
  getUsers,
  deleteUser,
};