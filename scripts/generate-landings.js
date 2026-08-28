// Генератор SEO-лендингов по формам головки борфрез.
// Один статический HTML на форму → public/borfrezy/<slug>.html
// Переиспользует SHAPES / PRODUCTS из burr-data.js (как generate-feed.js).
// Запуск: npm run landings
import { PRODUCTS, SHAPES } from '../src/data/burr-data.js';
import { SITE, LANGS, SHAPE_SLUGS as SLUGS, productUrl, productPath, shapePath, shapeUrl } from '../src/data/site-urls.js';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TODAY = new Date().toISOString().slice(0, 10);

// Slug под каждую форму — латиница, читаемо, без коллизий (F и G обе «гиперболические»).
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const min = (items, key) => Math.min(...items.map((p) => p[key]));
const max = (items, key) => Math.max(...items.map((p) => p[key]));

function plural(n, lang, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function sizeWord(n, lang) {
  return lang === 'ua'
    ? plural(n, lang, 'типорозмір', 'типорозміри', 'типорозмірів')
    : plural(n, lang, 'типоразмер', 'типоразмера', 'типоразмеров');
}

function shortSizeWord(n, lang) {
  return lang === 'ua'
    ? plural(n, lang, 'розмір', 'розміри', 'розмірів')
    : plural(n, lang, 'размер', 'размера', 'размеров');
}

function rangeLabel(items, key, suffix = '') {
  const lo = min(items, key);
  const hi = max(items, key);
  return lo === hi ? `${lo}${suffix}` : `${lo}–${hi}${suffix}`;
}

function rpmForDiameter(d) {
  if (d <= 6) return '25 000–35 000';
  if (d <= 8) return '20 000–30 000';
  if (d <= 10) return '18 000–25 000';
  if (d <= 12) return '15 000–22 000';
  if (d <= 16) return '10 000–18 000';
  return '6 000–12 000';
}

function rpmRows(items) {
  return [...new Set(items.map((p) => p.headD).filter(Number.isFinite))]
    .sort((a, b) => a - b)
    .map((d) => `<tr><td>Ø${d} мм</td><td>${rpmForDiameter(d)} об/хв</td></tr>`)
    .join('\n');
}

// Меню всех форм для перелинковки (одинаковое на каждой странице).
const NAV = SHAPES.map((s) => ({ key: s.key, slug: SLUGS[s.key], ru: s.ru, ua: s.ua }));

function priceFrom(items) {
  return Math.min(...items.map((p) => p.price));
}

function specRows(items, lang, pathLang = '') {
  // Таблица типоразмеров формы — уникальный контент страницы.
  return items
    .slice()
    .sort((a, b) => a.headD - b.headD || a.headL - b.headL)
    .map((p) => {
      const code = esc(p.code || '');
      const dim = `Ø${p.headD}×${p.headL}`;
      const cut = p.alu
        ? (lang === 'ua' ? 'по алюмінію' : 'по алюминию')
        : (lang === 'ua' ? 'подвійна' : 'двойная');
      const inStock = lang === 'ua' ? 'В наявності' : 'В наличии';
      return `<tr>
        <td class="letter">${code}</td>
        <td>${dim} ${lang === 'ua' ? 'мм' : 'мм'}</td>
        <td>${cut}</td>
        <td>${money(p.price)} ${lang === 'ua' ? 'грн' : 'грн'}</td>
        <td><span class="in-stock">${inStock}</span></td>
        <td><a class="row-cta" href="${productPath(p, pathLang)}">${lang === 'ua' ? 'Купити' : 'Купить'}</a></td>
      </tr>`;
    })
    .join('\n');
}

function navLinks(currentKey, lang, pathLang = '') {
  return NAV.map((n) => {
    const active = n.key === currentKey ? ' aria-current="page"' : '';
    const name = lang === 'ua' ? n.ua : n.ru;
    return `<a class="form-chip${n.key === currentKey ? ' is-active' : ''}" href="${shapePath(n.key, pathLang)}"${active}>${esc(n.key)} · ${esc(name)}</a>`;
  }).join('\n');
}

function jsonLd(shape, items, slug, lang = 'ua') {
  const url = shapeUrl(shape.key, lang);
  const isUa = lang === 'ua';
  const shapeName = isUa ? shape.ua : shape.ru;
  const catalogName = isUa ? 'Борфрези' : 'Борфрезы';
  const homeName = isUa ? 'Головна' : 'Главная';
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${catalogName} ${shapeName} — FLAKS`,
    url,
    numberOfItems: items.length,
    itemListElement: items
      .slice()
      .sort((a, b) => a.headD - b.headD || a.headL - b.headL)
      .map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: isUa ? p.name_ua : p.name_ru,
          sku: p.code,
          mpn: p.code,
          image: p.img,
          brand: { '@type': 'Brand', name: 'FLAKS' },
          category: `${catalogName} > ${shapeName}`,
          offers: {
            '@type': 'Offer',
            price: money(p.price),
            priceCurrency: 'UAH',
            availability: 'https://schema.org/InStock',
            url: productUrl(p, lang),
          },
        },
      })),
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: homeName, item: `${SITE}/${lang}/` },
      { '@type': 'ListItem', position: 2, name: catalogName, item: `${SITE}/${lang}/borfrezy/` },
      { '@type': 'ListItem', position: 3, name: shapeName, item: url },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(itemList)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`;
}

function page(shape, lang = '') {
  const slug = SLUGS[shape.key];
  const pageLang = lang === 'ru' ? 'ru' : 'ua';
  const items = PRODUCTS.filter((p) => p.shape === shape.key);
  const from = priceFrom(items);
  const url = shapeUrl(shape.key, pageLang);
  const headDRange = rangeLabel(items, 'headD', ' мм');
  const headLRange = rangeLabel(items, 'headL', ' мм');
  const countUa = `${items.length} ${sizeWord(items.length, 'ua')}`;
  const countRu = `${items.length} ${sizeWord(items.length, 'ru')}`;

  const titleRu = `Борфреза ${shape.ru.toLowerCase()} ВК — купить в Украине | FLAKS`;
  const descRu = `Борфреза ${shape.ru.toLowerCase()} (${shape.ru_sub}) твердосплавная ВК. ${shape.use_ru} ${countRu}, Ø${headDRange}, от ${money(from)} грн. Отправка в день заказа.`;
  const titleUa = `Борфреза ${shape.ua.toLowerCase()} ВК — купити в Україні | FLAKS`;
  const descUa = `Борфреза ${shape.ua.toLowerCase()} (${shape.ua_sub}) твердосплавна ВК. ${shape.use_ua} ${countUa}, Ø${headDRange}, від ${money(from)} грн. Відправка в день замовлення.`;
  const chooseUa = `У цій формі доступно ${countUa}: Ø${headDRange}, робоча довжина ${headLRange}. Менший діаметр зручний для вузьких зон і точного зняття грату, більший — для швидшої зачистки площин, швів і радіусів.`;
  const chooseRu = `В этой форме доступно ${countRu}: Ø${headDRange}, рабочая длина ${headLRange}. Меньший диаметр удобен для узких зон и точного снятия грата, больший — для более быстрой зачистки плоскостей, швов и радиусов.`;
  const rpmUa = `Орієнтир для прямої шліфмашинки: що менший діаметр головки, то вищі оберти. Працюйте без сильного натиску, щоб борфреза різала стружкою, а не терла метал.`;
  const rpmRu = `Ориентир для прямой шлифмашинки: чем меньше диаметр головки, тем выше обороты. Работайте без сильного нажима, чтобы борфреза резала стружкой, а не терла металл.`;
  const mistakesUa = `Не затискайте хвостовик із биттям, не компенсуйте низькі оберти надмірним натиском і не використовуйте звичайну подвійну насічку для м'якого алюмінію, якщо потрібна чиста стружка без забивання.`;
  const mistakesRu = `Не зажимайте хвостовик с биением, не компенсируйте низкие обороты сильным нажимом и не используйте обычную двойную насечку для мягкого алюминия, если нужна чистая стружка без забивания.`;

  const title = pageLang === 'ua' ? titleUa : titleRu;
  const desc = pageLang === 'ua' ? descUa : descRu;
  const ogLocale = pageLang === 'ua' ? 'uk_UA' : 'ru_UA';
  const catalogLabel = pageLang === 'ua' ? 'Борфрези' : 'Борфрезы';
  const shapeName = pageLang === 'ua' ? shape.ua : shape.ru;
  const shapeSub = pageLang === 'ua' ? shape.ua_sub : shape.ru_sub;
  const shapeUse = pageLang === 'ua' ? shape.use_ua : shape.use_ru;
  const availableCount = pageLang === 'ua' ? sizeWord(items.length, 'ua') : sizeWord(items.length, 'ru');
  const pricePrefix = pageLang === 'ua' ? 'від, грн' : 'от, грн';
  const materialLabel = pageLang === 'ua' ? 'твердий сплав' : 'твёрдый сплав';
  const applicationTitle = pageLang === 'ua' ? 'Застосування' : 'Применение';
  const applicationText = pageLang === 'ua'
    ? `Борфреза ${shape.ua} (${shape.ua_sub}) — це твердосплавна шарошка ВК із хвостовиком 6 мм. ${shape.use_ua} Підходить для сталі, нержавійки, чавуну, титану. Подвійна насічка ріже чисто, без припалів і вібрації.`
    : `Борфреза ${shape.ru} (${shape.ru_sub}) — это твердосплавная шарошка ВК с хвостовиком 6 мм. ${shape.use_ru} Подходит для стали, нержавейки, чугуна, титана. Двойная насечка режет чисто, без прижогов и вибрации.`;
  const chooseTitle = pageLang === 'ua' ? 'Як підібрати розмір' : 'Как подобрать размер';
  const chooseText = pageLang === 'ua' ? chooseUa : chooseRu;
  const rpmTitle = pageLang === 'ua' ? 'Орієнтовні оберти' : 'Ориентировочные обороты';
  const rpmText = pageLang === 'ua' ? rpmUa : rpmRu;
  const mistakesTitle = pageLang === 'ua' ? 'Часті помилки' : 'Частые ошибки';
  const mistakesText = pageLang === 'ua' ? mistakesUa : mistakesRu;
  const availableTitle = pageLang === 'ua' ? 'Типорозміри в наявності' : 'Типоразмеры в наличии';
  const otherFormsTitle = pageLang === 'ua' ? 'Інші форми головки' : 'Другие формы головки';
  const ctaTitle = pageLang === 'ua' ? 'Потрібна консультація?' : 'Нужна консультация?';
  const ctaBody = pageLang === 'ua'
    ? 'Не впевнені у формі чи діаметрі? Напишіть задачу — підберемо борфрезу й порахуємо замовлення.'
    : 'Не уверены в форме или диаметре? Напишите задачу — подберём борфрезу и посчитаем заказ.';
  const ctaLink = pageLang === 'ua' ? 'Дивитися в каталозі →' : 'Смотреть в каталоге →';
  const footerTool = pageLang === 'ua' ? 'Твердосплавний інструмент' : 'Твёрдосплавный инструмент';

  return `<!DOCTYPE html>
<html lang="${pageLang === 'ua' ? 'uk' : 'ru'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#e85d04">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="uk-UA" href="${shapeUrl(shape.key, 'ua')}">
<link rel="alternate" hreflang="ru-UA" href="${shapeUrl(shape.key, 'ru')}">
<link rel="alternate" hreflang="x-default" href="${shapeUrl(shape.key, 'ua')}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${ogLocale}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto+Condensed:wght@300;400;500;600;700&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto+Condensed:wght@300;400;500;600;700&display=swap"></noscript>
<link rel="icon" type="image/png" href="/assets/favicon.png">
${jsonLd(shape, items, slug, pageLang)}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#13161e;color:#e8eaf0;font-family:'Roboto Condensed',sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6}
a{text-decoration:none;color:inherit}
.wrap{max-width:1000px;margin:0 auto;padding:0 20px}
.art-header{background:#0d0f14;border-bottom:2px solid #e85d04;padding:14px 0}
.art-header-in{display:flex;align-items:center;gap:20px;flex-wrap:wrap;max-width:1000px;margin:0 auto;padding:0 20px}
.art-logo{display:flex;align-items:center;gap:10px;font-family:'Bebas Neue',sans-serif}
.art-logo-mark{width:40px;height:40px;background:#e85d04;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;flex-shrink:0}
.art-logo-name{font-size:24px;letter-spacing:3px;color:#fff;line-height:1}
.art-logo-sub{font-size:9px;color:#5a6080;letter-spacing:1.5px;text-transform:uppercase}
.art-nav{margin-left:auto;display:flex;align-items:center;gap:14px}
.art-back{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1px;color:#9aa0b8;border:1px solid rgba(255,255,255,0.14);border-radius:3px;padding:7px 16px;transition:.2s}
.art-back:hover{border-color:#e85d04;color:#e85d04}
.lang-btn{font-family:'Roboto Condensed',sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;color:#9aa0b8;background:#1c2030;border:1px solid rgba(255,255,255,0.14);border-radius:3px;padding:6px 12px;cursor:pointer;transition:.2s}
.lang-btn:hover{border-color:#e85d04;color:#e85d04}
.crumbs{font-size:12px;color:#5a6080;padding:16px 0 0}
.crumbs a:hover{color:#e85d04}
.crumbs span{color:#323850;margin:0 6px}
.art-hero{padding:36px 0 30px;background:#0d0f14;border-bottom:1px solid rgba(255,255,255,0.08)}
.art-eyebrow{font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#e85d04;margin-bottom:12px}
.art-hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(28px,5vw,46px);letter-spacing:2px;color:#fff;line-height:1.05;margin-bottom:14px}
.art-hero .lead{font-size:16px;color:#9aa0b8;max-width:760px;line-height:1.6}
.art-stats{display:flex;gap:28px;flex-wrap:wrap;margin-top:22px}
.art-stat b{font-family:'Bebas Neue',sans-serif;font-size:26px;color:#e85d04;letter-spacing:1px;display:block;line-height:1}
.art-stat span{font-size:12px;color:#5a6080;letter-spacing:.5px;text-transform:uppercase}
.art-body{padding:40px 0 60px}
.art-body h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(22px,3.5vw,30px);letter-spacing:1.5px;color:#fff;margin:36px 0 14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08)}
.art-body h2:first-child{margin-top:0}
.art-body p{font-size:15px;color:#e8eaf0;line-height:1.7;margin-bottom:16px;max-width:760px}
.art-body strong{color:#fff;font-weight:600}
.art-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:24px 0 8px}
.art-note{background:#1c2030;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:18px}
.art-note h3{font-family:'Bebas Neue',sans-serif;font-size:21px;letter-spacing:1px;color:#fff;margin:0 0 10px}
.art-note p{font-size:14px;color:#9aa0b8;margin:0;line-height:1.6}
.mini-table{margin:10px 0 0;font-size:13px}
.mini-table td{padding:8px 10px}
.art-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
.art-table th{background:#252a3a;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#5a6080;border-bottom:1px solid rgba(255,255,255,0.14)}
.art-table td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8eaf0;vertical-align:middle}
.art-table tr:last-child td{border-bottom:none}
.art-table tr:hover td{background:rgba(255,255,255,0.03)}
.art-table .letter{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1px;color:#e85d04;white-space:nowrap}
.in-stock{color:#25d366;font-size:13px;white-space:nowrap}
.row-cta{display:inline-block;background:#e85d04;color:#fff;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:1px;padding:6px 14px;border-radius:3px;transition:.2s;white-space:nowrap}
.row-cta:hover{background:#ff7c2a}
.forms-nav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0}
.form-chip{font-size:13px;color:#9aa0b8;background:#1c2030;border:1px solid rgba(255,255,255,0.1);border-radius:3px;padding:7px 12px;transition:.2s}
.form-chip:hover{border-color:#e85d04;color:#fff}
.form-chip.is-active{border-color:#e85d04;color:#e85d04;background:rgba(232,93,4,.1)}
.art-cta{background:linear-gradient(135deg,#1c2030,#252a3a);border:1px solid rgba(232,93,4,.4);border-radius:8px;padding:32px;margin:40px 0 0;text-align:center;position:relative;overflow:hidden}
.art-cta::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#e85d04}
.art-cta h3{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:1.5px;color:#fff;margin-bottom:10px}
.art-cta p{font-size:14px;color:#9aa0b8;margin-bottom:20px;line-height:1.6;max-width:none}
.art-cta-btn{display:inline-flex;align-items:center;gap:10px;background:#e85d04;color:#fff;font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1px;padding:13px 28px;border-radius:4px;transition:.2s}
.art-cta-btn:hover{background:#ff7c2a;transform:translateY(-1px)}
.art-footer{background:#0a0b0f;border-top:1px solid rgba(255,255,255,0.08);padding:24px 0;margin-top:60px}
.art-footer-in{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;font-size:13px;color:#5a6080;max-width:1000px;margin:0 auto;padding:0 20px}
.hidden{display:none!important}
@media(max-width:820px){.art-info-grid{grid-template-columns:1fr}}
</style>
<script>
(function(){
  var pathLang = location.pathname.split('/').filter(Boolean)[0];
  var p = new URLSearchParams(location.search).get('lang') || (pathLang === 'ru' || pathLang === 'ua' ? pathLang : null);
  var stored = localStorage.getItem('flaks-lang');
  var lang = (p==='ru'||(p===null&&stored==='ru')) ? 'ru' : 'ua';
  if(p) localStorage.setItem('flaks-lang', p);
  document.documentElement.lang = lang==='ua' ? 'uk' : 'ru';
  window.__lang = lang;
})();
</script>
</head>
<body>
<header class="art-header">
  <div class="art-header-in">
    <a href="/${pageLang}/" class="art-logo">
      <span class="art-logo-mark">F</span>
      <span>
        <span class="art-logo-name">FLAKS</span>
        <span class="art-logo-sub">Tool Solutions</span>
      </span>
    </a>
    <div class="art-nav">
      <a class="lang-btn" id="langBtn" href="${shapePath(shape.key, pageLang === 'ua' ? 'ru' : 'ua')}">${pageLang === 'ua' ? 'RU' : 'UA'}</a>
      <a href="/${pageLang}/" class="art-back" data-ua="← Каталог" data-ru="← Каталог">← Каталог</a>
    </div>
  </div>
</header>

<div class="wrap">
  <nav class="crumbs">
    <a href="/${pageLang}/">FLAKS</a><span>›</span><a href="/${pageLang}/borfrezy/" data-ua="Борфрези" data-ru="Борфрезы">${catalogLabel}</a><span>›</span><span class="t" data-ua="${esc(shape.ua)}" data-ru="${esc(shape.ru)}">${esc(shapeName)}</span>
  </nav>
</div>

<section class="art-hero">
  <div class="wrap">
    <p class="art-eyebrow" data-ua="Форма головки · ${esc(shape.key)}" data-ru="Форма головки · ${esc(shape.key)}">Форма головки · ${esc(shape.key)}</p>
    <h1 data-ua="Борфреза ${esc(shape.ua)}" data-ru="Борфреза ${esc(shape.ru)}">Борфреза ${esc(shapeName)}</h1>
    <p class="lead" data-ua="${esc(shape.ua_sub)}. ${esc(shape.use_ua)}" data-ru="${esc(shape.ru_sub)}. ${esc(shape.use_ru)}">${esc(shapeSub)}. ${esc(shapeUse)}</p>
    <div class="art-stats">
      <div class="art-stat"><b>${items.length}</b><span data-ua="${sizeWord(items.length, 'ua')}" data-ru="${sizeWord(items.length, 'ru')}">${availableCount}</span></div>
      <div class="art-stat"><b>${money(from)}</b><span data-ua="від, грн" data-ru="от, грн">${pricePrefix}</span></div>
      <div class="art-stat"><b>ВК</b><span data-ua="твердий сплав" data-ru="твёрдый сплав">${materialLabel}</span></div>
    </div>
  </div>
</section>

<main class="art-body">
  <div class="wrap">
    <h2 data-ua="Застосування" data-ru="Применение">${applicationTitle}</h2>
    <p data-ua="Борфреза ${esc(shape.ua)} (${esc(shape.ua_sub)}) — це твердосплавна шарошка ВК із хвостовиком 6 мм. ${esc(shape.use_ua)} Підходить для сталі, нержавійки, чавуну, титану. Подвійна насічка ріже чисто, без припалів і вібрації." data-ru="Борфреза ${esc(shape.ru)} (${esc(shape.ru_sub)}) — это твердосплавная шарошка ВК с хвостовиком 6 мм. ${esc(shape.use_ru)} Подходит для стали, нержавейки, чугуна, титана. Двойная насечка режет чисто, без прижогов и вибрации.">${esc(applicationText)}</p>

    <div class="art-info-grid">
      <section class="art-note">
        <h3 data-ua="Як підібрати розмір" data-ru="Как подобрать размер">${chooseTitle}</h3>
        <p data-ua="${esc(chooseUa)}" data-ru="${esc(chooseRu)}">${esc(chooseText)}</p>
      </section>
      <section class="art-note">
        <h3 data-ua="Орієнтовні оберти" data-ru="Ориентировочные обороты">${rpmTitle}</h3>
        <p data-ua="${esc(rpmUa)}" data-ru="${esc(rpmRu)}">${esc(rpmText)}</p>
        <table class="art-table mini-table"><tbody>${rpmRows(items)}</tbody></table>
      </section>
      <section class="art-note">
        <h3 data-ua="Часті помилки" data-ru="Частые ошибки">${mistakesTitle}</h3>
        <p data-ua="${esc(mistakesUa)}" data-ru="${esc(mistakesRu)}">${esc(mistakesText)}</p>
      </section>
    </div>

    <h2 data-ua="Типорозміри в наявності" data-ru="Типоразмеры в наличии">${availableTitle}</h2>
    <table class="art-table${pageLang === 'ru' ? ' hidden' : ''}" id="spec-ua">
      <thead><tr><th data-ua="Артикул" data-ru="Артикул">Артикул</th><th>Ø×L</th><th data-ua="Насічка" data-ru="Насечка">Насічка</th><th data-ua="Ціна" data-ru="Цена">Ціна</th><th data-ua="Наявність" data-ru="Наличие">Наявність</th><th></th></tr></thead>
      <tbody>
${specRows(items, 'ua', pageLang)}
      </tbody>
    </table>
    <table class="art-table${pageLang === 'ua' ? ' hidden' : ''}" id="spec-ru">
      <thead><tr><th>Артикул</th><th>Ø×L</th><th>Насечка</th><th>Цена</th><th>Наличие</th><th></th></tr></thead>
      <tbody>
${specRows(items, 'ru', pageLang)}
      </tbody>
    </table>

    <h2 data-ua="Інші форми головки" data-ru="Другие формы головки">${otherFormsTitle}</h2>
    <div class="forms-nav">
${navLinks(shape.key, pageLang, pageLang)}
    </div>

    <div class="art-cta">
      <h3 data-ua="Потрібна консультація?" data-ru="Нужна консультация?">${ctaTitle}</h3>
      <p data-ua="Не впевнені у формі чи діаметрі? Напишіть задачу — підберемо борфрезу й порахуємо замовлення." data-ru="Не уверены в форме или диаметре? Напишите задачу — подберём борфрезу и посчитаем заказ.">${ctaBody}</p>
      <a class="art-cta-btn" href="/${pageLang}/?shape=${esc(shape.key)}" data-ua="Дивитися в каталозі →" data-ru="Смотреть в каталоге →">${ctaLink}</a>
    </div>
  </div>
</main>

<footer class="art-footer">
  <div class="art-footer-in">
    <span>© ${new Date().getFullYear()} FLAKS · ${SITE.replace('https://', '')}</span>
    <span data-ua="Твердосплавний інструмент" data-ru="Твёрдосплавный инструмент">${footerTool}</span>
  </div>
</footer>

<script>
(function(){
  var lang = window.__lang || 'ua';
  // RU-версия: подменяем title и meta, чтобы страницы не выглядели дублями для Google.
  if(lang==='ru'){
    document.title = ${JSON.stringify(titleRu)};
    var _md=document.querySelector('meta[name="description"]'); if(_md) _md.setAttribute('content', ${JSON.stringify(descRu)});
    var _ot=document.querySelector('meta[property="og:title"]'); if(_ot) _ot.setAttribute('content', ${JSON.stringify(titleRu)});
    var _od=document.querySelector('meta[property="og:description"]'); if(_od) _od.setAttribute('content', ${JSON.stringify(descRu)});
  }
  // Текстовые узлы с data-ua/data-ru
  document.querySelectorAll('[data-ua]').forEach(function(el){
    var v = el.getAttribute('data-'+lang);
    if(v!=null) el.textContent = v;
  });
  // Таблицы спецификации
  document.getElementById('spec-ua').classList.toggle('hidden', lang!=='ua');
  document.getElementById('spec-ru').classList.toggle('hidden', lang!=='ru');
  // Кнопка языка
  var btn = document.getElementById('langBtn');
  btn.textContent = lang==='ua' ? 'RU' : 'UA';
  btn.addEventListener('click', function(){
    var next = (window.__lang==='ua') ? 'ru' : 'ua';
    localStorage.setItem('flaks-lang', next);
  });
})();
</script>
</body>
</html>
`;
}

function hubPage(lang = '') {
  const pageLang = lang === 'ru' ? 'ru' : 'ua';
  const url = `${SITE}/${pageLang}/borfrezy/`;
  const total = PRODUCTS.length;
  const minD = Math.min(...PRODUCTS.map((p) => p.headD));
  const maxD = Math.max(...PRODUCTS.map((p) => p.headD));
  const titleUa = `Борфрези твердосплавні ВК — каталог за формами | FLAKS`;
  const descUa = `Каталог твердосплавних борфрез (шарошок) ВК за формами головки. ${SHAPES.length} форм, ${total} ${sizeWord(total, 'ua')} Ø${minD}–${maxD} мм, хвостовик 6 мм. Відправка в день замовлення по Україні.`;
  const titleRu = `Борфрезы твердосплавные ВК — каталог по формам | FLAKS`;
  const descRu = `Каталог твердосплавных борфрез (шарошек) ВК по формам головки. ${SHAPES.length} форм, ${total} ${sizeWord(total, 'ru')} Ø${minD}–${maxD} мм, хвостовик 6 мм. Отправка в день заказа по Украине.`;
  const title = pageLang === 'ua' ? titleUa : titleRu;
  const desc = pageLang === 'ua' ? descUa : descRu;
  const ogLocale = pageLang === 'ua' ? 'uk_UA' : 'ru_UA';
  const eyebrow = pageLang === 'ua' ? 'Каталог за формами' : 'Каталог по формам';
  const h1 = pageLang === 'ua' ? 'Борфрези твердосплавні ВК' : 'Борфрезы твердосплавные ВК';
  const leadUa = `${SHAPES.length} форм головки, ${total} ${sizeWord(total, 'ua')} Ø${minD}–${maxD} мм, хвостовик 6 мм. Оберіть форму під свою задачу.`;
  const leadRu = `${SHAPES.length} форм головки, ${total} ${sizeWord(total, 'ru')} Ø${minD}–${maxD} мм, хвостовик 6 мм. Выберите форму под свою задачу.`;
  const lead = pageLang === 'ua' ? leadUa : leadRu;
  const footerTool = pageLang === 'ua' ? 'Твердосплавний інструмент' : 'Твёрдосплавный инструмент';

  const cards = SHAPES.map((s) => {
    const items = PRODUCTS.filter((p) => p.shape === s.key);
    const from = priceFrom(items);
    const name = pageLang === 'ua' ? s.ua : s.ru;
    const subtitle = pageLang === 'ua' ? s.ua_sub : s.ru_sub;
    const meta = `${shortSizeWord(items.length, pageLang)} · ${pageLang === 'ua' ? 'від' : 'от'}`;
    return `<a class="hub-card" href="${shapePath(s.key, pageLang)}">
      <span class="hub-letter">${esc(s.key)}</span>
      <span class="hub-name" data-ua="${esc(s.ua)}" data-ru="${esc(s.ru)}">${esc(name)}</span>
      <span class="hub-sub" data-ua="${esc(s.ua_sub)}" data-ru="${esc(s.ru_sub)}">${esc(subtitle)}</span>
      <span class="hub-meta"><b>${items.length}</b> <span data-ua="${shortSizeWord(items.length, 'ua')} · від" data-ru="${shortSizeWord(items.length, 'ru')} · от">${esc(meta)}</span> ${money(from)} ${'грн'}</span>
    </a>`;
  }).join('\n');

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageLang === 'ua' ? 'Борфрези твердосплавні ВК — каталог за формами' : 'Борфрезы твердосплавные ВК — каталог по формам',
    url,
    description: desc,
  };

  return `<!DOCTYPE html>
<html lang="${pageLang === 'ua' ? 'uk' : 'ru'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#e85d04">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="uk-UA" href="${SITE}/ua/borfrezy/">
<link rel="alternate" hreflang="ru-UA" href="${SITE}/ru/borfrezy/">
<link rel="alternate" hreflang="x-default" href="${SITE}/ua/borfrezy/">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${ogLocale}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto+Condensed:wght@300;400;500;600;700&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto+Condensed:wght@300;400;500;600;700&display=swap"></noscript>
<link rel="icon" type="image/png" href="/assets/favicon.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#13161e;color:#e8eaf0;font-family:'Roboto Condensed',sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6}
a{text-decoration:none;color:inherit}
.wrap{max-width:1000px;margin:0 auto;padding:0 20px}
.art-header{background:#0d0f14;border-bottom:2px solid #e85d04;padding:14px 0}
.art-header-in{display:flex;align-items:center;gap:20px;flex-wrap:wrap;max-width:1000px;margin:0 auto;padding:0 20px}
.art-logo{display:flex;align-items:center;gap:10px;font-family:'Bebas Neue',sans-serif}
.art-logo-mark{width:40px;height:40px;background:#e85d04;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;flex-shrink:0}
.art-logo-name{font-size:24px;letter-spacing:3px;color:#fff;line-height:1}
.art-logo-sub{font-size:9px;color:#5a6080;letter-spacing:1.5px;text-transform:uppercase}
.art-nav{margin-left:auto;display:flex;align-items:center;gap:14px}
.art-back{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1px;color:#9aa0b8;border:1px solid rgba(255,255,255,0.14);border-radius:3px;padding:7px 16px;transition:.2s}
.art-back:hover{border-color:#e85d04;color:#e85d04}
.lang-btn{font-family:'Roboto Condensed',sans-serif;font-size:12px;font-weight:600;letter-spacing:1px;color:#9aa0b8;background:#1c2030;border:1px solid rgba(255,255,255,0.14);border-radius:3px;padding:6px 12px;cursor:pointer;transition:.2s}
.lang-btn:hover{border-color:#e85d04;color:#e85d04}
.art-hero{padding:40px 0 30px;background:#0d0f14;border-bottom:1px solid rgba(255,255,255,0.08)}
.art-eyebrow{font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#e85d04;margin-bottom:12px}
.art-hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(28px,5vw,46px);letter-spacing:2px;color:#fff;line-height:1.05;margin-bottom:14px}
.art-hero .lead{font-size:16px;color:#9aa0b8;max-width:760px}
.hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;padding:40px 0 60px}
.hub-card{background:#1c2030;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:20px;display:flex;flex-direction:column;gap:4px;transition:.2s;position:relative}
.hub-card:hover{border-color:#e85d04;transform:translateY(-2px)}
.hub-letter{position:absolute;top:16px;right:18px;font-family:'Bebas Neue',sans-serif;font-size:30px;color:#e85d04;opacity:.5;line-height:1}
.hub-name{font-family:'Bebas Neue',sans-serif;font-size:21px;letter-spacing:1px;color:#fff}
.hub-sub{font-size:13px;color:#5a6080}
.hub-meta{font-size:13px;color:#9aa0b8;margin-top:10px}
.hub-meta b{color:#e85d04;font-size:15px}
.art-footer{background:#0a0b0f;border-top:1px solid rgba(255,255,255,0.08);padding:24px 0}
.art-footer-in{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;font-size:13px;color:#5a6080;max-width:1000px;margin:0 auto;padding:0 20px}
</style>
<script>
(function(){
  var pathLang = location.pathname.split('/').filter(Boolean)[0];
  var p = new URLSearchParams(location.search).get('lang') || (pathLang === 'ru' || pathLang === 'ua' ? pathLang : null);
  var stored = localStorage.getItem('flaks-lang');
  var lang = (p==='ru'||(p===null&&stored==='ru')) ? 'ru' : 'ua';
  if(p) localStorage.setItem('flaks-lang', p);
  document.documentElement.lang = lang==='ua' ? 'uk' : 'ru';
  window.__lang = lang;
})();
</script>
</head>
<body>
<header class="art-header">
  <div class="art-header-in">
    <a href="/${pageLang}/" class="art-logo">
      <span class="art-logo-mark">F</span>
      <span>
        <span class="art-logo-name">FLAKS</span>
        <span class="art-logo-sub">Tool Solutions</span>
      </span>
    </a>
    <div class="art-nav">
      <a class="lang-btn" id="langBtn" href="/${pageLang === 'ua' ? 'ru' : 'ua'}/borfrezy/">${pageLang === 'ua' ? 'RU' : 'UA'}</a>
      <a href="/${pageLang}/" class="art-back">← Каталог</a>
    </div>
  </div>
</header>
<section class="art-hero">
  <div class="wrap">
    <p class="art-eyebrow" data-ua="Каталог за формами" data-ru="Каталог по формам">${eyebrow}</p>
    <h1 data-ua="Борфрези твердосплавні ВК" data-ru="Борфрезы твердосплавные ВК">${h1}</h1>
    <p class="lead" data-ua="${esc(leadUa)}" data-ru="${esc(leadRu)}">${esc(lead)}</p>
  </div>
</section>
<main class="wrap">
  <div class="hub-grid">
${cards}
  </div>
</main>
<footer class="art-footer">
  <div class="art-footer-in">
    <span>© ${new Date().getFullYear()} FLAKS · ${SITE.replace('https://', '')}</span>
    <span data-ua="Твердосплавний інструмент" data-ru="Твёрдосплавный инструмент">${footerTool}</span>
  </div>
</footer>
<script>
(function(){
  var lang = window.__lang || 'ua';
  if(lang==='ru'){
    document.title = ${JSON.stringify(titleRu)};
    var _md=document.querySelector('meta[name="description"]'); if(_md) _md.setAttribute('content', ${JSON.stringify(descRu)});
    var _ot=document.querySelector('meta[property="og:title"]'); if(_ot) _ot.setAttribute('content', ${JSON.stringify(titleRu)});
    var _od=document.querySelector('meta[property="og:description"]'); if(_od) _od.setAttribute('content', ${JSON.stringify(descRu)});
  }
  document.querySelectorAll('[data-ua]').forEach(function(el){
    var v = el.getAttribute('data-'+lang); if(v!=null) el.textContent = v;
  });
  var btn = document.getElementById('langBtn');
  btn.textContent = lang==='ua' ? 'RU' : 'UA';
  btn.addEventListener('click', function(){
    var next = (window.__lang==='ua') ? 'ru' : 'ua';
    localStorage.setItem('flaks-lang', next);
  });
})();
</script>
</body>
</html>
`;
}

