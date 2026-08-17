// ProCredit / Quipu E-Commerce Payment Gateway client.
// Spec: E-COMMERCE_Internet_Shop_Integration_v1.1
//
// Every call is mutual-TLS: our client certificate's CommonName must equal the
// MerchantID, or the gateway rejects the request. The private key lives on this
// server only and is never sent anywhere.

import https from "node:https";
import fs from "node:fs";
import tls from "node:tls";
import { URL } from "node:url";

let agent = null;

/** Build (once) the HTTPS agent carrying the client certificate. */
function mtlsAgent() {
  if (agent) return agent;
  const { PG_CERT_PATH, PG_KEY_PATH, PG_CA_PATH } = process.env;
  for (const [name, p] of Object.entries({ PG_CERT_PATH, PG_KEY_PATH, PG_CA_PATH })) {
    if (!p) throw new Error(`Missing env ${name}`);
    if (!fs.existsSync(p)) throw new Error(`Certificate file not found: ${p} (${name})`);
  }
  // The gateway's TLS certificate is issued by a PUBLIC CA (DigiCert), while
  // ca.pem is ProCredit's private CA that signed OUR CLIENT certificate.
  // Passing ca.pem alone would REPLACE Node's trust store and make every
  // request fail server verification, so append it to the public roots instead.
  agent = new https.Agent({
    cert: fs.readFileSync(PG_CERT_PATH),
    key: fs.readFileSync(PG_KEY_PATH),
    ca: [...tls.rootCertificates, fs.readFileSync(PG_CA_PATH, "utf8")],
    rejectUnauthorized: true,
    keepAlive: true,
  });
  return agent;
}

/** Minimal JSON-over-mTLS request helper. */
function request(method, urlString, body) {
  const url = new URL(urlString);
  const payload = body ? JSON.stringify(body) : null;

  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    agent: mtlsAgent(),
    headers: {
      Accept: "application/json",
      ...(payload
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          }
        : {}),
    },
    timeout: 20000,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          // Non-JSON body: surface it raw so the error is diagnosable.
          return reject(
            new Error(`Gateway returned non-JSON (HTTP ${res.statusCode}): ${data.slice(0, 300)}`)
          );
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`Gateway HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 300)}`)
          );
        }
        resolve(parsed);
      });
    });
    req.on("timeout", () => req.destroy(new Error("Gateway request timed out")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Create Order (spec 4.1). Returns { id, password, hppUrl, status }.
 * `amount` is a decimal string, e.g. "4920.00".
 */
export async function createOrder({ amount, currency, description, language, hppRedirectUrl, consumerDevice, clientIp }) {
  const body = {
    order: {
      typeRid: process.env.PG_TYPE_RID,
      amount,
      currency,
      description,
      language: language || "mk",
      hppRedirectUrl,
      initiationEnvKind: "Browser",
      consumerDevice: {
        browser: {
          javaEnabled: false,
          jsEnabled: true,
          acceptHeader: "application/json",
          ip: clientIp,
          ...(consumerDevice?.browser || {}),
        },
      },
    },
  };

  const res = await request("POST", process.env.PG_API_URL, body);
  const order = res?.order;
  if (!order?.id || !order?.password || !order?.hppUrl) {
    throw new Error(`Unexpected Create Order response: ${JSON.stringify(res).slice(0, 300)}`);
  }
  return { ...order, raw: res };
}

/**
 * Get Order Details (spec 4.2). This is the ONLY source of truth for whether
 * an order was actually paid. Never trust the browser redirect alone.
 */
export async function getOrder(id, password) {
  const base = new URL(process.env.PG_API_URL);
  const url = `${base.origin}${base.pathname.replace(/\/$/, "")}/${encodeURIComponent(id)}?password=${encodeURIComponent(password)}&tranDetailLevel=1&tokenDetailLevel=2`;
  const res = await request("GET", url);
  return { order: res?.order ?? res, raw: res };
}

/** Refund (spec 4.3). Amount optional: omit for a full refund. */
export async function refundOrder(id, password, amount) {
  const base = new URL(process.env.PG_API_URL);
  const url = `${base.origin}${base.pathname.replace(/\/$/, "")}/${encodeURIComponent(id)}/refund?password=${encodeURIComponent(password)}`;
  return request("POST", url, amount ? { refund: { amount } } : {});
}

/** Build the Hosted Payment Page URL the customer is redirected to (spec 4.1.3). */
export function buildHppUrl(hppUrl, id, password) {
  const u = new URL(hppUrl);
  u.searchParams.set("id", String(id));
  u.searchParams.set("password", String(password));
  return u.toString();
}

/** Treat only these gateway statuses as "money captured". */
export function isPaid(status) {
  return ["Paid", "Completed", "Success", "Successful", "Approved"].includes(String(status));
}
