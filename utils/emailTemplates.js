const STORE_NAME = process.env.STORE_NAME || 'SahakarStree ';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const baseStyle = `font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;`;

exports.welcomeEmail = (name) => (`
  <div style="${baseStyle}">
    <h2 style="color: #4CAF50;">Welcome to ${STORE_NAME}, ${name}! 🎉</h2>
    <p>We are thrilled to have you on board. You can now explore our collection, use referral codes, and track your orders seamlessly.</p>
    <a href="${FRONTEND_URL}/store" style="display: inline-block; padding: 10px 20px; background: #4CAF50; color: #fff; text-decoration: none; border-radius: 5px;">Shop Now</a>
  </div>
`);

exports.orderPlacedEmail = (order, userName) => (`
  <div style="${baseStyle}">
    <h2>Order Initialized: #${order.orderId}</h2>
    <p>Hi ${userName},</p>
    <p>Your order has been created. Please complete your payment to confirm the order.</p>
    <p><strong>Total Amount:</strong> ₹${order.priceBreakup.total}</p>
    <a href="${FRONTEND_URL}/user/orders" style="display: inline-block; padding: 10px 20px; background: #FF9800; color: #fff; text-decoration: none; border-radius: 5px;">Complete Payment</a>
  </div>
`);

exports.paymentSuccessEmail = (order, userName) => {
  let itemsHtml = order.items.map(item => `<li>${item.name} (x${item.qty}) - ₹${item.price * item.qty}</li>`).join('');
  return (`
    <div style="${baseStyle}">
      <h2 style="color: #4CAF50;">Payment Successful! ✅</h2>
      <p>Hi ${userName}, we have received your payment for Order <strong>#${order.orderId}</strong>.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;"/>
      <h3>Order Summary</h3>
      <ul>${itemsHtml}</ul>
      <p><strong>Subtotal:</strong> ₹${order.priceBreakup.subtotal}</p>
      <p><strong>Shipping:</strong> ₹${order.priceBreakup.shipping}</p>
      <p><strong>Discount:</strong> -₹${Math.abs(order.priceBreakup.discountAmount)}</p>
      <h3 style="color: #d32f2f;">Total Paid: ₹${order.priceBreakup.total}</h3>
      <p>You can download your detailed invoice from your dashboard.</p>
    </div>
  `);
};

exports.orderDispatchedEmail = (orderId, trackingId, partner) => (`
  <div style="${baseStyle}">
    <h2 style="color: #2196F3;">Your Order is on the way! 🚚</h2>
    <p>Great news! Order <strong>#${orderId}</strong> has been dispatched.</p>
    <p><strong>Logistics Partner:</strong> ${partner}</p>
    <p><strong>Tracking Number:</strong> ${trackingId}</p>
    <p>You can track your package directly on the ${partner} website or via your dashboard.</p>
  </div>
`);

exports.deliverySuccessEmail = (orderId) => (`
  <div style="${baseStyle}">
    <h2 style="color: #4CAF50;">Package Delivered! 🎁</h2>
    <p>Your Order <strong>#${orderId}</strong> has been successfully delivered.</p>
    <p>We hope you love your purchase. If you have any issues, please contact our support team.</p>
  </div>
`);

exports.paymentReminderEmail = (orderId, total) => (`
  <div style="${baseStyle}">
    <h2 style="color: #FF9800;">Pending Payment Reminder ⏳</h2>
    <p>Hi there, you left something behind! Order <strong>#${orderId}</strong> is waiting for payment.</p>
    <p><strong>Pending Amount:</strong> ₹${total}</p>
    <p>To secure your items before they go out of stock, please complete your payment.</p>
    <a href="${FRONTEND_URL}/user/orders" style="display: inline-block; padding: 10px 20px; background: #FF9800; color: #fff; text-decoration: none; border-radius: 5px;">Pay Now</a>
  </div>
`);