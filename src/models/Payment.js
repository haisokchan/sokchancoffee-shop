const mongoose = require('mongoose');
const { Schema } = mongoose;

const splitPaymentSchema = new Schema(
  {
    method: String,
    amount: Number
  },
  { _id: false }
);

const cashDetailsSchema = new Schema(
  {
    receivedAmount: { type: Number, required: true },
    changeAmount:   { type: Number, required: true }
  },
  { _id: false }
);

const cardDetailsSchema = new Schema(
  {
    cardType:   String,
    last4:      String,
    holderName: String
  },
  { _id: false }
);

const mobileWalletSchema = new Schema(
  {
    provider: String,
    phone:    String,
    txnId:    String
  },
  { _id: false }
);

const refundSchema = new Schema(
  {
    amount:     { type: Number, required: true },
    reason:     { type: String },
    refundedAt: { type: Date, default: Date.now },
    refundedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    paymentNumber: { type: String, unique: true },

    order:    { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },

    amount:        { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'credit-card', 'debit-card', 'mobile-wallet', 'split'],
      required: true
    },

    cashDetails:   cashDetailsSchema,
    cardDetails:   cardDetailsSchema,
    mobileWallet:  mobileWalletSchema,
    splitPayments: [splitPaymentSchema],

    transactionId: String,

    status: {
      type: String,
      enum: ['pending', 'completed', 'refunded'],
      default: 'pending'
    },

    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: Date,

    refund: refundSchema
  },
  { timestamps: true }
);

paymentSchema.pre('save', function (next) {
  if (!this.paymentNumber) {
    this.paymentNumber = `PMT-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
