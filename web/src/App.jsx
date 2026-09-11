import React, { useEffect, useMemo, useState } from "react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function App() {
  const [tab, setTab] = useState("dashboard");
  const [flowers, setFlowers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [recipient, setRecipient] = useState("");
  const [form, setForm] = useState({ name: "", price: "", stock: "", image: "" });
  const [message, setMessage] = useState("");
const [orders, setOrders] = useState([]);
const [ordersLoading, setOrdersLoading] = useState(false);
const [ordersError, setOrdersError] = useState("");

  const loadOrders = async () => {
  setOrdersLoading(true);
  setOrdersError("");

  try {
    const r = await fetch("/api/orders");
    const data = await r.json();

    if (!r.ok) {
      throw new Error(data?.details || data?.error || "Could not load orders");
    }

    setOrders(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Orders error:", error);
    setOrdersError(error.message);
  } finally {
    setOrdersLoading(false);
  }
};
  const load = async () => {
  try {
    const r = await fetch("/api/flowers");
    const data = await r.json();

    if (!r.ok) {
      throw new Error(data?.details || data?.error || "Could not load flowers");
    }

    setFlowers(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Flowers error:", error);
    setFlowers([]);
    setMessage(error.message || "Could not connect to the app server.");
  }
};

  useEffect(() => {
  load();
  loadOrders();
}, []);

  const total = useMemo(
    () => selected.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [selected]
  );

  const addStem = (flower) => {
    if (selected.length >= 10) return;
    setSelected([...selected, { ...flower, pickId: crypto.randomUUID() }]);
  };

  const removeStem = (pickId) => {
    setSelected(selected.filter((f) => f.pickId !== pickId));
  };

  const addFlower = async (e) => {
    e.preventDefault();
    const r = await fetch("/api/flowers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!r.ok) {
      setMessage("Please enter a flower name and price.");
      return;
    }
    setForm({ name: "", price: "", stock: "", image: "" });
    setMessage("Flower added.");
    load();
  };

  const toggleAvailability = async (flower) => {
    await fetch(`/api/flowers/${flower.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !flower.available })
    });
    load();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">SB</div>
          <div>
            <strong>Sweet Blooms</strong>
            <span>Shopify App</span>
          </div>
        </div>

        {[
          ["dashboard", "Dashboard"],
          ["catalog", "Flower Catalog"],
          ["builder", "Bouquet Builder"],
          ["orders", "Orders"]
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "nav active" : "nav"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </aside>

      <main className="content">
        <header>
          <div>
            <p className="eyebrow">FLORIST WORKSPACE</p>
            <h1>{tab === "dashboard" ? "Welcome to Sweet Blooms" :
                 tab === "catalog" ? "Flower Catalog" :
                 tab === "builder" ? "Build a Bouquet" : "Orders"}</h1>
          </div>
          <span className="status">● Store connected</span>
        </header>

        {message && <div className="notice">{message}</div>}

        {tab === "dashboard" && (
          <>
            <section className="stats">
              <article><span>Flowers</span><strong>{flowers.length}</strong><small>catalog items</small></article>
              <article><span>Available</span><strong>{flowers.filter(f => f.available).length}</strong><small>ready to sell</small></article>
              <article><span>Low stock</span><strong>{flowers.filter(f => Number(f.stock) < 10).length}</strong><small>needs attention</small></article>
            </section>
            <section className="panel hero">
              <div>
                <p className="eyebrow">SWEET BLOOMS</p>
                <h2>Create personalized floral experiences</h2>
                <p>Manage your stems, availability and bouquet options from one simple workspace.</p>
                <button className="primary" onClick={() => setTab("catalog")}>Manage flowers</button>
              </div>
              <div className="bouquet">🌸🌷🌹<br/>🌿💐🌿</div>
            </section>
          </>
        )}

        {tab === "catalog" && (
          <div className="two-col">
            <section className="panel">
              <h2>Add a flower</h2>
              <form onSubmit={addFlower} className="form">
                <label>Name<input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Pink Rose" /></label>
                <label>Price per stem<input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price:e.target.value})} placeholder="5.50" /></label>
                <label>Stock<input type="number" value={form.stock} onChange={e => setForm({...form, stock:e.target.value})} placeholder="50" /></label>
                <label>Image URL (optional)<input value={form.image} onChange={e => setForm({...form, image:e.target.value})} placeholder="https://..." /></label>
                <button className="primary" type="submit">Add flower</button>
              </form>
            </section>

            <section className="panel">
              <h2>Your catalog</h2>
              <div className="flower-list">
                {flowers.map(f => (
                  <div className="flower-row" key={f.id}>
                    <div className="thumb">
                      {f.image ? <img src={f.image} alt="" /> : "🌷"}
                    </div>
                    <div className="flower-info">
                      <strong>{f.name}</strong>
                      <span>{money(f.price)} · {f.stock} in stock</span>
                    </div>
                    <button className={f.available ? "pill on" : "pill"} onClick={() => toggleAvailability(f)}>
                      {f.available ? "Available" : "Hidden"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "builder" && (
          <div className="two-col">
            <section className="panel">
              <h2>Select up to 10 stems</h2>
              <label className="recipient">Recipient name
                <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Emma" />
              </label>
              <div className="cards">
                {flowers.filter(f => f.available).map(f => (
                  <button className="flower-card" key={f.id} onClick={() => addStem(f)} disabled={selected.length >= 10}>
                    <div className="flower-art">{f.image ? <img src={f.image} alt="" /> : "🌷"}</div>
                    <strong>{f.name}</strong>
                    <span>{money(f.price)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel preview">
              <p className="eyebrow">LIVE PREVIEW</p>
              <h2>{recipient ? `${recipient}'s Bouquet` : "Personalized Bouquet"}</h2>
              <div className="vase">
                <div className="stems">
                  {selected.length ? selected.map(x => <span key={x.pickId}>🌷</span>) : <span className="empty">Choose flowers</span>}
                </div>
                <div className="vase-body">Sweet Blooms</div>
              </div>
              <div className="summary">
                <span>{selected.length}/10 stems</span>
                <strong>{money(total)}</strong>
              </div>
              <div className="chips">
                {selected.map(x => <button key={x.pickId} onClick={() => removeStem(x.pickId)}>× {x.name}</button>)}
              </div>
            </section>
          </div>
        )}

        {tab === "orders" && (
  <section className="panel">
    <div className="section-head">
      <div>
        <p className="eyebrow">SHOPIFY ORDERS</p>
        <h2>Orders</h2>
        <p>Real orders from your Sweet Blooms Shopify store.</p>
      </div>

      <button onClick={loadOrders} disabled={ordersLoading}>
        {ordersLoading ? "Loading..." : "Refresh orders"}
      </button>
    </div>

    {ordersError && (
      <p className="message">{ordersError}</p>
    )}

    {ordersLoading && orders.length === 0 ? (
      <p>Loading Shopify orders...</p>
    ) : orders.length === 0 ? (
      <div className="empty-orders">
        <div>📦</div>
        <h3>No orders yet</h3>
        <p>Your Shopify orders will appear here automatically.</p>
      </div>
    ) : (
      <div className="orders-list">
{orders.map((order, index) => {
  const orderName =
    order.name ||
    order.orderNumber ||
    `Order ${index + 1}`;

  const total =
    order.totalPriceSet?.shopMoney?.amount ??
    order.total ??
    "";

  const currency =
    order.totalPriceSet?.shopMoney?.currencyCode ??
    order.currency ??
    "USD";

  const paymentStatus =
    order.displayFinancialStatus ||
    order.financialStatus ||
    order.paymentStatus ||
    "UNKNOWN";

  const fulfillmentStatus =
    order.displayFulfillmentStatus ||
    order.fulfillmentStatus ||
    "UNFULFILLED";

  const items =
    order.lineItems?.nodes ||
    order.lineItems ||
    order.items ||
    [];

  const customerName =
    order.customer?.displayName ||
    [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
      .filter(Boolean)
      .join(" ") ||
    order.customerName ||
    "Not provided";

  const email =
    order.email ||
    order.customer?.email ||
    "Not provided";

  const phone =
    order.phone ||
    order.shippingAddress?.phone ||
    order.customer?.phone ||
    "Not provided";

  const address = order.shippingAddress
    ? [
        order.shippingAddress.address1,
        order.shippingAddress.address2,
        order.shippingAddress.city,
        order.shippingAddress.provinceCode ||
          order.shippingAddress.province,
        order.shippingAddress.zip,
      ]
        .filter(Boolean)
        .join(", ")
    : "Not provided";

  return (
    <div className="order-card" key={order.id || index}>
      <div>
        <strong>{orderName}</strong>

        <p>
          {order.createdAt
            ? new Date(order.createdAt).toLocaleString()
            : ""}
        </p>

        {items.length > 0 && (
          <div>
            <strong>Items:</strong>

            {items.map((item, itemIndex) => (
              <p key={item.id || itemIndex}>
                {item.title || item.name || "Item"} ×{" "}
                {item.quantity || 1}
              </p>
            ))}
          </div>
        )}

        <p>
          <strong>Customer:</strong> {customerName}
        </p>

        <p>
          <strong>Email:</strong> {email}
        </p>

        <p>
          <strong>Phone:</strong> {phone}
        </p>

        <p>
          <strong>Delivery address:</strong> {address}
        </p>

        {order.note && (
          <p>
            <strong>Order note:</strong> {order.note}
          </p>
        )}
      </div>

      <div>
        <strong>
          {total !== ""
            ? `${currency} $${Number(total).toFixed(2)}`
            : "Total unavailable"}
        </strong>

        <p>Payment: {paymentStatus}</p>

        <p>Fulfillment: {fulfillmentStatus}</p>
      </div>
    </div>
  );
})}
      </div>
    )}
  </section>
)}
      </main>
    </div>
  );
}

export default App;
