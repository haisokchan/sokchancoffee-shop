// services/telegramService.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class TelegramService {
  constructor() {
    this.botToken = process.env.BOT_TOKEN;
    this.chatId = process.env.CHAT_ID;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Check if Telegram bot is configured and working
   */
  async checkConnection() {
    try {
      if (!this.botToken || !this.chatId) {
        console.log('⚠️ Telegram bot not configured. Please set BOT_TOKEN and CHAT_ID in .env');
        return false;
      }

      const response = await axios.get(`${this.baseUrl}/getMe`);
      
      if (response.data.ok) {
        console.log('✅ Telegram bot connected successfully!');
        console.log('📱 Bot username:', response.data.result.username);
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('❌ Telegram bot connection failed:', error.message);
      return false;
    }
  }

  /**
   * Send a text message to Telegram
   */
  async sendMessage(text, parseMode = 'HTML') {
    try {
      if (!this.botToken || !this.chatId) {
        console.log('⚠️ Telegram not configured, skipping notification');
        return { success: false, message: 'Telegram not configured' };
      }

      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: text,
        parse_mode: parseMode,
      });

      if (response.data.ok) {
        console.log('✅ Telegram message sent successfully');
        return { success: true, data: response.data };
      }

      return { success: false, message: 'Failed to send message' };
    } catch (error) {
      console.log('❌ Error sending Telegram message:', error.response?.data || error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Send image to Telegram
   */
  async sendImage(imagePath, caption = '') {
    try {
      if (!this.botToken || !this.chatId) {
        return { success: false, message: 'Telegram not configured' };
      }

      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.log('❌ Image file not found:', imagePath);
        return { success: false, message: 'Image file not found' };
      }

      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      formData.append('photo', fs.createReadStream(imagePath));
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');

      const response = await axios.post(
        `${this.baseUrl}/sendPhoto`,
        formData,
        { headers: formData.getHeaders() }
      );

      if (response.data.ok) {
        console.log('✅ Image sent to Telegram successfully');
        return { success: true };
      }

      return { success: false };
    } catch (error) {
      console.log('❌ Error sending image:', error.response?.data || error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Format receipt message
   */
  formatReceipt(order) {
    const statusEmoji = {
      'pending': '⏳',
      'paid': '✅',
      'cancelled': '❌'
    };

    let receipt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    receipt += `        🧾 <b>ORDER RECEIPT</b> 🧾\n`;
    receipt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    receipt += `📦 <b>Order #:</b> ${order.orderNumber}\n`;
    receipt += `📅 <b>Date:</b> ${new Date(order.createdAt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })}\n`;
    receipt += `${statusEmoji[order.status] || '📌'} <b>Status:</b> ${order.status.toUpperCase()}\n`;
    receipt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Customer info
    if (order.customer) {
      receipt += `\n👤 <b>CUSTOMER INFORMATION</b>\n`;
      receipt += `   Name: ${order.customer.name || 'N/A'}\n`;
      if (order.customer.phone) {
        receipt += `   Phone: ${order.customer.phone}\n`;
      }
      if (order.customer.email) {
        receipt += `   Email: ${order.customer.email}\n`;
      }
      receipt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    // Items
    receipt += `\n🛒 <b>ORDER ITEMS</b>\n\n`;
    
    order.items.forEach((item, index) => {
      const productName = item.product?.name || 'Unknown Product';
      const price = Number(item.price).toFixed(2);
      const qty = item.qty;
      const subtotal = (price * qty).toFixed(2);
      
      receipt += `${index + 1}. <b>${productName}</b>\n`;
      receipt += `   ${qty} × $${price} = <b>$${subtotal}</b>\n`;
      if (index < order.items.length - 1) {
        receipt += `   ─────────────────────\n`;
      }
    });

    receipt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Totals
    receipt += `\n💰 <b>PAYMENT SUMMARY</b>\n\n`;
    receipt += `   Subtotal:        $${Number(order.subtotal || 0).toFixed(2)}\n`;
    
    if (order.tax && order.tax > 0) {
      receipt += `   Tax:             $${Number(order.tax).toFixed(2)}\n`;
    }
    
    receipt += `   ─────────────────────\n`;
    receipt += `   <b>TOTAL:           $${Number(order.total || 0).toFixed(2)}</b>\n`;

    // Payment details
    if (order.paymentMethod) {
      receipt += `\n   Payment Method: ${order.paymentMethod}\n`;
    }
    if (order.paidAmount) {
      receipt += `   Amount Paid:    $${Number(order.paidAmount).toFixed(2)}\n`;
    }
    if (order.changeAmount && order.changeAmount > 0) {
      receipt += `   Change:         $${Number(order.changeAmount).toFixed(2)}\n`;
    }

    receipt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Notes
    if (order.notes) {
      receipt += `\n📝 <b>NOTES</b>\n`;
      receipt += `${order.notes}\n`;
      receipt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    receipt += `\n       ✨ Thank you! ✨\n`;
    receipt += `   Please come again! 🙏\n`;
    receipt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    return receipt;
  }

  /**
   * Format order notification message
   */
  formatOrderMessage(order, action = 'created') {
    const statusEmoji = {
      'pending': '⏳',
      'paid': '✅',
      'cancelled': '❌'
    };

    const actionEmoji = {
      'created': '🆕',
      'updated': '📝',
      'deleted': '🗑️',
      'status_changed': '🔄'
    };

    let message = `${actionEmoji[action] || '📋'} <b>Order ${action.toUpperCase()}</b>\n\n`;
    
    message += `📦 <b>Order Number:</b> ${order.orderNumber}\n`;
    message += `${statusEmoji[order.status] || '📌'} <b>Status:</b> ${order.status}\n\n`;

    // Customer info
    if (order.customer) {
      message += `👤 <b>Customer:</b> ${order.customer.name || 'N/A'}\n`;
      if (order.customer.phone) {
        message += `📞 <b>Phone:</b> ${order.customer.phone}\n`;
      }
      message += `\n`;
    }

    // Items summary
    message += `🛒 <b>Items:</b> ${order.items.length} item(s)\n`;
    message += `💰 <b>Total:</b> $${Number(order.total || 0).toFixed(2)}\n`;

    // Payment info
    if (order.paymentStatus) {
      message += `💳 <b>Payment:</b> ${order.paymentStatus}\n`;
    }

    // Notes
    if (order.notes) {
      message += `\n📝 <b>Notes:</b> ${order.notes}\n`;
    }

    // Timestamp
    message += `\n🕐 ${new Date(order.createdAt).toLocaleString()}\n`;

    message += `\n━━━━━━━━━━━━━━━━━━━━`;

    return message;
  }

  /**
   * Send order receipt to Telegram
   */
  async sendReceipt(order) {
    const receipt = this.formatReceipt(order);
    return await this.sendMessage(receipt);
  }

  /**
   * Send order created notification with receipt option
   */
  async notifyOrderCreated(order, sendFullReceipt = true) {
    if (sendFullReceipt) {
      return await this.sendReceipt(order);
    } else {
      const message = this.formatOrderMessage(order, 'created');
      return await this.sendMessage(message);
    }
  }

  /**
   * Send order updated notification
   */
  async notifyOrderUpdated(order) {
    const message = this.formatOrderMessage(order, 'updated');
    return await this.sendMessage(message);
  }

  /**
   * Send order deleted notification
   */
  async notifyOrderDeleted(order) {
    const message = this.formatOrderMessage(order, 'deleted');
    return await this.sendMessage(message);
  }

  /**
   * Send order status changed notification
   */
  async notifyOrderStatusChanged(order, oldStatus, newStatus) {
    let message = `🔄 <b>Order Status Changed</b>\n\n`;
    message += `📦 <b>Order Number:</b> ${order.orderNumber}\n`;
    message += `📊 <b>Status:</b> ${oldStatus} → ${newStatus}\n\n`;
    
    if (order.customer) {
      message += `👤 <b>Customer:</b> ${order.customer.name || 'N/A'}\n`;
    }
    
    message += `💰 <b>Total:</b> $${Number(order.total || 0).toFixed(2)}\n`;
    message += `\n🕐 ${new Date().toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    return await this.sendMessage(message);
  }

  /**
   * Send payment confirmation receipt
   */
  async sendPaymentReceipt(order) {
    let receipt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    receipt += `      💳 <b>PAYMENT RECEIPT</b> 💳\n`;
    receipt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    receipt += `✅ <b>PAYMENT SUCCESSFUL</b>\n\n`;
    receipt += `📦 <b>Order #:</b> ${order.orderNumber}\n`;
    receipt += `📅 <b>Date:</b> ${new Date().toLocaleString()}\n\n`;
    
    if (order.customer) {
      receipt += `👤 <b>Customer:</b> ${order.customer.name}\n`;
      if (order.customer.phone) {
        receipt += `📞 <b>Phone:</b> ${order.customer.phone}\n`;
      }
      receipt += `\n`;
    }
    
    receipt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    receipt += `💰 <b>Amount Paid:</b> $${Number(order.paidAmount || order.total).toFixed(2)}\n`;
    if (order.paymentMethod) {
      receipt += `💳 <b>Method:</b> ${order.paymentMethod}\n`;
    }
    if (order.changeAmount && order.changeAmount > 0) {
      receipt += `💸 <b>Change:</b> $${Number(order.changeAmount).toFixed(2)}\n`;
    }
    
    receipt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    receipt += `\n       ✨ Thank you! ✨\n`;
    receipt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    return await this.sendMessage(receipt);
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(stats) {
    let message = `📊 <b>Daily Order Summary</b>\n\n`;
    message += `📅 <b>Date:</b> ${new Date().toLocaleDateString()}\n\n`;
    
    message += `📦 <b>Total Orders:</b> ${stats.totalOrders}\n`;
    message += `✅ <b>Paid:</b> ${stats.paidOrders}\n`;
    message += `⏳ <b>Pending:</b> ${stats.pendingOrders}\n`;
    message += `❌ <b>Cancelled:</b> ${stats.cancelledOrders}\n\n`;
    
    message += `💰 <b>Total Revenue:</b> $${Number(stats.totalRevenue || 0).toFixed(2)}\n`;
    message += `💵 <b>Average Order:</b> $${Number(stats.averageOrder || 0).toFixed(2)}\n`;
    
    message += `\n━━━━━━━━━━━━━━━━━━━━`;

    return await this.sendMessage(message);
  }

  /**
   * Send low stock alert
   */
  async sendLowStockAlert(product) {
    let message = `⚠️ <b>LOW STOCK ALERT</b>\n\n`;
    message += `📦 <b>Product:</b> ${product.name}\n`;
    message += `📊 <b>Current Stock:</b> ${product.stock}\n`;
    message += `⚡ <b>Status:</b> ${product.stock === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}\n`;
    message += `💰 <b>Price:</b> $${Number(product.price || 0).toFixed(2)}\n`;
    message += `\n🕐 ${new Date().toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    return await this.sendMessage(message);
  }

  /**
   * Send order with product images
   */
  async sendOrderWithImages(order) {
    // First send the receipt
    await this.sendReceipt(order);

    // Then send product images if available
    const productsWithImages = order.items.filter(item => 
      item.product?.image && fs.existsSync(item.product.image)
    );

    if (productsWithImages.length > 0) {
      for (const item of productsWithImages) {
        const caption = `📦 ${item.product.name}\nQty: ${item.qty} × $${Number(item.price).toFixed(2)}`;
        await this.sendImage(item.product.image, caption);
      }
    }
  }
}

// Export singleton instance
module.exports = new TelegramService();