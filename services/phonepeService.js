const crypto = require('crypto');
const axios = require('axios');

class PhonePeService {
  /**
   * 1. Dynamically fetch configuration for Test or Production environments
   */
  static async getEnvConfig(ConfigModel) {
    const config = await ConfigModel.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const isLive = config?.payment?.isLiveMode === true || process.env.PHONEPE_ENV === 'PROD';

    return {
      merchantId: config?.payment?.merchantId || process.env.PHONEPE_MERCHANT_ID,
      saltKey: config?.payment?.saltKey || process.env.PHONEPE_SALT_KEY,
      saltIndex: config?.payment?.saltIndex || process.env.PHONEPE_SALT_INDEX || '1',
      // Verified UAT and PROD endpoints for PhonePe V1 API
      baseUrl: isLive 
        ? 'https://api.phonepe.com/apis/hermes' 
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
      isLive
    };
  }

  /**
   * 2. PhonePe Standard SHA256 Checksum Generator for API Requests
   */
  static generateChecksum(base64Payload, endpoint, saltKey, saltIndex) {
    const stringToHash = base64Payload + endpoint + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    return `${sha256}###${saltIndex}`;
  }

  /**
   * 3. Validate Webhook (S2S Callback) Checksum
   * NOTE: Webhook checksums do NOT include the endpoint url in the hash string.
   */
  static verifyWebhook(base64Response, xVerifyHeader, saltKey) {
    const stringToHash = base64Response + saltKey;
    const expectedHash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    
    // The header comes as "HASH###INDEX". We only compare the hash part to be extra safe.
    const [receivedHash] = xVerifyHeader.split('###');
    return expectedHash === receivedHash;
  }

  /**
   * 4. Create Payload and Invoke PayPage URL
   */
  static async initiatePayment({ orderId, amount, userId, mobileNumber, redirectUrl, callbackUrl, env }) {
    const endpoint = '/pg/v1/pay';
    
    // PhonePe V1 Payload Structure
    const payload = {
      merchantId: env.merchantId,
      merchantTransactionId: orderId.toString(),
      merchantUserId: userId.toString(),
      amount: Math.round(amount * 100), // PhonePe requires amount strictly in PAISE (₹1 = 100 paise)
      redirectUrl: redirectUrl,
      redirectMode: "REDIRECT",
      callbackUrl: callbackUrl, // Webhook destination for Server-to-Server ping
      mobileNumber: mobileNumber || '9999999999',
      paymentInstrument: { type: "PAY_PAGE" }
    };

    // Convert payload to Base64
    const base64EncodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    // Generate X-VERIFY Header
    const xVerifyChecksum = this.generateChecksum(base64EncodedPayload, endpoint, env.saltKey, env.saltIndex);

    try {
      const response = await axios.post(`${env.baseUrl}${endpoint}`, 
        { request: base64EncodedPayload }, 
        { 
          headers: { 
            'Content-Type': 'application/json', 
            'X-VERIFY': xVerifyChecksum 
          } 
        }
      );

      // Successfully generated payment link
      if (response.data && response.data.success) {
        return {
          success: true,
          redirectUrl: response.data.data.instrumentResponse.redirectInfo.url
        };
      } else {
        throw new Error(response.data.message || 'Payment initiation failed at gateway');
      }
    } catch (error) {
      // Safely capture and log the exact error from PhonePe (e.g. "Invalid Merchant ID")
      const gatewayError = error.response?.data?.message || error.message;
      console.error("[PhonePe Initiate Error]:", error.response?.data || error.message);
      throw new Error(`Payment Gateway Error: ${gatewayError}`);
    }
  }

  /**
   * 5. Check Order Status (Manual Polling/Failsafe)
   */
  static async checkStatus({ orderId, env }) {
    const endpoint = `/pg/v1/status/${env.merchantId}/${orderId}`;
    
    // Status check is a GET request, so the payload portion of the checksum is an empty string
    const checksum = this.generateChecksum('', endpoint, env.saltKey, env.saltIndex);

    try {
      const response = await axios.get(`${env.baseUrl}${endpoint}`, {
        headers: { 
          'Content-Type': 'application/json', 
          'X-VERIFY': checksum, 
          'X-MERCHANT-ID': env.merchantId 
        }
      });

      // Returns the full status object (e.g., response.data.code === 'PAYMENT_SUCCESS')
      return response.data; 
    } catch (error) {
      console.error("[PhonePe Status Check Error]:", error.response?.data || error.message);
      throw new Error("Failed to check payment status with gateway.");
    }
  }

  /**
   * 6. Refund Functionality
   */
  static async initiateRefund({ originalTxnId, amount, userId, callbackUrl, env }) {
    const endpoint = '/pg/v1/refund';
    const refundTxnId = `RF-${Date.now()}`;
    
    const payload = {
      merchantId: env.merchantId,
      merchantUserId: userId.toString(),
      originalTransactionId: originalTxnId, // The Provider Reference ID from the original successful payment
      merchantTransactionId: refundTxnId, // A new, unique ID for this refund request
      amount: Math.round(amount * 100), // PAISE
      callbackUrl: callbackUrl
    };

    const base64EncodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const xVerifyChecksum = this.generateChecksum(base64EncodedPayload, endpoint, env.saltKey, env.saltIndex);

    try {
      const response = await axios.post(`${env.baseUrl}${endpoint}`, 
        { request: base64EncodedPayload }, 
        { 
          headers: { 
            'Content-Type': 'application/json', 
            'X-VERIFY': xVerifyChecksum 
          } 
        }
      );

      return response.data;
    } catch (error) {
      console.error("[PhonePe Refund Error]:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "Failed to initiate refund.");
    }
  }
}

module.exports = PhonePeService;