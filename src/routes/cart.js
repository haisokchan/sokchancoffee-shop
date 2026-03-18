// routes/cart.js — Cart routes: validation + persistence + reporting + print
const express        = require('express');
const router         = express.Router();
const cartController = require('../controller/cartController');

// ─────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────
router.post('/validate-product',    cartController.validateProduct);
router.post('/validate-cart',       cartController.validateCart);
router.get( '/check-stock/:productId', cartController.checkProductStock);
router.post('/check-stock-bulk',    cartController.bulkCheckStock);

// ─────────────────────────────────────────────────────────────
// TELEGRAM NOTIFICATIONS (legacy — still used by cart.service.ts)
// ─────────────────────────────────────────────────────────────
router.post('/notify-add',          cartController.notifyItemAdded);
router.post('/notify-summary',      cartController.sendCartSummary);
router.post('/notify-checkout',     cartController.notifyCheckout);
router.post('/notify-cleared',      cartController.notifyCartCleared);

// ─────────────────────────────────────────────────────────────
// ✅ PERSISTENCE — save cart to DB
// ─────────────────────────────────────────────────────────────
router.post('/save',                cartController.saveCart);

// ─────────────────────────────────────────────────────────────
// ✅ REPORT — list + filter saved carts
// ─────────────────────────────────────────────────────────────
router.get( '/snapshots',                           cartController.getCartSnapshots);
router.get( '/snapshots/:id',                       cartController.getCartSnapshot);
router.patch('/snapshots/:id/status',               cartController.updateCartStatus);
router.delete('/snapshots/:id',                     cartController.deleteCartSnapshot);

// ─────────────────────────────────────────────────────────────
// ✅ PRINT — receipt data for a saved cart
// ─────────────────────────────────────────────────────────────
router.get( '/snapshots/:id/print',                 cartController.printCart);

// ─────────────────────────────────────────────────────────────
// ✅ TELEGRAM TEXT — send saved cart text receipt to Telegram
// ─────────────────────────────────────────────────────────────
router.post('/snapshots/:id/telegram',              cartController.sendSnapshotToTelegram);

// ─────────────────────────────────────────────────────────────
// ✅ TELEGRAM IMAGE — render receipt as JPG → send as photo
// ─────────────────────────────────────────────────────────────
router.post('/snapshots/:id/send-image',            cartController.sendReceiptImage);

// ─────────────────────────────────────────────────────────────
// ✅ DOWNLOAD JPG — download receipt as image file
// ─────────────────────────────────────────────────────────────
router.get( '/snapshots/:id/download-jpg',          cartController.downloadReceiptJpg);

module.exports = router;