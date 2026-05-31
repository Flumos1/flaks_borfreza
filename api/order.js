const MIN_ORDER = 2000;
const TO_EMAIL = process.env.ORDER_TO_EMAIL || "tpolegat@gmail.com";

function clean(v, max) {
  if (!v) return "";
  return String(v).trim().slice(0, max);
}

function money(n) {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function formatMessage(order) {
  const c = order.customer;
  const lang = order.language;
  const lines = [
    `🛒 <b>Нове замовлення FLAKS</b>`,
    ``,
    `👤 ${c.name || "—"}`,
    `📞 ${c.phone}`,
    c.email  ? `📧 ${c.email}`  : null,
    c.city   ? `📍 ${c.city}`   : null,
    c.comment? `💬 ${c.comment}`: null,
    ``,
    `<b>Товари:</b>`,
    ...order.items.map((i) => {
      const name = lang === "ua" ? i.name_ua : i.name_ru;
      const dim  = i.headD ? ` Ø${i.headD}×${i.headL}` : "";
      const code = i.code  ? ` (${i.code})`             : "";
      return `• ${name}${code}${dim} — ${i.qty} шт. × ${money(i.price)} = ${money(i.price * i.qty)} грн`;
    }),
    ``,
    `💰 <b>Разом: ${money(order.total)} грн</b>`,
    ``,
    `🕐 ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kiev" })}`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

function formatEmail(order) {
  const c = order.customer;
  const lang = order.language;
  const itemLines = order.items.map((i) => {
    const name = lang === "ua" ? i.name_ua : i.name_ru;
    const dim  = i.headD ? ` Ø${i.headD}×${i.headL}` : "";
    return `  • ${name}${i.code ? " (" + i.code + ")" : ""}${dim} — ${i.qty} шт. × ${money(i.price)} = ${money(i.price * i.qty)} грн`;
  });
  return [
    "=== НОВЕ ЗАМОВЛЕННЯ FLAKS ===",
    "",
    `Ім'я:     ${c.name    || "—"}`,
    `Телефон:  ${c.phone}`,
    `Email:    ${c.email   || "—"}`,
    `Місто:    ${c.city    || "—"}`,
    `Коментар: ${c.comment || "—"}`,
    "",
    "Товари:",
    ...itemLines,
    "",
    `Разом: ${money(order.total)} грн`,
    "",
    new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kiev" }),
  ].join("\n");
}

async function sendTelegram(order) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { skipped: true };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatMessage(order).slice(0, 4096),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Telegram ${res.status}: ${txt}`);
  }
  return { ok: true };
}

async function sendEmail(order) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true };

  const c    = order.customer;
  const subj = `FLAKS: замовлення ${order.items.length} поз. на ${money(order.total)} грн — ${c.phone}`;
  const body = formatEmail(order);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:     process.env.RESEND_FROM || "FLAKS <onboarding@resend.dev>",
      to:       [TO_EMAIL],
      reply_to: c.email || undefined,
      subject:  subj,
      text:     body,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend ${res.status}: ${txt}`);
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // parse body
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }

  // validate
  const phone = clean(body?.customer?.phone, 80);
  if (!phone) return res.status(400).json({ error: "Phone is required" });

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return res.status(400).json({ error: "Cart is empty" });

  const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
  if (total < MIN_ORDER) return res.status(400).json({ error: `Minimum order is ${MIN_ORDER} UAH` });

  const order = {
    language: body.language === "ru" ? "ru" : "ua",
    customer: {
      name:    clean(body.customer?.name,    140),
      phone,
      email:   clean(body.customer?.email,   140),
      city:    clean(body.customer?.city,    140),
      comment: clean(body.customer?.comment, 1200),
    },
    items: items.map((i) => ({
      name_ua: clean(i.name_ua, 200),
      name_ru: clean(i.name_ru, 200),
      code:    clean(i.code,    80),
      headD:   i.headD || null,
      headL:   i.headL || null,
      price:   Number(i.price) || 0,
      qty:     Math.max(1, Math.floor(Number(i.qty) || 1)),
    })),
    total,
  };

  const results = {};

  try { results.telegram = await sendTelegram(order); }
  catch (e) { results.telegram = { error: e.message }; }

  try { results.email = await sendEmail(order); }
  catch (e) { results.email = { error: e.message }; }

  const delivered =
    results.telegram?.ok || results.email?.ok;

  if (!delivered) {
    console.error("Order delivery failed:", JSON.stringify(results));
    return res.status(500).json({ error: "Failed to deliver order. Please contact us directly." });
  }

  return res.status(200).json({ ok: true, results });
};
