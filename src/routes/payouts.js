const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const {
  getMyPayouts,
  getAllPayouts,
  createPayout,
  updatePayoutStatus,
  runMonthlyPayouts,
} = require('../controllers/payoutController');

// ── Investor ────────────────────────────────────────────────
router.get('/my', protect, getMyPayouts);

// ── Admin ────────────────────────────────────────────────────
router.get('/', protect, adminOnly, getAllPayouts);

// Create a single manual payout for an investment
router.post('/', protect, adminOnly, [
  body('investmentId').isMongoId().withMessage('Valid investment ID required'),
  body('month').trim().notEmpty().withMessage('Month required (e.g. Jun 2024)'),
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Valid year required'),
  body('amount').isNumeric().custom(v => v > 0).withMessage('Amount must be positive'),
  body('rate').optional().isNumeric(),
], validate, createPayout);

router.patch('/:id/status', protect, adminOnly, [
  body('status').isIn(['scheduled','processing','paid','failed']).withMessage('Invalid status'),
  body('utrNumber').optional().trim(),
], validate, updatePayoutStatus);

// Trigger monthly payouts for ALL active investments (1st of each month)
router.post('/run-monthly', protect, adminOnly, runMonthlyPayouts);

module.exports = router;
