import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  Package2,
  Search,
  Sparkles,
  Store,
  Trash2,
  User,
} from 'lucide-react';

const TOKEN_STORAGE_KEY = 'vendor_auth_token';
const EMPTY_AUTH = {
  email: '',
  password: '',
  confirmPassword: '',
  resetCode: '',
  subscriptionPlan: 'monthly',
};
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/$/, '');
const EMPTY_SHOP = {
  name: '',
  description: '',
  location: '',
  telegram: '',
  logoImageUrl: '',
};
const EMPTY_ACCOUNT_FORM = {
  fullName: '',
  phone: '',
  email: '',
};
const EMPTY_PRODUCT = { name: '', price: '', desc: '', discountBanner: '', stock: '0' };
const EMPTY_ANALYTICS = {
  totalBookings: 0,
  totalBookedQuantity: 0,
  totalIncome: 0,
  totalIncomeLabel: '',
  lastBookingAt: null,
};
const LIGHT_THEME = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceSoft: '#f8fbff',
  surfaceCard: '#fcfeff',
  border: 'rgba(19, 34, 56, 0.12)',
  text: '#132238',
  textMuted: '#5f6d7d',
  primary: '#2d9fdb',
  primaryText: '#1b6fa8',
  primarySoft: 'rgba(45, 159, 219, 0.1)',
  primarySoftStrong: 'rgba(45, 159, 219, 0.14)',
  primaryBorder: 'rgba(45, 159, 219, 0.22)',
  shadow: '0 20px 44px rgba(45, 159, 219, 0.08), 0 10px 24px rgba(19, 34, 56, 0.05)',
  buttonShadow: '0 16px 30px rgba(45, 159, 219, 0.24)',
};

const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #f7fbff 0%, #ffffff 18%, #f9fcff 100%)',
  color: LIGHT_THEME.text,
  padding: '36px 20px 56px',
};

const cardStyle = {
  background: LIGHT_THEME.surfaceCard,
  border: `1px solid ${LIGHT_THEME.primaryBorder}`,
  borderRadius: '20px',
  padding: '24px',
  boxShadow: LIGHT_THEME.shadow,
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255, 255, 255, 0.96)',
  color: LIGHT_THEME.text,
  border: `1px solid ${LIGHT_THEME.border}`,
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  fontFamily: 'inherit',
  boxShadow: 'inset 0 1px 2px rgba(19, 34, 56, 0.04)',
};

const buttonStyle = {
  background: 'linear-gradient(135deg, #2d9fdb 0%, #2295d3 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: '999px',
  padding: '11px 18px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: 'inherit',
  boxShadow: LIGHT_THEME.buttonShadow,
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: 'rgba(255, 255, 255, 0.96)',
  border: `1px solid ${LIGHT_THEME.primaryBorder}`,
  color: LIGHT_THEME.text,
  boxShadow: '0 10px 24px rgba(19, 34, 56, 0.05)',
};

const passwordFieldShellStyle = {
  position: 'relative',
};

const passwordToggleButtonStyle = {
  position: 'absolute',
  top: '50%',
  right: '12px',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  color: LIGHT_THEME.textMuted,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  padding: '4px',
};

const vendorSubscriptionPlans = [
  {
    code: 'monthly',
    title: 'Monthly access',
    priceLabel: '$10',
    cadenceLabel: 'per month',
    helper: 'Flexible start for new vendors.',
  },
  {
    code: 'yearly',
    title: 'Yearly access',
    priceLabel: '$100',
    cadenceLabel: 'per year',
    helper: 'Best value for long-term shops.',
  },
];

