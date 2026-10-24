# T-shirt Shop Implementation Plan

> For agentic workers: use superpowers:executing-plans.

**Goal:** Public T-shirt ordering with PayMongo checkout and admin control.
**Architecture:** Two new tables (`shop_settings`, `shop_orders`), one route file `routes/shop.js`, a `computeTotals` helper, webhook branch `kind:'shop'`, three frontend pages.
**Tech Stack:** Express/Postgres RLS, Jest+supertest, React/Tailwind.
**Spec:** `docs/superpowers/specs/2026-10-24-tshirt-shop-design.md`

## Global Constraints
- Money in integer centavos. `total = ceil(subtotal / (1 - fee/100))`.
- Tables follow the `tenant_isolation` RLS + GRANT pattern in `migrations_premium.sql`.
- No commits until the owner says "commit".

## Review Focus
- Tampered client totals/prices are ignored.
- Size not in admin's list, quantity < 1 or > 20, bad email/mobile are rejected.
- Delivery requires address; pickup does not.
- Duplicate webhook delivery stays idempotent.

### Task 1: Migration + computeTotals
Files: `db/migrations_premium.sql`, `src/lib/shop.js`, `tests/shop.test.js`, `tests/helpers.js` (TRUNCATE adds shop tables), `tests/schema.test.js` (tables).
- `computeTotals(price, quantity, feePercent) -> {subtotal, fee, total}`.
- Tests: ₱300×1 @2% → 30612 total; fee 0 → total = subtotal; ceil on odd values.

### Task 2: Shop API
Files: `src/routes/shop.js`, `src/server.js` (mount `/api/shop`), `tests/shop.test.js`.
- `GET /` public: settings or disabled defaults. `PUT /settings` admin. `POST /orders` public (validations, createCheckoutSession mocked in tests, returns `{checkoutUrl, orderToken}`). `GET /orders/:token/status` public. `GET /orders`, `PATCH /orders/:id` (fulfilled) admin.

### Task 3: Webhook
Files: `src/routes/paymentsWebhook.js`, `tests/shop.test.js`.
- `kind:'shop'` marks order paid; idempotent.

### Task 4: Frontend
Files: `pages/Shop.jsx`, `pages/ShopThanks.jsx`, `pages/AdminShop.jsx`, `components/home/ShopBand.jsx`, `App.jsx`, `PublicLayout.jsx` (Shop link), `PublicHome.jsx`.
- Verify: eslint on new files, `npm run build`, browser smoke on dev server.
