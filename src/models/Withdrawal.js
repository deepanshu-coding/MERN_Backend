const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  investment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
  },

  // ── Amounts ───────────────────────────────────────────
  amount:       { type: Number, required: true, min: 1 },
  withdrawType: {
    type: String,
    enum: ['earnings', 'principal', 'full'],
    default: 'earnings',
  },

  // ── Bank Details snapshot at time of withdrawal ───────
  bankName:          { type: String },
  accountNumber:     { type: String },
  ifscCode:          { type: String },
  accountHolderName: { type: String },

  // ── Status ───────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'completed', 'rejected'],
    default: 'pending',
    index: true,
  },
  rejectionReason: { type: String },
  adminNotes:      { type: String },

  // ── Processing ───────────────────────────────────────
  utrNumber:    { type: String },  // UTR when payment is sent
  processedAt:  { type: Date },
  processedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── User notes ───────────────────────────────────────
  remarks: { type: String, maxlength: 300 },

  requestedAt: { type: Date, default: Date.now },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, {
  timestamps: true,
});

withdrawalSchema.index({ user: 1, status: 1 });
withdrawalSchema.index({ status: 1, requestedAt: -1 });

withdrawalSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
