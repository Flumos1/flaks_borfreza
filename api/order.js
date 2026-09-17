import { MIN_ORDER, MAX_ORDER_QTY } from "../src/data/constants.js";
import { PRODUCTS } from "../src/data/burr-data.js";

const TO_EMAIL = process.env.ORDER_TO_EMAIL || "tpolegat@gmail.com";

// Серверный прайс: цена берётся по артикулу с сервера, а не из тела запроса,
// чтобы клиент не мог прислать произвольную цену (см. отчёт, п.2).
const PRODUCT_BY_CODE = new Map(PRODUCTS.map((p) => [p.code, p]));

// Разрешённые источники запроса (защита от кросс-сайтового спама, п.3).
// Пускаем боевой домен, любые превью-деплои *.vercel.app и localhost.
function isAllowedHost(host) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "borfrezy.in.ua" ||
    host.endsWith(".borfrezy.in.ua") ||
    host.endsWith(".vercel.app")
  );
}

// Управляющие символы (кроме \t и \n) — вырезаем из пользовательского ввода.
const CTRL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function clean(v, max) {
  if (!v) return "";
  return String(v).replace(CTRL_CHARS, "").trim().slice(0, max);
}

// Экранирование для Telegram parse_mode:"HTML" (п.1 — иначе HTML-инъекция).
function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function money(n) {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function originAllowed(req) {
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin) return true; // запрос без Origin (server-to-server, curl) не блокируем
  try {
    return isAllowedHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function formatMessage(order) {
  const c = order.customer;
  const lang = order.language;
  if (order.type === "lead") {
    return [
      `📝 <b>Нова заявка з сайту FLAKS</b>`,
      ``,
      `👤 ${escHtml(c.name) || "—"}`,
      `📞 ${escHtml(c.phone)}`,
      c.comment ? `💬 ${escHtml(c.comment)}` : null,
      ``,
      `🕐 ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}`,
    ].filter((l) => l !== null).join("\n");
  }
  const lines = [
    `🛒 <b>Нове замовлення FLAKS</b>`,
    ``,
    `👤 ${escHtml(c.name) || "—"}`,
    `📞 ${escHtml(c.phone)}`,
    c.email  ? `📧 ${escHtml(c.email)}`  : null,
    c.city   ? `📍 ${escHtml(c.city)}`   : null,
    c.comment? `💬 ${escHtml(c.comment)}`: null,
    ``,
    `<b>Товари:</b>`,
    ...order.items.map((i) => {
      const name = lang === "ua" ? i.name_ua : i.name_ru;
      const dim  = i.headD ? ` Ø${i.headD}×${i.headL}` : "";
      const code = i.code  ? ` (${escHtml(i.code)})`   : "";
      return `• ${escHtml(name)}${code}${dim} — ${i.qty} шт. × ${money(i.price)} = ${money(i.price * i.qty)} грн`;
    }),
    ``,
    `💰 <b>Разом: ${money(order.total)} грн</b>`,
    ``,
    `🕐 ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

function formatEmail(order) {
  const c = order.customer;
  const lang = order.language;
  if (order.type === "lead") {
    return [
      "=== НОВА ЗАЯВКА FLAKS ===",
      "",
      `Ім'я:     ${c.name    || "—"}`,
      `Телефон:  ${c.phone}`,
      `Запит:    ${c.comment || "—"}`,
      "",
      new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }),
    ].join("\n");
  }
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
    new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }),
  ].join("\n");
}

async function sendTelegram(order) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { skipped: true };

  // Split only between complete lines: slicing HTML can lose products, the total,
  // or a closing tag and make Telegram reject a large order altogether.
  const chunks = [];
  let chunk = "";
  const lines = formatMessage(order).split("\n").flatMap((line) => {
    if (line.length <= 4000) return [line];
    // An escaped customer comment can exceed the limit; preserve HTML entities.
    const parts = [];
    let part = "";
    for (const token of line.match(/&(?:amp|lt|gt);|[\s\S]/gu)) {
      if (part.length + token.length > 4000) { parts.push(part); part = ""; }
      part += token;
    }
    if (part) parts.push(part);
    return parts;
  });
  for (const line of lines) {
    if (chunk && chunk.length + line.length + 1 > 4000) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += (chunk ? "\n" : "") + line;
  }
  if (chunk) chunks.push(chunk);
  for (const text of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Telegram ${res.status}: ${txt}`);
    }
  }
  return { ok: true };
}

async function sendEmail(order) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true };

  const c    = order.customer;
  const subj = order.type === "lead"
    ? `FLAKS: заявка з сайту — ${c.phone}`
    : `FLAKS: замовлення ${order.items.length} поз. на ${money(order.total)} грн — ${c.phone}`;
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
      // reply_to ставим только если email прошёл валидацию (п.5).
      reply_to: c.email && isValidEmail(c.email) ? c.email : undefined,
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

  if (!originAllowed(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // parse body
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }
  // п.4 — тело может прийти как null/число/массив; дальше нужен объект.
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid body" });
  }

  // Honeypot: скрытое поле, которое заполняют только боты (п.3).
  if (clean(body.company, 100)) {
    return res.status(200).json({ ok: true }); // тихо игнорируем спам
  }

  // validate
  const phone = clean(body.customer?.phone, 80);
  if (!phone) return res.status(400).json({ error: "Phone is required" });

  const language = body.language === "ru" ? "ru" : "ua";
  const isLead = body.type === "lead";

  const customer = {
    name:    clean(body.customer?.name,    140),
    phone,
    email:   clean(body.customer?.email,   140),
    city:    clean(body.customer?.city,    140),
    comment: clean(body.customer?.comment, 1200),
  };

  let order;
  if (isLead) {
    order = { type: "lead", language, customer };
  } else {
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) return res.status(400).json({ error: "Cart is empty" });

    if (rawItems.length > PRODUCTS.length) return res.status(400).json({ error: "Too many items" });
    const items = [];
    const codes = new Set();
    for (const item of rawItems) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return res.status(400).json({ error: "Invalid item" });
      }
      const product = PRODUCT_BY_CODE.get(item.code);
      if (!product) return res.status(400).json({ error: "Unknown product" });
      if (codes.has(product.code)) return res.status(400).json({ error: "Duplicate product" });
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > MAX_ORDER_QTY) {
        return res.status(400).json({ error: "Invalid quantity" });
      }
      codes.add(product.code);
      // All product details, including the price, come from the server catalog.
      const { code, name_ua, name_ru, headD, headL, price } = product;
      items.push({ code, name_ua, name_ru, headD, headL, price, qty: item.qty });
    }

    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    if (total < MIN_ORDER) return res.status(400).json({ error: `Minimum order is ${MIN_ORDER} UAH` });

    order = { type: "order", language, customer, items, total };
  }

  const results = {};

  try { results.telegram = await sendTelegram(order); }
  catch (e) { results.telegram = { error: e.message }; }

  try { results.email = await sendEmail(order); }
  catch (e) { results.email = { error: e.message }; }

  const delivered = results.telegram?.ok || results.email?.ok;

  if (!delivered) {
    // Детали ошибок пишем в лог, но НЕ отдаём клиенту (п.6).
    console.error("Order delivery failed:", JSON.stringify(results));
    return res.status(500).json({ error: "Failed to deliver order. Please contact us directly." });
  }

  return res.status(200).json({ ok: true });
}
