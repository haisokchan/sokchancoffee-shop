const router = require('express').Router();
const supplierController = require('../controller/supplierController');

// If you have auth middleware, plug it in like:
// const { protect, authorize } = require('../middleware/auth');

// CREATE - Add new supplier
router.post('/', /* protect, */ supplierController.createSupplier);

// READ ALL - Get all suppliers with search, filters, and pagination
router.get('/', /* protect, */ supplierController.getSuppliers);

// READ ONE - Get single supplier by ID
router.get('/:id', /* protect, */ supplierController.getSupplierById);

// UPDATE - Update supplier details
router.put('/:id', /* protect, */ supplierController.updateSupplier);

// SOFT DELETE - Deactivate supplier (set isActive to false)
router.patch('/:id/deactivate', /* protect, */ supplierController.deactivateSupplier);

// SOFT ACTIVATE - Reactivate supplier (set isActive to true)
router.patch('/:id/activate', /* protect, */ supplierController.activateSupplier);

// HARD DELETE - Permanently delete supplier (use with caution)
router.delete('/:id', /* protect, */ supplierController.deleteSupplier);

module.exports = router;