const express = require('express');
const adminController = require('../controllers/adminController');
const { ensureDatabase, requireAdmin } = require('../services/storeService');

const router = express.Router();

router.get('/auth/status', ensureDatabase, adminController.getAuthStatus);
router.post('/auth/bootstrap', ensureDatabase, adminController.bootstrap);
router.post('/auth/login', ensureDatabase, adminController.login);
router.post('/auth/forgot-password', ensureDatabase, adminController.forgotPassword);
router.post('/auth/reset-password', ensureDatabase, adminController.resetPassword);
router.get('/me', ensureDatabase, requireAdmin, adminController.getMe);
router.get('/overview', ensureDatabase, requireAdmin, adminController.getOverview);
router.get('/products', ensureDatabase, requireAdmin, adminController.getProducts);
router.put('/products/:productId', ensureDatabase, requireAdmin, adminController.updateProduct);
router.delete('/products/:productId', ensureDatabase, requireAdmin, adminController.deleteProduct);
router.post('/vendors/:vendorId/approve', ensureDatabase, requireAdmin, adminController.approveVendor);
router.delete('/vendors/:vendorId', ensureDatabase, requireAdmin, adminController.deleteVendor);

module.exports = router;
