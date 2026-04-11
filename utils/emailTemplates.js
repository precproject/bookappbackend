const STORE_NAME = process.env.STORE_NAME || 'SahakarStree';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@sahakarstree.in';

// =========================================================
// MASTER LAYOUT WRAPPER (Shopify / Amazon Tier Design)
// =========================================================
const emailLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; line-height: 100%; text-decoration: none; -ms-interpolation-mode: bicubic; }
    p { margin: 0 0 16px 0; }
    a { color: #ea580c; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background-color: #0f172a; padding: 32px 40px; text-align: center; }
    .content { padding: 40px; color: #334155; line-height: 1.6; font-size: 16px; }
    .footer { background-color: #f8fafc; padding: 32px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer-links { margin: 16px 0; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .footer-links a { color: #64748b; font-size: 12px; margin: 0 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .btn { display: inline-block; padding: 14px 32px; background-color: #ea580c; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; text-align: center; }
    @media screen and (max-width: 600px) {
      .container { margin-top: 0; margin-bottom: 0; border-radius: 0; }
      .header, .content, .footer { padding: 24px 20px; }
      h1 { font-size: 24px !important; }
      h2 { font-size: 20px !important; }
    }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f4f4f5;">
    <tr>
      <td align="center">
        <table class="container" cellpadding="0" cellspacing="0" role="presentation">
          
          <tr>
            <td class="header">
              <a href="${FRONTEND_URL}" style="text-decoration: none;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">${STORE_NAME}</h1>
              </a>
            </td>
          </tr>
          
          <tr>
            <td class="content">
              ${content}
            </td>
          </tr>
          
          <tr>
            <td class="footer">
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; font-weight: 500;">Need help with your order?</p>
              <p style="margin: 0; color: #64748b; font-size: 13px;">Reply to this email or contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
              
              <div class="footer-links">
                <a href="${FRONTEND_URL}/store">Shop</a>
                <a href="${FRONTEND_URL}/contact">Contact</a>
                <a href="${FRONTEND_URL}/privacy-policy">Privacy</a>
                <a href="${FRONTEND_URL}/terms-of-service">Terms</a>
                <a href="${FRONTEND_URL}/refund-policy">Refunds</a>
              </div>
              
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">This email was sent to you because you are registered at ${STORE_NAME}.</p>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">&copy; ${new Date().getFullYear()} ${STORE_NAME}. All rights reserved.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// --- UI HELPERS ---
const tableHeaderStyle = `padding: 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; text-align: left; font-weight: 700;`;
const tableCellStyle = `padding: 16px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 15px;`;


// =========================================================
// 1. WELCOME EMAIL
// =========================================================
exports.welcomeEmail = (name) => emailLayout(`
  <h2 style="color: #0f172a; margin-top: 0; font-size: 24px;">Welcome to ${STORE_NAME}! 🎉</h2>
  <p>Hi <strong>${name}</strong>,</p>
  <p>We are absolutely thrilled to have you join our community. Your account has been successfully created.</p>
  <p>You can now explore our premium collection, manage your addresses, use exclusive referral codes, and track your orders seamlessly from your personal dashboard.</p>
  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/store" class="btn">Explore the Store</a>
  </div>
  <p style="margin-top: 20px; margin-bottom: 0;">Happy Reading,<br><strong>The ${STORE_NAME} Team</strong></p>
`);


// =========================================================
// 2. PRE-BOOK / WAITLIST EMAIL
// =========================================================
exports.prebookEmail = (userName, storeName = STORE_NAME) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #ea580c; margin: 0; font-size: 26px;">You're on the Waitlist! ⏳</h2>
  </div>
  
  <p>Hi <strong>${userName}</strong>,</p>
  <p>Thank you for your interest! You are officially on the exclusive pre-book waitlist for <strong>${storeName}</strong>.</p>
  
  <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
    <p style="margin: 0; color: #9a3412; font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">What happens next?</p>
    <p style="margin: 8px 0 0 0; color: #c2410c; font-size: 15px;">We will notify you the exact moment the book becomes available for purchase so you can grab your copy before stock runs out.</p>
  </div>

  <p style="margin-bottom: 0;">Stay tuned for exciting updates. We can't wait to share this with you!</p>
`);


// =========================================================
// 3. ORDER PLACED (PENDING PAYMENT) EMAIL
// =========================================================
exports.orderPlacedEmail = (order, userName) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="display: inline-block; background-color: #fff7ed; color: #ea580c; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #fed7aa; margin-bottom: 16px;">Action Required</div>
    <h2 style="color: #0f172a; margin: 0; font-size: 24px;">Complete Your Purchase</h2>
  </div>
  
  <p>Hi <strong>${userName}</strong>,</p>
  <p>Your order <strong>#${order.orderId}</strong> has been successfully initiated. To secure your items and complete the purchase, please finalize your payment.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
    <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Total Due</p>
    <p style="margin: 8px 0 0 0; color: #0f172a; font-size: 36px; font-weight: 900;">₹${order.priceBreakup.total}</p>
  </div>

  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/payment-status/${order.orderId}" class="btn">Pay Securely Now</a>
  </div>
  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: 16px; margin-bottom: 0;">If you have already paid, please ignore this email. Your status will update shortly.</p>
`);


// =========================================================
// 4. PAYMENT SUCCESS / RECEIPT EMAIL
// =========================================================
exports.paymentSuccessEmail = (order, userName) => {
  // Check if item is an object (new structure) or string (old structure) to safely extract name
  const itemsHtml = order.items.map(item => {
    const itemName = typeof item.name === 'object' ? (item.name.en || item.name.mr || 'Book') : item.name;
    return `
      <tr>
        <td style="${tableCellStyle} font-weight: 600;">${itemName}</td>
        <td style="${tableCellStyle} text-align: center; color: #64748b;">x${item.qty}</td>
        <td style="${tableCellStyle} text-align: right; font-weight: 600;">₹${item.price * item.qty}</td>
      </tr>
    `;
  }).join('');

  return emailLayout(`
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background-color: #ecfdf5; color: #059669; padding: 12px; border-radius: 50%; margin-bottom: 16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h2 style="color: #0f172a; margin: 0; font-size: 26px;">Payment Successful!</h2>
      <p style="color: #64748b; font-size: 15px; margin-top: 8px;">Order #${order.orderId}</p>
    </div>

    <p>Hi <strong>${userName}</strong>,</p>
    <p>Thank you for your purchase! We have received your payment securely and are now preparing your order for fulfillment.</p>
    
    <div style="margin-top: 40px; margin-bottom: 30px;">
      <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 18px;">Order Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="${tableHeaderStyle} width: 60%;">Item</th>
            <th style="${tableHeaderStyle} text-align: center; width: 15%;">Qty</th>
            <th style="${tableHeaderStyle} text-align: right; width: 25%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <div style="width: 100%; max-width: 320px; margin-left: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Subtotal</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #334155;">₹${order.priceBreakup.subtotal}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Shipping</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #334155;">₹${order.priceBreakup.shipping}</td>
        </tr>
        ${order.priceBreakup.taxAmount ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Taxes (GST)</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #334155;">₹${order.priceBreakup.taxAmount}</td>
        </tr>` : ''}
        ${order.priceBreakup.discountAmount > 0 ? `
        <tr>
          <td style="padding: 6px 0; color: #16a34a;">Discount</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #16a34a;">-₹${order.priceBreakup.discountAmount}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 16px 0 0 0; color: #0f172a; font-weight: 800; font-size: 18px; border-top: 2px solid #e2e8f0; margin-top: 8px;">Total Paid</td>
          <td style="padding: 16px 0 0 0; text-align: right; font-weight: 900; font-size: 20px; color: #ea580c; border-top: 2px solid #e2e8f0; margin-top: 8px;">₹${order.priceBreakup.total}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 40px;">
      <a href="${FRONTEND_URL}/dashboard" class="btn" style="background-color: #0f172a;">View Dashboard</a>
    </div>
  `);
};


// =========================================================
// 5. ORDER DISPATCHED EMAIL
// =========================================================
exports.orderDispatchedEmail = (orderId, trackingId, partner) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="font-size: 40px; margin-bottom: 10px;">🚚</div>
    <h2 style="color: #0f172a; margin: 0; font-size: 26px;">Your Order is on the way!</h2>
    <p style="color: #64748b; margin-top: 8px; font-size: 15px;">Order #${orderId}</p>
  </div>
  
  <p>Great news! Your package has been securely packed, handed over to our delivery partner, and is currently making its way to you.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0;">
    <p style="margin: 0 0 16px 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Tracking Details</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #475569; font-size: 15px;">Logistics Partner:</td>
        <td style="padding: 8px 0; color: #0f172a; text-align: right; font-weight: 700; font-size: 15px;">${partner}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #475569; font-size: 15px; border-top: 1px solid #e2e8f0;">Tracking Number:</td>
        <td style="padding: 8px 0; color: #ea580c; text-align: right; font-weight: 800; font-size: 16px; border-top: 1px solid #e2e8f0;">${trackingId}</td>
      </tr>
    </table>
  </div>

  <p>You can track the live status of your package directly on the ${partner} website or through your customer dashboard.</p>
  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/dashboard" class="btn">Track Package</a>
  </div>
`);


// =========================================================
// 6. DELIVERY SUCCESS EMAIL
// =========================================================
exports.deliverySuccessEmail = (orderId) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="font-size: 40px; margin-bottom: 10px;">📦</div>
    <h2 style="color: #059669; margin: 0; font-size: 26px;">Package Delivered!</h2>
    <p style="color: #64748b; margin-top: 8px; font-size: 15px;">Order #${orderId}</p>
  </div>

  <p>Your order has been successfully delivered. We hope you are absolutely thrilled with your purchase and your reading experience.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0; text-align: center;">
    <p style="margin: 0 0 8px 0; color: #0f172a; font-weight: 700; font-size: 16px;">How was your experience?</p>
    <p style="margin: 0; color: #64748b; font-size: 14px;">If you have a moment, we would love to hear your thoughts. Your reviews help other readers make great choices.</p>
  </div>
  
  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/dashboard" class="btn">Write a Review</a>
  </div>

  <p style="margin-top: 30px; margin-bottom: 0; font-size: 14px; color: #64748b; text-align: center;">If you experienced any issues with your delivery or the product, please reply directly to this email so we can make it right.</p>
`);


// =========================================================
// 7. PAYMENT REMINDER EMAIL
// =========================================================
exports.paymentReminderEmail = (orderId, total) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="font-size: 40px; margin-bottom: 10px;">⏳</div>
    <h2 style="color: #0f172a; margin: 0; font-size: 26px;">Don't miss out!</h2>
  </div>

  <p>Hi there,</p>
  <p>We noticed you left something behind! Your order <strong>#${orderId}</strong> is still waiting for payment.</p>
  
  <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
    <p style="margin: 0; color: #9a3412; font-size: 15px;">Pending Amount</p>
    <p style="margin: 4px 0 0 0; color: #c2410c; font-size: 24px; font-weight: 900;">₹${total}</p>
  </div>

  <p>Our inventory is limited and stock moves fast. To secure your items before they are sold out to someone else, please complete your checkout process as soon as possible.</p>
  
  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/payment-status/${orderId}" class="btn">Complete Purchase Now</a>
  </div>
`);