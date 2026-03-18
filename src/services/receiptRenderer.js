// services/receiptRenderer.js
// Renders a cart snapshot as a JPG image using Puppeteer,
// then sends it to Telegram as a photo.
//
// Install once:  npm install puppeteer
//
const puppeteer      = require('puppeteer');
const path           = require('path');
const fs             = require('fs');
const telegramService = require('./telegramService');

const CATEGORY_ICONS = {
  Coffee: '☕', Tea: '🍵', Drink: '🥤', Food: '🍽️', Dessert: '🍰'
};

function icon(cat) { return CATEGORY_ICONS[cat] || '📦'; }

// ─────────────────────────────────────────────────────────────
// Build the receipt HTML (self-contained, no external fonts)
// ─────────────────────────────────────────────────────────────
function buildReceiptHtml(snapshot) {
  const {
    cartNumber, createdAt, customer, items,
    subtotal, tax, taxRate, total,
    itemCount, productCount, notes
  } = snapshot;

  const dateStr = new Date(createdAt).toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const itemRows = items.map(item => `
    <div class="item-row">
      <div class="item-left">
        <span class="item-icon">${icon(item.category)}</span>
        <div>
          <div class="item-name">${item.productName}</div>
          <div class="item-qty">${item.quantity} × $${item.price.toFixed(2)}</div>
        </div>
      </div>
      <div class="item-total">$${item.itemTotal.toFixed(2)}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Courier New', Courier, monospace;
    background: #f5f0eb;
    display: flex;
    justify-content: center;
    padding: 24px;
  }

  .receipt {
    background: #fff;
    width: 380px;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    overflow: hidden;
  }

  /* ── Header ─────────────────────── */
  .header {
    background: linear-gradient(135deg, #1c1917 0%, #44403c 100%);
    color: #fff;
    padding: 28px 24px 20px;
    text-align: center;
  }
  .header-icon { font-size: 32px; margin-bottom: 4px; }
  .header-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .header-sub {
    font-size: 10px;
    letter-spacing: 2px;
    color: #a8a29e;
    text-transform: uppercase;
    margin-top: 2px;
  }

  /* ── Dashed divider ──────────────── */
  .dash {
    border: none;
    border-top: 2px dashed #e7e5e4;
    margin: 0;
  }

  /* ── Meta rows ───────────────────── */
  .meta { padding: 16px 24px; }
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin-bottom: 5px;
    color: #57534e;
  }
  .meta-row .label { color: #a8a29e; }
  .meta-row .value { font-weight: 600; color: #1c1917; text-align: right; max-width: 220px; }

  /* ── Items section ───────────────── */
  .items-header {
    background: #fafaf9;
    padding: 8px 24px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #a8a29e;
  }

  .items { padding: 12px 24px; }

  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .item-row:last-child { margin-bottom: 0; }

  .item-left {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }
  .item-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
  .item-name { font-size: 13px; font-weight: 600; color: #1c1917; }
  .item-qty  { font-size: 11px; color: #a8a29e; margin-top: 2px; }
  .item-total { font-size: 13px; font-weight: 700; color: #1c1917; white-space: nowrap; }

  /* ── Totals ──────────────────────── */
  .totals { padding: 12px 24px 0; }
  .total-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #57534e;
    margin-bottom: 6px;
  }
  .total-row .free { color: #16a34a; font-weight: 600; }

  .grand-total-row {
    display: flex;
    justify-content: space-between;
    padding: 12px 0 0;
    margin-top: 4px;
    border-top: 2px solid #1c1917;
  }
  .grand-label { font-size: 15px; font-weight: 700; color: #1c1917; letter-spacing: 1px; }
  .grand-value { font-size: 22px; font-weight: 700; color: #16a34a; }

  /* ── Notes ───────────────────────── */
  .notes {
    margin: 14px 24px 0;
    background: #fafaf9;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    color: #57534e;
  }
  .notes strong { color: #1c1917; }

  /* ── Footer ──────────────────────── */
  .footer {
    padding: 20px 24px;
    text-align: center;
  }
  .footer-counts {
    font-size: 10px;
    color: #a8a29e;
    margin-bottom: 8px;
  }
  .footer-thanks {
    font-size: 13px;
    color: #57534e;
  }

  /* ── Cart number watermark ────────── */
  .cart-number-bar {
    background: #fafaf9;
    border-top: 1px solid #e7e5e4;
    padding: 8px 24px;
    font-size: 9px;
    letter-spacing: 1px;
    color: #a8a29e;
    text-align: center;
    font-family: 'Courier New', monospace;
  }
</style>
</head>
<body>
<div class="receipt">

  <!-- Header -->
  <div class="header">
    <div class="header-icon">☕</div>
    <div class="header-title">Café Manager</div>
    <div class="header-sub">Cart Receipt</div>
  </div>

  <!-- Meta -->
  <div class="meta">
    <div class="meta-row">
      <span class="label">Cart #</span>
      <span class="value">${cartNumber}</span>
    </div>
    <div class="meta-row">
      <span class="label">Date</span>
      <span class="value">${dateStr}</span>
    </div>
    <div class="meta-row">
      <span class="label">Customer</span>
      <span class="value">${customer?.name || 'Guest Customer'}</span>
    </div>
    ${customer?.phone ? `
    <div class="meta-row">
      <span class="label">Phone</span>
      <span class="value">${customer.phone}</span>
    </div>` : ''}
  </div>

  <hr class="dash">

  <!-- Items -->
  <div class="items-header">
    Items &nbsp;·&nbsp; ${itemCount} unit${itemCount !== 1 ? 's' : ''} &nbsp;·&nbsp; ${productCount} type${productCount !== 1 ? 's' : ''}
  </div>
  <div class="items">${itemRows}</div>

  <hr class="dash">

  <!-- Totals -->
  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>$${Number(subtotal).toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Tax (${((taxRate || 0.1) * 100).toFixed(0)}%)</span>
      <span>$${Number(tax).toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Shipping</span>
      <span class="free">Free</span>
    </div>
    <div class="grand-total-row">
      <span class="grand-label">TOTAL</span>
      <span class="grand-value">$${Number(total).toFixed(2)}</span>
    </div>
  </div>

  ${notes ? `<div class="notes"><strong>Notes:</strong> ${notes}</div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-counts">${itemCount} unit${itemCount !== 1 ? 's' : ''} &nbsp;·&nbsp; ${productCount} product type${productCount !== 1 ? 's' : ''}</div>
    <div class="footer-thanks">✨ &nbsp;Thank you for your order!&nbsp; ✨</div>
  </div>

  <div class="cart-number-bar">${cartNumber}</div>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// Render receipt HTML → JPG buffer using Puppeteer
// ─────────────────────────────────────────────────────────────
async function renderReceiptToJpg(snapshot) {
  const html    = buildReceiptHtml(snapshot);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Find the receipt card and screenshot just that element
    const element = await page.$('.receipt');
    const jpgBuffer = await element.screenshot({
      type:    'jpeg',
      quality: 92,
      omitBackground: false
    });

    return jpgBuffer;
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────
// Save JPG buffer to a temp file, return the file path
// ─────────────────────────────────────────────────────────────
function saveJpgToTemp(buffer, cartNumber) {
  const tmpDir  = path.join(__dirname, '../../tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const fileName = `receipt-${cartNumber}-${Date.now()}.jpg`;
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// ─────────────────────────────────────────────────────────────
// Main: render receipt → JPG file → send to Telegram as photo
// ─────────────────────────────────────────────────────────────
async function sendReceiptImageToTelegram(snapshot) {
  let filePath = null;

  try {
    console.log(`📸 Rendering receipt image for ${snapshot.cartNumber}…`);
    const buffer = await renderReceiptToJpg(snapshot);
    filePath     = saveJpgToTemp(buffer, snapshot.cartNumber);

    const caption = `🧾 <b>Cart Receipt</b>\n<code>${snapshot.cartNumber}</code>\n💰 Total: <b>$${Number(snapshot.total).toFixed(2)}</b>`;
    const result  = await telegramService.sendImage(filePath, caption);

    console.log(`✅ Receipt image sent to Telegram for ${snapshot.cartNumber}`);
    return { success: result.success, filePath, buffer };

  } catch (err) {
    console.error('❌ Receipt render/send error:', err.message);
    return { success: false, error: err.message };
  } finally {
    // Clean up temp file
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Download-only: return JPG buffer to HTTP response
// ─────────────────────────────────────────────────────────────
async function getReceiptJpgBuffer(snapshot) {
  return await renderReceiptToJpg(snapshot);
}

module.exports = {
  sendReceiptImageToTelegram,
  getReceiptJpgBuffer,
  buildReceiptHtml   // exported so you can preview in browser if needed
};