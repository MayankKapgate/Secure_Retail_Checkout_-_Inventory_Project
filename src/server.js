// ──────────────────────────────────────────────
// Server Entry Point — Secure Retail Checkout & Inventory API
// ──────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// Middleware
const { globalLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const checkoutRoutes = require('./routes/checkout');

// ─── Initialize Express ───
const app = express();
const PORT = process.env.PORT || 3000;

// ─── Trust proxy (for correct IP behind reverse proxies) ───
app.set('trust proxy', 1);

// ─── Global Middleware Stack ───

// 1. Secure HTTP headers
app.use(helmet());

// 2. CORS
app.use(cors());

// 3. Body parser
app.use(express.json({ limit: '10kb' })); // limit payload size to prevent abuse

// 4. ★ Global Rate Limiter — 100 requests per 15 min per IP ★
app.use(globalLimiter);

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/checkout', checkoutRoutes);

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found.` });
});

// ─── Global Error Handler ───
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message,
  });
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║  Retail Checkout & Inventory API             ║
  ║  Running on: http://localhost:${PORT}           ║
  ║  Environment: ${process.env.NODE_ENV || 'development'}               ║
  ╚══════════════════════════════════════════════╝
  `);
});

module.exports = app;
