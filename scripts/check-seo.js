import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PRODUCTS, SHAPES } from '../src/data/burr-data.js';
import { SITE, LANGS, productPath, productUrl, shapePath, shapeUrl } from '../src/data/site-urls.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
const errors = [];

const read = (path) => readFileSync(path, 'utf8');
const rel = (...parts) => join(publicDir, ...parts);
const fail = (message) => errors.push(message);
const itemsForShape = (shapeKey) => PRODUCTS
  .filter((product) => product.shape === shapeKey)
  .slice()
  .sort((a, b) => a.headD - b.headD || a.headL - b.headL);
const expectedHtmlLang = (lang) => (lang === 'ua' ? 'uk' : 'ru');
const expectedOgLocale = (lang) => (lang === 'ua' ? 'uk_UA' : 'ru_UA');
const visibleText = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function expectVisibleText(html, expected, label) {
  if (!visibleText(html).includes(expected)) {
    fail(`${label} misses raw visible text: ${expected}`);
  }
}

function rejectVisibleText(html, unexpected, label) {
  if (visibleText(html).includes(unexpected)) {
    fail(`${label} still exposes wrong-language raw visible text: ${unexpected}`);
  }
}

function canRejectAsDistinct(left, right) {
  return left !== right && !left.includes(right) && !right.includes(left);
}

function jsonLdObjects(html, label) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const parsed = [];
  for (const [, raw] of blocks) {
    try {
      parsed.push(JSON.parse(raw));
    } catch {
      fail(`${label} has invalid JSON-LD`);
    }
  }
  return parsed;
}

function requireFile(path, label) {
  if (!existsSync(path)) {
    fail(`${label} is missing: ${path}`);
    return '';
  }
  return read(path);
}

function checkProducts() {
  for (const product of PRODUCTS) {
    const path = rel(productPath(product).replace(/^\/+/, ''), 'index.html');
    const html = requireFile(path, `Product page ${product.code}`);
    if (html && !html.includes(`<link rel="canonical" href="${productUrl(product, 'ua')}">`)) {
      fail(`Legacy product ${product.code} should canonicalize to UA URL`);
    }

    for (const lang of LANGS) {
      const langPath = rel(productPath(product, lang).replace(/^\/+/, ''), 'index.html');
      const langHtml = requireFile(langPath, `${lang.toUpperCase()} product page ${product.code}`);
      if (!langHtml) continue;

      if (!langHtml.includes(`<link rel="canonical" href="${productUrl(product, lang)}">`)) {
        fail(`${lang.toUpperCase()} product ${product.code} has missing or wrong canonical`);
      }
      if (!langHtml.includes(`<html lang="${expectedHtmlLang(lang)}">`)) {
        fail(`${lang.toUpperCase()} product ${product.code} has wrong html lang`);
      }
      if (!langHtml.includes(`<meta property="og:locale" content="${expectedOgLocale(lang)}">`)) {
        fail(`${lang.toUpperCase()} product ${product.code} has wrong og:locale`);
      }
      if (!langHtml.includes(`href="/${lang}/?q=${encodeURIComponent(product.code)}#catalog"`)) {
        fail(`${lang.toUpperCase()} product ${product.code} catalog CTA points outside the current language`);
      }
      const localizedCrumb = lang === 'ua' ? 'Борфрези' : 'Борфрезы';
      if (!langHtml.includes(`<a href="/${lang}/borfrezy/">${localizedCrumb}</a>`)) {
        fail(`${lang.toUpperCase()} product ${product.code} has wrong raw breadcrumb language`);
      }
      expectVisibleText(langHtml, lang === 'ua' ? product.name_ua : product.name_ru, `${lang.toUpperCase()} product ${product.code}`);
      expectVisibleText(langHtml, lang === 'ua' ? 'Замовити' : 'Заказать', `${lang.toUpperCase()} product ${product.code}`);
      expectVisibleText(langHtml, lang === 'ua' ? 'В наявності' : 'В наличии', `${lang.toUpperCase()} product ${product.code}`);
      if (canRejectAsDistinct(product.name_ua, product.name_ru)) {
        rejectVisibleText(langHtml, lang === 'ua' ? product.name_ru : product.name_ua, `${lang.toUpperCase()} product ${product.code}`);
      }
      if (!langHtml.includes(`hreflang="uk-UA" href="${productUrl(product, 'ua')}"`)) {
        fail(`${lang.toUpperCase()} product ${product.code} misses UA hreflang`);
      }
      if (!langHtml.includes(`hreflang="ru-UA" href="${productUrl(product, 'ru')}"`)) {
        fail(`${lang.toUpperCase()} product ${product.code} misses RU hreflang`);
      }
      if (!langHtml.includes('"@type":"Product"')) {
        fail(`${lang.toUpperCase()} product ${product.code} has no Product JSON-LD`);
      }
      if (!langHtml.includes(`"sku":"${product.code}"`)) {
        fail(`${lang.toUpperCase()} product ${product.code} JSON-LD sku is missing`);
      }
    }
  }
}

