const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },

    category: {
      type: String,
      enum: ['Coffee', 'Tea', 'Drink', 'Food', 'Dessert'],
      required: true,
    },

    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 5, min: 0 },

    // Dynamic image (optional)
    image: { type: String, default: '' },

    isAvailable: { type: Boolean, default: true },

    // ✅ NEW: Supplier relationship
    supplier: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Supplier', 
      default: null 
    },

    // ✅ NEW: Supplier details (denormalized for quick access)
    supplierDetails: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      lastSupplyDate: { type: Date, default: null }
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Soft delete fields
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// ✅ Index for faster supplier queries
productSchema.index({ supplier: 1 });
productSchema.index({ isDeleted: 1, supplier: 1 });

module.exports = mongoose.model('Product', productSchema);