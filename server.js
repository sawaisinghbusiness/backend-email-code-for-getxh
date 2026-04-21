require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { getOtpEmailTemplate } = require('./emailTemplate');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = {};

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASS,
  },
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

  otpStore[email] = { otp, expiresAt };

  try {
    const info = await transporter.sendMail({
      from: "GETXH <agency@getxh.in>",
      to: email,
      subject: 'Your GETXH Verification Code',
      html: getOtpEmailTemplate(otp),
      text: `Your GETXH verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.\n\n© 2026 GETXH. All rights reserved.\nNeed help? support@getxh.in`,
    });

    console.log('MAIL SENT:', info);

    res.json({ success: true });
  } catch (err) {
    console.log('MAIL ERROR FULL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });
  }

  const record = otpStore[email];

  if (!record) {
    return res.json({ success: false, message: 'OTP not found. Please request a new one.' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.json({ success: false, message: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== otp) {
    return res.json({ success: false, message: 'Invalid OTP.' });
  }

  delete otpStore[email];
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
