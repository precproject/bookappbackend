const STORE_NAME = process.env.STORE_NAME || 'SahakarStree';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// =========================================================
// MASTER LAYOUT WRAPPER (Standard E-commerce Design)
// =========================================================
const emailLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="background-color: #f4f4f5; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
      
      <div style="background-color: #0f172a; padding: 32px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">${STORE_NAME}</h1>
      </div>
      
      <div style="padding: 40px 32px; color: #334155; line-height: 1.6; font-size: 16px;">
        ${content}
      </div>
      
      <div style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #64748b; font-size: 13px;">Need help with your order? Reply to this email or contact our support team.</p>
        <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">&copy; ${new Date().getFullYear()} ${STORE_NAME}. All rights reserved.</p>
        <a href="${FRONTEND_URL}" style="color: #ea580c; text-decoration: none; font-size: 12px; font-weight: bold; display: inline-block; margin-top: 8px;">Visit Store</a>
      </div>
      
    </div>
  </div>
</body>
</html>
`;

// --- UI HELPERS ---
const buttonStyle = `display: inline-block; padding: 14px 28px; background-color: #ea580c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin-top: 10px; text-align: center;`;
const tableHeaderStyle = `padding: 12px; background-color: #f8fafc; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; text-align: left;`;
const tableCellStyle = `padding: 16px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 15px;`;

// =========================================================
// 1. WELCOME EMAIL
// =========================================================
exports.welcomeEmail = (name) => emailLayout(`
  <h2 style="color: #0f172a; margin-top: 0; font-size: 24px;">Welcome to ${STORE_NAME}! 🎉</h2>
  <p>Hi <strong>${name}</strong>,</p>
  <p>We are absolutely thrilled to have you join our community. Your account has been successfully created.</p>
  <p>You can now explore our premium collection, manage your addresses, use exclusive referral codes, and track your orders seamlessly from your dashboard.</p>
  <div style="text-align: center; margin: 35px 0;">
    <a href="${FRONTEND_URL}/store" style="${buttonStyle}">Explore the Collection</a>
  </div>
  <p style="margin-bottom: 0;">Happy Reading,<br><strong>The ${STORE_NAME} Team</strong></p>
`);

// =========================================================
// 2. ORDER PLACED (PENDING PAYMENT) EMAIL
// =========================================================
exports.orderPlacedEmail = (order, userName) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="display: inline-block; background-color: #fff7ed; color: #ea580c; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; border: 1px solid #fed7aa;">Action Required</div>
  </div>
  <h2 style="color: #0f172a; margin-top: 0; text-align: center;">Complete Your Purchase</h2>
  <p>Hi <strong>${userName}</strong>,</p>
  <p>Your order <strong>#${order.orderId}</strong> has been successfully initiated. To secure your items and complete the purchase, please finalize your payment.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
    <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; font-weight: bold;">Total Due</p>
    <p style="margin: 5px 0 0 0; color: #0f172a; font-size: 32px; font-weight: 900;">₹${order.priceBreakup.total}</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${FRONTEND_URL}/payment-status/${order.orderId}" style="${buttonStyle}">Pay Securely Now</a>
  </div>
  <p style="font-size: 14px; color: #64748b;">If you have already paid, please ignore this email. Your status will update shortly.</p>
