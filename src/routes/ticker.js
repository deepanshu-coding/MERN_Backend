const express = require('express');
const router = express.Router();

// Static fallback data (matches the frontend's static ticker)
const STATIC_TICKER = [
  { sym: 'NIFTY 50',   price: '22,418.45', change: '+0.62%', up: true  },
  { sym: 'BANKNIFTY',  price: '47,812.30', change: '+0.84%', up: true  },
  { sym: 'SENSEX',     price: '73,961.00', change: '+0.55%', up: true  },
  { sym: 'BITCOIN',    price: '$68,240',   change: '-1.12%', up: false },
  { sym: 'GOLD',       price: '₹71,450/10g', change: '+0.31%', up: true },
  { sym: 'USD/INR',    price: '83.42',     change: '-0.08%', up: false },
  { sym: 'NIFTY IT',   price: '35,211.60', change: '+1.22%', up: true  },
  { sym: 'CRUDE OIL',  price: '$84.62',    change: '+0.18%', up: true  },
];

// GET /api/ticker
// Returns market ticker data.
// In production, replace this with calls to a live market data API
// (e.g., NSE India API, Alpha Vantage, Yahoo Finance, or Upstox/Zerodha websocket).
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: STATIC_TICKER,
    updatedAt: new Date().toISOString(),
    note: 'Static fallback data. Integrate live market API for real-time prices.',
  });
});

module.exports = router;
