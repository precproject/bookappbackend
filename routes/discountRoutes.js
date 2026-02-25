const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');

router.post('/validate', discountController.validatePromo);

module.exports = router;