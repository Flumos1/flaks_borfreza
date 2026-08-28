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
    if (!xml.includes(productUrl(product, 'ua'))) fail(`feed.xml misses canonical UA product URL ${product.code}`);
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
