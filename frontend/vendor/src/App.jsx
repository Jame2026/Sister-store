import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Copy,
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
} from 'lucide-react';

const TOKEN_STORAGE_KEY = 'vendor_auth_token';
const EMPTY_AUTH = { email: '', password: '', confirmPassword: '' };
const EMPTY_SHOP = { name: '', description: '', location: '', telegram: '', logoImageUrl: '' };
const EMPTY_PRODUCT = { name: '', price: '', desc: '', discountBanner: '', stock: '0' };
const EMPTY_ANALYTICS = {
  totalBookings: 0,
  totalBookedQuantity: 0,
  totalIncome: 0,
  totalIncomeLabel: '',
  lastBookingAt: null,
};

const pageStyle = {
  minHeight: '100vh',
  background: '#0f172a',
  color: '#f8fafc',
  padding: '36px 20px 56px',
};

const cardStyle = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: 'none',
};

const inputStyle = {
  width: '100%',
  background: '#0f172a',
  color: '#f8fafc',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '14px',
  fontFamily: 'inherit',
};

const buttonStyle = {
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 16px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: 'inherit',
  boxShadow: 'none',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#0f172a',
  border: '1px solid #334155',
  color: '#e2e8f0',
};

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
  const [activeView, setActiveView] = useState('overview');

  const [token, setToken] = useState('');
  const [account, setAccount] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [recentBookings, setRecentBookings] = useState([]);

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
  const displayLogoText = initials(shopForm.name || account?.email || 'Sister Store');
  const previewTelegram = shopForm.telegram
    ? `@${shopForm.telegram.replace(/^@+/, '')}`
    : '@yourtelegram';
  const previewLocation = shopForm.location || 'Add your city, pickup point, or delivery area';
  const setupChecklist = useMemo(
    () => [
      {
        label: 'Account ready',
        done: Boolean(account?.email),
        hint: account?.email || 'Sign in to your vendor account',
      },
      {
        label: 'Store details',
        done: hasShop,
        hint: hasShop
          ? `${shopForm.name || 'Store'} is saved`
          : 'Add store name, location, and Telegram',
      },
      {
        label: 'Products added',
        done: products.length > 0,
        hint:
          products.length > 0
            ? `${products.length} product${products.length === 1 ? '' : 's'} live`
            : 'Add your first product',
      },
      {
        label: 'Link ready',
        done: hasShop && products.length > 0,
        hint:
          hasShop && products.length > 0
            ? 'Store link is ready to share'
            : hasShop
              ? 'Add a product before sharing'
              : 'Save your store profile first',
      },
    ],
    [account?.email, hasShop, products.length, shopForm.name]
  );
  const setupCompleteCount = setupChecklist.filter((item) => item.done).length;
  const setupProgress = Math.round((setupCompleteCount / setupChecklist.length) * 100);
  const profileChecklist = useMemo(
    () => [
      {
        label: 'Shop name',
        done: Boolean(shopForm.name.trim()),
        value: shopForm.name.trim() || 'Add a clear shop name',
      },
      {
        label: 'About section',
        done: Boolean(shopForm.description.trim()),
        value: shopForm.description.trim()
          ? 'Description ready'
          : 'Write a short storefront introduction',
      },
      {
        label: 'Location',
        done: Boolean(shopForm.location.trim()),
        value: shopForm.location.trim() || 'Add your city, pickup point, or delivery area',
      },
      {
        label: 'Telegram',
        done: Boolean(shopForm.telegram.trim()),
        value: shopForm.telegram.trim() ? previewTelegram : 'Add a Telegram username',
      },
      {
        label: 'Public handle',
        done: Boolean(resolvedHandle),
        value: resolvedHandle ? `/${displayHandle}` : 'Create a memorable public handle',
      },
    ],
    [
      displayHandle,
      previewTelegram,
      resolvedHandle,
      shopForm.description,
      shopForm.location,
      shopForm.name,
      shopForm.telegram,
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
    activeView === 'store'
      ? 'Store Profile'
      : activeView === 'catalog'
        ? 'Products'
        : activeView === 'share'
          ? 'Share Store'
          : 'Dashboard';
  const pageDescription =
    activeView === 'store'
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
      { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'store', label: 'Store Profile', icon: Store },
      { id: 'catalog', label: 'Products', icon: Package2 },
      { id: 'share', label: 'Share Store', icon: Globe },
    ],
    []
  );
  const accountInitials = initials(account?.email || 'Vendor');
  const primaryAction =
    activeView === 'store'
      ? {
          label: savingShop ? 'Saving...' : hasShop ? 'Save Changes' : 'Create Store',
          onClick: saveShop,
          disabled: savingShop,
        }
      : activeView === 'catalog'
        ? {
            label: savingProduct
              ? 'Saving...'
              : editingProductId
                ? 'Update Product'
                : 'Add Product',
            onClick: submitProduct,
            disabled: savingProduct,
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
    activeView === 'catalog'
      ? editingProductId
        ? {
            label: 'Cancel Edit',
            onClick: resetProductEditor,
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
    setStoredToken('');
    setToken('');
    setAccount(null);
    setAuthError('');
    setAuthForm(EMPTY_AUTH);
    setActiveView('overview');
    resetWorkspace();
    if (message) {
      setNotice(message);
    }
  }

  function hydrateWorkspace(payload) {
    setAccount(payload.account || null);
    setAnalytics(payload.analytics || EMPTY_ANALYTICS);
    setRecentBookings(payload.bookings || []);

    if (payload.shop) {
      setShopId(payload.shop.shopId);
      setShopHandleDraft(payload.shop.shopId);
      setShopForm({
        name: payload.shop.name || '',
        description: payload.shop.description || '',
        location: payload.shop.location || '',
        telegram: payload.shop.telegram || '',
        logoImageUrl: payload.shop.logoImageUrl || '',
      });
      setProducts(payload.shop.products || []);
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
    return fetch(url, { ...options, headers });
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
        const payload = await readApiResponse(await authedFetch('/api/vendor/me', {}, storedToken));
        setToken(storedToken);
        hydrateWorkspace(payload);
        setNotice(payload.shop ? 'Signed in. Your vendor workspace is ready.' : 'Signed in. Create your shop to start selling.');
      } catch {
        clearSession('Your previous session expired. Please sign in again.');
      } finally {
        setLoading(false);
        setAuthReady(true);
      }
    }

    restoreSession();
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    setNotice('');

    try {
      if (authMode === 'register' && authForm.password !== authForm.confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const endpoint =
        authMode === 'register' ? '/api/vendor/auth/register' : '/api/vendor/auth/login';

      const payload = await readApiResponse(
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authForm.email,
            password: authForm.password,
          }),
        })
      );

      setStoredToken(payload.token);
      setToken(payload.token);
      hydrateWorkspace(payload);
      setAuthForm(EMPTY_AUTH);
      setNotice(
        authMode === 'register'
          ? 'Vendor account created. You can set up your shop now.'
          : 'Signed in. Your vendor workspace is ready.'
      );
    } catch (error) {
      setAuthError(error.message || 'Unable to continue.');
    } finally {
      setAuthBusy(false);
      setAuthReady(true);
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
    if (!productForm.name.trim() || !productForm.price.trim()) {
      setNotice('Product name and price are required.');
      return;
    }

    if (!shopId) {
      const savedShop = await saveShop();
      if (!savedShop) {
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

      setProducts((current) =>
        editingProductId
          ? current.map((product) => (product.id === payload.product.id ? payload.product : product))
          : [...current, payload.product]
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

  function openShopPreview() {
    if (!shopLink) {
      setNotice('Create your shop first to unlock the public link.');
      return;
    }

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
            <p style={{ color: '#cbd5e1', margin: 0 }}>
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
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
              >
                Register
              </button>
              <button
                className={`vendor-toggle-btn ${authMode === 'login' ? 'is-active' : ''}`}
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
              >
                Sign In
              </button>
            </div>

            <h2 style={{ marginTop: 0 }}>
              {authMode === 'register' ? 'Create Vendor Account' : 'Sign In To Workspace'}
            </h2>
            <p style={{ color: '#94a3b8', marginTop: '-6px' }}>
              {authMode === 'register'
                ? 'Start your own vendor workspace.'
                : 'Continue managing your storefront.'}
            </p>

            <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: '12px' }}>
              <input
                style={inputStyle}
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, email: event.target.value }))
                }
              />
              <input
                style={inputStyle}
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, password: event.target.value }))
                }
              />
              {authMode === 'register' && (
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Confirm Password"
                  value={authForm.confirmPassword}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                />
              )}
              {notice && <div className="vendor-banner">{notice}</div>}
              {authError && <div className="vendor-banner vendor-banner--error">{authError}</div>}
              <button style={buttonStyle} type="submit" disabled={authBusy}>
                {authBusy
                  ? 'Working...'
                  : authMode === 'register'
                    ? 'Create Vendor Account'
                    : 'Sign In'}
              </button>
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

          <p className="nav-label" style={{ marginTop: '24px' }}>
            ACCOUNT
          </p>
          <button
            type="button"
            className="nav-item vendor-nav-button"
            onClick={openShopPreview}
            disabled={!shopLink}
          >
            <ExternalLink size={20} />
            <span>Preview Store</span>
          </button>
          <button
            type="button"
            className="nav-item vendor-nav-button"
            onClick={() => clearSession()}
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
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
            <div className="avatar">{accountInitials}</div>
          </div>
        </header>

        <div className="content-area">
          <div className="vendor-mobile-nav">
            <section className="vendor-mobile-nav-section">
              <p className="vendor-mobile-nav-label">Main</p>
              <div className="vendor-mobile-nav-list">
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
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="vendor-mobile-nav-section">
              <p className="vendor-mobile-nav-label">Account</p>
              <div className="vendor-mobile-nav-list">
                <button
                  type="button"
                  className="nav-item vendor-nav-button vendor-mobile-nav-button"
                  onClick={openShopPreview}
                  disabled={!shopLink}
                >
                  <ExternalLink size={18} />
                  <span>Preview Store</span>
                </button>
                <button
                  type="button"
                  className="nav-item vendor-nav-button vendor-mobile-nav-button"
                  onClick={() => clearSession()}
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </section>
          </div>

          <section className="vendor-mobile-shell">
            <div className="vendor-mobile-shell__head">
              <div className="vendor-mobile-shell__brand">
                <span>Vendor Workspace</span>
                <strong>{account?.email || 'Vendor account owner'}</strong>
                <small>{nextAction.label}</small>
              </div>
              <div className="vendor-pill">
                <Sparkles size={14} />
                <span>{setupProgress}% ready</span>
              </div>
            </div>

            <div className="vendor-mobile-shell__progress">
              <div className="vendor-mobile-shell__progress-head">
                <div>
                  <span>Next Step</span>
                  <strong>{nextAction.label}</strong>
                </div>
                <strong>{setupProgress}%</strong>
              </div>
              <div className="vendor-progress-bar">
                <span style={{ width: `${setupProgress}%` }} />
              </div>
            </div>

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

          <div className="page-header vendor-page-header">
            <div>
              <h1>{pageTitle}</h1>
              <p>{pageDescription}</p>
            </div>
            <div className="vendor-page-actions">
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
            <div className="vendor-alert">
              {loading ? 'Loading your workspace from the backend...' : notice}
            </div>
          )}

          <div className="vendor-summary-grid">
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
              <div className="vendor-dashboard-shell">
                <div className="vendor-overview-grid">
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

                  {recentProducts.length > 0 ? (
                    <div className="vendor-mini-product-list">
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
                  ) : (
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
                      <span className="vendor-section-kicker">Telegram Bookings</span>
                      <h2>Income from customer bookings</h2>
                      <p>
                        Each time a customer books items and the Telegram draft opens, the booking
                        total is recorded here for the vendor dashboard.
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

                  {recentBookings.length > 0 ? (
                    <div className="vendor-booking-list">
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
                            <span className="vendor-booking-card__badge">Telegram</span>
                          </div>
                          <p>
                            {booking.itemsPreview ||
                              `${booking.itemCount} product${booking.itemCount === 1 ? '' : 's'} booked`}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="vendor-empty-state">
                      <MessageCircle size={18} />
                      <strong>No Telegram bookings yet</strong>
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

            {activeView === 'store' && (
              <div className="vendor-profile-shell">
                <section className="vendor-panel-card vendor-profile-editor" style={cardStyle}>
                  <div className="vendor-section-head">
                    <div>
                      <span className="vendor-section-kicker">Store Profile</span>
                      <h2>Design a shop profile that feels polished and dependable</h2>
                      <p>Update the branding, location, and contact details customers will see first so the storefront feels like a real business.</p>
                    </div>
                    <div className="vendor-pill">
                      <Store size={14} />
                      <span>{hasShop ? 'Store Live' : 'Draft Mode'}</span>
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
                        <strong>{shopForm.name || 'Your storefront'}</strong>
                        <span>/{displayHandle}</span>
                        <small>{account?.email || 'Vendor account owner'}</small>
                      </div>
                    </div>

                    <div className="vendor-chip-row">
                      <span className={`vendor-info-chip ${hasShop ? 'is-primary' : ''}`}>
                        {hasShop ? 'Public storefront live' : 'Draft storefront'}
                      </span>
                      <span className="vendor-info-chip">{profileHealthLabel}</span>
                      <span className="vendor-info-chip">{previewLocation}</span>
                    </div>
                  </div>

                  <div className="vendor-profile-sections">
                    <section className="vendor-profile-section-card">
                      <div className="vendor-profile-section-card__head">
                        <span>Brand foundation</span>
                        <strong>Name, public handle, and logo</strong>
                      </div>

                      <div className="vendor-form-grid vendor-form-grid--store">
                        <label className="vendor-field">
                          <span>Shop name</span>
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
                          <span>Public handle</span>
                          <input
                            style={inputStyle}
                            placeholder="your-handle"
                            value={shopHandleDraft}
                            onChange={(event) => setShopHandleDraft(event.target.value)}
                          />
                          <small>
                            Use letters, numbers, and dashes only. Changing this updates your
                            public store link after you save.
                          </small>
                        </label>

                        <label className="vendor-field vendor-field--full">
                          <span>Store logo</span>
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
                          <small>Square logos work best for the profile block and storefront preview.</small>
                        </label>
                      </div>
                    </section>

                    <section className="vendor-profile-section-card">
                      <div className="vendor-profile-section-card__head">
                        <span>Contact and reach</span>
                        <strong>Location and response channel</strong>
                      </div>

                      <div className="vendor-form-grid vendor-form-grid--store">
                        <label className="vendor-field">
                          <span>Shop location</span>
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
                                  : 'Use Current Location'}
                              </span>
                            </button>
                          </div>
                          <small>
                            Use your current location from OpenStreetMap or type your city,
                            pickup point, or delivery area manually.
                          </small>
                        </label>

                        <label className="vendor-field">
                          <span>Telegram username</span>
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
                          <small>This gives customers a direct line back to you.</small>
                        </label>
                      </div>
                    </section>

                    <section className="vendor-profile-section-card vendor-profile-section-card--full">
                      <div className="vendor-profile-section-card__head">
                        <span>About section</span>
                        <strong>Describe what shoppers can expect from this store</strong>
                      </div>

                      <label className="vendor-field">
                        <span>About your shop</span>
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
                        <small>Keep it concise and specific so the page feels focused right away.</small>
                      </label>
                    </section>
                  </div>

                  <div className="vendor-profile-guide">
                    <div className="vendor-note-card">
                      <span>About Profile</span>
                      <strong>Explain what your shop is about</strong>
                      <p>Write one short description that tells shoppers what you sell and what style or category they should expect.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Location</span>
                      <strong>Help nearby buyers understand your area</strong>
                      <p>Add your city, district, pickup place, or delivery range so customers know if they can order from you easily.</p>
                    </div>
                    <div className="vendor-note-card">
                      <span>Contact</span>
                      <strong>Keep one active Telegram username</strong>
                      <p>Customers will use this direct contact when they ask questions or confirm an order after selecting products.</p>
                    </div>
                  </div>

                  <div className="vendor-form-actions">
                    <button style={buttonStyle} type="button" onClick={saveShop} disabled={savingShop}>
                      {savingShop ? 'Saving...' : shopId ? 'Save Shop Changes' : 'Create My Shop'}
                    </button>
                    <span>Customers will visit /{displayHandle} once the profile is saved.</span>
                  </div>
                </section>

                <div className="vendor-profile-side">
                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head vendor-section-head--stacked">
                    <div>
                      <span className="vendor-section-kicker">Live Preview</span>
                      <h2>Preview the exact impression customers will get</h2>
                      <p>Use this preview to check whether the brand, location, and contact details all feel aligned.</p>
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

                  <div className="vendor-dashboard-checklist vendor-dashboard-checklist--stacked">
                    {profileChecklist.map((item) => (
                      <div
                        key={item.label}
                        className={`vendor-dashboard-check ${item.done ? 'is-done' : ''}`}
                      >
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
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
                  <div className="vendor-section-head">
                    <div>
                      <span className="vendor-section-kicker">Product Hub Editor</span>
                      <h2>{editingProductId ? 'Update this product' : 'Add a product to your hub'}</h2>
                      <p>Keep the product details, stock, and image clear so the vendor hub stays easy to manage.</p>
                    </div>
                    <div className="vendor-pill">
                      <Package2 size={14} />
                      <span>{products.length} in catalog</span>
                    </div>
                  </div>

                  <div className="vendor-hub-stats">
                    <div className="vendor-hub-stat">
                      <span>Products live</span>
                      <strong>{products.length}</strong>
                    </div>
                    <div className="vendor-hub-stat">
                      <span>Total units in stock</span>
                      <strong>{totalStock}</strong>
                    </div>
                    <div className="vendor-hub-stat">
                      <span>Low stock items</span>
                      <strong>{lowStockCount}</strong>
                    </div>
                    <div className="vendor-hub-stat">
                      <span>Out of stock</span>
                      <strong>{outOfStockCount}</strong>
                    </div>
                  </div>

                  <div className="vendor-catalog-editor">
                    <div className="vendor-catalog-editor__form">
                      <div className="vendor-form-grid vendor-form-grid--catalog">
                        <label className="vendor-field">
                          <span>Product name</span>
                          <input
                            style={inputStyle}
                            placeholder="Product Name"
                            value={productForm.name}
                            onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                          />
                        </label>

                        <label className="vendor-field">
                          <span>Price</span>
                          <input
                            style={inputStyle}
                            placeholder="$25"
                            value={productForm.price}
                            onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))}
                          />
                        </label>

                        <label className="vendor-field">
                          <span>Discount banner</span>
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
                          <small>Optional. This short label will show on the product card for customers.</small>
                        </label>

                        <label className="vendor-field">
                          <span>Available quantity</span>
                          <input
                            style={inputStyle}
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={productForm.stock}
                            onChange={(event) =>
                              setProductForm((current) => ({
                                ...current,
                                stock: event.target.value,
                              }))
                            }
                          />
                          <small>This is how many pieces customers can buy before it shows out of stock.</small>
                        </label>

                        <label className="vendor-field vendor-field--full">
                          <span>Product image</span>
                          <div className="vendor-upload-field">
                            <input
                              ref={productInputRef}
                              className="vendor-hidden-input"
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              onChange={(event) => setProductFile(event.target.files?.[0] || null)}
                            />
                            <button
                              type="button"
                              className="vendor-upload-button"
                              onClick={() => productInputRef.current?.click()}
                            >
                              <ImagePlus size={16} />
                              <span>{productFile ? productFile.name : 'Choose product image'}</span>
                            </button>
                          </div>
                        </label>
                      </div>

                      <label className="vendor-field">
                        <span>Product description</span>
                        <textarea
                          style={{ ...inputStyle, minHeight: '128px', resize: 'vertical' }}
                          placeholder="Explain the product in a short, customer-friendly way."
                          value={productForm.desc}
                          onChange={(event) => setProductForm((current) => ({ ...current, desc: event.target.value }))}
                        />
                      </label>

                      <div className="vendor-form-actions">
                        <button
                          style={buttonStyle}
                          type="button"
                          onClick={submitProduct}
                          disabled={savingProduct || deletingProductId === editingProductId}
                        >
                          {savingProduct ? 'Saving...' : editingProductId ? 'Update Product' : 'Publish Product'}
                        </button>
                        {editingProductId && (
                          <>
                            <button
                              style={secondaryButtonStyle}
                              type="button"
                              onClick={resetProductEditor}
                              disabled={deletingProductId === editingProductId}
                            >
                              Cancel Edit
                            </button>
                            <button
                              className="vendor-btn-danger"
                              type="button"
                              onClick={() => deleteProduct(editingProductId, productForm.name || 'this product')}
                              disabled={deletingProductId === editingProductId}
                            >
                              <Trash2 size={15} />
                              <span>{deletingProductId === editingProductId ? 'Deleting...' : 'Delete Product'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="vendor-catalog-editor__preview">
                      <div className={`vendor-product-preview vendor-product-preview--stage ${productImage ? '' : 'is-empty'}`}>
                        {productImage ? (
                          <>
                            <img
                              src={productImage}
                              alt="Product preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                            <span>Upload an image to see how the card will look in the catalog.</span>
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
                        <p>{`Available quantity: ${productForm.stock === '' ? 0 : productForm.stock}`}</p>
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

                  {productHubRows.length === 0 ? (
                    <div className="vendor-empty-state">
                      <Package2 size={18} />
                      <strong>No products in your hub yet</strong>
                      <span>Publish your first product above and it will appear here with stock and status.</span>
                    </div>
                  ) : (
                    <div className="vendor-table-wrap">
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
                                    </div>
                                    <div className="vendor-table-product__copy">
                                      <strong>{product.name}</strong>
                                      <span>{product.discountBanner || `Product #${product.id}`}</span>
                                    </div>
                                  </div>
                                </td>
                                <td data-label="Price">{product.price}</td>
                                <td data-label="Stock">
                                  <span className={`vendor-status-pill ${stockBadge.tone}`}>
                                    {stockBadge.label}
                                  </span>
                                </td>
                                <td data-label="Sold">{product.sold || 0}</td>
                                <td data-label="Updated">
                                  {formatDateTime(product.updatedAt || product.createdAt) || '-'}
                                </td>
                                <td data-label="Action" className="vendor-table-action">
                                  <div className="vendor-table-action-group">
                                    <button
                                      className="vendor-btn-secondary"
                                      type="button"
                                      onClick={() => startEdit(product)}
                                      disabled={deletingProductId === product.id}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="vendor-btn-danger"
                                      type="button"
                                      onClick={() => deleteProduct(product.id, product.name)}
                                      disabled={deletingProductId === product.id}
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
                </section>
              </div>
            )}

            {activeView === 'share' && (
              <div className="vendor-share-grid">
                <section className="vendor-panel-card" style={cardStyle}>
                  <div className="vendor-section-head">
                    <div>
                      <span className="vendor-section-kicker">Share Control</span>
                      <h2>Send customers to one clean storefront link</h2>
                      <p>Use this area when you are ready to copy, test, and send the public page to customers.</p>
                    </div>
                    <div className="vendor-pill">
                      <Globe size={14} />
                      <span>{hasShop ? 'Share Ready' : 'Locked'}</span>
                    </div>
                  </div>

                  <div className="vendor-share-link-box">
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
                  </div>

                  <div className="vendor-share-steps">
                    {setupChecklist.map((item, index) => (
                      <div key={item.label} className={`vendor-step-card ${item.done ? 'is-done' : ''}`}>
                        <span>{index + 1}</span>
                        <strong>{item.label}</strong>
                        <p>{item.hint}</p>
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

