import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Expand,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  X,
} from 'lucide-react';
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom';
import './Customer.css';

async function readApiResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load the shop right now.');
  }

  return payload;
}

function makeMonogram(value) {
  const source = String(value || '')
    .trim()
    .replace(/^@+/, '');

  if (!source) {
    return 'SS';
  }

  if (source.length <= 3) {
    return source.toUpperCase();
  }

  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || source.slice(0, 2).toUpperCase()
  );
}

function formatTelegramHandle(value) {
  const handle = String(value || '').trim().replace(/^@+/, '');
  return handle ? `@${handle}` : '';
}

function formatLaunchDate(value) {
  if (!value) {
    return 'Recently launched';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return 'Recently launched';
  }
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

  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: pattern.decimals,
    maximumFractionDigits: pattern.decimals,
  });

  return `${pattern.prefix}${formattedAmount}${pattern.suffix}`.trim();
}

function buildSelectionTotalText(items) {
  const pricedItems = items.filter(
    (item) => item.pricePattern && Number.isFinite(item.lineAmount)
  );

  if (!pricedItems.length || pricedItems.length !== items.length) {
    return '';
  }

  const basePattern = pricedItems[0].pricePattern;
  const samePattern = pricedItems.every(
    (item) =>
      item.pricePattern.prefix === basePattern.prefix &&
      item.pricePattern.suffix === basePattern.suffix &&
      item.pricePattern.decimals === basePattern.decimals
  );

  if (!samePattern) {
    return '';
  }

  const totalAmount = pricedItems.reduce((sum, item) => sum + item.lineAmount, 0);
  return formatPriceFromPattern(basePattern, totalAmount);
}

function toAbsoluteUrl(value) {
  if (!value) {
    return '';
  }

  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return String(value || '');
  }
}

function getProductStock(product) {
  return Math.max(0, Number(product?.stock || 0));
}

function formatStockLabel(stock) {
  return stock <= 0 ? 'Out of stock' : `${stock} left`;
}

