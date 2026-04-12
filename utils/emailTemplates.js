const STORE_NAME = process.env.STORE_NAME || 'SahakarStree';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://sahakarstree.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@sahakarstree.in';

// =========================================================
// MASTER LAYOUT WRAPPER (Bilingual Premium Design)
// =========================================================
const emailLayout = (content) => `
<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Mangal', 'Nirmala UI'; -webkit-font-smoothing: antialiased; }
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
    .lang-divider { border-top: 1px dashed #cbd5e1; margin: 25px 0; }
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
              <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px; font-weight: 500;">काही मदत हवी आहे? / Need help with your order?</p>
              <p style="margin: 0; color: #64748b; font-size: 13px;">या ईमेलला रिप्लाय करा किंवा संपर्क साधा: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
              
              <div class="footer-links">
                <a href="${FRONTEND_URL}/store">Shop</a>
                <a href="${FRONTEND_URL}/contact">Contact</a>
                <a href="${FRONTEND_URL}/privacy-policy">Privacy</a>
                <a href="${FRONTEND_URL}/terms-of-service">Terms</a>
              </div>
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

const tableHeaderStyle = `padding: 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; text-align: left; font-weight: 700;`;
const tableCellStyle = `padding: 16px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 15px;`;

// =========================================================
// 1. WELCOME EMAIL
// =========================================================
exports.welcomeEmail = (name) => emailLayout(`
  <h2 style="color: #0f172a; margin-top: 0; font-size: 24px;">सहकार स्त्री मध्ये आपले स्वागत आहे! 🎉<br><span style="font-size: 18px; color: #64748b;">Welcome to ${STORE_NAME}!</span></h2>
  
  <p>नमस्कार <strong>${name}</strong>,</p>
  <p>आमच्या समुदायात तुमचे स्वागत करताना आम्हाला अत्यंत आनंद होत आहे. तुमचे खाते यशस्वीरित्या तयार झाले आहे. आता तुम्ही आमची पुस्तके पाहू शकता, तुमचे पत्ते व्यवस्थापित करू शकता आणि तुमच्या वैयक्तिक डॅशबोर्डवरून ऑर्डर ट्रॅक करू शकता.</p>
  
  <div class="lang-divider"></div>
  
  <p>Hi <strong>${name}</strong>,</p>
  <p>We are absolutely thrilled to have you join our community. Your account has been successfully created. You can now explore our premium collection, manage your addresses, and track your orders seamlessly from your personal dashboard.</p>
  
  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/store" class="btn">पुस्तके पहा / Explore Store</a>
  </div>
`);

// =========================================================
// 2. PRE-BOOK / WAITLIST EMAIL (Enhanced with Image & Details)
// =========================================================
exports.prebookEmail = (userName, storeName = STORE_NAME) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #ea580c; margin: 0; font-size: 26px;">तुम्ही प्रतीक्षा यादीत आहात! ⏳<br><span style="font-size: 18px; color: #64748b;">You're on the Waitlist!</span></h2>
  </div>

  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://api.sahakarstree.com/uploads/image-1776021143995-21829499.webp" alt="First Book Cover" style="width: 100%; max-width: 250px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" />
  </div>
  
  <p>नमस्कार <strong>${userName}</strong>,</p>
  <p>तुमचा उत्स्फूर्त प्रतिसाद पाहून आम्हाला खूप आनंद झाला! <strong>${storeName}</strong> च्या या पहिल्यावहिल्या पुस्तकाच्या विशेष प्रतीक्षा यादीत (Waitlist) तुमचे नाव नोंदवले गेले आहे.</p>
  <p>हे पुस्तक महिलांच्या प्रेरणादायी प्रवासाची, संघर्षाची आणि सहकाराची एक अद्भुत कहाणी आहे. यातून तुम्हाला अनेक नवीन गोष्टी आणि अनुभव वाचायला मिळतील. पुस्तकाबद्दल अधिक माहिती आणि प्रकरणे जाणून घेण्यासाठी आमच्या वेबसाईटला नक्की भेट द्या.</p>
  
  <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
    <p style="margin: 0; color: #9a3412; font-weight: 700; font-size: 15px;">पुढे काय होईल?</p>
    <p style="margin: 8px 0 0 0; color: #c2410c; font-size: 15px;">पुस्तक खरेदीसाठी उपलब्ध होताच आम्ही तुम्हाला सर्वात आधी कळवू, जेणेकरून स्टॉक संपण्यापूर्वी तुम्हाला तुमची प्रत नक्की मिळेल.</p>
  </div>

  <div class="lang-divider"></div>

  <p>Hi <strong>${userName}</strong>,</p>
  <p>Thank you for your overwhelming response! You are officially on the exclusive pre-book waitlist for our highly anticipated first book at <strong>${storeName}</strong>.</p>
  <p>This book unfolds an inspiring journey of women's empowerment, struggle, and cooperation. It is packed with profound insights and real-life learnings. To explore the chapters and read more details about the book, please visit our website.</p>
  
  <div style="background-color: #f8fafc; border-left: 4px solid #475569; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
    <p style="margin: 0; color: #334155; font-weight: 700; font-size: 15px;">What happens next?</p>
    <p style="margin: 8px 0 0 0; color: #475569; font-size: 15px;">We will notify you the exact moment the book becomes available for purchase so you can grab your copy before stock runs out.</p>
  </div>

  <div style="text-align: center; margin-top: 35px;">
    <a href="${FRONTEND_URL}" class="btn">अधिक माहिती वाचा / Read More</a>
  </div>
`);

