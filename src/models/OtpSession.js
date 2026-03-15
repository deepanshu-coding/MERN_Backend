const mongoose = require('mongoose');

// Separate OTP session doc — keeps User model clean & allows rate limiting per mobile
const otpSessionSchema = new mongoose.Schema({
  mobile:     { type: String, required: true, index: true },
  aadhaar:    { type: String, required: true },
  otp:        { type: String, required: true },
  expiry:     { type: Date,   required: true },
  attempts:   { type: Number, default: 0 },
  verified:   { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now, expires: '15m' }, // TTL index — auto-deletes
}, {
  timestamps: false,
});

otpSessionSchema.index({ mobile: 1, createdAt: -1 });

module.exports = mongoose.model('OtpSession', otpSessionSchema);
