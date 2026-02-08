const User = require('../models/User');

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ 
      message: 'Users retrieved successfully',
      count: users.length,
      users 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User retrieved successfully',
      user 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, fullName, role, phone } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Create user
    const user = new User({ username, email, password, fullName, role, phone });
    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({ 
      message: 'User created successfully', 
      user: userResponse 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const updates = req.body;
    
    // Don't allow password updates through this endpoint
    if (updates.password) {
      delete updates.password;
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      updates, 
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User updated successfully', 
      user 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete user (soft delete)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { isActive: false }, 
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User deactivated successfully', 
      user: { 
        id: user._id, 
        username: user.username, 
        isActive: user.isActive 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};