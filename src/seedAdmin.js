const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coffee';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await User.findOne({ username: 'admin' });
    if (existing) {
      console.log('⚠️ Admin user already exists');
      process.exit(0);
    }

    const user = new User({
      username: 'admin',
      email: 'admin@coffee.com',
      password: '123456',
      fullName: 'Administrator',
      role: 'admin',
      isActive: true
    });

    await user.save();
    console.log('✅ Admin user created successfully');
    console.log('   Username: admin');
    console.log('   Password: 123456');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedAdmin();