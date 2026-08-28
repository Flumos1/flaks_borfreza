import { PRODUCTS, SHAPES, CUTS } from '../src/data/burr-data.js';
import { SITE, productPath, productUrl, shapePath, shapeUrl } from '../src/data/site-urls.js';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/borfrezy');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const money = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const shapeByKey = (key) => SHAPES.find((shape) => shape.key === key);
const cutLabel = (product, lang) => (CUTS[product.cut] || CUTS.double)[lang];

function productDescription(product, shape, lang) {
  const name = lang === 'ua' ? product.name_ua : product.name_ru;
  const use = lang === 'ua' ? shape?.use_ua : shape?.use_ru;
  const cut = cutLabel(product, lang);
  const base = `${name}. ${lang === 'ua' ? 'Твердосплавна борфреза ВК' : 'Твердосплавная борфреза ВК'}: Ø${product.headD}×${product.headL} мм, ${lang === 'ua' ? 'хвостовик' : 'хвостовик'} Ø${product.shankD} мм, ${lang === 'ua' ? 'насічка' : 'насечка'} ${cut}.`;
  return `${base} ${use || ''} FLAKS, ${lang === 'ua' ? 'відправка по Україні' : 'отправка по Украине'}.`;
}

function jsonLd(product, shape) {
  const url = productUrl(product);
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name_ua,
    description: productDescription(product, shape, 'ua'),
    sku: product.code,
    mpn: product.code,
    image: product.img,
    brand: { '@type': 'Brand', name: 'FLAKS' },
    category: `Борфрези > ${shape?.ua || product.shape}`,
    offers: {
      '@type': 'Offer',
      url,
      price: money(product.price),
      priceCurrency: 'UAH',
      availability: product.qty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'FLAKS', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Борфрези', item: `${SITE}/borfrezy/` },
      { '@type': 'ListItem', position: 3, name: shape?.ua || product.shape, item: shapeUrl(product.shape) },
      { '@type': 'ListItem', position: 4, name: product.code, item: url },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(productLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`;
}

function relatedProducts(product) {
  return PRODUCTS
    .filter((item) => item.id !== product.id && item.shape === product.shape)
    .slice(0, 6)
    .map((item) => `<a class="related-link" href="${productPath(item)}">${esc(item.code)} · Ø${item.headD}×${item.headL} мм</a>`)
    .join('');
}

function page(product) {
  const shape = shapeByKey(product.shape);
  const titleUa = `${product.name_ua} купити в Україні | FLAKS`;
  const titleRu = `${product.name_ru} купить в Украине | FLAKS`;
  const descUa = productDescription(product, shape, 'ua');
  const descRu = productDescription(product, shape, 'ru');
  const url = productUrl(product);
  const catalogUrl = `/?q=${encodeURIComponent(product.code)}#catalog`;

  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titleUa)}</title>
<meta name="description" content="${esc(descUa)}">
<meta name="theme-color" content="#e85d04">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="uk-UA" href="${url}?lang=ua">
<link rel="alternate" hreflang="ru-UA" href="${url}?lang=ru">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta property="og:type" content="product">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(titleUa)}">
<meta property="og:description" content="${esc(descUa)}">
<meta property="og:image" content="${esc(product.img || `${SITE}/assets/og-image.jpg`)}">
<link rel="icon" type="image/png" href="/assets/favicon.png">
${jsonLd(product, shape)}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#13161e;color:#e8eaf0;font-family:Arial,sans-serif;line-height:1.55}
a{color:inherit;text-decoration:none}
.wrap{max-width:1050px;margin:0 auto;padding:0 20px}
.header{background:#0d0f14;border-bottom:2px solid #e85d04;padding:14px 0}
.header-in{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:2px}
.mark{width:40px;height:40px;background:#e85d04;border-radius:3px;display:grid;place-items:center;color:#fff;font-size:24px}
.nav{margin-left:auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.btn,.lang-btn{border:1px solid rgba(255,255,255,.14);background:#1c2030;color:#e8eaf0;border-radius:4px;padding:9px 14px;cursor:pointer}
.btn:hover,.lang-btn:hover{border-color:#e85d04;color:#fff}
.crumbs{font-size:13px;color:#9aa0b8;padding:18px 0}
.crumbs span{color:#5a6080;margin:0 7px}
.product{display:grid;grid-template-columns:minmax(260px,420px) 1fr;gap:36px;padding:26px 0 54px}
.photo{background:#f4f5f7;border-radius:8px;min-height:360px;display:grid;place-items:center;padding:24px}
.photo img{max-width:100%;max-height:330px;object-fit:contain}
.eyebrow{color:#e85d04;text-transform:uppercase;font-size:12px;letter-spacing:2px;font-weight:700;margin-bottom:10px}
h1{font-size:clamp(28px,5vw,44px);line-height:1.08;color:#fff;margin-bottom:14px}
.lead{color:#9aa0b8;max-width:620px;margin-bottom:24px}
.price-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:24px}
.price{font-size:34px;color:#e85d04;font-weight:800}.unit{color:#9aa0b8}
.cta{display:inline-flex;align-items:center;justify-content:center;background:#e85d04;color:#fff;border-radius:4px;padding:13px 26px;font-weight:800;letter-spacing:.5px}
.cta:hover{background:#ff7c2a}
.specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:24px 0}
.spec{background:#1c2030;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:12px}
.spec b{display:block;color:#5a6080;font-size:12px;text-transform:uppercase;margin-bottom:4px}.spec span{color:#fff}
.section{padding:30px 0;border-top:1px solid rgba(255,255,255,.08)}
.section h2{font-size:24px;color:#fff;margin-bottom:12px}
.related{display:flex;gap:10px;flex-wrap:wrap}.related-link{background:#1c2030;border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:8px 12px;color:#e8eaf0}.related-link:hover{border-color:#e85d04}
.hidden{display:none!important}
@media(max-width:760px){.product{grid-template-columns:1fr}.photo{min-height:260px}.specs{grid-template-columns:1fr}.nav{margin-left:0}}
</style>
<script>
(function(){
  var p = new URLSearchParams(location.search).get('lang');
  var stored = localStorage.getItem('flaks-lang');
  var lang = (p==='ru'||(p===null&&stored==='ru')) ? 'ru' : 'ua';
  if(p) localStorage.setItem('flaks-lang', p);
  document.documentElement.lang = lang==='ua' ? 'uk' : 'ru';
  window.__lang = lang;
})();
</script>
</head>
<body>
<header class="header"><div class="wrap header-in">
  <a class="logo" href="/"><span class="mark">F</span><span>FLAKS</span></a>
  <nav class="nav">
    <button class="lang-btn" id="langBtn">RU</button>
    <a class="btn" href="${shapePath(product.shape)}" data-ua="Форма ${esc(shape?.ua || product.shape)}" data-ru="Форма ${esc(shape?.ru || product.shape)}">Форма ${esc(shape?.ua || product.shape)}</a>
    <a class="btn" href="/">Каталог</a>
  </nav>
</div></header>
<main class="wrap">
  <nav class="crumbs">
    <a href="/">FLAKS</a><span>›</span><a href="/borfrezy/">Борфрези</a><span>›</span><a href="${shapePath(product.shape)}">${esc(shape?.ua || product.shape)}</a><span>›</span>${esc(product.code)}
  </nav>
  <section class="product">
    <div class="photo"><img src="${esc(product.img)}" alt="${esc(product.name_ua)}" loading="eager"></div>
    <div>
      <p class="eyebrow" data-ua="Борфреза · ${esc(product.code)}" data-ru="Борфреза · ${esc(product.code)}">Борфреза · ${esc(product.code)}</p>
      <h1 data-ua="${esc(product.name_ua)}" data-ru="${esc(product.name_ru)}">${esc(product.name_ua)}</h1>
      <p class="lead" data-ua="${esc(descUa)}" data-ru="${esc(descRu)}">${esc(descUa)}</p>
      <div class="price-row"><span class="price">${money(product.price)}</span><span class="unit">грн / шт</span><a class="cta" href="${catalogUrl}" data-ua="Замовити" data-ru="Заказать">Замовити</a></div>
      <div class="specs">
        <div class="spec"><b data-ua="Форма" data-ru="Форма">Форма</b><span data-ua="${esc(shape?.ua || product.shape)}" data-ru="${esc(shape?.ru || product.shape)}">${esc(shape?.ua || product.shape)}</span></div>
        <div class="spec"><b data-ua="Артикул" data-ru="Артикул">Артикул</b><span>${esc(product.code)}</span></div>
        <div class="spec"><b data-ua="Головка" data-ru="Головка">Головка</b><span>Ø${product.headD}×${product.headL} мм</span></div>
        <div class="spec"><b data-ua="Хвостовик" data-ru="Хвостовик">Хвостовик</b><span>Ø${product.shankD} мм</span></div>
        <div class="spec"><b data-ua="Насічка" data-ru="Насечка">Насічка</b><span data-ua="${esc(cutLabel(product, 'ua'))}" data-ru="${esc(cutLabel(product, 'ru'))}">${esc(cutLabel(product, 'ua'))}</span></div>
        <div class="spec"><b data-ua="Наявність" data-ru="Наличие">Наявність</b><span data-ua="В наявності" data-ru="В наличии">В наявності</span></div>
      </div>
    </div>
  </section>
  <section class="section">
    <h2 data-ua="Застосування" data-ru="Применение">Застосування</h2>
    <p data-ua="${esc(shape?.use_ua || '')}" data-ru="${esc(shape?.use_ru || '')}">${esc(shape?.use_ua || '')}</p>
  </section>
  <section class="section">
    <h2 data-ua="Схожі типорозміри" data-ru="Похожие типоразмеры">Схожі типорозміри</h2>
    <div class="related">${relatedProducts(product)}</div>
  </section>
</main>
<script>
(function(){
  var lang = window.__lang || 'ua';
  if(lang==='ru'){
    document.title = ${JSON.stringify(titleRu)};
    var md=document.querySelector('meta[name="description"]'); if(md) md.setAttribute('content', ${JSON.stringify(descRu)});
    var ot=document.querySelector('meta[property="og:title"]'); if(ot) ot.setAttribute('content', ${JSON.stringify(titleRu)});
    var od=document.querySelector('meta[property="og:description"]'); if(od) od.setAttribute('content', ${JSON.stringify(descRu)});
  }
  document.querySelectorAll('[data-ua]').forEach(function(el){
    var v = el.getAttribute('data-'+lang);
    if(v!=null) el.textContent = v;
  });
  var btn = document.getElementById('langBtn');
  btn.textContent = lang==='ua' ? 'RU' : 'UA';
  btn.addEventListener('click', function(){
    var next = (window.__lang==='ua') ? 'ru' : 'ua';
    localStorage.setItem('flaks-lang', next);
    var u = new URL(location.href);
    u.searchParams.set('lang', next);
    location.href = u.toString();
  });
})();
</script>
</body>
</html>`;
}

let count = 0;
for (const product of PRODUCTS) {
  const dir = join(outDir, String(product.code).toLowerCase());
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(product), 'utf8');
  count++;
}

console.log(`Generated ${count} product pages -> public/borfrezy/<code>/index.html`);
