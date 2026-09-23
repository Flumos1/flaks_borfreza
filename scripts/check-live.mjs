import { PRODUCTS } from '../src/data/burr-data.js';
import { availableQuantity } from '../src/data/checkout.js';
import { productPath } from '../src/data/site-urls.js';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'https://borfrezy.in.ua';
const errors = [];
let checked = 0;
let cursor = 0;
const tasks = PRODUCTS.flatMap((product) => ['ru', 'ua'].map((lang) => ({ product, lang })));
async function worker() {
  while (cursor < tasks.length) {
    const { product, lang } = tasks[cursor++];
    const path = productPath(product, lang);
    try {
      const res = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
      const html = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (new URL(res.url).pathname !== path) throw new Error('Unexpected redirect');
      const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
        .map((match) => JSON.parse(match[1])).find((block) => block['@type'] === 'Product');
      if (data?.sku !== product.code) throw new Error('Wrong product');
      if (Number(data.offers?.price) !== product.price) throw new Error('Wrong price');
      if (!data.offers?.availability.endsWith(availableQuantity(product) ? '/InStock' : '/OutOfStock')) throw new Error('Wrong availability');
      if (availableQuantity(product) && !html.includes(`href="/${lang}/?add=${encodeURIComponent(product.code)}#catalog"`)) throw new Error('Missing buy link');
      checked++;
    } catch (error) { errors.push({ path, error: error.message }); }
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
for (const path of ['/', '/ru/', '/ua/', '/feed.xml', '/sitemap.xml', '/robots.txt', '/dostavka/?lang=ru', '/povernennya/?lang=ru']) {
  try {
    const res = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.arrayBuffer();
    checked++;
  } catch (error) { errors.push({ path, error: error.message }); }
}
const report = { generatedAt: new Date().toISOString(), base, checked, errors };
await mkdir('reports', { recursive: true });
await writeFile('reports/live-check.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = errors.length ? 1 : 0;
