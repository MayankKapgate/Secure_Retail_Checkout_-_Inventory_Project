// ──────────────────────────────────────────────
// Rate Limiter Middleware — Enterprise DDoS Protection
// ──────────────────────────────────────────────
const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter:
 * - 100 requests per 15-minute window per IP
 * - Returns 429 status code when limit is exceeded
 * - Uses standard headers (RateLimit-*)
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // limit each IP to 100 requests per windowMs
  standardHeaders: true,     // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,      // Disable `X-RateLimit-*` headers
  message: {
    status: 429,
    error: 'Too many requests, please try again later.',
  },
  statusCode: 429,
  skipSuccessfulRequests: false,
});

/**
 * Stricter limiter for auth routes to prevent brute-force attacks:
 * - 20 requests per 15-minute window per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many authentication attempts, please try again later.',
  },
  statusCode: 429,
});

module.exports = { globalLimiter, authLimiter };
