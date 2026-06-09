const express = require('express');
const adminRoutes = require('./admin.routes');
const vendorRoutes = require('./vendor.routes');
const shopRoutes = require('./shop.routes');
const { getHealth } = require('../controllers/baseController');

const router = express.Router();

router.get('/health', getHealth);
router.use('/admin', adminRoutes);
router.use('/vendor', vendorRoutes);
router.use('/shop', shopRoutes);

module.exports = router;
