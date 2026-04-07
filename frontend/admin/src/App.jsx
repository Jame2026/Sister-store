import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Users,
  Package,
  Settings,
  Search,
  Bell,
  Eye,
  AlertTriangle,
  XCircle,
  Trash2,
} from 'lucide-react';

const STAT_ICONS = {
  'Total Vendors': Users,
  'Active Products': Package,
  'Pending Approval': AlertTriangle,
  'Suspended Accounts': XCircle,
};

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load admin data.');
  }

  return payload;
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
  return (Number(String(value || '0').replace(/,/g, '')) || 0);
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState(0);
  const [deletingProductId, setDeletingProductId] = useState(0);
  const [deletingVendorId, setDeletingVendorId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setLoading(true);

      try {
        const [overviewPayload, productsPayload] = await Promise.all([
          readApiResponse(await fetch('/api/admin/overview')),
          readApiResponse(await fetch('/api/admin/products')),
        ]);

        if (cancelled) {
          return;
        }

        setStats(overviewPayload.stats || []);
        setVendors(overviewPayload.vendors || []);
        setProducts(productsPayload.products || []);
        setError('');
        setNotice('');
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedVendor =
    selectedVendorId > 0 ? vendors.find((vendor) => vendor.id === selectedVendorId) || null : null;
  const visibleProducts = selectedVendor
    ? products.filter((product) => Number(product.vendorId) === Number(selectedVendor.id))
    : products;

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
      ? 'Review vendor accounts and remove vendors when needed. Editing is disabled for admin.'
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
        await fetch(`/api/admin/products/${product.id}`, {
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
      setError(nextError.message);
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
        await fetch(`/api/admin/vendors/${vendor.id}`, {
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

      if (payload.vendorStatus === 'Pending') {
        adjustStat('Pending Approval', -1);
      }

      setNotice(payload.message);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setDeletingVendorId(0);
    }
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
            <button className="icon-btn">
              <Bell size={20} />
              <span className="badge"></span>
            </button>
            <div className="avatar">AD</div>
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
                  <button className="btn-secondary" onClick={clearVendorFilter}>
                    View All Products
                  </button>
                )}
                <button className="btn-primary" onClick={() => window.location.reload()}>
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
                      colSpan={activeTab === 'products' ? '7' : '6'}
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
                    <td colSpan="6" style={{ padding: '24px', color: '#94a3b8' }}>
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
                        <span className={`status-badge status-${vendor.status.toLowerCase()}`}>
                          {vendor.status}
                        </span>
                      </td>
                      <td>{vendor.products}</td>
                      <td>{vendor.joined || '-'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-secondary"
                            onClick={() => showVendorProducts(vendor)}
                            disabled={deletingVendorId === vendor.id}
                          >
                            <Eye size={16} />
                            View Products
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => deleteVendor(vendor)}
                            disabled={deletingVendorId === vendor.id}
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
