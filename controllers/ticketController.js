const Ticket = require('../models/Ticket');
const { sendTicketEmail } = require('../services/emailService');
const crypto = require('crypto');

// Generate unique ticket ID
const generateTicketID = () => {
  const prefix = 'ASA';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}${timestamp}${random}`.toUpperCase();
};

// Generate unique QR code data
const generateQRCode = () => {
  return crypto.randomBytes(16).toString('hex');
};

// @desc    Initialize tickets (run once)
// @route   POST /api/tickets/initialize
// @access  Private (Admin only)
const initializeTickets = async (req, res) => {
  try {
    // Check if tickets already exist
    const existingCount = await Ticket.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({
        error: 'Tickets already initialized',
        currentCount: existingCount,
      });
    }

    const tickets = [];
    for (let i = 1; i <= 65; i++) {
      tickets.push({
        ticketID: generateTicketID(),
        qrCode: generateQRCode(),
      });
    }

    const createdTickets = await Ticket.insertMany(tickets);

    res.status(201).json({
      success: true,
      message: 'Tickets initialized successfully',
      data: {
        count: createdTickets.length,
      },
    });
  } catch (error) {
    console.error('Initialize tickets error:', error);
    res.status(500).json({
      error: 'Server error initializing tickets',
    });
  }
};

// @desc    Assign ticket to email and send
// @route   POST /api/tickets/assign
// @access  Private (Admin/Issuer)
const assignTicket = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    // Check if email already has a ticket
    const existingTicket = await Ticket.findOne({ 
      email: email.toLowerCase(),
      status: { $in: ['sent', 'used'] }
    });

    if (existingTicket) {
      return res.status(409).json({
        error: 'Email already has a ticket assigned',
        ticketID: existingTicket.ticketID,
      });
    }

    // Find an unused ticket
    const availableTicket = await Ticket.findOne({ status: 'unused' });
    if (!availableTicket) {
      return res.status(400).json({
        error: 'No tickets available',
      });
    }

    // Update ticket
    availableTicket.email = email.toLowerCase();
    availableTicket.status = 'sent';
    availableTicket.issuedBy = req.user._id;
    availableTicket.issuedAt = new Date();
    await availableTicket.save();

    // Send email with PDF ticket
    try {
      await sendTicketEmail({
        ticketID: availableTicket.ticketID,
        qrCode: availableTicket.qrCode,
        email: email.toLowerCase(),
      });

      res.json({
        success: true,
        message: 'Ticket assigned and email sent successfully',
        data: {
          ticketID: availableTicket.ticketID,
          email: availableTicket.email,
          issuedAt: availableTicket.issuedAt,
        },
      });
    } catch (emailError) {
      // Rollback ticket assignment if email fails
      availableTicket.email = null;
      availableTicket.status = 'unused';
      availableTicket.issuedBy = null;
      availableTicket.issuedAt = null;
      await availableTicket.save();

      throw emailError;
    }
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      error: 'Server error assigning ticket',
      details: error.message,
    });
  }
};

// @desc    Validate scanned QR code
// @route   POST /api/tickets/validate
// @access  Private (Admin/Issuer)
const validateTicket = async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({
        error: 'QR code is required',
      });
    }

    // Find ticket by QR code
    const ticket = await Ticket.findOne({ qrCode })
      .populate('issuedBy', 'username')
      .populate('usedBy', 'username');

    if (!ticket) {
      return res.status(404).json({
        error: 'Invalid QR code',
      });
    }

    // Check ticket status
    if (ticket.status === 'unused') {
      return res.status(400).json({
        error: 'Ticket not assigned to anyone',
        status: 'unused',
      });
    }

    if (ticket.status === 'used') {
      return res.status(409).json({
        error: 'Ticket already used',
        status: 'used',
        usedAt: ticket.usedAt,
        usedBy: ticket.usedBy?.username,
      });
    }

    // Mark ticket as used
    ticket.status = 'used';
    ticket.usedAt = new Date();
    ticket.usedBy = req.user._id;
    await ticket.save();

    res.json({
      success: true,
      message: 'Ticket validated successfully',
      data: {
        ticketID: ticket.ticketID,
        email: ticket.email,
        issuedAt: ticket.issuedAt,
        usedAt: ticket.usedAt,
        issuedBy: ticket.issuedBy?.username,
      },
    });
  } catch (error) {
    console.error('Validate ticket error:', error);
    res.status(500).json({
      error: 'Server error validating ticket',
    });
  }
};

// @desc    Get ticket statistics
// @route   GET /api/tickets/stats
// @access  Private (Admin/Issuer)
const getStats = async (req, res) => {
  try {
    const totalTickets = await Ticket.countDocuments();
    const sentTickets = await Ticket.countDocuments({ status: 'sent' });
    const usedTickets = await Ticket.countDocuments({ status: 'used' });
    const unusedTickets = await Ticket.countDocuments({ status: 'unused' });

    // If user is issuer, get their specific stats
    let issuerStats = null;
    if (req.user.role === 'issuer') {
      const issuerSent = await Ticket.countDocuments({ 
        issuedBy: req.user._id,
        status: { $in: ['sent', 'used'] }
      });
      const issuerUsed = await Ticket.countDocuments({ 
        usedBy: req.user._id 
      });
      
      issuerStats = {
        ticketsIssued: issuerSent,
        ticketsScanned: issuerUsed,
      };
    }

    res.json({
      success: true,
      data: {
        global: {
          total: totalTickets,
          sent: sentTickets,
          used: usedTickets,
          remaining: unusedTickets,
        },
        personal: issuerStats,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Server error fetching statistics',
    });
  }
};

// @desc    Get all tickets (Admin only)
// @route   GET /api/tickets
// @access  Private (Admin only)
const getAllTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (status && ['unused', 'sent', 'used'].includes(status)) {
      filter.status = status;
    }

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
    res.status(500).json({
      error: 'Server error fetching tickets',
    });
  }
};

// @desc    Search tickets by email (Admin only)
// @route   GET /api/tickets/search
// @access  Private (Admin only)
const searchTickets = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: 'Email parameter is required',
      });
    }

    const tickets = await Ticket.find({
      email: { $regex: email.toLowerCase(), $options: 'i' }
    })
      .populate('issuedBy', 'username')
      .populate('usedBy', 'username')
      .sort({ issuedAt: -1 });

    res.json({
      success: true,
      data: {
        tickets,
        count: tickets.length,
      },
    });
  } catch (error) {
    console.error('Search tickets error:', error);
    res.status(500).json({
      error: 'Server error searching tickets',
    });
  }
};

module.exports = {
  initializeTickets,
  assignTicket,
  validateTicket,
  getStats,
  getAllTickets,
  searchTickets,
};