const axios = require('axios');
const Config = require('../models/Config');

// Helper to get Delhivery Config & Base URL directly from DB
const getDelhiveryConfig = async () => {
  const config = await Config.findOne({ singletonId: 'SYSTEM_CONFIG' });
  const deliveryConfig = config?.delivery || {};
  const taxConfig = config?.taxConfig || {};
  
  if (!deliveryConfig.apiToken) {
    throw new Error('Delhivery API Token is missing in system configuration.');
  }

  const baseURL = deliveryConfig.isLiveMode 
    ? 'https://track.delhivery.com' 
    : 'https://staging-express.delhivery.com';

  return {
    baseURL,
    token: deliveryConfig.apiToken,
    pickupLocationName: deliveryConfig.pickupLocationName || deliveryConfig.provider, 
    originPincode: deliveryConfig.originPincode || deliveryConfig.pickupPincode,
    defaultWeightGrams: deliveryConfig.defaultWeightGrams || 500,
    returnAddress: deliveryConfig.returnAddress || {},
    hsnCode: taxConfig.hsnCode || '4901'
  };
};

const delhiveryService = {
  
  /**
   * 1. Check Serviceability
   */
  checkServiceability: async (pincode) => {
    try {
      const { baseURL, token } = await getDelhiveryConfig();
      
      const response = await axios.get(`${baseURL}/c/api/pin-codes/json/`, {
        headers: { 'Authorization': `Token ${token}` },
        params: { filter_codes: pincode }
      });

      const deliveryCodes = response.data?.delivery_codes || [];
      if (deliveryCodes.length > 0 && deliveryCodes[0].postal_code.is_oda !== undefined) {
        return { 
          isServiceable: true, 
          city: deliveryCodes[0].postal_code.city,
          state: deliveryCodes[0].postal_code.state_code
        };
      }
      return { isServiceable: false };
    } catch (error) {
      console.error('Delhivery Serviceability Error:', error.response?.data || error.message);
      return { isServiceable: false, error: 'Failed to verify pincode' };
    }
  },

  /**
   * 2. Calculate Shipping Rates
   */
  calculateShipping: async (destPincode, weightInGrams, paymentMode = 'Pre-paid') => {
    try {
      const { baseURL, token, originPincode, defaultWeightGrams } = await getDelhiveryConfig();
      
      const response = await axios.get(`${baseURL}/api/kinko/v1/invoice/charges/.json`, {
        headers: { 'Authorization': `Token ${token}` },
        params: {
          md: 'S', // S = Surface
          ss: 'Delivered',
          d: destPincode,
          o: originPincode,
          w: weightInGrams || defaultWeightGrams,
          pt: paymentMode
        }
      });

      if (response.data && response.data[0] && response.data[0].total_amount) {
        return { success: true, charge: response.data[0].total_amount };
      }
      return { success: false, charge: 0 };
    } catch (error) {
      console.error('Delhivery Rate Calc Error:', error.response?.data || error.message);
      return { success: false, charge: 0 };
    }
  },

  /**
   * 3. Create Shipment (Order Creation)
   */
  createShipment: async (order, populatedItems) => {
    try {
      const { baseURL, token, pickupLocationName, defaultWeightGrams, returnAddress, hsnCode } = await getDelhiveryConfig();

      // Dynamically calculate weight based on populated items
      const totalWeight = populatedItems.reduce((sum, item) => {
        const itemWeight = item.book?.weightInGrams || defaultWeightGrams;
        return sum + (itemWeight * item.qty);
      }, 0);

      const payload = {
        pickup_location: {
          name: pickupLocationName
        },
        shipments: [
          {
            name: order.shipping.fullName,
            add: order.shipping.street,
            pin: order.shipping.pincode,
            city: order.shipping.city,
            state: order.shipping.state,
            phone: order.shipping.phone,
            order: order.orderId,
            payment_mode: order.paymentMethod === 'COD' ? 'COD' : 'Pre-paid',
            cod_amount: order.paymentMethod === 'COD' ? order.priceBreakup.total : 0,
            discount_amount: order.priceBreakup.discountAmount || 0,
            shipping_mode: 'Surface',
            
            // Configurable Return Address
            return_name: returnAddress.name || '',
            return_pin: returnAddress.pincode || '', 
            return_city: returnAddress.city || '',
            return_state: returnAddress.state || '',
            return_add: returnAddress.address || '',
            
            products_desc: order.items.map(i => i.name).join(', '),
            hsn_code: hsnCode,
            weight: totalWeight,
            quantity: order.items.reduce((sum, item) => sum + item.qty, 0)
          }
        ]
      };

      const params = new URLSearchParams();
      params.append('format', 'json');
      params.append('data', JSON.stringify(payload));

      const response = await axios.post(`${baseURL}/api/cmu/create.json`, params, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const result = response.data;
      if (result.success && result.packages && result.packages.length > 0) {
        return {
          success: true,
          awb: result.packages[0].waybill,
          status: result.packages[0].status,
          estimatedDelivery: result.packages[0].expected_delivery_date || null
        };
      } else {
        return { success: false, error: result.rmk || 'Failed to create shipment' };
      }
    } catch (error) {
      console.error('Delhivery Creation Error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * 4. Track Shipment
   */
  trackShipment: async (awbNumber) => {
    try {
      const { baseURL, token } = await getDelhiveryConfig();
      
      const response = await axios.get(`${baseURL}/api/v1/packages/json/`, {
        headers: { 'Authorization': `Token ${token}` },
        params: { waybill: awbNumber }
      });

      const trackingData = response.data?.ShipmentData?.[0]?.Shipment || null;
      
      if (trackingData) {
        return {
          success: true,
          status: trackingData.Status?.Status,
          statusDateTime: trackingData.Status?.StatusDateTime,
          scans: trackingData.Scans 
        };
      }
      return { success: false, error: 'Tracking data not found' };
    } catch (error) {
      console.error('Delhivery Tracking Error:', error.response?.data || error.message);
      return { success: false, error: 'Failed to fetch tracking' };
    }
  },

  /**
   * 5. Update Shipment (If address needs updating before dispatch)
   */
  updateShipment: async (awbNumber, newShippingDetails) => {
    try {
      const { baseURL, token } = await getDelhiveryConfig();
      
      const payload = {
        waybill: awbNumber,
        name: newShippingDetails.fullName,
        add: newShippingDetails.street,
        phone: newShippingDetails.phone,
        city: newShippingDetails.city,
        state: newShippingDetails.state,
        pin: newShippingDetails.pincode
      };

      const response = await axios.post(`${baseURL}/api/p/edit/`, payload, {
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
      });

      return { success: response.data?.status === true };
    } catch (error) {
      console.error('Delhivery Update Error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * 6. Cancel Shipment
   */
  cancelShipment: async (awbNumber) => {
    try {
      const { baseURL, token } = await getDelhiveryConfig();
      
      const payload = { waybill: awbNumber, cancellation: true };

      const response = await axios.post(`${baseURL}/api/p/edit/`, payload, {
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
      });

      return { success: response.data?.status === true };
    } catch (error) {
      console.error('Delhivery Cancel Error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }
};

module.exports = delhiveryService;