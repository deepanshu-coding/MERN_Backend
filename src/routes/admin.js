const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, adminOnly } = require('../middleware/auth');
const {
  getDashboardStats,
  createAdminUser,
} = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

// ── Dashboard Stats ─────────────────────────────────────────
router.get('/dashboard', getDashboardStats);

// ── Create admin user (requires ADMIN_SECRET header) ────────
router.post('/create-admin', [
  body('fullName').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('mobile').matches(/^[6-9]\d{9}$/),
  body('aadhaarNumber').matches(/^\d{12}$/),
  body('panNumber').matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/),
  body('adminSecret').notEmpty().withMessage('Admin secret required'),
], validate, createAdminUser);

module.exports = router;
