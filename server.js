import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "flowers.json");

app.use(cors());
app.use(express.json({ limit: "2mb" }));

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "Sweet Blooms Shopify App" });
});

app.get("/api/flowers", (_req, res) => {
  res.json(readFlowers());
});

app.post("/api/flowers", (req, res) => {
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

app.patch("/api/flowers/:id", (req, res) => {
  const flowers = readFlowers();
  const index = flowers.findIndex((f) => f.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Flower not found." });

  flowers[index] = { ...flowers[index], ...req.body, id: flowers[index].id };
  if (req.body.price !== undefined) flowers[index].price = Number(req.body.price);
  if (req.body.stock !== undefined) flowers[index].stock = Number(req.body.stock) || 0;
  writeFlowers(flowers);
  res.json(flowers[index]);
});

app.delete("/api/flowers/:id", (req, res) => {
  const flowers = readFlowers();
  const next = flowers.filter((f) => f.id !== req.params.id);
  if (next.length === flowers.length) {
    return res.status(404).json({ error: "Flower not found." });
  }
  writeFlowers(next);
  res.status(204).end();
});

// In production, serve the Vite build from /dist.
const dist = path.join(__dirname, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Sweet Blooms app running on port ${PORT}`);
});
