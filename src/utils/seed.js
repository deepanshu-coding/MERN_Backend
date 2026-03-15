/**
 * SoulLink Co. — Database Seed Script
 * Run: node src/utils/seed.js
 *
 * Creates:
 *  - 1 admin user
 *  - 2 sample investor users (KYC approved)
 *  - 2 sample active investments
 *  - Sample payouts
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Investment = require('../models/Investment');
const Payout = require('../models/Payout');

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Clean slate
    await Promise.all([
      User.deleteMany({}),
      Investment.deleteMany({}),
      Payout.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // ── Admin ─────────────────────────────────────────────
    const admin = await User.create({
      fullName:      'D.P. Sharma',
      email:         'admin@soullinkco.com',
      mobile:        '9999999999',
      aadhaarNumber: '999999999999',
      panNumber:     'ABCDE9999F',
      role:          'admin',
      kycStatus:     'approved',
    });
    console.log(`👤 Admin created: ${admin.email}`);

    // ── Investor 1 ────────────────────────────────────────
    const investor1 = await User.create({
      fullName:      'Rahul Gupta',
      email:         'rahul@example.com',
      mobile:        '9876543210',
      aadhaarNumber: '123456789012',
      panNumber:     'ABCPG1234R',
      kycStatus:     'approved',
      bankDetails: {
        bankName:          'State Bank of India',
        accountNumber:     '31234567890',
        ifscCode:          'SBIN0001234',
        accountHolderName: 'Rahul Gupta',
      },
      totalInvested:  142000,
      totalEarnings:  21360,
      currentValue:   163360,
    });

    // ── Investor 2 ────────────────────────────────────────
    const investor2 = await User.create({
      fullName:      'Priya Singh',
      email:         'priya@example.com',
      mobile:        '9876543211',
      aadhaarNumber: '234567890123',
      panNumber:     'CDEFS2345P',
      kycStatus:     'approved',
      bankDetails: {
        bankName:          'HDFC Bank',
        accountNumber:     '50100234567890',
        ifscCode:          'HDFC0001234',
        accountHolderName: 'Priya Singh',
      },
      totalInvested:  50000,
      totalEarnings:  7480,
      currentValue:   57480,
    });
    console.log(`👤 Investors created: ${investor1.email}, ${investor2.email}`);

    // ── Investments ───────────────────────────────────────
    const inv1 = await Investment.create({
      user:          investor1._id,
      fundName:      'SoulLink Quant Alpha',
      amount:        92000,
      currentValue:  105880,
      totalReturns:  13880,
      paymentMode:   'bank_transfer',
      utrNumber:     'UTR20240301001',
      status:        'active',
      activatedAt:   new Date('2024-03-01'),
      monthlyReturnRate: 8,
    });

    const inv2 = await Investment.create({
      user:          investor1._id,
      fundName:      'SoulLink Growth Fund',
      amount:        50000,
      currentValue:  57480,
      totalReturns:  7480,
      paymentMode:   'upi',
      transactionId: 'UPI20240101001',
      status:        'active',
      activatedAt:   new Date('2024-01-01'),
      monthlyReturnRate: 8,
    });

    const inv3 = await Investment.create({
      user:          investor2._id,
      fundName:      'SoulLink Growth Fund',
      amount:        50000,
      currentValue:  57480,
      totalReturns:  7480,
      paymentMode:   'upi',
      transactionId: 'UPI20240201001',
      status:        'active',
      activatedAt:   new Date('2024-02-01'),
      monthlyReturnRate: 8,
    });
    console.log('💰 Investments created');

    // ── Sample payouts (last 3 months) ────────────────────
    const now   = new Date();
    const payoutData = [];

    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = MONTH_NAMES[d.getMonth()];
      const year  = d.getFullYear();

      for (const inv of [inv1, inv2, inv3]) {
        const amt = parseFloat(((inv.amount * 8) / 100).toFixed(2));
        payoutData.push({
          user:          inv.user,
          investment:    inv._id,
          month,
          year,
          amount:        amt,
          rate:          8,
          principalBase: inv.amount,
          status:        'paid',
          paidAt:        d,
        });
      }
    }

    await Payout.insertMany(payoutData);
    console.log(`📅 ${payoutData.length} payouts created`);

    console.log('\n✅ Database seeded successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('LOGIN TO TEST:');
    console.log('  Admin    Aadhaar: 999999999999');
    console.log('  Investor Aadhaar: 123456789012');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
