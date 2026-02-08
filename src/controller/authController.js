const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register new user
exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName, role, phone } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Create new user
    const user = new User({ username, email, password, fullName, role, phone });
    await user.save();
    
    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.status(201).json({ 
      message: 'User registered successfully',
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        fullName: user.fullName,
        role: user.role 
      }, 
      token 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username, isActive: true });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      message: 'Login successful',
      user: { 
        id: user._id, 
        username: user.username,
        fullName: user.fullName,
        role: user.role 
      }, 
      token 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Logout user
exports.logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};