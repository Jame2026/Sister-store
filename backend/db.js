const mysql = require('mysql2/promise');
const { loadEnvFile } = require('./env');

let pool = null;
let initializingPromise = null;
let state = {
  ready: false,
  error: 'Database not initialized.',
  config: null,
};

function readConfig() {
  loadEnvFile();

  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sister_store',
  };
}

async function ensureDatabaseExists(config) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\`
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function ensureTablesExist(activePool) {
  await activePool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      password_reset_code_hash VARCHAR(64),
      password_reset_expires_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(120),
      phone VARCHAR(32),
      password_hash VARCHAR(255) NOT NULL,
      password_reset_code_hash VARCHAR(64),
      password_reset_expires_at DATETIME NULL,
      approval_status VARCHAR(16) NOT NULL DEFAULT 'pending',
      approved_at DATETIME NULL,
      subscription_plan VARCHAR(16) NOT NULL DEFAULT 'monthly',
      subscription_started_at DATETIME NULL,
      subscription_ends_at DATETIME NULL,
      shop_id VARCHAR(50) UNIQUE,
      shop_name VARCHAR(120),
      description TEXT,
      location VARCHAR(160),
      telegram VARCHAR(64),
      logo VARCHAR(12) DEFAULT 'SS',
      logo_image_url VARCHAR(255),
      logo_image_path VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_id INT NOT NULL,
      name VARCHAR(160) NOT NULL,
      price VARCHAR(40) NOT NULL,
      description TEXT,
      discount_banner VARCHAR(80),
      stock INT NOT NULL DEFAULT 0,
      sold INT NOT NULL DEFAULT 0,
      image_url VARCHAR(255),
      image_path VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_products_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_id INT NOT NULL,
      channel VARCHAR(24) NOT NULL DEFAULT 'storefront',
      item_count INT NOT NULL DEFAULT 0,
      total_quantity INT NOT NULL DEFAULT 0,
      total_amount DECIMAL(12, 2) NULL,
      total_label VARCHAR(120),
      currency_prefix VARCHAR(24),
      currency_suffix VARCHAR(24),
      currency_decimals TINYINT NOT NULL DEFAULT 0,
      items_json LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_bookings_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [columnRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'products'
       AND COLUMN_NAME = 'discount_banner'`
  );

  if (!Number(columnRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE products ADD COLUMN discount_banner VARCHAR(80) AFTER description'
    );
  }

  const [stockColumnRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'products'
       AND COLUMN_NAME = 'stock'`
  );

  if (!Number(stockColumnRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE products ADD COLUMN stock INT NOT NULL DEFAULT 0 AFTER discount_banner'
    );
  }

  const [locationColumnRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'location'`
  );

  if (!Number(locationColumnRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE vendors ADD COLUMN location VARCHAR(160) AFTER description'
    );
  }

  const [adminResetHashRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'admins'
       AND COLUMN_NAME = 'password_reset_code_hash'`
  );

  if (!Number(adminResetHashRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE admins ADD COLUMN password_reset_code_hash VARCHAR(64) AFTER password_hash'
    );
  }

  const [adminResetExpiryRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'admins'
       AND COLUMN_NAME = 'password_reset_expires_at'`
  );

  if (!Number(adminResetExpiryRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE admins ADD COLUMN password_reset_expires_at DATETIME NULL AFTER password_reset_code_hash'
    );
  }

  const [vendorResetHashRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'password_reset_code_hash'`
  );

  if (!Number(vendorResetHashRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE vendors ADD COLUMN password_reset_code_hash VARCHAR(64) AFTER password_hash'
    );
  }

  const [vendorFullNameRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'full_name'`
  );

  if (!Number(vendorFullNameRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE vendors ADD COLUMN full_name VARCHAR(120) AFTER email'
    );
  }

  const [vendorPhoneRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'phone'`
  );

  if (!Number(vendorPhoneRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE vendors ADD COLUMN phone VARCHAR(32) AFTER full_name'
    );
  }

  const [vendorResetExpiryRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'password_reset_expires_at'`
  );

  if (!Number(vendorResetExpiryRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE vendors ADD COLUMN password_reset_expires_at DATETIME NULL AFTER password_reset_code_hash'
    );
  }

  const [vendorApprovalStatusRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'approval_status'`
  );

  if (!Number(vendorApprovalStatusRows[0]?.column_count || 0)) {
    await activePool.query(
      "ALTER TABLE vendors ADD COLUMN approval_status VARCHAR(16) NOT NULL DEFAULT 'pending' AFTER password_reset_expires_at"
    );
    await activePool.query(
      "UPDATE vendors SET approval_status = 'approved' WHERE approval_status = 'pending'"
    );
  }

  const [vendorApprovedAtRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'approved_at'`
  );

  if (!Number(vendorApprovedAtRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE vendors ADD COLUMN approved_at DATETIME NULL AFTER approval_status'
    );
    await activePool.query(
      "UPDATE vendors SET approved_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE approval_status = 'approved' AND approved_at IS NULL"
    );
  }

  const [vendorPlanRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'subscription_plan'`
  );

  if (!Number(vendorPlanRows[0]?.column_count || 0)) {
    await activePool.query(
      "ALTER TABLE vendors ADD COLUMN subscription_plan VARCHAR(16) NOT NULL DEFAULT 'monthly' AFTER password_reset_expires_at"
    );
  }

  const [vendorPlanStartRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'subscription_started_at'`
  );

  if (!Number(vendorPlanStartRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE vendors ADD COLUMN subscription_started_at DATETIME NULL AFTER subscription_plan'
    );
  }

  const [vendorPlanEndRows] = await activePool.execute(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'vendors'
       AND COLUMN_NAME = 'subscription_ends_at'`
  );

  if (!Number(vendorPlanEndRows[0]?.column_count || 0)) {
    await activePool.query(
      'ALTER TABLE vendors ADD COLUMN subscription_ends_at DATETIME NULL AFTER subscription_started_at'
    );
  }

  await activePool.query(`
    UPDATE vendors
    SET
      approval_status = COALESCE(NULLIF(approval_status, ''), 'pending'),
      subscription_plan = COALESCE(NULLIF(subscription_plan, ''), 'monthly'),
      subscription_started_at = COALESCE(subscription_started_at, created_at, CURRENT_TIMESTAMP),
      subscription_ends_at = COALESCE(
        subscription_ends_at,
        CASE
          WHEN COALESCE(NULLIF(subscription_plan, ''), 'monthly') = 'yearly'
            THEN DATE_ADD(COALESCE(created_at, CURRENT_TIMESTAMP), INTERVAL 365 DAY)
          ELSE DATE_ADD(COALESCE(created_at, CURRENT_TIMESTAMP), INTERVAL 30 DAY)
        END
      )
  `);

}

async function initializeDatabase() {
  if (pool) {
    return state;
  }

  if (initializingPromise) {
    return initializingPromise;
  }

  initializingPromise = (async () => {
    const config = readConfig();
    let nextPool = null;

    try {
      await ensureDatabaseExists(config);

      nextPool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        namedPlaceholders: true,
      });

      await ensureTablesExist(nextPool);

      pool = nextPool;
      state = {
        ready: true,
        error: null,
        config,
      };
    } catch (error) {
      if (nextPool) {
        try {
          await nextPool.end();
        } catch {
        }
      }

      pool = null;
      state = {
        ready: false,
        error: `Database initialization failed: ${error.message}`,
        config,
      };
    } finally {
      initializingPromise = null;
    }

    return state;
  })();

  return initializingPromise;
}

function getPool() {
  return pool;
}

function getDatabaseState() {
  return state;
}

module.exports = {
  initializeDatabase,
  getPool,
  getDatabaseState,
};
