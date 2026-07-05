# FLAKS · Борфрези — сайт-каталог

Двомовний (UA/RU) сайт-каталог твердосплавних **борфрез (шарошок) ВК** у фірмовому
стилі FLAKS: темна індустріальна тема, помаранчевий акцент.

- **Стек:** Vite 6 + React 18 (ES-модулі, збірка в `dist/`). НЕ CDN/Babel.
- **Бойовий домен:** <https://borfrezy.in.ua> — хостинг Vercel, автодеплой з гілки `main`.
- **Каталог:** 80 SKU, 16 форм головки (A C D E F G H J K L M N S T U Y).

---

## 🗂 Структура

| Шлях | Призначення |
|---|---|
| `index.html` | Точка входу (`<head>`, SEO-мета, JSON-LD) → `src/main.jsx` → `src/App.jsx` |
| `src/App.jsx` | Увесь застосунок: шапка, герой, селектор форм, гід, каталог, кошик, модалка, контакти, підвал |
| `src/data/burr-data.js` | **Дані каталогу**: `SHAPES`, `CUTS`, `PRODUCTS` (80 SKU) і `STRINGS` (усі рядки UA+RU) |
| `src/data/constants.js` | Спільні константи (`MIN_ORDER`) для фронтенду й API |
| `src/components/BurrShape.jsx` | SVG-схеми профілів 16 форм головки |
| `src/motion/motion.jsx` | Анімація: `Reveal`, `CountUp`, `RingSeal` (поважає `prefers-reduced-motion`) |
| `src/tweaks/tweaks-panel.jsx` | Панель «Tweaks» (лише в dev) |
| `src/styles/` | `colors_and_type.css` (токени дизайн-системи) + `app.css` |
| `api/order.js` | Serverless-функція Vercel: приймає замовлення/заявку, шле в Telegram і на пошту |
| `public/borfrezy/` | 17 статичних SEO-лендингів (хаб + 16 форм) — генеруються скриптом |
| `public/articles/` | 5 статичних статей (двомовні через JS `content-ua`/`content-ru`) |
| `public/feed.xml` | Google Merchant Center фід — генерується скриптом |
| `public/sitemap.xml`, `public/robots.txt` | SEO (тримати синхронними з реальними сторінками) |
| `vite.config.js` | Кастомний `cssPreloadPlugin` (preload CSS для LCP) — не видаляти |

---

## ▶️ Скрипти (`package.json`)

```bash
npm install          # встановити залежності
npm run dev          # локальний дев-сервер Vite → http://localhost:5173
npm run build        # продакшн-збірка → dist/
npm run preview      # локальний перегляд dist/ → http://localhost:4173
npm run feed         # згенерувати public/feed.xml з PRODUCTS
npm run landings     # згенерувати SEO-лендинги public/borfrezy/ з SHAPES/PRODUCTS
```

> **Після зміни цін/товарів у `src/data/burr-data.js`** запускай
> `npm run feed && npm run landings` — у фіді й лендингах дані закешовані.
> За потреби онови `public/sitemap.xml` вручну.

---

## ⚙️ Функціонал

- Каталог 80 позицій: реальні артикули, ціни, наявність, фото.
- Вибір за формою → миттєва фільтрація; блок «Як підібрати борфрезу».
- Каталог: таблиця/картки, пошук, сортування, картка товару зі специфікацією.
- **Кошик → оформлення замовлення** через `POST /api/order` (Telegram + e-mail).
- Форма заявки в блоці «Контакти» — теж через `/api/order` (тип `lead`).
- Перемикач мови **UA ↔ RU**.

---

## 📨 Прийом замовлень — `api/order.js`

Функція приймає `POST /api/order` і надсилає повідомлення менеджеру. Канали
вмикаються змінними оточення (Vercel → Project → Settings → Environment Variables):

| Змінна | Призначення |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота (BotFather) |
| `TELEGRAM_CHAT_ID` | ID чату/групи, куди слати замовлення |
| `RESEND_API_KEY` | Ключ [Resend](https://resend.com) для e-mail |
| `RESEND_FROM` | Адреса відправника (за замовч. `onboarding@resend.dev`) |
| `ORDER_TO_EMAIL` | Куди слати лист (за замовч. `tpolegat@gmail.com`) |

Достатньо налаштувати **хоча б один** канал. Захист: ціни рахуються на сервері
за артикулом, поля екрануються для Telegram, є honeypot і перевірка Origin.

---

## 📞 Контакти (константи у `src/App.jsx`, верх файлу)

| Що | Значення |
|---|---|
| Телефон | `+38 (067) 545-31-15` (`PHONE_RAW`) |
| E-mail | `tpolegat@gmail.com` (`EMAIL`) |
| Telegram | `TG_LINK` → t.me/+380675453115 |

---

## 🎨 Дизайн-система

Строго **FLAKS Design System**: токени в `src/styles/colors_and_type.css`.
Помаранчевий акцент `#e85d04` / hover `#ff7c2a`; зелений `#25d366` — тільки
Telegram/WhatsApp. Шрифти: Bebas Neue (заголовки) + Roboto Condensed (текст),
грузяться async. Нові кольори/шрифти не вигадувати.

---

© 2025–2026 FLAKS · Харків · Твердосплавний інструмент