function StorefrontState({ title, message, actionLabel, actionHref }) {
  return (
    <div className="state-shell">
      <div className="state-card">
        <div className="state-badge">
          <Sparkles size={15} />
          <span>Sister Store</span>
        </div>
        <h1>{title}</h1>
        <p>{message}</p>
        {actionHref && actionLabel && (
          <Link className="btn btn-primary" to={actionHref}>
            <span>{actionLabel}</span>
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}

function LandingPage() {
  const featureCards = [
    {
      title: 'Real vendor storefronts',
      text: 'Each shop gets its own public page with branding, product listings, and direct contact.',
      icon: Store,
    },
    {
      title: 'Simple ordering flow',
      text: 'Customers browse the catalog, pick a product, and message the vendor directly on Telegram.',
      icon: Send,
    },
    {
      title: 'Built for small sellers',
      text: 'A clean storefront helps independent vendors look polished without needing a full ecommerce stack.',
      icon: ShieldCheck,
    },
  ];
  const journey = [
    'Open a public shop link shared by a vendor.',
    'Browse products, prices, and details in one place.',
    'Message the seller directly when you are ready to buy.',
  ];
  const shopperQuotes = [
    {
      label: 'Easy to browse',
      quote:
        'A strong storefront helps customers understand the product, the price, and the next step in just a few seconds.',
    },
    {
      label: 'Easy to trust',
      quote:
        'A shop feels more real when the products are organized, the images are clean, and the contact method is obvious.',
    },
    {
      label: 'Easy to order',
      quote:
        'The best buying flow is when customers can move from product discovery to seller conversation without confusion.',
    },
  ];

  return (
    <div className="landing-shell">
      <header className="site-nav">
        <Link className="nav-brand" to="/">
          <span className="brand-mark">S</span>
          <span className="brand-copy">
            <strong>Sister Store</strong>
            <small>Customer shop</small>
          </span>
        </Link>
        <a className="nav-link" href="#testimonials">
          How it works
        </a>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="eyebrow">
              <Sparkles size={15} />
              <span>Direct-to-customer storefront</span>
            </div>
            <h1>Discover storefronts that feel like real online shops.</h1>
            <p>
              Sister Store gives independent vendors a polished public page with real product
              highlights, cleaner trust signals, and direct customer contact through Telegram.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#how-it-works">
                <span>See how it works</span>
                <ArrowRight size={16} />
              </a>
              <a className="btn btn-secondary" href="#testimonials">
                Why it feels real
              </a>
            </div>
          </div>

          <div className="landing-preview">
            <div className="preview-window">
              <div className="preview-topbar">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="preview-panel">
                <div className="preview-identity">
                  <div className="preview-logo">JS</div>
                  <div>
                    <strong>James Studio</strong>
                    <p>Curated fashion picks and everyday accessories.</p>
                  </div>
                </div>
                <div className="preview-metrics">
                  <div>
                    <span>Products</span>
                    <strong>Clean</strong>
                  </div>
                  <div>
                    <span>Response</span>
                    <strong>Telegram</strong>
                  </div>
                  <div>
                    <span>Experience</span>
                    <strong>Simple</strong>
                  </div>
                </div>
                <div className="preview-cards">
                  <article>
                    <strong>Product-focused pages</strong>
                    <span>Clear</span>
                  </article>
                  <article>
                    <strong>Direct chat ordering</strong>
                    <span>Fast</span>
                  </article>
                  <article>
                    <strong>Trust signals up front</strong>
                    <span>Simple</span>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-grid">
          {featureCards.map((card) => {
            const Icon = card.icon;

            return (
              <article className="feature-card" key={card.title}>
                <div className="feature-icon">
                  <Icon size={20} />
                </div>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
              </article>
            );
          })}
        </section>

        <section className="testimonial-section" id="testimonials">
          <div className="section-head">
            <div>
              <span className="section-kicker">Shopper Perspective</span>
              <h2>The kind of experience customers actually want.</h2>
              <p>
                These quote-style highlights explain why a clean storefront feels more trustworthy
                and easier to use.
              </p>
            </div>
          </div>
          <div className="testimonial-grid">
            {shopperQuotes.map((item) => (
              <article className="testimonial-card" key={item.label}>
                <span className="testimonial-card__label">{item.label}</span>
                <p>"{item.quote}"</p>
              </article>
            ))}
          </div>
        </section>

        <section className="journey-section" id="how-it-works">
          <div className="section-head">
            <div>
              <span className="section-kicker">How It Works</span>
              <h2>A simple path from discovery to conversation.</h2>
            </div>
          </div>
          <div className="journey-grid">
            {journey.map((step, index) => (
              <article className="journey-card" key={step}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta-banner">
          <div className="landing-cta-banner__copy">
            <span className="section-kicker">Ready To Explore</span>
            <h2>Start with a clean shopping experience from the first click.</h2>
            <p>
              Browse the experience, understand the flow, and open a storefront when you are ready
              to explore products.
            </p>
          </div>
          <div className="landing-cta-banner__actions">
            <a className="btn btn-primary" href="#testimonials">
              <span>See the benefits</span>
              <ArrowRight size={16} />
            </a>
            <a className="btn btn-secondary" href="#how-it-works">
              How shopping works
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function ShopInterface() {
  const { vendorId } = useParams();
  const [loading, setLoading] = useState(true);
  const [shopData, setShopData] = useState(null);
  const [error, setError] = useState('');
  const [activePreviewProduct, setActivePreviewProduct] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseNotice, setPurchaseNotice] = useState('');
  const [purchaseNoticeType, setPurchaseNoticeType] = useState('');
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadShop() {
      setLoading(true);

      try {
        const payload = await readApiResponse(
          await fetch(`/api/shop/${vendorId}`, {
            signal: controller.signal,
          })
        );

        setShopData(payload.shop);
        setError('');
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          return;
        }

        setShopData(null);
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    }

    loadShop();

    return () => controller.abort();
  }, [vendorId]);

  useEffect(() => {
    setIsMobileProfileOpen(false);
  }, [vendorId]);

  const products = useMemo(() => shopData?.products || [], [shopData?.products]);
  const telegramHandle = String(shopData?.telegram || '').trim().replace(/^@+/, '');
  const telegramLabel = formatTelegramHandle(shopData?.telegram);
  const locationLabel = String(shopData?.location || '').trim();
  const shopMonogram = makeMonogram(shopData?.logo || shopData?.name);
  const totalSold = useMemo(
    () => products.reduce((sum, product) => sum + Number(product.sold || 0), 0),
    [products]
  );
  const featuredProducts = useMemo(
    () =>
      [...products]
        .sort((left, right) => Number(right.sold || 0) - Number(left.sold || 0))
        .slice(0, 3),
    [products]
  );
  const selectedItems = useMemo(
    () =>
      products
        .filter((product) => Number(selectedProducts[product.id] || 0) > 0)
        .map((product) => {
          const quantity = Number(selectedProducts[product.id] || 0);
          const pricePattern = parsePriceDetails(product.price);
          const lineAmount = pricePattern ? pricePattern.amount * quantity : null;

          return {
            ...product,
            quantity,
            pricePattern,
            lineAmount,
            lineTotalText: pricePattern ? formatPriceFromPattern(pricePattern, lineAmount) : '',
          };
        }),
    [products, selectedProducts]
  );
  const selectedItemCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems]
  );
  const selectedTotalText = useMemo(
    () => buildSelectionTotalText(selectedItems),
    [selectedItems]
  );
  const selectedPurchaseLabel =
    selectedItemCount > 0
      ? `Buy selected items${selectedTotalText ? ` (${selectedTotalText})` : ''}`
      : 'Chat on Telegram';
  const storeHighlights = useMemo(
    () => {
      const cards = [
        {
          title: 'Direct seller chat',
          value: telegramLabel || 'Telegram ready',
          detail: 'Ask questions and confirm details before ordering.',
          icon: MessageCircle,
        },
        {
          title: 'Active catalog',
          value: `${products.length} product${products.length === 1 ? '' : 's'}`,
          detail:
            products.length > 0
              ? 'Everything is listed in one clean storefront.'
              : 'The storefront is ready for upcoming products.',
          icon: Package,
        },
      ];

      if (locationLabel) {
        cards.push({
          title: 'Store location',
          value: locationLabel,
          detail: 'Helpful for pickup, delivery, and local shopping confidence.',
          icon: MapPin,
        });
      } else {
        cards.push({
          title: 'Customer interest',
          value: totalSold > 0 ? `${totalSold} sold` : 'Fresh collection',
          detail:
            totalSold > 0
              ? 'Popular picks are highlighted first for easy browsing.'
              : 'Early visitors can explore the newest items first.',
          icon: Star,
        });
      }

      return cards;
    },
    [locationLabel, products.length, telegramLabel, totalSold]
  );
  const shopBenefits = useMemo(
    () => [
      {
        title: 'Clear product information',
        text: 'Customers can see the image, price, and description without extra steps.',
        icon: CheckCircle2,
      },
      {
        title: 'Direct contact with the vendor',
        text: 'Ordering is simple because customers message the seller directly on Telegram.',
        icon: MessageCircle,
      },
      {
        title: 'Popular items shown first',
        text: 'Best-performing products are surfaced early so visitors notice the strongest offers.',
        icon: Sparkles,
      },
    ],
    []
  );

  useEffect(() => {
    if (!activePreviewProduct) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActivePreviewProduct(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePreviewProduct]);

  useEffect(() => {
    setSelectedProducts({});
    setPurchaseNotice('');
    setPurchaseNoticeType('');
  }, [vendorId]);

  useEffect(() => {
    setSelectedProducts((current) => {
      const stockMap = new Map(
        products.map((product) => [String(product.id), getProductStock(product)])
      );
      let changed = false;
      const next = {};

      Object.entries(current).forEach(([productId, quantity]) => {
        const stock = stockMap.get(String(productId));
        const normalizedQuantity = Math.min(Number(quantity), stock || 0);

        if (stock && normalizedQuantity > 0) {
          next[productId] = normalizedQuantity;
          if (normalizedQuantity !== Number(quantity)) {
            changed = true;
          }
        } else {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [products]);

  function openTelegram(options = {}) {
    if (!telegramHandle) {
      return;
    }

    const purchaseConfirmed =
      typeof options === 'object' && options ? Boolean(options.purchaseConfirmed) : false;
    const directProduct =
      typeof options === 'object' && options && !Array.isArray(options) ? options.product || null : null;
    const requestedItems =
      typeof options === 'object' && Array.isArray(options.selectedItems)
        ? options.selectedItems
        : directProduct
          ? [
              {
                ...directProduct,
                quantity: Number(selectedProducts[directProduct.id] || 0) || 1,
              },
            ]
        : selectedItems;
    const normalizedItems = requestedItems.map((item) => {
      const quantity = Number(item.quantity || selectedProducts[item.id] || 1);
      const pricePattern = item.pricePattern || parsePriceDetails(item.price);
      const lineAmount = pricePattern ? pricePattern.amount * quantity : null;

      return {
        ...item,
        quantity,
        pricePattern,
        lineAmount,
        lineTotalText: item.lineTotalText || (pricePattern ? formatPriceFromPattern(pricePattern, lineAmount) : ''),
        imageLink: toAbsoluteUrl(item.imageUrl),
      };
    });
    const productName =
      typeof options === 'string'
        ? options
        : options.productName || directProduct?.name || '';
    const selectionTotalText = buildSelectionTotalText(normalizedItems);
    const inquiry =
      !productName && normalizedItems.length > 0
        ? `Hello ${shopData.name}, ${
            purchaseConfirmed
              ? 'I just placed this order from your Webstore:'
              : 'I would like to ask about these products:'
          }\n${normalizedItems
            .map((item, index) => {
              const lines = [`${index + 1}. ${item.name}`, `Qty: ${item.quantity}`];

              if (item.price) {
                lines.push(`Unit price: ${item.price}`);
              }

              if (item.lineTotalText) {
                lines.push(`Line total: ${item.lineTotalText}`);
              }

              if (item.imageLink) {
                lines.push(`Image link: ${item.imageLink}`);
              }

              return lines.join('\n');
            })
            .join('\n\n')}\n${
            selectionTotalText ? `\nEstimated total: ${selectionTotalText}\n` : '\n'
          }${
            purchaseConfirmed
              ? 'Please confirm the order details.'
              : 'Can you confirm availability?'
          }`
        : productName
          ? `Hi ${shopData.name}, I found your shop and I am interested in "${productName}".${
              normalizedItems[0]?.price ? `\nUnit price: ${normalizedItems[0].price}` : ''
            }${
              normalizedItems[0]?.lineTotalText ? `\nCurrent total: ${normalizedItems[0].lineTotalText}` : ''
            }${
              normalizedItems[0]?.imageLink ? `\nImage link: ${normalizedItems[0].imageLink}` : ''
            }\nCan you share more details?`
          : `Hi ${shopData.name}, I found your shop and would like to ask about your products.`;
    const text = encodeURIComponent(inquiry);
    window.open(`https://t.me/${telegramHandle}?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function scrollToCatalog() {
    document.getElementById('catalog')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function scrollToInquiry() {
    document.getElementById('inquiry-section')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function openProductPreview(product) {
    if (!product?.imageUrl) {
      return;
    }

    setActivePreviewProduct(product);
  }

  function closeProductPreview() {
    setActivePreviewProduct(null);
  }

  function openOriginalImage(imageUrl) {
    if (!imageUrl) {
      return;
    }

    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  }

  function setProductQuantity(productId, quantity) {
    setSelectedProducts((current) => {
      const next = { ...current };
      const product = products.find((item) => item.id === productId);
      const stock = getProductStock(product);
      const normalizedQuantity = Math.min(quantity, stock);

      if (normalizedQuantity <= 0) {
        delete next[productId];
      } else {
        next[productId] = normalizedQuantity;
      }

      return next;
    });
  }

  function toggleProductSelection(product) {
    setSelectedProducts((current) => {
      const next = { ...current };
      const stock = getProductStock(product);

      if (stock <= 0) {
        return current;
      }

      if (next[product.id]) {
        delete next[product.id];
      } else {
        next[product.id] = 1;
      }

      return next;
    });
  }

  function clearSelectedProducts() {
    setSelectedProducts({});
  }

  async function buySelectedItems(items = selectedItems) {
    if (!items.length) {
      setPurchaseNotice('Choose at least one product before buying.');
      setPurchaseNoticeType('error');
      return;
    }

    setPurchaseBusy(true);
    setPurchaseNotice('');
    setPurchaseNoticeType('');

    try {
      const purchasedSnapshot = items.map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
      }));
      const payload = await readApiResponse(
        await fetch(`/api/shop/${vendorId}/purchase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: purchasedSnapshot.map((item) => ({
              productId: item.id,
              quantity: item.quantity,
            })),
          }),
        })
      );

      setShopData(payload.shop);
      setSelectedProducts({});
      setPurchaseNotice('Purchase recorded. Telegram is opening so you can confirm with the vendor.');
      setPurchaseNoticeType('success');
      openTelegram({ selectedItems: purchasedSnapshot, purchaseConfirmed: true });
    } catch (purchaseError) {
      setPurchaseNotice(purchaseError.message);
      setPurchaseNoticeType('error');
      scrollToInquiry();
    } finally {
      setPurchaseBusy(false);
    }
  }

  if (loading) {
    return (
      <StorefrontState
        title="Loading storefront"
        message="We are preparing the vendor catalog and product details for you."
      />
    );
  }

  if (!shopData) {
    return (
      <StorefrontState
        title={error.toLowerCase().includes('not found') ? 'Shop not found' : 'Unable to load shop'}
        message={error || 'This vendor link is invalid or the storefront is no longer available.'}
        actionLabel="Back to home"
        actionHref="/"
      />
    );
  }

  return (
    <div
      className={`storefront-shell ${selectedItemCount > 0 ? 'has-floating-inquiry' : ''} ${
        isMobileProfileOpen ? 'is-mobile-profile-open' : ''
      }`}
    >
      <header className="site-nav site-nav--store">
        <Link className="nav-brand nav-brand--store-desktop" to="/">
          <span className="brand-mark">S</span>
          <span className="brand-copy">
            <strong>{shopData.name}</strong>
            <small>Browse and order</small>
          </span>
        </Link>
        <button
          className={`mobile-profile-toggle ${isMobileProfileOpen ? 'is-open' : ''}`}
          type="button"
          onClick={() => setIsMobileProfileOpen((current) => !current)}
          aria-expanded={isMobileProfileOpen}
          aria-controls="mobile-store-profile"
        >
          <span className="mobile-profile-toggle__avatar">
            {shopData.logoImageUrl ? (
              <img src={shopData.logoImageUrl} alt={`${shopData.name} logo`} />
            ) : (
              shopMonogram
            )}
          </span>
          <span className="brand-copy">
            <strong>{shopData.name}</strong>
            <small>Browse and order</small>
          </span>
          <ChevronDown size={18} />
        </button>
        <div className="store-nav-actions">
          <a className="nav-link" href={`#catalog`}>
            Products
          </a>
          <button
            className="btn btn-primary btn-compact"
            type="button"
            onClick={() => (selectedItemCount > 0 ? buySelectedItems() : openTelegram())}
            disabled={selectedItemCount > 0 ? !telegramHandle || purchaseBusy : !telegramHandle}
          >
            <span>{selectedPurchaseLabel}</span>
            <Send size={16} />
          </button>
        </div>
      </header>

      <main className="storefront-main">
        <section className="storefront-hero">
          <div className="hero-copy hero-copy--shop">
            <div className="eyebrow eyebrow--soft">
              <ShieldCheck size={15} />
              <span>Verified independent storefront</span>
            </div>

            <div className="hero-chip-row">
              <span className="chip">
                <CheckCircle2 size={15} />
                <span>Curated catalog</span>
              </span>
              <span className="chip">
                <Clock3 size={15} />
                <span>Direct vendor contact</span>
              </span>
            </div>

            <h1>{shopData.name}</h1>
            <p>
              {shopData.description ||
                'Explore the latest products from this vendor and contact them directly when you are ready to order.'}
            </p>

            <div className="hero-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => (selectedItemCount > 0 ? buySelectedItems() : openTelegram())}
                disabled={selectedItemCount > 0 ? !telegramHandle || purchaseBusy : !telegramHandle}
              >
                <span>{selectedItemCount > 0 ? selectedPurchaseLabel : 'Start conversation'}</span>
                <Send size={16} />
              </button>
              <button className="btn btn-secondary" type="button" onClick={scrollToCatalog}>
                <span>View products</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="hero-stats">
              <article>
                <span>Products</span>
                <strong>{products.length}</strong>
              </article>
              <article>
                <span>Total sold</span>
                <strong>{totalSold}</strong>
              </article>
              <article>
                <span>Launched</span>
                <strong>{formatLaunchDate(shopData.createdAt)}</strong>
              </article>
            </div>
          </div>

          <aside className="hero-aside hero-aside--profile" id="mobile-store-profile">
            <div className="brand-card">
              <div className="brand-card__top">
                <div className="brand-card__logo">
                  {shopData.logoImageUrl ? (
                    <img src={shopData.logoImageUrl} alt={`${shopData.name} logo`} />
                  ) : (
                    shopMonogram
                  )}
                </div>
                <div>
                  <strong>{shopData.name}</strong>
                  <p>/{shopData.handle}</p>
                </div>
              </div>

              <div className="brand-card__body">
                <div>
                  <span>Contact</span>
                  <strong>{telegramLabel || 'Telegram not added'}</strong>
                </div>
                <div>
                  <span>Location</span>
                  <strong>{locationLabel || 'Ask vendor directly'}</strong>
                </div>
                <div>
                  <span>Best for</span>
                  <strong>Fast direct orders</strong>
                </div>
              </div>

              <button
                className="btn btn-dark"
                type="button"
                onClick={() => openTelegram()}
                disabled={!telegramHandle}
              >
                <MessageCircle size={16} />
                <span>Message vendor</span>
              </button>
            </div>
          </aside>
        </section>

        <section className="store-highlight-strip">
          {storeHighlights.map((item) => {
            const Icon = item.icon;

            return (
              <article className="store-highlight-card" key={item.title}>
                <div className="store-highlight-card__icon">
                  <Icon size={18} />
                </div>
                <div>
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="inquiry-section" id="inquiry-section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Selection Before Telegram</span>
              <h2>Choose products first, then buy them in one step.</h2>
              <p>
                Select the items you want, adjust quantity, reserve the stock, and then open
                Telegram with the full list.
              </p>
            </div>
            {selectedItems.length > 0 && (
              <div className="inquiry-actions">
                <button
                  className="btn btn-telegram btn-inline"
                  type="button"
                  onClick={() => buySelectedItems()}
                  disabled={!telegramHandle || purchaseBusy}
                >
                  <span>{purchaseBusy ? 'Buying...' : selectedPurchaseLabel}</span>
                  <Send size={16} />
                </button>
                <button
                  className="btn btn-secondary btn-inline"
                  type="button"
                  onClick={clearSelectedProducts}
                >
                  <span>Clear list</span>
                </button>
              </div>
            )}
          </div>

          {purchaseNotice && (
            <div className={`purchase-banner purchase-banner--${purchaseNoticeType || 'info'}`}>
              {purchaseNotice}
            </div>
          )}

          {selectedItems.length === 0 ? (
            <div className="inquiry-empty">
              <ShoppingCart size={22} />
              <div>
                <strong>No products selected yet</strong>
                <p>Use the Select item button on any product card below.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="inquiry-list">
                {selectedItems.map((item) => (
                  <article className="inquiry-item" key={item.id}>
                    <div className="inquiry-item__copy">
                      <strong>{item.name}</strong>
                      <p>{item.price ? `${item.price} each` : 'Ask vendor for price details'}</p>
                      <span className={`inquiry-stock-badge ${item.stock > 0 ? '' : 'is-empty'}`}>
                        {formatStockLabel(item.stock)}
                      </span>
                      {item.lineTotalText && (
                        <span className="inquiry-item__line-total">
                          {item.quantity} x {item.price} = {item.lineTotalText}
                        </span>
                      )}
                    </div>
                    <div className="inquiry-item__side">
                      <div className="inquiry-item__subtotal">
                        <span>Line total</span>
                        <strong>{item.lineTotalText || item.price || 'Ask vendor'}</strong>
                      </div>
                      <div className="inquiry-item__controls">
                        <button
                          type="button"
                          className="quantity-btn"
                          onClick={() => setProductQuantity(item.id, item.quantity - 1)}
                          aria-label={`Decrease quantity for ${item.name}`}
                        >
                          <Minus size={16} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          className="quantity-btn"
                          onClick={() => setProductQuantity(item.id, item.quantity + 1)}
                          aria-label={`Increase quantity for ${item.name}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="inquiry-summary">
                <div className="inquiry-summary__metric">
                  <span>Selected quantity</span>
                  <strong>{selectedItemCount} item{selectedItemCount === 1 ? '' : 's'}</strong>
                </div>
                <div className="inquiry-summary__metric">
                  <span>Estimated total</span>
                  <strong>{selectedTotalText || 'Based on listed prices'}</strong>
                </div>
                <p>
                  Buying from this section reduces stock immediately, then the Telegram draft opens
                  with names, quantities, totals, and image links.
                </p>
              </div>
            </>
          )}
        </section>

        {featuredProducts.length > 0 && (
          <section className="featured-section">
            <div className="section-head">
              <div>
                <span className="section-kicker">Featured Picks</span>
                <h2>Popular items customers ask about first.</h2>
                <p>These products help the storefront feel active, trustworthy, and ready to shop.</p>
              </div>
            </div>

            <div className="featured-grid">
              {featuredProducts.map((product) => (
                <article className="featured-card" key={product.id}>
                  <div className="featured-card__media">
                    {product.discountBanner && (
                      <span className="product-discount-badge">{product.discountBanner}</span>
                    )}
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="product-image"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="product-fallback">
                        <Package size={28} />
                      </div>
                    )}
                  </div>
                  <div className="featured-card__body">
                    <div className="featured-card__meta-row">
                      <span>{product.sold || 0} sold</span>
                      <strong>{product.price}</strong>
                      {product.discountBanner && (
                        <span className="mini-badge mini-badge--discount">{product.discountBanner}</span>
                      )}
                      <span
                        className={`mini-badge mini-badge--stock ${
                          getProductStock(product) <= 0 ? 'is-empty' : ''
                        }`}
                      >
                        {formatStockLabel(getProductStock(product))}
                      </span>
                    </div>
                    <h3>{product.name}</h3>
                    <p>{product.desc || 'Ask the vendor directly for more details about this item.'}</p>
                    <div className="product-card-actions">
                      <button
                        className={`btn ${
                          getProductStock(product) <= 0
                            ? 'btn-secondary'
                            : selectedProducts[product.id]
                              ? 'btn-primary'
                              : 'btn-secondary'
                        } btn-inline`}
                        type="button"
                        onClick={() => toggleProductSelection(product)}
                        disabled={getProductStock(product) <= 0}
                      >
                        <ShoppingCart size={16} />
                        <span>
                          {getProductStock(product) <= 0
                            ? 'Out of stock'
                            : selectedProducts[product.id]
                            ? `Selected x${selectedProducts[product.id]}`
                            : 'Select item'}
                        </span>
                      </button>
                      {product.imageUrl && (
                        <button
                          className="btn btn-secondary btn-inline"
                          type="button"
                          onClick={() => openProductPreview(product)}
                        >
                          <Expand size={16} />
                          <span>View image</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="benefits-section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Why Shop Here</span>
              <h2>Good things customers will notice right away.</h2>
              <p>
                The storefront is designed to make the best parts of the shop easy to understand at
                a glance.
              </p>
            </div>
          </div>

          <div className="assurance-section">
            {shopBenefits.map((item) => {
              const Icon = item.icon;

              return (
                <article className="assurance-card" key={item.title}>
                  <Icon size={20} />
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="catalog-section" id="catalog">
          <div className="section-head section-head--catalog">
            <div>
              <span className="section-kicker">Catalog</span>
              <h2>Everything available from {shopData.name}.</h2>
              <p>
                Browse the full collection and message the vendor directly from any product card.
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="empty-catalog">
              <Package size={24} />
              <h3>No products published yet</h3>
              <p>The vendor storefront is live, but the catalog has not been filled in yet.</p>
            </div>
          ) : (
            <div className="catalog-grid">
              {products.map((product) => (
                <article className="catalog-card" key={product.id}>
                  <div className="catalog-card__media">
                    {product.discountBanner && (
                      <span className="product-discount-badge">{product.discountBanner}</span>
                    )}
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="product-image"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="product-fallback">
                        <ShoppingBagMark />
                      </div>
                    )}
                    <span className="catalog-badge">{product.sold || 0} sold</span>
                  </div>

                  <div className="catalog-card__body">
                    <div className="featured-card__meta-row">
                      <span>{product.sold || 0} sold</span>
                      <strong>{product.price}</strong>
                      {product.discountBanner && (
                        <span className="mini-badge mini-badge--discount">{product.discountBanner}</span>
                      )}
                      <span
                        className={`mini-badge mini-badge--stock ${
                          getProductStock(product) <= 0 ? 'is-empty' : ''
                        }`}
                      >
                        {formatStockLabel(getProductStock(product))}
                      </span>
                    </div>

                    <div className="catalog-card__heading">
                      <h3>{product.name}</h3>
                      <p>{product.desc || 'Ask the vendor directly for more details about this product.'}</p>
                    </div>

                    <div className="product-card-actions">
                      <button
                        className={`btn ${
                          getProductStock(product) <= 0
                            ? 'btn-secondary'
                            : selectedProducts[product.id]
                              ? 'btn-primary'
                              : 'btn-secondary'
                        } btn-inline`}
                        type="button"
                        onClick={() => toggleProductSelection(product)}
                        disabled={getProductStock(product) <= 0}
                      >
                        <ShoppingCart size={16} />
                        <span>
                          {getProductStock(product) <= 0
                            ? 'Out of stock'
                            : selectedProducts[product.id]
                            ? `Selected x${selectedProducts[product.id]}`
                            : 'Select item'}
                        </span>
                      </button>
                      {product.imageUrl && (
                        <button
                          className="btn btn-secondary btn-inline"
                          type="button"
                          onClick={() => openProductPreview(product)}
                        >
                          <Expand size={16} />
                          <span>View image</span>
                        </button>
                      )}
                      <button
                        className="btn btn-telegram btn-inline"
                        type="button"
                        onClick={() => openTelegram({ product })}
                        disabled={!telegramHandle}
                      >
                        <span>Ask about this product</span>
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <strong>{shopData.name}</strong>
          <span>Powered by Online Store</span>
        </div>
        <p>Direct online store for independent sellers and small online shops.</p>
      </footer>

      {selectedItemCount > 0 && (
        <div className="floating-inquiry-bar">
            <div className="floating-inquiry-bar__copy">
              <ShoppingCart size={18} />
              <div>
                <strong>
                  {selectedItemCount} selected item{selectedItemCount === 1 ? '' : 's'}
                  {selectedTotalText ? ` | ${selectedTotalText}` : ''}
                </strong>
                <p>Review your list or buy everything in one step before opening Telegram.</p>
              </div>
            </div>
          <div className="floating-inquiry-bar__actions">
            <button className="btn btn-secondary btn-inline" type="button" onClick={scrollToInquiry}>
              Review list
            </button>
              <button
                className="btn btn-telegram btn-inline"
                type="button"
                onClick={() => buySelectedItems()}
                disabled={!telegramHandle || purchaseBusy}
              >
                <span>{purchaseBusy ? 'Buying...' : selectedPurchaseLabel}</span>
                <Send size={16} />
              </button>
          </div>
        </div>
      )}

      {activePreviewProduct && (
        <div className="product-modal" onClick={closeProductPreview} role="presentation">
          <div
            className="product-modal__dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${activePreviewProduct.name} image preview`}
          >
            <button
              className="product-modal__close"
              type="button"
              onClick={closeProductPreview}
              aria-label="Close image preview"
            >
              <X size={18} />
            </button>

            <div className="product-modal__media">
              <img
                src={activePreviewProduct.imageUrl}
                alt={activePreviewProduct.name}
                className="product-modal__image"
                loading="eager"
                decoding="sync"
              />
            </div>

            <div className="product-modal__body">
              <div className="product-modal__meta">
                <div className="product-modal__meta-badges">
                  <span>{activePreviewProduct.sold || 0} sold</span>
                  <span
                    className={`product-modal__stock ${
                      getProductStock(activePreviewProduct) <= 0 ? 'is-empty' : ''
                    }`}
                  >
                    {formatStockLabel(getProductStock(activePreviewProduct))}
                  </span>
                  {activePreviewProduct.discountBanner && (
                    <span className="product-modal__discount">
                      {activePreviewProduct.discountBanner}
                    </span>
                  )}
                </div>
                <strong>{activePreviewProduct.price}</strong>
              </div>
              <h2>{activePreviewProduct.name}</h2>
              <p>
                {activePreviewProduct.desc ||
                  'Ask the vendor directly if you want more details about this product.'}
              </p>
              <button
                className={`btn ${
                  getProductStock(activePreviewProduct) <= 0
                    ? 'btn-secondary'
                    : selectedProducts[activePreviewProduct.id]
                      ? 'btn-primary'
                      : 'btn-secondary'
                }`}
                type="button"
                onClick={() => toggleProductSelection(activePreviewProduct)}
                disabled={getProductStock(activePreviewProduct) <= 0}
              >
                <ShoppingCart size={16} />
                <span>
                  {getProductStock(activePreviewProduct) <= 0
                    ? 'Out of stock'
                    : selectedProducts[activePreviewProduct.id]
                    ? `Selected x${selectedProducts[activePreviewProduct.id]}`
                    : 'Select item'}
                </span>
              </button>
              <button
                className="btn btn-telegram"
                type="button"
                onClick={() => openTelegram({ product: activePreviewProduct })}
                disabled={!telegramHandle}
              >
                <span>Ask about this product</span>
                <Send size={16} />
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => openOriginalImage(activePreviewProduct.imageUrl)}
              >
                <span>Open original image</span>
                <Expand size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingBagMark() {
  return (
    <div className="shopping-mark">
      <Package size={28} />
    </div>
  );
}

export default function CustomerApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/shop/:vendorId" element={<ShopInterface />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
