// controllers/cartController.js — Cart persistence + reporting + print
const cartService       = require('../services/cartService');
const cartValidation    = require('../services/cartValidationService');
const CartSnapshot      = require('../models/CartSnapshot');
const telegramService   = require('../services/telegramService');
const receiptRenderer   = require('../services/receiptRenderer');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function buildSnapshotFromItems(cartItems, customerInfo = {}) {
  const subtotal = cartItems.reduce((sum, item) => {
    const price = Number(item.product?.price || item.price || 0);
    const qty   = Number(item.quantity || item.qty || 0);
    return sum + price * qty;
  }, 0);

  const taxRate = 0.10;
  const tax     = subtotal * taxRate;
  const total   = subtotal + tax;

  const items = cartItems.map(item => ({
    productId:   item.product?._id || item.productId || null,
    productName: item.product?.name || item.name || 'Unknown',
    category:    item.product?.category || item.category || '',
    price:       Number(item.product?.price || item.price || 0),
    quantity:    Number(item.quantity || item.qty || 0),
    itemTotal:   Number(item.product?.price || item.price || 0) * Number(item.quantity || item.qty || 0)
  }));

  return {
    customer:     { name: customerInfo?.name || 'Guest', phone: customerInfo?.phone || '' },
    items,
    subtotal:     parseFloat(subtotal.toFixed(2)),
    taxRate,
    tax:          parseFloat(tax.toFixed(2)),
    total:        parseFloat(total.toFixed(2)),
    itemCount:    items.reduce((s, i) => s + i.quantity, 0),
    productCount: items.length
  };
}

// ─────────────────────────────────────────────────────────────
// ✅ SAVE CART TO DATABASE
// POST /api/cart/save
// body: { cartItems, customerInfo?, notes?, status? }
// ─────────────────────────────────────────────────────────────
exports.saveCart = async (req, res) => {
  try {
    const { cartItems, customerInfo, notes = '', status = 'saved' } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart items are required' });
    }

    const snapshotData = buildSnapshotFromItems(cartItems, customerInfo);
    const snapshot = await CartSnapshot.create({ ...snapshotData, notes, status });

    // Non-blocking Telegram notification
    cartService.sendCartSummary(cartItems, customerInfo).catch(err =>
      console.warn('⚠️ Telegram notification failed after cart save:', err.message)
    );

    res.status(201).json({
      success: true,
      message: `Cart saved as ${snapshot.cartNumber}`,
      cartNumber: snapshot.cartNumber,
      cartId: snapshot._id,
      snapshot
    });

  } catch (error) {
    console.error('Save cart error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save cart' });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ LIST SAVED CARTS (for report page)
