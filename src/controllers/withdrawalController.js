const Withdrawal = require('../models/Withdrawal');
const Investment = require('../models/Investment');
const User = require('../models/User');
const { sendWithdrawalNotification } = require('../utils/otpService');
const logger = require('../utils/logger');

// ── POST /api/withdrawals ────────────────────────────────────
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, withdrawType = 'earnings', investmentId, remarks } = req.body;

    const user = await User.findById(req.user._id);

    // Ensure user has bank details
    if (!user.bankDetails || !user.bankDetails.accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please add your bank details before requesting a withdrawal.',
      });
    }

    // Validate sufficient balance
    const availableEarnings = user.totalEarnings - (user._withdrawnEarnings || 0);
    if (withdrawType === 'earnings' && parseFloat(amount) > user.totalEarnings) {
      return res.status(400).json({
        success: false,
        message: `Insufficient earnings. Available: ₹${user.totalEarnings.toFixed(2)}`,
      });
    }

    // Check pending withdrawals to avoid duplicates
    const pendingCount = await Withdrawal.countDocuments({
      user: req.user._id,
      status: { $in: ['pending', 'approved', 'processing'] },
    });
    if (pendingCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'You already have pending withdrawal requests. Please wait for them to complete.',
      });
    }

    const withdrawal = await Withdrawal.create({
      user:               req.user._id,
      investment:         investmentId,
      amount:             parseFloat(amount),
      withdrawType,
      remarks,
      bankName:           user.bankDetails.bankName,
      accountNumber:      user.bankDetails.accountNumber,
      ifscCode:           user.bankDetails.ifscCode,
      accountHolderName:  user.bankDetails.accountHolderName,
    });

    sendWithdrawalNotification(user, withdrawal).catch(() => {});
    logger.info(`Withdrawal request ${withdrawal._id} created by user ${req.user._id} — ₹${amount}`);

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted. Processing takes 3–5 business days.',
      data: withdrawal,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/withdrawals/my ──────────────────────────────────
exports.getMyWithdrawals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Withdrawal.countDocuments(filter);
    const withdrawals = await Withdrawal.find(filter)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Total withdrawn summary
    const summary = await Withdrawal.aggregate([
      { $match: { user: req.user._id, status: 'completed' } },
      { $group: { _id: null, totalWithdrawn: { $sum: '$amount' } } },
    ]);
    const totalWithdrawn = summary[0]?.totalWithdrawn || 0;

    res.json({
      success: true,
      data: {
        withdrawals,
        totalWithdrawn,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/withdrawals  (Admin) ─────────────────────────────
exports.getAllWithdrawals = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, userId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.user = userId;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Withdrawal.countDocuments(filter);

    const withdrawals = await Withdrawal.find(filter)
      .populate('user', 'fullName email mobile')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        withdrawals,
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/withdrawals/:id/status  (Admin) ────────────────
exports.updateWithdrawalStatus = async (req, res, next) => {
  try {
    const { status, utrNumber, adminNotes, rejectionReason } = req.body;

    const withdrawal = await Withdrawal.findById(req.params.id).populate('user');
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found.' });
    }

    const wasCompleted = withdrawal.status === 'completed';

    withdrawal.status    = status;
    withdrawal.adminNotes = adminNotes || withdrawal.adminNotes;
    withdrawal.processedBy = req.user._id;
    if (utrNumber) withdrawal.utrNumber = utrNumber;
    if (rejectionReason) withdrawal.rejectionReason = rejectionReason;

    if (status === 'completed' && !wasCompleted) {
      withdrawal.processedAt = new Date();
      // Deduct from user earnings
      if (withdrawal.user) {
        await User.findByIdAndUpdate(withdrawal.user._id, {
          $inc: { totalEarnings: -withdrawal.amount, currentValue: -withdrawal.amount },
        });
      }
    }

    await withdrawal.save();
    logger.info(`Withdrawal ${withdrawal._id} status → ${status} by admin ${req.user._id}`);

    res.json({
      success: true,
      message: `Withdrawal status updated to "${status}".`,
      data: withdrawal,
    });
  } catch (error) {
    next(error);
  }
};
