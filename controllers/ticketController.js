const Ticket = require('../models/Ticket');
const { sendTicketEmail } = require('../services/emailService');
const ActivityLog = require('../models/ActivityLog');
const crypto = require('crypto');

const logActivity = async (userId, action, details = {}, result = 'success', errorMessage = null) => {
  try {
    await ActivityLog.create({ user: userId, action, details, result, errorMessage });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

const generateTicketID = () => {
  const prefix = 'ASA';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}${timestamp}${random}`.toUpperCase();
};

const generateQRCode = () => crypto.randomBytes(16).toString('hex');

// @desc Initialize tickets  @route POST /api/tickets/initialize  @access Admin
const initializeTickets = async (req, res) => {
  try {
    const existingCount = await Ticket.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({ error: 'Tickets already initialized', currentCount: existingCount });
    }
    const requested = parseInt(req.body && req.body.count, 10);
    const total = !Number.isNaN(requested) && requested > 0 ? requested : 65;

    const tickets = [];
    for (let i = 0; i < total; i++) {
      tickets.push({ ticketID: generateTicketID(), qrCode: generateQRCode() });
    }
    const created = await Ticket.insertMany(tickets);
    res.status(201).json({ success: true, message: 'Tickets initialized successfully', data: { count: created.length } });
  } catch (error) {
    console.error('Initialize tickets error:', error);
    res.status(500).json({ error: 'Server error initializing tickets' });
  }
};

// @desc Assign a ticket to an email and send it  @route POST /api/tickets/assign  @access issue
const assignTicket = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    const existingTicket = await Ticket.findOne({
      email: email.toLowerCase(),
      status: { $in: ['sent', 'used'] },
    });
    if (existingTicket) {
      await logActivity(req.user._id, 'ticket_issued', { ticketEmail: email.toLowerCase() }, 'failure', 'Email already has a ticket');
      return res.status(409).json({ error: 'Email already has a ticket assigned', ticketID: existingTicket.ticketID });
    }

    const availableTicket = await Ticket.findOne({ status: 'unused' });
    if (!availableTicket) {
      await logActivity(req.user._id, 'ticket_issued', { ticketEmail: email.toLowerCase() }, 'failure', 'No tickets available');
      return res.status(400).json({ error: 'No tickets available' });
    }

    availableTicket.email = email.toLowerCase();
    availableTicket.status = 'sent';
    availableTicket.issuedBy = req.user._id;
    availableTicket.issuedAt = new Date();
    await availableTicket.save();

    try {
      await sendTicketEmail({
        ticketID: availableTicket.ticketID,
        qrCode: availableTicket.qrCode,
        email: email.toLowerCase(),
      });
      await logActivity(req.user._id, 'ticket_issued', { ticketID: availableTicket.ticketID, ticketEmail: email.toLowerCase() }, 'success');
      res.json({
        success: true,
        message: 'Ticket assigned and email sent successfully',
        data: { ticketID: availableTicket.ticketID, email: availableTicket.email, issuedAt: availableTicket.issuedAt },
      });
    } catch (emailError) {
      // Roll back so the ticket is not lost if the email fails.
      availableTicket.email = null;
      availableTicket.status = 'unused';
      availableTicket.issuedBy = null;
      availableTicket.issuedAt = null;
      await availableTicket.save();
      await logActivity(req.user._id, 'ticket_issued', { ticketID: availableTicket.ticketID, ticketEmail: email.toLowerCase() }, 'failure', emailError.message);
      throw emailError;
    }
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({ error: 'Server error assigning ticket', details: error.message });
  }
};

// @desc Validate a scanned QR code  @route POST /api/tickets/validate  @access scan
const validateTicket = async (req, res) => {
  try {
    const { qrCode } = req.body;
    if (!qrCode) return res.status(400).json({ error: 'QR code is required' });

    const ticket = await Ticket.findOne({ qrCode })
      .populate('issuedBy', 'username')
      .populate('usedBy', 'username');

    if (!ticket) {
      await logActivity(req.user._id, 'ticket_validated', { qrCode: String(qrCode).substring(0, 8) + '...' }, 'failure', 'Invalid QR code');
      return res.status(404).json({ error: 'Invalid QR code' });
    }

    if (ticket.status === 'unused') {
      await logActivity(req.user._id, 'ticket_validated', { ticketID: ticket.ticketID }, 'warning', 'Ticket not assigned');
      return res.status(400).json({ error: 'Ticket not assigned to anyone', status: 'unused' });
    }

    if (ticket.status === 'used') {
      // Double-scan grace: if the SAME scanner re-read the SAME ticket within a few
      // seconds, treat it as the same valid scan instead of a scary "already used".
      const usedById = ticket.usedBy && ticket.usedBy._id ? ticket.usedBy._id.toString()
        : (ticket.usedBy ? ticket.usedBy.toString() : null);
      const usedAtMs = ticket.usedAt ? new Date(ticket.usedAt).getTime() : 0;
      const bySameUserJustNow = usedById === req.user._id.toString() && Date.now() - usedAtMs < 12000;

      if (bySameUserJustNow) {
        return res.json({
          success: true,
          message: 'Ticket validated',
          data: {
            ticketID: ticket.ticketID,
            email: ticket.email,
            issuedAt: ticket.issuedAt,
            usedAt: ticket.usedAt,
            issuedBy: ticket.issuedBy && ticket.issuedBy.username,
          },
          alreadyScannedMomentsAgo: true,
        });
      }

      await logActivity(req.user._id, 'ticket_validated', { ticketID: ticket.ticketID, ticketEmail: ticket.email }, 'warning', 'Ticket already used');
      return res.status(409).json({
        error: 'Ticket already used',
        status: 'used',
        usedAt: ticket.usedAt,
        usedBy: ticket.usedBy && ticket.usedBy.username,
      });
    }

    ticket.status = 'used';
    ticket.usedAt = new Date();
    ticket.usedBy = req.user._id;
    await ticket.save();

    await logActivity(req.user._id, 'ticket_validated', { ticketID: ticket.ticketID, ticketEmail: ticket.email }, 'success');

    res.json({
      success: true,
      message: 'Ticket validated successfully',
      data: {
        ticketID: ticket.ticketID,
        email: ticket.email,
        issuedAt: ticket.issuedAt,
        usedAt: ticket.usedAt,
        issuedBy: ticket.issuedBy && ticket.issuedBy.username,
      },
    });
  } catch (error) {
    console.error('Validate ticket error:', error);
    res.status(500).json({ error: 'Server error validating ticket' });
  }
};

// @desc Stats  @route GET /api/tickets/stats  @access Private
// Admin sees global analysis; staff see only their own tallies.
const getStats = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const [total, sent, used, unused] = await Promise.all([
        Ticket.countDocuments(),
        Ticket.countDocuments({ status: 'sent' }),
        Ticket.countDocuments({ status: 'used' }),
        Ticket.countDocuments({ status: 'unused' }),
      ]);
      return res.json({ success: true, data: { global: { total, sent, used, remaining: unused }, personal: null } });
    }

    const [issued, scanned] = await Promise.all([
      Ticket.countDocuments({ issuedBy: req.user._id, status: { $in: ['sent', 'used'] } }),
      Ticket.countDocuments({ usedBy: req.user._id }),
    ]);
    return res.json({ success: true, data: { global: null, personal: { ticketsIssued: issued, ticketsScanned: scanned } } });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error fetching statistics' });
  }
};

// @desc All tickets  @route GET /api/tickets  @access Admin
const getAllTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && ['unused', 'sent', 'used'].includes(status)) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const tickets = await Ticket.find(filter)
      .populate('issuedBy', 'username')
      .populate('usedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const totalCount = await Ticket.countDocuments(filter);

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ error: 'Server error fetching tickets' });
  }
};

// @desc Search tickets by email  @route GET /api/tickets/search  @access Admin
const searchTickets = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email parameter is required' });

    const tickets = await Ticket.find({ email: { $regex: email.toLowerCase(), $options: 'i' } })
      .populate('issuedBy', 'username')
      .populate('usedBy', 'username')
      .sort({ issuedAt: -1 });

    res.json({ success: true, data: { tickets, count: tickets.length } });
  } catch (error) {
    console.error('Search tickets error:', error);
    res.status(500).json({ error: 'Server error searching tickets' });
  }
};

// @desc Clear all tickets (for testing, then re-seed)  @route DELETE /api/tickets/clear  @access Admin
const clearTickets = async (req, res) => {
  try {
    const result = await Ticket.deleteMany({});
    res.json({ success: true, message: 'All tickets cleared', data: { deleted: result.deletedCount } });
  } catch (error) {
    console.error('Clear tickets error:', error);
    res.status(500).json({ error: 'Server error clearing tickets' });
  }
};

module.exports = { initializeTickets, assignTicket, validateTicket, getStats, getAllTickets, searchTickets, clearTickets };

