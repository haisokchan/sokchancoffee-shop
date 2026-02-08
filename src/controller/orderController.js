// controllers/orderController.js
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const telegramService = require('../services/telegramService');

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

/**
 * Helper function to save order with retry on duplicate key error
 */
async function saveOrderWithRetry(order, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await order.save();
      return order;
    } catch (error) {
      if (error.code === 11000 && error.message.includes('orderNumber')) {
        console.log(`Duplicate orderNumber detected, retrying... (${i + 1}/${maxRetries})`);
        
        const timestamp = Date.now();
        const random1 = Math.random().toString(36).substring(2, 9).toUpperCase();
        const random2 = Math.random().toString(36).substring(2, 5).toUpperCase();
        order.orderNumber = `ORD-${timestamp}-${random1}${random2}`;
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        if (i < maxRetries - 1) {
          continue;
        }
      }
      throw error;
    }
  }
}

/**
 * GET /api/orders
 * Query: page, limit, status, customer, search
 */
exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, customer } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (customer && isObjectId(customer)) filter.customer = customer;

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name phone email')
        .populate('items.product', 'name price image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      orders,
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/**
 * GET /api/orders/:id
 */
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const order = await Order.findById(id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name price image');

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    res.json({ success: true, order });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/**
 * GET /api/orders/:id/receipt
 * Get order receipt and optionally send to Telegram
 */
exports.getOrderReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { sendToTelegram } = req.query;

    if (!isObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const order = await Order.findById(id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name price image');

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // Generate receipt text
    const receipt = telegramService.formatReceipt(order);

    // Optionally send to Telegram
    if (sendToTelegram === 'true') {
      telegramService.sendReceipt(order).catch(err => {
        console.error('⚠️ Failed to send receipt to Telegram:', err.message);
      });
    }

    res.json({ 
      success: true, 
      order,
      receipt: receipt.replace(/<[^>]*>/g, ''), // Strip HTML tags for JSON response
      receiptSent: sendToTelegram === 'true'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/**
 * POST /api/orders/:id/send-receipt
 * Send order receipt to Telegram
 */
exports.sendOrderReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeImages } = req.body;

    if (!isObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const order = await Order.findById(id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name price image');

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // Send receipt with or without images
    let result;
    if (includeImages) {
      result = await telegramService.sendOrderWithImages(order);
    } else {
      result = await telegramService.sendReceipt(order);
    }

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Receipt sent to Telegram successfully',
        order
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send receipt to Telegram'
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

/**
 * POST /api/orders
 * body: { customer, items: [{ product, qty, price? }], status? }
 * ✅ WITH STOCK VALIDATION & AUTO-DEDUCTION + TELEGRAM RECEIPT
 */
exports.createOrder = async (req, res) => {
  try {
    const { customer, items, status, notes, sendReceipt = true } = req.body;

    if (!customer || !isObjectId(customer)) {
      return res.status(400).json({ success: false, error: 'customer is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items is required' });
    }

    const builtItems = [];
    const stockErrors = [];
    const productsToUpdate = [];
    const lowStockProducts = [];

    // ✅ Step 1: Validate all products and check stock
    for (const it of items) {
      if (!it.product || !isObjectId(it.product)) {
        return res.status(400).json({ success: false, error: 'Invalid product id in items' });
      }
      
      const qty = Number(it.qty);
      if (!qty || qty < 1) {
        return res.status(400).json({ success: false, error: 'qty must be >= 1' });
      }

      const p = await Product.findById(it.product).select('price name stock isAvailable isDeleted');
      
      if (!p) {
        return res.status(404).json({ 
          success: false, 
          error: `Product not found: ${it.product}` 
        });
      }

      if (p.isDeleted) {
        return res.status(400).json({ 
          success: false, 
          error: `Product "${p.name}" is no longer available` 
        });
      }

      if (p.isAvailable === false) {
        return res.status(400).json({ 
          success: false, 
          error: `Product "${p.name}" is currently unavailable` 
        });
      }

      // ✅ STOCK VALIDATION
      const currentStock = Number(p.stock) || 0;
      if (qty > currentStock) {
        stockErrors.push({
          product: p.name,
          requested: qty,
          available: currentStock
        });
      }

      let price = it.price;
      if (price === undefined || price === null) {
        price = p.price;
      }
      price = Number(price);
      if (Number.isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, error: 'price must be >= 0' });
      }

      builtItems.push({ product: it.product, qty, price });
      productsToUpdate.push({ 
        productId: it.product, 
        qty, 
        name: p.name,
        currentStock,
        newStock: currentStock - qty
      });
    }

    // ✅ If any stock errors, abort
    if (stockErrors.length > 0) {
      const errorMsg = stockErrors.map(e => 
        `"${e.product}": requested ${e.requested}, only ${e.available} available`
      ).join('; ');
      
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient stock: ${errorMsg}`,
        stockErrors
      });
    }

    // ✅ Step 2: Create the order first
    const order = new Order({
      customer,
      items: builtItems,
      status: status || 'pending',
      notes: notes || '',
      createdBy: req.user?.id || null,
    });

    order.recalcTotals();
    await saveOrderWithRetry(order);

    // ✅ Step 3: Deduct stock for each product AFTER order is saved
    try {
      for (const item of productsToUpdate) {
        const updated = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.qty } },
          { new: true }
        );

        if (updated) {
          console.log(`✅ Stock deducted for "${item.name}": -${item.qty} (New stock: ${updated.stock})`);
          
          // Check if stock is low (less than 10) or out of stock
          if (updated.stock <= 10) {
            lowStockProducts.push(updated);
          }
        }
      }
    } catch (stockError) {
      console.error('⚠️ Stock deduction failed:', stockError);
    }

    const populated = await Order.findById(order._id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name price image stock');

    console.log('✅ Order created successfully');

    // ✅ Step 4: Send Telegram receipt (non-blocking)
    if (sendReceipt) {
      telegramService.sendReceipt(populated).catch(err => {
        console.error('⚠️ Failed to send receipt to Telegram:', err.message);
      });
    }

    // ✅ Step 5: Send low stock alerts if needed
    for (const product of lowStockProducts) {
      telegramService.sendLowStockAlert(product).catch(err => {
        console.error('⚠️ Failed to send low stock alert:', err.message);
      });
    }

    res.status(201).json({ success: true, order: populated });
  } catch (e) {
    console.error('❌ Create order error:', e);
    res.status(400).json({ success: false, error: e.message });
  }
};

/**
 * PUT /api/orders/:id
 * body: { customer?, items?, status? }
 * ✅ WITH STOCK VALIDATION & ADJUSTMENT + TELEGRAM NOTIFICATION
 */
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const { customer, items, status, notes } = req.body;

    if (customer) {
      if (!isObjectId(customer)) return res.status(400).json({ success: false, error: 'Invalid customer' });
      order.customer = customer;
    }

    if (status) order.status = status;
    if (notes !== undefined) order.notes = notes;

    if (items) {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'items must be a non-empty array' });
      }

      // ✅ Step 1: Restore stock from old items
      try {
        for (const oldItem of order.items) {
          await Product.findByIdAndUpdate(
            oldItem.product,
            { $inc: { stock: oldItem.qty } }
          );
          console.log(`✅ Stock restored: +${oldItem.qty} for product ${oldItem.product}`);
        }
      } catch (restoreError) {
        console.error('⚠️ Stock restoration failed:', restoreError);
      }

      const builtItems = [];
      const stockErrors = [];
      const productsToUpdate = [];

      // ✅ Step 2: Validate new items
      for (const it of items) {
        if (!it.product || !isObjectId(it.product)) {
          return res.status(400).json({ success: false, error: 'Invalid product id in items' });
        }
        
        const qty = Number(it.qty);
        if (!qty || qty < 1) {
          return res.status(400).json({ success: false, error: 'qty must be >= 1' });
        }

        const p = await Product.findById(it.product).select('price name stock isAvailable isDeleted');
        
        if (!p) {
          return res.status(404).json({ 
            success: false, 
            error: `Product not found: ${it.product}` 
          });
        }

        if (p.isDeleted) {
          return res.status(400).json({ 
            success: false, 
            error: `Product "${p.name}" is no longer available` 
          });
        }

        if (p.isAvailable === false) {
          return res.status(400).json({ 
            success: false, 
            error: `Product "${p.name}" is currently unavailable` 
          });
        }

        const currentStock = Number(p.stock) || 0;
        if (qty > currentStock) {
          stockErrors.push({
            product: p.name,
            requested: qty,
            available: currentStock
          });
        }

        let price = it.price;
        if (price === undefined || price === null) {
          price = p.price;
        }
        price = Number(price);
        if (Number.isNaN(price) || price < 0) {
          return res.status(400).json({ success: false, error: 'price must be >= 0' });
        }

        builtItems.push({ product: it.product, qty, price });
        productsToUpdate.push({ productId: it.product, qty, name: p.name });
      }

      if (stockErrors.length > 0) {
        const errorMsg = stockErrors.map(e => 
          `"${e.product}": requested ${e.requested}, only ${e.available} available`
        ).join('; ');
        
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient stock: ${errorMsg}`,
          stockErrors
        });
      }

      // ✅ Step 3: Deduct stock for new items
      try {
        for (const item of productsToUpdate) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: -item.qty } }
          );
          console.log(`✅ Stock deducted: -${item.qty} for "${item.name}"`);
        }
      } catch (deductError) {
        console.error('⚠️ Stock deduction failed:', deductError);
      }

      order.items = builtItems;
      order.recalcTotals();
    }

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name price image stock');

    // ✅ Send Telegram notification (non-blocking)
    telegramService.notifyOrderUpdated(populated).catch(err => {
      console.error('⚠️ Failed to send Telegram notification:', err.message);
    });

    res.json({ success: true, order: populated });
  } catch (e) {
    console.error('❌ Update order error:', e);
    res.status(400).json({ success: false, error: e.message });
  }
};

