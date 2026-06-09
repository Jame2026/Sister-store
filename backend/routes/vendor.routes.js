const express = require('express');
const vendorController = require('../controllers/vendorController');
const {
  ensureDatabase,
  requireOwnedVendor,
  requireApprovedVendor,
  upload,
} = require('../services/storeService');

const router = express.Router();

router.get('/auth/payment-qr', vendorController.getPaymentQr);
router.post('/auth/register', ensureDatabase, vendorController.register);
router.post('/auth/login', ensureDatabase, vendorController.login);
router.post('/auth/forgot-password', ensureDatabase, vendorController.forgotPassword);
router.post('/auth/reset-password', ensureDatabase, vendorController.resetPassword);
router.get('/me', ensureDatabase, requireOwnedVendor, vendorController.getMe);
router.put('/me/account', ensureDatabase, requireOwnedVendor, vendorController.updateAccount);
router.put(
  '/me/shop',
  ensureDatabase,
  requireOwnedVendor,
  upload.fields([{ name: 'logoImage', maxCount: 1 }]),
  vendorController.updateShop
);
router.post(
  '/me/products',
  ensureDatabase,
  requireOwnedVendor,
  requireApprovedVendor,
  upload.fields([{ name: 'productImage', maxCount: 1 }]),
  vendorController.createProduct
);
router.put(
  '/me/products/:productId',
  ensureDatabase,
  requireOwnedVendor,
  requireApprovedVendor,
  upload.fields([{ name: 'productImage', maxCount: 1 }]),
  vendorController.updateProduct
);
router.delete(
  '/me/products/:productId',
  ensureDatabase,
  requireOwnedVendor,
  requireApprovedVendor,
  vendorController.deleteProduct
);

module.exports = router;
