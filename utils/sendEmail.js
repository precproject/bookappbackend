const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.RESEND_MAIL_HOST,
      port: process.env.RESEND_MAIL_PORT || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.RESEND_MAIL_USER,
        pass: process.env.RESEND_MAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"SahakarStree Support"`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error(`Email sending failed to ${to}:`, error.message);
    return false;
  }
};

module.exports = sendEmail;