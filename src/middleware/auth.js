const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-aadhaarNumber -panNumber -otp -otpExpiry -refreshToken');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Token invalid — user not found.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact support.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    next(error);
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required.' });
};

const kycRequired = (req, res, next) => {
  if (req.user && req.user.kycStatus === 'approved') return next();
  return res.status(403).json({
    success: false,
    message: 'KYC verification required before performing this action.',
    kycStatus: req.user?.kycStatus || 'pending',
  });
};

module.exports = { protect, adminOnly, kycRequired };