`);

// =========================================================
// 3. PAYMENT SUCCESS / RECEIPT EMAIL
// =========================================================
exports.paymentSuccessEmail = (order, userName) => {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="${tableCellStyle} font-weight: 600;">${item.name}</td>
      <td style="${tableCellStyle} text-align: center;">${item.qty}</td>
      <td style="${tableCellStyle} text-align: right; font-weight: 600;">₹${item.price * item.qty}</td>
    </tr>
  `).join('');

  return emailLayout(`
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background-color: #ecfdf5; color: #059669; padding: 12px; border-radius: 50%; margin-bottom: 10px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h2 style="color: #0f172a; margin: 0; font-size: 26px;">Payment Successful!</h2>
      <p style="color: #64748b; margin-top: 5px;">Order #${order.orderId}</p>
    </div>

    <p>Hi <strong>${userName}</strong>,</p>
    <p>Thank you for your purchase! We have received your payment and are now preparing your order for shipment.</p>
    
    <h3 style="color: #0f172a; margin-top: 35px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Order Summary</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr>
          <th style="${tableHeaderStyle}">Item</th>
          <th style="${tableHeaderStyle} text-align: center;">Qty</th>
          <th style="${tableHeaderStyle} text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div style="width: 100%; max-width: 300px; margin-left: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Subtotal</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">₹${order.priceBreakup.subtotal}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Shipping</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">₹${order.priceBreakup.shipping}</td>
        </tr>
        ${order.priceBreakup.taxAmount ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Taxes (GST)</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">₹${order.priceBreakup.taxAmount}</td>
        </tr>` : ''}
        ${order.priceBreakup.discountAmount > 0 ? `
        <tr>
          <td style="padding: 8px 0; color: #16a34a;">Discount</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #16a34a;">-₹${Math.abs(order.priceBreakup.discountAmount)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 16px 0 8px 0; color: #0f172a; font-weight: 800; font-size: 18px; border-top: 2px solid #e2e8f0;">Total Paid</td>
          <td style="padding: 16px 0 8px 0; text-align: right; font-weight: 800; font-size: 18px; color: #ea580c; border-top: 2px solid #e2e8f0;">₹${order.priceBreakup.total}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 40px;">
      <a href="${FRONTEND_URL}/dashboard" style="${buttonStyle}; background-color: #0f172a;">View Dashboard</a>
    </div>
  `);
};

// =========================================================
// 4. ORDER DISPATCHED EMAIL
// =========================================================
exports.orderDispatchedEmail = (orderId, trackingId, partner) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #0f172a; margin: 0; font-size: 26px;">Your Order is on the way! 🚚</h2>
    <p style="color: #64748b; margin-top: 5px;">Order #${orderId}</p>
  </div>
  
  <p>Great news! Your package has been handed over to our delivery partner and is currently making its way to you.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 30px 0;">
    <p style="margin: 0 0 10px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: bold;">Tracking Details</p>
    <table style="width: 100%;">
      <tr>
        <td style="padding-bottom: 10px; color: #334155;"><strong>Logistics Partner:</strong></td>
        <td style="padding-bottom: 10px; color: #0f172a; text-align: right; font-weight: 600;">${partner}</td>
      </tr>
      <tr>
        <td style="color: #334155;"><strong>Tracking Number:</strong></td>
        <td style="color: #ea580c; text-align: right; font-weight: 800; letter-spacing: 1px;">${trackingId}</td>
      </tr>
    </table>
  </div>

  <p>You can track the live status of your package directly on the ${partner} website or through your customer dashboard.</p>
  <div style="text-align: center; margin-top: 30px;">
    <a href="${FRONTEND_URL}/dashboard" style="${buttonStyle}">Track Order</a>
  </div>
`);

// =========================================================
// 5. DELIVERY SUCCESS EMAIL
// =========================================================
exports.deliverySuccessEmail = (orderId) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #059669; margin: 0; font-size: 26px;">Package Delivered! 🎁</h2>
    <p style="color: #64748b; margin-top: 5px;">Order #${orderId}</p>
  </div>

  <p>Your order has been successfully delivered. We hope you are absolutely thrilled with your purchase!</p>
  <p>If you have a moment, we would love to hear your thoughts. Your reviews help other readers make great choices.</p>
  
  <div style="text-align: center; margin: 35px 0;">
    <a href="${FRONTEND_URL}/dashboard" style="${buttonStyle}">Review Your Items</a>
  </div>

  <p style="margin-bottom: 0;">If you experienced any issues with your delivery, please reply to this email so we can make it right.</p>
`);

// =========================================================
// 6. PAYMENT REMINDER EMAIL
// =========================================================
exports.paymentReminderEmail = (orderId, total) => emailLayout(`
  <h2 style="color: #0f172a; margin-top: 0;">Don't miss out! ⏳</h2>
  <p>Hi there,</p>
  <p>We noticed you left something behind! Your order <strong>#${orderId}</strong> is still waiting for payment.</p>
  
  <div style="background-color: #f8fafc; border-left: 4px solid #ea580c; padding: 15px 20px; margin: 25px 0;">
    <p style="margin: 0; color: #334155; font-size: 18px;">Pending Amount: <strong style="color: #ea580c;">₹${total}</strong></p>
  </div>

  <p>Stock is moving fast. To secure your items before they are sold out to someone else, please complete your checkout process as soon as possible.</p>
  
  <div style="text-align: center; margin: 35px 0;">
    <a href="${FRONTEND_URL}/payment-status/${orderId}" style="${buttonStyle}">Complete Payment Now</a>
  </div>
`);