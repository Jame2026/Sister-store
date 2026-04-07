const mysql = require('mysql2/promise');
const { loadEnvFile } = require('./env');

let pool = null;
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
    CREATE TABLE IF NOT EXISTS vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
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
      channel VARCHAR(24) NOT NULL DEFAULT 'telegram',
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
}

async function initializeDatabase() {
  if (pool) {
    return state;
  }

  const config = readConfig();

  try {
    await ensureDatabaseExists(config);

    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });

    await ensureTablesExist(pool);

    state = {
      ready: true,
      error: null,
      config,
    };
  } catch (error) {
    state = {
      ready: false,
      error: `Database initialization failed: ${error.message}`,
      config,
    };
  }

  return state;
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
