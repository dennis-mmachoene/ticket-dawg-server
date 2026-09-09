const crypto = require('crypto');
const Ticket = require('../models/Ticket');
const { sendTicketEmail } = require('../services/emailService');
const { logActivity } = require('../utils/activityLogger');

const generateTicketID = () => {
  const prefix = 'ASA';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}${timestamp}${random}`.toUpperCase();
};
const generateQRCode = () => crypto.randomBytes(16).toString('hex');
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc Initialize tickets (only when none exist)  @route POST /api/tickets/initialize  @access Admin
const initializeTickets = async (req, res) => {
  try {
    const existingCount = await Ticket.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({ error: 'Tickets already initialized', currentCount: existingCount });
    }
    const requested = parseInt(req.body && req.body.count, 10);
    const total = !Number.isNaN(requested) && requested > 0 ? requested : 65;
    const tickets = [];
    for (let i = 0; i < total; i++) tickets.push({ ticketID: generateTicketID(), qrCode: generateQRCode() });
    const created = await Ticket.insertMany(tickets);
    res.status(201).json({ success: true, message: 'Tickets initialized successfully', data: { count: created.length } });
  } catch (error) {
    console.error('Initialize tickets error:', error);
    res.status(500).json({ error: 'Server error initializing tickets' });
  }
};

// @desc Add more tickets (append, no wipe)  @route POST /api/tickets/add  @access Admin
const addTickets = async (req, res) => {
  try {
    const requested = parseInt(req.body && req.body.count, 10);
    if (Number.isNaN(requested) || requested <= 0) return res.status(400).json({ error: 'Enter how many tickets to add' });
    if (requested > 5000) return res.status(400).json({ error: 'Too many at once (max 5000)' });
    const tickets = [];
    for (let i = 0; i < requested; i++) tickets.push({ ticketID: generateTicketID(), qrCode: generateQRCode() });
    const created = await Ticket.insertMany(tickets);
    res.status(201).json({ success: true, message: `Added ${created.length} tickets`, data: { added: created.length } });
  } catch (error) {
    console.error('Add tickets error:', error);
    res.status(500).json({ error: 'Server error adding tickets' });
  }
};

// @desc Clear all tickets  @route DELETE /api/tickets/clear  @access Admin
const clearTickets = async (req, res) => {
  try {
    const result = await Ticket.deleteMany({});
    res.json({ success: true, message: 'All tickets cleared', data: { deleted: result.deletedCount } });
  } catch (error) {
    console.error('Clear tickets error:', error);
    res.status(500).json({ error: 'Server error clearing tickets' });
  }
};

// @desc Assign a ticket to an email and send it  @route POST /api/tickets/assign  @access issue
const assignTicket = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    const lower = email.toLowerCase();

    const existingTicket = await Ticket.findOne({ email: lower, status: { $in: ['sent', 'used'] } });
    if (existingTicket) {
      await logActivity(req.user._id, 'ticket_issued', { ticketEmail: lower }, 'failure', 'Email already has a ticket');
      return res.status(409).json({ error: 'Email already has a ticket assigned', ticketID: existingTicket.ticketID });
    }

    // Atomically claim one unused ticket so two ticketers can't grab the same one.
    const availableTicket = await Ticket.findOneAndUpdate(
      { status: 'unused' },
      { $set: { status: 'sent', email: lower, issuedBy: req.user._id, issuedAt: new Date() } },
      { new: true }
    );
    if (!availableTicket) {
      await logActivity(req.user._id, 'ticket_issued', { ticketEmail: lower }, 'failure', 'No tickets available');
      return res.status(400).json({ error: 'No tickets available' });
    }

    try {
      await sendTicketEmail({ ticketID: availableTicket.ticketID, qrCode: availableTicket.qrCode, email: lower });
      await logActivity(req.user._id, 'ticket_issued', { ticketID: availableTicket.ticketID, ticketEmail: lower }, 'success');
      return res.json({
        success: true,
        message: 'Ticket assigned and email sent successfully',
        data: { ticketID: availableTicket.ticketID, email: lower, issuedAt: availableTicket.issuedAt },
      });
    } catch (emailError) {
      // Roll the ticket back so it is not lost if the email fails.
      availableTicket.email = null;
      availableTicket.status = 'unused';
      availableTicket.issuedBy = null;
      availableTicket.issuedAt = null;
      await availableTicket.save();
      await logActivity(req.user._id, 'ticket_issued', { ticketID: availableTicket.ticketID, ticketEmail: lower }, 'failure', emailError.message);
      return res.status(502).json({ error: emailError.message || 'Could not send the ticket email' });
    }
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({ error: 'Server error assigning ticket' });
  }
};

// @desc Resend an issued ticket's email  @route POST /api/tickets/:id/resend  @access Admin
const resendTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!ticket.email || ticket.status === 'unused') return res.status(400).json({ error: 'This ticket has not been issued to anyone yet' });
    await sendTicketEmail({ ticketID: ticket.ticketID, qrCode: ticket.qrCode, email: ticket.email });
    await logActivity(req.user._id, 'ticket_issued', { ticketID: ticket.ticketID, ticketEmail: ticket.email, note: 'resend' }, 'success');
    res.json({ success: true, message: `Ticket re-sent to ${ticket.email}` });
  } catch (error) {
    console.error('Resend ticket error:', error);
    res.status(502).json({ error: error.message || 'Could not resend the ticket email' });
  }
};

// @desc Revoke a ticket (free it back to unused)  @route POST /api/tickets/:id/revoke  @access Admin
const revokeTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const wasEmail = ticket.email;
    ticket.status = 'unused';
    ticket.email = null;
    ticket.issuedBy = null;
    ticket.issuedAt = null;
    ticket.usedBy = null;
    ticket.usedAt = null;
    await ticket.save();
    await logActivity(req.user._id, 'ticket_issued', { ticketID: ticket.ticketID, ticketEmail: wasEmail, note: 'revoked' }, 'warning');
    res.json({ success: true, message: 'Ticket revoked and freed' });
  } catch (error) {
    console.error('Revoke ticket error:', error);
    res.status(500).json({ error: 'Server error revoking ticket' });
  }
};

// Shared claim + classify used by QR scan and manual check-in.
const claimTicket = async (query, req, res, label) => {
  try {
    const claimed = await Ticket.findOneAndUpdate(
      { ...query, status: 'sent' },
      { $set: { status: 'used', usedAt: new Date(), usedBy: req.user._id } },
      { new: true }
    ).populate('issuedBy', 'username');

    if (claimed) {
      await logActivity(req.user._id, 'ticket_validated', { ticketID: claimed.ticketID, ticketEmail: claimed.email }, 'success');
      return res.json({
        success: true,
        message: 'Ticket validated successfully',
        data: { ticketID: claimed.ticketID, email: claimed.email, issuedAt: claimed.issuedAt, usedAt: claimed.usedAt, issuedBy: claimed.issuedBy && claimed.issuedBy.username },
      });
    }

    const ticket = await Ticket.findOne(query).populate('issuedBy', 'username').populate('usedBy', 'username');
    if (!ticket) {
      await logActivity(req.user._id, 'ticket_validated', { note: `Invalid ${label}` }, 'failure', `Invalid ${label}`);
      return res.status(404).json({ error: `Invalid ${label}` });
    }
    if (ticket.status === 'unused') {
      await logActivity(req.user._id, 'ticket_validated', { ticketID: ticket.ticketID }, 'warning', 'Ticket not assigned');
      return res.status(400).json({ error: 'Ticket not assigned to anyone', status: 'unused' });
    }
    // status is 'used'
    const usedById = ticket.usedBy && ticket.usedBy._id ? ticket.usedBy._id.toString() : (ticket.usedBy ? ticket.usedBy.toString() : null);
    const usedAtMs = ticket.usedAt ? new Date(ticket.usedAt).getTime() : 0;
    if (usedById === req.user._id.toString() && Date.now() - usedAtMs < 12000) {
      return res.json({
        success: true,
        message: 'Ticket validated',
        alreadyScannedMomentsAgo: true,
        data: { ticketID: ticket.ticketID, email: ticket.email, issuedAt: ticket.issuedAt, usedAt: ticket.usedAt, issuedBy: ticket.issuedBy && ticket.issuedBy.username },
      });
    }
    await logActivity(req.user._id, 'ticket_validated', { ticketID: ticket.ticketID, ticketEmail: ticket.email }, 'warning', 'Ticket already used');
    return res.status(409).json({ error: 'Ticket already used', status: 'used', usedAt: ticket.usedAt, usedBy: ticket.usedBy && ticket.usedBy.username });
  } catch (error) {
    console.error('Validate error:', error);
    res.status(500).json({ error: 'Server error validating ticket' });
  }
};

// @desc Validate a scanned QR code  @route POST /api/tickets/validate  @access scan
const validateTicket = async (req, res) => {
  const { qrCode } = req.body;
  if (!qrCode) return res.status(400).json({ error: 'QR code is required' });
  return claimTicket({ qrCode }, req, res, 'QR code');
};

// @desc Manual check-in by Ticket ID  @route POST /api/tickets/checkin  @access scan
const checkInByTicketId = async (req, res) => {
  let { ticketID } = req.body;
  if (!ticketID) return res.status(400).json({ error: 'Ticket ID is required' });
  ticketID = String(ticketID).trim().toUpperCase();
  return claimTicket({ ticketID }, req, res, 'Ticket ID');
};

// @desc Stats  @route GET /api/tickets/stats  @access Private
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
      data: { tickets, pagination: { currentPage: parseInt(page), totalPages: Math.ceil(totalCount / parseInt(limit)), totalItems: totalCount, itemsPerPage: parseInt(limit) } },
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
    const tickets = await Ticket.find({ email: { $regex: escapeRegex(email.toLowerCase()), $options: 'i' } })
      .populate('issuedBy', 'username')
      .populate('usedBy', 'username')
      .sort({ issuedAt: -1 });
    res.json({ success: true, data: { tickets, count: tickets.length } });
  } catch (error) {
    console.error('Search tickets error:', error);
    res.status(500).json({ error: 'Server error searching tickets' });
  }
};

module.exports = {
  initializeTickets,
  addTickets,
  clearTickets,
  assignTicket,
  resendTicket,
  revokeTicket,
  validateTicket,
  checkInByTicketId,
  getStats,
  getAllTickets,
  searchTickets,
};
