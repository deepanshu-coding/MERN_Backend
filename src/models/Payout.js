const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  investment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    required: true,
  },

  // ── Payout Details ───────────────────────────────────
  month:        { type: String, required: true },  // e.g. "Jun 2024"
  year:         { type: Number, required: true },
  amount:       { type: Number, required: true },
  rate:         { type: Number, default: 8 },       // % rate applied
  principalBase:{ type: Number },                   // principal at time of payout

  // ── Status ───────────────────────────────────────────
  status: {
    type: String,
    enum: ['scheduled', 'processing', 'paid', 'failed'],
    default: 'scheduled',
    index: true,
  },

  // ── Payment Reference ─────────────────────────────────
  utrNumber:   { type: String },
  paidAt:      { type: Date },
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  notes: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

payoutSchema.index({ user: 1, year: -1 });
payoutSchema.index({ investment: 1, month: 1 }, { unique: true });
payoutSchema.index({ status: 1, paidAt: -1 });

payoutSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Payout', payoutSchema);