// =========================================================
// 3. ORDER PLACED (PENDING PAYMENT) EMAIL
// =========================================================
exports.orderPlacedEmail = (order, userName) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="display: inline-block; background-color: #fff7ed; color: #ea580c; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #fed7aa; margin-bottom: 16px;">Action Required</div>
    <h2 style="color: #0f172a; margin: 0; font-size: 24px;">तुमची खरेदी पूर्ण करा<br><span style="font-size: 18px; color: #64748b;">Complete Your Purchase</span></h2>
  </div>
  
  <p>नमस्कार <strong>${userName}</strong>,</p>
  <p>तुमची ऑर्डर <strong>#${order.orderId}</strong> यशस्वीरित्या सुरू झाली आहे. तुमची पुस्तके सुरक्षित करण्यासाठी आणि खरेदी पूर्ण करण्यासाठी, कृपया खालील बटनावर क्लिक करून तुमचे पेमेंट पूर्ण करा.</p>
  
  <div class="lang-divider"></div>

  <p>Hi <strong>${userName}</strong>,</p>
  <p>Your order <strong>#${order.orderId}</strong> has been successfully initiated. To secure your items and complete the purchase, please finalize your payment securely.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
    <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 700;">एकूण रक्कम / Total Due</p>
    <p style="margin: 8px 0 0 0; color: #0f172a; font-size: 36px; font-weight: 900;">₹${order.priceBreakup.total}</p>
  </div>

  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/payment-status/${order.orderId}" class="btn">पेमेंट करा / Pay Securely</a>
  </div>
`);

// =========================================================
// 4. PAYMENT SUCCESS / RECEIPT EMAIL
// =========================================================
exports.paymentSuccessEmail = (order, userName) => {
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
      <h2 style="color: #0f172a; margin: 0; font-size: 26px;">पेमेंट यशस्वी! / Payment Successful!</h2>
      <p style="color: #64748b; font-size: 15px; margin-top: 8px;">Order #${order.orderId}</p>
    </div>

    <p>नमस्कार <strong>${userName}</strong>,</p>
    <p>तुमच्या खरेदीबद्दल धन्यवाद! आम्हाला तुमचे पेमेंट सुरक्षितपणे प्राप्त झाले आहे आणि आम्ही आता तुमची ऑर्डर पाठवण्याची तयारी करत आहोत.</p>
    
    <div class="lang-divider"></div>

    <p>Hi <strong>${userName}</strong>,</p>
    <p>Thank you for your purchase! We have received your payment securely and are now preparing your order for fulfillment.</p>
    
    <div style="margin-top: 40px; margin-bottom: 30px;">
      <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 18px;">ऑर्डर तपशील / Order Summary</h3>
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
      <a href="${FRONTEND_URL}/dashboard" class="btn" style="background-color: #0f172a;">डॅशबोर्ड पहा / View Dashboard</a>
    </div>
  `);
};