function resolveApiAssetUrl(path) {
  if (!path) {
    return '';
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

function normalizeProductAsset(product) {
  return {
    ...product,
    imageUrl: resolveApiAssetUrl(product.imageUrl),
  };
}

function normalizeShopPayload(shop) {
  if (!shop) {
    return null;
  }

  return {
    ...shop,
    logoImageUrl: resolveApiAssetUrl(shop.logoImageUrl),
    products: Array.isArray(shop.products) ? shop.products.map(normalizeProductAsset) : [],
  };
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function initials(value) {
  return (
    String(value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'SS'
  );
}

function publicShopLink(shopId) {
  if (!shopId) return '';
  const base = import.meta.env.VITE_PUBLIC_SHOP_BASE_URL?.replace(/\/$/, '');
  return base ? `${base}/shop/${shopId}` : `/shop/${shopId}`;
}

function formatDateTime(value) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function joinWithAnd(items) {
  const normalizedItems = items.filter(Boolean);

  if (normalizedItems.length <= 1) {
    return normalizedItems[0] || '';
  }

  if (normalizedItems.length === 2) {
    return `${normalizedItems[0]} and ${normalizedItems[1]}`;
  }

  return `${normalizedItems.slice(0, -1).join(', ')}, and ${normalizedItems.at(-1)}`;
}

function getStockBadge(stockValue) {
  const stock = Number(stockValue || 0);

  if (stock <= 0) {
    return { label: 'Out of stock', tone: 'is-alert' };
  }

  if (stock <= 5) {
    return { label: `${stock} left`, tone: 'is-warning' };
  }

  return { label: `${stock} in stock`, tone: 'is-good' };
}

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }
  return payload;
}

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function fetchPaymentQrUrl() {
  const payload = await readApiResponse(await fetch(apiUrl('/api/vendor/auth/payment-qr')));
  return resolveApiAssetUrl(payload.url || '');
}

function previewUrl(file) {
  return file ? URL.createObjectURL(file) : '';
}

function fitLocationLabel(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function buildLocationFromReverseGeocode(payload) {
  const address = payload?.address || {};
  const road =
    address.road ||
    address.pedestrian ||
    address.residential ||
    address.footway ||
    address.path ||
    '';
  const neighborhood =
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.city_district ||
    address.hamlet ||
    '';
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state_district ||
    address.state ||
    '';
  const country = address.country || '';

  const combinations = [
    [road, neighborhood, locality, country],
    [neighborhood, locality, country],
    [locality, country],
    [payload?.name, locality, country],
  ];

  for (const parts of combinations) {
    const nextValue = fitLocationLabel(
      [...new Set(parts.map((part) => String(part || '').trim()).filter(Boolean))].join(', ')
    );

    if (nextValue) {
      return nextValue;
    }
  }

  return fitLocationLabel(payload?.display_name || '');
}

function readBrowserLocationError(error) {
  if (!error) {
    return 'Unable to read your current location.';
  }

  if (error.code === 1) {
    return 'Location access was blocked. Please allow location access in your browser.';
  }

  if (error.code === 2) {
    return 'Your browser could not detect the current location.';
  }

  if (error.code === 3) {
    return 'Location request timed out. Please try again.';
  }

  return error.message || 'Unable to read your current location.';
}

export default function VendorApp() {
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [authForm, setAuthForm] = useState(EMPTY_AUTH);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resetDetails, setResetDetails] = useState(null);
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentQrError, setPaymentQrError] = useState('');
  const [paymentQrLoading, setPaymentQrLoading] = useState(false);
  const [showRegistrationQr, setShowRegistrationQr] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState({
    password: false,
    confirmPassword: false,
  });
  const [activeView, setActiveView] = useState('overview');

  const [token, setToken] = useState('');
  const [account, setAccount] = useState(null);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentBookingsOpen, setRecentBookingsOpen] = useState(false);
  const [recentProductsOpen, setRecentProductsOpen] = useState(false);
  const [productHubOpen, setProductHubOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const [shopId, setShopId] = useState('');
  const [shopHandleDraft, setShopHandleDraft] = useState('');
  const [shopForm, setShopForm] = useState(EMPTY_SHOP);
  const [logoFile, setLogoFile] = useState(null);
  const [savingShop, setSavingShop] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [productFile, setProductFile] = useState(null);
  const [editingProductId, setEditingProductId] = useState('');
  const [editingImageUrl, setEditingImageUrl] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState('');

  const logoInputRef = useRef(null);
  const productInputRef = useRef(null);
  const accountMenuRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [productPreview, setProductPreview] = useState('');

  const shopLink = useMemo(() => publicShopLink(shopId), [shopId]);
  const logoImage = logoPreview || shopForm.logoImageUrl || '';
  const productImage = productPreview || editingImageUrl || '';
  const hasShop = Boolean(shopId);
  const normalizedHandleDraft = slugify(shopHandleDraft);
  const resolvedHandle =
    normalizedHandleDraft || (!hasShop ? slugify(shopForm.name) : '') || shopId;
  const displayHandle = resolvedHandle || 'your-handle';
  const accountDisplayName = account?.fullName?.trim() || account?.email || 'Vendor account';
  const displayLogoText = initials(shopForm.name || account?.fullName || account?.email || 'Sister Store');
  const vendorApproval = account?.approval || {
    code: 'pending',
    label: 'Pending Approval',
    approvedAt: null,
    canPublishProducts: false,
  };
  const canPublishProducts = Boolean(vendorApproval.canPublishProducts);
  const currentSubscription = account?.subscription || null;
  const selectedSubscriptionPlan =
    vendorSubscriptionPlans.find((plan) => plan.code === authForm.subscriptionPlan) ||
    vendorSubscriptionPlans[0];
  const subscriptionSummary = currentSubscription
    ? `${currentSubscription.priceLabel}${
        currentSubscription.endsAt ? ` | Active until ${formatDateTime(currentSubscription.endsAt)}` : ''
      }`
    : 'Choose a plan';
  const approvalSummary = canPublishProducts
    ? vendorApproval.approvedAt
      ? `Approved on ${formatDateTime(vendorApproval.approvedAt)}`
      : 'Approved by admin'
    : 'Waiting for admin approval before product uploads are enabled';
  const catalogStatusTone = canPublishProducts ? 'is-good' : 'is-warning';
  const catalogWorkspaceTitle = editingProductId
    ? 'Update a product that is already in your catalog'
    : 'Manage the products customers will browse in your storefront';
  const catalogWorkspaceDescription = canPublishProducts
    ? 'Add products, keep stock current, and review the customer-facing preview before publishing.'
    : 'Prepare the product details here now, then publish them as soon as admin approval is complete.';
  const catalogFocusPills = canPublishProducts
    ? ['Add products', 'Update stock', 'Review preview']
    : ['Prepare details', 'Review preview', 'Wait for approval'];
  const catalogStatusTitle = canPublishProducts
    ? 'Publishing is unlocked'
    : 'Publishing is waiting for approval';
  const catalogStatusDescription = canPublishProducts
    ? 'This workspace is fully active. You can add, update, and remove products from here.'
    : 'You can prepare product information now, but the publish button will stay locked until an admin approves your vendor account.';
  const catalogActionGroups = canPublishProducts
    ? [
        {
          title: 'Use this workspace to',
          items: [
            'Add or update products with price, stock, and image',
            'Keep the storefront accurate as inventory changes',
          ],
        },
        {
          title: 'Before publishing',
          items: [
            'Check the preview card customers will see',
            'Use clear descriptions and discount labels when needed',
          ],
        },
      ]
    : [
        {
          title: 'You can do now',
          items: [
            'Complete the name, price, stock, image, and description',
            'Review the customer preview before products go live',
          ],
        },
        {
          title: 'Unlocks after approval',
          items: [
            'Publish products to the storefront',
            'Edit or remove live catalog items anytime',
          ],
        },
      ];
  const previewTelegram = shopForm.telegram
    ? `@${shopForm.telegram.replace(/^@+/, '')}`
    : '@yourtelegram';
  const previewLocation = shopForm.location || 'Add your city, pickup point, or delivery area';
  const trimmedProductName = productForm.name.trim();
  const trimmedProductPrice = productForm.price.trim();
  const trimmedProductDescription = productForm.desc.trim();
  const trimmedAccountFullName = accountForm.fullName.trim();
  const trimmedAccountPhone = accountForm.phone.trim();
  const trimmedAccountEmail = accountForm.email.trim().toLowerCase();
  const trimmedShopName = shopForm.name.trim();
  const trimmedShopDescription = shopForm.description.trim();
  const trimmedShopLocation = shopForm.location.trim();
  const trimmedShopTelegram = shopForm.telegram.trim();
  const descriptionCharacterCount = trimmedShopDescription.length;
  const locationAndContactReady = Boolean(trimmedShopLocation && trimmedShopTelegram);
  const missingStorePublishFields = [];
  if (!trimmedShopName) {
    missingStorePublishFields.push('shop name');
  }
  if (!trimmedShopTelegram) {
    missingStorePublishFields.push('Telegram');
  }
  const missingStorePublishFieldsSummary = joinWithAnd(missingStorePublishFields);
  const canSaveStoreDuringPublish =
    !hasShop && missingStorePublishFields.length === 0 && Boolean(resolvedHandle);
  const publishChecklist = useMemo(
    () => [
      {
        key: 'approval',
        label: 'Vendor approval',
        value: canPublishProducts ? 'Approved by admin' : 'Still waiting for admin approval',
        done: canPublishProducts,
        required: true,
      },
      {
        key: 'store',
        label: 'Store page',
        value: hasShop
          ? `Saved as /${shopId}`
          : canSaveStoreDuringPublish
            ? `First publish will save /${displayHandle}`
            : `Add ${missingStorePublishFieldsSummary} in Store Profile`,
        done: hasShop || canSaveStoreDuringPublish,
        required: true,
      },
      {
        key: 'name',
        label: 'Product name',
        value: trimmedProductName || 'Add a product name customers will recognize quickly',
        done: Boolean(trimmedProductName),
        required: true,
      },
      {
        key: 'price',
        label: 'Price label',
        value: trimmedProductPrice || 'Add a simple label like $25 or 25 USD',
        done: Boolean(trimmedProductPrice),
        required: true,
      },
      {
        key: 'photo',
        label: 'Product photo',
        value: productImage ? 'Image selected for the storefront card' : 'Optional, but strongly recommended',
        done: Boolean(productImage),
        required: false,
      },
      {
        key: 'details',
        label: 'Short details',
        value: trimmedProductDescription
          ? 'Description added for shoppers'
          : 'Optional, but useful for size, flavor, or delivery notes',
        done: Boolean(trimmedProductDescription),
        required: false,
      },
    ],
    [
      canPublishProducts,
      canSaveStoreDuringPublish,
      displayHandle,
      hasShop,
      missingStorePublishFieldsSummary,
      productImage,
      shopId,
      trimmedProductDescription,
      trimmedProductName,
      trimmedProductPrice,
    ]
  );
  const publishRequiredItems = publishChecklist.filter((item) => item.required);
  const publishRequiredCompleteCount = publishRequiredItems.filter((item) => item.done).length;
  const publishReadyCount = publishChecklist.filter((item) => item.done).length;
  const publishBlockers = publishRequiredItems.filter((item) => !item.done);
  const publishReadinessTitle = !canPublishProducts
    ? 'Waiting for vendor approval'
    : publishBlockers.length === 0
      ? canSaveStoreDuringPublish
        ? 'Ready to save the store and publish'
        : 'Ready to publish now'
      : publishBlockers.some((item) => item.key === 'store')
        ? 'Store setup is needed first'
        : 'Add the last required product details';
  const publishReadinessDescription = !canPublishProducts
    ? 'Your product form can be prepared now, but the product will go live only after an admin approves your vendor account.'
    : publishBlockers.length === 0
      ? canSaveStoreDuringPublish
        ? `When you click publish, we will save /${displayHandle} first and then put this product live.`
        : 'Everything required is ready. You can publish this product to the storefront now.'
      : publishBlockers.some((item) => item.key === 'store')
        ? `Before the first product goes live, add ${missingStorePublishFieldsSummary} in Store Profile.`
        : 'Finish the required product fields below so customers can see a complete product card.';
  const catalogSubmitButtonLabel = !canPublishProducts
    ? savingProduct
      ? 'Checking...'
      : 'Check Approval Status'
    : savingProduct
      ? 'Saving...'
      : editingProductId
        ? 'Update Product'
        : !hasShop
          ? 'Save Store & Publish'
          : 'Publish Product';
  const catalogSubmitDisabled =
    savingProduct || (Boolean(editingProductId) && deletingProductId === editingProductId);
  const catalogSubmitTitle = canPublishProducts
    ? editingProductId
      ? 'Save the updated product information'
      : !hasShop
        ? 'Save your store and publish this product'
        : 'Publish this product to your storefront'
    : 'Finish the draft while approval is pending';
  const catalogSubmitDescription = canPublishProducts
    ? editingProductId
      ? 'Saving updates will refresh the product card customers already see in your storefront.'
      : !hasShop
        ? 'Your first publish will also save the store profile so the storefront and product go live together.'
        : 'Publishing makes the product visible in your storefront, so customers can browse and order it.'
    : 'You can prepare the full draft now. The publish action will unlock automatically after admin approval.';
  const setupChecklist = useMemo(
    () => [
      {
        label: 'Account',
        done: Boolean(account?.email),
        hint: account?.email ? 'Signed in' : 'Sign in',
      },
      {
        label: 'Store',
        done: hasShop,
        hint: hasShop ? 'Saved' : 'Add info',
      },
      {
        label: 'Products',
        done: products.length > 0,
        hint:
          products.length > 0
            ? `${products.length} live`
            : 'Add one',
      },
      {
        label: 'Share',
        done: hasShop && products.length > 0,
        hint:
          hasShop && products.length > 0
            ? 'Ready'
            : hasShop
              ? 'Add product'
              : 'Save store',
      },
    ],
    [account?.email, hasShop, products.length]
  );
  const setupCompleteCount = setupChecklist.filter((item) => item.done).length;
  const setupProgress = Math.round((setupCompleteCount / setupChecklist.length) * 100);
  const accountChecklist = useMemo(
    () => [
      {
        label: 'Full name',
        done: Boolean(trimmedAccountFullName),
        value: trimmedAccountFullName || 'Add your name',
        helper: 'This helps identify the vendor account in your workspace and admin records.',
      },
      {
        label: 'Sign-in email',
        done: Boolean(trimmedAccountEmail),
        value: trimmedAccountEmail || 'Add your sign-in email',
        helper: 'This is the email used to sign in and receive password reset codes.',
      },
      {
        label: 'Phone number',
        done: Boolean(trimmedAccountPhone),
        value: trimmedAccountPhone || 'Add a phone number',
        helper: 'Optional, but useful when the admin needs to reach you directly.',
      },
    ],
    [trimmedAccountEmail, trimmedAccountFullName, trimmedAccountPhone]
  );
  const accountCompleteCount = accountChecklist.filter((item) => item.done).length;
  const accountDetailsReadyLabel = `${accountCompleteCount}/${accountChecklist.length} account details ready`;
  const accountHealthLabel =
    accountCompleteCount === accountChecklist.length
      ? 'Account profile complete'
      : accountCompleteCount > 0
        ? 'Add the remaining personal details'
        : 'Start your account profile';
  const accountPhoneLabel = trimmedAccountPhone || 'Add a phone number';
  const memberSinceLabel = account?.createdAt ? formatDateTime(account.createdAt) : 'Recently created';
  const profileChecklist = useMemo(
    () => [
      {
        label: 'Shop name',
        done: Boolean(trimmedShopName),
        value: trimmedShopName || 'Add a clear shop name',
        helper: 'This is the first detail customers see at the top of the store page.',
      },
      {
        label: 'About section',
        done: Boolean(trimmedShopDescription),
        value: trimmedShopDescription
          ? 'Description ready'
          : 'Write a short storefront introduction',
        helper: 'A short message helps customers understand what you sell in one quick look.',
      },
      {
        label: 'Location',
        done: Boolean(trimmedShopLocation),
        value: trimmedShopLocation || 'Add your city, pickup point, or delivery area',
        helper: 'Use the city, pickup place, or delivery area customers should read before ordering.',
      },
      {
        label: 'Telegram',
        done: Boolean(trimmedShopTelegram),
        value: trimmedShopTelegram ? previewTelegram : 'Add a Telegram username',
        helper: 'Customers will use this username when they want to ask questions or confirm an order.',
      },
      {
        label: 'Public handle',
        done: Boolean(resolvedHandle),
        value: resolvedHandle ? `/${displayHandle}` : 'Create a memorable public handle',
        helper: 'This becomes the simple public link you can copy and share.',
      },
    ],
    [
      trimmedShopDescription,
      trimmedShopLocation,
      trimmedShopName,
      trimmedShopTelegram,
      displayHandle,
      previewTelegram,
      resolvedHandle,
    ]
  );
  const profileCompleteCount = profileChecklist.filter((item) => item.done).length;
  const profileProgress = Math.round((profileCompleteCount / profileChecklist.length) * 100);
  const profileHealthLabel =
    profileProgress === 100
      ? 'Store details complete'
      : profileProgress >= 80
        ? 'Almost ready'
        : profileProgress >= 50
        ? 'Needs a few details'
        : 'Start adding details';
  const storeDetailsReadyLabel = `${profileCompleteCount}/${profileChecklist.length} details ready`;
  const storePageStatusLabel = hasShop ? 'Shop page saved' : 'Shop page not saved yet';
  const draftedShopLinkSummary =
    displayHandle !== 'your-handle'
      ? `Shop link: /${displayHandle}`
      : 'Your shop link will appear here after you save.';
  const storefrontSummary = hasShop
    ? 'This is the page customers will open when they visit your shop.'
    : 'Fill in these details to create the page customers will open.';
  const totalStock = useMemo(
    () => products.reduce((sum, product) => sum + Number(product.stock || 0), 0),
    [products]
  );
  const outOfStockCount = useMemo(
    () => products.filter((product) => Number(product.stock || 0) <= 0).length,
    [products]
  );
  const lowStockCount = useMemo(
    () =>
      products.filter((product) => {
        const stock = Number(product.stock || 0);
        return stock > 0 && stock <= 5;
      }).length,
    [products]
  );
  const recentProducts = useMemo(() => products.slice(0, 5), [products]);
  const productHubRows = useMemo(
    () =>
      [...products].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
        const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
        return rightTime - leftTime;
      }),
    [products]
  );
  const inventoryHealthLabel = useMemo(() => {
    if (products.length === 0) {
      return 'No products yet';
    }

    if (outOfStockCount > 0) {
      return `${outOfStockCount} product${outOfStockCount === 1 ? '' : 's'} out of stock`;
    }

    if (lowStockCount > 0) {
      return `${lowStockCount} product${lowStockCount === 1 ? '' : 's'} running low`;
    }

    return 'Stock looks good';
  }, [lowStockCount, outOfStockCount, products.length]);
  const shareStatusLabel =
    hasShop && products.length > 0
      ? 'Ready to share'
      : hasShop
        ? 'Add products before sharing'
        : 'Finish the profile first';
  const incomeLabel =
    analytics.totalIncomeLabel ||
    (analytics.totalBookings > 0
      ? analytics.totalIncome > 0
        ? analytics.totalIncome.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })
        : 'Recorded'
      : 'No income yet');
  const bookingSummaryLabel =
    analytics.totalBookings > 0
      ? `${analytics.totalBookings} booking${analytics.totalBookings === 1 ? '' : 's'}, ${analytics.totalBookedQuantity} item${analytics.totalBookedQuantity === 1 ? '' : 's'} booked`
      : 'Income appears after customer bookings';
  const nextAction = useMemo(() => {
    if (!hasShop) {
      return {
        label: 'Set up your store',
        hint: 'Add your store name, description, location, and Telegram so customers can understand the shop.',
        target: 'store',
        button: 'Open Store Setup',
      };
    }

    if (products.length === 0) {
      return {
        label: 'Add the first product',
        hint: 'Add at least one product so customers can browse and order from your store.',
        target: 'catalog',
        button: 'Open Products',
      };
    }

    return {
      label: 'Share your store link',
      hint: 'Your store is ready. Copy the public link and send it to customers.',
      target: 'share',
      button: 'Open Share Tools',
    };
  }, [hasShop, products.length]);
  const pageTitle =
    activeView === 'account'
      ? 'Account'
      : activeView === 'store'
      ? 'Store Profile'
      : activeView === 'catalog'
        ? 'Products'
        : activeView === 'share'
          ? 'Share Store'
          : 'Dashboard';
  const pageDescription =
    activeView === 'account'
      ? 'Update the vendor account information used for sign-in, contact, and admin records.'
      : activeView === 'store'
      ? 'Update the details customers see first and check your store preview.'
      : activeView === 'catalog'
        ? 'Add products, update stock, and review everything in one place.'
        : activeView === 'share'
          ? 'Copy your public store link and check whether the store is ready to share.'
          : 'See what is ready, what needs attention, and what to do next.';
  const summaryCards = useMemo(
    () => [
      {
        label: 'Store Setup',
        value: `${profileProgress}%`,
        helper: profileHealthLabel,
        icon: Store,
        color: '#38bdf8',
      },
      {
        label: 'Products',
        value: `${products.length}`,
        helper: inventoryHealthLabel,
        icon: Package2,
        color: '#34d399',
      },
      {
        label: 'Stock',
        value: `${totalStock}`,
        helper:
          products.length > 0
            ? `${lowStockCount} low stock, ${outOfStockCount} out of stock`
            : 'Stock totals appear after you add products',
        icon: LayoutDashboard,
        color: '#f59e0b',
      },
      {
        label: 'Public Link',
        value: hasShop && products.length > 0 ? 'Ready' : 'Not Ready',
        helper: hasShop ? `/${displayHandle}` : 'Finish store setup first',
        icon: Globe,
        color: '#a78bfa',
      },
      {
        label: 'Income',
        value: incomeLabel,
        helper: bookingSummaryLabel,
        icon: MessageCircle,
        color: '#22c55e',
      },
      {
        label: 'Customer Bookings',
        value: `${analytics.totalBookings}`,
        helper:
          analytics.totalBookings > 0
            ? `${analytics.totalBookedQuantity} item${analytics.totalBookedQuantity === 1 ? '' : 's'} booked`
            : 'No customer bookings yet',
        icon: Bell,
        color: '#f97316',
      },
    ],
    [
      analytics.totalBookedQuantity,
      analytics.totalBookings,
      bookingSummaryLabel,
      displayHandle,
      hasShop,
      incomeLabel,
      inventoryHealthLabel,
      lowStockCount,
      outOfStockCount,
      products.length,
      profileHealthLabel,
      profileProgress,
      totalStock,
    ]
  );
  const workspaceTabs = useMemo(
    () => [
      { id: 'overview', label: 'Dashboard', mobileLabel: 'Dash', icon: LayoutDashboard },
      { id: 'store', label: 'Store Profile', mobileLabel: 'Profile', icon: Store },
      { id: 'catalog', label: 'Products', mobileLabel: 'Product', icon: Package2 },
      { id: 'share', label: 'Share Store', mobileLabel: 'Share', icon: Globe },
    ],
    []
  );
  const accountInitials = initials(trimmedAccountFullName || account?.fullName || account?.email || 'Vendor');
  const primaryAction =
    activeView === 'account'
      ? {
          label: savingAccount ? 'Saving...' : 'Save Account',
          onClick: saveAccount,
          disabled: savingAccount,
        }
      : activeView === 'store'
      ? {
          label: savingShop ? 'Saving...' : hasShop ? 'Save Changes' : 'Create Store',
          onClick: saveShop,
          disabled: savingShop,
        }
      : activeView === 'catalog'
        ? {
            label: catalogSubmitButtonLabel,
            onClick: submitProduct,
            disabled: catalogSubmitDisabled,
          }
        : activeView === 'share'
          ? {
              label: 'Copy Link',
              onClick: copyShopLink,
              disabled: !shopLink,
            }
          : {
              label: nextAction.button,
              onClick: () => setActiveView(nextAction.target),
              disabled: false,
            };
  const secondaryAction =
    activeView === 'account'
      ? {
          label: 'Store Profile',
          onClick: () => setActiveView('store'),
          disabled: false,
        }
      : activeView === 'catalog'
      ? editingProductId
        ? {
            label: 'Cancel Edit',
            onClick: resetProductEditor,
            disabled: false,
          }
        : !hasShop
          ? {
              label: 'Store Profile',
              onClick: () => setActiveView('store'),
              disabled: false,
            }
          : {
              label: 'Preview Store',
              onClick: openShopPreview,
              disabled: !shopLink,
            }
      : {
          label: 'Preview Store',
          onClick: openShopPreview,
          disabled: !shopLink,
        };

  useEffect(() => {
    const next = previewUrl(logoFile);
    setLogoPreview(next);
    return () => next && URL.revokeObjectURL(next);
  }, [logoFile]);

  useEffect(() => {
    const next = previewUrl(productFile);
    setProductPreview(next);
    return () => next && URL.revokeObjectURL(next);
  }, [productFile]);

  function resetProductEditor() {
    setEditingProductId('');
    setEditingImageUrl('');
    setProductForm(EMPTY_PRODUCT);
    setProductFile(null);
    if (productInputRef.current) {
      productInputRef.current.value = '';
    }
  }

  function resetWorkspace() {
    setAccountForm(EMPTY_ACCOUNT_FORM);
    setShopId('');
    setShopHandleDraft('');
    setShopForm(EMPTY_SHOP);
    setProducts([]);
    setAnalytics(EMPTY_ANALYTICS);
    setRecentBookings([]);
    setLogoFile(null);
    resetProductEditor();
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  }

  function clearSession(message = '') {
    setAccountMenuOpen(false);
    setStoredToken('');
    setToken('');
    setAccount(null);
    setAuthError('');
    setResetDetails(null);
    setPaymentQrUrl('');
    setPaymentQrError('');
    setPaymentQrLoading(false);
    setShowRegistrationQr(false);
    setPasswordVisibility({
      password: false,
      confirmPassword: false,
    });
    setAuthForm(EMPTY_AUTH);
    setActiveView('overview');
    resetWorkspace();
    if (message) {
      setNotice(message);
    }
  }

  function switchAuthMode(nextMode) {
    setAuthMode(nextMode);
    setAuthError('');
    setResetDetails(null);
    setPaymentQrUrl('');
    setPaymentQrError('');
    setPaymentQrLoading(false);
    setShowRegistrationQr(false);
    setPasswordVisibility({
      password: false,
      confirmPassword: false,
    });
    setAuthForm((current) => ({
      ...EMPTY_AUTH,
      email: current.email,
      subscriptionPlan: current.subscriptionPlan || EMPTY_AUTH.subscriptionPlan,
    }));
  }

  function togglePasswordVisibility(field) {
    setPasswordVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }));
  }

  function renderAuthPasswordInput(field, placeholder) {
    const isVisible = passwordVisibility[field];

    return (
      <div style={passwordFieldShellStyle}>
        <input
          style={{
            ...inputStyle,
            paddingRight: '48px',
          }}
          type={isVisible ? 'text' : 'password'}
          placeholder={placeholder}
          value={authForm[field]}
          onChange={(event) => {
            if (authMode === 'register' && showRegistrationQr) {
              setShowRegistrationQr(false);
              setNotice('');
            }

            setAuthForm((current) => ({ ...current, [field]: event.target.value }));
          }}
        />
        <button
          type="button"
          onClick={() => togglePasswordVisibility(field)}
          aria-label={isVisible ? `Hide ${placeholder}` : `Show ${placeholder}`}
          style={passwordToggleButtonStyle}
        >
          {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  }

  function hydrateWorkspace(payload) {
    const normalizedShop = normalizeShopPayload(payload.shop);

    setAccount(payload.account || null);
    setAccountForm({
      fullName: payload.account?.fullName || '',
      phone: payload.account?.phone || '',
      email: payload.account?.email || '',
    });
    setAnalytics(payload.analytics || EMPTY_ANALYTICS);
    setRecentBookings(payload.bookings || []);

    if (normalizedShop) {
      setShopId(normalizedShop.shopId);
      setShopHandleDraft(normalizedShop.shopId);
      setShopForm({
        name: normalizedShop.name || '',
        description: normalizedShop.description || '',
        location: normalizedShop.location || '',
        telegram: normalizedShop.telegram || '',
        logoImageUrl: normalizedShop.logoImageUrl || '',
      });
      setProducts(normalizedShop.products || []);
      return;
    }

    setShopId(payload.account?.shopId || '');
    setShopHandleDraft(payload.account?.shopId || '');
    setShopForm(EMPTY_SHOP);
    setProducts([]);
  }

  async function authedFetch(url, options = {}, overrideToken = '') {
    const activeToken = overrideToken || token;
    if (!activeToken) {
      throw new Error('Please sign in first.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${activeToken}`);
    return fetch(apiUrl(url), { ...options, headers });
  }

  async function loadVendorWorkspace(overrideToken = '', options = {}) {
    const payload = await readApiResponse(await authedFetch('/api/vendor/me', {}, overrideToken));

    if (overrideToken) {
      setToken(overrideToken);
    }

    hydrateWorkspace(payload);

    if (!options.silent) {
      setNotice(
        payload.account?.approval?.canPublishProducts
          ? payload.shop
            ? 'Signed in. Your vendor workspace is ready.'
            : 'Signed in. Create your shop to start selling.'
          : 'Signed in. Your vendor account is waiting for admin approval before products can be uploaded.'
      );
    }

    return payload;
  }

  useEffect(() => {
    async function restoreSession() {
      const storedToken = getStoredToken();

      if (!storedToken) {
        setAuthReady(true);
        return;
      }

      setLoading(true);
      try {
        await loadVendorWorkspace(storedToken);
      } catch {
        clearSession('Your previous session expired. Please sign in again.');
      } finally {
        setLoading(false);
        setAuthReady(true);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (!token || !account || canPublishProducts) {
      return undefined;
    }

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const payload = await loadVendorWorkspace('', { silent: true });

        if (!cancelled && payload.account?.approval?.canPublishProducts) {
          setNotice('Your vendor account has been approved. Product publishing is now unlocked.');
        }
      } catch {
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [account, canPublishProducts, token]);

  useEffect(() => {
    if (authMode !== 'register' || !showRegistrationQr || paymentQrUrl || paymentQrLoading) {
      return;
    }

    let cancelled = false;

    async function loadPaymentQr() {
      setPaymentQrLoading(true);
      setPaymentQrError('');

      try {
        const nextPaymentQrUrl = await fetchPaymentQrUrl();
        if (!cancelled) {
          setPaymentQrUrl(nextPaymentQrUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentQrUrl('');
          setPaymentQrError(error.message || 'Unable to load the payment QR image.');
        }
      } finally {
        if (!cancelled) {
          setPaymentQrLoading(false);
        }
      }
    }

    loadPaymentQr();

    return () => {
      cancelled = true;
    };
  }, [authMode, paymentQrLoading, paymentQrUrl, showRegistrationQr]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError('');
    setNotice('');
    const submittedEmail = authForm.email.trim();

    try {
      if (authMode === 'forgot') {
        setAuthBusy(true);

        if (!resetDetails) {
          const payload = await readApiResponse(
            await fetch(apiUrl('/api/vendor/auth/forgot-password'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: submittedEmail,
              }),
            })
          );

          setResetDetails({
            delivery: payload.delivery || 'manual',
            resetCode: payload.resetCode,
            expiresAt: payload.expiresAt,
          });
          setAuthForm((current) => ({
            ...current,
            password: '',
            confirmPassword: '',
            resetCode: '',
          }));
          setNotice(payload.message);
          return;
        }

        if (authForm.password !== authForm.confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const payload = await readApiResponse(
          await fetch(apiUrl('/api/vendor/auth/reset-password'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: submittedEmail,
              resetCode: authForm.resetCode,
              password: authForm.password,
            }),
          })
        );

        setResetDetails(null);
        setAuthMode('login');
        setAuthForm({
          ...EMPTY_AUTH,
          email: submittedEmail,
        });
        setNotice(payload.message);
        return;
      }

      if (authMode === 'register') {
        if (!/\S+@\S+\.\S+/.test(submittedEmail)) {
          throw new Error('Enter a valid email address before continuing.');
        }

        if (authForm.password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        if (authForm.password !== authForm.confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        if (!showRegistrationQr) {
          setPaymentQrUrl('');
          setPaymentQrError('');
          setPaymentQrLoading(false);
          setShowRegistrationQr(true);
          setNotice(
            `Your details look good. Scan the QR for ${selectedSubscriptionPlan.priceLabel} ${selectedSubscriptionPlan.cadenceLabel}, then click "I Paid, Create Vendor Account" to finish.`
          );
          return;
        }

        if (paymentQrError) {
          throw new Error(paymentQrError);
        }
      }

      setAuthBusy(true);
      const endpoint =
        authMode === 'register' ? '/api/vendor/auth/register' : '/api/vendor/auth/login';

      const payload = await readApiResponse(
        await fetch(apiUrl(endpoint), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: submittedEmail,
            password: authForm.password,
            subscriptionPlan: authForm.subscriptionPlan,
          }),
        })
      );

      setStoredToken(payload.token);
      setToken(payload.token);
      hydrateWorkspace(payload);
      setAuthForm(EMPTY_AUTH);
      setShowRegistrationQr(false);
      setNotice(
        authMode === 'register'
          ? `Vendor account created on ${payload.account?.subscription?.priceLabel || 'your selected plan'}. Please wait for admin approval before uploading products.`
          : 'Signed in. Your vendor workspace is ready.'
      );
    } catch (error) {
      setAuthError(error.message || 'Unable to continue.');
    } finally {
      setAuthBusy(false);
      setAuthReady(true);
    }
  }

  async function saveAccount() {
    setSavingAccount(true);
    setNotice('');

    try {
      const payload = await readApiResponse(
        await authedFetch('/api/vendor/me/account', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: accountForm.fullName,
            phone: accountForm.phone,
            email: accountForm.email,
          }),
        })
      );

      hydrateWorkspace(payload);
      setNotice('Account information saved successfully.');
    } catch (error) {
      if (error.message.includes('token')) {
        clearSession('Your session expired. Please sign in again.');
      } else {
        setNotice(error.message || 'Unable to save the account information.');
      }
    } finally {
      setSavingAccount(false);
    }
  }

  async function saveShop() {
    setSavingShop(true);
    setNotice('');

    try {
      const previousShopId = shopId;
      const nextHandle = normalizedHandleDraft || (!shopId ? slugify(shopForm.name) : '');
      if (!nextHandle) {
        throw new Error('Choose a public handle for your shop.');
      }

      const formData = new FormData();
      formData.append('shopName', shopForm.name);
      formData.append('description', shopForm.description);
      formData.append('location', shopForm.location);
      formData.append('telegram', shopForm.telegram);
      formData.append('logo', displayLogoText);
      formData.append('shopId', nextHandle);
      if (logoFile) {
        formData.append('logoImage', logoFile);
      }

      const payload = await readApiResponse(
        await authedFetch('/api/vendor/me/shop', { method: 'PUT', body: formData })
      );

      hydrateWorkspace(payload);
      setLogoFile(null);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      if (previousShopId && payload.shop?.shopId && payload.shop.shopId !== previousShopId) {
        setNotice(
          `Shop saved successfully. Your public handle is now /${payload.shop.shopId}.`
        );
      } else {
        setNotice('Shop saved successfully.');
      }
      return payload.shop;
    } catch (error) {
      if (error.message.includes('token')) {
        clearSession('Your session expired. Please sign in again.');
      } else {
        setNotice(error.message);
      }
      return null;
    } finally {
      setSavingShop(false);
    }
  }

  async function fillCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice('This browser does not support current location.');
      return;
    }

    setDetectingLocation(true);
    setNotice('');

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        });
      });

      const latitude = position.coords?.latitude;
      const longitude = position.coords?.longitude;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('The browser returned an invalid current location.');
      }

      const reverseUrl = new URL('https://nominatim.openstreetmap.org/reverse');
      reverseUrl.searchParams.set('format', 'jsonv2');
      reverseUrl.searchParams.set('lat', String(latitude));
      reverseUrl.searchParams.set('lon', String(longitude));
      reverseUrl.searchParams.set('addressdetails', '1');
      reverseUrl.searchParams.set(
        'accept-language',
        typeof navigator.language === 'string' && navigator.language.trim()
          ? navigator.language
          : 'en'
      );

      const response = await fetch(reverseUrl.toString(), {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('OpenStreetMap could not return an address for this location.');
      }

      const payload = await response.json();
      const nextLocation = buildLocationFromReverseGeocode(payload);

      if (!nextLocation) {
        throw new Error('OpenStreetMap returned this location without a usable address.');
      }

      setShopForm((current) => ({
        ...current,
        location: nextLocation,
      }));
      setNotice('Current location added from OpenStreetMap.');
    } catch (error) {
      if (typeof error?.code === 'number') {
        setNotice(readBrowserLocationError(error));
      } else {
        setNotice(error.message || 'Unable to fill the current location.');
      }
    } finally {
      setDetectingLocation(false);
    }
  }

  async function submitProduct() {
    if (!canPublishProducts) {
      setSavingProduct(true);

      try {
        const payload = await loadVendorWorkspace('', { silent: true });

        if (!payload.account?.approval?.canPublishProducts) {
          setNotice(
            trimmedProductName && trimmedProductPrice
              ? 'Your product draft is ready, but an admin still needs to approve your vendor account before it can go live.'
              : 'Your vendor account is still waiting for admin approval before products can be published.'
          );
          return;
        }
      } catch (error) {
        setNotice(error.message || 'Unable to refresh your vendor approval status.');
        return;
      } finally {
        setSavingProduct(false);
      }
    }

    const missingProductFields = [];
    if (!trimmedProductName) {
      missingProductFields.push('product name');
    }
    if (!trimmedProductPrice) {
      missingProductFields.push('price');
    }

    if (missingProductFields.length) {
      setNotice(`Add ${joinWithAnd(missingProductFields)} before publishing this product.`);
      return;
    }

    if (!shopId) {
      if (missingStorePublishFields.length) {
        setActiveView('store');
        setNotice(
          `Before your first product can go live, add ${joinWithAnd(
            missingStorePublishFields
          )} in Store Profile.`
        );
        return;
      }

      const savedShop = await saveShop();
      if (!savedShop) {
        setActiveView('store');
        return;
      }
    }

    setSavingProduct(true);
    setNotice('');

    try {
      const formData = new FormData();
      formData.append('name', productForm.name);
      formData.append('price', productForm.price);
      formData.append('desc', productForm.desc);
      formData.append('discountBanner', productForm.discountBanner);
      formData.append('stock', productForm.stock);
      if (productFile) {
        formData.append('productImage', productFile);
      }

      const payload = await readApiResponse(
        await authedFetch(
          editingProductId ? `/api/vendor/me/products/${editingProductId}` : '/api/vendor/me/products',
          {
            method: editingProductId ? 'PUT' : 'POST',
            body: formData,
          }
        )
      );
      const normalizedProduct = normalizeProductAsset(payload.product);

      setProducts((current) =>
        editingProductId
          ? current.map((product) => (product.id === normalizedProduct.id ? normalizedProduct : product))
          : [...current, normalizedProduct]
      );
      resetProductEditor();
      setNotice(payload.message);
    } catch (error) {
      if (error.message.includes('token')) {
        clearSession('Your session expired. Please sign in again.');
      } else {
        setNotice(error.message);
      }
    } finally {
      setSavingProduct(false);
    }
  }

  function startEdit(product) {
    if (!canPublishProducts) {
      setNotice('Admin approval is required before you can manage products.');
      return;
    }

    setEditingProductId(product.id);
    setEditingImageUrl(product.imageUrl || '');
    setProductForm({
      name: product.name,
      price: product.price,
      desc: product.desc || '',
      discountBanner: product.discountBanner || '',
      stock: String(product.stock ?? 0),
    });
    setProductFile(null);
    setActiveView('catalog');
    setNotice(`Editing "${product.name}". Save when you are ready.`);
    if (productInputRef.current) {
      productInputRef.current.value = '';
    }
  }

  async function deleteProduct(productId, productName = 'this product') {
    if (!canPublishProducts) {
      setNotice('Admin approval is required before you can manage products.');
      return;
    }

    if (!productId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${productName}" from your catalog? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingProductId(productId);
    setNotice('');

    try {
      const payload = await readApiResponse(
        await authedFetch(`/api/vendor/me/products/${productId}`, {
          method: 'DELETE',
        })
      );

      setProducts((current) => current.filter((product) => product.id !== productId));
      if (editingProductId === productId) {
        resetProductEditor();
      }
      setNotice(payload.message || `"${productName}" deleted successfully.`);
    } catch (error) {
      if (error.message.includes('token')) {
        clearSession('Your session expired. Please sign in again.');
      } else {
        setNotice(error.message);
      }
    } finally {
      setDeletingProductId('');
    }
  }

  async function copyShopLink() {
    if (!shopLink) {
      setNotice('Create your shop first to unlock the public link.');
      return;
    }

    try {
      await navigator.clipboard.writeText(shopLink);
      setNotice('Public shop link copied to clipboard.');
    } catch {
      setNotice(`Copy failed. Use this link manually: ${shopLink}`);
    }
  }

  function openAccountView() {
    setAccountMenuOpen(false);
    setActiveView('account');
  }

  function openShopPreview() {
    if (!shopLink) {
      setNotice('Create your shop first to unlock the public link.');
      setAccountMenuOpen(false);
      return;
    }

    setAccountMenuOpen(false);
    window.open(shopLink, '_blank', 'noopener,noreferrer');
  }

  if (!authReady) {
    return <div style={{ ...pageStyle, display: 'grid', placeItems: 'center' }}>Loading vendor portal...</div>;
  }

  if (!token || !account) {
    return (
      <div style={{ ...pageStyle, display: 'grid', placeItems: 'center' }}>
        <div className="vendor-auth-shell-upgrade">
          <div style={{ ...cardStyle, display: 'grid', gap: '18px' }}>
            <div className="vendor-pill">
              <Sparkles size={14} />
              <span>Vendor Workspace</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '2.3rem', lineHeight: 1.05 }}>
              Create a cleaner storefront flow for every vendor.
            </h1>
            <p style={{ color: LIGHT_THEME.textMuted, margin: 0 }}>
              This account system is now fully local: register, manage products, and share your shop
              link using Laragon and MySQL.
            </p>
            <div className="vendor-checklist vendor-checklist--auth">
              <div className="vendor-check-item is-done">
                <span className="vendor-check-icon">OK</span>
                <div>
                  <strong>Own Account</strong>
                  <span>Each vendor controls only their own shop and products.</span>
                </div>
              </div>
              <div className="vendor-check-item is-done">
                <span className="vendor-check-icon">OK</span>
                <div>
                  <strong>Own Catalog</strong>
                  <span>Products, images, and public handle stay in your backend.</span>
                </div>
              </div>
              <div className="vendor-check-item is-done">
                <span className="vendor-check-icon">OK</span>
                <div>
                  <strong>Own Database</strong>
                  <span>No Firebase dependency is left in the active flow.</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, width: '100%', maxWidth: '460px' }}>
            <div className="vendor-auth-toggle">
              <button
                className={`vendor-toggle-btn ${authMode === 'register' ? 'is-active' : ''}`}
                type="button"
                onClick={() => switchAuthMode('register')}
              >
                Register
              </button>
              <button
                className={`vendor-toggle-btn ${authMode !== 'register' ? 'is-active' : ''}`}
                type="button"
                onClick={() => switchAuthMode('login')}
              >
                {authMode === 'forgot' ? 'Reset' : 'Sign In'}
              </button>
            </div>

            <h2 style={{ marginTop: 0 }}>
              {authMode === 'register'
                ? 'Create Vendor Account'
                : authMode === 'forgot'
                  ? 'Reset Vendor Password'
                  : 'Sign In To Workspace'}
            </h2>
            <p style={{ color: LIGHT_THEME.textMuted, marginTop: '-6px' }}>
              {authMode === 'register'
                ? 'Start your own vendor workspace.'
                : authMode === 'forgot'
                  ? 'Request a reset code with your email, then set a new password.'
                  : 'Continue managing your storefront.'}
            </p>

            <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: '12px' }}>
              {authMode === 'register' && (
                <div style={{ display: 'grid', gap: '10px' }}>
                  <span style={{ color: LIGHT_THEME.text, fontWeight: 600, fontSize: '14px' }}>
                    Choose vendor access plan
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {vendorSubscriptionPlans.map((plan) => {
                      const isActive = authForm.subscriptionPlan === plan.code;

                      return (
                        <button
                          key={plan.code}
                          type="button"
                          onClick={() => {
                            if (showRegistrationQr) {
                              setShowRegistrationQr(false);
                              setNotice('');
                            }

                            setAuthForm((current) => ({
                              ...current,
                              subscriptionPlan: plan.code,
                            }));
                          }}
                          style={{
                            textAlign: 'left',
                            borderRadius: '14px',
                            border: isActive
                              ? `1px solid ${LIGHT_THEME.primaryBorder}`
                              : `1px solid ${LIGHT_THEME.border}`,
                            background: isActive
                              ? LIGHT_THEME.primarySoftStrong
                              : LIGHT_THEME.surfaceSoft,
                            color: LIGHT_THEME.text,
                            padding: '14px',
                            cursor: 'pointer',
                            display: 'grid',
                            gap: '6px',
                          }}
                        >
                          <strong>{plan.title}</strong>
                          <span style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                            {plan.priceLabel}
                          </span>
                          <span style={{ color: LIGHT_THEME.primaryText, fontSize: '13px' }}>
                            {plan.cadenceLabel}
                          </span>
                          <small style={{ color: LIGHT_THEME.textMuted }}>{plan.helper}</small>
                        </button>
                      );
                    })}
                  </div>

                  {showRegistrationQr && (
                    <div
                      style={{
                        display: 'grid',
                        gap: '12px',
                        borderRadius: '16px',
                        border: `1px solid ${LIGHT_THEME.primaryBorder}`,
                        background: LIGHT_THEME.primarySoft,
                        padding: '16px',
                      }}
                    >
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <strong style={{ color: LIGHT_THEME.text }}>
                          Pay with QR before registration
                        </strong>
                        <span style={{ color: LIGHT_THEME.primaryText, fontSize: '14px' }}>
                          Selected plan: {selectedSubscriptionPlan.priceLabel}{' '}
                          {selectedSubscriptionPlan.cadenceLabel}
                        </span>
                        <small style={{ color: LIGHT_THEME.textMuted }}>
                          Scan the QR below to pay for your vendor plan, then click "I Paid,
                          Create Vendor Account" to finish with the same email.
                        </small>
                      </div>

                      {!paymentQrError ? (
                        <div
                          style={{
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: '14px',
                            background: LIGHT_THEME.surface,
                            padding: '14px',
                          }}
                        >
                          {paymentQrLoading ? (
                            <div style={{ color: LIGHT_THEME.text, fontWeight: 600 }}>
                              Loading payment QR...
                            </div>
                          ) : paymentQrUrl ? (
                            <img
                              src={paymentQrUrl}
                              alt="Vendor payment QR code"
                              onError={() =>
                                setPaymentQrError(
                                  'The payment QR image could not be loaded from the backend.'
                                )
                              }
                              style={{
                                width: '100%',
                                maxWidth: '240px',
                                height: 'auto',
                                display: 'block',
                                borderRadius: '10px',
                              }}
                            />
                          ) : (
                            <div style={{ color: LIGHT_THEME.text, fontWeight: 600 }}>
                              Waiting for payment QR...
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          style={{
                            borderRadius: '14px',
                            border: `1px dashed ${LIGHT_THEME.border}`,
                            padding: '14px',
                            color: LIGHT_THEME.textMuted,
                            fontSize: '14px',
                          }}
                        >
                          {paymentQrError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="vendor-field">
                <div style={{ position: 'relative' }}>
                  <Search 
                    size={16} 
                    style={{ 
                      position: 'absolute', 
                      left: '12px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      color: LIGHT_THEME.textMuted,
                      pointerEvents: 'none'
                    }} 
                  />
                  <input
                    style={{ ...inputStyle, paddingLeft: '38px' }}
                    type="email"
                    placeholder="Email Address"
                    value={authForm.email}
                    onChange={(event) => {
                      const nextEmail = event.target.value;
                      if (authMode === 'forgot' && resetDetails) {
                        setResetDetails(null);
                      }
                      if (authMode === 'register' && showRegistrationQr) {
                        setShowRegistrationQr(false);
                        setNotice('');
                      }
                      setAuthForm((current) => ({ ...current, email: nextEmail }));
                    }}
                  />
                </div>
              </div>
              {(authMode !== 'forgot' || resetDetails) && (
                renderAuthPasswordInput(
                  'password',
                  authMode === 'forgot' ? 'New Password' : 'Password'
                )
              )}
              {authMode === 'forgot' && resetDetails && (
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit reset code"
                  value={authForm.resetCode}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, resetCode: event.target.value }))
                  }
                />
              )}
              {(authMode === 'register' || (authMode === 'forgot' && resetDetails)) && (
                renderAuthPasswordInput('confirmPassword', 'Confirm Password')
              )}
              {authMode === 'forgot' && resetDetails && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: `1px solid ${LIGHT_THEME.primaryBorder}`,
                    background: LIGHT_THEME.primarySoft,
                    color: LIGHT_THEME.primaryText,
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  {resetDetails.resetCode ? (
                    <>
                      <strong>Reset code: {resetDetails.resetCode}</strong>
                      <span style={{ fontSize: '13px', color: LIGHT_THEME.primaryText }}>
                        Email delivery is not set up yet, so the code is shown here for now. It
                        expires at {new Date(resetDetails.expiresAt).toLocaleString()}.
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '13px', color: LIGHT_THEME.primaryText }}>
                      A reset code was sent to your email. Enter that code below before{' '}
                      {new Date(resetDetails.expiresAt).toLocaleString()}.
                    </span>
                  )}
                </div>
              )}
              {notice && <div className="vendor-banner">{notice}</div>}
              {authError && <div className="vendor-banner vendor-banner--error">{authError}</div>}
              <button style={buttonStyle} type="submit" disabled={authBusy}>
                {authBusy
                  ? 'Working...'
                  : authMode === 'register'
                    ? showRegistrationQr
                      ? 'I Paid, Create Vendor Account'
                      : 'Create Vendor Account'
                    : authMode === 'forgot'
                      ? resetDetails
                        ? 'Reset Password'
                        : 'Get Reset Code'
                      : 'Sign In'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchAuthMode('forgot')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: LIGHT_THEME.primaryText,
                      padding: 0,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Forgot password?
                  </button>
                )}
                {authMode === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => switchAuthMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: LIGHT_THEME.primaryText,
                      padding: 0,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout vendor-admin-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-box">S</div>
          <div>
            <h2>Sister Store</h2>
            <p className="vendor-sidebar-subtitle">Vendor Panel</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-label">MAIN</p>
          {workspaceTabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                className={`nav-item vendor-nav-button ${activeView === tab.id ? 'active' : ''}`}
                onClick={() => setActiveView(tab.id)}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="vendor-sidebar-card">
          <p className="vendor-sidebar-card__label">Setup Progress</p>
          <strong>{setupProgress}% complete</strong>
          <span>{nextAction.label}</span>
          <div className="vendor-progress-bar">
            <span style={{ width: `${setupProgress}%` }} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input type="text" placeholder="Search products or store details..." readOnly />
          </div>
          <div className="vendor-mobile-context">
            <span>Vendor Workspace</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" type="button" onClick={() => setActiveView('share')}>
              <Bell size={20} />
              <span className="badge"></span>
            </button>
            <div className="vendor-account-menu" ref={accountMenuRef}>
              <button
                type="button"
                className="vendor-account-trigger"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((current) => !current)}
              >
                <div className="avatar">{accountInitials}</div>
              </button>
              {accountMenuOpen && (
                <div className="vendor-account-dropdown" role="menu">
                  <p className="vendor-account-dropdown__label">Account</p>
                  <button
                    type="button"
                    className="nav-item vendor-nav-button vendor-account-dropdown__item"
                    onClick={openAccountView}
                  >
                    <User size={18} />
                    <span>Account Info</span>
                  </button>
                  <button
                    type="button"
                    className="nav-item vendor-nav-button vendor-account-dropdown__item"
                    onClick={openShopPreview}
                    disabled={!shopLink}
                  >
                    <ExternalLink size={18} />
                    <span>Preview Store</span>
                  </button>
                  <button
                    type="button"
                    className="nav-item vendor-nav-button vendor-account-dropdown__item"
                    onClick={() => clearSession()}
                  >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">
          <div className="vendor-mobile-nav">
            <section className="vendor-mobile-nav-section">
              <p className="vendor-mobile-nav-label">Main</p>
              <div className="vendor-mobile-nav-list vendor-mobile-nav-list--main">
                {workspaceTabs.map((tab) => {
                  const Icon = tab.icon;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`nav-item vendor-nav-button vendor-mobile-nav-button ${activeView === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveView(tab.id)}
                    >
                      <Icon size={18} />
                      <span>{tab.mobileLabel || tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="vendor-mobile-shell">
            <div className="vendor-mobile-shell__stats vendor-mobile-shell__stats--summary">
              {summaryCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article
                    className="vendor-mobile-summary-chip"
                    key={`mobile-${card.label}`}
                    style={{ '--vendor-accent': card.color }}
                  >
                    <div
                      className="vendor-mobile-summary-chip__icon"
                      style={{ backgroundColor: `${card.color}18`, color: card.color }}
                    >
                      <Icon size={16} />
                    </div>
                    <small>{card.label}</small>
                    <strong>{card.value}</strong>
                  </article>
                );
              })}
            </div>
          </section>

          <div
            className={`page-header vendor-page-header ${
              activeView === 'store' ? 'vendor-page-header--store' : ''
            } ${activeView === 'overview' ? 'vendor-page-header--overview' : ''}`}
          >
            <div>
              <h1>{pageTitle}</h1>
              <p>{pageDescription}</p>
            </div>
            <div
              className={`vendor-page-actions ${
                activeView === 'store' ? 'vendor-page-actions--store' : ''
              } ${activeView === 'overview' ? 'vendor-page-actions--overview' : ''}`}
            >
              <button
                type="button"
                className="btn-primary"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
              >
                {primaryAction.label}
              </button>
              <button
                type="button"
                className="vendor-btn-secondary"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.label}
              </button>
            </div>
          </div>

          {(loading || notice) && (
            <div
              className={`vendor-alert ${activeView === 'store' ? 'vendor-alert--store' : ''} ${
                activeView === 'overview' ? 'vendor-alert--overview' : ''
              }`}
            >
              {loading ? 'Loading your workspace from the backend...' : notice}
            </div>
          )}

          <div className={`vendor-summary-grid ${activeView === 'overview' ? 'vendor-summary-grid--overview' : ''}`}>
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  className="vendor-summary-card"
                  key={card.label}
                  style={{ '--vendor-accent': card.color }}
                >
                  <div className="vendor-summary-card__top">
                    <span>{card.label}</span>
                    <div
                      className="vendor-summary-card__icon"
                      style={{ backgroundColor: `${card.color}18`, color: card.color }}
                    >
                      <Icon size={18} />
                    </div>
                  </div>
                  <strong>{card.value}</strong>
                  <p>{card.helper}</p>
                </article>
              );
            })}
          </div>

            {activeView === 'overview' && (
              <div className="vendor-dashboard-shell vendor-dashboard-shell--overview">
                <div className="vendor-overview-grid vendor-overview-grid--overview">
                <section className="vendor-panel-card vendor-overview-feature" style={cardStyle}>
                  <div className="vendor-section-head">
                    <div>
                      <span className="vendor-section-kicker">Store Details</span>
                      <h2>What customers will see first</h2>
                      <p>
                        {hasShop
                          ? 'Check the main details customers use to understand and trust your store.'
                          : 'Finish these details so your store page is clear before you share it.'}
                      </p>
                    </div>
                    <button
                      style={secondaryButtonStyle}
                      type="button"
                      onClick={() => setActiveView('store')}
                    >
                      <Store size={16} />
                      <span>Edit Profile</span>
                    </button>
                  </div>

                  <div className="vendor-overview-feature__grid">
                    <div className="vendor-preview-panel vendor-preview-panel--feature">
                      <div className="vendor-preview-panel__head">
                        <div className="vendor-logo-orb vendor-logo-orb--small">
                          {logoImage ? (
                            <img src={logoImage} alt="Preview logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            displayLogoText
                          )}
                        </div>
                        <div>
                          <strong>{shopForm.name || 'Your storefront'}</strong>
                          <div className="vendor-preview-handle">/{displayHandle}</div>
                        </div>
                      </div>
                      <p className="vendor-preview-copy">
                        {shopForm.description || 'Add a short description so customers understand your store quickly.'}
                      </p>
                      <div className="vendor-preview-contact">
                        <MapPin size={16} />
                        <span>{previewLocation}</span>
                      </div>
                      <div className="vendor-preview-contact">
                        <MessageCircle size={16} />
                        <span>{previewTelegram}</span>
                      </div>
                      <input style={inputStyle} readOnly value={shopLink || 'Create your shop first'} />
                    </div>

                    <div className="vendor-note-stack">
                      <div className="vendor-note-card">
                        <span>Store Status</span>
                        <strong>
                          {shopForm.name && shopForm.description && shopForm.location && shopForm.telegram
                            ? 'Ready for customers'
                            : 'Add missing details'}
                        </strong>
                        <p>Customers trust the store more when the name, description, location, and contact are all filled in.</p>
                      </div>
                      <div className="vendor-note-card">
                        <span>Location</span>
                        <strong>{shopForm.location || 'Add your location'}</strong>
                        <p>Use a city, pickup point, or delivery area so customers know if they can order from you.</p>
                      </div>
                      <div className="vendor-note-card">
                        <span>Customer Contact</span>
                        <strong>{shopForm.telegram ? previewTelegram : 'Add Telegram username'}</strong>
                        <p>Customers will use this contact when they have questions or want to confirm an order.</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head vendor-section-head--stacked">
                    <div>
                      <span className="vendor-section-kicker">Products</span>
                      <h2>Product list status</h2>
                      <p>
                        {products.length > 0
                          ? `${products.length} product${products.length === 1 ? '' : 's'} live. Check stock and recent items here.`
                          : 'No products yet. Add your first item so customers have something to browse.'}
                      </p>
                    </div>
                    <button
                      style={secondaryButtonStyle}
                      type="button"
                      onClick={() => setActiveView('catalog')}
                    >
                      <Package2 size={16} />
                      <span>Open Products</span>
                    </button>
                  </div>

                  <div className="vendor-mini-metric-grid">
                    <div className="vendor-mini-metric">
                      <span>Total units</span>
                      <strong>{totalStock}</strong>
                    </div>
                    <div className="vendor-mini-metric">
                      <span>Low stock</span>
                      <strong>{lowStockCount}</strong>
                    </div>
                    <div className="vendor-mini-metric">
                      <span>Out of stock</span>
                      <strong>{outOfStockCount}</strong>
                    </div>
                  </div>

                  {recentProducts.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        style={{
                          ...secondaryButtonStyle,
                          width: '100%',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          fontSize: '13px',
                        }}
                        onClick={() => setRecentProductsOpen(!recentProductsOpen)}
                      >
                        <span>{recentProductsOpen ? 'Hide' : 'Show'} Recent Items</span>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          opacity: 0.8
                        }}>
                          <strong>{recentProducts.length}</strong>
                          <Eye size={14} style={{ opacity: recentProductsOpen ? 0.5 : 1 }} />
                        </div>
                      </button>

                      {recentProductsOpen && (
                        <div className="vendor-mini-product-list vendor-mini-product-list--collapsible" style={{ marginTop: '14px' }}>
                          {recentProducts.map((product) => (
                            <div key={product.id} className="vendor-mini-product">
                              <div className="vendor-mini-product__media-wrap">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="vendor-mini-product__media" />
                                ) : (
                                  <div className="vendor-product-thumb-fallback">
                                    <Package2 size={18} />
                                  </div>
                                )}
                                {product.discountBanner && (
                                  <span className="vendor-product-discount vendor-product-discount--mini">
                                    {product.discountBanner}
                                  </span>
                                )}
                              </div>
                              <div className="vendor-mini-product__copy">
                                <strong>{product.name}</strong>
                                <span>{product.price}</span>
                                <small>
                                  {`${Number(product.stock || 0)} in stock | ${Number(product.sold || 0)} sold`}
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {recentProducts.length === 0 && (
                    <div className="vendor-empty-state">
                      <Package2 size={18} />
                      <strong>No products yet</strong>
                      <span>Add a product with a name, price, and image to start building your store.</span>
                    </div>
                  )}
                </section>

                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head vendor-section-head--stacked">
                    <div>
                      <span className="vendor-section-kicker">Customer Orders</span>
                      <h2>Income from storefront orders</h2>
                      <p>
                        Each time a customer books items from the storefront, the order total is
                        recorded here for the vendor dashboard.
                      </p>
                    </div>
                  </div>

                  <div className="vendor-mini-metric-grid">
                    <div className="vendor-mini-metric">
                      <span>Total income</span>
                      <strong>{incomeLabel}</strong>
                    </div>
                    <div className="vendor-mini-metric">
                      <span>Total bookings</span>
                      <strong>{analytics.totalBookings}</strong>
                    </div>
                    <div className="vendor-mini-metric">
                      <span>Items booked</span>
                      <strong>{analytics.totalBookedQuantity}</strong>
                    </div>
                  </div>

                  {recentBookings.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        style={{
                          ...secondaryButtonStyle,
                          width: '100%',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          fontSize: '13px',
                        }}
                        onClick={() => setRecentBookingsOpen(!recentBookingsOpen)}
                      >
                        <span>{recentBookingsOpen ? 'Hide' : 'Show'} Recent Orders</span>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          opacity: 0.8
                        }}>
                          <strong>{recentBookings.length}</strong>
                          <Eye size={14} style={{ opacity: recentBookingsOpen ? 0.5 : 1 }} />
                        </div>
                      </button>

                      {recentBookingsOpen && (
                        <div className="vendor-booking-list vendor-booking-list--collapsible" style={{ marginTop: '14px' }}>
                          {recentBookings.map((booking) => (
                            <article key={booking.id} className="vendor-booking-card">
                              <div className="vendor-booking-card__top">
                                <div>
                                  <strong>{booking.totalLabel || `Booking #${booking.id}`}</strong>
                                  <span>
                                    {booking.totalQuantity} item{booking.totalQuantity === 1 ? '' : 's'} |{' '}
                                    {formatDateTime(booking.createdAt) || 'Recent booking'}
                                  </span>
                                </div>
                                <span className="vendor-booking-card__badge">
                                  {booking.channel === 'telegram' ? 'Telegram' : 'Storefront'}
                                </span>
                              </div>
                              <p>
                                {booking.itemsPreview ||
                                  `${booking.itemCount} product${booking.itemCount === 1 ? '' : 's'} booked`}
                              </p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {recentBookings.length === 0 && (
                    <div className="vendor-empty-state">
                      <MessageCircle size={18} />
                      <strong>No orders yet</strong>
                      <span>Income will appear here after a customer books products from the storefront.</span>
                    </div>
                  )}
                </section>

                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head vendor-section-head--stacked">
                    <div>
                      <span className="vendor-section-kicker">Public Link</span>
                      <h2>Share your store</h2>
                      <p>
                        {hasShop
                          ? 'Copy or preview the public link when the store looks ready.'
                          : 'Your public link will appear here after you save the store profile.'}
                      </p>
                    </div>
                    <button
                      style={secondaryButtonStyle}
                      type="button"
                      onClick={() => setActiveView('share')}
                    >
                      <Globe size={16} />
                      <span>Open Share Tools</span>
                    </button>
                  </div>

                  <input style={inputStyle} readOnly value={shopLink || 'Create your shop first'} />
                  <div className="vendor-form-actions">
                    <button style={secondaryButtonStyle} type="button" onClick={copyShopLink}>
                      <Copy size={16} />
                      <span>Copy Link</span>
                    </button>
                    <button style={secondaryButtonStyle} type="button" onClick={openShopPreview}>
                      <ExternalLink size={16} />
                      <span>Preview Storefront</span>
                    </button>
                  </div>

                  <div className="vendor-share-hints">
                    <div className="vendor-note-card">
                      <span>Link Status</span>
                      <strong>{shareStatusLabel}</strong>
                      <p>The link is easiest to share after your store details are filled in and at least one product is live.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Customer Contact</span>
                      <strong>{shopForm.telegram ? previewTelegram : 'Add Telegram username'}</strong>
                      <p>Customers can use this contact after they open the public store page.</p>
                    </div>
                  </div>
                </section>
                </div>
              </div>
            )}

            {activeView === 'account' && (
              <div className="vendor-account-grid">
                <section className="vendor-panel-card vendor-account-editor" style={cardStyle}>
                  <div className="vendor-section-head">
                    <div>
                      <span className="vendor-section-kicker">Vendor Account</span>
                      <h2>Set the account information for this vendor</h2>
                      <p>Keep your sign-in email and personal contact details here. Your public shop details stay in Store Profile.</p>
                    </div>
                    <div className="vendor-pill">
                      <User size={14} />
                      <span>{accountDetailsReadyLabel}</span>
                    </div>
                  </div>

                  <div className="vendor-account-identity">
                    <div className="vendor-logo-orb vendor-logo-orb--small">{accountInitials}</div>
                    <div className="vendor-account-identity__copy">
                      <strong>{trimmedAccountFullName || accountDisplayName}</strong>
                      <span>{trimmedAccountEmail || account?.email || 'Add your sign-in email'}</span>
                      <small>{subscriptionSummary}</small>
                      <small>{approvalSummary}</small>
                    </div>
                  </div>

                  <div className="vendor-account-meta">
                    <div className="vendor-account-stat">
                      <span>Account status</span>
                      <strong>{vendorApproval.label}</strong>
                      <p>
                        {canPublishProducts
                          ? 'Your vendor account is approved and can publish products.'
                          : 'The account can be edited now, but product publishing waits for admin approval.'}
                      </p>
                    </div>
                    <div className="vendor-account-stat">
                      <span>Member since</span>
                      <strong>{memberSinceLabel}</strong>
                      <p>Your subscription and login history stay connected to this vendor account.</p>
                    </div>
                    <div className="vendor-account-stat">
                      <span>Phone contact</span>
                      <strong>{accountPhoneLabel}</strong>
                      <p>Optional. Add a number the admin can use if there is a question about your account.</p>
                    </div>
                  </div>

                  <div className="vendor-form-grid vendor-form-grid--store">
                    <label className="vendor-field vendor-field--guided">
                      <span>Vendor full name</span>
                      <input
                        style={inputStyle}
                        placeholder="Srey Lin"
                        maxLength="120"
                        value={accountForm.fullName}
                        onChange={(event) =>
                          setAccountForm((current) => ({
                            ...current,
                            fullName: event.target.value,
                          }))
                        }
                      />
                      <small>This is your personal vendor name for the account, not the public shop name.</small>
                    </label>

                    <label className="vendor-field vendor-field--guided">
                      <span>Phone number</span>
                      <input
                        style={inputStyle}
                        placeholder="+855 12 345 678"
                        maxLength="32"
                        value={accountForm.phone}
                        onChange={(event) =>
                          setAccountForm((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                      />
                      <small>Optional. Add one working number for account support or admin follow-up.</small>
                    </label>

                    <label className="vendor-field vendor-field--full vendor-field--guided">
                      <span>Sign-in email</span>
                      <input
                        style={inputStyle}
                        type="email"
                        placeholder="vendor@example.com"
                        value={accountForm.email}
                        onChange={(event) =>
                          setAccountForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                      />
                      <small>This email is used to sign in and receive password reset codes.</small>
                    </label>
                  </div>

                  <div className="vendor-account-summary">
                    <div className="vendor-account-summary__item">
                      <span>Belongs in account</span>
                      <strong>Name, phone, and sign-in email</strong>
                    </div>
                    <div className="vendor-account-summary__item">
                      <span>Belongs in store profile</span>
                      <strong>Shop name, location, description, and customer Telegram</strong>
                    </div>
                  </div>

                  <div className="vendor-form-actions">
                    <button style={buttonStyle} type="button" onClick={saveAccount} disabled={savingAccount}>
                      {savingAccount ? 'Saving...' : 'Save account information'}
                    </button>
                    <span>Updating this page changes the vendor account details only. The public storefront stays in Store Profile.</span>
                  </div>
                </section>

                <div className="vendor-account-side">
                  <section className="vendor-panel-card" style={cardStyle}>
                    <div className="vendor-section-head vendor-section-head--stacked">
                      <div>
                        <span className="vendor-section-kicker">Account Checklist</span>
                        <h2>Check the vendor account details</h2>
                        <p>These fields help keep the account easy to recognize and easy to recover later.</p>
                      </div>
                    </div>

                    <div className="vendor-profile-review-summary">
                      <strong>{accountDetailsReadyLabel}</strong>
                      <span>{accountHealthLabel}</span>
                    </div>

                    <div className="vendor-dashboard-checklist vendor-dashboard-checklist--stacked vendor-dashboard-checklist--detailed">
                      {accountChecklist.map((item) => (
                        <div
                          key={item.label}
                          className={`vendor-dashboard-check vendor-dashboard-check--detailed ${item.done ? 'is-done' : ''}`}
                        >
                          <div className={`vendor-dashboard-check__status ${item.done ? 'is-done' : ''}`}>
                            {item.done ? 'Ready' : 'Add'}
                          </div>
                          <div className="vendor-dashboard-check__body">
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                            <p>{item.helper}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="vendor-note-stack vendor-note-stack--compact">
                      <div className="vendor-note-card">
                        <span>Subscription</span>
                        <strong>{currentSubscription?.label || 'Choose a plan'}</strong>
                        <p>{subscriptionSummary}</p>
                      </div>
                      <div className="vendor-note-card">
                        <span>Store Profile</span>
                        <strong>{hasShop ? shopForm.name || 'Store profile saved' : 'Store profile not saved yet'}</strong>
                        <p>{hasShop ? 'Your public shop settings are managed separately in Store Profile.' : 'Create the store profile after you finish the account details.'}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeView === 'store' && (
              <div className="vendor-profile-shell">
                <section className="vendor-panel-card vendor-profile-editor" style={cardStyle}>
                  <div className="vendor-section-head">
                    <div>
                      <span className="vendor-section-kicker">Store Profile</span>
                      <h2>Set up the shop page customers will understand quickly</h2>
                      <p>Add the name, location, contact, and short description customers need before they message or order.</p>
                    </div>
                    <div className="vendor-pill">
                      <Store size={14} />
                      <span>{hasShop ? 'Shop page ready' : 'Setup in progress'}</span>
                    </div>
                  </div>

                  <div className="vendor-profile-banner">
                    <div className="vendor-profile-banner__identity">
                      <div className="vendor-logo-orb vendor-logo-orb--small">
                        {logoImage ? (
                          <img
                            src={logoImage}
                            alt="Preview logo"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          displayLogoText
                        )}
                      </div>
                      <div className="vendor-profile-banner__copy">
                        <strong>{shopForm.name || 'Your shop page'}</strong>
                        <span>{storefrontSummary}</span>
                        <small>{draftedShopLinkSummary}</small>
                        <small>{subscriptionSummary}</small>
                        <small>{approvalSummary}</small>
                      </div>
                    </div>

                    <div className="vendor-chip-row">
                      <span className={`vendor-info-chip ${canPublishProducts ? 'is-primary' : ''}`}>
                        {vendorApproval.label}
                      </span>
                      <span className={`vendor-info-chip ${hasShop ? 'is-primary' : ''}`}>
                        {storePageStatusLabel}
                      </span>
                      <span className="vendor-info-chip">{storeDetailsReadyLabel}</span>
                    </div>
                  </div>

                  <div className="vendor-profile-sections">
                    <section className="vendor-profile-section-card">
                      <div className="vendor-profile-section-card__head">
                        <span>Step 1</span>
                        <strong>Choose the shop name, link, and picture</strong>
                        <p>These are the first details customers notice when they open your shop page.</p>
                      </div>

                      <div className="vendor-form-grid vendor-form-grid--store">
                        <label className="vendor-field">
                          <span>Shop name customers will see</span>
                          <input
                            style={inputStyle}
                            placeholder="Sister Store"
                            value={shopForm.name}
                            onChange={(event) =>
                              setShopForm((current) => ({ ...current, name: event.target.value }))
                            }
                          />
                        </label>

                        <label className="vendor-field">
                          <span>Short page link</span>
                          <input
                            style={inputStyle}
                            placeholder="your-handle"
                            value={shopHandleDraft}
                            onChange={(event) => setShopHandleDraft(event.target.value)}
                          />
                          <small>
                            This becomes part of your shop link, like /sister-store. Use letters,
                            numbers, and dashes only.
                          </small>
                        </label>

                        <label className="vendor-field vendor-field--full">
                          <span>Shop photo or logo</span>
                          <div className="vendor-upload-field">
                            <input
                              ref={logoInputRef}
                              className="vendor-hidden-input"
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                            />
                            <button
                              type="button"
                              className="vendor-upload-button"
                              onClick={() => logoInputRef.current?.click()}
                            >
                              <ImagePlus size={16} />
                              <span>{logoFile ? logoFile.name : 'Choose shop logo'}</span>
                            </button>
                          </div>
                          <small>Use any clear square image. A logo is great, but a simple shop photo also works.</small>
                        </label>
                      </div>
                    </section>

                    <section className="vendor-profile-section-card vendor-profile-section-card--guided">
                      <div className="vendor-profile-section-card__head vendor-profile-section-card__head--guided">
                        <div>
                          <span>Step 2</span>
                          <strong>Add the place and contact customers should use</strong>
                          <p>Help customers understand where you are and how they should message you.</p>
                        </div>
                        <div className={`vendor-inline-status ${locationAndContactReady ? 'is-ready' : ''}`}>
                          {locationAndContactReady ? 'Location and Telegram ready' : 'Add location and Telegram'}
                        </div>
                      </div>

                      <div className="vendor-profile-quick-help">
                        <div className="vendor-profile-quick-help__item">
                          <span>Location idea</span>
                          <strong>Use your city, pickup point, or delivery area</strong>
                        </div>
                        <div className="vendor-profile-quick-help__item">
                          <span>Contact idea</span>
                          <strong>Use one Telegram username customers can message right away</strong>
                        </div>
                      </div>

                      <div className="vendor-form-grid vendor-form-grid--store">
                        <label className="vendor-field vendor-field--guided">
                          <span>City, pickup place, or delivery area</span>
                          <div style={{ display: 'grid', gap: '10px' }}>
                            <input
                              style={inputStyle}
                              placeholder="Battambang city, pickup at Psar Nat"
                              value={shopForm.location}
                              onChange={(event) =>
                                setShopForm((current) => ({
                                  ...current,
                                  location: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              style={{
                                ...secondaryButtonStyle,
                                width: '100%',
                                opacity: detectingLocation ? 0.7 : 1,
                                cursor: detectingLocation ? 'wait' : 'pointer',
                              }}
                              onClick={fillCurrentLocation}
                              disabled={detectingLocation}
                            >
                              <MapPin size={16} />
                              <span>
                                {detectingLocation
                                  ? 'Detecting current location...'
                                  : 'Use my current location'}
                              </span>
                            </button>
                          </div>
                          <small>
                            You can type this yourself if you prefer. Example: Battambang city,
                            pickup at Psar Nat.
                          </small>
                          <div className="vendor-field-preview">
                            <span>Shown to customers</span>
                            <strong>
                              {trimmedShopLocation
                                ? previewLocation
                                : 'Your city, pickup point, or delivery area will show here.'}
                            </strong>
                          </div>
                        </label>

                        <label className="vendor-field vendor-field--guided">
                          <span>Telegram for customer messages</span>
                          <input
                            style={inputStyle}
                            placeholder="@yourtelegram"
                            value={shopForm.telegram}
                            onChange={(event) =>
                              setShopForm((current) => ({
                                ...current,
                                telegram: event.target.value,
                              }))
                            }
                          />
                          <small>Customers will use this when they want to ask questions or confirm an order.</small>
                          <div className="vendor-field-preview">
                            <span>Shown to customers</span>
                            <strong>{trimmedShopTelegram ? previewTelegram : '@yourtelegram'}</strong>
                          </div>
                        </label>
                      </div>
                    </section>

                    <section className="vendor-profile-section-card vendor-profile-section-card--full vendor-profile-section-card--guided">
                      <div className="vendor-profile-section-card__head vendor-profile-section-card__head--guided">
                        <div>
                          <span>Step 3</span>
                          <strong>Write a short shop introduction</strong>
                          <p>Use simple words to explain what you sell and what customers can expect.</p>
                        </div>
                        <div className={`vendor-inline-status ${trimmedShopDescription ? 'is-ready' : ''}`}>
                          {trimmedShopDescription
                            ? `${descriptionCharacterCount} characters written`
                            : 'Keep it short and friendly'}
                        </div>
                      </div>

                      <div className="vendor-profile-quick-help vendor-profile-quick-help--writing">
                        <div className="vendor-profile-quick-help__item">
                          <span>Simple format</span>
                          <strong>What you sell, where you help, and one warm detail</strong>
                        </div>
                        <div className="vendor-profile-quick-help__item">
                          <span>Best length</span>
                          <strong>One or two short sentences is enough</strong>
                        </div>
                      </div>

                      <label className="vendor-field vendor-field--guided">
                        <span>Short message for customers</span>
                        <textarea
                          style={{ ...inputStyle, minHeight: '156px', resize: 'vertical' }}
                          placeholder="Tell shoppers what makes your store worth visiting."
                          value={shopForm.description}
                          onChange={(event) =>
                            setShopForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          />
                        <small>Example: Homemade snacks, beauty products, or local pickup gifts.</small>
                        <div className="vendor-field-preview vendor-field-preview--message">
                          <span>Storefront preview</span>
                          <strong>
                            {trimmedShopDescription
                              ? trimmedShopDescription
                              : 'A short welcome message will appear here for customers.'}
                          </strong>
                        </div>
                      </label>
                    </section>
                  </div>

                  <div className="vendor-profile-guide">
                    <div className="vendor-note-card">
                      <span>Step 1</span>
                      <strong>Use a clear shop name</strong>
                      <p>Pick a name customers can remember and match it with a simple picture or logo.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Step 2</span>
                      <strong>Add location and one contact</strong>
                      <p>Show customers where you are and give them one Telegram username they can message easily.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Step 3</span>
                      <strong>Write a short welcome message</strong>
                      <p>Use a simple sentence or two so shoppers quickly understand what your store sells.</p>
                    </div>
                  </div>

                  <div className="vendor-form-actions">
                    <button style={buttonStyle} type="button" onClick={saveShop} disabled={savingShop}>
                      {savingShop ? 'Saving...' : shopId ? 'Save shop details' : 'Create my shop page'}
                    </button>
                    <span>Your customer link will be /{displayHandle}. You can change it later.</span>
                  </div>
                </section>

                <div className="vendor-profile-side">
                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head vendor-section-head--stacked">
                    <div>
                      <span className="vendor-section-kicker">Live Preview</span>
                      <h2>Preview the page customers will see</h2>
                      <p>Check whether the name, location, contact, and description feel clear before saving.</p>
                    </div>
                  </div>

                  <div className="vendor-preview-panel vendor-preview-panel--expanded">
                    <div className="vendor-preview-panel__head">
                      <div className="vendor-logo-orb vendor-logo-orb--small">
                        {logoImage ? (
                          <img src={logoImage} alt="Preview logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          displayLogoText
                        )}
                      </div>
                      <div>
                        <strong>{shopForm.name || 'Your storefront'}</strong>
                        <div className="vendor-preview-handle">/{displayHandle}</div>
                      </div>
                    </div>
                    <p className="vendor-preview-copy">
                      {shopForm.description || 'Add a short description so customers understand your store quickly.'}
                    </p>
                    <div className="vendor-preview-contact">
                      <MapPin size={16} />
                      <span>{previewLocation}</span>
                    </div>
                    <div className="vendor-preview-contact">
                      <MessageCircle size={16} />
                      <span>{previewTelegram}</span>
                    </div>
                    <input style={inputStyle} readOnly value={shopLink || 'Create your shop first'} />
                    <div className="vendor-form-actions">
                      <button style={secondaryButtonStyle} type="button" onClick={copyShopLink}>
                        <Copy size={16} />
                        <span>Copy Link</span>
                      </button>
                      <button style={secondaryButtonStyle} type="button" onClick={openShopPreview}>
                        <ExternalLink size={16} />
                        <span>Open Storefront</span>
                      </button>
                    </div>
                  </div>

                  <div className="vendor-note-stack">
                    <div className="vendor-note-card">
                      <span>What customers notice first</span>
                      <strong>Name, about text, and location</strong>
                      <p>Those details should work together so the shop feels real, local, and easy to understand at a glance.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Fast trust signal</span>
                      <strong>
                        {shopForm.telegram && shopForm.location ? 'Location and contact included' : 'Add location and contact'}
                      </strong>
                      <p>Stores feel more credible when customers know where the shop is based and where to ask questions.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Public Handle</span>
                      <strong>/{displayHandle}</strong>
                      <p>{hasShop ? 'This is the public link customers can remember and revisit.' : 'Save the profile to lock in this public address.'}</p>
                    </div>
                  </div>
                </section>

                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head vendor-section-head--stacked">
                    <div>
                      <span className="vendor-section-kicker">Readiness Review</span>
                      <h2>Check the details that shape trust</h2>
                      <p>These profile checkpoints help you spot what still needs attention before you promote the store.</p>
                    </div>
                  </div>

                  <div className="vendor-profile-review-summary">
                    <strong>{storeDetailsReadyLabel}</strong>
                    <span>{profileHealthLabel}</span>
                  </div>

                  <div className="vendor-dashboard-checklist vendor-dashboard-checklist--stacked vendor-dashboard-checklist--detailed">
                    {profileChecklist.map((item) => (
                      <div
                        key={item.label}
                        className={`vendor-dashboard-check vendor-dashboard-check--detailed ${item.done ? 'is-done' : ''}`}
                      >
                        <div className={`vendor-dashboard-check__status ${item.done ? 'is-done' : ''}`}>
                          {item.done ? 'Ready' : 'Add'}
                        </div>
                        <div className="vendor-dashboard-check__body">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <p>{item.helper}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="vendor-note-stack vendor-note-stack--compact">
                    <div className="vendor-note-card">
                      <span>Public Handle</span>
                      <strong>/{displayHandle}</strong>
                      <p>{hasShop ? 'This is the live address customers can remember and revisit.' : 'Save the profile to reserve the storefront link.'}</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Store Location</span>
                      <strong>{previewLocation}</strong>
                      <p>Clear location details make pickup, delivery, and local availability easier to understand.</p>
                    </div>
                  </div>
                </section>
                </div>
              </div>
            )}

            {activeView === 'catalog' && (
              <div className="vendor-stack">
                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-catalog-workspace">
                    <div className="vendor-catalog-head-card">
                      <div className="vendor-catalog-head-card__row">
                        <div className="vendor-catalog-head-card__copy">
                          <span>Catalog Workspace</span>
                          <strong>{catalogWorkspaceTitle}</strong>
                          <p>{catalogWorkspaceDescription}</p>
                        </div>
                        <div className="vendor-pill">
                          <Package2 size={14} />
                          <span>{products.length} live</span>
                        </div>
                      </div>

                      <div className="vendor-catalog-focus-pills">
                        {catalogFocusPills.map((item) => (
                          <span key={item} className="vendor-catalog-focus-pill">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="vendor-catalog-status-card">
                      <div className="vendor-catalog-status-card__head">
                        <div className="vendor-catalog-status-card__copy">
                          <span>Publishing access</span>
                          <strong>{catalogStatusTitle}</strong>
                          <p>{catalogStatusDescription}</p>
                        </div>
                        <span className={`vendor-status-pill ${catalogStatusTone}`}>
                          {vendorApproval.label}
                        </span>
                      </div>

                      <div className="vendor-catalog-status-groups">
                        {catalogActionGroups.map((group) => (
                          <div key={group.title} className="vendor-catalog-status-group">
                            <span>{group.title}</span>
                            <ul>
                              {group.items.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      <p className="vendor-catalog-status-card__meta">{approvalSummary}</p>
                    </div>
                  </div>

                  <div className="vendor-hub-stats vendor-hub-stats--catalog">
                    <div className="vendor-hub-stat vendor-hub-stat--catalog">
                      <span>Live products</span>
                      <strong>{products.length}</strong>
                    </div>
                    <div className="vendor-hub-stat vendor-hub-stat--catalog">
                      <span>Units tracked</span>
                      <strong>{totalStock}</strong>
                    </div>
                    <div className="vendor-hub-stat vendor-hub-stat--catalog">
                      <span>Need restock</span>
                      <strong>{lowStockCount}</strong>
                    </div>
                    <div className="vendor-hub-stat vendor-hub-stat--catalog">
                      <span>Out of stock</span>
                      <strong>{outOfStockCount}</strong>
                    </div>
                  </div>

                  <div className="vendor-catalog-editor">
                    <div className="vendor-catalog-editor__form">
                      <div className="vendor-catalog-editor__intro">
                        <span>Product details</span>
                        <strong>
                          {editingProductId
                            ? 'Update this product in one clean form'
                            : 'Create a storefront-ready product'}
                        </strong>
                        <p>
                          Start with the essentials, add a clear photo, and finish with a short
                          description customers can trust.
                        </p>
                      </div>

                      <div className="vendor-catalog-readiness">
                        <div className="vendor-catalog-readiness__head">
                          <div className="vendor-catalog-readiness__copy">
                            <span>Publish readiness</span>
                            <strong>{publishReadinessTitle}</strong>
                            <p>{publishReadinessDescription}</p>
                          </div>
                          <span className={`vendor-status-pill ${publishBlockers.length === 0 ? 'is-good' : 'is-warning'}`}>
                            {publishRequiredCompleteCount}/{publishRequiredItems.length} required
                          </span>
                        </div>

                        <div className="vendor-catalog-readiness__grid">
                          {publishChecklist.map((item) => (
                            <div
                              key={item.key}
                              className={`vendor-catalog-readiness__item ${
                                item.done ? 'is-done' : ''
                              } ${item.required ? '' : 'is-optional'}`}
                            >
                              <span>{item.required ? 'Required' : 'Helpful'}</span>
                              <strong>{item.label}</strong>
                              <p>{item.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="vendor-catalog-readiness__footer">
                          <strong>{publishReadyCount}/{publishChecklist.length} checklist items ready</strong>
                          {!hasShop ? (
                            <button
                              style={secondaryButtonStyle}
                              type="button"
                              onClick={() => setActiveView('store')}
                            >
                              Complete Store Profile
                            </button>
                          ) : (
                            <button
                              style={secondaryButtonStyle}
                              type="button"
                              onClick={openShopPreview}
                              disabled={!shopLink}
                            >
                              Preview Store
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="vendor-catalog-upload-card">
                        <div className="vendor-catalog-upload-card__head">
                          <div className="vendor-catalog-upload-card__copy">
                            <span>Quick product setup</span>
                            <strong>Everything needed for a strong product card</strong>
                            <p>
                              Keep the information simple, clear, and easy for customers to scan.
                            </p>
                          </div>
                          <div className="vendor-catalog-upload-card__tags">
                            <span className="vendor-catalog-upload-tag">Name</span>
                            <span className="vendor-catalog-upload-tag">Price</span>
                            <span className="vendor-catalog-upload-tag">Photo</span>
                            <span className="vendor-catalog-upload-tag is-muted">Description</span>
                          </div>
                        </div>

                        <div className="vendor-catalog-primary-grid">
                          <label className="vendor-field vendor-field--catalog vendor-field--catalog-wide">
                            <span>Name customers will see</span>
                            <input
                              style={inputStyle}
                              placeholder="Organic mango jam"
                              value={productForm.name}
                              onChange={(event) =>
                                setProductForm((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label className="vendor-field vendor-field--catalog">
                            <span>Price label</span>
                            <input
                              style={inputStyle}
                              placeholder="$25"
                              value={productForm.price}
                              onChange={(event) =>
                                setProductForm((current) => ({
                                  ...current,
                                  price: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label className="vendor-field vendor-field--catalog">
                            <span>Stock available</span>
                            <input
                              style={inputStyle}
                              type="number"
                              min="0"
                              step="1"
                              placeholder="12"
                              value={productForm.stock}
                              onChange={(event) =>
                                setProductForm((current) => ({
                                  ...current,
                                  stock: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label className="vendor-field vendor-field--catalog vendor-field--catalog-wide">
                            <span>Discount badge</span>
                            <input
                              style={inputStyle}
                              placeholder="20% OFF"
                              value={productForm.discountBanner}
                              onChange={(event) =>
                                setProductForm((current) => ({
                                  ...current,
                                  discountBanner: event.target.value,
                                }))
                              }
                            />
                            <small>Optional. Add this only when you want a short promotion label on the product card.</small>
                          </label>
                        </div>

                        <div className="vendor-catalog-media-grid">
                          <label className="vendor-field vendor-field--catalog vendor-field--catalog-wide">
                            <span>Product display image</span>
                            <div 
                              className={`vendor-catalog-easy-upload ${productImage ? 'is-ready' : ''}`}
                              style={{ cursor: 'pointer' }}
                            >
                              <input
                                ref={productInputRef}
                                className="vendor-hidden-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onClick={(event) => {
                                  event.currentTarget.value = '';
                                }}
                                onChange={(event) => setProductFile(event.target.files?.[0] || null)}
                              />
                              {productImage ? (
                                <div className="vendor-catalog-easy-upload__empty vendor-catalog-easy-upload__empty--selected">
                                  <div className="vendor-catalog-easy-upload__icon">
                                    <ImagePlus size={32} />
                                  </div>
                                  <strong>{productFile ? 'Photo Selected' : 'Current Photo Ready'}</strong>
                                  <p>
                                    {productFile?.name
                                      ? `${productFile.name} is selected. The actual image preview appears in the product card on the right.`
                                      : 'This product already has a saved photo. Use the product preview card on the right to see it.'}
                                  </p>
                                </div>
                              ) : (
                                <div className="vendor-catalog-easy-upload__empty">
                                  <div className="vendor-catalog-easy-upload__icon">
                                    <ImagePlus size={32} />
                                  </div>
                                  <strong>Add Product Photo</strong>
                                  <p>Tap here to select a bright and clear photo from your device.</p>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>

                        <label className="vendor-field vendor-field--catalog">
                          <span>Product details (Optional)</span>
                          <textarea
                            style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }}
                            placeholder="Tell your customers about the size, flavor, material, or what makes this product special..."
                            value={productForm.desc}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                desc: event.target.value,
                              }))
                            }
                          />
                          <small>
                            Provide helpful details to help customers decide. Keep it simple and clear.
                          </small>
                        </label>
                      </div>

                      <div className="vendor-catalog-submit-bar">
                        <div className="vendor-catalog-submit-bar__copy">
                          <span>Next action</span>
                          <strong>{catalogSubmitTitle}</strong>
                          <p>{catalogSubmitDescription}</p>
                          <small className="vendor-catalog-submit-hint">
                            {editingProductId
                              ? 'This button uses the same save action as the top-right control.'
                              : 'This button uses the same publish action as the top-right control.'}
                          </small>
                        </div>

                        <div className="vendor-form-actions vendor-form-actions--catalog vendor-form-actions--catalog-inline">
                          <button
                            type="button"
                            className="btn-primary vendor-catalog-submit-bar__button"
                            onClick={submitProduct}
                            disabled={catalogSubmitDisabled}
                          >
                            {catalogSubmitButtonLabel}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="vendor-catalog-editor__preview">
                      <div className="vendor-catalog-editor__intro vendor-catalog-editor__intro--preview">
                        <span>Live preview</span>
                        <strong>Check the customer-facing product card</strong>
                        <p>
                          This shows how the product can look in the storefront before you publish
                          it.
                        </p>
                      </div>

                      <div className={`vendor-product-preview vendor-product-preview--stage ${productImage ? '' : 'is-empty'}`}>
                        {productImage ? (
                          <>
                            <img
                              src={productImage}
                              alt="Product preview"
                              className="vendor-product-preview__image"
                            />
                            {productForm.discountBanner.trim() && (
                              <span className="vendor-product-discount">
                                {productForm.discountBanner.trim()}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="vendor-product-preview__empty">
                            <Package2 size={28} />
                            <strong>Product preview</strong>
                            <span>Add a photo to preview how the card can look in the storefront.</span>
                          </div>
                        )}
                      </div>
                      <div className="vendor-note-card">
                        <span>Customer-facing card</span>
                        {productForm.discountBanner.trim() && (
                          <div className="vendor-inline-discount">{productForm.discountBanner.trim()}</div>
                        )}
                        <strong>{productForm.name || 'Product name'}</strong>
                        <p>
                          {productForm.price
                            ? `Price shown to customers: ${productForm.price}`
                            : 'Add a price so customers can understand the offer quickly.'}
                        </p>
                        <p>{`Stock available: ${productForm.stock === '' ? 0 : productForm.stock}`}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head">
                    <div>
                      <span className="vendor-section-kicker">Product Hub Table</span>
                      <h2>Review stock and product status quickly</h2>
                      <p>This vendor-only list gives you the same inventory-style view without opening admin.</p>
                    </div>
                    <div className="vendor-pill">
                      <Package2 size={14} />
                      <span>{totalStock} total units</span>
                    </div>
                  </div>

                  {productHubRows.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        style={{
                          ...secondaryButtonStyle,
                          width: '100%',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          fontSize: '13px',
                        }}
                        onClick={() => setProductHubOpen(!productHubOpen)}
                      >
                        <span>{productHubOpen ? 'Hide' : 'Show'} Product Table</span>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          opacity: 0.8
                        }}>
                          <strong>{productHubRows.length}</strong>
                          <Eye size={14} style={{ opacity: productHubOpen ? 0.5 : 1 }} />
                        </div>
                      </button>

                      {productHubOpen && (
                        <div className="vendor-table-wrap vendor-table-wrap--collapsible" style={{ marginTop: '14px' }}>
                          <table className="vendor-table">
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Sold</th>
                                <th>Updated</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productHubRows.map((product) => {
                                const stockBadge = getStockBadge(product.stock);

                                return (
                                  <tr key={product.id} className="vendor-table-row">
                                    <td data-label="Product">
                                      <div className="vendor-table-product">
                                        <div className="vendor-table-product__media">
                                          {product.imageUrl ? (
                                            <img
                                              src={product.imageUrl}
                                              alt={product.name}
                                              className="vendor-table-product__image"
                                            />
                                          ) : (
                                            <div className="vendor-product-thumb-fallback">
                                              <Package2 size={18} />
                                            </div>
                                          )}
                                          {product.discountBanner && (
                                            <div className="vendor-table-discount-badge">
                                              {product.discountBanner}
                                            </div>
                                          )}
                                        </div>
                                        <div className="vendor-table-product__copy">
                                          <strong>{product.name}</strong>
                                          <div className="vendor-mobile-hub-meta">
                                            <span>{product.price}</span>
                                            <div className="vendor-meta-dot" />
                                            <span>{stockBadge.label}</span>
                                          </div>
                                          <span className="vendor-hub-id-hint">{product.discountBanner || `Product #${product.id}`}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td data-label="Price" className="vendor-desktop-hub-field">{product.price}</td>
                                    <td data-label="Stock" className="vendor-desktop-hub-field">
                                      <span className={`vendor-status-pill ${stockBadge.tone}`}>
                                        {stockBadge.label}
                                      </span>
                                    </td>
                                    <td data-label="Sold" className="vendor-desktop-hub-field">{product.sold || 0}</td>
                                    <td data-label="Updated">
                                      {formatDateTime(product.updatedAt || product.createdAt) || '-'}
                                    </td>
                                    <td data-label="Action" className="vendor-table-action">
                                      <div className="vendor-table-action-group">
                                        <button
                                          className="vendor-btn-secondary"
                                          type="button"
                                          onClick={() => startEdit(product)}
                                          disabled={deletingProductId === product.id || !canPublishProducts}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          className="vendor-btn-danger"
                                          type="button"
                                          onClick={() => deleteProduct(product.id, product.name)}
                                          disabled={deletingProductId === product.id || !canPublishProducts}
                                        >
                                          <Trash2 size={15} />
                                          <span>{deletingProductId === product.id ? 'Deleting...' : 'Delete'}</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {productHubRows.length === 0 && (
                    <div className="vendor-empty-state">
                      <Package2 size={18} />
                      <strong>No products in your hub yet</strong>
                      <span>Publish your first product above and it will appear here with stock and status.</span>
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeView === 'share' && (
              <div className="vendor-share-grid">
                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head vendor-section-head--compact">
                    <div>
                      <span className="vendor-section-kicker">Store Link</span>
                      <h2>Share your link</h2>
                      <p>Copy or open it before sending it to customers.</p>
                    </div>
                    <div className="vendor-pill">
                      <Globe size={14} />
                      <span>{hasShop ? 'Ready' : 'Locked'}</span>
                    </div>
                  </div>

                  <div className="vendor-share-link-box">
                    <div className="vendor-share-link-box__copy">
                      <span>Public link</span>
                      <small>{hasShop ? 'Customers open this page.' : 'Save your store to unlock this link.'}</small>
                    </div>
                    <input style={inputStyle} readOnly value={shopLink || 'Create your shop first'} />
                    <div className="vendor-form-actions">
                      <button style={secondaryButtonStyle} type="button" onClick={copyShopLink}>
                        <Copy size={16} />
                        <span>Copy</span>
                      </button>
                      <button style={secondaryButtonStyle} type="button" onClick={openShopPreview}>
                        <ExternalLink size={16} />
                        <span>Open</span>
                      </button>
                    </div>
                  </div>

                  <div className="vendor-share-steps vendor-share-steps--compact">
                    {setupChecklist.map((item, index) => (
                      <div
                        key={item.label}
                        className={`vendor-step-card vendor-step-card--compact ${item.done ? 'is-done' : ''}`}
                      >
                        <span>{index + 1}</span>
                        <div className="vendor-step-card__copy">
                          <strong>{item.label}</strong>
                          <p>{item.hint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head vendor-section-head--stacked">
                    <div>
                      <span className="vendor-section-kicker">Storefront Readiness</span>
                      <h2>Double-check what customers are about to see</h2>
                      <p>A fast final review helps the public page feel intentional before you send it out.</p>
                    </div>
                  </div>

                  <div className="vendor-preview-panel vendor-preview-panel--expanded">
                    <div className="vendor-preview-panel__head">
                      <div className="vendor-logo-orb vendor-logo-orb--small">
                        {logoImage ? (
                          <img src={logoImage} alt="Preview logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          displayLogoText
                        )}
                      </div>
                      <div>
                        <strong>{shopForm.name || 'Your storefront'}</strong>
                        <div className="vendor-preview-handle">/{displayHandle}</div>
                      </div>
                    </div>
                    <p className="vendor-preview-copy">
                      {shopForm.description || 'Add a short description so customers understand your store quickly.'}
                    </p>
                    <div className="vendor-preview-contact">
                      <MapPin size={16} />
                      <span>{previewLocation}</span>
                    </div>
                    <div className="vendor-preview-contact">
                      <MessageCircle size={16} />
                      <span>{previewTelegram}</span>
                    </div>
                  </div>

                  <div className="vendor-share-hints">
                    <div className="vendor-note-card">
                      <span>Handle</span>
                      <strong>/{displayHandle}</strong>
                      <p>This is the exact public path customers will use when they visit your shop.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Location</span>
                      <strong>{previewLocation}</strong>
                      <p>Customers can understand your city, pickup point, or delivery area before they message you.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Catalog status</span>
                      <strong>{products.length} product{products.length === 1 ? '' : 's'} live</strong>
                      <p>{products.length > 0 ? 'Your storefront has items to browse.' : 'Add at least one product before promoting the link broadly.'}</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Contact channel</span>
                      <strong>{shopForm.telegram ? previewTelegram : 'Missing Telegram'}</strong>
                      <p>Make sure customers know how to reach you after opening the storefront.</p>
                    </div>
                  </div>
                </section>
              </div>
            )}
        </div>
      </main>

    </div>
  );
}

