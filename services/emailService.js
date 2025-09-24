const nodemailer = require("nodemailer");
const { generateTicketPdf } = require("./pdfService");

const createTransporter = () => {
    return nodemailer.createTransporter({
        service: 'gmail',
        host:'smtp.gmail.com',
        port:587,
        secure:false,
        auth:{
            user:process.env.EMAIL_USER,
            pass:process.env.EMAIL_PASS,
        }
    })
}

const createSendGridTransporter = () => {
    return nodemailer.createTransporter({
        host:'smtp.sendgrid.net',
        port:587,
        secure:false,
        auth:{
            user:'apikey',
            pass:process.env.SENDGRID_API_KEY
        }
    })
}

const sendTicketEmail = async (ticketData) => {
    try{

        const pdfBuffer = await generateTicketPdf(ticketData);

        const transporter = createTransporter();

        const mailOptions = {
            from:{
                name: 'Action SA Students Chapter',
                address: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            },
            to: ticketData.email,
            subject: 'Your Pool Ticket - Action SA Students Chapter',
            html: `
            <div style="font-family:Arial, sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg, #1a365d, #2d3748);padding:30px;text-align:center;color:white;">
                    <h1 style="margin:0;font-size:28px;">Pool Party Ticket</h1>
                    <p style="margin:10px 0 0; font-size:16px;">Action SA Students Chapter</p>
                </div>

                <div style="padding:30px;background: #f7fafc;">
                    <h2 style="color: #1a5d26ff; margin-top:0;">Hello</h2>
                    <p style="color: #4a5568; line-height:1.6;"> 
                        Your ticket for the Action SA Students Chapter Pool Party! Please find your ticket attached as a PDF
                    </p>

                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a365d;">
                        <h3 style="color: #1a365d; margin-top: 0;">Event Details:</h3>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Date:</strong> 04 October 2025</p>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Time:</strong> Event Starts at 12:00</p>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Ticket ID:</strong> ${ticketData.ticketID}</p>
                    </div>

                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="color: #856404; margin-top:0;">Important Notes:</h4>
                        <ul style="color: #856404; margin: 0; padding-left: 20px;">
                            <li>Please present this ticket at entrance</li>
                            <li>This ticket is valid for one entry only</li>
                            <li>BOB</li>
                            <li>Free food and cocktails provided</li>
                            <li>Free transport available</li>
                        </ul>
                    </div>

                    <p style="color: #4a5568; line-height: 1.6;">
                        If you have any questions, please contact ...
                    </p>

                    <div style="text-align: center; margin: 30px 0;">
                        <p style="color: #1a365d; font-weight: bold; margin: 0;">
                            Thank you for making your voice heard
                        </p>
                        <p style="color: #1a365d; font-weight: bold; margin: 5px 0 0;">
                            #The_Future_Is_Not_A_Mistake
                        </p>
                    </div>
                </div>

                <div style="background: #e2e8f0; padding: 20px; text-align: center; color: #718096; font-size: 12px;">
                    <p style="margin: 0;">Action SA Students Chapter</p>
                    <p style="margin: 5px 0 0;">This ticket is non-transferable and entry is subject to verification.</p>
                </div>
            </div>
            `,
            attachments: [
                {
                    filename: `ticket-${ticketData.ticketID}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);

        return {
            success: true,
            messageId: info.messageId
        }
    }catch(error){
        console.error('Email sending failed:', error);
        throw new Error(`Failed to send email: ${error.message}`)
    }
}

module.exports = {
    sendTicketEmail
}