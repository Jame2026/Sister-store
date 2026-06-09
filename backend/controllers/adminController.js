const {
  bcrypt,
  validateEmail,
  validatePassword,
  validateResetCode,
  generatePasswordResetCode,
  buildPasswordResetExpiry,
  dispatchPasswordResetCode,
  storePasswordResetCode,
  clearPasswordResetCode,
  hashPasswordResetCode,
  hasPasswordResetExpired,
  findAdminByEmail,
  findAdminById,
  countAdmins,
  issueAdminToken,
  mapAdminAccount,
  readVendorApproval,
  deleteUploadedFile,
  fetchAdminOverview,
  listAdminProducts,
  findVendorById,
  getPool,
} = require('../services/storeService');
const { findProductById, deleteProductById, listVendorProductImages } = require('../repositories/storeRepository');
const { buildVendorStatusPayload, buildDeletedVendorPayload } = require('../models/storeModel');
const { sendError, readPositiveInteger } = require('./baseController');

async function getAuthStatus(req, res) {
  try {
    const totalAdmins = await countAdmins();

    res.json({
      initialized: totalAdmins > 0,
    });
  } catch (error) {
    sendError(res, error);
  }
}

async function bootstrap(req, res) {
  try {
    const totalAdmins = await countAdmins();

    if (totalAdmins > 0) {
      res.status(409).json({
        error: 'An admin account already exists. Please log in.',
      });
      return;
    }

    const email = validateEmail(req.body.email);
    const password = validatePassword(req.body.password);
    const existingAdmin = await findAdminByEmail(email);

    if (existingAdmin) {
      res.status(409).json({
        error: 'This admin email is already registered.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await getPool().execute(
      'INSERT INTO admins (email, password_hash) VALUES (?, ?)',
      [email, passwordHash]
    );
    const admin = await findAdminById(result.insertId);

    res.status(201).json({
      token: issueAdminToken(admin),
      account: mapAdminAccount(admin),
    });
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function login(req, res) {
  try {
    const email = validateEmail(req.body.email);
    const password = validatePassword(req.body.password);
    const totalAdmins = await countAdmins();

    if (!totalAdmins) {
      res.status(403).json({
        error: 'No admin account exists yet. Create the first admin first.',
      });
      return;
    }

    const admin = await findAdminByEmail(email);

    if (!admin) {
      res.status(401).json({
        error: 'Email or password is incorrect.',
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatches) {
      res.status(401).json({
        error: 'Email or password is incorrect.',
      });
      return;
    }

    res.json({
      token: issueAdminToken(admin),
      account: mapAdminAccount(admin),
    });
  } catch (error) {
    sendError(res, error, 400);
  }
}

async function forgotPassword(req, res) {
  try {
    const email = validateEmail(req.body.email);
    const totalAdmins = await countAdmins();

    if (!totalAdmins) {
      res.status(403).json({
        error: 'No admin account exists yet. Create the first admin first.',
      });
      return;
    }

    const admin = await findAdminByEmail(email);

    if (!admin) {
      res.status(404).json({
        error: 'No admin account matches that email.',
      });
      return;
    }

    const resetCode = generatePasswordResetCode();
    const expiresAt = buildPasswordResetExpiry();
    await storePasswordResetCode('admins', admin.id, resetCode, expiresAt);
    const delivery = await dispatchPasswordResetCode({
      email: admin.email,
      audienceLabel: 'Admin',
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
    const admin = await findAdminByEmail(email);

    if (!admin) {
      res.status(404).json({
        error: 'No admin account matches that email.',
      });
      return;
    }

    if (
      !admin.password_reset_code_hash ||
      hasPasswordResetExpired(admin.password_reset_expires_at)
    ) {
      await clearPasswordResetCode('admins', admin.id);
      res.status(400).json({
        error: 'This reset code has expired. Request a new one.',
      });
      return;
    }

    if (hashPasswordResetCode(resetCode) !== admin.password_reset_code_hash) {
      res.status(400).json({
        error: 'The reset code is incorrect.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await getPool().execute(
      `UPDATE admins
       SET password_hash = ?, password_reset_code_hash = NULL, password_reset_expires_at = NULL
       WHERE id = ?`,
      [passwordHash, admin.id]
    );

    res.json({
      message: 'Admin password reset successfully. You can sign in with the new password now.',
    });
  } catch (error) {
    sendError(res, error, 400);
  }
}

function getMe(req, res) {
  res.json({
    account: mapAdminAccount(req.admin),
  });
}

async function getOverview(req, res) {
  try {
    const overview = await fetchAdminOverview();
    res.json(overview);
  } catch (error) {
    sendError(res, error);
  }
}

async function getProducts(req, res) {
  try {
    const products = await listAdminProducts();
    res.json({ products });
  } catch (error) {
    sendError(res, error);
  }
}

function updateProduct(req, res) {
  res.status(403).json({
    error: 'Admin editing is disabled. Admin can only review and delete.',
  });
}

async function deleteProduct(req, res) {
  try {
    const productId = readPositiveInteger(req.params.productId, 'productId');
    const existingProduct = await findProductById(productId);

    if (!existingProduct) {
      res.status(404).json({
        error: 'Product not found.',
      });
      return;
    }

    await deleteProductById(productId);
    await deleteUploadedFile(existingProduct.image_path);

    res.json({
      message: 'Product deleted successfully.',
      productId,
      vendorId: Number(existingProduct.vendor_id || 0),
    });
  } catch (error) {
    sendError(res, error);
  }
}

async function approveVendor(req, res) {
  try {
    const vendorId = readPositiveInteger(req.params.vendorId, 'vendorId');
    const vendor = await findVendorById(vendorId);

    if (!vendor) {
      res.status(404).json({
        error: 'Vendor not found.',
      });
      return;
    }

    if (String(vendor.approval_status || '').toLowerCase() === 'approved') {
      res.json({
        message: 'Vendor is already approved.',
        vendor: buildVendorStatusPayload(vendor, readVendorApproval(vendor)),
      });
      return;
    }

    const approvedAt = new Date();
    await getPool().execute(
      `UPDATE vendors
       SET approval_status = 'approved', approved_at = ?
       WHERE id = ?`,
      [approvedAt, vendorId]
    );

    const updatedVendor = await findVendorById(vendorId);

    res.json({
      message: 'Vendor approved successfully.',
      vendor: buildVendorStatusPayload(updatedVendor, readVendorApproval(updatedVendor)),
    });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteVendor(req, res) {
  try {
    const vendorId = readPositiveInteger(req.params.vendorId, 'vendorId');
    const vendor = await findVendorById(vendorId);

    if (!vendor) {
      res.status(404).json({
        error: 'Vendor not found.',
      });
      return;
    }

    const productRows = await listVendorProductImages(vendorId);
    await getPool().execute('DELETE FROM vendors WHERE id = ?', [vendorId]);

    await Promise.all([
      deleteUploadedFile(vendor.logo_image_path),
      ...productRows.map((product) => deleteUploadedFile(product.image_path)),
    ]);

    res.json(buildDeletedVendorPayload(vendor, vendorId, productRows.length));
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  getAuthStatus,
  bootstrap,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  getOverview,
  getProducts,
  updateProduct,
  deleteProduct,
  approveVendor,
  deleteVendor,
};
