const Supplier = require('../models/Supplier');

/**
 * CREATE SUPPLIER
 */
exports.createSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create({
      ...req.body,
      createdBy: req.user?._id
    });
    
    console.log('✅ Supplier created:', supplier._id);
    
    res.status(201).json({ 
      success: true, 
      data: supplier,
      message: 'Supplier created successfully.'
    });
  } catch (err) {
    console.error('❌ Create supplier error:', err);
    
    // Handle duplicate phone number
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * GET ALL SUPPLIERS (with search, filters, and pagination)
 */
exports.getSuppliers = async (req, res) => {
  try {
    const { 
      q,
      page = 1, 
      limit = 100,
      isActive,
      isPreferred
    } = req.query;

    console.log('📥 GET /api/suppliers - Query params:', { q, page, limit, isActive, isPreferred });

    const filter = {};
    
    if (typeof isActive !== 'undefined') {
      filter.isActive = isActive === 'true';
    }
    
    if (typeof isPreferred !== 'undefined') {
      filter.isPreferred = isPreferred === 'true';
    }

    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { companyName: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') }
      ];
    }

    console.log('🔍 Filter:', JSON.stringify(filter, null, 2));

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Supplier.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'username email')
        .populate('productsSupplied', 'name price'),
      Supplier.countDocuments(filter)
    ]);

    console.log('✅ Suppliers found:', items.length, 'out of', total, 'total');

    res.json({
      success: true,
      data: items,
      meta: { 
        total, 
        page: Number(page), 
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    console.error('❌ Get suppliers error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * GET SINGLE SUPPLIER BY ID
 */
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate('productsSupplied', 'name price category description')
      .populate('createdBy', 'username email');

    if (!supplier) {
      return res.status(404).json({ 
        success: false, 
        message: 'Supplier not found.' 
      });
    }

    res.json({ 
      success: true, 
      data: supplier 
    });
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid supplier ID format.'
      });
    }
    console.error('❌ Get supplier error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * UPDATE SUPPLIER
 */
exports.updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { 
        new: true,
        runValidators: true
      }
    );

    if (!supplier) {
      return res.status(404).json({ 
        success: false, 
        message: 'Supplier not found.' 
      });
    }

    console.log('✅ Supplier updated:', supplier._id);

    res.json({ 
      success: true, 
      data: supplier,
      message: 'Supplier updated successfully.'
    });
  } catch (err) {
    console.error('❌ Update supplier error:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists.'
      });
    }
    
    if (err.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid supplier ID format.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * DEACTIVATE SUPPLIER (Soft Delete)
 */
exports.deactivateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ 
        success: false, 
        message: 'Supplier not found.' 
      });
    }

    console.log('✅ Supplier deactivated:', supplier._id);

    res.json({ 
      success: true, 
      data: supplier, 
      message: 'Supplier deactivated successfully.' 
    });
  } catch (err) {
    console.error('❌ Deactivate supplier error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid supplier ID format.'
      });
    }
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * ACTIVATE SUPPLIER
 */
exports.activateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ 
        success: false, 
        message: 'Supplier not found.' 
      });
    }

    console.log('✅ Supplier activated:', supplier._id);

    res.json({ 
      success: true, 
      data: supplier, 
      message: 'Supplier activated successfully.' 
    });
  } catch (err) {
    console.error('❌ Activate supplier error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid supplier ID format.'
      });
    }
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * DELETE SUPPLIER (Hard Delete - Permanent)
 */
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);

    if (!supplier) {
      return res.status(404).json({ 
        success: false, 
        message: 'Supplier not found.' 
      });
    }

    console.log('✅ Supplier deleted:', supplier._id);

    res.json({ 
      success: true, 
      message: 'Supplier deleted permanently.',
      data: { id: req.params.id }
    });
  } catch (err) {
    console.error('❌ Delete supplier error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid supplier ID format.'
      });
    }
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * Update supplier statistics after a purchase
 */
exports.updateSupplierStats = async (supplierId, purchaseAmount) => {
  try {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) return;

    supplier.totalPurchases += purchaseAmount;
    supplier.totalOrders += 1;
    supplier.lastOrderDate = new Date();
    supplier.calculateAverageOrderValue();
    
    await supplier.save();
    console.log('✅ Supplier stats updated:', supplierId);
  } catch (err) {
    console.error('❌ Error updating supplier stats:', err);
  }
};