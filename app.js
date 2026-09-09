const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();

// Behind Render's proxy: trust the first proxy so rate-limiting reads the real client IP.
app.set('trust proxy', 1);

app.use(helmet());

// CORS: allow the live site (any *.vercel.app, incl. preview URLs), an optional
// explicit FRONTEND_URL, and local dev. Non-browser callers (no Origin) are allowed.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://ticketdawg-web.vercel.app',
  'http://localhost:3000',
  'http://localhost:8081',
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || /\.dennis-mmachoenes-projects\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(compression());

// General rate limit (raised so busy scanning/issuing is not blocked).
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' },
});
app.use('/api', limiter);

// Tighter limit only on login attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Pool Party Ticketing API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Pool Party Ticketing API. See /health.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/activity', activityRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation error', details: Object.values(error.errors).map((e) => e.message) });
  }
  if (error.name === 'CastError') return res.status(400).json({ error: 'Invalid ID format' });
  if (error.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
  if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(409).json({ error: `${field} already exists` });
  }
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

module.exports = app;
