// services/cartService.js - Cart Telegram Notifications
const telegramService = require('./telegramService');

class CartService {
  /**
   * Format cart items message for Telegram
   */
  formatCartMessage(cartItems, customerInfo = null) {
    let message = `🛒 <b>CART UPDATE</b>\n\n`;
    
    if (customerInfo) {
      message += `👤 <b>Customer:</b> ${customerInfo.name || 'Guest'}\n`;
      if (customerInfo.phone) {
        message += `📞 <b>Phone:</b> ${customerInfo.phone}\n`;
      }
      message += `\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📦 <b>CART ITEMS</b> (${cartItems.length} item${cartItems.length > 1 ? 's' : ''})\n\n`;
    
    let subtotal = 0;
    
    cartItems.forEach((item, index) => {
      const productName = item.product?.name || item.name || 'Unknown Product';
      const price = Number(item.product?.price || item.price || 0);
      const qty = Number(item.quantity || item.qty || 0);
      const itemTotal = price * qty;
      subtotal += itemTotal;
      
      message += `${index + 1}. <b>${productName}</b>\n`;
      message += `   ${qty} × $${price.toFixed(2)} = <b>$${itemTotal.toFixed(2)}</b>\n`;
      
      if (index < cartItems.length - 1) {
        message += `   ─────────────────────\n`;
      }
    });
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `\n💰 <b>Subtotal:</b> $${subtotal.toFixed(2)}\n`;
    message += `📊 <b>Tax (10%):</b> $${(subtotal * 0.1).toFixed(2)}\n`;
    message += `   ─────────────────────\n`;
    message += `<b>Total:</b> $${(subtotal * 1.1).toFixed(2)}\n`;
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `\n🕐 ${new Date().toLocaleString()}\n`;
    
    return message;
  }

  /**
   * Format single item added message
   */
  formatItemAddedMessage(item, cartTotal) {
    const productName = item.product?.name || item.name || 'Unknown Product';
    const price = Number(item.product?.price || item.price || 0);
    const qty = Number(item.quantity || item.qty || 0);
    
    let message = `➕ <b>ITEM ADDED TO CART</b>\n\n`;
    message += `📦 <b>Product:</b> ${productName}\n`;
    message += `💵 <b>Price:</b> $${price.toFixed(2)}\n`;
    message += `🔢 <b>Quantity:</b> ${qty}\n`;
    message += `💰 <b>Item Total:</b> $${(price * qty).toFixed(2)}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🛒 <b>Cart Total:</b> ${cartTotal} item${cartTotal > 1 ? 's' : ''}\n`;
    message += `🕐 ${new Date().toLocaleString()}\n`;
    
    return message;
  }

  /**
   * Send cart summary to Telegram
   */
  async sendCartSummary(cartItems, customerInfo = null) {
    if (!cartItems || cartItems.length === 0) {
      console.log('⚠️ Cannot send empty cart to Telegram');
      return { success: false, message: 'Cart is empty' };
    }
    
    const message = this.formatCartMessage(cartItems, customerInfo);
    return await telegramService.sendMessage(message);
  }

  /**
   * Send item added notification to Telegram
   */
  async notifyItemAdded(item, cartTotal) {
    const message = this.formatItemAddedMessage(item, cartTotal);
    return await telegramService.sendMessage(message);
  }

  /**
   * Send cart checkout notification to Telegram
   */
  async notifyCartCheckout(cartItems, customerInfo, orderNumber = null) {
    let message = `✅ <b>CHECKOUT INITIATED</b>\n\n`;
    
    if (orderNumber) {
      message += `📦 <b>Order #:</b> ${orderNumber}\n`;
    }
    
    if (customerInfo) {
      message += `👤 <b>Customer:</b> ${customerInfo.name || 'Guest'}\n`;
      if (customerInfo.phone) {
        message += `📞 <b>Phone:</b> ${customerInfo.phone}\n`;
      }
      message += `\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `🛒 <b>Items:</b> ${cartItems.length}\n`;
    
    let subtotal = 0;
    cartItems.forEach(item => {
      const price = Number(item.product?.price || item.price || 0);
      const qty = Number(item.quantity || item.qty || 0);
      subtotal += price * qty;
    });
    
    message += `💰 <b>Total:</b> $${(subtotal * 1.1).toFixed(2)}\n`;
    message += `\n🕐 ${new Date().toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    return await telegramService.sendMessage(message);
  }

  /**
   * Send cart cleared notification
   */
  async notifyCartCleared(itemCount, totalValue) {
    let message = `🗑️ <b>CART CLEARED</b>\n\n`;
    message += `📦 <b>Items Removed:</b> ${itemCount}\n`;
    message += `💰 <b>Total Value:</b> $${totalValue.toFixed(2)}\n`;
    message += `\n🕐 ${new Date().toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    return await telegramService.sendMessage(message);
  }
}

// Export singleton instance
module.exports = new CartService();