const router = require("express").Router();
const c = require("../controller/orderController");

// Order CRUD routes
router.get("/", c.getOrders);
router.get("/:id", c.getOrder);
router.post("/", c.createOrder);
router.put("/:id", c.updateOrder);
router.patch("/:id/status", c.updateOrderStatus);
router.delete("/:id", c.deleteOrder);

// ✅ NEW: Receipt routes
router.get("/:id/receipt", c.getOrderReceipt);           // Get receipt (optionally send to Telegram)
router.post("/:id/send-receipt", c.sendOrderReceipt);    // Send receipt to Telegram

module.exports = router;