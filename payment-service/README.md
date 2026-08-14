# Payment service — Coworking Prilep

Card payments via the ProCredit / Quipu E-Commerce Payment Gateway.
Spec: `E-COMMERCE_Internet_Shop_Integration_v1.1`.

## Why it isn't in the Astro site

The Astro site is static. This service exists because the gateway needs:

1. **mTLS** — a client certificate whose CommonName equals the MerchantID. The
   private key must sit on a server we control and never travel.
2. **A stable egress IP** — the VPS is `149.28.224.92`, already registered with
   the bank. Supabase Edge Functions have rotating IPs, so they're unsuitable.

Card data is entered on the bank's **Hosted Payment Page**, never on our site.

## Flow

```
/checkout          POST /api/pay ──mTLS──▶ Create Order
                                  ◀────── { id, password, hppUrl }
browser  ─── redirect to hppUrl?id=..&password=.. ──▶ bank's payment page
                                  (customer enters card at the bank)
bank ─── redirect ──▶ GET /api/pay/return?ref=N
                       └─mTLS─▶ Get Order Details   ← the ONLY proof of payment
                       └─ store order + send receipt email (mandatory)
                       └─ redirect to /checkout/success or /checkout/failed
```

The browser redirect is never trusted on its own; payment is confirmed only by
re-querying the gateway.

## Prices

Amounts come from `src/plans.js` on the server. The browser sends only a plan
slug, so a tampered client can't choose its own price. Keep `src/plans.js` in
sync with `../src/data/plans.ts`.

## Deploy (Coolify)

Separate app in the same project, from this directory.

1. **Certificates** — put `cert.pem`, `key.pem`, `ca.pem` in a host directory,
   e.g. `/opt/cws/certs`, `chmod 600`. Mount it read-only at `/certs`.
   Never bake certs into the image, never commit them.
2. **Env** — copy `.env.example` and fill in. `SUPABASE_SERVICE_ROLE_KEY` and
   `RESEND_API_KEY` are secrets.
3. **Routing** — proxy `https://coworkingprilep.mk/api/pay*` to this service so
   the site and the payment endpoints share an origin.
4. **Enable checkout** — set `PAY_ENDPOINT = "/api/pay"` in
   `src/pages/checkout.astro`, rebuild, redeploy the site.

Health check: `GET /health`.

## Going live

- [ ] Bank returns a `cert.pem` matching our `key.pem` (**currently blocked**)
- [ ] Confirm `PG_TYPE_RID` — email said `1`, doc says `"ORD1"`, portal shows `Order_General`
- [ ] Terminal `URL` field is `undefined` in the portal; register `https://coworkingprilep.mk`
- [ ] Confirm MKD amounts in `plans.js` with accounting
- [ ] Test each card the bank supplied; check orders land in Supabase and receipts send
- [ ] Swap test cert + `PG_API_URL` for production values, re-verify
- [ ] Confirm MCC (currently `5399`) is right for a coworking space
