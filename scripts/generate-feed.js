// Генератор Google Merchant Center XML-фида
// Запуск: npm run feed
import { PRODUCTS, SHAPES } from '../src/data/burr-data.js';
import { SITE, productUrl } from '../src/data/site-urls.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAND = 'FLAKS';

const esc = (s) => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const money = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

function desc(p) {
  const shape = SHAPES.find(s => s.key === p.shape);
  const sName = shape ? shape.ru : p.shape;
  const dim   = p.headD ? `Ø головки ${p.headD}×${p.headL} мм, хвостовик Ø${p.shankD} мм. ` : '';
  const cut   = p.alu ? 'По алюминию' : 'Двойная насечка (крест)';
  return `Борфреза твердосплавная ВК ${sName}. ${dim}Насечка: ${cut}. Материал: твёрдый сплав ВК. Бренд: FLAKS.`;
}

function ptype(p) {
  if (p.alu) return 'Борфрезы > По алюминию';
  const shape = SHAPES.find(s => s.key === p.shape);
  return `Борфрезы > ${shape ? shape.ru : p.shape}`;
}

function link(p) {
  return p.code ? productUrl(p, 'ru') : `${SITE}/ru/#catalog`;
}

function cutKey(p) {
  return p.alu ? 'alu' : 'double';
}

const items = PRODUCTS.map(p => `  <item>
    <g:id>${esc(`FLAKS-${p.id}`)}</g:id>
    <g:title>${esc(p.name_ru)}</g:title>
    <g:description>${esc(desc(p))}</g:description>
    <g:link>${esc(link(p))}</g:link>
    <g:image_link>${esc(p.img)}</g:image_link>
    <g:price>${money(p.price)} UAH</g:price>
    <g:availability>in_stock</g:availability>
    <g:brand>${BRAND}</g:brand>
    <g:condition>new</g:condition>
    <g:mpn>${esc(p.code || `FLAKS-${p.id}`)}</g:mpn>
    <g:product_type>${esc(ptype(p))}</g:product_type>
    <g:custom_label_0>shape_${esc(p.shape)}</g:custom_label_0>
    <g:custom_label_1>cut_${cutKey(p)}</g:custom_label_1>
    <g:custom_label_2>head_d_${String(p.headD || 0).padStart(2, '0')}</g:custom_label_2>
  </item>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>FLAKS — Борфрезы твердосплавные</title>
    <link>${SITE}</link>
    <description>Твердосплавные борфрезы (шарошки) ВК. 16 форм, Ø 6–25 мм, хвостовик 6 мм.</description>
${items}
  </channel>
</rss>`;

const out = join(__dirname, '../public/feed.xml');
writeFileSync(out, xml, 'utf8');
console.log(`✓ feed.xml: ${PRODUCTS.length} позиций → ${out}`);
