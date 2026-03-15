const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPortfolio } = require('../controllers/portfolioController');

// Full portfolio dashboard — investments + payouts + withdrawals + summary
router.get('/', protect, getPortfolio);

module.exports = router;
