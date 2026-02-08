const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: [orderItemSchema],
    
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending'
    },
    
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending'
    },
    
    paymentMethod: String,
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    paidAmount: Number,
    changeAmount: Number,
    
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: Date,
  },
  { timestamps: true }
);

// Generate unique order number before saving
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    let isUnique = false;
    let orderNumber;
    
    // Keep trying until we get a unique order number
    while (!isUnique) {
      // Generate a random order number with timestamp + random string
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 7).toUpperCase();
      orderNumber = `ORD-${timestamp}-${random}`;
      
      // Check if this order number already exists
      const existing = await mongoose.models.Order.findOne({ orderNumber });
      
      if (!existing) {
        isUnique = true;
      }
    }
    
    this.orderNumber = orderNumber;
  }
  next();
});

// Calculate totals
orderSchema.methods.recalcTotals = function () {
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (Number(item.price) || 0) * (Number(item.qty) || 0);
  }, 0);
  
  this.tax = 0; // Add tax calculation if needed
  this.total = this.subtotal + this.tax;
  
  return this;
};

// Recalculate totals before saving
orderSchema.pre('save', function (next) {
  this.recalcTotals();
  next();
});

module.exports = mongoose.model('Order', orderSchema);