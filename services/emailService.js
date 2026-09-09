// emailService.js
// Tries Gmail SMTP when GMAIL_USER + GMAIL_APP_PASSWORD are set, but Render's
// free tier blocks outbound SMTP, so it falls back to SendGrid (HTTPS) on any
// connection failure. SendGrid is the reliable transport on Render.
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { generateTicketPDF } = require('./pdfService');

const useGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const FROM_NAME = 'ActionSA Students Chapter TUT';
const APP_URL = process.env.FRONTEND_URL || 'https://ticketdawg-web.vercel.app';

let transporter = null;
if (useGmail) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

let logoBuffer = null;
try {
  logoBuffer = fs.readFileSync(path.join(__dirname, '../assets/action-sa-logo.png'));
} catch (e) {
  console.warn('Logo not found for email, continuing without it.');
}

const friendlyEmailError = (error) => {
  const code = error && error.responseCode;
  const resp = `${(error && error.response) || ''} ${(error && error.message) || ''}`.toLowerCase();
  const isDaily = resp.includes('5.4.5') || resp.includes('sending limit') || resp.includes('quota') || (resp.includes('daily') && resp.includes('limit'));
  if (isDaily) return 'Daily email limit reached. Please try again tomorrow.';
  if (code === 421 || code === 454 || resp.includes('try again later') || resp.includes('rate limit') || resp.includes('too many')) return 'Email is busy right now. Wait a minute and try again.';
  if (resp.includes('invalid login') || resp.includes('badcredentials') || resp.includes('username and password not accepted')) return 'Email login failed. Check the email settings.';
  if (resp.includes('5.1.1') || resp.includes('no such user') || resp.includes('recipient address rejected')) return 'The recipient email address looks invalid.';
  return `Could not send the email: ${(error && error.message) || 'unknown error'}`;
};

const sendViaSendGrid = async ({ to, subject, html, text, pdf }) => {
  if (!process.env.SENDGRID_API_KEY) throw new Error('SendGrid is not configured');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const attachments = [];
  if (pdf) attachments.push({ content: pdf.buffer.toString('base64'), filename: pdf.filename, type: 'application/pdf', disposition: 'attachment' });
  if (logoBuffer) attachments.push({ content: logoBuffer.toString('base64'), filename: 'action-sa-logo.png', type: 'image/png', disposition: 'inline', content_id: 'asalogo' });
  await sgMail.send({ to, from: { name: FROM_NAME, email: process.env.EMAIL_FROM }, subject, text, html, attachments });
  console.log('✅ Email sent via SendGrid to', to);
};

const sendViaGmail = async ({ to, subject, html, text, pdf }) => {
  const attachments = [];
  if (pdf) attachments.push({ filename: pdf.filename, content: pdf.buffer });
  if (logoBuffer) attachments.push({ filename: 'action-sa-logo.png', content: logoBuffer, cid: 'asalogo' });
  await transporter.sendMail({ from: `${FROM_NAME} <${process.env.GMAIL_USER}>`, to, subject, text, html, attachments });
  console.log('✅ Email sent via Gmail to', to);
};

const deliver = async (msg) => {
  if (useGmail) {
    try {
      await sendViaGmail(msg);
      return;
    } catch (err) {
      const m = `${err.code || ''} ${err.message || ''}`.toLowerCase();
      const isConn = m.includes('timeout') || m.includes('etimedout') || m.includes('econn') || m.includes('esocket') || m.includes('greeting');
      if (isConn && process.env.SENDGRID_API_KEY) {
        console.warn('Gmail SMTP unavailable, falling back to SendGrid:', err.message);
        await sendViaSendGrid(msg);
        return;
      }
      throw err;
    }
  }
  await sendViaSendGrid(msg);
};

const header = (title, subtitle) => `
  <div style="background-color:#009739; padding:30px; text-align:center; color:white;">
    ${logoBuffer ? '<img src="cid:asalogo" alt="ActionSA Students Chapter" style="height:64px;margin-bottom:10px;">' : ''}
    <h1 style="margin:0; font-size:26px;">${title}</h1>
    <p style="margin:10px 0 0; font-size:16px;">${subtitle}</p>
  </div>`;

