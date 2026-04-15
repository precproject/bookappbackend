const axios = require('axios');

// In-memory cache for the OAuth Token to prevent hitting rate limits
let cachedToken = null;
let tokenExpiryTime = null;

class PhonePeService {
  /**
   * 1. Get Environment Config (V2 Credentials)
   */
  static async getEnvConfig(ConfigModel) {
    const config = await ConfigModel.findOne({ singletonId: 'SYSTEM_CONFIG' });
    const isLive = config?.payment?.isLiveMode === true || process.env.PHONEPE_ENV === 'PROD';

    // Base URLs explicitly defined per V2 Documentation
    return {
      clientId: config?.payment?.clientId || process.env.PHONEPE_CLIENT_ID,
      clientSecret: config?.payment?.clientSecret || process.env.PHONEPE_CLIENT_SECRET,
      clientVersion: config?.payment?.clientVersion || process.env.PHONEPE_CLIENT_VERSION || '1',
      
      authBaseUrl: isLive 
        ? 'https://api.phonepe.com/apis/identity-manager' 
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
        
      pgBaseUrl: isLive 
        ? 'https://api.phonepe.com/apis/pg' 
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
        
      isLive
    };
  }

  /**
   * 2. Generate Authorization Token (OAuth 2.0)
   * Ref: POST /v1/oauth/token
   */
  static async getAccessToken(env) {
    // Return cached token if it is still valid (adding a 60-second safety buffer)
    if (cachedToken && tokenExpiryTime && Date.now() < (tokenExpiryTime - 60000)) {
      return cachedToken;
    }

    // Must be sent as URL Encoded Data per documentation
    const payload = new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      client_version: env.clientVersion,
      grant_type: 'client_credentials'
    });

    try {
      const response = await axios.post(`${env.authBaseUrl}/v1/oauth/token`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      cachedToken = response.data.access_token;
      // issued_at is in seconds, expires_in is in seconds. Convert to milliseconds.
      tokenExpiryTime = (response.data.issued_at + response.data.expires_in) * 1000; 

      return cachedToken;
    } catch (error) {
      console.error("[PhonePe V2] Auth Token Error:", error.response?.data || error.message);
      throw new Error("Failed to generate Authorization Token from PhonePe.");
    }
  }

  /**
   * 3. Create Payment Request
   * Ref: POST /checkout/v2/pay
   */
  static async initiatePayment({ orderId, amount, redirectUrl, env }) {
    const token = await this.getAccessToken(env);
    
    // V2 Payload Structure - Direct JSON, no Base64!
    const payload = {
      merchantOrderId: orderId.toString(),
      amount: Math.round(amount * 100), // Strictly in paisa
      paymentFlow: {
        type: "PG_CHECKOUT",
        merchantUrls: {
          redirectUrl: redirectUrl
        }
      }
    };

    try {
      const response = await axios.post(`${env.pgBaseUrl}/checkout/v2/pay`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`
        }
      });

      // V2 Returns redirect URL directly inside the response
      return {
        success: true,
        redirectUrl: response.data.redirectUrl
      };
    } catch (error) {
      console.error("[PhonePe V2] Initiate Payment Error:", error.response?.data || error.message);
      throw new Error("Payment initiation failed at gateway.");
    }
  }

  /**
   * 4. Check Order Status
   * Ref: GET /checkout/v2/order/{merchantOrderId}/status
   */
  static async checkStatus({ orderId, env }) {
    const token = await this.getAccessToken(env);

    try {
      const response = await axios.get(`${env.pgBaseUrl}/checkout/v2/order/${orderId}/status`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`
        }
      });

      return response.data; // V2 returns the 'state' inside this object
    } catch (error) {
      console.error("[PhonePe V2] Status Check Error:", error.response?.data || error.message);
      throw new Error("Failed to check payment status.");
    }
  }

  /**
   * 5. Initiate Refund
   * Ref: POST /payments/v2/refund
   */
  static async initiateRefund({ originalMerchantOrderId, amount, env }) {
    const token = await this.getAccessToken(env);
    const refundId = `RF-${Date.now()}`;

    const payload = {
      merchantRefundId: refundId,
      originalMerchantOrderId: originalMerchantOrderId.toString(),
      amount: Math.round(amount * 100) // Strictly in paisa
    };

    try {
      const response = await axios.post(`${env.pgBaseUrl}/payments/v2/refund`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      console.error("[PhonePe V2] Refund Error:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "Failed to initiate refund.");
    }
  }
}

module.exports = PhonePeService;