// ============================================================================
// PAYMENT ROUTES
// ============================================================================

// routes/payments.js - NEW FILE
const express = require('express');
const router = express.Router();
const paymentController = require('../controller/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Payment routes
router.get('/', paymentController.getPayments);
router.get('/stats/overview', authorize('admin', 'manager'), paymentController.getPaymentStats);
router.get('/:id', paymentController.getPayment);
router.post('/', paymentController.processPayment);
router.post('/:id/refund', authorize('admin', 'manager'), paymentController.processRefund);

module.exports = router;