const fs = require('fs');
const path = require('path');
const { createHash, randomInt, randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v2: cloudinary } = require('cloudinary');
const { loadEnvFile } = require('./env');
const { initializeDatabase, getDatabaseState, getPool } = require('./db');

loadEnvFile();

const app = express();
const port = Number(process.env.PORT || 3000);
const uploadsRoot = path.join(__dirname, 'uploads');
const jwtSecret = process.env.JWT_SECRET || 'change-this-secret';
const passwordResetTtlMinutes = Math.max(
  5,
  Number(process.env.PASSWORD_RESET_TTL_MINUTES || 15) || 15
);

function readOptionalEnvValue(name) {
  const normalized = String(process.env[name] || '').trim();

  if (!normalized) {
    return '';
  }

  if (['null', 'undefined'].includes(normalized.toLowerCase())) {
    return '';
  }

  return normalized;
}

const mailScheme = readOptionalEnvValue('MAIL_SCHEME').toLowerCase();
const mailHost = readOptionalEnvValue('MAIL_HOST');
const mailPort = Number(process.env.MAIL_PORT || 0) || 0;
const mailUsername = readOptionalEnvValue('MAIL_USERNAME');
const mailPassword = readOptionalEnvValue('MAIL_PASSWORD');
const mailFromAddress = readOptionalEnvValue('MAIL_FROM_ADDRESS') || mailUsername;
const mailFromName = readOptionalEnvValue('MAIL_FROM_NAME');
const mailSecure = ['smtps', 'ssl'].includes(mailScheme) || mailPort === 465;
const passwordResetMailEnabled = Boolean(
  mailHost && mailPort > 0 && mailUsername && mailPassword && mailFromAddress
);
const mailTransport = passwordResetMailEnabled
  ? nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailSecure,
      auth: {
        user: mailUsername,
        pass: mailPassword,
      },
    })
  : null;
const cloudinaryFolderBase = String(process.env.CLOUDINARY_FOLDER || '')
  .trim()
  .replace(/^\/+|\/+$/g, '');
const cloudinaryEnabled = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: String(process.env.CLOUDINARY_SECURE_URL || 'true').toLowerCase() !== 'false',
  });
}

const allowedOrigins = [
  'https://online-store-three-xi.vercel.app',
  'https://vendor-store-beta.vercel.app',
  'https://customer-store.vercel.app',

  'https://online-store-kjqz70bk3-jamekhouen-8551s-projects.vercel.app'
];

const configuredAllowedOriginEntries = readOptionalEnvValue('FRONTEND_ORIGINS')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowedOriginEntries = configuredAllowedOriginEntries.length
  ? configuredAllowedOriginEntries
  : defaultAllowedOrigins;

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOriginPattern(value) {
  if (!value.includes('*')) {
    return null;
  }

  return new RegExp(`^${escapeRegex(value).replace(/\\\*/g, '.*')}$`);
}

const allowedOriginPatterns = allowedOriginEntries
  .map((value) => buildOriginPattern(value))
  .filter(Boolean);
const allowedOrigins = allowedOriginEntries.filter((value) => !value.includes('*'));

function isAllowedOrigin(origin) {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
}

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const allowedQrImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const vendorSubscriptionPlans = {
  monthly: {
    code: 'monthly',
    label: 'Monthly',
    priceUsd: 10,
    priceLabel: '$10 per month',
    durationDays: 30,
  },
  yearly: {
    code: 'yearly',
    label: 'Yearly',
    priceUsd: 100,
    priceLabel: '$100 per year',
    durationDays: 365,
  },
};

const vendorApprovalStatuses = {
  pending: {
    code: 'pending',
    label: 'Pending Approval',
    canPublishProducts: false,
  },
  approved: {
    code: 'approved',
    label: 'Approved',
    canPublishProducts: true,
  },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error('Only JPG, PNG, WEBP, and GIF images are allowed.'));
  },
});

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') // optional for all Vercel previews
    ) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));


app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));

async function ensureDatabase(req, res, next) {
  let state = getDatabaseState();

  if (!state.ready) {
    state = await initializeDatabase();
  }

  if (!state.ready) {
    res.status(503).json({
      error: state.error,
    });
    return;
  }

  next();
}

function normalizeShopId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function buildLogo(shopName) {
  const initials = String(shopName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return initials || 'SS';
}

function readRequiredString(value, fieldName, maxLength = 200) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized.slice(0, maxLength);
}

function readOptionalString(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

function validateEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();

  if (!normalized || !normalized.includes('@')) {
    throw new Error('A valid email is required.');
  }

  return normalized;
}

