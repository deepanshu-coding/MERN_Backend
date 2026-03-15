const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const {
  signup,
  sendOTP,
  verifyOTP,
  refreshToken,
  logout,
  getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// ── Signup ──────────────────────────────────────────────────
router.post('/signup', [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('mobile').trim().matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian mobile number required'),
  body('dateOfBirth').optional().isDate().withMessage('Valid date of birth required'),
  body('aadhaarNumber').trim().matches(/^\d{12}$/).withMessage('Valid 12-digit Aadhaar number required'),
  body('panNumber').trim().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Valid PAN number required (e.g. ABCDE1234F)'),
  body('bankDetails.bankName').optional().trim().notEmpty(),
  body('bankDetails.accountNumber').optional().trim().notEmpty(),
  body('bankDetails.ifscCode').optional().trim().matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Valid IFSC code required'),
  body('bankDetails.accountHolderName').optional().trim().notEmpty(),
], validate, signup);

// ── Send OTP ────────────────────────────────────────────────
router.post('/send-otp', [
  body('aadhaarNumber').trim().matches(/^\d{12}$/).withMessage('Valid 12-digit Aadhaar number required'),
], validate, sendOTP);

// ── Verify OTP & Login ──────────────────────────────────────
router.post('/verify-otp', [
  body('aadhaarNumber').trim().matches(/^\d{12}$/).withMessage('Valid Aadhaar required'),
  body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit OTP required'),
], validate, verifyOTP);

// ── Refresh Token ───────────────────────────────────────────
router.post('/refresh', refreshToken);

// ── Logout ──────────────────────────────────────────────────
router.post('/logout', protect, logout);

// ── Get current user ────────────────────────────────────────
router.get('/me', protect, getMe);

module.exports = router;
