const mongoose = require('mongoose');
const { Schema } = mongoose;

const supplierSchema = new Schema(
  {
    name: { type: String, required: true },
    companyName: { type: String },
    phone: { type: String, required: true, unique: true },
    email: { type: String },
    address: { type: String },

    contactPerson: { type: String },
    website: { type: String },

    // BUSINESS INFO
    taxNumber: { type: String },
    paymentTerms: {
      type: String,
      enum: ['COD', 'Net 7', 'Net 15', 'Net 30', 'Net 60'],
      default: 'COD'
    },
    creditLimit: { type: Number, default: 0 },

    // RELATIONSHIPS
    productsSupplied: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // STATS
    totalPurchases: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },

    lastOrderDate: { type: Date },

    // STATUS
    isPreferred: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    notes: { type: String },

    registeredAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// METHODS
supplierSchema.methods.calculateAverageOrderValue = function () {
  if (this.totalOrders > 0) {
    this.avgOrderValue = this.totalPurchases / this.totalOrders;
  }
};

module.exports = mongoose.model('Supplier', supplierSchema);
