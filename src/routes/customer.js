// src/routes/customer.js
const express = require('express');
const router = express.Router();

const customerController = require('../controller/customerController'); // ✅ correct for your folder
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// LIST / SEARCH / STATS
router.get('/', customerController.getCustomers);
router.get('/stats/overview', authorize('admin', 'manager'), customerController.getCustomerStats);
router.get('/search/phone/:phone', customerController.searchByPhone);

// ✅ FAVORITES (MUST be before "/:id")
router.get('/:id/favorites', customerController.getFavorites);
router.patch('/:id/favorites/add', customerController.addFavorite);
router.patch('/:id/favorites/remove', customerController.removeFavorite);
router.put('/:id/favorites', customerController.setFavorites);

// CUSTOMER CRUD
router.get('/:id', customerController.getCustomer);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

router.delete('/:id', authorize('admin', 'manager'), customerController.deleteCustomer);

// LOYALTY / VIP / STATS
router.patch('/:id/loyalty/add', customerController.addLoyaltyPoints);
router.patch('/:id/loyalty/redeem', customerController.redeemLoyaltyPoints);
router.patch('/:id/stats', customerController.updateCustomerStats);
router.patch('/:id/vip', authorize('admin', 'manager'), customerController.toggleVIP);

module.exports = router;
