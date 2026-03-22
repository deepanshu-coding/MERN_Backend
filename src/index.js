require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');
const investRoutes    = require('./routes/investments');
const withdrawRoutes  = require('./routes/withdrawals');
const portfolioRoutes = require('./routes/portfolio');
const adminRoutes     = require('./routes/admin');
const tickerRoutes    = require('./routes/ticker');
const payoutRoutes    = require('./routes/payouts');

const app = express();

// ─── Connect MongoDB ─────────────────────────────────────────
connectDB();

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize());

// ─── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_ALT,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'null',          // allows file:/// local testing (origin = "null")
].filter(Boolean); // removes undefined entries if env vars not set

const corsOptions = {
  origin: (origin, cb) => {
    // allow requests with no origin (Postman, curl, mobile apps)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    logger.warn(`CORS blocked origin: ${origin}`);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // ← CRITICAL: handle all preflight requests

// ─── Rate Limiting ────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});
app.use(globalLimiter);

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Logging ─────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SoulLink Co. API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth',       authLimiter, authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/investments', investRoutes);
app.use('/api/withdrawals', withdrawRoutes);
app.use('/api/portfolio',  portfolioRoutes);
app.use('/api/payouts',    payoutRoutes);
app.use('/api/ticker',     tickerRoutes);
app.use('/api/admin',      adminRoutes);

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 SoulLink API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});
