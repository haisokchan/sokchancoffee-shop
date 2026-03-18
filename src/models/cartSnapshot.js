// models/CartSnapshot.js
// Persists a cart state to MongoDB so it can be retrieved, reported on, and printed.
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  category:    { type: String },
  price:       { type: Number, required: true },
  quantity:    { type: Number, required: true },
  itemTotal:   { type: Number, required: true }   // price × quantity, stored for reporting
}, { _id: false });

const cartSnapshotSchema = new mongoose.Schema({
  // ── Identity ────────────────────────────────────────────────
  cartNumber: {
    type: String,
    unique: true,
    // e.g. CART-20250317-0001
    default: () => `CART-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`
  },

  // ── Customer (optional — guest carts have no customer) ──────
  customer: {
    name:  { type: String, default: 'Guest' },
    phone: { type: String, default: '' }
  },

  // ── Status lifecycle ────────────────────────────────────────
  status: {
    type: String,
    enum: ['active', 'saved', 'checked_out', 'cleared', 'expired'],
    default: 'saved'
  },

  // ── Items ───────────────────────────────────────────────────
  items: [cartItemSchema],

  // ── Financials ──────────────────────────────────────────────
  subtotal:  { type: Number, required: true },
  taxRate:   { type: Number, default: 0.10 },
  tax:       { type: Number, required: true },
  total:     { type: Number, required: true },

  // ── Metadata ────────────────────────────────────────────────
  itemCount:    { type: Number },  // total units
  productCount: { type: Number },  // distinct product types
  notes:        { type: String, default: '' },

  // ── Telegram ────────────────────────────────────────────────
  telegramSent: { type: Boolean, default: false },
  telegramSentAt: { type: Date }

}, {
  timestamps: true  // adds createdAt + updatedAt automatically
});

// ── Indexes for reporting queries ────────────────────────────
cartSnapshotSchema.index({ createdAt: -1 });
cartSnapshotSchema.index({ status: 1 });
cartSnapshotSchema.index({ 'customer.name': 1 });
cartSnapshotSchema.index({ cartNumber: 1 });

// ── Virtual: age in minutes ──────────────────────────────────
cartSnapshotSchema.virtual('ageMinutes').get(function () {
  return Math.floor((Date.now() - this.createdAt.getTime()) / 60000);
});

module.exports = mongoose.model('CartSnapshot', cartSnapshotSchema);