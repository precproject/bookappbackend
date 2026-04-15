const express = require('express');
const router = express.Router();

// CORRECT: Use curly braces to extract the exact function
const { phonepeWebhook } = require('../controllers/webhookController'); 

router.post('/phonepe', phonepeWebhook);

module.exports = router;