function validatePassword(password) {
  const normalized = String(password || '');

  if (normalized.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  return normalized;
}

function readVendorSubscriptionPlan(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  const plan = vendorSubscriptionPlans[normalized];

  if (!plan) {
    throw new Error('Choose a vendor plan: $10 per month or $100 per year.');
  }

  return plan;
}

function buildVendorSubscriptionDates(plan, baseDate = new Date()) {
  const startedAt = new Date(baseDate);
  const endsAt = new Date(baseDate);
  endsAt.setDate(endsAt.getDate() + plan.durationDays);

  return {
    startedAt,
    endsAt,
  };
}

function readVendorApproval(vendor) {
  const approval =
    vendorApprovalStatuses[String(vendor.approval_status || 'pending').toLowerCase()] ||
    vendorApprovalStatuses.pending;

  return {
    code: approval.code,
    label: approval.label,
    approvedAt: vendor.approved_at || null,
    canPublishProducts: approval.canPublishProducts,
  };
}

function validateResetCode(resetCode) {
  const normalized = String(resetCode || '').trim();

  if (!/^\d{6}$/.test(normalized)) {
    throw new Error('Enter the 6-digit reset code.');
  }

  return normalized;
}

function generatePasswordResetCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function hashPasswordResetCode(resetCode) {
  return createHash('sha256').update(String(resetCode)).digest('hex');
}

function buildPasswordResetExpiry() {
  return new Date(Date.now() + passwordResetTtlMinutes * 60 * 1000);
}

function hasPasswordResetExpired(expiresAt) {
  if (!expiresAt) {
    return true;
  }

  const parsed = new Date(expiresAt);

  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return parsed.getTime() < Date.now();
}

function formatMailSender() {
  if (!mailFromAddress) {
    return '';
  }

  if (!mailFromName) {
    return mailFromAddress;
  }

  return `"${mailFromName.replace(/"/g, '\\"')}" <${mailFromAddress}>`;
}

function buildPasswordResetMessage({ audienceLabel, resetCode, expiresAt }) {
  const expiresAtLabel = expiresAt.toLocaleString();
  const subject = `${audienceLabel} password reset code`;
  const text = [
    `You requested a password reset for your ${audienceLabel.toLowerCase()} account.`,
    '',
    `Reset code: ${resetCode}`,
    `This code expires at: ${expiresAtLabel}`,
    '',
    'If you did not request this reset, you can ignore this email.',
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>You requested a password reset for your ${audienceLabel.toLowerCase()} account.</p>
      <p style="margin: 20px 0;">
        <strong style="font-size: 24px; letter-spacing: 4px;">${resetCode}</strong>
      </p>
      <p>This code expires at <strong>${expiresAtLabel}</strong>.</p>
      <p>If you did not request this reset, you can ignore this email.</p>
    </div>
  `;

  return {
    subject,
    text,
    html,
  };
}

async function dispatchPasswordResetCode({ email, audienceLabel, resetCode, expiresAt }) {
  if (!mailTransport) {
    return {
      delivery: 'manual',
      message:
        'Reset code created. Email delivery is not configured yet, so use the code shown below to finish resetting the password.',
      resetCode,
      expiresAt: expiresAt.toISOString(),
    };
  }

  const message = buildPasswordResetMessage({
    audienceLabel,
    resetCode,
    expiresAt,
  });

  await mailTransport.sendMail({
    from: formatMailSender(),
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return {
    delivery: 'email',
    message: `Reset code sent to ${email}. Check your inbox and spam folder.`,
    expiresAt: expiresAt.toISOString(),
  };
}

function readNonNegativeInteger(value, fieldName, fallback = 0) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a whole number that is 0 or greater.`);
  }

  return parsed;
}

function validateVendorPayload(body) {
  const shopName = readRequiredString(body.shopName, 'shopName', 120);
  const description = readOptionalString(body.description, 1000);
  const location = readOptionalString(body.location, 160);
  const telegram = readRequiredString(body.telegram, 'telegram', 64).replace(/^@+/, '');
  const logo = readOptionalString(body.logo, 12) || buildLogo(shopName);

  return {
    shopName,
    description,
    location,
    telegram,
    logo,
  };
}

function validateVendorAccountPayload(body) {
  const email = validateEmail(body.email);
  const fullName = readOptionalString(body.fullName, 120);
  const phone = readOptionalString(body.phone, 32);

  return {
    email,
    fullName,
    phone,
  };
}

function validateProductPayload(body, existingSold = 0, existingStock = 0) {
  const name = readRequiredString(body.name, 'name', 160);
  const price = readRequiredString(body.price, 'price', 40);
  const description = readOptionalString(body.desc || body.description, 2000);
  const discountBanner = readOptionalString(body.discountBanner, 80);
  const sold = Number.isFinite(Number(body.sold)) ? Math.max(0, Number(body.sold)) : existingSold;
  const stock = readNonNegativeInteger(body.stock, 'stock', existingStock);

  return {
    name,
    price,
    description,
    discountBanner,
    stock,
    sold,
  };
}

function parsePurchaseItems(body) {
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (!rawItems.length) {
    throw new Error('Choose at least one product to buy.');
  }

  return rawItems.map((item, index) => {
    const productId = Number(item?.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error(`Item ${index + 1} has an invalid productId.`);
    }

    return {
      productId,
      quantity: readNonNegativeInteger(item?.quantity, `Item ${index + 1} quantity`),
    };
  }).filter((item) => item.quantity > 0);
}

function getUploadedFile(req, fieldName) {
  return req.files?.[fieldName]?.[0] || null;
}

function getFileExtension(file) {
  const originalExtension = path.extname(file.originalname || '').toLowerCase();

  if (originalExtension && originalExtension.length <= 10) {
    return originalExtension;
  }

  switch (file.mimetype) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.bin';
  }
}

function normalizeUploadPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function isAllowedQrImageFile(fileName) {
  return allowedQrImageExtensions.has(path.extname(String(fileName || '')).toLowerCase());
}

async function findPaymentQrUpload() {
  const uploadEntries = await fs.promises.readdir(uploadsRoot, {
    withFileTypes: true,
  });
  const fileNames = uploadEntries
    .filter((entry) => entry.isFile() && isAllowedQrImageFile(entry.name))
    .map((entry) => entry.name);

  if (!fileNames.length) {
    return null;
  }

  const prioritizedFileName =
    fileNames.find((fileName) => /^image\.(png|jpg|jpeg|webp|gif)$/i.test(fileName)) ||
    fileNames.find((fileName) => /qr|payment/i.test(fileName)) ||
    fileNames.sort((left, right) => left.localeCompare(right))[0];

  return {
    fileName: prioritizedFileName,
    url: `/uploads/${encodeURIComponent(prioritizedFileName)}`,
  };
}

function normalizeStorageFolder(targetFolder) {
  return String(targetFolder || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function buildCloudinaryFolder(targetFolder) {
  return [cloudinaryFolderBase, normalizeStorageFolder(targetFolder)].filter(Boolean).join('/');
}

function isCloudinaryPath(filePathToDelete) {
  return String(filePathToDelete || '').startsWith('cloudinary:');
}

function extractCloudinaryPublicId(filePathToDelete) {
  return String(filePathToDelete || '').replace(/^cloudinary:/, '').trim();
}

async function uploadToCloudinary(file, targetFolder, filenameBase) {
  const folder = buildCloudinaryFolder(targetFolder);
  const publicId = `${filenameBase}-${randomUUID()}`;

  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder || undefined,
        public_id: publicId,
        resource_type: 'image',
      },
      (error, uploadedFile) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(uploadedFile);
      }
    );

    uploadStream.end(file.buffer);
  });

  if (!result?.secure_url || !result.public_id) {
    throw new Error('Cloudinary upload did not return a valid file URL.');
  }

  return {
    filePath: `cloudinary:${result.public_id}`,
    url: result.secure_url,
  };
}

async function saveUploadedFile(file, targetFolder, filenameBase) {
  if (!file) {
    return null;
  }

  if (cloudinaryEnabled) {
    return uploadToCloudinary(file, targetFolder, filenameBase);
  }

  const targetDirectory = path.join(uploadsRoot, targetFolder);
  await fs.promises.mkdir(targetDirectory, { recursive: true });

  const fileName = `${filenameBase}-${randomUUID()}${getFileExtension(file)}`;
  const absolutePath = path.join(targetDirectory, fileName);
  await fs.promises.writeFile(absolutePath, file.buffer);

  const relativePath = normalizeUploadPath(path.relative(__dirname, absolutePath));
  return {
    filePath: relativePath,
    url: `/${relativePath}`,
  };
}

