const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to,
    subject,
    html,
  };
  await transporter.sendMail(mailOptions);
};

const passwordResetTemplate = (name, resetUrl) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#f97316;">Saral Pooja - Password Reset</h2>
    <p>Hello ${name},</p>
    <p>You requested to reset your password. Click the button below to reset it:</p>
    <a href="${resetUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">
      Reset Password
    </a>
    <p>This link expires in 30 minutes.</p>
    <p>If you did not request this, please ignore this email.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
    <p style="color:#999;font-size:12px;">© 2024 Saral Pooja. All rights reserved.</p>
  </div>
`;

const bookingConfirmTemplate = (name, booking) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#f97316;">Booking Confirmed!</h2>
    <p>Hello ${name},</p>
    <p>Your pooja booking has been received. Details:</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Booking ID</td><td style="padding:8px;border-bottom:1px solid #eee;">${booking._id}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Date</td><td style="padding:8px;border-bottom:1px solid #eee;">${new Date(booking.bookingDate).toLocaleDateString('en-IN')}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Time</td><td style="padding:8px;border-bottom:1px solid #eee;">${booking.bookingTime}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Amount Paid</td><td style="padding:8px;">₹${booking.amount}</td></tr>
    </table>
    <p>Our team will assign a pandit shortly.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
    <p style="color:#999;font-size:12px;">© 2024 Saral Pooja. All rights reserved.</p>
  </div>
`;

module.exports = { sendEmail, passwordResetTemplate, bookingConfirmTemplate };
