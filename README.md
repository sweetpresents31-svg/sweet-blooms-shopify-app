# Sweet Blooms Shopify App

Starter project for the Sweet Blooms embedded Shopify experience.

## Included now
- Sweet Blooms dashboard
- Flower catalog
- Add flower name, price, stock and image URL
- Mark flowers available/hidden
- Bouquet builder with recipient name
- Customer selection of up to 10 stems
- Live bouquet preview and total
- Placeholder for order management

## Local run
1. Install Node.js 20+.
2. Run `npm install`
3. Run `npm run dev`
4. Open the Vite URL shown in the terminal.

## Production
Run:
- `npm install`
- `npm run build`
- `npm start`

Your hosting provider should run `npm start` and expose the `PORT` environment variable.

## Shopify connection
This starter intentionally does **not** contain private API keys or secrets.
Use `.env.example` as a guide and never commit `.env`.

The next phase is adding Shopify OAuth/Admin API so the app can read/write actual Shopify products, inventory and orders.
