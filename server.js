import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "flowers.json");

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

function getShopDomain() {
  if (!SHOPIFY_SHOP) throw new Error("SHOPIFY_SHOP is not configured.");

  let shop = SHOPIFY_SHOP
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  if (!shop.endsWith(".myshopify.com")) shop = `${shop}.myshopify.com`;
  return shop;
}

let tokenCache = { accessToken: null, expiresAt: 0 };

async function getShopifyAccessToken() {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }

  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error("SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET is not configured.");
  }

  const shopDomain = getShopDomain();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: SHOPIFY_CLIENT_ID,
    client_secret: SHOPIFY_CLIENT_SECRET
  });

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Shopify returned an invalid token response.");
  }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Could not obtain Shopify access token.");
  }

  const expiresIn = Number(data.expires_in || 86399);
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  };
  return tokenCache.accessToken;
}

async function shopifyGraphQL(query, variables = {}) {
  const shopDomain = getShopDomain();
  const accessToken = await getShopifyAccessToken();

  const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Shopify returned an invalid API response.");
  }

  if (!response.ok) throw new Error(`Shopify API returned HTTP ${response.status}.`);
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  return payload.data;
}

function readFlowers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeFlowers(flowers) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(flowers, null, 2));
}

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: "Admin access has not been configured." });
  }

  const supplied = String(req.get("X-Admin-Key") || "");
  const expected = String(ADMIN_KEY);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);

  const valid =
    suppliedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);

  if (!valid) return res.status(401).json({ error: "Invalid admin password." });
  next();
}

function isBuilderProduct(product) {
  const haystack = [
    product.title,
    product.productType,
    ...(Array.isArray(product.tags) ? product.tags : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["flower", "flowers", "floral", "rose", "roses", "bouquet", "stem", "sweet-blooms-builder"]
    .some((term) => haystack.includes(term));
}

async function loadShopifyProducts() {
  const data = await shopifyGraphQL(`
    query SweetBloomsProducts {
      products(first: 100) {
        nodes {
          id
          title
          handle
          status
          productType
          tags
          featuredMedia {
            preview {
              image { url altText }
            }
          }
          variants(first: 100) {
            nodes {
              id
              title
              price
              inventoryQuantity
              availableForSale
              sku
            }
          }
        }
      }
    }
  `);

  return (data?.products?.nodes || []).map((product) => {
    const availableVariant = product.variants.nodes.find((variant) => variant.availableForSale) || product.variants.nodes[0] || null;
    const variants = product.variants.nodes.map((variant) => ({
      id: variant.id,
      title: variant.title,
      price: Number(variant.price || 0),
      stock: variant.inventoryQuantity ?? 0,
      available: Boolean(variant.availableForSale),
      sku: variant.sku || ""
    }));

    return {
      id: product.id,
      name: product.title,
      title: product.title,
      handle: product.handle,
      productType: product.productType || "",
      tags: product.tags || [],
      price: availableVariant ? Number(availableVariant.price) : 0,
      stock: availableVariant?.inventoryQuantity ?? 0,
      image: product.featuredMedia?.preview?.image?.url || "",
      available: product.status === "ACTIVE" && Boolean(availableVariant?.availableForSale),
      status: product.status,
      sku: availableVariant?.sku || "",
      shopifyProductId: product.id,
      shopifyVariantId: availableVariant?.id || null,
      variants,
      builderEligible: isBuilderProduct(product)
    };
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Sweet Blooms Shopify App",
    shopifyConfigured: Boolean(SHOPIFY_SHOP && SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_SECRET),
    adminConfigured: Boolean(ADMIN_KEY),
    apiVersion: SHOPIFY_API_VERSION
  });
});

app.get("/api/shopify-status", async (_req, res) => {
  try {
    const data = await shopifyGraphQL(`
      query ShopStatus {
        shop { name myshopifyDomain currencyCode }
      }
    `);
    res.json({ connected: true, shop: data.shop });
  } catch (error) {
    console.error("Shopify status error:", error.message);
    res.status(500).json({ connected: false, error: error.message });
  }
});

app.get("/api/flowers", async (_req, res) => {
  const shopifyConfigured = Boolean(SHOPIFY_SHOP && SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_SECRET);

  if (!shopifyConfigured) {
    return res.json(readFlowers().filter((flower) => flower.available !== false));
  }

  try {
    const products = await loadShopifyProducts();
    res.json(products.filter((product) => product.builderEligible && product.available));
  } catch (error) {
    console.error("Could not load Shopify products:", error.message);
    res.status(500).json({ error: "Could not load flower catalog.", details: error.message });
  }
});

app.get("/api/admin/session", requireAdmin, (_req, res) => {
  res.json({ authenticated: true });
});

app.get("/api/admin/products", requireAdmin, async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await loadShopifyProducts());
  } catch (error) {
    res.status(500).json({ error: "Could not load Shopify products.", details: error.message });
  }
});

