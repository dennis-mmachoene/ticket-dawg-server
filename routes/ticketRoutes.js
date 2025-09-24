const router = require('express').Router()
const {initializeTickets, assignTicket, validateTicket, getAllTickets, getStats ,searchTickets} = require('../controllers/ticketController')
const {authenticate, requireAdmin, requireIssuer} = require('../middleware/authMiddleware')

router.use(authenticate)

router.post('/assign', requireIssuer, assignTicket);
router.post('/validate', requireIssuer, validateTicket)
router.get('/stats', requireIssuer, getStats)

router.post('/initialize', requireAdmin, initializeTickets)
router.get('/', requireAdmin, getAllTickets);
router.get('/search', requireAdmin, searchTickets)

module.exports = router;