// routes/cart.js - Enhanced Cart Routes with Validation Endpoints
const express = require('express');
const router = express.Router();
const cartController = require('../controller/cartController');

// Optional: Add authentication middleware if needed
// const { protect } = require('../middleware/auth');

// ==========================================
// ✅ VALIDATION ENDPOINTS
// ==========================================

/**
 * @route   POST /api/cart/validate-product
 * @desc    Validate if a product can be added to cart
 * @access  Public
 * @body    { productId, quantity, currentCartQuantity }
 */
router.post('/validate-product', cartController.validateProduct);

/**
 * @route   POST /api/cart/validate-cart
 * @desc    Validate entire cart before checkout
 * @access  Public
 * @body    { cartItems: [] }
 */
router.post('/validate-cart', cartController.validateCart);

/**
 * @route   GET /api/cart/check-stock/:productId
 * @desc    Check current stock availability for a product
 * @access  Public
 */
router.get('/check-stock/:productId', cartController.checkProductStock);

/**
 * @route   POST /api/cart/check-stock-bulk
 * @desc    Check stock for multiple products at once
 * @access  Public
 * @body    { productIds: [] }
 */
router.post('/check-stock-bulk', cartController.bulkCheckStock);

// ==========================================
// ✅ CART NOTIFICATION ENDPOINTS (WITH VALIDATION)
// ==========================================

/**
 * @route   POST /api/cart/notify-add
 * @desc    Send notification when item is added to cart (validates first)
 * @access  Public
 * @body    { item: { product, quantity }, cartTotal }
 */
router.post('/notify-add', cartController.notifyItemAdded);

/**
 * @route   POST /api/cart/notify-summary
 * @desc    Send complete cart summary to Telegram (validates first)
 * @access  Public
 * @body    { cartItems: [], customerInfo?: { name, phone } }
 */
router.post('/notify-summary', cartController.sendCartSummary);

/**
 * @route   POST /api/cart/notify-checkout
 * @desc    Send notification when checkout is initiated (validates first)
 * @access  Public
 * @body    { cartItems: [], customerInfo: { name, phone }, orderNumber?: string }
 */
router.post('/notify-checkout', cartController.notifyCheckout);

/**
 * @route   POST /api/cart/notify-cleared
 * @desc    Send notification when cart is cleared
 * @access  Public
 * @body    { itemCount: number, totalValue: number }
 */
router.post('/notify-cleared', cartController.notifyCartCleared);

module.exports = router;