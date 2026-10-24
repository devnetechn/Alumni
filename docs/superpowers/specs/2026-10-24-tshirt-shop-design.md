# T-shirt Shop — Design

Approved by the owner in chat on 2026-10-24.

## Goal
Let anyone (no account) order the association's T-shirt, paying online via PayMongo. Admin controls price, fee, sizes and fulfillment.

## Public
- Header link `Shop` and a homepage band both open `/shop`.
- `/shop`: product photo, name, description, price, order form (name, email, mobile, size, quantity; address only when fulfillment is `delivery`), live breakdown (subtotal, fee, total). Submit creates an unpaid order and redirects to PayMongo checkout.
- `/shop/thanks?order=<token>`: polls order status; shows "Thank you" once paid.
- Shop disabled or no price set: `/shop` shows "not available"; homepage band hidden.

## Money
- Admin stores `price` (centavos) and `fee_percent` (default 2).
- `subtotal = price * quantity`; `total = ceil(subtotal / (1 - fee_percent/100))`; `fee = total - subtotal`. The association nets the subtotal after PayMongo's fee.
- Server computes everything; client values are never trusted.

## Admin (`/admin/shop`)
- Settings: enabled, product name, description, image, price, fee %, sizes, fulfillment (`pickup` | `delivery`), pickup info.
- Orders list: customer, size, qty, total, contact, address, payment status (unpaid/paid), fulfilled toggle.

## Payment
- Order saved `unpaid` with a random `session_token`. Checkout metadata `{kind:'shop', school_id, session_token}`. Existing webhook marks `paid` on `checkout_session.payment.paid`. Payment methods from `PAYMONGO_PAYMENT_METHODS`.

## Non-goals
Multiple products, stock counts, shipping fees, refunds, order emails.

## Revision (2026-10-24, owner request)
The admin needs an "Add T-shirt" button, so the shop supports several T-shirts: a `shop_products` table (name, description, image, price, sizes, active), while `shop_settings` keeps only shop-wide values (enabled, fee %, pickup/delivery, pickup info). Orders store the chosen `product_id` and a `product_name` snapshot. This supersedes the "one design" non-goal above.