// =========================================================
// 5. ORDER DISPATCHED EMAIL
// =========================================================
exports.orderDispatchedEmail = (orderId, trackingId, partner) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="font-size: 40px; margin-bottom: 10px;">🚚</div>
    <h2 style="color: #0f172a; margin: 0; font-size: 26px;">तुमची ऑर्डर पाठवली आहे!<br><span style="font-size: 18px; color: #64748b;">Your Order is on the way!</span></h2>
    <p style="color: #64748b; margin-top: 8px; font-size: 15px;">Order #${orderId}</p>
  </div>
  
  <p>आनंदाची बातमी! तुमचे पुस्तक सुरक्षितपणे पॅक केले गेले आहे आणि आमच्या डिलिव्हरी पार्टनरकडे सुपूर्द केले आहे. ते लवकरच तुमच्यापर्यंत पोहोचेल.</p>
  
  <div class="lang-divider"></div>

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

  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/dashboard" class="btn">ऑर्डर ट्रॅक करा / Track Package</a>
  </div>
`);

// =========================================================
// 6. DELIVERY SUCCESS EMAIL
// =========================================================
exports.deliverySuccessEmail = (orderId) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="font-size: 40px; margin-bottom: 10px;">📦</div>
    <h2 style="color: #059669; margin: 0; font-size: 26px;">पार्सल पोहोचले!<br><span style="font-size: 18px; color: #64748b;">Package Delivered!</span></h2>
    <p style="color: #64748b; margin-top: 8px; font-size: 15px;">Order #${orderId}</p>
  </div>

  <p>तुमची ऑर्डर यशस्वीरित्या वितरित केली गेली आहे. आम्हाला आशा आहे की तुम्हाला तुमचे नवीन पुस्तक नक्कीच आवडेल.</p>
  
  <div class="lang-divider"></div>

  <p>Your order has been successfully delivered. We hope you are absolutely thrilled with your purchase and your reading experience.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0; text-align: center;">
    <p style="margin: 0 0 8px 0; color: #0f172a; font-weight: 700; font-size: 16px;">तुमचा अनुभव कसा होता? / How was your experience?</p>
    <p style="margin: 0; color: #64748b; font-size: 14px;">तुम्हाला वेळ मिळाल्यास, कृपया तुमच्या डॅशबोर्डवर जाऊन पुस्तकाबद्दल तुमचा रिव्ह्यू (Review) नक्की नोंदवा.</p>
  </div>
  
  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/dashboard" class="btn">रिव्ह्यू द्या / Write a Review</a>
  </div>
`);

// =========================================================
// 7. PAYMENT REMINDER EMAIL
// =========================================================
exports.paymentReminderEmail = (orderId, total) => emailLayout(`
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="font-size: 40px; margin-bottom: 10px;">⏳</div>
    <h2 style="color: #0f172a; margin: 0; font-size: 26px;">ही संधी सोडू नका!<br><span style="font-size: 18px; color: #64748b;">Don't miss out!</span></h2>
  </div>

  <p>तुमची ऑर्डर <strong>#${orderId}</strong> अद्याप पेमेंटच्या प्रतीक्षेत आहे. पुस्तकाचा स्टॉक वेगाने संपत आहे, त्यामुळे कृपया लवकरात लवकर तुमचे पेमेंट पूर्ण करा.</p>
  
  <div class="lang-divider"></div>

  <p>We noticed you left something behind! Your order <strong>#${orderId}</strong> is still waiting for payment. Our inventory is limited and stock moves fast. To secure your items, please complete your checkout process.</p>
  
  <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
    <p style="margin: 0; color: #9a3412; font-size: 15px;">Pending Amount</p>
    <p style="margin: 4px 0 0 0; color: #c2410c; font-size: 24px; font-weight: 900;">₹${total}</p>
  </div>
  
  <div style="text-align: center;">
    <a href="${FRONTEND_URL}/payment-status/${orderId}" class="btn">पेमेंट पूर्ण करा / Complete Purchase</a>
  </div>
`);