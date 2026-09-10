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
const SHOPIFY_API_VERSION =
  process.env.SHOPIFY_API_VERSION || "2026-07";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

/* -------------------------------------------------------
   SHOPIFY HELPERS
------------------------------------------------------- */

function getShopDomain() {
  if (!SHOPIFY_SHOP) {
    throw new Error("SHOPIFY_SHOP is not configured.");
  }

  let shop = SHOPIFY_SHOP
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  if (!shop.endsWith(".myshopify.com")) {
    shop = `${shop}.myshopify.com`;
  }

  return shop;
}

/*
  Client credentials tokens expire after about 24 hours.
  We cache the token in memory and automatically request
  another before it expires.
*/

let tokenCache = {
  accessToken: null,
  expiresAt: 0
};

async function getShopifyAccessToken() {
  const now = Date.now();

  if (
    tokenCache.accessToken &&
    tokenCache.expiresAt > now + 5 * 60 * 1000
  ) {
    return tokenCache.accessToken;
  }

  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error(
      "SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET is not configured."
    );
  }

  const shopDomain = getShopDomain();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: SHOPIFY_CLIENT_ID,
    client_secret: SHOPIFY_CLIENT_SECRET
  });

  const response = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Shopify returned an invalid token response: ${text}`
    );
  }

  if (!response.ok || !data.access_token) {
    console.error("Shopify token error:", data);

    throw new Error(
      data.error_description ||
        data.error ||
        "Could not obtain Shopify access token."
    );
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

  const response = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({
        query,
        variables
      })
    }
  );

  const text = await response.text();

  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(
      `Shopify returned an invalid API response: ${text}`
    );
  }

  if (!response.ok) {
    console.error("Shopify HTTP error:", payload);

    throw new Error(
      `Shopify API returned HTTP ${response.status}.`
    );
  }

  if (payload.errors?.length) {
    console.error("Shopify GraphQL errors:", payload.errors);

    throw new Error(
      payload.errors.map((error) => error.message).join("; ")
    );
  }

  return payload.data;
}

/* -------------------------------------------------------
   LOCAL DEMO DATA
------------------------------------------------------- */

function readFlowers() {
  try {
    return JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch {
    return [];
  }
}

function writeFlowers(flowers) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(flowers, null, 2)
  );
}

/* -------------------------------------------------------
   HEALTH
------------------------------------------------------- */

app.get("/api/health", async (_req, res) => {
  const credentialsConfigured = Boolean(
    SHOPIFY_SHOP &&
      SHOPIFY_CLIENT_ID &&
      SHOPIFY_CLIENT_SECRET
  );

  res.json({
    ok: true,
    app: "Sweet Blooms Shopify App",
    shopifyConfigured: credentialsConfigured,
    apiVersion: SHOPIFY_API_VERSION
  });
});

/* -------------------------------------------------------
   TEST SHOPIFY CONNECTION
------------------------------------------------------- */

app.get("/api/shopify-status", async (_req, res) => {
  try {
    const data = await shopifyGraphQL(`
      query ShopStatus {
        shop {
          name
          myshopifyDomain
        }
      }
    `);

    res.json({
      connected: true,
      shop: data.shop
    });
  } catch (error) {
    console.error("Shopify status error:", error);

    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

/* -------------------------------------------------------
   REAL SHOPIFY PRODUCTS
------------------------------------------------------- */

async function loadShopifyProducts() {
  const data = await shopifyGraphQL(`
    query SweetBloomsProducts {
      products(first: 100) {
        nodes {
          id
          title
          handle
          status

          featuredMedia {
            preview {
              image {
                url
                altText
              }
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

  return data.products.nodes.map((product) => {
    const variant = product.variants.nodes[0] || null;

    return {
      id: product.id,
      name: product.title,
      handle: product.handle,

      price: variant
        ? Number(variant.price)
        : 0,

      stock:
        variant?.inventoryQuantity ?? 0,

      image:
        product.featuredMedia?.preview?.image?.url || "",

      available:
        product.status === "ACTIVE" &&
        Boolean(variant?.availableForSale),

      status: product.status,

      sku:
        variant?.sku || "",

      shopifyProductId:
        product.id,

      shopifyVariantId:
        variant?.id || null
    };
  });
}

/*
  The existing frontend already calls /api/flowers.
  Once Shopify credentials exist, this route returns
  REAL Shopify products instead of flowers.json.
*/

app.get("/api/flowers", async (_req, res) => {
  const shopifyConfigured = Boolean(
    SHOPIFY_SHOP &&
      SHOPIFY_CLIENT_ID &&
      SHOPIFY_CLIENT_SECRET
  );

  if (!shopifyConfigured) {
    return res.json(readFlowers());
  }

  try {
    const products = await loadShopifyProducts();

    res.json(products);
  } catch (error) {
    console.error(
      "Could not load Shopify products:",
      error
    );

    res.status(500).json({
      error: "Could not load Shopify products.",
      details: error.message
    });
  }
});

app.get("/api/shopify-products", async (_req, res) => {
  try {
    const products = await loadShopifyProducts();

    res.json(products);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not load Shopify products.",
      details: error.message
    });
  }
});

/* -------------------------------------------------------
   LOCAL FLOWER FUNCTIONS
   These remain available for development/testing.
------------------------------------------------------- */

app.post("/api/flowers", (req, res) => {
  const {
    name,
    price,
    image,
    available = true,
    stock = 0
  } = req.body || {};

  if (
    !name ||
    price === undefined ||
    Number.isNaN(Number(price))
  ) {
    return res.status(400).json({
      error: "Name and valid price are required."
    });
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

app.patch("/api/flowers/:id", (req, res) => {
  const flowers = readFlowers();

  const index = flowers.findIndex(
    (flower) => flower.id === req.params.id
  );

  if (index < 0) {
    return res.status(404).json({
      error: "Flower not found."
    });
  }

  flowers[index] = {
    ...flowers[index],
    ...req.body,
    id: flowers[index].id
  };

  if (req.body.price !== undefined) {
    flowers[index].price =
      Number(req.body.price);
  }

  if (req.body.stock !== undefined) {
    flowers[index].stock =
      Number(req.body.stock) || 0;
  }

  writeFlowers(flowers);

  res.json(flowers[index]);
});

app.delete("/api/flowers/:id", (req, res) => {
  const flowers = readFlowers();

  const next = flowers.filter(
    (flower) => flower.id !== req.params.id
  );

  if (next.length === flowers.length) {
    return res.status(404).json({
      error: "Flower not found."
    });
  }

  writeFlowers(next);

  res.status(204).end();
});

/* -------------------------------------------------------
   FRONTEND
------------------------------------------------------- */

const dist = path.join(__dirname, "dist");

if (fs.existsSync(dist)) {
  app.use(express.static(dist));

  app.get("*", (_req, res) => {
    res.sendFile(
      path.join(dist, "index.html")
    );
  });
}

/* -------------------------------------------------------
   START SERVER
------------------------------------------------------- */

app.listen(PORT, () => {
  console.log(
    `Sweet Blooms Shopify App running on port ${PORT}`
  );
});
