// Supabase Edge Function: subscribe
// Receives { email, source } from the website pre-launch form.
//  1. Inserts the row into the `subscribers` table (anon-RLS insert).
//  2. Sends a branded thank-you email via Resend.
// Idempotent: duplicate emails return 200 with `{ duplicate: true }` so the
// frontend still shows a friendly message. Email is NOT re-sent on duplicates.

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDRESS = Deno.env.get("FROM_ADDRESS") ?? "onboarding@resend.dev";
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "Coworking Prilep";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const EMAIL_SUBJECT = "You're on the list — Coworking Prilep";

function emailHtml(): string {
  return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="dark light" />
  <title>You're on the list</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:'Inter',Arial,sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:48px 24px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#000000;">
          <tr>
            <td style="padding-bottom:32px;">
              <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:0.35em;color:#d8091d;text-transform:uppercase;font-weight:500;">
                Coworking Prilep
              </div>
              <div style="height:2px;background:#d8091d;width:48px;margin-top:8px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <h1 style="margin:0;font-family:'Bebas Neue',Impact,Arial,sans-serif;font-size:44px;line-height:0.95;letter-spacing:-0.005em;text-transform:uppercase;color:#ffffff;">
                You're on<br/><span style="color:#d8091d;">the list.</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;font-size:16px;line-height:1.65;color:rgba(255,255,255,0.85);">
              Thank you for signing up to be among the first to know about Coworking Prilep.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;font-size:16px;line-height:1.65;color:rgba(255,255,255,0.75);">
              We started building this because the city needed a proper space to work outside of home and the caf&eacute;s. Two floors, 300m&sup2;, an industrial design, a backyard, a quiet upper floor, and a meeting room. That's what we're building.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:8px;font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.3em;color:#d8091d;text-transform:uppercase;">
              What to expect
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.75);">
              <span style="color:#d8091d;">&bull;</span>&nbsp; Occasional updates as we build: renovation milestones, design decisions, small wins<br/>
              <span style="color:#d8091d;">&bull;</span>&nbsp; The opening email, the day we unlock the doors (target: late 2026)<br/>
              <span style="color:#d8091d;">&bull;</span>&nbsp; Priority access for memberships before public sign-up opens
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;font-size:16px;line-height:1.65;color:rgba(255,255,255,0.75);">
              If you have questions, want to bring a team in for a tour once the space is ready, or just want to chat, reply directly to this email. We read every message.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:48px;font-size:16px;line-height:1.65;color:#ffffff;">
              Talk soon,<br/>
              <span style="color:rgba(255,255,255,0.65);">The team at Coworking Prilep</span>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;letter-spacing:0.25em;color:rgba(255,255,255,0.4);text-transform:uppercase;">
              <a href="https://coworkingprilep.mk" style="color:#d8091d;text-decoration:none;">coworkingprilep.mk</a>
              &nbsp;&middot;&nbsp; Prilep, North Macedonia &nbsp;&middot;&nbsp; Opening 2026
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailText(): string {
  return `You're on the list. Coworking Prilep.

Thank you for signing up to be among the first to know about Coworking Prilep.

We started building this because the city needed a proper space to work outside of home and the cafés. Two floors, 300m², an industrial design, a backyard, a quiet upper floor, and a meeting room. That's what we're building.

What to expect:
• Occasional updates as we build: renovation milestones, design decisions, small wins
• The opening email, the day we unlock the doors (target: late 2026)
• Priority access for memberships before public sign-up opens

If you have questions, want to bring a team in for a tour once the space is ready, or just want to chat, reply directly to this email. We read every message.

Talk soon,
The team at Coworking Prilep

coworkingprilep.mk · Prilep, North Macedonia · Opening 2026
`;
}

async function sendEmail(to: string): Promise<{ ok: boolean; detail?: any }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_ADDRESS}>`,
        to: [to],
        subject: EMAIL_SUBJECT,
        html: emailHtml(),
        text: emailText(),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[resend]", res.status, detail);
      return { ok: false, detail };
    }
    return { ok: true };
  } catch (err) {
    console.error("[resend] threw", err);
    return { ok: false, detail: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const source = (body.source ?? "website").slice(0, 64);

  // RFC-light email shape check
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return json({ error: "Invalid email" }, 400);
  }

  // Service-role client bypasses RLS so we can detect duplicates cleanly.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase
    .from("subscribers")
    .insert({ email, source });

  if (error) {
    // 23505 = unique_violation → email already subscribed.
    if (error.code === "23505") {
      return json({ ok: true, duplicate: true });
    }
    console.error("[supabase insert]", error);
    return json({ error: "Could not save subscription" }, 500);
  }

  // Don't fail the request if the email send fails — the subscription is saved.
  // Email failures are logged for the Resend dashboard / function logs.
  const emailResult = await sendEmail(email);

  return json({
    ok: true,
    duplicate: false,
    emailSent: emailResult.ok,
  });
});
