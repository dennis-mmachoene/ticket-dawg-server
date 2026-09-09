const crypto = require('crypto');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

const generateTicketID = (i) => {
  const prefix = 'ASA';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}${timestamp}${random}${i.toString(36)}`.toUpperCase();
};

const generateQRCode = () => crypto.randomBytes(16).toString('hex');

// Runs on every boot but is safe/idempotent: it only creates what is missing.
const runSeed = async () => {
  try {
    // 1) Seed the single super admin (dennis) if no admin exists yet.
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const password = process.env.ADMIN_PASSWORD;
      if (!password) {
        console.error('❌ ADMIN_PASSWORD is not set. Skipping admin seed for safety. Set ADMIN_PASSWORD on Render and redeploy.');
      } else {
        const username = (process.env.ADMIN_USERNAME || 'dennis').toLowerCase();
        const email = (process.env.ADMIN_EMAIL || 'dennism.ramara@gmail.com').toLowerCase();
        const admin = new User({ username, email, password, role: 'admin', permissions: ['issue', 'scan'] });
        await admin.save();
        console.log(`✅ Seeded super admin: ${username}`);
      }
    }

    // 2) Seed tickets once, if INITIAL_TICKETS is set and there are none.
    const wanted = parseInt(process.env.INITIAL_TICKETS, 10);
    if (!Number.isNaN(wanted) && wanted > 0) {
      const count = await Ticket.countDocuments();
      if (count === 0) {
        const tickets = [];
        for (let i = 0; i < wanted; i++) {
          tickets.push({ ticketID: generateTicketID(i), qrCode: generateQRCode(), status: 'unused' });
        }
        await Ticket.insertMany(tickets);
        console.log(`✅ Seeded ${wanted} tickets`);
      }
    }
  } catch (error) {
    console.error('Seed error:', error.message);
  }
};

module.exports = runSeed;
