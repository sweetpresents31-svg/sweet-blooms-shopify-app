import React, { useEffect, useMemo, useState } from "react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function App() {
  const [view, setView] = useState("home");
  const [flowers, setFlowers] = useState([]);
  const [flowersLoading, setFlowersLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [recipient, setRecipient] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [cardMessage, setCardMessage] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [storeInfo, setStoreInfo] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("sb_admin_key") || "");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminProducts, setAdminProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const loadFlowers = async () => {
    setFlowersLoading(true);
    try {
      const response = await fetch("/api/flowers");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || "Could not load products.");
      setFlowers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setFlowers([]);
    } finally {
      setFlowersLoading(false);
    }
  };

  const loadStore = async () => {
    try {
      const response = await fetch("/api/shopify-status");
      const data = await response.json();
      if (response.ok && data?.connected) setStoreInfo(data.shop);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadFlowers();
    loadStore();
  }, []);

  useEffect(() => {
    if (adminKey) verifyAdmin(adminKey, true);
  }, []);

  const total = useMemo(
    () => selected.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [selected]
  );

  const shopProducts = useMemo(() => {
    const priority = ["12 Rose Bouquet", "24 Rose Bouquet", "50 Rose Bouquet", "75 Rose Bouquet", "100 Rose Bouquet", "Hydrangea Arrangement"];
    return [...flowers].sort((a, b) => {
      const ai = priority.indexOf(a.name);
      const bi = priority.indexOf(b.name);
      if (ai === -1 && bi === -1) return Number(a.price || 0) - Number(b.price || 0);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [flowers]);

  const navigateHome = (sectionId) => {
    setView("home");
    setMobileOpen(false);
    requestAnimationFrame(() => {
      if (sectionId) document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const startOrder = (product) => {
    setSelected([{ ...product, pickId: crypto.randomUUID() }]);
    setCheckoutError("");
    setView("order");
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goCustom = () => {
    setSelected([]);
    setCheckoutError("");
    setView("order");
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addStem = (flower) => {
    if (selected.length >= 10) return;
    setSelected((current) => [...current, { ...flower, pickId: crypto.randomUUID() }]);
    setCheckoutError("");
  };

  const removeStem = (pickId) => setSelected((current) => current.filter((item) => item.pickId !== pickId));

  const continueToCheckout = async () => {
    setCheckoutError("");
    if (!selected.length) return setCheckoutError("Please select at least one arrangement or flower.");
    if (!recipient.trim()) return setCheckoutError("Please enter the recipient name.");
    if (!deliveryDate) return setCheckoutError("Please select a delivery date.");
    if (!deliveryTime) return setCheckoutError("Please select a delivery time.");

    try {
      setCheckoutLoading(true);
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map((item) => ({ variantId: item.shopifyVariantId, quantity: 1 })),
          recipient: recipient.trim(),
          deliveryDate,
          deliveryTime,
          cardMessage: cardMessage.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || "Could not create checkout.");
      if (!data.checkoutUrl) throw new Error("Shopify did not return a checkout URL.");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setCheckoutError(error.message || "Could not continue to checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const verifyAdmin = async (key = adminKey, silent = false) => {
    if (!key) {
      if (!silent) setAdminError("Enter your florist password.");
      return false;
    }
    try {
      const response = await fetch("/api/admin/session", { headers: { "X-Admin-Key": key } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not sign in.");
      sessionStorage.setItem("sb_admin_key", key);
      setAdminKey(key);
      setAdminAuthenticated(true);
      setAdminError("");
      await Promise.all([loadAdminProducts(key), loadOrders(key)]);
      return true;
    } catch (error) {
      setAdminAuthenticated(false);
      sessionStorage.removeItem("sb_admin_key");
      if (!silent) setAdminError(error.message || "Invalid florist password.");
      return false;
    }
  };

  const loadAdminProducts = async (key = adminKey) => {
    const response = await fetch("/api/admin/products", { headers: { "X-Admin-Key": key } });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.details || data?.error || "Could not load products.");
    setAdminProducts(Array.isArray(data) ? data : []);
  };

  const loadOrders = async (key = adminKey) => {
    setOrdersLoading(true);
    try {
      const response = await fetch("/api/orders", { headers: { "X-Admin-Key": key } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || "Could not load orders.");
      setOrders(Array.isArray(data) ? data : []);
      setAdminError("");
    } catch (error) {
      setAdminError(error.message || "Could not load orders.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const logoutAdmin = () => {
    sessionStorage.removeItem("sb_admin_key");
    setAdminKey("");
    setAdminAuthenticated(false);
    setAdminProducts([]);
    setOrders([]);
    setView("home");
  };

  const today = new Date();
  const localMinDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="site-shell">
      <div className="announcement">Fresh flowers for life’s sweetest moments · Houston, Texas</div>
      <header className="site-header">
        <button className="logo-button" onClick={() => navigateHome()}>
          <span className="logo-flower">✿</span>
          <span className="logo-copy"><strong>SWEET BLOOMS</strong><small>FLOWER SHOP</small></span>
        </button>

        <button className="mobile-menu" onClick={() => setMobileOpen((v) => !v)} aria-label="Open menu">☰</button>
        <nav className={mobileOpen ? "main-nav open" : "main-nav"}>
          <button onClick={() => navigateHome()}>Home</button>
          <button onClick={() => navigateHome("shop")}>Shop</button>
          <button onClick={() => navigateHome("about")}>About</button>
          <button onClick={() => navigateHome("contact")}>Contact</button>
          <button className="nav-order" onClick={goCustom}>Custom Order</button>
        </nav>
      </header>

      {view === "home" && (
        <main>
          <section className="hero">
            <div className="hero-overlay" />
            <div className="hero-content">
              <p className="script-line">Flowers made for your special moments</p>
              <h1>Beautiful blooms,<br />made with love.</h1>
              <p>Elegant floral arrangements handcrafted for birthdays, anniversaries, celebrations and everyday moments.</p>
              <div className="hero-actions">
                <button className="btn btn-dark" onClick={() => navigateHome("shop")}>SHOP FLOWERS</button>
                <button className="btn btn-light" onClick={goCustom}>CUSTOM ORDER</button>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="petal p1">🌸</span><span className="petal p2">🌷</span><span className="petal p3">🌹</span><span className="petal p4">🌿</span>
              <div className="bouquet-wrap">💐</div>
            </div>
          </section>

          <section className="service-strip">
            <article><span>♡</span><div><strong>Handcrafted</strong><small>Made with care</small></div></article>
            <article><span>✿</span><div><strong>Fresh Flowers</strong><small>Beautiful selections</small></div></article>
            <article><span>⌂</span><div><strong>Local Florist</strong><small>Houston, Texas</small></div></article>
            <article><span>✓</span><div><strong>Secure Checkout</strong><small>Powered by Shopify</small></div></article>
          </section>

          <section id="shop" className="shop-section section-pad">
            <div className="section-heading">
              <p className="script-line">Shop our favorites</p>
              <h2>Flowers for Every Occasion</h2>
              <p>Choose a signature Sweet Blooms arrangement and personalize your delivery details at checkout.</p>
            </div>

            {flowersLoading ? (
              <div className="loading-grid"><div className="spinner" /><p>Loading our flowers…</p></div>
            ) : shopProducts.length === 0 ? (
              <div className="empty-shop"><span>🌸</span><h3>New arrangements are coming soon.</h3></div>
            ) : (
              <div className="product-grid">
                {shopProducts.map((product) => (
                  <article className="product-card" key={product.id}>
                    <button className="product-image" onClick={() => startOrder(product)}>
                      {product.image ? <img src={product.image} alt={product.name} /> : <div className="product-placeholder">💐</div>}
                      <span className="quick-shop">ORDER NOW</span>
                    </button>
                    <div className="product-info">
                      <p className="product-kicker">SWEET BLOOMS</p>
                      <h3>{product.name}</h3>
                      <p className="product-price">{money(product.price)}</p>
                      <button className="text-link" onClick={() => startOrder(product)}>Select arrangement →</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="occasion-band">
            <div>
              <p className="script-line">Celebrate beautifully</p>
              <h2>Made for the moments<br />you’ll always remember.</h2>
              <p>Birthdays · Anniversaries · Love & Romance · Congratulations · Just Because</p>
              <button className="btn btn-dark" onClick={goCustom}>CREATE A CUSTOM ORDER</button>
            </div>
            <div className="occasion-art"><span>🌹</span><span>🌸</span><span>🌷</span><span>🤍</span></div>
          </section>

          <section id="about" className="about-section section-pad">
            <div className="about-art"><div className="arch"><span>💐</span></div></div>
            <div className="about-copy">
              <p className="script-line">Our story</p>
              <h2>Thoughtful flowers,<br />beautifully designed.</h2>
              <p>Sweet Blooms Flower Shop creates elegant floral arrangements designed to make every celebration feel more personal. From classic roses to romantic statement bouquets, each order is prepared with attention to detail and care.</p>
              <p>Our goal is simple: beautiful flowers, a smooth ordering experience, and arrangements that feel as special as the person receiving them.</p>
              <button className="text-link strong" onClick={() => navigateHome("shop")}>SHOP THE COLLECTION →</button>
            </div>
          </section>

          <section className="custom-cta">
            <p className="script-line">Something special in mind?</p>
            <h2>Create Your Own Sweet Blooms Moment</h2>
            <p>Choose your flowers and add recipient, delivery date, time and a personal card message.</p>
            <button className="btn btn-dark" onClick={goCustom}>START A CUSTOM ORDER</button>
          </section>

          <section id="contact" className="contact-section section-pad">
            <div>
              <p className="script-line">We’d love to hear from you</p>
              <h2>Contact Sweet Blooms</h2>
              <p>Questions about an arrangement, a special event, or a custom request? Reach out and we’ll be happy to help.</p>
            </div>
            <div className="contact-cards">
              <article><span>✉</span><strong>Email</strong><a href="mailto:sweetbloomsflowershop@gmail.com">sweetbloomsflowershop@gmail.com</a></article>
              <article><span>⌂</span><strong>Location</strong><p>Houston, Texas</p></article>
              <article><span>✿</span><strong>Online Orders</strong><p>Secure checkout through Shopify</p></article>
            </div>
          </section>
        </main>
      )}

      {view === "order" && (
        <main className="order-page section-pad">
          <button className="back-link" onClick={() => navigateHome("shop")}>← Back to shop</button>
          <div className="section-heading order-heading">
            <p className="script-line">Personalize your flowers</p>
            <h1>{selected.length === 1 ? selected[0].name : "Custom Floral Order"}</h1>
            <p>Add your delivery details and continue to secure Shopify checkout.</p>
          </div>

          <div className="order-layout">
            <section className="order-form-card">
              <h2>Delivery Details</h2>
              <div className="form-grid">
                <label>Recipient name<input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient name" maxLength="80" /></label>
                <label>Delivery date<input type="date" min={localMinDate} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></label>
                <label>Delivery time<input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} /></label>
                <label className="full">Card message<textarea rows="5" value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} placeholder="Write a message for the recipient…" maxLength="500" /></label>
              </div>

              <div className="add-more">
                <div><h3>Add another floral item</h3><p>You can combine up to 10 eligible items in one order.</p></div>
                <div className="mini-products">
                  {shopProducts.filter((p) => !selected.some((s) => s.id === p.id)).slice(0, 4).map((product) => (
                    <button key={product.id} onClick={() => addStem(product)} disabled={selected.length >= 10}>+ {product.name} · {money(product.price)}</button>
                  ))}
                </div>
              </div>
            </section>

            <aside className="order-summary-card">
              <p className="summary-label">YOUR ORDER</p>
              <div className="summary-bloom">💐</div>
              <div className="summary-items">
                {selected.length === 0 && <p className="muted">Choose an arrangement to begin.</p>}
                {selected.map((item) => (
                  <div className="summary-item" key={item.pickId}>
                    <span>{item.name}</span>
                    <span>{money(item.price)} <button onClick={() => removeStem(item.pickId)}>×</button></span>
                  </div>
                ))}
              </div>
              {(deliveryDate || deliveryTime || cardMessage) && <div className="delivery-preview">
                {deliveryDate && <p><strong>Date:</strong> {deliveryDate}</p>}
                {deliveryTime && <p><strong>Time:</strong> {deliveryTime}</p>}
                {cardMessage && <p><strong>Card:</strong> {cardMessage}</p>}
              </div>}
              <div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div>
              {checkoutError && <div className="notice error">{checkoutError}</div>}
              <button className="btn btn-dark checkout-btn" disabled={checkoutLoading || selected.length === 0} onClick={continueToCheckout}>{checkoutLoading ? "Opening checkout…" : `CONTINUE TO CHECKOUT · ${money(total)}`}</button>
              <p className="secure-copy">🔒 Secure payment and final order confirmation through Shopify.</p>
            </aside>
          </div>
        </main>
      )}

      {view === "admin" && (
        <main className="admin-page section-pad">
          {!adminAuthenticated ? (
            <section className="admin-login">
              <p className="script-line">Florist access</p>
              <h1>Sweet Blooms Admin</h1>
              <p>Orders and customer information are private and protected.</p>
              <form onSubmit={(e) => { e.preventDefault(); verifyAdmin(adminKey); }}>
                <label>Florist password<input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Enter password" /></label>
                {adminError && <div className="notice error">{adminError}</div>}
                <button className="btn btn-dark" type="submit">SIGN IN</button>
              </form>
            </section>
          ) : (
            <>
              <div className="admin-top"><div><p className="script-line">Florist workspace</p><h1>Sweet Blooms Admin</h1><p>{storeInfo?.name || "Shopify connected"}</p></div><div><button className="btn btn-outline" onClick={() => Promise.all([loadAdminProducts(), loadOrders()])}>Refresh</button><button className="btn btn-dark" onClick={logoutAdmin}>Sign out</button></div></div>
              {adminError && <div className="notice error">{adminError}</div>}
              <div className="admin-stats"><article><span>Products</span><strong>{adminProducts.length}</strong></article><article><span>Shop-ready</span><strong>{adminProducts.filter((p) => p.builderEligible && p.available).length}</strong></article><article><span>Recent orders</span><strong>{orders.length}</strong></article></div>
              <section className="admin-panel"><h2>Shopify Orders</h2>{ordersLoading ? <p>Loading orders…</p> : orders.length === 0 ? <p>No orders yet.</p> : <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-head"><strong>{order.name || order.orderNumber}</strong><span>{money(order.total)} {order.currency}</span></div><p><b>Customer:</b> {order.customerName || order.customer?.displayName || "—"}</p>{order.email && <p><b>Email:</b> {order.email}</p>}{order.recipientName && <p><b>Recipient:</b> {order.recipientName}</p>}{order.deliveryDate && <p><b>Delivery:</b> {order.deliveryDate} {order.deliveryTime || ""}</p>}{order.cardMessage && <p><b>Card:</b> {order.cardMessage}</p>}<p><b>Status:</b> {order.displayFinancialStatus || order.financialStatus} · {order.displayFulfillmentStatus || order.fulfillmentStatus}</p></article>)}</div>}</section>
            </>
          )}
        </main>
      )}

      <footer className="site-footer">
        <div className="footer-brand"><span className="logo-flower">✿</span><strong>SWEET BLOOMS</strong><small>FLOWER SHOP</small></div>
        <div><strong>Explore</strong><button onClick={() => navigateHome("shop")}>Shop</button><button onClick={() => navigateHome("about")}>About</button><button onClick={() => navigateHome("contact")}>Contact</button></div>
        <div><strong>Orders</strong><button onClick={goCustom}>Custom Order</button><button onClick={() => { setView("admin"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Florist Login</button></div>
        <div><strong>Sweet Blooms</strong><p>Houston, Texas</p><a href="mailto:sweetbloomsflowershop@gmail.com">sweetbloomsflowershop@gmail.com</a></div>
        <p className="copyright">© 2026 Sweet Blooms Flower Shop. Checkout powered by Shopify.</p>
      </footer>
    </div>
  );
}

export default App;
