const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const {
  login,
  signup,
  sendOTP,
  verifyOTP,
  refreshToken,
  logout,
  getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', [
  body('identifier').trim().notEmpty().withMessage('Aadhaar number or User ID is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, login);

// ── POST /api/auth/signup ────────────────────────────────────
router.post('/signup', [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('mobile').trim().matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian mobile number required'),
  body('dateOfBirth').optional().isDate().withMessage('Valid date of birth required'),
  body('aadhaarNumber').trim().matches(/^\d{12}$/).withMessage('Valid 12-digit Aadhaar number required'),
  body('panNumber').trim().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Valid PAN number required'),
  body('bankDetails.bankName').optional().trim().notEmpty(),
  body('bankDetails.accountNumber').optional().trim().notEmpty(),
  body('bankDetails.ifscCode').optional().trim().matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Valid IFSC code required'),
  body('bankDetails.accountHolderName').optional().trim().notEmpty(),
], validate, signup);

// ── POST /api/auth/send-otp ──────────────────────────────────
router.post('/send-otp', [
  body('aadhaarNumber').trim().matches(/^\d{12}$/).withMessage('Valid 12-digit Aadhaar number required'),
], validate, sendOTP);

// ── POST /api/auth/verify-otp ────────────────────────────────
router.post('/verify-otp', [
  body('aadhaarNumber').trim().matches(/^\d{12}$/).withMessage('Valid Aadhaar required'),
  body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP required'),
], validate, verifyOTP);

// ── POST /api/auth/refresh ───────────────────────────────────
router.post('/refresh', refreshToken);

// ── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', protect, logout);

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', protect, getMe);

module.exports = router;
