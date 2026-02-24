const express = require('express');
const router = express.Router();
const { phonepeWebhook, deliveryWebhook } = require('../controllers/webhookController');

router.post('/phonepe', phonepeWebhook);
router.post('/delivery', deliveryWebhook);

module.exports = router;