/**
 * PATCH /api/orders/:id/status
 * body: { status }
 * ✅ WITH TELEGRAM NOTIFICATION AND PAYMENT RECEIPT
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentMethod, paidAmount, changeAmount } = req.body;

    if (!isObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
    if (!['pending', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const oldOrder = await Order.findById(id);
    if (!oldOrder) return res.status(404).json({ success: false, error: 'Order not found' });
    
    const oldStatus = oldOrder.status;

    // Update order with payment details if status is 'paid'
    const updateData = { status };
    if (status === 'paid') {
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      if (paidAmount) updateData.paidAmount = Number(paidAmount);
      if (changeAmount !== undefined) updateData.changeAmount = Number(changeAmount);
      updateData.paymentStatus = 'paid';
      updateData.completedAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(id, updateData, { new: true })
      .populate('customer', 'name phone email')
      .populate('items.product', 'name price image');

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // ✅ Send appropriate Telegram notification (non-blocking)
    if (oldStatus !== status) {
      if (status === 'paid') {
        // Send payment receipt for paid orders
        telegramService.sendPaymentReceipt(order).catch(err => {
          console.error('⚠️ Failed to send payment receipt to Telegram:', err.message);
        });
      } else {
        // Send status change notification for other status changes
        telegramService.notifyOrderStatusChanged(order, oldStatus, status).catch(err => {
          console.error('⚠️ Failed to send Telegram notification:', err.message);
        });
      }
    }

    res.json({ success: true, order });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

/**
 * DELETE /api/orders/:id
 * ✅ WITH STOCK RESTORATION + TELEGRAM NOTIFICATION
 */
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const order = await Order.findById(id)
      .populate('customer', 'name phone email')
      .populate('items.product', 'name price image');
      
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // ✅ Restore stock before deleting order
    try {
      for (const item of order.items) {
        const updated = await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.qty } },
          { new: true }
        );
        
        if (updated) {
          console.log(`✅ Stock restored on delete: +${item.qty} for product ${item.product} (New stock: ${updated.stock})`);
        }
      }
    } catch (restoreError) {
      console.error('⚠️ Stock restoration failed:', restoreError);
    }

    // ✅ Send deletion notification before deleting (non-blocking)
    telegramService.notifyOrderDeleted(order).catch(err => {
      console.error('⚠️ Failed to send Telegram notification:', err.message);
    });

    await Order.findByIdAndDelete(id);

    console.log('✅ Order deleted');

    res.json({ success: true, message: 'Order deleted and stock restored' });
  } catch (e) {
    console.error('❌ Delete order error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
};