function checkHomePages() {
  const rootHtml = requireFile(join(__dirname, '../index.html'), 'Root homepage');
  if (rootHtml) {
    if (!htmlHasCanonical(rootHtml, `${SITE}/ua/`)) fail('Root homepage should canonicalize to UA homepage');
    if (!rootHtml.includes(`hreflang="uk-UA" href="${SITE}/ua/"`)) fail('Root homepage misses UA hreflang');
    if (!rootHtml.includes(`hreflang="ru-UA" href="${SITE}/ru/"`)) fail('Root homepage misses RU hreflang');
    if (!rootHtml.includes(`hreflang="x-default" href="${SITE}/ua/"`)) fail('Root homepage has wrong x-default hreflang');
    if (!rootHtml.includes(`<meta property="og:url" content="${SITE}/ua/">`)) fail('Root homepage has wrong og:url');
  }

  const pages = [
    ['ua', join(__dirname, '../ua/index.html')],
    ['ru', join(__dirname, '../ru/index.html')],
  ];

  for (const [lang, path] of pages) {
    const html = requireFile(path, `${lang.toUpperCase()} homepage entry`);
    if (!html) continue;
    if (!htmlHasCanonical(html, `${SITE}/${lang}/`)) fail(`${lang.toUpperCase()} homepage has missing or wrong canonical`);
    if (!html.includes(`<html lang="${expectedHtmlLang(lang)}">`)) fail(`${lang.toUpperCase()} homepage has wrong html lang`);
    if (!html.includes(`<meta property="og:locale" content="${expectedOgLocale(lang)}">`)) fail(`${lang.toUpperCase()} homepage has wrong og:locale`);
    if (!html.includes(`hreflang="uk-UA" href="${SITE}/ua/"`)) fail(`${lang.toUpperCase()} homepage misses UA hreflang`);
    if (!html.includes(`hreflang="ru-UA" href="${SITE}/ru/"`)) fail(`${lang.toUpperCase()} homepage misses RU hreflang`);
    if (!html.includes(`hreflang="x-default" href="${SITE}/ua/"`)) fail(`${lang.toUpperCase()} homepage has wrong x-default hreflang`);
  }
}

