const Product = require('../models/Product');

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// GET /api/products?search=&category=
exports.getProducts = async (req, res) => {
  try {
    const { search = '', category = '' } = req.query;

    const filter = { isDeleted: false };

    if (category) filter.category = category;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [products, total, agg] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
      Product.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalQty: { $sum: { $ifNull: ['$stock', 0] } },
            totalValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$price', 0] },
                  { $ifNull: ['$stock', 0] },
                ],
              },
            },
          },
        },
      ]),
    ]);

    const totalQty = agg?.[0]?.totalQty || 0;
    const totalValue = agg?.[0]?.totalValue || 0;

    return res.json({
      success: true,
      total,
      totalQty,
      totalValue,
      products,
    });
  } catch (err) {
    console.error('getProducts error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/products (admin/manager)
exports.createProduct = async (req, res) => {
  try {
    const b = req.body || {};

    const product = await Product.create({
      name: b.name,
      description: b.description || '',
      category: b.category,
      price: toNum(b.price, 0),
      stock: toNum(b.stock, 0),
      minStock: toNum(b.minStock, 5),
      image: b.image || '',
      isAvailable: b.isAvailable ?? true,
      createdBy: req.user?._id ?? null,
      isDeleted: false,
    });

    return res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('createProduct error:', err);
    return res.status(400).json({ success: false, message: err.message || 'Create failed' });
  }
};

// PUT /api/products/:id (admin/manager)
exports.updateProduct = async (req, res) => {
  try {
    const b = req.body || {};

    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      {
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.category !== undefined ? { category: b.category } : {}),
        ...(b.price !== undefined ? { price: toNum(b.price, 0) } : {}),
        ...(b.stock !== undefined ? { stock: toNum(b.stock, 0) } : {}),
        ...(b.minStock !== undefined ? { minStock: toNum(b.minStock, 5) } : {}),
        ...(b.image !== undefined ? { image: b.image } : {}),
        ...(b.isAvailable !== undefined ? { isAvailable: b.isAvailable } : {}),
      },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: 'Product not found' });

    return res.json({ success: true, product: updated });
  } catch (err) {
    console.error('updateProduct error:', err);
    return res.status(400).json({ success: false, message: err.message || 'Update failed' });
  }
};

// DELETE /api/products/:id (admin only) => soft delete

// src/controller/productController.js


// src/controller/productController.js
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Product.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user?._id ?? null,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, product: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Delete product failed' });
  }
};
// DELETE /api/products/:id  (hard delete)
exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Delete failed' });
  }
};


