import { PRODUCTS, SHAPES } from '../src/data/burr-data.js';
import { SITE, LANGS, productUrl, shapeUrl } from '../src/data/site-urls.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TODAY = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const staticPages = [
  { loc: `${SITE}/ua/`, priority: '1.0', changefreq: 'weekly', localized: true },
  { loc: `${SITE}/ru/`, priority: '1.0', changefreq: 'weekly', localized: true },
  { loc: `${SITE}/dostavka/`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${SITE}/povernennya/`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${SITE}/articles/`, priority: '0.7', changefreq: 'monthly' },
  { loc: `${SITE}/articles/yak-vybrat-borfrezu.html`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/articles/borfrezy-po-aluminiu.html`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/articles/zachystka-zvarnykh-shviv.html`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/articles/oberty-borfrezy.html`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/articles/resurs-borfrezy.html`, priority: '0.8', changefreq: 'monthly' },
];

const hubPages = LANGS.map((lang) => ({
  loc: `${SITE}/${lang}/borfrezy/`,
  priority: '0.9',
  changefreq: 'weekly',
  localized: true,
}));

const shapePages = LANGS.flatMap((lang) => SHAPES.map((shape) => ({
  loc: shapeUrl(shape.key, lang),
  priority: '0.8',
  changefreq: 'weekly',
  localized: true,
})));

const productPages = LANGS.flatMap((lang) => PRODUCTS.map((product) => ({
  loc: productUrl(product, lang),
  priority: '0.7',
  changefreq: 'weekly',
  localized: true,
})));

function alternates(loc) {
  const langMatch = loc.match(/^https:\/\/borfrezy\.in\.ua\/(ua|ru)(\/.*)?$/);
  if (langMatch) {
    const suffix = langMatch[2] || '/';
    return `    <xhtml:link rel="alternate" hreflang="uk-UA" href="${esc(`${SITE}/ua${suffix}`)}"/>
    <xhtml:link rel="alternate" hreflang="ru-UA" href="${esc(`${SITE}/ru${suffix}`)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(`${SITE}/ua${suffix}`)}"/>`;
  }
  return `    <xhtml:link rel="alternate" hreflang="uk-UA" href="${esc(loc)}?lang=ua"/>
    <xhtml:link rel="alternate" hreflang="ru-UA" href="${esc(loc)}?lang=ru"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(loc)}"/>`;
}

function entry(page) {
  return `  <url>
    <loc>${esc(page.loc)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
${alternates(page.loc)}
  </url>`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...staticPages, ...hubPages, ...shapePages, ...productPages].map(entry).join('\n\n')}
</urlset>
`;

const out = join(__dirname, '../public/sitemap.xml');
writeFileSync(out, xml, 'utf8');
console.log(`Generated sitemap.xml: ${staticPages.length + hubPages.length + shapePages.length + productPages.length} URLs -> ${out}`);
