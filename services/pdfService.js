const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const generateTicketPDF = async (ticketData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [300, 600],
        layout: 'landscape',
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const primaryGreen = '#006837';
      const black = '#000000';
      const white = '#FFFFFF';

      const qrBuffer = await QRCode.toBuffer(ticketData.qrCode, {
        width: 100,
        margin: 1,
        color: { dark: black, light: white },
      });

      doc.rect(0, 0, doc.page.width, doc.page.height).fill(white);
      doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20).stroke(primaryGreen);

      const logoPath = path.join(__dirname, '../assets/action-sa-logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 20, 20, { width: 60 });
      }

      doc.fontSize(15).font('Helvetica-Bold').fillColor(primaryGreen)
        .text('ActionSA Students Chapter', 100, 22, { align: 'left' });
      doc.fontSize(13).font('Helvetica').fillColor(black)
        .text('Pool Party · TUT', 100, 42, { align: 'left' });

      doc.fontSize(10)
        .text('Date: 19 September 2026', 100, 62)
        .text('Time: 12:00 till late', 100, 77)
        .text('Venue: Ramawela Guest House', 100, 92);

      doc.fontSize(10).fillColor(primaryGreen)
        .text(`Issued to: ${ticketData.email}`, 20, 120);

      doc.image(qrBuffer, doc.page.width - 120, 105, { width: 100 });

      doc.fontSize(9).fillColor(black)
        .text('• Present this ticket at entrance', 20, 185)
        .text('• Valid for one entry only', 20, 200)
        .text('• Bring your towel', 20, 215)
        .text('• Snacks & refreshments provided', 20, 230)
        .text('• Music, food, swimming & good vibes', 20, 245);

      doc.fontSize(8).fillColor(primaryGreen)
        .text('Non-transferable. Entry subject to verification.', 20, 268)
        .text('Contact: Wandile (Chairperson) 073 338 6129', 20, 280);

      if (doc.y < doc.page.height - 20) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(black)
          .text('#The Future is not a mistake', { align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateTicketPDF };
