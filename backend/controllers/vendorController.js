const {
  bcrypt,
  path,
  validateEmail,
  validatePassword,
  validateResetCode,
  readVendorSubscriptionPlan,
  buildVendorSubscriptionDates,
  generatePasswordResetCode,
  buildPasswordResetExpiry,
  dispatchPasswordResetCode,
  storePasswordResetCode,
  clearPasswordResetCode,
  hashPasswordResetCode,
  hasPasswordResetExpired,
  validateVendorAccountPayload,
  validateVendorPayload,
  validateProductPayload,
  normalizeShopId,
  getUploadedFile,
  findPaymentQrUpload,
  saveUploadedFile,
  deleteUploadedFile,
  issueToken,
  mapVendorAccount,
  mapProduct,
  findVendorByEmail,
  findVendorById,
  findVendorByShopId,
  fetchVendorDashboard,
  getPool,
} = require('../services/storeService');
const { findVendorProductById, deleteVendorProductById } = require('../repositories/storeRepository');
const { sendError, readPositiveInteger } = require('./baseController');

async function getPaymentQr(req, res) {
  try {
    const paymentQr = await findPaymentQrUpload();

    if (!paymentQr) {
      res.status(404).json({
        error: 'No payment QR image was found in backend/uploads.',
      });
      return;
    }

    res.json(paymentQr);
  } catch (error) {
    sendError(res, error);
  }
}

async function register(req, res) {
  try {
    const email = validateEmail(req.body.email);
    const password = validatePassword(req.body.password);
    const subscriptionPlan = readVendorSubscriptionPlan(req.body.subscriptionPlan);
    const existingVendor = await findVendorByEmail(email);

    if (existingVendor) {
      res.status(409).json({
        error: 'This email is already registered.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const subscriptionDates = buildVendorSubscriptionDates(subscriptionPlan);
    const [result] = await getPool().execute(
      `INSERT INTO vendors (
         email,
         password_hash,
         logo,
         approval_status,
         approved_at,
         subscription_plan,
         subscription_started_at,
         subscription_ends_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email,
        passwordHash,
        'SS',
        'pending',
        null,
        subscriptionPlan.code,
        subscriptionDates.startedAt,
        subscriptionDates.endsAt,
      ]
    );

    const vendor = await findVendorById(result.insertId);

    res.status(201).json({
      token: issueToken(vendor),
      account: mapVendorAccount(vendor),
      shop: null,
    });
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function login(req, res) {
  try {
    const email = validateEmail(req.body.email);
    const password = validatePassword(req.body.password);
    const vendor = await findVendorByEmail(email);

    if (!vendor) {
      res.status(401).json({
        error: 'Email or password is incorrect.',
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, vendor.password_hash);

    if (!passwordMatches) {
      res.status(401).json({
        error: 'Email or password is incorrect.',
      });
      return;
    }

    const dashboard = await fetchVendorDashboard(vendor.id);

    res.json({
      token: issueToken(vendor),
      ...dashboard,
    });
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function forgotPassword(req, res) {
  try {
    const email = validateEmail(req.body.email);
    const vendor = await findVendorByEmail(email);

    if (!vendor) {
      res.status(404).json({
        error: 'No vendor account matches that email.',
      });
      return;
    }

    const resetCode = generatePasswordResetCode();
    const expiresAt = buildPasswordResetExpiry();
    await storePasswordResetCode('vendors', vendor.id, resetCode, expiresAt);
    const delivery = await dispatchPasswordResetCode({
      email: vendor.email,
      audienceLabel: 'Vendor',
      resetCode,
      expiresAt,
    });

    res.json(delivery);
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function resetPassword(req, res) {
  try {
    const email = validateEmail(req.body.email);
    const resetCode = validateResetCode(req.body.resetCode);
    const password = validatePassword(req.body.password);
    const vendor = await findVendorByEmail(email);

    if (!vendor) {
      res.status(404).json({
        error: 'No vendor account matches that email.',
      });
      return;
    }

    if (
      !vendor.password_reset_code_hash ||
      hasPasswordResetExpired(vendor.password_reset_expires_at)
    ) {
      await clearPasswordResetCode('vendors', vendor.id);
      res.status(400).json({
        error: 'This reset code has expired. Request a new one.',
      });
      return;
    }

    if (hashPasswordResetCode(resetCode) !== vendor.password_reset_code_hash) {
      res.status(400).json({
        error: 'The reset code is incorrect.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await getPool().execute(
      `UPDATE vendors
       SET password_hash = ?, password_reset_code_hash = NULL, password_reset_expires_at = NULL
       WHERE id = ?`,
      [passwordHash, vendor.id]
    );

    res.json({
      message: 'Vendor password reset successfully. You can sign in with the new password now.',
    });
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function getMe(req, res) {
  try {
    const dashboard = await fetchVendorDashboard(req.vendor.id);
    res.json(dashboard);
  } catch (error) {
    sendError(res, error);
  }
}

async function updateAccount(req, res) {
  try {
    const payload = validateVendorAccountPayload(req.body);

    if (payload.email !== req.vendor.email) {
      const existingVendor = await findVendorByEmail(payload.email);

      if (existingVendor && existingVendor.id !== req.vendor.id) {
        throw new Error('This email is already registered to another vendor account.');
      }
    }

    await getPool().execute(
      `UPDATE vendors
       SET email = ?, full_name = ?, phone = ?
       WHERE id = ?`,
      [payload.email, payload.fullName || null, payload.phone || null, req.vendor.id]
    );

    const dashboard = await fetchVendorDashboard(req.vendor.id);
    res.json(dashboard);
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function updateShop(req, res) {
  try {
    const payload = validateVendorPayload(req.body);
    const requestedShopId = normalizeShopId(req.body.shopId || req.vendor.shop_id || payload.shopName);

    if (!requestedShopId) {
      throw new Error('A valid public handle is required.');
    }

    const existingHandleOwner = await findVendorByShopId(requestedShopId);

    if (existingHandleOwner && existingHandleOwner.id !== req.vendor.id) {
      throw new Error('This public handle is already taken by another vendor.');
    }

    const uploadedLogo = await saveUploadedFile(
      getUploadedFile(req, 'logoImage'),
      path.join('shops', requestedShopId),
      'logo'
    );

    await getPool().execute(
      `UPDATE vendors
       SET shop_id = ?, shop_name = ?, description = ?, location = ?, telegram = ?,
           logo = ?,
           logo_image_url = COALESCE(?, logo_image_url),
           logo_image_path = COALESCE(?, logo_image_path)
       WHERE id = ?`,
      [
        requestedShopId,
        payload.shopName,
        payload.description,
        payload.location,
        payload.telegram,
        payload.logo,
        uploadedLogo?.url || null,
        uploadedLogo?.filePath || null,
        req.vendor.id,
      ]
    );

    if (uploadedLogo && req.vendor.logo_image_path && req.vendor.logo_image_path !== uploadedLogo.filePath) {
      await deleteUploadedFile(req.vendor.logo_image_path);
    }

    const dashboard = await fetchVendorDashboard(req.vendor.id);
    res.json(dashboard);
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function createProduct(req, res) {
  try {
    if (!req.vendor.shop_id) {
      res.status(400).json({
        error: 'Create your vendor shop first.',
      });
      return;
    }

    const payload = validateProductPayload(req.body, 0, 0);
    const uploadedImage = await saveUploadedFile(
      getUploadedFile(req, 'productImage'),
      path.join('shops', req.vendor.shop_id, 'products'),
      'product'
    );

    const [result] = await getPool().execute(
      `INSERT INTO products (
         vendor_id,
         name,
         price,
         description,
         discount_banner,
         stock,
         sold,
         image_url,
         image_path
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.vendor.id,
        payload.name,
        payload.price,
        payload.description,
        payload.discountBanner,
        payload.stock,
        payload.sold,
        uploadedImage?.url || null,
        uploadedImage?.filePath || null,
      ]
    );

    const [rows] = await getPool().execute('SELECT * FROM products WHERE id = ? LIMIT 1', [
      result.insertId,
    ]);

    res.status(201).json({
      message: 'Product published successfully.',
      product: mapProduct(rows[0]),
    });
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function updateProduct(req, res) {
  try {
    const productId = readPositiveInteger(req.params.productId, 'productId');
    const existingProduct = await findVendorProductById(productId, req.vendor.id);

    if (!existingProduct) {
      res.status(404).json({
        error: 'Product not found.',
      });
      return;
    }

    const payload = validateProductPayload(
      req.body,
      existingProduct.sold || 0,
      existingProduct.stock || 0
    );
    const uploadedImage = await saveUploadedFile(
      getUploadedFile(req, 'productImage'),
      path.join('shops', req.vendor.shop_id || 'vendor', 'products'),
      'product'
    );

    await getPool().execute(
      `UPDATE products
       SET name = ?, price = ?, description = ?, discount_banner = ?, stock = ?, sold = ?,
           image_url = COALESCE(?, image_url),
           image_path = COALESCE(?, image_path)
       WHERE id = ? AND vendor_id = ?`,
      [
        payload.name,
        payload.price,
        payload.description,
        payload.discountBanner,
        payload.stock,
        payload.sold,
        uploadedImage?.url || null,
        uploadedImage?.filePath || null,
        productId,
        req.vendor.id,
      ]
    );

    if (uploadedImage && existingProduct.image_path && existingProduct.image_path !== uploadedImage.filePath) {
      await deleteUploadedFile(existingProduct.image_path);
    }

    const [rows] = await getPool().execute('SELECT * FROM products WHERE id = ? LIMIT 1', [
      productId,
    ]);

    res.json({
      message: 'Product updated successfully.',
      product: mapProduct(rows[0]),
    });
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function deleteProduct(req, res) {
  try {
    const productId = readPositiveInteger(req.params.productId, 'productId');
    const existingProduct = await findVendorProductById(productId, req.vendor.id);

    if (!existingProduct) {
      res.status(404).json({
        error: 'Product not found.',
      });
      return;
    }

    await deleteVendorProductById(productId, req.vendor.id);
    await deleteUploadedFile(existingProduct.image_path);

    res.json({
      message: 'Product deleted successfully.',
    });
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  getPaymentQr,
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateAccount,
  updateShop,
  createProduct,
  updateProduct,
  deleteProduct,
};