function checkLandings() {
  const hub = requireFile(rel('borfrezy', 'index.html'), 'Burr hub page');
  if (hub && !htmlHasCanonical(hub, `${SITE}/ua/borfrezy/`)) {
    fail('Legacy burr hub page should canonicalize to UA URL');
  }
  for (const lang of LANGS) {
    const langHub = requireFile(rel(lang, 'borfrezy', 'index.html'), `${lang.toUpperCase()} burr hub page`);
    if (langHub && !htmlHasCanonical(langHub, `${SITE}/${lang}/borfrezy/`)) {
      fail(`${lang.toUpperCase()} burr hub page has missing or wrong canonical`);
    }
    if (langHub && !langHub.includes(`<html lang="${expectedHtmlLang(lang)}">`)) {
      fail(`${lang.toUpperCase()} burr hub page has wrong html lang`);
    }
    if (langHub && !langHub.includes(`<meta property="og:locale" content="${expectedOgLocale(lang)}">`)) {
      fail(`${lang.toUpperCase()} burr hub page has wrong og:locale`);
    }
    if (langHub) {
      expectVisibleText(langHub, lang === 'ua' ? 'Борфрези твердосплавні ВК' : 'Борфрезы твердосплавные ВК', `${lang.toUpperCase()} burr hub page`);
      expectVisibleText(langHub, lang === 'ua' ? 'Циліндрична' : 'Цилиндрическая', `${lang.toUpperCase()} burr hub page`);
      expectVisibleText(langHub, lang === 'ua' ? 'плоский торець' : 'плоский торец', `${lang.toUpperCase()} burr hub page`);
      rejectVisibleText(langHub, lang === 'ua' ? 'Борфрезы твердосплавные ВК' : 'Борфрези твердосплавні ВК', `${lang.toUpperCase()} burr hub page`);
      const [hubLd] = jsonLdObjects(langHub, `${lang.toUpperCase()} burr hub page`);
      const expectedHubName = lang === 'ua' ? 'Борфрези твердосплавні ВК — каталог за формами' : 'Борфрезы твердосплавные ВК — каталог по формам';
      if (hubLd?.name !== expectedHubName) fail(`${lang.toUpperCase()} burr hub page has wrong JSON-LD name`);
      if (lang === 'ru' && hubLd?.description?.includes('твердосплавних')) fail('RU burr hub page has UA JSON-LD description');
    }
  }

  for (const shape of SHAPES) {
    const path = rel(shapePath(shape.key).replace(/^\/+/, ''), 'index.html');
    const html = requireFile(path, `Shape landing ${shape.key}`);
    if (html && !htmlHasCanonical(html, shapeUrl(shape.key, 'ua'))) {
      fail(`Legacy shape landing ${shape.key} should canonicalize to UA URL`);
    }

    for (const lang of LANGS) {
      const langPath = rel(shapePath(shape.key, lang).replace(/^\/+/, ''), 'index.html');
      const langHtml = requireFile(langPath, `${lang.toUpperCase()} shape landing ${shape.key}`);
      if (!langHtml) continue;

      if (!htmlHasCanonical(langHtml, shapeUrl(shape.key, lang))) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} has missing or wrong canonical`);
      }
      if (!langHtml.includes(`<html lang="${expectedHtmlLang(lang)}">`)) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} has wrong html lang`);
      }
      if (!langHtml.includes(`<meta property="og:locale" content="${expectedOgLocale(lang)}">`)) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} has wrong og:locale`);
      }
      expectVisibleText(langHtml, `Борфреза ${lang === 'ua' ? shape.ua : shape.ru}`, `${lang.toUpperCase()} shape landing ${shape.key}`);
      expectVisibleText(langHtml, lang === 'ua' ? 'Типорозміри в наявності' : 'Типоразмеры в наличии', `${lang.toUpperCase()} shape landing ${shape.key}`);
      expectVisibleText(langHtml, lang === 'ua' ? 'Дивитися в каталозі →' : 'Смотреть в каталоге →', `${lang.toUpperCase()} shape landing ${shape.key}`);
      const shapeTitleUa = `Борфреза ${shape.ua}`;
      const shapeTitleRu = `Борфреза ${shape.ru}`;
      if (canRejectAsDistinct(shapeTitleUa, shapeTitleRu)) {
        rejectVisibleText(langHtml, lang === 'ua' ? shapeTitleRu : shapeTitleUa, `${lang.toUpperCase()} shape landing ${shape.key}`);
      }
      const [itemListLd, breadcrumbLd] = jsonLdObjects(langHtml, `${lang.toUpperCase()} shape landing ${shape.key}`);
      const expectedCatalogName = lang === 'ua' ? 'Борфрези' : 'Борфрезы';
      const expectedShapeName = lang === 'ua' ? shape.ua : shape.ru;
      if (itemListLd?.name !== `${expectedCatalogName} ${expectedShapeName} — FLAKS`) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} has wrong ItemList JSON-LD name`);
      }
      if (itemListLd?.itemListElement?.[0]?.item?.name !== (lang === 'ua' ? itemsForShape(shape.key)[0]?.name_ua : itemsForShape(shape.key)[0]?.name_ru)) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} has wrong first Product JSON-LD name`);
      }
      if (breadcrumbLd?.itemListElement?.[1]?.name !== expectedCatalogName || breadcrumbLd?.itemListElement?.[2]?.name !== expectedShapeName) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} has wrong breadcrumb JSON-LD language`);
      }
      if (!langHtml.includes(`hreflang="uk-UA" href="${shapeUrl(shape.key, 'ua')}"`)) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} misses UA hreflang`);
      }
      if (!langHtml.includes(`hreflang="ru-UA" href="${shapeUrl(shape.key, 'ru')}"`)) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} misses RU hreflang`);
      }
      if (langHtml.includes('1 типорозмірів') || langHtml.includes('1 типоразмеров')) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} has broken singular wording`);
      }
      if (!langHtml.includes('art-info-grid')) {
        fail(`${lang.toUpperCase()} shape landing ${shape.key} has no selection/speed info block`);
      }
    }
  }
}

function htmlHasCanonical(html, url) {
  return html.includes(`<link rel="canonical" href="${url}">`);
}

function checkSitemap() {
  const xml = requireFile(rel('sitemap.xml'), 'sitemap.xml');
  if (!xml) return;

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expectedCount = 10 + LANGS.length + (LANGS.length * SHAPES.length) + (LANGS.length * PRODUCTS.length);
  if (locs.length !== expectedCount) {
    fail(`sitemap.xml URL count is ${locs.length}, expected ${expectedCount}`);
  }

  for (const lang of LANGS) {
    if (!locs.includes(`${SITE}/${lang}/borfrezy/`)) fail(`sitemap.xml misses ${lang} hub URL`);
    for (const shape of SHAPES) {
      if (!locs.includes(shapeUrl(shape.key, lang))) fail(`sitemap.xml misses ${lang} shape URL ${shape.key}`);
    }
    for (const product of PRODUCTS) {
      if (!locs.includes(productUrl(product, lang))) fail(`sitemap.xml misses ${lang} product URL ${product.code}`);
    }
  }
}

function checkFeed() {
  const xml = requireFile(rel('feed.xml'), 'feed.xml');
  if (!xml) return;

  const itemCount = (xml.match(/<item>/g) || []).length;
  if (itemCount !== PRODUCTS.length) {
    fail(`feed.xml item count is ${itemCount}, expected ${PRODUCTS.length}`);
  }
  if (xml.includes('/?q=')) {
    fail('feed.xml still contains query-search product links');
  }
  for (const product of PRODUCTS) {
    if (!xml.includes(productUrl(product, 'ru'))) fail(`feed.xml misses RU product URL ${product.code}`);
    if (xml.includes(productUrl(product, 'ua'))) fail(`feed.xml should not link RU feed item to UA product URL ${product.code}`);
    if (!xml.includes(`<g:custom_label_0>shape_${product.shape}</g:custom_label_0>`)) {
      fail(`feed.xml misses shape label for ${product.code}`);
    }
    if (!xml.includes(`<g:custom_label_1>cut_${product.alu ? 'alu' : 'double'}</g:custom_label_1>`)) {
      fail(`feed.xml misses cut label for ${product.code}`);
    }
    if (!xml.includes(`<g:custom_label_2>head_d_${String(product.headD || 0).padStart(2, '0')}</g:custom_label_2>`)) {
      fail(`feed.xml misses head diameter label for ${product.code}`);
    }
  }
}

checkHomePages();
checkProducts();
checkLandings();
checkSitemap();
checkFeed();

if (errors.length) {
  console.error(`SEO check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO check passed: ${PRODUCTS.length} products, ${SHAPES.length} shape landings, sitemap and feed are consistent.`);
