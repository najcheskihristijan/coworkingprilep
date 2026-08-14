// Coworking Prilep payment service.
//
// Runs on the VPS (not Supabase Edge Functions) for two reasons:
//   1. it must hold the mTLS private key, and
//   2. the gateway may whitelist our static IP.
//
// The Astro site stays fully static and calls this over CORS.

import http from "node:http";
import { randomUUID } from "node:crypto";
import { createOrder, getOrder, buildHppUrl, isPaid } from "./gateway.js";
import { sendReceipt } from "./receipt.js";
import { plans } from "./plans.js";

const PORT = Number(process.env.PORT || 8080);
const SITE_URL = process.env.SITE_URL || "https://coworkingprilep.mk";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || SITE_URL;

// ---------- Supabase (REST, service role) ----------
async function sb(path, init = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

// ---------- helpers ----------
const json = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  });
  res.end(JSON.stringify(body));
};

const redirect = (res, to) => {
  res.writeHead(302, { Location: to });
  res.end();
};

const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.socket.remoteAddress ||
  "127.0.0.1";

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => {
      d += c;
      if (d.length > 1e6) req.destroy(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ""));

// ---------- POST /api/pay ----------
async function handlePay(req, res) {
  const body = await readBody(req);

  // Price comes from OUR catalogue, never from the browser. A client that posts
  // its own amount must not be able to set what it pays.
  const plan = plans.find((p) => p.slug === body.plan && p.purchasable);
  if (!plan) return json(res, 400, { error: "Unknown plan" });
  if (!validEmail(body.email)) return json(res, 400, { error: "Valid email required" });
  if (!String(body.name || "").trim()) return json(res, 400, { error: "Name required" });

  const amount = plan.mkd.toFixed(2);
  const ref = randomUUID();

  const row = (
    await sb("orders", {
      method: "POST",
      body: JSON.stringify({
        plan_slug: plan.slug,
        amount_mkd: amount,
        currency: "MKD",
        customer_name: String(body.name).trim().slice(0, 120),
        customer_email: String(body.email).trim().toLowerCase(),
        status: "created",
      }),
    })
  )[0];

  try {
    const order = await createOrder({
      amount,
      currency: "MKD",
      description: `${plan.name} — Coworking Prilep`,
      language: body.language || "mk",
      hppRedirectUrl: `${SITE_URL.replace(/\/$/, "")}/api/pay/return?ref=${row.id}`,
      consumerDevice: body.consumerDevice,
      clientIp: clientIp(req),
    });

    await sb(`orders?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        pg_order_id: String(order.id),
        pg_password: order.password,
        pg_status: order.status,
        status: "pending",
        raw_create: order.raw,
      }),
    });

    return json(res, 200, { redirectUrl: buildHppUrl(order.hppUrl, order.id, order.password) });
  } catch (err) {
    await sb(`orders?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "failed", raw_result: { error: String(err.message) } }),
    }).catch(() => {});
    console.error("[create-order]", err);
    return json(res, 502, { error: "Could not start payment" });
  }
}

// ---------- GET /api/pay/return ----------
// The customer lands here after the bank's Hosted Payment Page. The redirect
// itself proves nothing, so we re-query the gateway before delivering anything.
async function handleReturn(req, res, url) {
  const ref = url.searchParams.get("ref");
  if (!ref) return redirect(res, `${SITE_URL}/checkout`);

  const rows = await sb(`orders?id=eq.${encodeURIComponent(ref)}&select=*`);
  const order = rows?.[0];
  if (!order) return redirect(res, `${SITE_URL}/checkout`);

  // Already settled: don't re-send the receipt on a refresh.
  if (order.status === "paid") return redirect(res, `${SITE_URL}/checkout/success?ref=${ref}`);

  try {
    const { order: pg, raw } = await getOrder(order.pg_order_id, order.pg_password);
    const paid = isPaid(pg?.status);

    const patch = {
      pg_status: pg?.status ?? null,
      raw_result: raw,
      status: paid ? "paid" : "failed",
      ...(paid ? { paid_at: new Date().toISOString() } : {}),
      auth_code: pg?.authCode ?? pg?.approvalCode ?? null,
      card_last4: String(pg?.maskedPan ?? pg?.pan ?? "").slice(-4) || null,
    };

    if (paid) patch.receipt_no = `CWP-${new Date().getFullYear()}-${String(order.id).padStart(4, "0")}`;

    await sb(`orders?id=eq.${order.id}`, { method: "PATCH", body: JSON.stringify(patch) });

    if (!paid) return redirect(res, `${SITE_URL}/checkout/failed?ref=${ref}`);

    // Mandatory: confirmation must reach the customer immediately. A failure
    // here must not lose the payment, so we log and still show success.
    try {
      const planName = plans.find((p) => p.slug === order.plan_slug)?.name || order.plan_slug;
      await sendReceipt({
        receiptNo: patch.receipt_no,
        name: order.customer_name,
        email: order.customer_email,
        planName,
        amount: order.amount_mkd,
        cardLast4: patch.card_last4,
        authCode: patch.auth_code,
        orderId: order.pg_order_id,
        paidAt: patch.paid_at,
      });
      await sb(`orders?id=eq.${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ receipt_sent_at: new Date().toISOString() }),
      });
    } catch (mailErr) {
      console.error("[receipt-email] FAILED — send manually:", order.id, mailErr);
    }

    return redirect(res, `${SITE_URL}/checkout/success?ref=${ref}`);
  } catch (err) {
    console.error("[pay-return]", err);
    return redirect(res, `${SITE_URL}/checkout/failed?ref=${ref}`);
  }
}

// ---------- router ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") return json(res, 204, {});
  if (url.pathname === "/health") return json(res, 200, { ok: true });

  try {
    if (req.method === "POST" && url.pathname === "/api/pay") return await handlePay(req, res);
    if (req.method === "GET" && url.pathname === "/api/pay/return") return await handleReturn(req, res, url);
    return json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[unhandled]", err);
    return json(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, () => console.log(`payment-service listening on :${PORT}`));
