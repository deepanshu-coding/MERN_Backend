const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Fund Details ─────────────────────────────────────
  fundName: {
    type: String,
    enum: ['SoulLink Growth Fund', 'SoulLink Quant Alpha'],
    required: true,
    default: 'SoulLink Growth Fund',
  },

  // ── Amount ───────────────────────────────────────────
  amount:       { type: Number, required: true, min: 10000 },
  currentValue: { type: Number, default: 0 },
  totalReturns: { type: Number, default: 0 },

  // ── Payment ───────────────────────────────────────────
  paymentMode: {
    type: String,
    enum: ['upi', 'bank_transfer'],
    required: true,
  },
  transactionId:  { type: String, trim: true },
  utrNumber:      { type: String, trim: true },
  paymentProof:   { type: String },    // URL or reference

  // ── Status ───────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'under_review', 'active', 'completed', 'rejected', 'withdrawn'],
    default: 'pending',
    index: true,
  },
  rejectionReason: { type: String },

  // ── Monthly Return Target ─────────────────────────────
  monthlyReturnRate: { type: Number, default: 8 },   // 8%

  // ── Dates ─────────────────────────────────────────────
  investedAt:     { type: Date, default: Date.now },
  activatedAt:    { type: Date },
  maturityDate:   { type: Date },

  // ── Admin Notes ───────────────────────────────────────
  adminNotes:     { type: String },
  verifiedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

// ── Indexes ──────────────────────────────────────────────────
investmentSchema.index({ user: 1, status: 1 });
investmentSchema.index({ status: 1, createdAt: -1 });

// ── Virtuals ─────────────────────────────────────────────────
investmentSchema.virtual('gainLoss').get(function () {
  return (this.currentValue || this.amount) - this.amount;
});

investmentSchema.virtual('gainLossPercent').get(function () {
  const gain = (this.currentValue || this.amount) - this.amount;
  return ((gain / this.amount) * 100).toFixed(2);
});

// ── Pre-save ──────────────────────────────────────────────────
investmentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (!this.currentValue) this.currentValue = this.amount;
  next();
});

module.exports = mongoose.model('Investment', investmentSchema);
