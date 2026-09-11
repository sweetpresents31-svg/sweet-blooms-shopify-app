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

  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("sb_admin_key") || "");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminProducts, setAdminProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const adminHeaders = adminKey ? { "X-Admin-Key": adminKey } : {};

  const loadFlowers = async () => {
    setFlowersLoading(true);
    try {
      const response = await fetch("/api/flowers");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || "Could not load flowers.");
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
    if (!adminKey) return;
    verifyAdmin(adminKey, true);
  }, []);

  const total = useMemo(
    () => selected.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [selected]
  );

  const addStem = (flower) => {
    if (selected.length >= 10) return;
    setSelected((current) => [...current, { ...flower, pickId: crypto.randomUUID() }]);
    setCheckoutError("");
  };

  const removeStem = (pickId) => {
    setSelected((current) => current.filter((item) => item.pickId !== pickId));
  };

  const continueToCheckout = async () => {
    setCheckoutError("");

    if (!selected.length) return setCheckoutError("Please select at least one flower.");
    if (!recipient.trim()) return setCheckoutError("Please enter the recipient name.");
    if (!deliveryDate) return setCheckoutError("Please select a delivery date.");
    if (!deliveryTime) return setCheckoutError("Please select a delivery time.");

    try {
      setCheckoutLoading(true);
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map((flower) => ({ variantId: flower.shopifyVariantId, quantity: 1 })),
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

  const openAdmin = () => {
    setView("admin");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const logoutAdmin = () => {
    sessionStorage.removeItem("sb_admin_key");
    setAdminKey("");
    setAdminAuthenticated(false);
    setAdminProducts([]);
    setOrders([]);
    setView("home");
  };

  const goToBuilder = () => {
    setView("builder");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const today = new Date();
  const localMinDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="site-shell">
      <header className="topbar">
        <button className="brand-button" onClick={() => setView("home")} aria-label="Sweet Blooms home">
          <span className="brand-mark">SB</span>
          <span><strong>Sweet Blooms</strong><small>Flower Shop</small></span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === "home" ? "active" : ""} onClick={() => setView("home")}>Home</button>
          <button className={view === "builder" ? "active" : ""} onClick={goToBuilder}>Build a Bouquet</button>
          <button className={view === "admin" ? "active" : ""} onClick={openAdmin}>Florist Login</button>
        </nav>
      </header>

      {view === "home" && (
        <main>
          <section className="hero-section">
            <div className="hero-copy">
              <p className="eyebrow">SWEET BLOOMS FLOWER SHOP</p>
              <h1>Flowers made personal, one stem at a time.</h1>
              <p className="hero-text">Create a custom bouquet, choose the flowers you love, add a personal card message, and send it through secure Shopify checkout.</p>
              <div className="hero-actions">
                <button className="primary large" onClick={goToBuilder}>Build your bouquet</button>
                <span className="secure-note">Secure checkout powered by Shopify</span>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="hero-bouquet">🌸<span>🌹</span>🌷<span>💐</span>🌿</div>
              <div className="hero-card">Made with love<br /><strong>Sweet Blooms</strong></div>
            </div>
          </section>

          <section className="trust-grid">
            <article><span>01</span><h3>Choose your flowers</h3><p>Select up to 10 available stems from our live Shopify catalog.</p></article>
            <article><span>02</span><h3>Personalize it</h3><p>Add the recipient, delivery date and time, and your card message.</p></article>
            <article><span>03</span><h3>Checkout securely</h3><p>Your items and delivery details continue directly to Shopify checkout.</p></article>
          </section>

          <section className="cta-panel">
            <div><p className="eyebrow">CREATE SOMETHING BEAUTIFUL</p><h2>Your bouquet, your way.</h2></div>
            <button className="primary" onClick={goToBuilder}>Start building</button>
          </section>
        </main>
      )}

      {view === "builder" && (
        <main className="page-wrap">
          <div className="page-heading">
            <p className="eyebrow">CUSTOM BOUQUET</p>
            <h1>Build a Bouquet</h1>
            <p>Choose up to 10 stems. Your total updates automatically.</p>
          </div>

          {flowersLoading ? (
            <section className="panel center-state"><div className="spinner" /><h2>Loading flowers...</h2></section>
          ) : flowers.length === 0 ? (
            <section className="panel center-state">
              <div className="state-icon">🌷</div>
              <h2>Fresh flower selections are being prepared.</h2>
              <p>Please check back soon. Our florist is updating the live flower catalog.</p>
            </section>
          ) : (
            <div className="builder-grid">
              <section className="panel">
                <div className="form-grid">
                  <label>Recipient name<input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient name" maxLength="80" /></label>
                  <label>Delivery date<input type="date" min={localMinDate} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></label>
                  <label>Delivery time<input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} /></label>
                  <label className="full">Card message<textarea value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} placeholder="Write your message here..." rows="4" maxLength="500" /></label>
                </div>

                <div className="section-title-row"><div><h2>Choose your stems</h2><p>{selected.length}/10 selected</p></div></div>
                <div className="flower-grid">
                  {flowers.map((flower) => (
                    <button className="flower-card" key={flower.id} onClick={() => addStem(flower)} disabled={selected.length >= 10}>
                      <div className="flower-image">{flower.image ? <img src={flower.image} alt={flower.name} /> : <span>🌷</span>}</div>
                      <div className="flower-card-copy"><strong>{flower.name}</strong><span>{money(flower.price)} / stem</span></div>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="panel order-preview">
                <p className="eyebrow">YOUR BOUQUET</p>
                <h2>{recipient ? `For ${recipient}` : "Custom Bouquet"}</h2>
                <div className="vase"><div className="stems">{selected.length ? selected.map((flower) => <span key={flower.pickId}>🌷</span>) : <span className="empty">Select flowers to begin</span>}</div><div className="vase-body">Sweet Blooms</div></div>

                <div className="selected-list">
                  {selected.map((flower) => (
                    <div className="selected-row" key={flower.pickId}>
                      <span>{flower.name}</span><span>{money(flower.price)} <button onClick={() => removeStem(flower.pickId)} aria-label={`Remove ${flower.name}`}>×</button></span>
                    </div>
                  ))}
                </div>

                {(deliveryDate || deliveryTime || cardMessage) && (
                  <div className="delivery-box">
                    {deliveryDate && <p><strong>Delivery:</strong> {deliveryDate}</p>}
                    {deliveryTime && <p><strong>Time:</strong> {deliveryTime}</p>}
                    {cardMessage && <p><strong>Card:</strong> {cardMessage}</p>}
                  </div>
                )}

                <div className="total-row"><span>Total</span><strong>{money(total)}</strong></div>
                {checkoutError && <div className="notice error">{checkoutError}</div>}
                <button className="primary checkout-button" onClick={continueToCheckout} disabled={checkoutLoading || selected.length === 0}>
                  {checkoutLoading ? "Opening checkout..." : `Continue to Shopify · ${money(total)}`}
                </button>
                <p className="checkout-footnote">Final taxes, delivery options, and payment are confirmed in Shopify checkout.</p>
              </aside>
            </div>
          )}
        </main>
      )}

      {view === "admin" && (
        <main className="page-wrap admin-page">
          {!adminAuthenticated ? (
            <section className="login-card panel">
              <div className="state-icon">🔐</div>
              <p className="eyebrow">FLORIST ONLY</p>
              <h1>Florist Workspace</h1>
              <p>Orders and customer information are protected and are not visible to shoppers.</p>
              <form onSubmit={(e) => { e.preventDefault(); verifyAdmin(adminKey); }}>
                <label>Florist password<input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} autoComplete="current-password" placeholder="Enter florist password" /></label>
                {adminError && <div className="notice error">{adminError}</div>}
                <button className="primary" type="submit">Sign in</button>
              </form>
            </section>
          ) : (
            <>
              <div className="admin-heading">
                <div><p className="eyebrow">FLORIST WORKSPACE</p><h1>Sweet Blooms Admin</h1><p>{storeInfo?.name || "Shopify store connected"}</p></div>
                <div className="admin-actions"><button onClick={() => Promise.all([loadAdminProducts(), loadOrders()])}>Refresh data</button><button onClick={logoutAdmin}>Sign out</button></div>
              </div>

              {adminError && <div className="notice error">{adminError}</div>}

              <section className="stats">
                <article><span>Shopify products</span><strong>{adminProducts.length}</strong><small>all products</small></article>
                <article><span>Bouquet-ready</span><strong>{adminProducts.filter((p) => p.builderEligible && p.available).length}</strong><small>visible to customers</small></article>
                <article><span>Recent orders</span><strong>{orders.length}</strong><small>latest Shopify orders</small></article>
              </section>

              <section className="panel admin-section">
                <div className="section-title-row"><div><p className="eyebrow">CATALOG STATUS</p><h2>Customer bouquet products</h2></div></div>
                <p className="muted">Products appear in the bouquet builder when the title, product type, or tag includes flower, floral, rose, bouquet, stem, or sweet-blooms-builder.</p>
                <div className="admin-product-list">
                  {adminProducts.map((product) => (
                    <div className="admin-product-row" key={product.id}>
                      <div className="admin-thumb">{product.image ? <img src={product.image} alt="" /> : "🌷"}</div>
                      <div><strong>{product.name}</strong><span>{money(product.price)} · {product.status}</span></div>
                      <span className={product.builderEligible && product.available ? "badge good" : "badge"}>{product.builderEligible && product.available ? "Customer ready" : "Not in builder"}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel admin-section">
                <div className="section-title-row"><div><p className="eyebrow">SHOPIFY ORDERS</p><h2>Recent orders</h2></div><button onClick={() => loadOrders()} disabled={ordersLoading}>{ordersLoading ? "Loading..." : "Refresh orders"}</button></div>
                {ordersLoading && orders.length === 0 ? <p>Loading orders...</p> : orders.length === 0 ? <div className="center-state compact"><div className="state-icon">📦</div><h3>No orders yet</h3></div> : (
                  <div className="orders-list">
                    {orders.map((order, index) => {
                      const address = [order.shippingAddress?.address1, order.shippingAddress?.address2, order.shippingAddress?.city, order.shippingAddress?.provinceCode || order.shippingAddress?.province, order.shippingAddress?.zip].filter(Boolean).join(", ");
                      return (
                        <article className="order-card" key={order.id || index}>
                          <div className="order-main">
                            <div className="order-title"><strong>{order.name || `Order ${index + 1}`}</strong><span>{order.createdAt ? new Date(order.createdAt).toLocaleString() : ""}</span></div>
                            {(order.customerName || order.email || order.phone || address) && <div className="order-block"><h4>Customer</h4>{order.customerName && <p>{order.customerName}</p>}{order.email && <p>{order.email}</p>}{order.phone && <p>{order.phone}</p>}{address && <p>{address}</p>}</div>}
                            {(order.recipientName || order.deliveryDate || order.deliveryTime || order.cardMessage) && <div className="order-block"><h4>Delivery details</h4>{order.recipientName && <p><strong>Recipient:</strong> {order.recipientName}</p>}{order.deliveryDate && <p><strong>Date:</strong> {order.deliveryDate}</p>}{order.deliveryTime && <p><strong>Time:</strong> {order.deliveryTime}</p>}{order.cardMessage && <p><strong>Card:</strong> {order.cardMessage}</p>}</div>}
                            <div className="order-block"><h4>Items</h4>{(order.items || []).map((item, itemIndex) => <p key={item.id || itemIndex}>{item.title}{item.variantTitle && item.variantTitle !== "Default Title" ? ` — ${item.variantTitle}` : ""} × {item.quantity || 1}{item.price !== "" ? ` — ${item.currency || order.currency || "USD"} $${Number(item.price).toFixed(2)}` : ""}</p>)}</div>
                            {order.note && <div className="order-block"><h4>Order note</h4><p>{order.note}</p></div>}
                          </div>
                          <div className="order-summary"><strong>{order.currency || "USD"} {money(order.total)}</strong><span>Payment: {order.displayFinancialStatus || order.financialStatus}</span><span>Fulfillment: {order.displayFulfillmentStatus || order.fulfillmentStatus}</span></div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      )}

      <footer>
        <div><strong>Sweet Blooms Flower Shop</strong><span>Custom bouquets made with care.</span></div>
        <span>{storeInfo?.myshopifyDomain ? "Shopify connected" : "Secure storefront"}</span>
      </footer>
    </div>
  );
}

export default App;
