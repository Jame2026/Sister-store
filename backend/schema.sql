CREATE DATABASE IF NOT EXISTS mini_online_store
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mini_online_store;

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
);

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
);

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
);
