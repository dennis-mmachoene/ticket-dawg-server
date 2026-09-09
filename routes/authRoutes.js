const router = require('express').Router();
const { login, logout, register, getProfile, getUsers, deleteUser, forceLogout, updateUserPermissions } = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.post('/login', login);

router.use(authenticate);

router.post('/logout', logout);
router.get('/me', getProfile);
router.post('/register', requireAdmin, register);
router.get('/users', requireAdmin, getUsers);
router.delete('/users/:id', requireAdmin, deleteUser);
router.post('/users/:id/force-logout', requireAdmin, forceLogout);
router.patch('/users/:id/permissions', requireAdmin, updateUserPermissions);

module.exports = router;
