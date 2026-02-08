const mongoose = require('mongoose');
const { Schema } = mongoose;

const customerSchema = new Schema(
  {
    name:     { type: String, required: true },
    phone:    { type: String, required: true, unique: true },
    email:    { type: String },
    address:  { type: String },
    gender:   { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    dateOfBirth: { type: Date },
    preferences: { type: String },
    notes:       { type: String },

    // RELATIONSHIPS
    favoriteProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    createdBy:        { type: Schema.Types.ObjectId, ref: 'User' },

    // loyalty & stats (used in customerController)
    loyaltyTier:   { type: String, enum: ['Bronze', 'Silver', 'Gold', 'Platinum'], default: 'Bronze' },
    loyaltyPoints: { type: Number, default: 0 },
    isVIP:         { type: Boolean, default: false },
    isActive:      { type: Boolean, default: true },

    totalSpent:    { type: Number, default: 0 },
    totalOrders:   { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },

    lastOrderDate: { type: Date },
    lastVisit:     { type: Date },

    registeredAt:  { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// used in customerController.updateCustomerStats
customerSchema.methods.calculateAverageOrderValue = function () {
  if (this.totalOrders > 0) {
    this.avgOrderValue = this.totalSpent / this.totalOrders;
  }
};

customerSchema.methods.updateLoyaltyTier = function () {
  const spent = this.totalSpent;
  if (spent >= 1000) this.loyaltyTier = 'Platinum';
  else if (spent >= 500) this.loyaltyTier = 'Gold';
  else if (spent >= 200) this.loyaltyTier = 'Silver';
  else this.loyaltyTier = 'Bronze';
};

module.exports = mongoose.model('Customer', customerSchema);
