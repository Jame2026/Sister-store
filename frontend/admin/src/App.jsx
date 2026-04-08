import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart,
  Bell,
  Eye,
  EyeOff,
  Package,
  Search,
  Settings,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';

const ADMIN_TOKEN_STORAGE_KEY = 'admin_auth_token';
const EMPTY_AUTH_FORM = {
  email: '',
  password: '',
  confirmPassword: '',
  resetCode: '',
};
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

const STAT_ICONS = {
  'Total Vendors': Users,
  'Active Products': Package,
  'Pending Approval': AlertTriangle,
  'Suspended Accounts': XCircle,
};

const authInputStyle = {
  width: '100%',
  borderRadius: '14px',
  border: '1px solid #334155',
  background: '#0f172a',
  color: '#f8fafc',
  padding: '14px 16px',
  fontSize: '15px',
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
  color: '#94a3b8',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  padding: '4px',
};

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load admin data.');
  }

  return payload;
}

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function getStoredAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredAdminToken(token) {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(value));
  } catch {
    return '-';
  }
}

function formatStatValue(value) {
  return Number(String(value || '0').replace(/,/g, '')) || 0;
}

function makeInitials(value) {
  const source = String(value || '').trim();

  if (!source) {
    return 'AD';
  }

  const [first = '', second = ''] = source.split(/\s+/);
  const next = `${first[0] || ''}${second[0] || ''}`.toUpperCase();

  return next || source.slice(0, 2).toUpperCase();
}

function isAdminAuthError(message) {
  return /admin token|admin account|sign in as admin/i.test(String(message || ''));
}