app.post("/api/flowers", requireAdmin, (req, res) => {
  const { name, price, image, available = true, stock = 0 } = req.body || {};

  if (!name || price === undefined || Number.isNaN(Number(price))) {
    return res.status(400).json({ error: "Name and valid price are required." });
  }

  const flowers = readFlowers();
  const item = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    price: Number(price),
    image: String(image || "").trim(),
    available: Boolean(available),
    stock: Number(stock) || 0
  };
  flowers.push(item);
  writeFlowers(flowers);
  res.status(201).json(item);
});

app.patch("/api/flowers/:id", requireAdmin, (req, res) => {
  const flowers = readFlowers();
  const index = flowers.findIndex((flower) => flower.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Flower not found." });

  flowers[index] = { ...flowers[index], ...req.body, id: flowers[index].id };
  if (req.body.price !== undefined) flowers[index].price = Number(req.body.price);
  if (req.body.stock !== undefined) flowers[index].stock = Number(req.body.stock) || 0;
  writeFlowers(flowers);
  res.json(flowers[index]);
});

app.delete("/api/flowers/:id", requireAdmin, (req, res) => {
  const flowers = readFlowers();
  const next = flowers.filter((flower) => flower.id !== req.params.id);
  if (next.length === flowers.length) return res.status(404).json({ error: "Flower not found." });
  writeFlowers(next);
  res.status(204).end();
});

app.post("/api/create-checkout", async (req, res) => {
  try {
    const { items, recipient, deliveryDate, deliveryTime, cardMessage } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Please select at least one flower." });
    }

    const totalQuantity = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
    if (totalQuantity > 10) {
      return res.status(400).json({ error: "A custom bouquet can contain a maximum of 10 stems." });
    }

    if (!String(recipient || "").trim()) return res.status(400).json({ error: "Recipient name is required." });
    if (!deliveryDate) return res.status(400).json({ error: "Delivery date is required." });
    if (!deliveryTime) return res.status(400).json({ error: "Delivery time is required." });

    const requestedDate = new Date(`${deliveryDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(requestedDate.getTime()) || requestedDate < today) {
      return res.status(400).json({ error: "Please select a valid future delivery date." });
    }

    const products = await loadShopifyProducts();
    const allowedVariants = new Map();
    for (const product of products.filter((product) => product.builderEligible && product.available)) {
      for (const variant of product.variants.filter((variant) => variant.available)) {
        const numericId = String(variant.id).split("/").pop();
        allowedVariants.set(numericId, variant);
      }
    }

    const quantities = new Map();
    for (const item of items) {
      const rawVariantId = String(item.variantId || item.shopifyVariantId || "").trim();
      const variantId = rawVariantId.includes("/") ? rawVariantId.split("/").pop() : rawVariantId;
      if (!/^\d+$/.test(variantId) || !allowedVariants.has(variantId)) {
        return res.status(400).json({ error: "One of the selected flowers is unavailable." });
      }
      const quantity = Math.max(1, Number(item.quantity || 1));
      quantities.set(variantId, (quantities.get(variantId) || 0) + quantity);
    }

    const cartItems = [...quantities.entries()].map(([variantId, quantity]) => `${variantId}:${quantity}`).join(",");
    const params = new URLSearchParams();
    params.set("attributes[Recipient]", String(recipient).trim());
    params.set("attributes[Delivery Date]", String(deliveryDate));
    params.set("attributes[Delivery Time]", String(deliveryTime));
    params.set("attributes[Order Type]", "Custom Bouquet");
    if (String(cardMessage || "").trim()) params.set("attributes[Card Message]", String(cardMessage).trim().slice(0, 500));
    params.set("note", `Sweet Blooms custom bouquet for ${String(recipient).trim()}`);

    const checkoutUrl = `https://${getShopDomain()}/cart/${cartItems}?checkout&${params.toString()}`;
    res.json({ success: true, checkoutUrl });
  } catch (error) {
    console.error("Could not create checkout:", error.message);
    res.status(500).json({ error: "Could not create checkout.", details: error.message });
  }
});

app.get("/api/orders", requireAdmin, async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const data = await shopifyGraphQL(`
      query SweetBloomsOrders {
        orders(first: 50, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            email
            phone
            note
            customer { id displayName email phone }
            totalPriceSet { shopMoney { amount currencyCode } }
            shippingAddress {
              firstName lastName address1 address2 city province provinceCode zip country phone
            }
            customAttributes { key value }
            lineItems(first: 50) {
              nodes {
                id
                title
                quantity
                variant { id title }
                customAttributes { key value }
                originalUnitPriceSet { shopMoney { amount currencyCode } }
              }
            }
          }
        }
      }
    `);

    const orders = (data?.orders?.nodes || []).map((order) => {
      const customAttributes = Array.isArray(order.customAttributes) ? order.customAttributes : [];
      const attributes = Object.fromEntries(customAttributes.filter((a) => a?.key).map((a) => [String(a.key).trim().toLowerCase(), a.value || ""]));
      const getAttribute = (...names) => {
        for (const name of names) {
          const value = attributes[String(name).trim().toLowerCase()];
          if (value) return value;
        }
        return "";
      };

      const customerName = order.customer?.displayName || [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(" ") || "";
      const lineItems = (order.lineItems?.nodes || []).map((item) => ({
        id: item.id,
        title: item.title || "",
        quantity: item.quantity || 1,
        variantTitle: item.variant?.title || "",
        variantId: item.variant?.id || null,
        price: item.originalUnitPriceSet?.shopMoney?.amount ?? "",
        currency: item.originalUnitPriceSet?.shopMoney?.currencyCode ?? order.totalPriceSet?.shopMoney?.currencyCode ?? "USD",
        customAttributes: Array.isArray(item.customAttributes) ? item.customAttributes : []
      }));

      const recipientName = getAttribute("recipient", "recipient name", "recipient_name", "delivery recipient");
      const deliveryDate = getAttribute("delivery date", "delivery_date", "requested delivery date");
      const deliveryTime = getAttribute("delivery time", "delivery_time", "requested delivery time");
      const cardMessage = getAttribute("card message", "card_message", "gift message", "message");

      return {
        id: order.id,
        name: order.name,
        orderNumber: order.name,
        createdAt: order.createdAt,
        displayFinancialStatus: order.displayFinancialStatus || "UNKNOWN",
        financialStatus: order.displayFinancialStatus || "UNKNOWN",
        displayFulfillmentStatus: order.displayFulfillmentStatus || "UNFULFILLED",
        fulfillmentStatus: order.displayFulfillmentStatus || "UNFULFILLED",
        email: order.email || order.customer?.email || "",
        phone: order.phone || order.customer?.phone || order.shippingAddress?.phone || "",
        customerName,
        customer: {
          id: order.customer?.id || null,
          displayName: customerName,
          email: order.customer?.email || order.email || "",
          phone: order.customer?.phone || order.phone || order.shippingAddress?.phone || ""
        },
        shippingAddress: order.shippingAddress || null,
        totalPriceSet: order.totalPriceSet || null,
        total: order.totalPriceSet?.shopMoney?.amount ?? "0",
        currency: order.totalPriceSet?.shopMoney?.currencyCode ?? "USD",
        note: order.note || "",
        customAttributes,
        attributes: customAttributes,
        recipientName,
        recipient: recipientName,
        deliveryDate,
        deliveryTime,
        cardMessage,
        lineItems,
        items: lineItems
      };
    });

    res.json(orders);
  } catch (error) {
    console.error("Could not load Shopify orders:", error.message);
    res.status(500).json({ error: "Could not load Shopify orders.", details: error.message });
  }
});

const dist = path.join(__dirname, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h" }));
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Sweet Blooms Shopify App running on port ${PORT}`);
});
