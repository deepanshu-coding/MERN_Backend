const User = require('../models/User');
const Investment = require('../models/Investment');
const Withdrawal = require('../models/Withdrawal');
const Payout = require('../models/Payout');
const logger = require('../utils/logger');

// ── GET /api/admin/dashboard ─────────────────────────────────
exports.getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);

    const [
      totalUsers,
      kycPending,
      kycApproved,
      totalInvestments,
      pendingInvestments,
      activeInvestments,
      pendingWithdrawals,
      totalPayoutsPaid,
      newUsersThisMonth,
      newInvestmentsThisMonth,
      aumData,
    ] = await Promise.all([
      User.countDocuments({ role: 'investor' }),
      User.countDocuments({ kycStatus: 'pending' }),
      User.countDocuments({ kycStatus: 'approved' }),
      Investment.countDocuments(),
      Investment.countDocuments({ status: 'pending' }),
      Investment.countDocuments({ status: 'active' }),
      Withdrawal.countDocuments({ status: { $in: ['pending', 'approved'] } }),
      Payout.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Investment.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Investment.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, totalAUM: { $sum: '$amount' }, currentValue: { $sum: '$currentValue' } } },
      ]),
    ]);

    // Monthly payout totals for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyPayoutChart = await Payout.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Recent activity
    const recentInvestments = await Investment.find({ status: 'pending' })
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentWithdrawals = await Withdrawal.find({ status: 'pending' })
      .populate('user', 'fullName email')
      .sort({ requestedAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          kycPending,
          kycApproved,
          newThisMonth: newUsersThisMonth,
        },
        investments: {
          total: totalInvestments,
          pending: pendingInvestments,
          active: activeInvestments,
          newThisMonth: newInvestmentsThisMonth,
          totalAUM: aumData[0]?.totalAUM || 0,
          currentValue: aumData[0]?.currentValue || 0,
        },
        withdrawals: {
          pendingCount: pendingWithdrawals,
        },
        payouts: {
          totalPaid: totalPayoutsPaid[0]?.total || 0,
          monthlyChart: monthlyPayoutChart,
        },
        recentActivity: {
          pendingInvestments: recentInvestments,
          pendingWithdrawals: recentWithdrawals,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/admin/create-admin ─────────────────────────────
exports.createAdminUser = async (req, res, next) => {
  try {
    const { adminSecret, fullName, email, mobile, aadhaarNumber, panNumber } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: 'Invalid admin secret.' });
    }

    const existing = await User.findOne({ $or: [{ email }, { mobile }, { aadhaarNumber }] });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists.' });
    }

    const admin = await User.create({
      fullName,
      email,
      mobile,
      aadhaarNumber,
      panNumber: panNumber.toUpperCase(),
      role: 'admin',
      kycStatus: 'approved',
    });

    logger.info(`Admin user created: ${admin._id} by ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: 'Admin user created.',
      data: { id: admin._id, email: admin.email, role: admin.role },
    });
  } catch (error) {
    next(error);
  }
};
