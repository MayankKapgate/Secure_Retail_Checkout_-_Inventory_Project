// ──────────────────────────────────────────────
// JWT Authentication Middleware
// ──────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

/**
 * authenticate — Verifies the Bearer token from the Authorization header
 * and attaches the full user record (minus password) to `req.user`.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * authorize — Role-based access control.
 * Usage: authorize('ADMIN') or authorize('ADMIN', 'CUSTOMER')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden. You do not have permission to access this resource.',
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
