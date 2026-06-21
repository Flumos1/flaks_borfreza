# CLAUDE.md — контекст проєкту для Claude Code

## Що це
Сайт-каталог твердосплавних борфрез (шарошок) у фірмовому стилі FLAKS.
Двомовний UA/RU. Бойовий домен — **https://borfrezy.in.ua** (Vercel, автодеплой з гілки `main`).

## Архітектура
- **Vite 6 + React 18**, ES-модулі (НЕ CDN/Babel). Точка входу — `index.html` → `src/main.jsx` → `src/App.jsx`.
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
- `npm run build` — продакшн-збірка в `dist/`.
- `npm run preview` — локальний перегляд `dist/` (порт 4173).
- `npm run feed` — генерує `public/feed.xml` (Google Merchant Center) з `PRODUCTS`.
- `npm run landings` — генерує SEO-лендинги за формами в `public/borfrezy/` з `SHAPES`/`PRODUCTS`.

> Після зміни цін/товарів у `burr-data.js` ганяй `npm run feed` і `npm run landings` —
> у фіді й лендингах ціни закешовані.

## SEO / Google
- `public/sitemap.xml` — ручний, тримай синхронним з реальними сторінками.
- `public/robots.txt` — НЕ блокувати `/assets/` (там JS/CSS бандл; Googlebot має рендерити SPA).
- `public/borfrezy/` — 17 статичних лендингів (хаб + 16 форм) з Product/ItemList/Breadcrumb schema.
- `public/articles/` — статичні статті (двомовні через JS-перемикач `content-ua`/`content-ru`).
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

## Відоме обмеження
Telegram не приймає текст замовлення через t.me-посилання. Для авто-доставки
замовлення в бота потрібен Telegram Web App або серверний приймач (Bot API).
