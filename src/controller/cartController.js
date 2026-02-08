// controllers/cartController.js - Enhanced with Validation
const cartService = require('../services/cartService');
const cartValidation = require('../services/cartValidationService');

/**
 * POST /api/cart/validate-product
 * Validate if a product can be added to cart
 * body: { productId, quantity, currentCartQuantity }
 */
exports.validateProduct = async (req, res) => {
  try {
    const { productId, quantity = 1, currentCartQuantity = 0 } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Product ID is required'
      });
    }

    const validation = await cartValidation.validateProductForCart(
      productId,
      quantity,
      currentCartQuantity
    );

    res.json({
      success: true,
      ...validation
    });

  } catch (error) {
    console.error('Product validation error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Validation failed',
      error: error.message
    });
  }
};

/**
 * POST /api/cart/validate-cart
 * Validate entire cart before checkout
 * body: { cartItems: [] }
 */
exports.validateCart = async (req, res) => {
  try {
    const { cartItems } = req.body;

    if (!Array.isArray(cartItems)) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Cart items must be an array'
      });
    }

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Cart is empty'
      });
    }

    const validation = await cartValidation.validateCartItems(cartItems);

    res.json({
      success: true,
      ...validation
    });

  } catch (error) {
    console.error('Cart validation error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Cart validation failed',
      error: error.message
    });
  }
};

/**
 * GET /api/cart/check-stock/:productId
 * Check current stock for a product
 */
exports.checkProductStock = async (req, res) => {
  try {
    const { productId } = req.params;

    const stockInfo = await cartValidation.checkProductStock(productId);

    res.json({
      success: true,
      productId,
      ...stockInfo
    });

  } catch (error) {
    console.error('Stock check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check stock',
      error: error.message
    });
  }
};

/**
 * POST /api/cart/check-stock-bulk
 * Check stock for multiple products
 * body: { productIds: [] }
 */
exports.bulkCheckStock = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs must be an array'
      });
    }

    const result = await cartValidation.bulkCheckStock(productIds);

    res.json(result);

  } catch (error) {
    console.error('Bulk stock check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check stock',
      error: error.message
    });
  }
};

/**
 * POST /api/cart/notify-add
 * Notify when item is added to cart (with validation)
 * body: { item: { product, quantity }, cartTotal }
 */
exports.notifyItemAdded = async (req, res) => {
  try {
    const { item, cartTotal } = req.body;

    if (!item || !item.product) {
      return res.status(400).json({
        success: false,
        error: 'Item with product information is required'
      });
    }

    // ✅ Validate product before sending notification
    const productId = item.product._id || item.product.id;
    const validation = await cartValidation.validateProductForCart(
      productId,
      item.quantity || 1,
      0
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: validation.message,
        code: validation.code
      });
    }

    // Send Telegram notification (non-blocking)
    cartService.notifyItemAdded(item, cartTotal || 1).catch(err => {
      console.error('⚠️ Failed to send cart notification to Telegram:', err.message);
    });

    res.json({
      success: true,
      valid: true,
      message: 'Item added to cart successfully',
      item
    });

  } catch (error) {
    console.error('Cart notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add item to cart'
    });
  }
};

/**
 * POST /api/cart/notify-summary
 * Send complete cart summary to Telegram (with validation)
 * body: { cartItems: [], customerInfo?: { name, phone } }
 */
exports.sendCartSummary = async (req, res) => {
  try {
    const { cartItems, customerInfo } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart items array is required'
      });
    }

    // ✅ Validate cart before sending summary
    const validation = await cartValidation.validateCartItems(cartItems);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Cart has validation errors',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Send cart summary to Telegram
    const result = await cartService.sendCartSummary(cartItems, customerInfo);

    if (result.success) {
      res.json({
        success: true,
        valid: true,
        message: 'Cart summary sent to Telegram successfully',
        warnings: validation.warnings,
        cartItems
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send cart summary to Telegram'
      });
    }

  } catch (error) {
    console.error('Cart summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send cart summary'
    });
  }
};

/**
 * POST /api/cart/notify-checkout
 * Notify when checkout is initiated (with validation)
 * body: { cartItems: [], customerInfo: { name, phone }, orderNumber?: string }
 */
exports.notifyCheckout = async (req, res) => {
  try {
    const { cartItems, customerInfo, orderNumber } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart items are required'
      });
    }

    // ✅ Validate cart before checkout
    const validation = await cartValidation.validateCartItems(cartItems);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Cannot proceed to checkout - cart has validation errors',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Send checkout notification to Telegram
    const result = await cartService.notifyCartCheckout(
      cartItems,
      customerInfo,
      orderNumber
    );

    if (result.success) {
      res.json({
        success: true,
        valid: true,
        message: 'Checkout notification sent to Telegram',
        warnings: validation.warnings,
        orderNumber
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send checkout notification'
      });
    }

  } catch (error) {
    console.error('Checkout notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send checkout notification'
    });
  }
};

/**
 * POST /api/cart/notify-cleared
 * Notify when cart is cleared
 * body: { itemCount: number, totalValue: number }
 */
exports.notifyCartCleared = async (req, res) => {
  try {
    const { itemCount, totalValue } = req.body;

    if (!itemCount || !totalValue) {
      return res.status(400).json({
        success: false,
        error: 'Item count and total value are required'
      });
    }

    // Send cart cleared notification (non-blocking)
    cartService.notifyCartCleared(itemCount, totalValue).catch(err => {
      console.error('⚠️ Failed to send cart cleared notification:', err.message);
    });

    res.json({
      success: true,
      message: 'Cart cleared notification sent'
    });

  } catch (error) {
    console.error('Cart cleared notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send notification'
    });
  }
};

module.exports = exports;