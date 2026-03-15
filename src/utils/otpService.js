const crypto = require('crypto');
const nodemailer = require('nodemailer');
const logger = require('./logger');

// ─── Generate OTP ─────────────────────────────────────────────
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
};

// ─── Email Transporter ────────────────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransporter({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ─── Send OTP via Email ───────────────────────────────────────
const sendOTPEmail = async (email, otp, fullName = '') => {
  try {
    const transporter = createTransporter();
    const expiryMins  = process.env.OTP_EXPIRY_MINUTES || 10;

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'SoulLink Co. <soullinkco.pvt.ltd@gmail.com>',
      to:      email,
      subject: 'Your SoulLink Co. Login OTP',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#070b14;color:#e8edf8;border-radius:12px;padding:36px;border:1px solid #1a2744">
          <div style="text-align:center;margin-bottom:24px">
            <h2 style="font-size:24px;font-weight:700;color:#e8edf8;margin:0">SoulLink <span style="color:#c9a84c">Co.</span></h2>
            <p style="color:#556888;font-size:12px;margin-top:4px">India's Quantitative Hedge Fund</p>
          </div>
          <p style="color:#9aaec8;font-size:14px">Hello ${fullName || 'Investor'},</p>
          <p style="color:#9aaec8;font-size:14px;margin:8px 0">Your one-time password for SoulLink Co. login:</p>
          <div style="background:#0f1a30;border:1px solid #4f7cff33;border-radius:10px;padding:20px;text-align:center;margin:24px 0">
            <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#4f7cff;font-family:'Courier New',monospace">${otp}</div>
            <p style="color:#556888;font-size:11px;margin-top:10px">Valid for ${expiryMins} minutes</p>
          </div>
          <p style="color:#556888;font-size:12px">If you did not request this OTP, please ignore this email or contact us immediately.</p>
          <hr style="border:none;border-top:1px solid #1a2744;margin:20px 0">
          <p style="color:#556888;font-size:11px;text-align:center">SoulLink Co. Pvt. Ltd. · Kanpur, Uttar Pradesh · soullinkco.pvt.ltd@gmail.com</p>
        </div>
      `,
    });

    logger.info(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send OTP email to ${email}: ${error.message}`);
    return false;
  }
};

// ─── Send OTP via SMS (Twilio) ────────────────────────────────
const sendOTPSMS = async (mobile, otp) => {
  try {
    // Only attempt if Twilio is configured
    if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID === 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      logger.warn('Twilio not configured. Skipping SMS send.');
      return false;
    }

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    await client.messages.create({
      body: `Your SoulLink Co. OTP is: ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do not share with anyone.`,
      from: process.env.TWILIO_FROM_NUMBER,
      to:   mobile.startsWith('+') ? mobile : `+91${mobile}`,
    });

    logger.info(`OTP SMS sent to ${mobile}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send OTP SMS to ${mobile}: ${error.message}`);
    return false;
  }
};

// ─── Send Investment Confirmation Email ───────────────────────
const sendInvestmentConfirmation = async (user, investment) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: `Investment Request Received — ₹${investment.amount.toLocaleString('en-IN')}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#070b14;color:#e8edf8;border-radius:12px;padding:36px;border:1px solid #1a2744">
          <h2 style="color:#e8edf8">Investment Request Received</h2>
          <p style="color:#9aaec8">Dear ${user.fullName},</p>
          <p style="color:#9aaec8">Your investment request has been received and is under review.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="color:#556888;padding:8px 0;border-bottom:1px solid #1a2744">Fund</td><td style="color:#e8edf8;padding:8px 0;border-bottom:1px solid #1a2744">${investment.fundName}</td></tr>
            <tr><td style="color:#556888;padding:8px 0;border-bottom:1px solid #1a2744">Amount</td><td style="color:#c9a84c;font-weight:700;padding:8px 0;border-bottom:1px solid #1a2744">₹${investment.amount.toLocaleString('en-IN')}</td></tr>
            <tr><td style="color:#556888;padding:8px 0;border-bottom:1px solid #1a2744">Payment Mode</td><td style="color:#e8edf8;padding:8px 0;border-bottom:1px solid #1a2744">${investment.paymentMode.toUpperCase()}</td></tr>
            <tr><td style="color:#556888;padding:8px 0">Status</td><td style="color:#4ade80;padding:8px 0">Under Review</td></tr>
          </table>
          <p style="color:#556888;font-size:12px">Verification typically takes up to 24 hours. You'll receive a confirmation once approved.</p>
          <hr style="border:none;border-top:1px solid #1a2744;margin:20px 0">
          <p style="color:#556888;font-size:11px;text-align:center">SoulLink Co. Pvt. Ltd. · soullinkco.pvt.ltd@gmail.com</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    logger.error(`Failed to send investment confirmation email: ${error.message}`);
    return false;
  }
};

// ─── Send Withdrawal Request Notification ─────────────────────
const sendWithdrawalNotification = async (user, withdrawal) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: `Withdrawal Request — ₹${withdrawal.amount.toLocaleString('en-IN')}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#070b14;color:#e8edf8;border-radius:12px;padding:36px;border:1px solid #1a2744">
          <h2 style="color:#e8edf8">Withdrawal Request Received</h2>
          <p style="color:#9aaec8">Dear ${user.fullName},</p>
          <p style="color:#9aaec8">Your withdrawal request of <strong style="color:#c9a84c">₹${withdrawal.amount.toLocaleString('en-IN')}</strong> has been received and will be processed within 3-5 business days.</p>
          <hr style="border:none;border-top:1px solid #1a2744;margin:20px 0">
          <p style="color:#556888;font-size:11px;text-align:center">SoulLink Co. Pvt. Ltd. · soullinkco.pvt.ltd@gmail.com</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    logger.error(`Failed to send withdrawal notification: ${error.message}`);
    return false;
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendOTPSMS,
  sendInvestmentConfirmation,
  sendWithdrawalNotification,
};
