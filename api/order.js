import { MIN_ORDER } from "../src/data/constants.js";
import { PRODUCTS } from "../src/data/burr-data.js";

const TO_EMAIL = process.env.ORDER_TO_EMAIL || "tpolegat@gmail.com";

// Серверный прайс: цена берётся по артикулу с сервера, а не из тела запроса,
// чтобы клиент не мог прислать произвольную цену (см. отчёт, п.2).
const PRICE_BY_CODE = Object.fromEntries(PRODUCTS.map((p) => [p.code, p.price]));

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

    const items = rawItems.map((i) => {
      const code = clean(i.code, 80);
      // Цена строго с сервера по артикулу; если кода нет — 0 (в заказ не пройдёт по min).
      const price = PRICE_BY_CODE[code] ?? 0;
      return {
        name_ua: clean(i.name_ua, 200),
        name_ru: clean(i.name_ru, 200),
        code,
        headD:   Number(i.headD) || null,
        headL:   Number(i.headL) || null,
        price,
        qty:     Math.min(9999, Math.max(1, Math.floor(Number(i.qty) || 1))),
      };
    });

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
