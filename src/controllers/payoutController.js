const Payout = require('../models/Payout');
const Investment = require('../models/Investment');
const User = require('../models/User');
const logger = require('../utils/logger');

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── GET /api/payouts/my ──────────────────────────────────────
exports.getMyPayouts = async (req, res, next) => {
  try {
    const { page = 1, limit = 24, year } = req.query;
    const filter = { user: req.user._id };
    if (year) filter.year = parseInt(year);

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Payout.countDocuments(filter);

    const payouts = await Payout.find(filter)
      .populate('investment', 'fundName amount')
      .sort({ year: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const summary = await Payout.aggregate([
      { $match: { user: req.user._id, status: 'paid' } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' },
          count:     { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        payouts,
        totalPaid: summary[0]?.totalPaid || 0,
        payoutCount: summary[0]?.count || 0,
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/payouts  (Admin) ─────────────────────────────────
exports.getAllPayouts = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, status, userId, year } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.user = userId;
    if (year)   filter.year  = parseInt(year);

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Payout.countDocuments(filter);

    const payouts = await Payout.find(filter)
      .populate('user', 'fullName email mobile')
      .populate('investment', 'fundName amount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        payouts,
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/payouts  (Admin — single manual payout) ─────────
exports.createPayout = async (req, res, next) => {
  try {
    const { investmentId, month, year, amount, rate = 8, notes } = req.body;

    const investment = await Investment.findById(investmentId).populate('user');
    if (!investment) {
      return res.status(404).json({ success: false, message: 'Investment not found.' });
    }

    // Check duplicate (same investment + month)
    const existing = await Payout.findOne({ investment: investmentId, month, year });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Payout for ${month} ${year} already exists for this investment.`,
      });
    }

    const payout = await Payout.create({
      user:          investment.user._id,
      investment:    investmentId,
      month,
      year:          parseInt(year),
      amount:        parseFloat(amount),
      rate:          parseFloat(rate),
      principalBase: investment.amount,
      notes,
    });

    logger.info(`Manual payout created: ${payout._id} for investment ${investmentId}`);

    res.status(201).json({
      success: true,
      message: 'Payout created.',
      data: payout,
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/payouts/:id/status  (Admin) ────────────────────
exports.updatePayoutStatus = async (req, res, next) => {
  try {
    const { status, utrNumber } = req.body;

    const payout = await Payout.findById(req.params.id).populate('user');
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found.' });

    const wasPaid = payout.status === 'paid';
    payout.status = status;
    if (utrNumber) payout.utrNumber = utrNumber;

    if (status === 'paid' && !wasPaid) {
      payout.paidAt  = new Date();
      payout.paidBy  = req.user._id;

      // Credit earnings to user
      if (payout.user) {
        await User.findByIdAndUpdate(payout.user._id, {
          $inc: {
            totalEarnings: payout.amount,
            currentValue:  payout.amount,
          },
        });

        // Update investment value too
        await Investment.findByIdAndUpdate(payout.investment, {
          $inc: {
            currentValue:  payout.amount,
            totalReturns:  payout.amount,
          },
        });
      }
    }

    await payout.save();
    logger.info(`Payout ${payout._id} status → ${status} by admin ${req.user._id}`);

    res.json({ success: true, message: `Payout marked as "${status}".`, data: payout });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/payouts/run-monthly  (Admin) ────────────────────
// Call this on 1st of each month to auto-generate scheduled payouts for ALL active investments
exports.runMonthlyPayouts = async (req, res, next) => {
  try {
    const now   = new Date();
    const month = MONTH_NAMES[now.getMonth()];
    const year  = now.getFullYear();

    const activeInvestments = await Investment.find({ status: 'active' }).populate('user');

    const results = { created: 0, skipped: 0, errors: [] };

    for (const inv of activeInvestments) {
      try {
        // Skip if already generated for this month
        const exists = await Payout.findOne({ investment: inv._id, month, year });
        if (exists) { results.skipped++; continue; }

        const payoutAmount = parseFloat(((inv.amount * inv.monthlyReturnRate) / 100).toFixed(2));

        await Payout.create({
          user:          inv.user._id,
          investment:    inv._id,
          month,
          year,
          amount:        payoutAmount,
          rate:          inv.monthlyReturnRate,
          principalBase: inv.amount,
          status:        'scheduled',
        });

        results.created++;
      } catch (err) {
        results.errors.push({ investmentId: inv._id, error: err.message });
      }
    }

    logger.info(`Monthly payouts run for ${month} ${year}: ${results.created} created, ${results.skipped} skipped.`);

    res.json({
      success: true,
      message: `Monthly payout generation complete for ${month} ${year}.`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};
