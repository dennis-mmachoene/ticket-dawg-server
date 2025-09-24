const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const { rejects } = require("assert");

const generateTicketPdf = async (ticketData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => path.resolve(Buffer.concat(chunks)));

      const qrBuffer = await QRCode.toBuffer(ticketData.qrCode,{
        width:200,
        margin:2,
        color:{
            dark:'#000000',
            light: '#ffffff'
        }
      })

      const logoPath = path.join(__dirname, '../assets/action-sa-logo.png')
      if(fs.existsSync(logoPath)){
        doc.image(logoPath, (doc.page.width - 120)/2,50,{width: 120})
        doc.moveDown(3);
      }

      doc.fontSize(24).font('Helvetica-Bold').fillColor('#1a365d').text('Action SA Students Chapter', {align: 'center'});

      doc.fontSize(20).fillColor('#2d3748').text('Pool Party', {align: 'center'});

      doc.moveDown(1)

      doc.fontSize(14).font('Helvetica').fillColor('#4a5568').text('Date: 04 October 2025', {align: 'center'}).text('Time: Event Starts at 12:00 PM',{align:'center'})

      doc.moveDown(2)

      doc.fontSize(12).fillColor('#2d3748').text(`This ticket is issued to: ${ticketData.email}`, {align:'center'})

      doc.moveDown(1);

      doc.image(qrBuffer, (doc.page.width - 200)/2,doc.y,{width:200});
      doc.moveDown(8);

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a365d').text('INSTRUCTIONS:', {align: 'left'})

      doc.fontSize(10).font('Helvetica').fillColor('#4a5568').text('• Please present this ticket at the entrance',{align:'left'}).text('• This ticket is valid for one entry only',{align:'left'}).text('• BOB (Bring your own bottles)',{align:'left'}).text('• Free food and cocktails provided',{align:'left'}).text('• Free transport available',{align:'left'})

      doc.moveDown(2)

      doc.fontSize(9).fillColor('#718096').text('This ticket is non-transferable. Entry subject to verification.',{align:'center'})

      doc.moveDown(1);

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d').text('Thank you for making voice heard', {align:'center'}).text('#The_Future_Is_Not_A_Mistake',{align:'center'});

      doc.rect(30,30,doc.page.width - 60, doc.page.height - 60).stroke('#e2e8f0')

      doc.end()
    } catch (error) {
      reject(error);

    }
  });
};
module.exports = {generateTicketPdf}
