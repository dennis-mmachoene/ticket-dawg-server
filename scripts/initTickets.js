require('dotenv').config();
const connectDB = require('../config/db');
const Ticket = require('../models/Ticket');
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

const initializeTickets = async () => {
  try {
    console.log('🎫 Initializing tickets...');
    
    await connectDB();

    // Check if tickets already exist
    const existingCount = await Ticket.countDocuments();
    if (existingCount > 0) {
      console.log(`❌ Tickets already initialized. Current count: ${existingCount}`);
      process.exit(0);
    }

    // Generate 65 tickets
    const tickets = [];
    for (let i = 1; i <= 65; i++) {
      tickets.push({
        ticketID: generateTicketID(),
        qrCode: generateQRCode(),
        status: 'unused',
      });
    }

    // Insert all tickets
    const createdTickets = await Ticket.insertMany(tickets);

    console.log('✅ Tickets initialized successfully!');
    console.log(`📊 Created ${createdTickets.length} tickets`);
    console.log('\n🎫 Sample ticket IDs:');
    createdTickets.slice(0, 5).forEach((ticket, index) => {
      console.log(`   ${index + 1}. ${ticket.ticketID}`);
    });
    
    if (createdTickets.length > 5) {
      console.log(`   ... and ${createdTickets.length - 5} more tickets`);
    }

    console.log('\n🚀 Ready to issue tickets!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing tickets:', error.message);
    process.exit(1);
  }
};

initializeTickets();