const footer = `
  <div style="background:#000; padding:20px; text-align:center; color:#ccc; font-size:12px;">
    <p style="margin:0; color:#fff;">ActionSA Students Chapter · Tshwane University of Technology</p>
    <p style="margin:5px 0 0;">#The Future is not a mistake</p>
  </div>`;

const shell = (inner) => `
  <div style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f4f4;">
    <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden;">
      ${inner}
    </div>
  </div>`;

const sendTicketEmail = async (ticketData) => {
  try {
    const pdfBuffer = await generateTicketPDF(ticketData);
    const html = shell(`
      ${header('Pool Party Ticket', 'ActionSA Students Chapter · TUT')}
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
        <p style="color:#333; line-height:1.6;">For inquiries, contact <strong>Wandile (Chairperson)</strong> @ <a href="tel:0733386129" style="color:#009739;">073 338 6129</a>.</p>
      </div>
      ${footer}`);

    const text =
      `Thank you for voting in the TUT SRC Elections!\n\n` +
      `Here is your ticket to the ActionSA Students Chapter Pool Party.\n\n` +
      `Date: 19 September 2026\nTime: 12:00 till late\nVenue: Ramawela Guest House\nTicket ID: ${ticketData.ticketID}\n\n` +
      `Present the attached PDF (QR code) at the entrance. Valid for one entry only.\n` +
      `Bring your towel. Snacks and refreshments provided.\n\n` +
      `Contact: Wandile (Chairperson) 073 338 6129\n\n#The Future is not a mistake`;

    await deliver({ to: ticketData.email, subject: 'Your Pool Party Ticket – ActionSA Students Chapter TUT', html, text, pdf: { filename: `pool-party-ticket-${ticketData.ticketID}.pdf`, buffer: pdfBuffer } });
    return { success: true };
  } catch (error) {
    console.error('❌ Ticket email failed:', error.response?.body || error.response || error.message);
    throw new Error(friendlyEmailError(error));
  }
};

const sendAccountEmail = async ({ email, username, password, permissions }) => {
  const labels = (permissions || []).map((p) => (p === 'issue' ? 'issue tickets (Ticketer)' : 'scan tickets (Scanner)'));
  const rolesText = labels.length ? labels.join(' and ') : 'help run the event';
  const html = shell(`
    ${header('Your Account', 'ActionSA Students Chapter · TUT')}
    <div style="padding:30px;">
      <h2 style="color:#009739; margin-top:0;">You've been added</h2>
      <p style="color:#333; line-height:1.6;">You have been added to the <strong>ActionSA Students Chapter Pool Party ticketing system</strong>. Your role is to <strong>${rolesText}</strong>.</p>
      <div style="background:#f9f9f9; padding:20px; border-radius:8px; margin:20px 0; border-left:4px solid #009739;">
        <h3 style="color:#009739; margin-top:0;">Your login details</h3>
        <p style="margin:4px 0;"><strong>Website:</strong> <a href="${APP_URL}" style="color:#009739;">${APP_URL}</a></p>
        <p style="margin:4px 0;"><strong>Username:</strong> ${username}</p>
        <p style="margin:4px 0;"><strong>Password:</strong> ${password}</p>
      </div>
      <p style="color:#333; line-height:1.6;">Please keep these details private. Only one person can be logged into an account at a time.</p>
    </div>
    ${footer}`);
  const text =
    `You've been added to the ActionSA Students Chapter Pool Party ticketing system.\n\n` +
    `Your role: ${rolesText}.\n\nLogin details:\nWebsite: ${APP_URL}\nUsername: ${username}\nPassword: ${password}\n\n` +
    `Please keep these private. Only one person can be logged into an account at a time.`;
  await deliver({ to: email, subject: 'Your ActionSA Pool Party ticketing account', html, text });
  return { success: true };
};

module.exports = { sendTicketEmail, sendAccountEmail };
