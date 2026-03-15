const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  updateBankDetails,
  getAllUsers,
  getUserById,
  updateKYCStatus,
} = require('../controllers/userController');

// ── Protected user routes ───────────────────────────────────
router.get('/profile', protect, getProfile);

router.patch('/profile', protect, [
  body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail(),
  body('mobile').optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid mobile number'),
], validate, updateProfile);

router.patch('/bank-details', protect, [
  body('bankName').trim().notEmpty().withMessage('Bank name required'),
  body('accountNumber').trim().notEmpty().withMessage('Account number required'),
  body('ifscCode').trim().matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Invalid IFSC code'),
  body('accountHolderName').trim().notEmpty().withMessage('Account holder name required'),
], validate, updateBankDetails);

// ── Admin routes ────────────────────────────────────────────
router.get('/', protect, adminOnly, getAllUsers);
router.get('/:id', protect, adminOnly, getUserById);
router.patch('/:id/kyc', protect, adminOnly, [
  body('kycStatus').isIn(['pending','under_review','approved','rejected']).withMessage('Invalid KYC status'),
  body('rejectionReason').optional().trim(),
], validate, updateKYCStatus);

module.exports = router;
