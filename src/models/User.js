const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email:    { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff' },
    phone:    { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// used in authController.login
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