function formatAdminErrorMessage(message) {
  const normalized = String(message || '').trim();

  if (!normalized) {
    return 'Unable to continue.';
  }

  if (/database initialization failed: connect ECONNREFUSED/i.test(normalized)) {
    return 'The backend cannot reach MySQL yet. Start MySQL or Laragon, then refresh this page or try signing in again.';
  }

  if (/database initialization failed: access denied/i.test(normalized)) {
    return 'MySQL rejected the database username or password. Check the DB settings in backend/.env.';
  }

  return normalized;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState(EMPTY_AUTH_FORM);
  const [resetDetails, setResetDetails] = useState(null);
  const [passwordVisibility, setPasswordVisibility] = useState({
    password: false,
    confirmPassword: false,
  });
  const [adminToken, setAdminToken] = useState('');
  const [adminAccount, setAdminAccount] = useState(null);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState(0);
  const [deletingProductId, setDeletingProductId] = useState(0);
  const [deletingVendorId, setDeletingVendorId] = useState(0);
  const [approvingVendorId, setApprovingVendorId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadAuthStatus() {
    const payload = await readApiResponse(await fetch(apiUrl('/api/admin/auth/status')));
    setAuthMode(payload.initialized ? 'login' : 'bootstrap');
    setResetDetails(null);
  }

  function resetAdminWorkspace() {
    setActiveTab('dashboard');
    setStats([]);
    setVendors([]);
    setProducts([]);
    setSelectedVendorId(0);
    setDeletingProductId(0);
    setDeletingVendorId(0);
    setApprovingVendorId(0);
    setLoading(false);
    setError('');
    setNotice('');
  }

  async function showAuthScreen(message = '') {
    setStoredAdminToken('');
    setAdminToken('');
    setAdminAccount(null);
    resetAdminWorkspace();
    setResetDetails(null);
    setPasswordVisibility({
      password: false,
      confirmPassword: false,
    });
    setAuthForm(EMPTY_AUTH_FORM);

    try {
      await loadAuthStatus();
      setAuthError(formatAdminErrorMessage(message));
    } catch (statusError) {
      setAuthError(
        formatAdminErrorMessage(
          statusError.message || message || 'Unable to load admin access state.'
        )
      );
    } finally {
      setAuthReady(true);
    }
  }

  function switchAuthMode(nextMode) {
    setAuthMode(nextMode);
    setAuthError('');
    setResetDetails(null);
    setPasswordVisibility({
      password: false,
      confirmPassword: false,
    });
    setAuthForm((current) => ({
      ...EMPTY_AUTH_FORM,
      email: current.email,
    }));
  }

  function togglePasswordVisibility(field) {
    setPasswordVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }));
  }

  function renderPasswordField(field, label, placeholder) {
    const isVisible = passwordVisibility[field];

    return (
      <label style={{ display: 'grid', gap: '8px' }}>
        <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{label}</span>
        <div style={passwordFieldShellStyle}>
          <input
            type={isVisible ? 'text' : 'password'}
            value={authForm[field]}
            onChange={(event) =>
              setAuthForm((current) => ({ ...current, [field]: event.target.value }))
            }
            placeholder={placeholder}
            style={{
              ...authInputStyle,
              paddingRight: '52px',
            }}
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility(field)}
            aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
            style={passwordToggleButtonStyle}
          >
            {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
    );
  }

  async function authedFetch(url, options = {}, overrideToken = '') {
    const activeToken = overrideToken || adminToken;

    if (!activeToken) {
      throw new Error('Please sign in as admin first.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${activeToken}`);

    return fetch(apiUrl(url), { ...options, headers });
  }

  async function loadAdminData(activeToken = '') {
    setLoading(true);

    try {
      const [overviewPayload, productsPayload] = await Promise.all([
        readApiResponse(await authedFetch('/api/admin/overview', {}, activeToken)),
        readApiResponse(await authedFetch('/api/admin/products', {}, activeToken)),
      ]);

      setStats(overviewPayload.stats || []);
      setVendors(overviewPayload.vendors || []);
      setProducts(productsPayload.products || []);
      setError('');
    } catch (nextError) {
      if (isAdminAuthError(nextError.message)) {
        await showAuthScreen('Your admin session expired. Please sign in again.');
        return;
      }

      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedToken = getStoredAdminToken();

      if (storedToken) {
        try {
          const sessionPayload = await readApiResponse(
            await authedFetch('/api/admin/me', {}, storedToken)
          );

          if (cancelled) {
            return;
          }

          setAdminToken(storedToken);
          setAdminAccount(sessionPayload.account || null);
          setAuthError('');
          setAuthReady(true);
          await loadAdminData(storedToken);
          return;
        } catch {
          setStoredAdminToken('');
        }
      }

      if (!cancelled) {
        await showAuthScreen('');
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedVendor =
    selectedVendorId > 0 ? vendors.find((vendor) => vendor.id === selectedVendorId) || null : null;
  const visibleProducts = selectedVendor
    ? products.filter((product) => Number(product.vendorId) === Number(selectedVendor.id))
    : products;
  const adminInitials = makeInitials(adminAccount?.email || 'Admin');

  const pageTitle =
    activeTab === 'vendors'
      ? 'Vendor Management'
      : activeTab === 'products'
        ? 'Products Hub'
        : activeTab === 'settings'
          ? 'System Settings'
          : 'Admin Overview';

  const pageDescription =
    activeTab === 'vendors'
      ? 'Review vendor accounts, approve new vendors, and remove vendors when needed.'
      : activeTab === 'products'
        ? selectedVendor
          ? `Review and remove products published by ${selectedVendor.name}. Editing is disabled for admin.`
          : 'Review vendor products and remove listings when needed. Editing is disabled for admin.'
        : activeTab === 'settings'
          ? 'System configuration now runs entirely from your backend and Laragon database.'
          : 'Monitor system activity, vendor accounts, and published products from MySQL.';

  function adjustStat(title, change) {
    setStats((current) =>
      current.map((stat) =>
        stat.title === title
          ? {
              ...stat,
              value: Math.max(0, formatStatValue(stat.value) + change).toLocaleString(),
            }
          : stat
      )
    );
  }

  function showVendorProducts(vendor) {
    setSelectedVendorId(vendor.id);
    setActiveTab('products');
    setError('');
    setNotice('');
  }

  function clearVendorFilter() {
    setSelectedVendorId(0);
    setError('');
    setNotice('');
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    setNotice('');
    setError('');

    try {
      if (authMode === 'forgot') {
        if (!resetDetails) {
          const payload = await readApiResponse(
            await fetch(apiUrl('/api/admin/auth/forgot-password'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: authForm.email,
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
          await fetch(apiUrl('/api/admin/auth/reset-password'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: authForm.email,
              resetCode: authForm.resetCode,
              password: authForm.password,
            }),
          })
        );

        setResetDetails(null);
        setAuthMode('login');
        setAuthForm({
          ...EMPTY_AUTH_FORM,
          email: authForm.email,
        });
        setNotice(payload.message);
        return;
      }

      if (authMode === 'bootstrap' && authForm.password !== authForm.confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const endpoint =
        authMode === 'bootstrap' ? '/api/admin/auth/bootstrap' : '/api/admin/auth/login';
      const payload = await readApiResponse(
        await fetch(apiUrl(endpoint), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: authForm.email,
            password: authForm.password,
          }),
        })
      );

      setStoredAdminToken(payload.token);
      setAdminToken(payload.token);
      setAdminAccount(payload.account || null);
      setAuthForm(EMPTY_AUTH_FORM);
      setNotice(
        authMode === 'bootstrap'
          ? 'First admin account created successfully.'
          : 'Signed in as admin.'
      );
      await loadAdminData(payload.token);
    } catch (nextError) {
      setAuthError(formatAdminErrorMessage(nextError.message || 'Unable to continue.'));

      if (/already exists/i.test(nextError.message || '')) {
        await loadAuthStatus();
      }
    } finally {
      setAuthBusy(false);
      setAuthReady(true);
    }
  }

  async function handleLogout() {
    await showAuthScreen('Signed out successfully.');
  }

  async function deleteProduct(product) {
    const shouldDelete = window.confirm(
      `Delete "${product.name}" from ${product.vendorName}? This cannot be undone.`
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingProductId(product.id);
    setError('');
    setNotice('');

    try {
      const payload = await readApiResponse(
        await authedFetch(`/api/admin/products/${product.id}`, {
          method: 'DELETE',
        })
      );

      setProducts((current) => current.filter((currentProduct) => currentProduct.id !== product.id));
      setVendors((current) =>
        current.map((vendor) =>
          vendor.id === payload.vendorId
            ? {
                ...vendor,
                products: Math.max(0, Number(vendor.products || 0) - 1),
              }
            : vendor
        )
      );
      adjustStat('Active Products', -1);
      setNotice(payload.message);
    } catch (nextError) {
      if (isAdminAuthError(nextError.message)) {
        await showAuthScreen('Your admin session expired. Please sign in again.');
      } else {
        setError(nextError.message);
      }
    } finally {
      setDeletingProductId(0);
    }
  }

  async function deleteVendor(vendor) {
    const productCount = Number(vendor.products || 0);
    const productLabel = productCount === 1 ? 'product' : 'products';
    const shouldDelete = window.confirm(
      `Delete vendor "${vendor.name}" (${vendor.owner}) and ${productCount} ${productLabel}? This cannot be undone.`
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingVendorId(vendor.id);
    setError('');
    setNotice('');

    try {
      const payload = await readApiResponse(
        await authedFetch(`/api/admin/vendors/${vendor.id}`, {
          method: 'DELETE',
        })
      );

      setVendors((current) =>
        current.filter((currentVendor) => currentVendor.id !== payload.vendorId)
      );
      setProducts((current) =>
        current.filter((product) => Number(product.vendorId) !== Number(payload.vendorId))
      );

      if (selectedVendorId === payload.vendorId) {
        setSelectedVendorId(0);
      }

      adjustStat('Total Vendors', -1);
      adjustStat('Active Products', -Number(payload.deletedProductCount || 0));

      if (payload.vendorStatus === 'Pending Approval') {
        adjustStat('Pending Approval', -1);
      }

      setNotice(payload.message);
    } catch (nextError) {
      if (isAdminAuthError(nextError.message)) {
        await showAuthScreen('Your admin session expired. Please sign in again.');
      } else {
        setError(nextError.message);
      }
    } finally {
      setDeletingVendorId(0);
    }
  }

  async function approveVendor(vendor) {
    if (!vendor?.id) {
      return;
    }

    setApprovingVendorId(vendor.id);
    setError('');
    setNotice('');

    try {
      const payload = await readApiResponse(
        await authedFetch(`/api/admin/vendors/${vendor.id}/approve`, {
          method: 'POST',
        })
      );

      setVendors((current) =>
        current.map((currentVendor) =>
          currentVendor.id === vendor.id
            ? {
                ...currentVendor,
                status: payload.vendor?.status || 'Approved',
                statusKey: payload.vendor?.statusKey || 'approved',
                approval: payload.vendor?.approval || currentVendor.approval,
              }
            : currentVendor
        )
      );

      if (vendor.statusKey === 'pending') {
        adjustStat('Pending Approval', -1);
      }

      setNotice(payload.message);
    } catch (nextError) {
      if (isAdminAuthError(nextError.message)) {
        await showAuthScreen('Your admin session expired. Please sign in again.');
      } else {
        setError(nextError.message);
      }
    } finally {
      setApprovingVendorId(0);
    }
  }

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0f172a',
          color: '#e2e8f0',
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '8px' }}>
            Checking admin access
          </strong>
          <span style={{ color: '#94a3b8' }}>
            Preparing the database-backed admin session.
          </span>
        </div>
      </div>
    );
  }

  if (!adminToken) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background:
            'radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 30%), #0f172a',
          padding: '24px',
          color: '#e2e8f0',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
          }}
        >
          <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(59, 130, 246, 0.18)',
                color: '#93c5fd',
              }}
            >
              <BarChart size={24} />
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '1.8rem', color: '#f8fafc' }}>
                {authMode === 'bootstrap'
                  ? 'Create the first admin'
                  : authMode === 'forgot'
                    ? 'Reset admin password'
                    : 'Admin login'}
              </strong>
              <p style={{ marginTop: '8px', color: '#94a3b8', lineHeight: 1.6 }}>
                {authMode === 'bootstrap'
                  ? 'This account will be stored in MySQL and will control future admin access.'
                  : authMode === 'forgot'
                    ? 'Request a reset code with the admin email, then choose a new password.'
                    : 'Only admins saved in the database can open the admin dashboard.'}
              </p>
            </div>
          </div>

          {authError && (
            <div
              style={{
                marginBottom: '18px',
                padding: '14px 16px',
                borderRadius: '14px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.28)',
              }}
            >
              {authError}
            </div>
          )}

          {notice && (
            <div
              style={{
                marginBottom: '18px',
                padding: '14px 16px',
                borderRadius: '14px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: '#bfdbfe',
                border: '1px solid rgba(96, 165, 250, 0.28)',
              }}
            >
              {notice}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: '16px' }}>
            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Admin email</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => {
                  const nextEmail = event.target.value;
                  if (authMode === 'forgot' && resetDetails) {
                    setResetDetails(null);
                  }
                  setAuthForm((current) => ({ ...current, email: nextEmail }));
                }}
                placeholder="admin@example.com"
                style={authInputStyle}
              />
            </label>

            {(authMode !== 'forgot' || resetDetails) && (
              renderPasswordField(
                'password',
                authMode === 'forgot' ? 'New password' : 'Password',
                'At least 6 characters'
              )
            )}

            {authMode === 'forgot' && resetDetails && (
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Reset code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={authForm.resetCode}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, resetCode: event.target.value }))
                  }
                  placeholder="6-digit code"
                  style={authInputStyle}
                />
              </label>
            )}

            {(authMode === 'bootstrap' || (authMode === 'forgot' && resetDetails)) && (
              renderPasswordField('confirmPassword', 'Confirm password', 'Repeat the password')
            )}

            {authMode === 'forgot' && resetDetails && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(37, 99, 235, 0.12)',
                  color: '#dbeafe',
                  border: '1px solid rgba(96, 165, 250, 0.28)',
                  lineHeight: 1.5,
                }}
              >
                {resetDetails.resetCode ? (
                  <>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>
                      Reset code: {resetDetails.resetCode}
                    </strong>
                    <span style={{ color: '#bfdbfe' }}>
                      Email delivery is not configured yet, so the code is shown here for now. It
                      expires at {new Date(resetDetails.expiresAt).toLocaleString()}.
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#bfdbfe' }}>
                    A reset code was sent to your email. Enter that code below before{' '}
                    {new Date(resetDetails.expiresAt).toLocaleString()}.
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={authBusy}
              style={{
                marginTop: '6px',
                border: 'none',
                borderRadius: '14px',
                background: '#2563eb',
                color: '#ffffff',
                padding: '14px 16px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: authBusy ? 'wait' : 'pointer',
                opacity: authBusy ? 0.75 : 1,
              }}
            >
              {authBusy
                ? authMode === 'bootstrap'
                  ? 'Creating admin...'
                  : authMode === 'forgot'
                    ? resetDetails
                      ? 'Resetting password...'
                      : 'Generating code...'
                    : 'Signing in...'
                : authMode === 'bootstrap'
                  ? 'Create Admin'
                  : authMode === 'forgot'
                    ? resetDetails
                      ? 'Reset Password'
                      : 'Get Reset Code'
                    : 'Sign In'}
            </button>

            {authMode === 'login' && (
              <button
                type="button"
                onClick={() => switchAuthMode('forgot')}
                style={{
                  justifySelf: 'start',
                  background: 'none',
                  border: 'none',
                  color: '#93c5fd',
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
                  justifySelf: 'start',
                  background: 'none',
                  border: 'none',
                  color: '#93c5fd',
                  padding: 0,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Back to sign in
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-box">S</div>
          <h2>Sister Store</h2>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-label">MAIN</p>
          <a
            href="#"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={(event) => {
              event.preventDefault();
              setActiveTab('dashboard');
            }}
          >
            <BarChart size={20} />
            <span>Dashboard</span>
          </a>
          <a
            href="#"
            className={`nav-item ${activeTab === 'vendors' ? 'active' : ''}`}
            onClick={(event) => {
              event.preventDefault();
              setActiveTab('vendors');
            }}
          >
            <Users size={20} />
            <span>Vendors</span>
          </a>
          <a
            href="#"
            className={`nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={(event) => {
              event.preventDefault();
              setSelectedVendorId(0);
              setActiveTab('products');
            }}
          >
            <Package size={20} />
            <span>Products Hub</span>
          </a>

          <p className="nav-label" style={{ marginTop: '24px' }}>
            SYSTEM
          </p>
          <a
            href="#"
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={(event) => {
              event.preventDefault();
              setActiveTab('settings');
            }}
          >
            <Settings size={20} />
            <span>Settings</span>
          </a>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input type="text" placeholder="Search vendors or products..." readOnly />
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" type="button">
              <Bell size={20} />
              <span className="badge"></span>
            </button>
            <button className="btn-secondary" type="button" onClick={handleLogout}>
              Sign Out
            </button>
            <div className="avatar" title={adminAccount?.email || 'Admin'}>
              {adminInitials}
            </div>
          </div>
        </header>

        <div className="content-area">
          <div className="page-header">
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>

          {error && (
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                borderRadius: '14px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                borderRadius: '14px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#a7f3d0',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              {notice}
            </div>
          )}

          <div className="stats-grid">
            {(stats.length
              ? stats
              : [
                  { title: 'Total Vendors', value: loading ? '...' : '0', color: '#3b82f6' },
                  { title: 'Active Products', value: loading ? '...' : '0', color: '#10b981' },
                  { title: 'Pending Approval', value: loading ? '...' : '0', color: '#f59e0b' },
                  { title: 'Suspended Accounts', value: loading ? '...' : '0', color: '#ef4444' },
                ]
            ).map((stat) => {
              const Icon = STAT_ICONS[stat.title] || BarChart;

              return (
                <div className="stat-card" key={stat.title}>
                  <div
                    className="stat-icon"
                    style={{ backgroundColor: `${stat.color}20`, color: stat.color }}
                  >
                    <Icon size={24} />
                  </div>
                  <div className="stat-info">
                    <h3>{stat.title}</h3>
                    <p className="stat-value">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="table-container">
            <div className="table-header">
              <div className="table-title">
                <h2>
                  {activeTab === 'products'
                    ? selectedVendor
                      ? `${selectedVendor.name} Products`
                      : 'Products Inventory'
                    : 'Vendor Management'}
                </h2>
                {activeTab === 'products' ? (
                  <p className="table-subtitle">
                    {selectedVendor
                      ? `Showing products for ${selectedVendor.owner}${selectedVendor.shopId ? ` /${selectedVendor.shopId}` : ''}`
                      : 'Admin can review and delete products only.'}
                  </p>
                ) : (
                  <p className="table-subtitle">Admin can review and delete vendors only.</p>
                )}
              </div>
              <div className="table-actions">
                {activeTab === 'products' && selectedVendor && (
                  <button className="btn-secondary" type="button" onClick={clearVendorFilter}>
                    View All Products
                  </button>
                )}
                <button className="btn-primary" type="button" onClick={() => loadAdminData()}>
                  Refresh Data
                </button>
              </div>
            </div>
            <table className="admin-table">
              <thead>
                {activeTab === 'products' ? (
                  <tr>
                    <th>Product</th>
                    <th>Vendor</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Sold</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Vendor Store</th>
                    <th>Owner</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Total Products</th>
                    <th>Joined Date</th>
                    <th>Actions</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={activeTab === 'products' ? '7' : '7'}
                      style={{ padding: '24px', color: '#94a3b8' }}
                    >
                      Loading admin data from the backend...
                    </td>
                  </tr>
                )}

                {!loading && activeTab === 'products' && visibleProducts.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '24px', color: '#94a3b8' }}>
                      {selectedVendor
                        ? `${selectedVendor.name} has no published products yet.`
                        : 'No products have been published yet.'}
                    </td>
                  </tr>
                )}

                {!loading && activeTab !== 'products' && vendors.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '24px', color: '#94a3b8' }}>
                      No vendor accounts have been created in MySQL yet.
                    </td>
                  </tr>
                )}

                {!loading &&
                  activeTab === 'products' &&
                  visibleProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="font-medium">
                        <div>{product.name}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>
                          Product #{product.id}
                        </div>
                      </td>
                      <td>
                        <div>{product.vendorName}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>
                          {product.vendorHandle ? `/${product.vendorHandle}` : product.vendorOwner}
                        </div>
                      </td>
                      <td>{product.price}</td>
                      <td>{product.stock}</td>
                      <td>{product.sold}</td>
                      <td>{formatDateTime(product.updatedAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-danger"
                            type="button"
                            onClick={() => deleteProduct(product)}
                            disabled={
                              deletingProductId === product.id ||
                              deletingVendorId === Number(product.vendorId)
                            }
                          >
                            <Trash2 size={16} />
                            {deletingProductId === product.id ? 'Deleting...' : 'Delete Product'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  activeTab !== 'products' &&
                  vendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="font-medium">
                        <div>{vendor.name}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>
                          {vendor.shopId || 'No public handle yet'}
                        </div>
                      </td>
                      <td>{vendor.owner}</td>
                      <td>
                        <div>{vendor.subscription?.priceLabel || '-'}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>
                          {vendor.subscription?.endsAt
                            ? `Until ${formatDateTime(vendor.subscription.endsAt)}`
                            : vendor.subscription?.label || '-'}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-badge status-${
                            vendor.statusKey === 'approved' ? 'active' : vendor.statusKey || 'pending'
                          }`}
                        >
                          {vendor.status}
                        </span>
                      </td>
                      <td>{vendor.products}</td>
                      <td>{vendor.joined || '-'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => showVendorProducts(vendor)}
                            disabled={deletingVendorId === vendor.id || approvingVendorId === vendor.id}
                          >
                            <Eye size={16} />
                            View Products
                          </button>
                          {vendor.statusKey === 'pending' && (
                            <button
                              className="btn-primary"
                              type="button"
                              onClick={() => approveVendor(vendor)}
                              disabled={deletingVendorId === vendor.id || approvingVendorId === vendor.id}
                            >
                              {approvingVendorId === vendor.id ? 'Approving...' : 'Approve Vendor'}
                            </button>
                          )}
                          <button
                            className="btn-danger"
                            type="button"
                            onClick={() => deleteVendor(vendor)}
                            disabled={deletingVendorId === vendor.id || approvingVendorId === vendor.id}
                          >
                            <Trash2 size={16} />
                            {deletingVendorId === vendor.id ? 'Deleting...' : 'Delete Vendor'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
