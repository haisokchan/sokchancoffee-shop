// models/CartSnapshot.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  category:    { type: String },
  price:       { type: Number, required: true },
  quantity:    { type: Number, required: true },
  itemTotal:   { type: Number, required: true }
}, { _id: false });

const cartSnapshotSchema = new mongoose.Schema({

  cartNumber: {
    type: String,
    // ✅ removed "unique: true" here — handled by index below
    default: () => `CART-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`
  },

  customer: {
    name:  { type: String, default: 'Guest' },
    phone: { type: String, default: '' }
  },

  status: {
    type: String,
    enum: ['active', 'saved', 'checked_out', 'cleared', 'expired'],
    default: 'saved'
  },

  items: [cartItemSchema],

  subtotal:  { type: Number, required: true },
  taxRate:   { type: Number, default: 0.10 },
  tax:       { type: Number, required: true },
  total:     { type: Number, required: true },

  itemCount:    { type: Number },
  productCount: { type: Number },
  notes:        { type: String, default: '' },

  telegramSent:   { type: Boolean, default: false },
  telegramSentAt: { type: Date }

}, {
  timestamps: true
});

// ✅ Single index definitions only
cartSnapshotSchema.index({ createdAt: -1 });
cartSnapshotSchema.index({ status: 1 });
cartSnapshotSchema.index({ 'customer.name': 1 });
cartSnapshotSchema.index({ cartNumber: 1 }, { unique: true }); // ✅ unique defined here only

cartSnapshotSchema.virtual('ageMinutes').get(function () {
  return Math.floor((Date.now() - this.createdAt.getTime()) / 60000);
});

module.exports = mongoose.model('CartSnapshot', cartSnapshotSchema);