import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PRODUCTS, SHAPES } from '../src/data/burr-data.js';
import { SITE, productPath, productUrl, shapePath, shapeUrl } from '../src/data/site-urls.js';

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
    if (!html) continue;

    if (!html.includes(`<link rel="canonical" href="${productUrl(product)}">`)) {
      fail(`Product ${product.code} has missing or wrong canonical`);
    }
    if (!html.includes('"@type":"Product"')) {
      fail(`Product ${product.code} has no Product JSON-LD`);
    }
    if (!html.includes(`"sku":"${product.code}"`)) {
      fail(`Product ${product.code} JSON-LD sku is missing`);
    }
  }
}

function checkLandings() {
  const hub = requireFile(rel('borfrezy', 'index.html'), 'Burr hub page');
  if (hub && !htmlHasCanonical(hub, `${SITE}/borfrezy/`)) {
    fail('Burr hub page has missing or wrong canonical');
  }

  for (const shape of SHAPES) {
    const path = rel(shapePath(shape.key).replace(/^\/+/, ''), 'index.html');
    const html = requireFile(path, `Shape landing ${shape.key}`);
    if (!html) continue;

    if (!htmlHasCanonical(html, shapeUrl(shape.key))) {
      fail(`Shape landing ${shape.key} has missing or wrong canonical`);
    }
    if (html.includes('1 типорозмірів') || html.includes('1 типоразмеров')) {
      fail(`Shape landing ${shape.key} has broken singular wording`);
    }
    if (!html.includes('art-info-grid')) {
      fail(`Shape landing ${shape.key} has no selection/speed info block`);
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
  const expectedCount = 10 + SHAPES.length + PRODUCTS.length;
  if (locs.length !== expectedCount) {
    fail(`sitemap.xml URL count is ${locs.length}, expected ${expectedCount}`);
  }

  for (const shape of SHAPES) {
    if (!locs.includes(shapeUrl(shape.key))) fail(`sitemap.xml misses shape URL ${shape.key}`);
  }
  for (const product of PRODUCTS) {
    if (!locs.includes(productUrl(product))) fail(`sitemap.xml misses product URL ${product.code}`);
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
    if (!xml.includes(productUrl(product))) fail(`feed.xml misses product URL ${product.code}`);
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
