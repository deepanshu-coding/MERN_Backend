const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly, kycRequired } = require('../middleware/auth');
const {
  createInvestment,
  getMyInvestments,
  getInvestmentById,
  getAllInvestments,
  updateInvestmentStatus,
} = require('../controllers/investmentController');

// ── Investor ────────────────────────────────────────────────
router.post('/', protect, kycRequired, [
  body('amount')
    .isNumeric().withMessage('Amount must be a number')
    .custom(v => v >= 10000).withMessage('Minimum investment is ₹10,000'),
  body('fundName')
    .optional()
    .isIn(['SoulLink Growth Fund', 'SoulLink Quant Alpha'])
    .withMessage('Invalid fund name'),
  body('paymentMode')
    .isIn(['upi', 'bank_transfer'])
    .withMessage('Payment mode must be upi or bank_transfer'),
  body('transactionId').optional().trim().notEmpty(),
  body('utrNumber').optional().trim().notEmpty(),
], validate, createInvestment);

router.get('/my', protect, getMyInvestments);
router.get('/my/:id', protect, getInvestmentById);

// ── Admin ────────────────────────────────────────────────────
router.get('/', protect, adminOnly, getAllInvestments);
router.patch('/:id/status', protect, adminOnly, [
  body('status')
    .isIn(['pending','under_review','active','completed','rejected','withdrawn'])
    .withMessage('Invalid status'),
  body('adminNotes').optional().trim(),
  body('rejectionReason').optional().trim(),
], validate, updateInvestmentStatus);

module.exports = router;
