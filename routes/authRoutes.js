const router = require('express').Router()
const {login, register, getProfile, getUsers, deleteUser } = require('../controllers/authController')
const {authenticate, requireAdmin} = require('../middleware/authMiddleware')


router.post('/login', login);
router.use(authenticate);
router.get('/me', getProfile)
router.post('/register', requireAdmin, register);
router.get('/users', requireAdmin, getUsers);
router.delete('/users/:id', requireAdmin, deleteUser);

module.exports = router;