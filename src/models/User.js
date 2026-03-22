const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const bankDetailsSchema = new mongoose.Schema({
  bankName:          { type: String, trim: true },
  accountNumber:     { type: String, trim: true },
  ifscCode:          { type: String, trim: true, uppercase: true },
  accountHolderName: { type: String, trim: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
  // ── Basic Info ───────────────────────────────────────
  fullName:    { type: String, required: true, trim: true, maxlength: 120 },
  email:       { type: String, required: true, unique: true, trim: true, lowercase: true },
  mobile:      { type: String, required: true, unique: true, trim: true, maxlength: 15 },
  dateOfBirth: { type: Date },

  // ── Password ─────────────────────────────────────────
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,   // never returned in queries by default
  },

  // ── KYC ─────────────────────────────────────────────
  aadhaarNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    select: false,
    maxlength: 12,
  },
  panNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: 10,
    select: false,
  },

  // ── Bank Details ──────────────────────────────────────
  bankDetails: bankDetailsSchema,

  // ── Account Status ───────────────────────────────────
  role: {
    type: String,
    enum: ['investor', 'admin'],
    default: 'investor',
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending',
  },
  kycRejectionReason: { type: String },
  isActive:        { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },

  // ── OTP ──────────────────────────────────────────────
  otp:         { type: String,  select: false },
  otpExpiry:   { type: Date,    select: false },
  otpAttempts: { type: Number,  default: 0, select: false },

  // ── Refresh Token ─────────────────────────────────────
  refreshToken: { type: String, select: false },

  // ── Portfolio Summary (denormalised) ─────────────────
  totalInvested: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  currentValue:  { type: Number, default: 0 },

  // ── Meta ─────────────────────────────────────────────
  lastLogin: { type: Date },
}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// ── Indexes ──────────────────────────────────────────────────
userSchema.index({ kycStatus: 1 });
userSchema.index({ role: 1 });

// ── Virtuals ─────────────────────────────────────────────────
userSchema.virtual('roi').get(function () {
  if (!this.totalInvested || this.totalInvested === 0) return 0;
  return ((this.totalEarnings / this.totalInvested) * 100).toFixed(2);
});

// ── Pre-save: hash password if modified ──────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance Methods ─────────────────────────────────────────

// Compare entered password with hashed password in DB
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.setOTP = function (otp) {
  const mins = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
  this.otp         = otp;
  this.otpExpiry   = new Date(Date.now() + mins * 60 * 1000);
  this.otpAttempts = 0;
};

userSchema.methods.isOTPValid = function (otp) {
  return this.otp === otp && this.otpExpiry > new Date();
};

userSchema.methods.clearOTP = function () {
  this.otp         = undefined;
  this.otpExpiry   = undefined;
  this.otpAttempts = 0;
};

// Safe public profile — no sensitive fields
userSchema.methods.toPublicProfile = function () {
  return {
    id:            this._id,
    fullName:      this.fullName,
    email:         this.email,
    mobile:        this.mobile,
    dateOfBirth:   this.dateOfBirth,
    role:          this.role,
    kycStatus:     this.kycStatus,
    isActive:      this.isActive,
    bankDetails:   this.bankDetails,
    totalInvested: this.totalInvested,
    totalEarnings: this.totalEarnings,
    currentValue:  this.currentValue,
    roi:           this.roi,
    lastLogin:     this.lastLogin,
    createdAt:     this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
