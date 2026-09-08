// emailService.js
const fs = require('fs');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const { generateTicketPDF } = require('./pdfService');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load the logo once and embed it inline (fixes the old broken external image link).
let logoBase64 = null;
try {
  logoBase64 = fs.readFileSync(path.join(__dirname, '../assets/action-sa-logo.png')).toString('base64');
} catch (e) {
  console.warn('Logo not found for email, continuing without it.');
}

const sendTicketEmail = async (ticketData) => {
  try {
    const pdfBuffer = await generateTicketPDF(ticketData);

    const attachments = [
      {
        content: pdfBuffer.toString('base64'),
        filename: `pool-party-ticket-${ticketData.ticketID}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ];

    if (logoBase64) {
      attachments.push({
        content: logoBase64,
        filename: 'action-sa-logo.png',
        type: 'image/png',
        disposition: 'inline',
        content_id: 'asalogo',
      });
    }

    const logoImg = logoBase64
      ? '<img src="cid:asalogo" alt="ActionSA Students Chapter" style="height:64px;margin-bottom:10px;">'
      : '';

    const msg = {
      to: ticketData.email,
      from: {
        name: 'ActionSA Students Chapter TUT',
        email: process.env.EMAIL_FROM, // must be a verified sender in SendGrid
      },
      subject: 'Your Pool Party Ticket – ActionSA Students Chapter TUT',
      html: `
        <div style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f4f4;">
          <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden;">
            <div style="background-color:#009739; padding:30px; text-align:center; color:white;">
              ${logoImg}
              <h1 style="margin:0; font-size:28px;">Pool Party Ticket</h1>
              <p style="margin:10px 0 0; font-size:16px;">ActionSA Students Chapter · TUT</p>
            </div>
            <div style="padding:30px;">
              <h2 style="color:#009739; margin-top:0;">Thank you for voting!</h2>
              <p style="color:#333; line-height:1.6;">
                Thanks for casting your vote in the <strong>TUT SRC Elections</strong>.
                As a thank you, here is your ticket to the <strong>ActionSA Students Chapter Pool Party</strong>.
                Your ticket is attached as a PDF with a QR code. Please keep it safe.
              </p>
              <div style="background:#f9f9f9; padding:20px; border-radius:8px; margin:20px 0; border-left:4px solid #009739;">
                <h3 style="color:#009739; margin-top:0;">Event Details</h3>
                <p style="margin:4px 0;"><strong>Date:</strong> 19 September 2026</p>
                <p style="margin:4px 0;"><strong>Time:</strong> 12:00 till late</p>
                <p style="margin:4px 0;"><strong>Venue:</strong> Ramawela Guest House</p>
                <p style="margin:4px 0;"><strong>Ticket ID:</strong> ${ticketData.ticketID}</p>
              </div>
              <div style="background:#fffbe6; padding:15px; border-radius:8px; margin:20px 0; border:1px solid #ffe58f;">
                <h4 style="color:#856404; margin-top:0;">Good to know</h4>
                <ul style="color:#555; margin:0; padding-left:20px; line-height:1.6;">
                  <li>Present this ticket (QR code) at the entrance</li>
                  <li>Valid for one entry only</li>
                  <li>Bring your towel</li>
                  <li>Snacks &amp; refreshments provided</li>
                  <li>Music, food, swimming &amp; good vibes</li>
                </ul>
              </div>
              <p style="color:#333; line-height:1.6;">
                For inquiries, contact <strong>Wandile (Chairperson)</strong> @
                <a href="tel:0733386129" style="color:#009739; text-decoration:none;">073 338 6129</a>.
              </p>
              <div style="text-align:center; margin:30px 0;">
                <p style="color:#000; font-weight:bold; margin:0;">Thank you for making your voice heard</p>
                <p style="color:#009739; font-weight:bold; margin:5px 0 0;">#The Future is not a mistake</p>
              </div>
            </div>
            <div style="background:#000; padding:20px; text-align:center; color:#ccc; font-size:12px;">
              <p style="margin:0; color:#fff;">ActionSA Students Chapter · Tshwane University of Technology</p>
              <p style="margin:5px 0 0;">This ticket is non-transferable and entry is subject to verification.</p>
            </div>
          </div>
        </div>
      `,
      attachments,
    };

    await sgMail.send(msg);
    console.log('✅ Email sent successfully to', ticketData.email);
    return { success: true };
  } catch (error) {
    console.error('❌ Email sending failed:', error.response?.body || error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = { sendTicketEmail };
