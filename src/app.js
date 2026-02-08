const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

/**
 * ✅ CORS FIRST (before routes)
 */
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    const ok =
      /^http:\/\/localhost:\d+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);

    if (ok) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/customers', require('./routes/customer'));
app.use('/api/products', require('./routes/product'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/suppliers', require('./routes/supplier'));

// ✅ NEW: Upload route
app.use('/api/upload', require('./routes/upload'));

// ✅ NEW: Cart Telegram notification routes
app.use('/api/cart', require('./routes/cart'));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Error handler (keep AFTER routes)
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message,
  });
});

// MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/coffee';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

module.exports = app;