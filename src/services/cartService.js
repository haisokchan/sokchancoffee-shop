// services/cartService.js - Cart Telegram Notifications
const telegramService = require('./telegramService');

// Category icons matching the frontend
const CATEGORY_ICONS = {
  Coffee:  '☕',
  Tea:     '🍵',
  Drink:   '🥤',
  Food:    '🍽',
  Dessert: '🍰'
};

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || '📦';
}

// Right-pad a string to fixed width (left-align)
function padEnd(str, len) {
  str = String(str);
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

// Left-pad a string to fixed width (right-align numbers)
function padStart(str, len) {
  str = String(str);
  return str.length >= len ? str.slice(0, len) : ' '.repeat(len - str.length) + str;
}

// Cart number matching the DB CartSnapshot format
function makeCartNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CART-${d}-${Math.floor(1000 + Math.random() * 9000)}`;
}

class CartService {

  // ─────────────────────────────────────────────────────────
  // ✅ MAIN CART RECEIPT — mirrors the print receipt
  // Uses <code>...</code> for monospace alignment in Telegram
  // ─────────────────────────────────────────────────────────
  formatCartMessage(cartItems, customerInfo = null, cartNumber = null) {
    const cn  = cartNumber || makeCartNumber();
    const now = new Date().toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    let subtotal  = 0;
    const lines   = [];

    cartItems.forEach(item => {
      const name  = item.product?.name || item.productName || item.name || 'Unknown';
      const cat   = item.product?.category || item.category || '';
      const price = Number(item.product?.price || item.price || 0);
      const qty   = Number(item.quantity || item.qty || 0);
      const total = price * qty;
      subtotal   += total;
      lines.push({ name, cat, price, qty, total });
    });

    const tax        = subtotal * 0.10;
    const grandTotal = subtotal + tax;
    const unitCount  = lines.reduce((s, l) => s + l.qty, 0);

    // Width = 27 chars inside <code> block
    // Left col = 19, right col = 8
    const W = 19, R = 8;

    let msg = `🧾 <b>CART RECEIPT</b>\n\n`;
    msg += `<code>`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `     ☕  CAFÉ MANAGER\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Cart #   ${cn}\n`;
    msg += `Date     ${now}\n`;
    msg += `Customer ${customerInfo?.name || 'Guest Customer'}\n`;
    if (customerInfo?.phone) {
      msg += `Phone    ${customerInfo.phone}\n`;
    }
    msg += `───────────────────────────\n`;
    msg += `ITEMS  ${unitCount} unit${unitCount !== 1 ? 's' : ''}, ${lines.length} type${lines.length !== 1 ? 's' : ''}\n`;
    msg += `───────────────────────────\n`;

    lines.forEach(l => {
      const icon      = getCategoryIcon(l.cat);
      // Truncate name to fit in left column
      const rawName   = `${icon} ${l.name}`;
      const nameStr   = rawName.length > W ? rawName.slice(0, W - 1) + '…' : rawName;
      const priceStr  = `$${l.total.toFixed(2)}`;

      msg += `${padEnd(nameStr, W)}${padStart(priceStr, R)}\n`;
      msg += `  ${l.qty} × $${l.price.toFixed(2)}\n`;
    });

    msg += `───────────────────────────\n`;
    msg += `${padEnd('Subtotal', W)}${padStart('$' + subtotal.toFixed(2), R)}\n`;
    msg += `${padEnd('Tax (10%)', W)}${padStart('$' + tax.toFixed(2), R)}\n`;
    msg += `${padEnd('Shipping', W)}${padStart('Free', R)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `${padEnd('TOTAL', W)}${padStart('$' + grandTotal.toFixed(2), R)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `\n   ✨ Thank you! ✨\n`;
    msg += `</code>`;

    return msg;
  }

  // ─────────────────────────────────────────────────────────
  // Item added — compact notification
  // ─────────────────────────────────────────────────────────
  formatItemAddedMessage(item, cartTotalUnits) {
    const name  = item.product?.name || item.name || 'Unknown';
    const cat   = item.product?.category || '';
    const price = Number(item.product?.price || item.price || 0);
    const qty   = Number(item.quantity || item.qty || 0);
    const icon  = getCategoryIcon(cat);
    const now   = new Date().toLocaleString('en-US', {
      month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const W = 14, R = 12;

    let msg = `➕ <b>Item Added to Cart</b>\n\n`;
    msg += `<code>`;
    msg += `${icon} ${name}\n`;
    msg += `───────────────────────────\n`;
    msg += `${padEnd('Price',      W)}${padStart('$' + price.toFixed(2),         R)}\n`;
    msg += `${padEnd('Qty',        W)}${padStart('×' + qty,                       R)}\n`;
    msg += `${padEnd('Item Total', W)}${padStart('$' + (price * qty).toFixed(2),  R)}\n`;
    msg += `───────────────────────────\n`;
    msg += `${padEnd('Cart Total', W)}${padStart(cartTotalUnits + ' unit(s)',     R)}\n`;
    msg += `${padEnd('Time',       W)}${padStart(now,                             R)}\n`;
    msg += `</code>`;

    return msg;
  }

  // ─────────────────────────────────────────────────────────
  // Checkout notification
  // ─────────────────────────────────────────────────────────
  formatCheckoutMessage(cartItems, customerInfo, orderNumber) {
    let subtotal  = 0;
    let unitCount = 0;

    cartItems.forEach(item => {
      const price = Number(item.product?.price || item.price || 0);
      const qty   = Number(item.quantity || item.qty || 0);
      subtotal   += price * qty;
      unitCount  += qty;
    });

    const tax   = subtotal * 0.10;
    const total = subtotal + tax;
    const now   = new Date().toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const W = 19, R = 8;

    let msg = `✅ <b>Checkout Initiated</b>\n\n`;
    msg += `<code>`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (orderNumber) msg += `Order    ${orderNumber}\n`;
    msg += `Customer ${customerInfo?.name || 'Guest'}\n`;
    if (customerInfo?.phone) msg += `Phone    ${customerInfo.phone}\n`;
    msg += `Date     ${now}\n`;
    msg += `───────────────────────────\n`;
    msg += `${padEnd('Items', W)}${padStart(unitCount + ' unit(s)', R)}\n`;
    msg += `${padEnd('Subtotal', W)}${padStart('$' + subtotal.toFixed(2), R)}\n`;
    msg += `${padEnd('Tax (10%)', W)}${padStart('$' + tax.toFixed(2), R)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `${padEnd('TOTAL', W)}${padStart('$' + total.toFixed(2), R)}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `</code>`;

    return msg;
  }

  // ─────────────────────────────────────────────────────────
  // Cart cleared notification
  // ─────────────────────────────────────────────────────────
  formatClearedMessage(itemCount, totalValue) {
    const now = new Date().toLocaleString('en-US', {
      month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const W = 16, R = 10;

    let msg = `🗑️ <b>Cart Cleared</b>\n\n`;
    msg += `<code>`;
    msg += `${padEnd('Items removed', W)}${padStart(itemCount,                          R)}\n`;
    msg += `${padEnd('Cart value',    W)}${padStart('$' + Number(totalValue).toFixed(2), R)}\n`;
    msg += `${padEnd('Time',          W)}${padStart(now,                                 R)}\n`;
    msg += `</code>`;

    return msg;
  }

  // ─────────────────────────────────────────────────────────
  // Public send methods
  // ─────────────────────────────────────────────────────────

  async sendCartSummary(cartItems, customerInfo = null, cartNumber = null) {
    if (!cartItems || cartItems.length === 0) {
      console.log('⚠️ Cannot send empty cart to Telegram');
      return { success: false, message: 'Cart is empty' };
    }
    const message = this.formatCartMessage(cartItems, customerInfo, cartNumber);
    return await telegramService.sendMessage(message);
  }

  async notifyItemAdded(item, cartTotal) {
    const message = this.formatItemAddedMessage(item, cartTotal);
    return await telegramService.sendMessage(message);
  }

  async notifyCartCheckout(cartItems, customerInfo, orderNumber = null) {
    const message = this.formatCheckoutMessage(cartItems, customerInfo, orderNumber);
    return await telegramService.sendMessage(message);
  }

  async notifyCartCleared(itemCount, totalValue) {
    const message = this.formatClearedMessage(itemCount, totalValue);
    return await telegramService.sendMessage(message);
  }
}

module.exports = new CartService();