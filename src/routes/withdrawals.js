const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly, kycRequired } = require('../middleware/auth');
const {
  requestWithdrawal,
  getMyWithdrawals,
  getAllWithdrawals,
  updateWithdrawalStatus,
} = require('../controllers/withdrawalController');

// ── Investor ────────────────────────────────────────────────
router.post('/', protect, kycRequired, [
  body('amount')
    .isNumeric().withMessage('Amount must be a number')
    .custom(v => v > 0).withMessage('Amount must be greater than 0'),
  body('withdrawType')
    .optional()
    .isIn(['earnings', 'principal', 'full'])
    .withMessage('Invalid withdraw type'),
  body('investmentId').optional().isMongoId().withMessage('Invalid investment ID'),
  body('remarks').optional().trim().isLength({ max: 300 }),
], validate, requestWithdrawal);

router.get('/my', protect, getMyWithdrawals);

// ── Admin ────────────────────────────────────────────────────
router.get('/', protect, adminOnly, getAllWithdrawals);
router.patch('/:id/status', protect, adminOnly, [
  body('status')
    .isIn(['pending','approved','processing','completed','rejected'])
    .withMessage('Invalid status'),
  body('utrNumber').optional().trim(),
  body('adminNotes').optional().trim(),
  body('rejectionReason').optional().trim(),
], validate, updateWithdrawalStatus);

module.exports = router;
