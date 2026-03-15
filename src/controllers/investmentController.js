const Investment = require('../models/Investment');
const User = require('../models/User');
const { sendInvestmentConfirmation } = require('../utils/otpService');
const logger = require('../utils/logger');

// ── POST /api/investments ────────────────────────────────────
exports.createInvestment = async (req, res, next) => {
  try {
    const { amount, fundName, paymentMode, transactionId, utrNumber } = req.body;

    const investment = await Investment.create({
      user:          req.user._id,
      amount:        parseFloat(amount),
      currentValue:  parseFloat(amount),
      fundName:      fundName || 'SoulLink Growth Fund',
      paymentMode,
      transactionId,
      utrNumber,
      status:        'pending',
    });

    // Update user total (pending — will be confirmed by admin)
    // Notify admin + user
    sendInvestmentConfirmation(req.user, investment).catch(() => {});

    logger.info(`New investment created: ${investment._id} by user ${req.user._id} — ₹${amount}`);

    res.status(201).json({
      success: true,
      message: 'Investment request submitted. Verification within 24 hours.',
      data: investment,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/investments/my ──────────────────────────────────
exports.getMyInvestments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Investment.countDocuments(filter);
    const investments = await Investment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Aggregate summary
    const summary = await Investment.aggregate([
      { $match: { user: req.user._id, status: { $in: ['active', 'completed'] } } },
      {
        $group: {
          _id: null,
          totalInvested:  { $sum: '$amount' },
          currentValue:   { $sum: '$currentValue' },
          totalReturns:   { $sum: '$totalReturns' },
        },
      },
    ]);

    const s = summary[0] || { totalInvested: 0, currentValue: 0, totalReturns: 0 };

    res.json({
      success: true,
      data: {
        investments,
        summary: {
          totalInvested: s.totalInvested,
          currentValue:  s.currentValue,
          totalEarnings: s.totalReturns,
          roi: s.totalInvested > 0
            ? ((s.totalReturns / s.totalInvested) * 100).toFixed(2)
            : '0.00',
        },
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

// ── GET /api/investments/my/:id ──────────────────────────────
exports.getInvestmentById = async (req, res, next) => {
  try {
    const investment = await Investment.findOne({
      _id:  req.params.id,
      user: req.user._id,
    });
    if (!investment) {
      return res.status(404).json({ success: false, message: 'Investment not found.' });
    }
    res.json({ success: true, data: investment });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/investments  (Admin) ────────────────────────────
exports.getAllInvestments = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20, status,
      userId, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.user = userId;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const sort  = { [sortBy]: order === 'asc' ? 1 : -1 };
    const total = await Investment.countDocuments(filter);

    const investments = await Investment.find(filter)
      .populate('user', 'fullName email mobile kycStatus')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Global summary
    const globalSummary = await Investment.aggregate([
      { $match: { status: { $in: ['active', 'completed'] } } },
      {
        $group: {
          _id: null,
          totalAUM:       { $sum: '$currentValue' },
          totalInvested:  { $sum: '$amount' },
          totalReturns:   { $sum: '$totalReturns' },
          count:          { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        investments,
        globalSummary: globalSummary[0] || { totalAUM: 0, totalInvested: 0, totalReturns: 0, count: 0 },
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

// ── PATCH /api/investments/:id/status  (Admin) ───────────────
exports.updateInvestmentStatus = async (req, res, next) => {
  try {
    const { status, adminNotes, rejectionReason } = req.body;

    const investment = await Investment.findById(req.params.id).populate('user');
    if (!investment) {
      return res.status(404).json({ success: false, message: 'Investment not found.' });
    }

    const wasActive   = investment.status === 'active';
    const isActivating = status === 'active' && !wasActive;

    investment.status      = status;
    investment.adminNotes  = adminNotes || investment.adminNotes;
    investment.verifiedBy  = req.user._id;
    if (rejectionReason) investment.rejectionReason = rejectionReason;
    if (isActivating) investment.activatedAt = new Date();

    await investment.save();

    // Update user portfolio totals when activating
    if (isActivating && investment.user) {
      await User.findByIdAndUpdate(investment.user._id, {
        $inc: { totalInvested: investment.amount, currentValue: investment.amount },
      });
    }
    // If rejected/withdrawn, reverse the amounts
    if ((status === 'rejected' || status === 'withdrawn') && wasActive && investment.user) {
      await User.findByIdAndUpdate(investment.user._id, {
        $inc: {
          totalInvested: -investment.amount,
          currentValue:  -investment.currentValue,
        },
      });
    }

    logger.info(`Investment ${investment._id} status → ${status} by admin ${req.user._id}`);

    res.json({
      success: true,
      message: `Investment status updated to "${status}".`,
      data: investment,
    });
  } catch (error) {
    next(error);
  }
};
