// services/receiptRenderer.js
const path            = require('path');
const fs              = require('fs');
const telegramService = require('./telegramService');

let puppeteer, chromiumArgs, executablePath, headless;

try {
  const chromium = require('@sparticuz/chromium');
  puppeteer      = require('puppeteer-core');
  chromiumArgs   = chromium.args;
  executablePath = chromium.executablePath;
  headless       = chromium.headless;
  console.log('✅ Using @sparticuz/chromium (production mode)');
} catch {
  puppeteer      = require('puppeteer');
  chromiumArgs   = ['--no-sandbox', '--disable-setuid-sandbox'];
  executablePath = null;
  headless       = true;
  console.log('✅ Using local puppeteer (development mode)');
}

const CATEGORY_ICONS = {
  Coffee: '☕', Tea: '🍵', Drink: '🥤', Food: '🍽️', Dessert: '🍰'
};
function icon(cat) { return CATEGORY_ICONS[cat] || '📦'; }

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

  const itemRows = items.map((item, i) => `
    <div class="item-row ${i % 2 === 0 ? 'even' : 'odd'}">
      <div class="item-left">
        <div class="item-icon-wrap">${icon(item.category)}</div>
        <div class="item-info">
          <div class="item-name">${item.productName}</div>
          <div class="item-qty">${item.quantity} unit${item.quantity !== 1 ? 's' : ''} &times; $${Number(item.price).toFixed(2)}</div>
        </div>
      </div>
      <div class="item-total">$${Number(item.itemTotal).toFixed(2)}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    justify-content: center;
    padding: 32px 20px;
  }

  .card {
    background: #ffffff;
    width: 420px;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    overflow: hidden;
  }

  /* Header */
  .header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    padding: 32px 28px 36px;
    text-align: center;
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -1px; left: 0; right: 0;
    height: 20px;
    background: #fff;
    border-radius: 20px 20px 0 0;
  }
  .cafe-emoji { font-size: 44px; display: block; margin-bottom: 8px; }
  .cafe-name  { font-size: 24px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; color: #fff; }
  .cafe-sub   { font-size: 11px; letter-spacing: 3px; color: #8892b0; text-transform: uppercase; margin-top: 4px; }
  .cart-badge {
    display: inline-block;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff; font-size: 10px; font-weight: 700;
    letter-spacing: 1px; padding: 5px 16px;
    border-radius: 20px; margin-top: 14px;
  }

  /* Meta */
  .meta { padding: 20px 28px 16px; border-bottom: 1px solid #f1f5f9; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .meta-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
  .meta-value { font-size: 12px; font-weight: 700; color: #1e293b; }

  /* Items header */
  .items-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 28px 8px;
    background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  }
  .items-title { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #64748b; }
  .items-count { font-size: 10px; font-weight: 700; background: #e0e7ff; color: #4338ca; padding: 3px 12px; border-radius: 10px; }

  /* Items */
  .items { padding: 6px 0; }
  .item-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 28px; }
  .item-row.even { background: #fff; }
  .item-row.odd  { background: #f8fafc; }
  .item-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
  .item-icon-wrap {
    width: 38px; height: 38px; border-radius: 12px;
    background: linear-gradient(135deg, #eef2ff, #e0e7ff);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; flex-shrink: 0;
  }
  .item-name { font-size: 13px; font-weight: 700; color: #1e293b; }
  .item-qty  { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .item-total { font-size: 15px; font-weight: 800; color: #4338ca; white-space: nowrap; margin-left: 8px; }

  /* Divider */
  .divider { margin: 6px 28px; border: none; border-top: 1px dashed #e2e8f0; }

  /* Totals */
  .totals { padding: 14px 28px 4px; }
  .total-row { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 8px; }
  .total-row .val  { font-weight: 700; color: #334155; }
  .total-row .free { color: #16a34a; font-weight: 700; }

  /* Grand total */
  .grand-total {
    margin: 14px 28px 16px;
    background: linear-gradient(135deg, #1a1a2e, #0f3460);
    border-radius: 18px; padding: 18px 22px;
    display: flex; justify-content: space-between; align-items: center;
    box-shadow: 0 8px 24px rgba(15,52,96,0.4);
  }
  .grand-label { font-size: 12px; font-weight: 700; color: #8892b0; letter-spacing: 2px; text-transform: uppercase; }
  .grand-value { font-size: 28px; font-weight: 900; color: #4ade80; }

  /* Notes */
  .notes-box {
    margin: 0 28px 14px;
    background: #fffbeb; border: 1px solid #fde68a;
    border-radius: 12px; padding: 10px 14px;
    font-size: 11px; color: #92400e;
  }

  /* Footer */
  .footer { padding: 14px 28px 20px; text-align: center; border-top: 1px solid #f1f5f9; }
  .footer-stats  { font-size: 10px; color: #94a3b8; margin-bottom: 8px; }
  .footer-thanks { font-size: 16px; font-weight: 800; color: #667eea; }
  .footer-sub    { font-size: 10px; color: #94a3b8; margin-top: 4px; }

  /* Bottom bar */
  .bottom-bar {
    background: linear-gradient(135deg, #667eea, #764ba2);
    padding: 10px 28px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .bottom-bar-text { font-size: 9px; color: rgba(255,255,255,0.7); letter-spacing: 1px; text-transform: uppercase; }
  .bottom-bar-num  { font-size: 9px; color: #fff; font-weight: 700; }
</style>
</head>
<body>
<div class="card">

  <div class="header">
    <span class="cafe-emoji">☕</span>
    <div class="cafe-name">Café Manager</div>
    <div class="cafe-sub">Official Cart Receipt</div>
    <div class="cart-badge">${cartNumber}</div>
  </div>

  <div class="meta">
    <div class="meta-grid">
      <div>
        <div class="meta-label">📅 Date</div>
        <div class="meta-value">${dateStr}</div>
      </div>
      <div>
        <div class="meta-label">👤 Customer</div>
        <div class="meta-value">${customer?.name || 'Guest Customer'}</div>
      </div>
      ${customer?.phone ? `
      <div>
        <div class="meta-label">📞 Phone</div>
        <div class="meta-value">${customer.phone}</div>
      </div>` : ''}
      <div>
        <div class="meta-label">🛒 Total Units</div>
        <div class="meta-value">${itemCount} unit${itemCount !== 1 ? 's' : ''}</div>
      </div>
    </div>
  </div>

  <div class="items-header">
    <span class="items-title">Order Items</span>
    <span class="items-count">${productCount} type${productCount !== 1 ? 's' : ''}</span>
  </div>

  <div class="items">${itemRows}</div>

  <hr class="divider">

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span class="val">$${Number(subtotal).toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Tax (${((taxRate || 0.1) * 100).toFixed(0)}%)</span>
      <span class="val">$${Number(tax).toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Shipping</span>
      <span class="free">&#10003; Free</span>
    </div>
  </div>

  <div class="grand-total">
    <span class="grand-label">Grand Total</span>
    <span class="grand-value">$${Number(total).toFixed(2)}</span>
  </div>

  ${notes ? `<div class="notes-box">&#128203; <strong>Notes:</strong> ${notes}</div>` : ''}

  <div class="footer">
    <div class="footer-stats">${itemCount} unit${itemCount !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; ${productCount} type${productCount !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; Tax included</div>
    <div class="footer-thanks">&#10024; Thank you for your order! &#10024;</div>
    <div class="footer-sub">Please come again &#128591;</div>
  </div>

  <div class="bottom-bar">
    <span class="bottom-bar-text">Café Manager System</span>
    <span class="bottom-bar-num">${cartNumber}</span>
  </div>

</div>
</body>
</html>`;
}

async function renderReceiptToJpg(snapshot) {
  const html = buildReceiptHtml(snapshot);

  const exePath = executablePath
    ? (typeof executablePath === 'function' ? await executablePath() : await Promise.resolve(executablePath))
    : undefined;

  const launchOptions = {
    headless: headless ?? true,
    args: chromiumArgs || ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(exePath ? { executablePath: exePath } : {})
  };

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const element   = await page.$('.card');
    const jpgBuffer = await element.screenshot({ type: 'jpeg', quality: 95, omitBackground: false });
    return jpgBuffer;
  } finally {
    await browser.close();
  }
}

function saveJpgToTemp(buffer, cartNumber) {
  const tmpDir = path.join(__dirname, '../../tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `receipt-${cartNumber}-${Date.now()}.jpg`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function sendReceiptImageToTelegram(snapshot) {
  let filePath = null;
  try {
    console.log(`📸 Rendering receipt for ${snapshot.cartNumber}…`);
    const buffer = await renderReceiptToJpg(snapshot);
    filePath     = saveJpgToTemp(buffer, snapshot.cartNumber);

    // ✅ Image only — no separate text message
    const caption = `☕ <b>Café Manager</b>\n🧾 <code>${snapshot.cartNumber}</code>\n💰 Total: <b>$${Number(snapshot.total).toFixed(2)}</b>`;
    const result  = await telegramService.sendImage(filePath, caption);

    console.log(`✅ Receipt image sent for ${snapshot.cartNumber}`);
    return { success: result.success };
  } catch (err) {
    console.error('❌ Receipt render error:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
}

async function getReceiptJpgBuffer(snapshot) {
  return await renderReceiptToJpg(snapshot);
}

module.exports = { sendReceiptImageToTelegram, getReceiptJpgBuffer, buildReceiptHtml };