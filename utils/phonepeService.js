const crypto = require('crypto');
const axios = require('axios');

class PhonePeService {
  /**
   * Dynamically fetch configuration for Test or Production environments
   */
  static async getEnvConfig(ConfigModel) {
    const config = await ConfigModel.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const isLive = config?.payment?.isLiveMode || process.env.NODE_ENV === 'production';
    
    return {
      merchantId: config?.payment?.merchantId || process.env.PHONEPE_MERCHANT_ID,
      saltKey: config?.payment?.saltKey || process.env.PHONEPE_SALT_KEY,
      saltIndex: config?.payment?.saltIndex || process.env.PHONEPE_SALT_INDEX || '1',
      baseUrl: isLive 
        ? 'https://api.phonepe.com/apis/hermes' 
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
      isLive
    };
  }

  /**
   * PhonePe Standard SHA256 Checksum Generator
   */
  static generateChecksum(base64Payload, endpoint, saltKey, saltIndex) {
    const stringToHash = base64Payload + endpoint + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    return `${sha256}###${saltIndex}`;
  }

  /**
   * Step 1 & 2: Create Payload and Invoke PayPage URL
   * Ref: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/create-payment
   */
  static async initiatePayment({ orderId, amount, userId, mobileNumber, redirectUrl, callbackUrl, env }) {
    const endpoint = '/pg/v1/pay';
    
    const payload = {
      merchantId: env.merchantId,
      merchantTransactionId: orderId,
      merchantUserId: userId.toString(),
      amount: Math.round(amount * 100), // PhonePe requires amount strictly in PAISE
      redirectUrl: redirectUrl,
      redirectMode: "REDIRECT",
      callbackUrl: callbackUrl, // Webhook destination
      mobileNumber: mobileNumber || '9999999999',
      paymentInstrument: { type: "PAY_PAGE" }
    };

    const base64EncodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const xVerifyChecksum = this.generateChecksum(base64EncodedPayload, endpoint, env.saltKey, env.saltIndex);

    try{
      const response = await axios.post(`${env.baseUrl}${endpoint}`, { request: base64EncodedPayload }, {
        headers: { 'Content-Type': 'application/json', 'X-VERIFY': xVerifyChecksum }
      });

      if (response.data && response.data.success) {
        // Return the secure redirect URL for the frontend iframe/redirect
        return response.data.data.instrumentResponse.redirectInfo.url;
      } else {
        throw new Error(response.data.message || 'Payment initiation failed at gateway');
      }
    }catch(error){
      throw new Error(error?.response?.data?.message || error)
    }
  }

  /**
   * Step 3: Check Order Status
   * Ref: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/order-status
   */
  static async checkStatus({ orderId, env }) {
    const endpoint = `/pg/v1/status/${env.merchantId}/${orderId}`;
    
    // Status check requires empty payload for checksum
    const checksum = this.generateChecksum('', endpoint, env.saltKey, env.saltIndex);

    const response = await axios.get(`${env.baseUrl}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum, 'X-MERCHANT-ID': env.merchantId }
    });

    return response.data; // Contains code (e.g., PAYMENT_SUCCESS) and data
  }

  /**
   * Refund Functionality
   * Ref: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/refund
   */
  static async initiateRefund({ originalTxnId, amount, userId, callbackUrl, env }) {
    const endpoint = '/pg/v1/refund';
    const refundTxnId = `RF-${Date.now()}`;
    
    const payload = {
      merchantId: env.merchantId,
      merchantUserId: userId.toString(),
      originalTransactionId: originalTxnId,
      merchantTransactionId: refundTxnId,
      amount: Math.round(amount * 100), // PAISE
      callbackUrl: callbackUrl
    };

    const base64EncodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const xVerifyChecksum = this.generateChecksum(base64EncodedPayload, endpoint, env.saltKey, env.saltIndex);

    const response = await axios.post(`${env.baseUrl}${endpoint}`, { request: base64EncodedPayload }, {
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': xVerifyChecksum }
    });

    return response.data;
  }
}

module.exports = PhonePeService;