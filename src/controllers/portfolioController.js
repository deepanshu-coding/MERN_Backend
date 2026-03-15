const Investment = require('../models/Investment');
const Withdrawal = require('../models/Withdrawal');
const Payout = require('../models/Payout');
const User = require('../models/User');

// ── GET /api/portfolio ───────────────────────────────────────
exports.getPortfolio = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // ── Active investments ───────────────────────────────
    const investments = await Investment.find({
      user:   userId,
      status: { $in: ['active', 'pending', 'under_review'] },
    }).sort({ investedAt: -1 });

    // ── Payout history (last 24) ─────────────────────────
    const payouts = await Payout.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(24)
      .populate('investment', 'fundName');

    // ── Transaction history (all investments) ────────────
    const transactions = await Investment.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    // ── Withdrawal history ───────────────────────────────
    const withdrawals = await Withdrawal.find({ user: userId })
      .sort({ requestedAt: -1 })
      .limit(20);

    // ── Monthly returns chart data (last 12 months) ──────
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyReturns = await Payout.aggregate([
      {
        $match: {
          user:   userId,
          status: 'paid',
          paidAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year:  { $year:  '$paidAt' },
            month: { $month: '$paidAt' },
          },
          totalPayout: { $sum: '$amount' },
          rate:        { $avg: '$rate' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // ── Portfolio summary from User doc ──────────────────
    const user = await User.findById(userId);
    const summary = {
      totalInvested:  user.totalInvested,
      currentValue:   user.currentValue,
      totalEarnings:  user.totalEarnings,
      roi:            user.roi,
    };

    res.json({
      success: true,
      data: {
        summary,
        investments,
        payouts,
        withdrawals,
        transactions,
        monthlyReturns,
      },
    });
  } catch (error) {
    next(error);
  }
};
