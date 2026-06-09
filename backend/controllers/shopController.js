const {
  normalizeShopId,
  parsePurchaseItems,
  buildBookingSnapshot,
  findVendorByShopId,
  listProductsForVendor,
  mapShop,
  getPool,
} = require('../services/storeService');
const { sendError } = require('./baseController');

async function getShop(req, res) {
  try {
    const shopId = normalizeShopId(req.params.shopId);

    if (!shopId) {
      res.status(400).json({
        error: 'Invalid shopId.',
      });
      return;
    }

    const vendor = await findVendorByShopId(shopId);

    if (!vendor) {
      res.status(404).json({
        error: 'Shop not found.',
      });
      return;
    }

    const products = await listProductsForVendor(vendor.id);

    res.json({
      shop: mapShop(vendor, products),
    });
  } catch (error) {
    sendError(res, error);
  }
}

async function purchase(req, res) {
  const connection = await getPool().getConnection();

  try {
    const shopId = normalizeShopId(req.params.shopId);

    if (!shopId) {
      res.status(400).json({
        error: 'Invalid shopId.',
      });
      return;
    }

    const items = parsePurchaseItems(req.body);

    if (!items.length) {
      res.status(400).json({
        error: 'Choose at least one product to buy.',
      });
      return;
    }

    await connection.beginTransaction();

    const [vendorRows] = await connection.execute(
      'SELECT * FROM vendors WHERE shop_id = ? LIMIT 1',
      [shopId]
    );
    const vendor = vendorRows[0];

    if (!vendor) {
      await connection.rollback();
      res.status(404).json({
        error: 'Shop not found.',
      });
      return;
    }

    const productIds = items.map((item) => item.productId);
    const placeholders = productIds.map(() => '?').join(', ');
    const [productRows] = await connection.execute(
      `SELECT * FROM products
       WHERE vendor_id = ? AND id IN (${placeholders})
       FOR UPDATE`,
      [vendor.id, ...productIds]
    );

    const productMap = new Map(productRows.map((product) => [Number(product.id), product]));

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new Error(`Product ${item.productId} is not available in this shop.`);
      }

      if (Number(product.stock || 0) < item.quantity) {
        throw new Error(
          `"${product.name}" only has ${Number(product.stock || 0)} item${
            Number(product.stock || 0) === 1 ? '' : 's'
          } left.`
        );
      }
    }

    for (const item of items) {
      await connection.execute(
        `UPDATE products
         SET stock = stock - ?, sold = sold + ?
         WHERE id = ? AND vendor_id = ?`,
        [item.quantity, item.quantity, item.productId, vendor.id]
      );
    }

    const bookingSnapshot = buildBookingSnapshot(items, productMap);
    await connection.execute(
      `INSERT INTO bookings (
         vendor_id,
         channel,
         item_count,
         total_quantity,
         total_amount,
         total_label,
         currency_prefix,
         currency_suffix,
         currency_decimals,
         items_json
        )
       VALUES (?, 'storefront', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendor.id,
        bookingSnapshot.itemCount,
        bookingSnapshot.totalQuantity,
        bookingSnapshot.totalAmount,
        bookingSnapshot.totalLabel || null,
        bookingSnapshot.currencyPrefix || null,
        bookingSnapshot.currencySuffix || null,
        bookingSnapshot.currencyDecimals,
        JSON.stringify(bookingSnapshot.items),
      ]
    );

    await connection.commit();

    const products = await listProductsForVendor(vendor.id);

    res.json({
      message: 'Purchase recorded successfully.',
      shop: mapShop(vendor, products),
      purchasedItems: items,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
    }

    sendError(res, error, 400);
  } finally {
    connection.release();
  }
}

module.exports = {
  getShop,
  purchase,
};
