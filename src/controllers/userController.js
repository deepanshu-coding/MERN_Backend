const User = require('../models/User');
const logger = require('../utils/logger');

// ── GET /api/users/profile ───────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/users/profile ─────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['fullName', 'email', 'mobile', 'dateOfBirth'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    res.json({ success: true, message: 'Profile updated.', data: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/users/bank-details ────────────────────────────
exports.updateBankDetails = async (req, res, next) => {
  try {
    const { bankName, accountNumber, ifscCode, accountHolderName } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        bankDetails: { bankName, accountNumber, ifscCode: ifscCode.toUpperCase(), accountHolderName },
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    res.json({ success: true, message: 'Bank details updated.', data: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/users  (Admin) ──────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20,
      kycStatus, role, search,
      sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (kycStatus) filter.kycStatus = kycStatus;
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } },
        { mobile:   { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const sort  = { [sortBy]: order === 'asc' ? 1 : -1 };
    const total = await User.countDocuments(filter);
    const users = await User.find(filter).sort(sort).skip(skip).limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        users: users.map(u => u.toPublicProfile()),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/users/:id  (Admin) ──────────────────────────────
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/users/:id/kyc  (Admin) ────────────────────────
exports.updateKYCStatus = async (req, res, next) => {
  try {
    const { kycStatus, rejectionReason } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { kycStatus, ...(rejectionReason && { kycRejectionReason: rejectionReason }), updatedAt: new Date() },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    logger.info(`KYC status updated for user ${user._id}: ${kycStatus} by admin ${req.user._id}`);

    res.json({
      success: true,
      message: `KYC status updated to "${kycStatus}".`,
      data: user.toPublicProfile(),
    });
  } catch (error) {
    next(error);
  }
};