// ─── Генерация ───
const outDir = join(__dirname, '../public/borfrezy');
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, 'index.html'), hubPage(), 'utf8');
for (const lang of LANGS) {
  const langHubDir = join(__dirname, `../public/${lang}/borfrezy`);
  mkdirSync(langHubDir, { recursive: true });
  writeFileSync(join(langHubDir, 'index.html'), hubPage(lang), 'utf8');
}

let count = 0;
for (const shape of SHAPES) {
  const slug = SLUGS[shape.key];
  if (!slug) { console.warn(`! нет slug для формы ${shape.key}`); continue; }
  const dir = join(outDir, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(shape), 'utf8');
  for (const lang of LANGS) {
    const langDir = join(__dirname, `../public/${lang}/borfrezy`, slug);
    mkdirSync(langDir, { recursive: true });
    writeFileSync(join(langDir, 'index.html'), page(shape, lang), 'utf8');
  }
  count++;
}

console.log(`✓ Лендингов сгенерировано: ${count} → public/borfrezy/<slug>/index.html`);

// Список URL для sitemap (выводим, чтобы вставить вручную или подцепить отдельным шагом)
const urls = SHAPES.map((s) => `${SITE}/borfrezy/${SLUGS[s.key]}/`);
console.log('\nURL для sitemap:');
urls.forEach((u) => console.log('  ' + u));

export { SLUGS };
