const express = require('express');
const shopController = require('../controllers/shopController');
const { ensureDatabase } = require('../services/storeService');

const router = express.Router();

router.get('/:shopId', ensureDatabase, shopController.getShop);
router.post('/:shopId/purchase', ensureDatabase, shopController.purchase);

module.exports = router;
