const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const generateTicketPDF = async (ticketData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [300, 600], // Compact ticket size
        layout: 'landscape',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const primaryGreen = '#006837';
      const black = '#000000';
      const white = '#FFFFFF';

      const qrBuffer = await QRCode.toBuffer(ticketData.qrCode, {
        width: 100,
        margin: 1,
        color: { dark: black, light: white }
      });

      // Background
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(white);

      // Border
      doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20).stroke(primaryGreen);

      // Logo
      const logoPath = path.join(__dirname, '../assets/action-sa-logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 20, 20, { width: 60 });
      }

      // Event Info
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor(primaryGreen)
         .text('ActionSA Students Chapter', 100, 20, { align: 'left' });

      doc.fontSize(14)
         .font('Helvetica')
         .fillColor(black)
         .text('Pool Party', 100, 40, { align: 'left' });

      doc.fontSize(10)
         .text('Date: 04 October 2025', 100, 60)
         .text('Time: Starts at 12:00', 100, 75);

      // Ticket Holder
      doc.fontSize(10)
         .fillColor(primaryGreen)
         .text(`Issued to: ${ticketData.email}`, 20, 110);

      // QR Code
      doc.image(qrBuffer, doc.page.width - 120, 100, { width: 100 });

      // Instructions
      doc.fontSize(9)
         .fillColor(black)
         .text('• Present this ticket at entrance', 20, 180)
         .text('• Valid for one entry only', 20, 195)
         .text('• BOB. Free food & cocktails', 20, 210)
         .text('• Free transport available', 20, 225);

      // Footer
      doc.fontSize(8)
         .fillColor(primaryGreen)
         .text('Non-transferable. Entry subject to verification.', 20, 260);

      // Final Message (no hardcoded y-position)
      if (doc.y < doc.page.height - 20) {
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(black)
           .text('#The Future is not a mistake', { align: 'center' });
      }

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateTicketPDF,
};
