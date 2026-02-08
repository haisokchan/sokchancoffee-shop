// controllers/paymentController.js - WITH TELEGRAM INTEGRATION
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const telegramService = require('../services/telegramService');

// @desc    Process payment
// @route   POST /api/payments
// @access  Private
exports.processPayment = async (req, res) => {
  try {
    const {
      orderId,
      amount,
      paymentMethod,
      cardDetails,
      mobileWallet,
      cashDetails,
      splitPayments,
      sendReceipt = false // ✅ NEW: Flag to send Telegram receipt
    } = req.body;

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid payment amount is required'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Payment method is required'
      });
    }

    // Get order with populated data
    const order = await Order.findById(orderId).populate('customer');
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order is already paid'
      });
    }

    // Validate amount
    const orderTotal = order.total || order.subtotal || 0;
    if (amount < orderTotal) {
      return res.status(400).json({
        success: false,
        error: `Payment amount ($${amount}) is less than order total ($${orderTotal})`
      });
    }

    // Create payment record
    const paymentData = {
      order: orderId,
      customer: order.customer?._id || order.customer,
      amount: orderTotal,
      paymentMethod,
      processedBy: req.user.id
    };

    // Add method-specific details
    if (paymentMethod === 'cash') {
      paymentData.cashDetails = {
        receivedAmount: amount,
        changeAmount: amount - orderTotal
      };
    } else if (paymentMethod === 'credit-card' || paymentMethod === 'debit-card') {
      if (cardDetails) {
        paymentData.cardDetails = {
          cardType: cardDetails.cardType,
          last4: cardDetails.last4,
          holderName: cardDetails.holderName
        };
      }
      paymentData.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } else if (paymentMethod === 'mobile-wallet') {
      if (mobileWallet) {
        paymentData.mobileWallet = {
          provider: mobileWallet.provider,
          phone: mobileWallet.phone,
          txnId: mobileWallet.txnId
        };
      }
      paymentData.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } else if (paymentMethod === 'split') {
      paymentData.splitPayments = splitPayments;
    }

    // Create and save payment
    const payment = new Payment(paymentData);
    payment.status = 'completed';
    payment.completedAt = Date.now();
    await payment.save();

    // Update order
    order.payment = payment._id;
    order.paymentStatus = 'paid';
    order.paymentMethod = paymentMethod;
    order.paidAmount = amount;
    order.changeAmount = amount - orderTotal;
    order.updatedAt = Date.now();

    // Complete order if not already
    if (order.status !== 'completed' && order.status !== 'paid') {
      order.status = 'paid';
      order.completedAt = Date.now();
    }

    await order.save();

    // Populate payment details for response
    await payment.populate([
      { path: 'order', select: 'orderNumber total subtotal items' },
      { path: 'customer', select: 'name username phone email' },
      { path: 'processedBy', select: 'username fullName' }
    ]);

    // ✅ NEW: Send Telegram receipt if requested (non-blocking)
    if (sendReceipt) {
      // Reload order with all populated data for the receipt
      const populatedOrder = await Order.findById(orderId)
        .populate('customer', 'name phone email')
        .populate('items.product', 'name price image');
      
      telegramService.sendPaymentReceipt(populatedOrder).catch(err => {
        console.error('⚠️ Failed to send payment receipt to Telegram:', err.message);
      });
      
      console.log('✅ Payment receipt sent to Telegram');
    }

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      payment,
      receipt: {
        paymentNumber: payment.paymentNumber,
        orderNumber: order.orderNumber,
        amount: payment.amount,
        method: payment.paymentMethod,
        change: payment.cashDetails?.changeAmount || 0,
        date: payment.completedAt
      },
      telegramSent: sendReceipt // ✅ Indicate if Telegram receipt was sent
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to process payment'
    });
  }
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
exports.getPayments = async (req, res) => {
  try {
    const {
      status,
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};
    
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (page - 1) * limit;
    const payments = await Payment.find(filter)
      .populate('order', 'orderNumber total subtotal')
      .populate('customer', 'name username phone')
      .populate('processedBy', 'username fullName')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Payment.countDocuments(filter);

    res.json({
      success: true,
      message: 'Payments retrieved successfully',
      count: payments.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      payments
    });
  } catch (error) {
    console.error('Error getting payments:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve payments'
    });
  }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('order')
      .populate('customer', 'name username phone email')
      .populate('processedBy', 'username fullName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment retrieved successfully',
      payment
    });
  } catch (error) {
    console.error('Error getting payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve payment'
    });
  }
};

// @desc    Process refund
// @route   POST /api/payments/:id/refund
// @access  Private (Admin/Manager)
exports.processRefund = async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Refund reason is required'
      });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.status === 'refunded') {
      return res.status(400).json({
        success: false,
        error: 'Payment already refunded'
      });
    }

    // Update payment
    payment.status = 'refunded';
    payment.refund = {
      amount: amount || payment.amount,
      reason,
      refundedAt: Date.now(),
      refundedBy: req.user.id
    };
    await payment.save();

    // Update order
    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = 'refunded';
      order.status = 'cancelled';
      order.updatedAt = Date.now();
      await order.save();
    }

    // Populate payment for response
    await payment.populate([
      { path: 'order', select: 'orderNumber total' },
      { path: 'customer', select: 'name username' },
      { path: 'processedBy', select: 'username' },
      { path: 'refund.refundedBy', select: 'username' }
    ]);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      payment
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to process refund'
    });
  }
};

// @desc    Get payment statistics
// @route   GET /api/payments/stats/overview
// @access  Private (Admin/Manager)
exports.getPaymentStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Payment.aggregate([
      {
        $facet: {
          today: [
            { $match: { createdAt: { $gte: today }, status: 'completed' } },
            {
              $group: {
                _id: null,
                totalPayments: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
              }
            }
          ],
          byMethod: [
            { $match: { createdAt: { $gte: today }, status: 'completed' } },
            {
              $group: {
                _id: '$paymentMethod',
                count: { $sum: 1 },
                amount: { $sum: '$amount' }
              }
            }
          ],
          byStatus: [
            { $match: { createdAt: { $gte: today } } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          allTime: [
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: null,
                totalPayments: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
              }
            }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      message: 'Payment statistics retrieved successfully',
      stats: stats[0]
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve statistics'
    });
  }
};