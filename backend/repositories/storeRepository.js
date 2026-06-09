const { getPool } = require('../config/db');

async function findProductById(productId) {
  const [rows] = await getPool().execute('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
  return rows[0] || null;
}

async function findVendorProductById(productId, vendorId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM products WHERE id = ? AND vendor_id = ? LIMIT 1',
    [productId, vendorId]
  );

  return rows[0] || null;
}

async function deleteProductById(productId) {
  await getPool().execute('DELETE FROM products WHERE id = ?', [productId]);
}

async function deleteVendorProductById(productId, vendorId) {
  await getPool().execute('DELETE FROM products WHERE id = ? AND vendor_id = ?', [
    productId,
    vendorId,
  ]);
}

async function listVendorProductImages(vendorId) {
  const [rows] = await getPool().execute(
    'SELECT image_path FROM products WHERE vendor_id = ?',
    [vendorId]
  );

  return rows;
}

module.exports = {
  findProductById,
  findVendorProductById,
  deleteProductById,
  deleteVendorProductById,
  listVendorProductImages,
};
