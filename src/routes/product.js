// src/routes/product.js
const router = require('express').Router();
const productController = require('../controller/productController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', productController.getProducts);

// create + update
router.post('/', authenticate, authorize('admin', 'manager'), productController.createProduct);
router.put('/:id', authenticate, authorize('admin', 'manager'), productController.updateProduct);
router.delete('/:id', authenticate, authorize('admin'), productController.deleteProduct);

// ✅ delete (soft delete) - allow admin only OR admin+manager (your choice)
router.delete('/:id', authenticate, authorize('admin'), productController.deleteProduct);
// If you want manager can delete too, use:
// router.delete('/:id', authenticate, authorize('admin', 'manager'), productController.deleteProduct);

module.exports = router;
