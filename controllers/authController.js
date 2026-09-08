const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { sendAccountEmail } = require('../services/emailService');

// A session is considered "active" until this many minutes of inactivity pass.
const SESSION_IDLE_MS = (parseInt(process.env.SESSION_IDLE_MINUTES, 10) || 20) * 60 * 1000;

const logActivity = async (userId, action, details = {}, result = 'success', errorMessage = null) => {
  try {
    await ActivityLog.create({ user: userId, action, details, result, errorMessage });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

const generateToken = (userId, sid) =>
  jwt.sign({ id: userId, sid }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  permissions: user.permissions || [],
});

// @desc Login  @route POST /api/auth/login  @access Public
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials or account inactive' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await logActivity(user._id, 'login', { username: user.username }, 'failure', 'Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Single active session. Staff are blocked while a session is still active.
    // The admin always takes over (kicks the old session) so they can never be locked out.
    const now = Date.now();
    const last = user.sessionLastActiveAt ? new Date(user.sessionLastActiveAt).getTime() : 0;
    const sessionActive = user.activeSessionId && now - last < SESSION_IDLE_MS;

    if (sessionActive && user.role !== 'admin') {
      await logActivity(user._id, 'login', { username: user.username }, 'failure', 'Blocked: already signed in');
      return res.status(409).json({
        error:
          'This account is already signed in on another device. Log out there first, wait a few minutes, or ask the admin to force a logout.',
        code: 'SESSION_ACTIVE',
      });
    }

    const sid = crypto.randomUUID();
    user.activeSessionId = sid;
    user.sessionLastActiveAt = new Date(now);
    await user.save();

    const token = generateToken(user._id, sid);
    await logActivity(user._id, 'login', { username: user.username }, 'success');

    res.json({
      success: true,
      message: 'Login successful',
      data: { token, user: publicUser(user) },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// @desc Logout  @route POST /api/auth/logout  @access Private
const logout = async (req, res) => {
  try {
    req.user.activeSessionId = null;
    req.user.sessionLastActiveAt = null;
    await req.user.save();
    await logActivity(req.user._id, 'logout', { username: req.user.username }, 'success');
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
};

// @desc Create staff user  @route POST /api/auth/register  @access Admin
const register = async (req, res) => {
  try {
    let { username, email, password, permissions } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const allowed = ['issue', 'scan'];
    permissions = Array.isArray(permissions) ? permissions.filter((p) => allowed.includes(p)) : [];
    if (permissions.length === 0) {
      return res.status(400).json({ error: 'Select at least one role: Ticketer (issue) and/or Scanner (scan)' });
    }

    const existingUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
    });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this username or email already exists' });
    }

    // Staff only. The super admin is seeded, never created here.
    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      role: 'staff',
      permissions,
      createdBy: req.user._id,
    });
    await newUser.save();
    await logActivity(req.user._id, 'user_created', { targetUser: newUser.username }, 'success');

    // Email the new user their login details (do not fail creation if this fails)
    try {
      await sendAccountEmail({ email: newUser.email, username: newUser.username, password, permissions });
    } catch (mailErr) {
      console.error('Account email failed (user still created):', mailErr.message);
    }

    res.status(201).json({ success: true, message: 'User created successfully', data: { user: publicUser(newUser) } });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', details: Object.values(error.errors).map((e) => e.message) });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// @desc Get current user  @route GET /api/auth/me  @access Private
const getProfile = async (req, res) => {
  res.json({ success: true, data: { user: publicUser(req.user) } });
};

// @desc List users  @route GET /api/auth/users  @access Admin
const getUsers = async (req, res) => {
  try {
    const now = Date.now();
    const users = await User.find({ isActive: true })
      .select('-password')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    const mapped = users.map((u) => {
      const last = u.sessionLastActiveAt ? new Date(u.sessionLastActiveAt).getTime() : 0;
      const online = !!u.activeSessionId && now - last < SESSION_IDLE_MS;
      return {
        id: u._id,
        username: u.username,
        email: u.email,
        role: u.role,
        permissions: u.permissions || [],
        createdAt: u.createdAt,
        createdBy: u.createdBy,
        online,
        lastActiveAt: u.sessionLastActiveAt,
      };
    });

    res.json({ success: true, data: { users: mapped, count: mapped.length } });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error fetching users' });
  }
};

// @desc Deactivate user  @route DELETE /api/auth/users/:id  @access Admin
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Cannot delete the super admin' });

    user.isActive = false;
    user.activeSessionId = null;
    user.sessionLastActiveAt = null;
    await user.save();
    await logActivity(req.user._id, 'user_deleted', { targetUser: user.username }, 'success');

    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error deleting user' });
  }
};

// @desc Force a user's session to end  @route POST /api/auth/users/:id/force-logout  @access Admin
const forceLogout = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.activeSessionId = null;
    user.sessionLastActiveAt = null;
    await user.save();
    res.json({ success: true, message: `${user.username} has been logged out` });
  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500).json({ error: 'Server error forcing logout' });
  }
};

module.exports = { login, logout, register, getProfile, getUsers, deleteUser, forceLogout };
