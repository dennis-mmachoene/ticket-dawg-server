const router = require('express').Router();
const { initializeTickets, assignTicket, validateTicket, getAllTickets, getStats, searchTickets, clearTickets } = require('../controllers/ticketController');
const { authenticate, requireAdmin, requireIssue, requireScan } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/assign', requireIssue, assignTicket);
router.post('/validate', requireScan, validateTicket);
router.get('/stats', getStats);

router.post('/initialize', requireAdmin, initializeTickets);
router.delete('/clear', requireAdmin, clearTickets);
router.get('/', requireAdmin, getAllTickets);
router.get('/search', requireAdmin, searchTickets);

module.exports = router;
