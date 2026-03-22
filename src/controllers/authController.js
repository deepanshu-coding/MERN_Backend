const User = require('../models/User');
const OtpSession = require('../models/OtpSession');
const { generateOTP, sendOTPEmail, sendOTPSMS } = require('../utils/otpService');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const logger = require('../utils/logger');

// In routes/auth.js — add this route
router.post('/login', [
  body('identifier').trim().notEmpty().withMessage('Aadhaar or User ID required'),
  body('password').notEmpty().withMessage('Password required'),
], validate, login);

// In controllers/authController.js — add this function
exports.login = async (req, res) => {
  const { identifier, password } = req.body;
  // find user by aadhaarNumber or _id
  const user = await User.findOne({
    $or: [{ aadhaarNumber: identifier }, { _id: identifier }]
  }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  const token = user.getSignedJwtToken(); // or however you generate tokens
  res.json({ success: true, token, user: { fullName: user.fullName, _id: user._id } });
};

// ── POST /api/auth/signup ────────────────────────────────────
exports.signup = async (req, res, next) => {
  try {
    const {
      fullName, email, mobile, dateOfBirth,
      aadhaarNumber, panNumber, bankDetails,
    } = req.body;

    // Check existing
    const existing = await User.findOne({
      $or: [{ email }, { mobile }, { aadhaarNumber }, { panNumber }],
    }).select('email mobile aadhaarNumber panNumber');

    if (existing) {
      if (existing.email === email)
        return res.status(409).json({ success: false, message: 'Email already registered.' });
      if (existing.mobile === mobile)
        return res.status(409).json({ success: false, message: 'Mobile number already registered.' });
      return res.status(409).json({ success: false, message: 'Aadhaar or PAN already registered.' });
    }

    const user = await User.create({
      fullName,
      email,
      mobile,
      dateOfBirth,
      aadhaarNumber,
      panNumber: panNumber.toUpperCase(),
      bankDetails,
    });

    // Send welcome email (non-blocking)
    sendOTPEmail(email, '------', fullName).catch(() => {});

    logger.info(`New user registered: ${user._id} (${email})`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. KYC verification is in progress — we\'ll notify you shortly.',
      data: { userId: user._id, kycStatus: user.kycStatus },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/send-otp ──────────────────────────────────
exports.sendOTP = async (req, res, next) => {
  try {
    const { aadhaarNumber } = req.body;

    // Find user by Aadhaar
    const user = await User.findOne({ aadhaarNumber }).select('+aadhaarNumber');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this Aadhaar number. Please sign up first.',
      });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }

    // Rate limit: max 5 OTPs per mobile in 15 minutes
    const recentOTPs = await OtpSession.countDocuments({
      mobile: user.mobile,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });
    if (recentOTPs >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please wait 15 minutes.',
      });
    }

    const otp = generateOTP(parseInt(process.env.OTP_LENGTH || '6'));
    const expiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000);

    // Store OTP session
    await OtpSession.create({
      mobile: user.mobile,
      aadhaar: aadhaarNumber,
      otp,
      expiry,
    });

    // Send via SMS and Email (parallel)
    const [smsSent, emailSent] = await Promise.all([
      sendOTPSMS(user.mobile, otp),
      user.email ? sendOTPEmail(user.email, otp, user.fullName) : Promise.resolve(false),
    ]);

    // In dev mode log OTP (never in production)
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[DEV] OTP for ${user.mobile}: ${otp}`);
    }

    const maskedMobile = user.mobile.replace(/(\d{2})\d{6}(\d{2})/, '$1XXXXXX$2');
    const maskedEmail  = user.email
      ? user.email.replace(/(.{2}).+(@.+)/, '$1****$2')
      : null;

    res.json({
      success: true,
      message: `OTP sent to your registered mobile ${maskedMobile}${maskedEmail ? ` and email ${maskedEmail}` : ''}.`,
      data: {
        mobile: maskedMobile,
        email:  maskedEmail,
        expiresIn: `${process.env.OTP_EXPIRY_MINUTES || 10} minutes`,
        smsSent,
        emailSent,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/verify-otp ────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
    const { aadhaarNumber, otp } = req.body;

    // Find user
    const user = await User.findOne({ aadhaarNumber }).select('+aadhaarNumber');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Find latest OTP session
    const session = await OtpSession.findOne({
      mobile: user.mobile,
      verified: false,
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new OTP.' });
    }

    // Check expiry
    if (session.expiry < new Date()) {
      await OtpSession.deleteOne({ _id: session._id });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Check attempts
    if (session.attempts >= 5) {
      await OtpSession.deleteOne({ _id: session._id });
      return res.status(400).json({ success: false, message: 'Too many wrong attempts. Request a new OTP.' });
    }

    // Verify OTP
    if (session.otp !== otp) {
      await OtpSession.updateOne({ _id: session._id }, { $inc: { attempts: 1 } });
      const remaining = 4 - session.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    // ✅ OTP is valid
    await OtpSession.updateOne({ _id: session._id }, { verified: true });

    // Update last login
    user.lastLogin = new Date();
    const refreshTok = generateRefreshToken(user._id);
    user.refreshToken = refreshTok;
    await user.save();

    const accessToken  = generateAccessToken(user._id, user.role);

    logger.info(`User logged in: ${user._id}`);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        refreshToken: refreshTok,
        user: user.toPublicProfile(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/refresh ───────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Refresh token mismatch.' });
    }

    const newAccessToken  = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/auth/logout ────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user.toPublicProfile() });
};
