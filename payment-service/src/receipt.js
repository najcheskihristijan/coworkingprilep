// Receipt email. The acquirer REQUIRES a confirmation/invoice to reach the
// customer immediately after every successful transaction, so this runs as part
// of the payment-return flow, not on a queue.
//
// Mirrors CWS/Legal/receipt-template.html (Потврда за уплата).

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const money = (n) =>
  Number(n).toLocaleString("mk-MK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function receiptHtml({ receiptNo, name, email, planName, amount, cardLast4, authCode, orderId, paidAt }) {
  const when = new Date(paidAt || Date.now()).toLocaleString("mk-MK", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const row = (k, v) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.12);font-family:'Courier New',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.5);width:45%">${k}</td>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:14px;color:#fff">${v}</td>
    </tr>`;

  return `<!doctype html><html lang="mk"><body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 20px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="font-family:'Courier New',monospace;font-size:12px;letter-spacing:.3em;color:#d8091d;text-transform:uppercase">Coworking Prilep</td></tr>
  <tr><td style="height:2px;background:#d8091d;width:46px"></td></tr>
  <tr><td style="padding:26px 0 6px;font-size:24px;font-weight:bold">Потврда за уплата</td></tr>
  <tr><td style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.2em;color:rgba(255,255,255,.45);text-transform:uppercase;padding-bottom:22px">Payment confirmation</td></tr>

  <tr><td style="background:#d8091d;padding:18px 22px">
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.85)">Успешна уплата</div>
    <div style="font-size:26px;font-weight:bold;margin-top:4px">${money(amount)} ден</div>
  </td></tr>

  <tr><td style="padding-top:22px"><table width="100%" cellpadding="0" cellspacing="0">
    ${row("Бр. на потврда / Receipt no.", esc(receiptNo))}
    ${row("Датум и време / Date &amp; time", esc(when))}
    ${row("Купувач / Customer", esc(name) + "<br><span style='color:rgba(255,255,255,.55);font-size:12px'>" + esc(email) + "</span>")}
    ${row("Опис / Description", esc(planName))}
    ${row("Начин / Payment method", "Картичка / Card" + (cardLast4 ? " · **** " + esc(cardLast4) : ""))}
    ${authCode ? row("Авторизација / Authorization", esc(authCode)) : ""}
    ${row("Трансакција / Transaction", esc(orderId))}
    ${row("Обработено преку / Processed via", "ProCredit Bank — Виртуелен ПОС")}
  </table></td></tr>

  <tr><td style="padding:24px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.7)">
    <strong style="color:#fff">ДАСТИАН ДОО Прилеп</strong> — Подружница БЛОК 02<br>
    ул. Јане Сандански бр.33, Прилеп<br>
    ЕДБ 4021025551046 · ЕМБС 7821808
  </td></tr>

  <tr><td style="padding:18px 0 0;font-size:12px;line-height:1.6;color:rgba(255,255,255,.55)">
    Не е во системот на ДДВ. / Not VAT-registered.<br>
    Фактура се издава на барање, одговорете на овој мејл.
  </td></tr>

  <tr><td style="border-top:1px solid rgba(255,255,255,.15);margin-top:20px;padding-top:18px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.2em;color:rgba(255,255,255,.4);text-transform:uppercase">
    Ви благодариме &nbsp;·&nbsp; coworkingprilep.mk
  </td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendReceipt(order) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${process.env.FROM_NAME || "Coworking Prilep"} <${process.env.FROM_ADDRESS}>`,
      to: [order.email],
      reply_to: "coworkingprilep@outlook.com",
      subject: `Потврда за уплата ${order.receiptNo} — Coworking Prilep`,
      html: receiptHtml(order),
    }),
  });

  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
