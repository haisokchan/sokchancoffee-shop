const express = require('express');
const router = express.Router();
const userController = require('../controller/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Get all users (Admin/Manager only)
router.get('/', authenticate, authorize('admin', 'manager'), userController.getUsers);

// Get single user (Any authenticated user)
router.get('/:id', authenticate, userController.getUser);

// Create user (Admin only)
router.post('/', authenticate, authorize('admin'), userController.createUser);

// Update user (Admin/Manager)
router.put('/:id', authenticate, authorize('admin', 'manager'), userController.updateUser);

// Delete user (Admin only)
router.delete('/:id', authenticate, authorize('admin'), userController.deleteUser);

module.exports = router;