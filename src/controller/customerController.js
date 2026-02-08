// src/controller/customerController.js
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

// Order is optional (in case you don't have it yet)
let Order = null;
try {
  // If you have src/models/Order.js it will load fine
  Order = require('../models/Order');
} catch (_) {
  Order = null;
}

// ============================
// HELPERS
// ============================
function buildSearchFilter(search) {
  if (!search) return {};
  const s = String(search).trim();
  if (!s) return {};

  return {
    $or: [
      { name: { $regex: s, $options: 'i' } },
      { phone: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
    ],
  };
}

// ============================
// CUSTOMER LIST / SEARCH / STATS
// ============================

// GET /api/customers?search=...
exports.getCustomers = async (req, res) => {
  try {
    const { search } = req.query;

    const filter = {
      isActive: true,
      ...buildSearchFilter(search),
    };

    const customers = await Customer.find(filter)
      .populate('favoriteProducts', 'name category price image')
      .sort({ createdAt: -1 });

    res.json({ success: true, customers, count: customers.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/customers/search/phone/:phone
exports.searchByPhone = async (req, res) => {
  try {
    const phone = String(req.params.phone || '').trim();
    if (!phone) return res.status(400).json({ success: false, error: 'Phone is required' });

    const customers = await Customer.find({
      isActive: true,
      phone: { $regex: phone, $options: 'i' },
    })
      .populate('favoriteProducts', 'name category price image')
      .sort({ createdAt: -1 });

    res.json({ success: true, customers, count: customers.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/customers/stats/overview
exports.getCustomerStats = async (req, res) => {
  try {
    const totalActive = await Customer.countDocuments({ isActive: true });
    const totalVIP = await Customer.countDocuments({ isActive: true, isVIP: true });

    const tiers = await Customer.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$loyaltyTier', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const totals = await Customer.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$totalSpent' },
          totalOrders: { $sum: '$totalOrders' },
        },
      },
    ]);

    const totalSpent = totals?.[0]?.totalSpent ?? 0;
    const totalOrders = totals?.[0]?.totalOrders ?? 0;

    res.json({
      success: true,
      totalActive,
      totalVIP,
      tiers,
      totalSpent,
      totalOrders,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================
// CUSTOMER CRUD
// ============================

// GET /api/customers/:id
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('favoriteProducts', 'name category price image');

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    // Optional: purchase history (if Order model exists)
    let purchaseHistory = [];
    if (Order) {
      purchaseHistory = await Order.find({ customer: customer._id })
        .populate('items.product', 'name category price image')
        .sort({ createdAt: -1 })
        .limit(20);
    }

    res.json({ success: true, customer, purchaseHistory });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/customers
exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, gender, dateOfBirth, preferences, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }

    const exists = await Customer.findOne({ phone });
    if (exists) {
      return res.status(400).json({ success: false, error: 'Phone already exists' });
    }

    const customer = await Customer.create({
      name,
      phone,
      email,
      address,
      gender,
      dateOfBirth,
      preferences,
      notes,
      createdBy: req.user?._id || null,
      isActive: true,
    });

    res.status(201).json({ success: true, message: 'Customer created', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// PUT /api/customers/:id
exports.updateCustomer = async (req, res) => {
  try {
    const allowed = [
      'name', 'phone', 'email', 'address', 'gender', 'dateOfBirth', 'preferences', 'notes', 'lastVisit'
    ];

    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }

    // phone unique check if changed
    if (update.phone) {
      const other = await Customer.findOne({ phone: update.phone, _id: { $ne: req.params.id } });
      if (other) {
        return res.status(400).json({ success: false, error: 'Phone already exists' });
      }
    }

    const customer = await Customer.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('favoriteProducts', 'name category price image');

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    res.json({ success: true, message: 'Customer updated', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// DELETE /api/customers/:id  (soft delete)
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Customer.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Customer not found' });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Delete failed' });
  }
};


// ============================
// LOYALTY / VIP / STATS
// ============================

// PATCH /api/customers/:id/loyalty/add  { points }
exports.addLoyaltyPoints = async (req, res) => {
  try {
    const points = Number(req.body.points ?? 0);
    if (points <= 0) return res.status(400).json({ success: false, error: 'Points must be > 0' });

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    customer.loyaltyPoints += points;
    await customer.save();

    res.json({ success: true, message: 'Points added', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// PATCH /api/customers/:id/loyalty/redeem  { points }
exports.redeemLoyaltyPoints = async (req, res) => {
  try {
    const points = Number(req.body.points ?? 0);
    if (points <= 0) return res.status(400).json({ success: false, error: 'Points must be > 0' });

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    if (customer.loyaltyPoints < points) {
      return res.status(400).json({ success: false, error: 'Not enough points' });
    }

    customer.loyaltyPoints -= points;
    await customer.save();

    res.json({ success: true, message: 'Points redeemed', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// PATCH /api/customers/:id/stats  { spentAdd, ordersAdd }
exports.updateCustomerStats = async (req, res) => {
  try {
    const spentAdd = Number(req.body.spentAdd ?? 0);
    const ordersAdd = Number(req.body.ordersAdd ?? 0);

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    if (spentAdd > 0) customer.totalSpent += spentAdd;
    if (ordersAdd > 0) customer.totalOrders += ordersAdd;

    customer.lastOrderDate = new Date();

    // use methods in your Customer model
    customer.calculateAverageOrderValue();
    customer.updateLoyaltyTier();

    await customer.save();

    res.json({ success: true, message: 'Stats updated', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// PATCH /api/customers/:id/vip  { isVIP }
exports.toggleVIP = async (req, res) => {
  try {
    const isVIP = Boolean(req.body.isVIP);

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isVIP },
      { new: true }
    );

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    res.json({ success: true, message: 'VIP updated', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ============================
// FAVORITES (Customer ↔ Product)
// ============================

// GET /api/customers/:id/favorites
exports.getFavorites = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('favoriteProducts', 'name category price image');

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    res.json({ success: true, favorites: customer.favoriteProducts || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// PATCH /api/customers/:id/favorites/add  { productId }
exports.addFavorite = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, error: 'Invalid productId' });
    }

    const exists = await Product.findById(productId);
    if (!exists) return res.status(404).json({ success: false, error: 'Product not found' });

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { favoriteProducts: productId } },
      { new: true }
    ).populate('favoriteProducts', 'name category price image');

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    res.json({ success: true, message: 'Favorite added', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// PATCH /api/customers/:id/favorites/remove  { productId }
exports.removeFavorite = async (req, res) => {
  try {
    const { productId } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $pull: { favoriteProducts: productId } },
      { new: true }
    ).populate('favoriteProducts', 'name category price image');

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    res.json({ success: true, message: 'Favorite removed', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// PUT /api/customers/:id/favorites  { productIds: [] }
exports.setFavorites = async (req, res) => {
  try {
    const productIds = Array.isArray(req.body.productIds) ? req.body.productIds : [];

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { favoriteProducts: productIds },
      { new: true }
    ).populate('favoriteProducts', 'name category price image');

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    res.json({ success: true, message: 'Favorites updated', customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