// GET /api/cart/snapshots
// query: ?status=saved&from=2025-01-01&to=2025-12-31&page=1&limit=20&search=guest
// ─────────────────────────────────────────────────────────────
exports.getCartSnapshots = async (req, res) => {
  try {
    const {
      status,
      from,
      to,
      page  = 1,
      limit = 20,
      search
    } = req.query;

    const filter = {};

    if (status) filter.status = status;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    if (search) {
      filter.$or = [
        { cartNumber:       { $regex: search, $options: 'i' } },
        { 'customer.name':  { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await CartSnapshot.countDocuments(filter);
    const carts = await CartSnapshot.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // ── Summary aggregation for report header ──
    const [agg] = await CartSnapshot.aggregate([
      { $match: filter },
      { $group: {
          _id:        null,
          totalCarts: { $sum: 1 },
          totalItems: { $sum: '$itemCount' },
          totalValue: { $sum: '$total' },
          avgTotal:   { $avg: '$total' }
      }}
    ]);

    res.json({
      success: true,
      carts,
      meta: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      },
      summary: agg
        ? {
            totalCarts: agg.totalCarts,
            totalItems: agg.totalItems,
            totalValue: parseFloat((agg.totalValue || 0).toFixed(2)),
            avgTotal:   parseFloat((agg.avgTotal   || 0).toFixed(2))
          }
        : { totalCarts: 0, totalItems: 0, totalValue: 0, avgTotal: 0 }
    });

  } catch (error) {
    console.error('Get cart snapshots error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ GET SINGLE CART SNAPSHOT
// GET /api/cart/snapshots/:id
// ─────────────────────────────────────────────────────────────
exports.getCartSnapshot = async (req, res) => {
  try {
    const cart = await CartSnapshot.findById(req.params.id);
    if (!cart) return res.status(404).json({ success: false, error: 'Cart snapshot not found' });

    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ UPDATE CART STATUS
// PATCH /api/cart/snapshots/:id/status
// body: { status }
// ─────────────────────────────────────────────────────────────
exports.updateCartStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'saved', 'checked_out', 'cleared', 'expired'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Use: ${validStatuses.join(', ')}` });
    }

    const cart = await CartSnapshot.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!cart) return res.status(404).json({ success: false, error: 'Cart not found' });

    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ DELETE CART SNAPSHOT
// DELETE /api/cart/snapshots/:id
// ─────────────────────────────────────────────────────────────
exports.deleteCartSnapshot = async (req, res) => {
  try {
    const cart = await CartSnapshot.findByIdAndDelete(req.params.id);
    if (!cart) return res.status(404).json({ success: false, error: 'Cart not found' });

    res.json({ success: true, message: `Cart ${cart.cartNumber} deleted` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ PRINT-READY DATA FOR A SINGLE CART
// GET /api/cart/snapshots/:id/print
// Returns a structured receipt object the frontend can render + print
// ─────────────────────────────────────────────────────────────
exports.printCart = async (req, res) => {
  try {
    const cart = await CartSnapshot.findById(req.params.id);
    if (!cart) return res.status(404).json({ success: false, error: 'Cart not found' });

    const receipt = {
      cartNumber:   cart.cartNumber,
      createdAt:    cart.createdAt,
      status:       cart.status,
      customer:     cart.customer,
      items:        cart.items.map(i => ({
        name:      i.productName,
        category:  i.category,
        price:     i.price,
        quantity:  i.quantity,
        itemTotal: i.itemTotal
      })),
      subtotal:     cart.subtotal,
      tax:          cart.tax,
      taxRate:      cart.taxRate,
      total:        cart.total,
      itemCount:    cart.itemCount,
      productCount: cart.productCount,
      notes:        cart.notes
    };

    res.json({ success: true, receipt });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ SEND SAVED CART TO TELEGRAM
// POST /api/cart/snapshots/:id/telegram
// ─────────────────────────────────────────────────────────────
exports.sendSnapshotToTelegram = async (req, res) => {
  try {
    const cart = await CartSnapshot.findById(req.params.id);
    if (!cart) return res.status(404).json({ success: false, error: 'Cart not found' });

    // Re-use cartService formatter — convert snapshot items → cartItem shape
    const cartItems = cart.items.map(i => ({
      product: { name: i.productName, price: i.price, category: i.category },
      quantity: i.quantity
    }));

    const result = await cartService.sendCartSummary(cartItems, cart.customer);

    if (result.success) {
      await CartSnapshot.findByIdAndUpdate(cart._id, {
        telegramSent: true,
        telegramSentAt: new Date()
      });
    }

    res.json({ success: result.success, message: result.success ? 'Sent to Telegram' : 'Telegram send failed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ RENDER RECEIPT → JPG → SEND TO TELEGRAM AS PHOTO
// POST /api/cart/snapshots/:id/send-image
// ─────────────────────────────────────────────────────────────
exports.sendReceiptImage = async (req, res) => {
  try {
    const cart = await CartSnapshot.findById(req.params.id);
    if (!cart) return res.status(404).json({ success: false, error: 'Cart not found' });

    const result = await receiptRenderer.sendReceiptImageToTelegram(cart);

    if (result.success) {
      // Mark telegram sent
      await CartSnapshot.findByIdAndUpdate(cart._id, {
        telegramSent: true,
        telegramSentAt: new Date()
      });
      res.json({ success: true, message: `Receipt image for ${cart.cartNumber} sent to Telegram 📸` });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to send receipt image' });
    }

  } catch (error) {
    console.error('sendReceiptImage error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ DOWNLOAD RECEIPT AS JPG
// GET /api/cart/snapshots/:id/download-jpg
// Returns the JPG file directly for download
// ─────────────────────────────────────────────────────────────
exports.downloadReceiptJpg = async (req, res) => {
  try {
    const cart = await CartSnapshot.findById(req.params.id);
    if (!cart) return res.status(404).json({ success: false, error: 'Cart not found' });

    const buffer = await receiptRenderer.getReceiptJpgBuffer(cart);

    res.set({
      'Content-Type':        'image/jpeg',
      'Content-Disposition': `attachment; filename="receipt-${cart.cartNumber}.jpg"`,
      'Content-Length':      buffer.length
    });
    res.send(buffer);

  } catch (error) {
    console.error('downloadReceiptJpg error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// EXISTING ENDPOINTS (unchanged — kept for compatibility)
// ─────────────────────────────────────────────────────────────

exports.validateProduct = async (req, res) => {
  try {
    const { productId, quantity = 1, currentCartQuantity = 0 } = req.body;
    if (!productId) return res.status(400).json({ success: false, valid: false, message: 'Product ID is required' });
    const validation = await cartValidation.validateProductForCart(productId, quantity, currentCartQuantity);
    res.json({ success: true, ...validation });
  } catch (error) {
    res.status(500).json({ success: false, valid: false, message: 'Validation failed', error: error.message });
  }
};

exports.validateCart = async (req, res) => {
  try {
    const { cartItems } = req.body;
    if (!Array.isArray(cartItems)) return res.status(400).json({ success: false, valid: false, message: 'Cart items must be an array' });
    if (cartItems.length === 0) return res.status(400).json({ success: false, valid: false, message: 'Cart is empty' });
    const validation = await cartValidation.validateCartItems(cartItems);
    res.json({ success: true, ...validation });
  } catch (error) {
    res.status(500).json({ success: false, valid: false, message: 'Cart validation failed', error: error.message });
  }
};

exports.checkProductStock = async (req, res) => {
  try {
    const stockInfo = await cartValidation.checkProductStock(req.params.productId);
    res.json({ success: true, productId: req.params.productId, ...stockInfo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check stock', error: error.message });
  }
};

exports.bulkCheckStock = async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds)) return res.status(400).json({ success: false, message: 'Product IDs must be an array' });
    const result = await cartValidation.bulkCheckStock(productIds);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check stock', error: error.message });
  }
};

exports.notifyItemAdded = async (req, res) => {
  try {
    const { item, cartTotal } = req.body;
    if (!item || !item.product) return res.status(400).json({ success: false, error: 'Item with product information is required' });
    const productId  = item.product._id || item.product.id;
    const validation = await cartValidation.validateProductForCart(productId, item.quantity || 1, 0);
    if (!validation.valid) return res.status(400).json({ success: false, valid: false, error: validation.message, code: validation.code });
    cartService.notifyItemAdded(item, cartTotal || 1).catch(err => console.error('⚠️ Telegram notify failed:', err.message));
    res.json({ success: true, valid: true, message: 'Item added to cart successfully', item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to add item to cart' });
  }
};

exports.sendCartSummary = async (req, res) => {
  try {
    const { cartItems, customerInfo } = req.body;
    if (!Array.isArray(cartItems) || cartItems.length === 0) return res.status(400).json({ success: false, error: 'Cart items array is required' });
    const validation = await cartValidation.validateCartItems(cartItems);
    if (!validation.valid) return res.status(400).json({ success: false, valid: false, message: 'Cart has validation errors', errors: validation.errors, warnings: validation.warnings });
    const result = await cartService.sendCartSummary(cartItems, customerInfo);
    if (result.success) {
      res.json({ success: true, valid: true, message: 'Cart summary sent to Telegram successfully', warnings: validation.warnings, cartItems });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send cart summary to Telegram' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to send cart summary' });
  }
};

exports.notifyCheckout = async (req, res) => {
  try {
    const { cartItems, customerInfo, orderNumber } = req.body;
    if (!Array.isArray(cartItems) || cartItems.length === 0) return res.status(400).json({ success: false, error: 'Cart items are required' });
    const validation = await cartValidation.validateCartItems(cartItems);
    if (!validation.valid) return res.status(400).json({ success: false, valid: false, message: 'Cannot proceed to checkout', errors: validation.errors, warnings: validation.warnings });
    const result = await cartService.notifyCartCheckout(cartItems, customerInfo, orderNumber);
    if (result.success) {
      res.json({ success: true, valid: true, message: 'Checkout notification sent to Telegram', warnings: validation.warnings, orderNumber });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send checkout notification' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to send checkout notification' });
  }
};

exports.notifyCartCleared = async (req, res) => {
  try {
    const { itemCount, totalValue } = req.body;
    if (!itemCount || !totalValue) return res.status(400).json({ success: false, error: 'Item count and total value are required' });
    cartService.notifyCartCleared(itemCount, totalValue).catch(err => console.error('⚠️ Telegram notify failed:', err.message));
    res.json({ success: true, message: 'Cart cleared notification sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to send notification' });
  }
};

module.exports = exports;