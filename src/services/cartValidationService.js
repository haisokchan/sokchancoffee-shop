// services/cartValidationService.js - Backend Product Validation
const Product = require('../models/Product');

/**
 * Validate product availability and stock before adding to cart
 */
async function validateProductForCart(productId, quantity = 1, currentCartQuantity = 0) {
  try {
    // 1. Check if productId is valid
    if (!productId) {
      return {
        valid: false,
        message: '❌ Product ID is required',
        code: 'INVALID_PRODUCT_ID'
      };
    }

    // 2. Fetch product from database
    const product = await Product.findOne({ 
      _id: productId, 
      isDeleted: false 
    });

    if (!product) {
      return {
        valid: false,
        message: '❌ Product not found or has been deleted',
        code: 'PRODUCT_NOT_FOUND'
      };
    }

    // 3. Check if product is available
    if (product.isAvailable === false) {
      return {
        valid: false,
        message: `❌ "${product.name}" is currently unavailable`,
        code: 'PRODUCT_UNAVAILABLE',
        product
      };
    }

    // 4. Check if price is valid
    if (!product.price || product.price <= 0) {
      return {
        valid: false,
        message: `❌ "${product.name}" has an invalid price`,
        code: 'INVALID_PRICE',
        product
      };
    }

    // 5. Validate quantity
    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return {
        valid: false,
        message: '❌ Quantity must be a positive integer',
        code: 'INVALID_QUANTITY'
      };
    }

    // 6. Check maximum quantity per order
    const MAX_QUANTITY_PER_ITEM = 99;
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      return {
        valid: false,
        message: `❌ Maximum ${MAX_QUANTITY_PER_ITEM} units per item allowed`,
        code: 'QUANTITY_EXCEEDED',
        maxQuantity: MAX_QUANTITY_PER_ITEM
      };
    }

    // 7. Check stock availability
    if (product.stock !== undefined && product.stock !== null) {
      const totalRequested = currentCartQuantity + quantity;

      // Out of stock
      if (product.stock <= 0) {
        return {
          valid: false,
          message: `❌ "${product.name}" is out of stock`,
          code: 'OUT_OF_STOCK',
          product,
          availableStock: 0
        };
      }

      // Insufficient stock
      if (totalRequested > product.stock) {
        const available = product.stock - currentCartQuantity;
        return {
          valid: false,
          message: `❌ Only ${available} unit${available !== 1 ? 's' : ''} of "${product.name}" available`,
          code: 'INSUFFICIENT_STOCK',
          product,
          availableStock: available,
          requestedQuantity: quantity,
          currentInCart: currentCartQuantity
        };
      }

      // Low stock warning (not blocking, just informational)
      if (product.minStock && totalRequested > (product.stock - product.minStock)) {
        console.warn(
          `⚠️ Warning: Adding "${product.name}" will bring stock close to minimum threshold. ` +
          `Current: ${product.stock}, Minimum: ${product.minStock}, Requested: ${totalRequested}`
        );
      }
    }

    // 8. All validations passed
    return {
      valid: true,
      message: `✅ "${product.name}" can be added to cart`,
      code: 'VALIDATION_PASSED',
      product,
      availableStock: product.stock - currentCartQuantity,
      requestedQuantity: quantity
    };

  } catch (error) {
    console.error('Product validation error:', error);
    return {
      valid: false,
      message: '❌ Error validating product',
      code: 'VALIDATION_ERROR',
      error: error.message
    };
  }
}

/**
 * Validate entire cart before checkout
 */
async function validateCartItems(cartItems) {
  const errors = [];
  const warnings = [];
  const validatedItems = [];

  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i];
    const productId = item.product?._id || item.productId;
    const quantity = item.quantity || 1;

    const validation = await validateProductForCart(productId, quantity, 0);

    if (!validation.valid) {
      errors.push({
        index: i,
        productId,
        productName: item.product?.name || 'Unknown',
        error: validation.message,
        code: validation.code
      });
    } else {
      validatedItems.push({
        ...item,
        validatedProduct: validation.product
      });

      // Check for low stock warnings
      if (validation.product.stock && validation.product.minStock) {
        if (validation.product.stock - quantity <= validation.product.minStock) {
          warnings.push({
            index: i,
            productName: validation.product.name,
            message: `⚠️ Low stock: Only ${validation.product.stock - quantity} units will remain`
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validatedItems
  };
}

/**
 * Check product stock in real-time (for live updates)
 */
async function checkProductStock(productId) {
  try {
    const product = await Product.findOne({ 
      _id: productId, 
      isDeleted: false 
    }).select('name stock minStock isAvailable price');

    if (!product) {
      return {
        available: false,
        message: 'Product not found',
        stock: 0
      };
    }

    return {
      available: product.isAvailable && product.stock > 0,
      stock: product.stock || 0,
      minStock: product.minStock || 0,
      isLowStock: product.stock <= (product.minStock || 5),
      price: product.price,
      name: product.name
    };

  } catch (error) {
    console.error('Stock check error:', error);
    return {
      available: false,
      message: 'Error checking stock',
      stock: 0,
      error: error.message
    };
  }
}

/**
 * Bulk check stock for multiple products
 */
async function bulkCheckStock(productIds) {
  try {
    const products = await Product.find({
      _id: { $in: productIds },
      isDeleted: false
    }).select('name stock minStock isAvailable price');

    const stockInfo = {};

    products.forEach(product => {
      stockInfo[product._id.toString()] = {
        available: product.isAvailable && product.stock > 0,
        stock: product.stock || 0,
        minStock: product.minStock || 0,
        isLowStock: product.stock <= (product.minStock || 5),
        price: product.price,
        name: product.name
      };
    });

    return {
      success: true,
      stockInfo
    };

  } catch (error) {
    console.error('Bulk stock check error:', error);
    return {
      success: false,
      message: 'Error checking stock',
      error: error.message
    };
  }
}

module.exports = {
  validateProductForCart,
  validateCartItems,
  checkProductStock,
  bulkCheckStock
};