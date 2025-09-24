const nodemailer = require('nodemailer');
const { generateTicketPDF } = require('./pdfService');

// Create transporter (using Gmail - configure for your email service)
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // Use app password for Gmail
        },
    });
};

// Alternative: SendGrid configuration
const createSendGridTransporter = () => {
    return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY,
        },
    });
};

const sendTicketEmail = async (ticketData) => {
    try {
        // Generate PDF ticket
        const pdfBuffer = await generateTicketPDF(ticketData);

        // Create transporter
        const transporter = createTransporter(); // or createSendGridTransporter()

        // Email content
        const mailOptions = {
            from: {
                name: 'Action SA Students Chapter',
                address: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            },
            to: ticketData.email,
            subject: 'Your Pool Party Ticket – Action SA Students Chapter',
            html: `
                <div style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
                    <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden;">
                        <!-- Header -->
                        <div style="background-color:#009739; padding:30px; text-align:center; color:white;">
                        <img src="assets/action-sa-logo.png" alt="Action SA Logo" style="height:60px; margin-bottom:10px;">
                        <h1 style="margin:0; font-size:28px;">Pool Party Ticket</h1>
                        <p style="margin:10px 0 0; font-size:16px;">Action SA Students Chapter</p>
                    </div>
                    <!-- Body -->
                    <div style="padding:30px;">
                        <h2 style="color:#009739; margin-top:0;">Hello!</h2>
                        <p style="color:#333; line-height:1.6;">
                            Your ticket for the <strong>Action SA Students Chapter Pool Party</strong> has been generated! 
                            Please find your ticket attached as a PDF.
                        </p>
                        <!-- Event Details -->
                        <div style="background:#f9f9f9; padding:20px; border-radius:8px; margin:20px 0; border-left:4px solid #009739;">
                            <h3 style="color:#009739; margin-top:0;">Event Details:</h3>
                            <p style="margin:5px 0; color:#333;"><strong>Date:</strong> 04 October 2025</p>
                            <p style="margin:5px 0; color:#333;"><strong>Time:</strong> Starts at 12:00</p>
                            <p style="margin:5px 0; color:#333;"><strong>Ticket ID:</strong> ${ticketData.ticketID}</p>
                        </div>
                        <!-- Notes -->
                        <div style="background:#fffbe6; padding:15px; border-radius:8px; margin:20px 0; border:1px solid #ffe58f;">
                            <h4 style="color:#856404; margin-top:0;">Important Notes:</h4>
                            <ul style="color:#555; margin:0; padding-left:20px; line-height:1.5;">
                                <li>Please present this ticket at the entrance</li>
                                <li>This ticket is valid for one entry only</li>
                                <li>BOB (Bring your own bottles)</li>
                                <li>Free food and cocktails provided</li>
                                <li>Free transport available</li>
                            </ul>
                        </div>
                        <p style="color:#333; line-height:1.6;">
                            For inquiries, please contact <strong>Alvin Maluleke</strong> @ <a href="tel:0823066975" style="color:#009739; text-decoration:none;">082 306 6975</a>.
                        </p>
                        <!-- Footer Message -->
                        <div style="text-align:center; margin:30px 0;">
                            <p style="color:#000; font-weight:bold; margin:0;">Thank you for making your voice heard</p>
                            <p style="color:#009739; font-weight:bold; margin:5px 0 0;">#The Future is not a mistake</p>
                        </div>
                    </div>
                    <!-- Footer -->
                    <div style="background:#000; padding:20px; text-align:center; color:#ccc; font-size:12px;">
                        <p style="margin:0; color:#fff;">Action SA Students Chapter</p>
                        <p style="margin:5px 0 0;">This ticket is non-transferable and entry is subject to verification.</p>
                    </div>
                </div>
            </div>
        `,
        attachments: [
                {
                    filename: `ticket-${ticketData.ticketID}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                },
            ],
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

module.exports = {
    sendTicketEmail,
};
