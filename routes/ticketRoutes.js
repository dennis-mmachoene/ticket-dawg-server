const router = require('express').Router();
const {
  initializeTickets, addTickets, clearTickets, assignTicket, resendTicket, revokeTicket,
  validateTicket, checkInByTicketId, getAllTickets, getStats, searchTickets,
} = require('../controllers/ticketController');
const { authenticate, requireAdmin, requireIssue, requireScan } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/assign', requireIssue, assignTicket);
router.post('/validate', requireScan, validateTicket);
router.post('/checkin', requireScan, checkInByTicketId);
router.get('/stats', getStats);

router.post('/initialize', requireAdmin, initializeTickets);
router.post('/add', requireAdmin, addTickets);
router.delete('/clear', requireAdmin, clearTickets);
router.get('/', requireAdmin, getAllTickets);
router.get('/search', requireAdmin, searchTickets);
router.post('/:id/resend', requireAdmin, resendTicket);
router.post('/:id/revoke', requireAdmin, revokeTicket);

module.exports = router;