async function deleteUploadedFile(filePathToDelete) {
  if (!filePathToDelete) {
    return;
  }

  if (isCloudinaryPath(filePathToDelete)) {
    if (!cloudinaryEnabled) {
      return;
    }

    const publicId = extractCloudinaryPublicId(filePathToDelete);

    if (!publicId) {
      return;
    }

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
    } catch (error) {
      console.warn(`Unable to delete Cloudinary file "${publicId}": ${error.message}`);
    }

    return;
  }

  const absolutePath = path.join(__dirname, filePathToDelete.replace(/^\/+/, ''));

  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Unable to delete old file "${absolutePath}": ${error.message}`);
    }
  }
}

function issueToken(vendor) {
  return jwt.sign(
    {
      role: 'vendor',
      vendorId: vendor.id,
      email: vendor.email,
    },
    jwtSecret,
    {
      expiresIn: '7d',
    }
  );
}

function issueAdminToken(admin) {
  return jwt.sign(
    {
      role: 'admin',
      adminId: admin.id,
      email: admin.email,
    },
    jwtSecret,
    {
      expiresIn: '7d',
    }
  );
}

function mapAdminAccount(admin) {
  return {
    id: admin.id,
    email: admin.email,
    role: 'admin',
    createdAt: admin.created_at || null,
    updatedAt: admin.updated_at || null,
  };
}

function mapVendorSubscription(vendor) {
  const plan =
    vendorSubscriptionPlans[String(vendor.subscription_plan || 'monthly').toLowerCase()] ||
    vendorSubscriptionPlans.monthly;
  const startedAt = vendor.subscription_started_at || vendor.created_at || null;
  const endsAt = vendor.subscription_ends_at || null;

  return {
    code: plan.code,
    label: plan.label,
    priceUsd: plan.priceUsd,
    priceLabel: plan.priceLabel,
    startedAt,
    endsAt,
  };
}

function mapVendorAccount(vendor) {
  return {
    id: vendor.id,
    email: vendor.email,
    fullName: vendor.full_name || '',
    phone: vendor.phone || '',
    role: 'vendor',
    shopId: vendor.shop_id || '',
    shopName: vendor.shop_name || '',
    approval: readVendorApproval(vendor),
    subscription: mapVendorSubscription(vendor),
    createdAt: vendor.created_at || null,
    updatedAt: vendor.updated_at || null,
  };
}

function mapShop(vendor, products) {
  return {
    id: vendor.id,
    shopId: vendor.shop_id,
    handle: vendor.shop_id,
    name: vendor.shop_name,
    shopName: vendor.shop_name,
    description: vendor.description || '',
    location: vendor.location || '',
    telegram: vendor.telegram || '',
    logo: vendor.logo || buildLogo(vendor.shop_name),
    logoImageUrl: vendor.logo_image_url || '',
    createdAt: vendor.created_at || null,
    updatedAt: vendor.updated_at || null,
    publicPath: `/shop/${vendor.shop_id}`,
    products,
  };
}

function mapProduct(product) {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    desc: product.description || '',
    discountBanner: product.discount_banner || '',
    stock: Number(product.stock || 0),
    sold: product.sold || 0,
    imageUrl: product.image_url || '',
    createdAt: product.created_at || null,
    updatedAt: product.updated_at || null,
  };
}

function mapAdminProduct(product) {
  return {
    id: product.id,
    name: product.name,
    vendorId: Number(product.vendor_id || 0),
    vendorName: product.shop_name || 'Unnamed shop',
    vendorHandle: product.shop_id || '',
    vendorOwner: product.email || '',
    price: product.price,
    stock: Number(product.stock || 0),
    sold: Number(product.sold || 0),
    updatedAt: product.updated_at || null,
  };
}

function parsePriceDetails(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/-?\d[\d,]*(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const amount = Number(match[0].replace(/,/g, ''));

  if (!Number.isFinite(amount)) {
    return null;
  }

  return {
    amount,
    decimals: match[0].includes('.') ? match[0].split('.')[1].length : 0,
    prefix: raw.slice(0, match.index),
    suffix: raw.slice(match.index + match[0].length),
  };
}

function formatPriceFromPattern(pattern, amount) {
  if (!pattern || !Number.isFinite(amount)) {
    return '';
  }

  const formattedAmount = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: pattern.decimals,
    maximumFractionDigits: pattern.decimals,
  });

  return `${pattern.prefix}${formattedAmount}${pattern.suffix}`.trim();
}

function parseJsonSafely(value, fallbackValue) {
  try {
    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
}

function buildBookingSnapshot(items, productMap) {
  const lineItems = items.map((item) => {
    const product = productMap.get(item.productId);
    const pricePattern = parsePriceDetails(product?.price);
    const quantity = Number(item.quantity || 0);
    const lineAmount = pricePattern ? pricePattern.amount * quantity : null;

    return {
      productId: Number(item.productId),
      name: product?.name || `Product ${item.productId}`,
      price: product?.price || '',
      quantity,
      lineAmount,
      lineTotalText: pricePattern ? formatPriceFromPattern(pricePattern, lineAmount) : '',
      pricePattern,
    };
  });

  const parsedItems = lineItems.filter(
    (item) => item.pricePattern && Number.isFinite(item.lineAmount)
  );
  const allItemsPriced = parsedItems.length === lineItems.length && lineItems.length > 0;
  const totalAmount = allItemsPriced
    ? parsedItems.reduce((sum, item) => sum + Number(item.lineAmount || 0), 0)
    : null;
  const basePattern = parsedItems[0]?.pricePattern || null;
  const samePattern =
    allItemsPriced &&
    parsedItems.every(
      (item) =>
        item.pricePattern.prefix === basePattern?.prefix &&
        item.pricePattern.suffix === basePattern?.suffix &&
        item.pricePattern.decimals === basePattern?.decimals
    );
  const totalLabel =
    samePattern && Number.isFinite(totalAmount)
      ? formatPriceFromPattern(basePattern, totalAmount)
      : '';

  return {
    itemCount: lineItems.length,
    totalQuantity: lineItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    totalAmount: Number.isFinite(totalAmount) ? Number(totalAmount.toFixed(2)) : null,
    totalLabel,
    currencyPrefix: samePattern ? basePattern?.prefix || '' : '',
    currencySuffix: samePattern ? basePattern?.suffix || '' : '',
    currencyDecimals: samePattern ? basePattern?.decimals || 0 : 0,
    items: lineItems.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      lineAmount: Number.isFinite(item.lineAmount) ? Number(item.lineAmount.toFixed(2)) : null,
      lineTotalText: item.lineTotalText,
    })),
  };
}

function formatDateOnly(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

async function findAdminByEmail(email) {
  const [rows] = await getPool().execute(
    'SELECT * FROM admins WHERE email = ? LIMIT 1',
    [email]
  );

  return rows[0] || null;
}

async function findAdminById(adminId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM admins WHERE id = ? LIMIT 1',
    [adminId]
  );

  return rows[0] || null;
}

async function countAdmins() {
  const [[row]] = await getPool().query('SELECT COUNT(*) AS total_admins FROM admins');
  return Number(row?.total_admins || 0);
}

async function storePasswordResetCode(tableName, accountId, resetCode, expiresAt) {
  await getPool().execute(
    `UPDATE ${tableName}
     SET password_reset_code_hash = ?, password_reset_expires_at = ?
     WHERE id = ?`,
    [hashPasswordResetCode(resetCode), expiresAt, accountId]
  );
}

async function clearPasswordResetCode(tableName, accountId) {
  await getPool().execute(
    `UPDATE ${tableName}
     SET password_reset_code_hash = NULL, password_reset_expires_at = NULL
     WHERE id = ?`,
    [accountId]
  );
}

async function findVendorByEmail(email) {
  const [rows] = await getPool().execute(
    'SELECT * FROM vendors WHERE email = ? LIMIT 1',
    [email]
  );

  return rows[0] || null;
}

async function findVendorById(vendorId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM vendors WHERE id = ? LIMIT 1',
    [vendorId]
  );

  return rows[0] || null;
}

async function findVendorByShopId(shopId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM vendors WHERE shop_id = ? LIMIT 1',
    [shopId]
  );

  return rows[0] || null;
}

async function listProductsForVendor(vendorId) {
  const [rows] = await getPool().execute(
    'SELECT * FROM products WHERE vendor_id = ? ORDER BY created_at ASC',
    [vendorId]
  );

  return rows.map(mapProduct);
}

async function listAdminProducts() {
  const [rows] = await getPool().query(`
    SELECT
      products.*,
      vendors.shop_name,
      vendors.shop_id,
      vendors.email
    FROM products
    INNER JOIN vendors ON vendors.id = products.vendor_id
    ORDER BY vendors.shop_name ASC, products.created_at DESC
  `);

  return rows.map(mapAdminProduct);
}

async function fetchVendorBookingInsights(vendorId) {
  const pool = getPool();
  const [[summaryRow]] = await pool.execute(
    `SELECT
       COUNT(*) AS total_bookings,
       COALESCE(SUM(total_quantity), 0) AS total_booked_quantity,
       COALESCE(SUM(total_amount), 0) AS total_income,
       MAX(created_at) AS last_booking_at
     FROM bookings
     WHERE vendor_id = ?`,
    [vendorId]
  );
  const [bookingRows] = await pool.execute(
    `SELECT
       id,
       channel,
       item_count,
       total_quantity,
       total_amount,
       total_label,
       currency_prefix,
       currency_suffix,
       currency_decimals,
       items_json,
       created_at
     FROM bookings
     WHERE vendor_id = ?
     ORDER BY created_at DESC
     LIMIT 8`,
    [vendorId]
  );

  const totalBookings = Number(summaryRow?.total_bookings || 0);
  const totalBookedQuantity = Number(summaryRow?.total_booked_quantity || 0);
  const totalIncome = Number(summaryRow?.total_income || 0);
  const latestPatternRow = bookingRows.find(
    (booking) => booking.total_amount != null && Number.isFinite(Number(booking.total_amount))
  );
  const totalIncomeLabel = latestPatternRow
    ? formatPriceFromPattern(
        {
          prefix: latestPatternRow.currency_prefix || '',
          suffix: latestPatternRow.currency_suffix || '',
          decimals: Number(latestPatternRow.currency_decimals || 0),
        },
        totalIncome
      )
    : totalIncome > 0
      ? totalIncome.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : '';

  return {
    analytics: {
      totalBookings,
      totalBookedQuantity,
      totalIncome,
      totalIncomeLabel,
      lastBookingAt: summaryRow?.last_booking_at || null,
    },
    bookings: bookingRows.map((booking) => {
      const items = parseJsonSafely(booking.items_json, []);
      const itemsPreview = items
        .slice(0, 3)
        .map((item) => `${item.name} x${item.quantity}`)
        .join(', ');

      return {
        id: Number(booking.id),
        channel: booking.channel || 'storefront',
        itemCount: Number(booking.item_count || 0),
        totalQuantity: Number(booking.total_quantity || 0),
        totalAmount: booking.total_amount == null ? null : Number(booking.total_amount),
        totalLabel: booking.total_label || '',
        createdAt: booking.created_at || null,
        items,
        itemsPreview,
      };
    }),
  };
}

async function fetchAdminOverview() {
  const pool = getPool();
  const [[vendorSummary]] = await pool.query(`
    SELECT
      COUNT(*) AS total_vendors,
      SUM(CASE WHEN approval_status = 'pending' THEN 1 ELSE 0 END) AS pending_vendors
    FROM vendors
  `);
  const [[productSummary]] = await pool.query(`
    SELECT COUNT(*) AS total_products
    FROM products
  `);
  const [vendorRows] = await pool.query(`
    SELECT
      vendors.id,
      vendors.email,
      vendors.shop_id,
      vendors.shop_name,
      vendors.approval_status,
      vendors.approved_at,
      vendors.subscription_plan,
      vendors.subscription_started_at,
      vendors.subscription_ends_at,
      vendors.created_at,
      COUNT(products.id) AS product_count,
      CASE
        WHEN vendors.approval_status = 'approved' THEN 'Approved'
        ELSE 'Pending Approval'
      END AS status
    FROM vendors
    LEFT JOIN products ON products.vendor_id = vendors.id
    GROUP BY
      vendors.id,
      vendors.email,
      vendors.shop_id,
      vendors.shop_name,
      vendors.approval_status,
      vendors.approved_at,
      vendors.subscription_plan,
      vendors.subscription_started_at,
      vendors.subscription_ends_at,
      vendors.created_at
    ORDER BY vendors.created_at DESC
    LIMIT 100
  `);

  return {
    stats: [
      {
        title: 'Total Vendors',
        value: Number(vendorSummary?.total_vendors || 0).toLocaleString(),
        color: '#3b82f6',
      },
      {
        title: 'Active Products',
        value: Number(productSummary?.total_products || 0).toLocaleString(),
        color: '#10b981',
      },
      {
        title: 'Pending Approval',
        value: Number(vendorSummary?.pending_vendors || 0).toLocaleString(),
        color: '#f59e0b',
      },
      {
        title: 'Suspended Accounts',
        value: '0',
        color: '#ef4444',
      },
    ],
    vendors: vendorRows.map((vendor) => ({
      id: vendor.id,
      name: vendor.shop_name || 'Shop not created yet',
      owner: vendor.email,
      status: vendor.status,
      statusKey: readVendorApproval(vendor).code,
      products: Number(vendor.product_count || 0),
      joined: formatDateOnly(vendor.created_at),
      shopId: vendor.shop_id || '',
      approval: readVendorApproval(vendor),
      subscription: mapVendorSubscription(vendor),
    })),
  };
}

async function fetchVendorDashboard(vendorId) {
  const vendor = await findVendorById(vendorId);

  if (!vendor) {
    const error = new Error('Vendor account not found.');
    error.statusCode = 404;
    throw error;
  }

  const account = mapVendorAccount(vendor);
  const bookingInsights = await fetchVendorBookingInsights(vendor.id);

  if (!vendor.shop_id) {
    return {
      account,
      shop: null,
      ...bookingInsights,
    };
  }

  const products = await listProductsForVendor(vendor.id);

  return {
    account,
    shop: mapShop(vendor, products),
    ...bookingInsights,
  };
}

async function requireOwnedVendor(req, res, next) {
  const authorizationHeader = req.headers.authorization || '';

  if (!authorizationHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing vendor token.',
    });
    return;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, jwtSecret);

    if (payload.role !== 'vendor' || !Number.isInteger(Number(payload.vendorId))) {
      res.status(401).json({
        error: 'Invalid or expired vendor token.',
      });
      return;
    }

    const vendor = await findVendorById(payload.vendorId);

    if (!vendor) {
      res.status(401).json({
        error: 'Vendor account not found.',
      });
      return;
    }

    req.vendor = vendor;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Invalid or expired vendor token.',
    });
  }
}

async function requireApprovedVendor(req, res, next) {
  if (String(req.vendor?.approval_status || '').toLowerCase() === 'approved') {
    next();
    return;
  }

  res.status(403).json({
    error: 'Your vendor account is still waiting for admin approval before products can be published.',
  });
}

async function requireAdmin(req, res, next) {
  const authorizationHeader = req.headers.authorization || '';

  if (!authorizationHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing admin token.',
    });
    return;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, jwtSecret);

    if (payload.role !== 'admin' || !Number.isInteger(Number(payload.adminId))) {
      res.status(401).json({
        error: 'Invalid or expired admin token.',
      });
      return;
    }

    const admin = await findAdminById(Number(payload.adminId));

    if (!admin) {
      res.status(401).json({
        error: 'Admin account not found.',
      });
      return;
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Invalid or expired admin token.',
    });
  }
}

app.get('/api/health', (req, res) => {
  const state = getDatabaseState();

  res.json({
    ok: true,
    dbConfigured: state.ready,
    ...(state.ready ? {} : { dbError: state.error }),
  });
});

app.get('/api/admin/auth/status', ensureDatabase, async (req, res) => {
  try {
    const totalAdmins = await countAdmins();
    res.json({
      initialized: totalAdmins > 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vendor/auth/payment-qr', async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/auth/bootstrap', ensureDatabase, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/auth/login', ensureDatabase, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/auth/forgot-password', ensureDatabase, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/auth/reset-password', ensureDatabase, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/me', ensureDatabase, requireAdmin, async (req, res) => {
  res.json({
    account: mapAdminAccount(req.admin),
  });
});

app.post('/api/vendor/auth/register', ensureDatabase, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/vendor/auth/login', ensureDatabase, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/vendor/auth/forgot-password', ensureDatabase, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/vendor/auth/reset-password', ensureDatabase, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/vendor/me', ensureDatabase, requireOwnedVendor, async (req, res) => {
  try {
    const dashboard = await fetchVendorDashboard(req.vendor.id);
    res.json(dashboard);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.put('/api/vendor/me/account', ensureDatabase, requireOwnedVendor, async (req, res) => {
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
    res.status(400).json({ error: error.message });
  }
});

app.put(
  '/api/vendor/me/shop',
  ensureDatabase,
  requireOwnedVendor,
  upload.fields([{ name: 'logoImage', maxCount: 1 }]),
  async (req, res) => {
    try {
      const payload = validateVendorPayload(req.body);
      const requestedShopId = normalizeShopId(
        req.body.shopId || req.vendor.shop_id || payload.shopName
      );

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
      res.status(400).json({ error: error.message });
    }
  }
);

app.post(
  '/api/vendor/me/products',
  ensureDatabase,
  requireOwnedVendor,
  requireApprovedVendor,
  upload.fields([{ name: 'productImage', maxCount: 1 }]),
  async (req, res) => {
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
      res.status(400).json({ error: error.message });
    }
  }
);

app.put(
  '/api/vendor/me/products/:productId',
  ensureDatabase,
  requireOwnedVendor,
  requireApprovedVendor,
  upload.fields([{ name: 'productImage', maxCount: 1 }]),
  async (req, res) => {
    try {
      const productId = Number(req.params.productId);

      if (!Number.isInteger(productId) || productId <= 0) {
        res.status(400).json({
          error: 'Invalid productId.',
        });
        return;
      }

      const [existingRows] = await getPool().execute(
        'SELECT * FROM products WHERE id = ? AND vendor_id = ? LIMIT 1',
        [productId, req.vendor.id]
      );
      const existingProduct = existingRows[0];

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
      res.status(400).json({ error: error.message });
    }
  }
);

app.delete(
  '/api/vendor/me/products/:productId',
  ensureDatabase,
  requireOwnedVendor,
  requireApprovedVendor,
  async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      res.status(400).json({
        error: 'Invalid productId.',
      });
      return;
    }

    const [existingRows] = await getPool().execute(
      'SELECT * FROM products WHERE id = ? AND vendor_id = ? LIMIT 1',
      [productId, req.vendor.id]
    );
    const existingProduct = existingRows[0];

    if (!existingProduct) {
      res.status(404).json({
        error: 'Product not found.',
      });
      return;
    }

    await getPool().execute('DELETE FROM products WHERE id = ? AND vendor_id = ?', [
      productId,
      req.vendor.id,
    ]);
    await deleteUploadedFile(existingProduct.image_path);

    res.json({
      message: 'Product deleted successfully.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/overview', ensureDatabase, requireAdmin, async (req, res) => {
  try {
    const overview = await fetchAdminOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/products', ensureDatabase, requireAdmin, async (req, res) => {
  try {
    const products = await listAdminProducts();
    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:productId', ensureDatabase, requireAdmin, async (req, res) => {
  try {
    res.status(403).json({
      error: 'Admin editing is disabled. Admin can only review and delete.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:productId', ensureDatabase, requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      res.status(400).json({
        error: 'Invalid productId.',
      });
      return;
    }

    const [rows] = await getPool().execute(
      'SELECT * FROM products WHERE id = ? LIMIT 1',
      [productId]
    );
    const existingProduct = rows[0];

    if (!existingProduct) {
      res.status(404).json({
        error: 'Product not found.',
      });
      return;
    }

    await getPool().execute('DELETE FROM products WHERE id = ?', [productId]);
    await deleteUploadedFile(existingProduct.image_path);

    res.json({
      message: 'Product deleted successfully.',
      productId,
      vendorId: Number(existingProduct.vendor_id || 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/vendors/:vendorId/approve', ensureDatabase, requireAdmin, async (req, res) => {
  try {
    const vendorId = Number(req.params.vendorId);

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      res.status(400).json({
        error: 'Invalid vendorId.',
      });
      return;
    }

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
        vendor: {
          id: vendor.id,
          status: 'Approved',
          statusKey: 'approved',
          approval: readVendorApproval(vendor),
        },
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
      vendor: {
        id: updatedVendor.id,
        status: 'Approved',
        statusKey: 'approved',
        approval: readVendorApproval(updatedVendor),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/vendors/:vendorId', ensureDatabase, requireAdmin, async (req, res) => {
  try {
    const vendorId = Number(req.params.vendorId);

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      res.status(400).json({
        error: 'Invalid vendorId.',
      });
      return;
    }

    const vendor = await findVendorById(vendorId);

    if (!vendor) {
      res.status(404).json({
        error: 'Vendor not found.',
      });
      return;
    }

    const [productRows] = await getPool().execute(
      'SELECT image_path FROM products WHERE vendor_id = ?',
      [vendorId]
    );

    await getPool().execute('DELETE FROM vendors WHERE id = ?', [vendorId]);

    await Promise.all([
      deleteUploadedFile(vendor.logo_image_path),
      ...productRows.map((product) => deleteUploadedFile(product.image_path)),
    ]);

    res.json({
      message: 'Vendor deleted successfully.',
      vendorId,
      deletedProductCount: productRows.length,
      vendorStatus:
        String(vendor.approval_status || '').toLowerCase() === 'approved'
          ? 'Approved'
          : 'Pending Approval',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shop/:shopId', ensureDatabase, async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/shop/:shopId/purchase', ensureDatabase, async (req, res) => {
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

    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'Image files must be 5MB or smaller.',
      });
      return;
    }

    res.status(400).json({
      error: error.message,
    });
    return;
  }

  if (error) {
    res.status(400).json({
      error: error.message || 'Unexpected server error.',
    });
    return;
  }

  next();
});

initializeDatabase().then((state) => {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Backend server listening on port ${port}`);

    if (state.ready) {
      console.log(
        `MySQL connected: ${state.config.host}:${state.config.port}/${state.config.database}`
      );
    } else {
      console.warn(state.error);
    }
  });
});
