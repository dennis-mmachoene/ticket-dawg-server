const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Single-page landscape ticket (600 x 340 points).
const generateTicketPDF = async (ticketData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [600, 340], margins: { top: 20, bottom: 20, left: 20, right: 20 } });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const green = '#006837';
      const black = '#000000';
      const white = '#FFFFFF';

      const qrBuffer = await QRCode.toBuffer(ticketData.qrCode, { width: 110, margin: 1, color: { dark: black, light: white } });

      doc.rect(0, 0, doc.page.width, doc.page.height).fill(white);
      doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20).stroke(green);

      const logoPath = path.join(__dirname, '../assets/action-sa-logo.png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, 22, 22, { width: 56 });

      doc.fillColor(green).font('Helvetica-Bold').fontSize(15).text('ActionSA Students Chapter', 92, 24);
      doc.fillColor(black).font('Helvetica').fontSize(12).text('Pool Party · TUT', 92, 44);

      doc.fontSize(10)
        .text('Date: 19 September 2026', 92, 66)
        .text('Time: 12:00 till late', 92, 81)
        .text('Venue: Ramawela Guest House', 92, 96);

      doc.fillColor(green).fontSize(10).text(`Issued to: ${ticketData.email}`, 22, 130, { width: 400 });

      doc.image(qrBuffer, 470, 58, { width: 108 });

      doc.fillColor(black).fontSize(9)
        .text('• Present this ticket at entrance', 22, 165, { width: 430 })
        .text('• Valid for one entry only', 22, 181, { width: 430 })
        .text('• Bring your towel', 22, 197, { width: 430 })
        .text('• Snacks & refreshments provided', 22, 213, { width: 430 })
        .text('• Music, food, swimming & good vibes', 22, 229, { width: 430 });

      doc.fillColor(green).fontSize(8)
        .text('Non-transferable. Entry subject to verification.', 22, 258, { width: 500 })
        .text('Contact: Wandile (Chairperson) 073 338 6129', 22, 272, { width: 500 });

      doc.fillColor(black).font('Helvetica-Bold').fontSize(10)
        .text('#The Future is not a mistake', 0, 298, { width: doc.page.width, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateTicketPDF };
