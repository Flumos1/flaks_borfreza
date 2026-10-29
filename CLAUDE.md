# CLAUDE.md — контекст проєкту для Claude Code

## Що це
Сайт-каталог твердосплавних борфрез (шарошок) у фірмовому стилі FLAKS.
Двомовний UA/RU. Бойовий домен — **https://borfrezy.in.ua** (Vercel, автодеплой з гілки `main`).

## Архітектура
- **Vite 6 + React 18**, ES-модулі (НЕ CDN/Babel). Точка входу — `index.html` → `src/main.jsx` → `src/App.jsx`;
  `ua/index.html` і `ru/index.html` — окремі входи збірки для `/ua/` і `/ru/` (звідси імена чанків `main-*`).
- `api/order.js` — прийом замовлень/заявок (ціна й наявність лише з серверного каталогу) → Telegram Bot API + Resend.
- `middleware.js` — 308-редирект старих `?lang=ua|ru` URL на `/ua/`, `/ru/`.
- `src/App.jsx` — увесь застосунок (каталог-SPA, кошик, модалки).
- `src/data/burr-data.js` — дані каталогу.
- `src/styles/` — CSS (`colors_and_type.css` — токени дизайн-системи, `app.css`).
- `src/components/`, `src/motion/`, `src/tweaks/` — допоміжні модулі.
- `vite.config.js` — є кастомний `cssPreloadPlugin` (інжектить preload для CSS, покращує LCP). Не видаляти.
- Збірка → `dist/` (JS/CSS/зображення кладуться в `dist/assets/`).

## Дані
`src/data/burr-data.js` експортує `SHAPES` (16 форм головки), `CUTS`, `PRODUCTS`
(80 SKU) і `STRINGS` (усі рядки інтерфейсу UA+RU). Уся текстівка — там.

## Скрипти (package.json)
- `npm run dev` — локальний дев-сервер Vite (http://localhost:5173).
- `npm run build` — продакшн-збірка в `dist/`; `prebuild` спершу ганяє `npm run seo`.
- `npm run seo` — landings → products → feed → sitemap → `check:seo` (перевірка узгодженості цін, URL, hreflang).
- `npm test` — тести API/кошика (`tests/*.test.js`).
- `npm run preview` — локальний перегляд `dist/` (порт 4173).
- Аудит: `node scripts/check-live.mjs` (товарні сторінки на проді), `node scripts/crawl-sitemap.mjs`
  (усі URL sitemap: canonical/hreflang/JSON-LD); `scripts/gsc-audit.mjs`, `scripts/merchant-audit.mjs` — потрібен `secrets/` (OAuth, не в git).

> Генеровані файли (`public/{,ua/,ru/}borfrezy/`, `feed.xml`, `sitemap.xml`) руками не правити —
> лише генератори в `scripts/`. Збірка детермінована: повторний `npm run seo` не змінює жодного байта.

## SEO / Google
- `public/sitemap.xml` — генерується (`npm run sitemap`), без `lastmod`.
- `public/robots.txt` — НЕ блокувати `/assets/` (там JS/CSS бандл; Googlebot має рендерити SPA).
- Товари: `/ua/borfrezy/<код>/` і `/ru/…` (Product schema + оформлення замовлення на сторінці);
  лендинги форм: `/ua|ru/borfrezy/<форма>/`; старі `/borfrezy/…` віддають 200 з canonical на `/ua/`.
- Ручні сторінки (`dostavka`, `povernennya`, `articles/`) — одна URL, RU через `?lang=ru`:
  hreflang uk-UA і x-default = canonical, ru-UA = `?lang=ru`. `localStorage` лише в `try {}`.
- `?q=`, `?shape=` тощо — робочі фільтри каталогу; НЕ редиректити.
- Головна `index.html` має JSON-LD Organization + WebSite.
- Фід → Merchant Center (не Search Console); sitemap → Search Console (ресурс БЕЗ www).

## Правила стилю (обов'язково)
- Лише дизайн-система FLAKS: токени в `colors_and_type.css`, кольори/шрифти не вигадувати.
- Помаранчевий акцент `#e85d04` / hover `#ff7c2a`; зелений `#25d366` — тільки WhatsApp/Telegram.
- Шрифти: Bebas Neue (заголовки, UPPERCASE) + Roboto Condensed (текст), грузяться async (preload+onload).
- Тон копірайту: прямий, «майстровий», числа > прикметників.
- Будь-який новий текст — одразу двома мовами (UA + RU).

## Контакти (константи у App.jsx)
PHONE_RAW=380675453115, EMAIL=tpolegat@gmail.com, TG_BOT=flaks_orders_bot.

## Відомі обмеження
- Rate-limit на `/api/order` (5 заявок/год з IP) працює лише коли у Vercel задані `UPSTASH_REDIS_REST_URL` і `UPSTASH_REDIS_REST_TOKEN`; без них не активний (fail-open). Ідемпотентності немає.
- Залишки в каталозі статичні (`qty` у `burr-data.js`), складського обліку немає.
