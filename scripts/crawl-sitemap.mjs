// Live SEO crawl: every sitemap URL -> status, canonical, hreflang, title/description,
// JSON-LD validity and Product offers; plus legacy canonicals and ?lang= redirects.
// Usage: node scripts/crawl-sitemap.mjs [base]   (prints grouped issues only)
const BASE = process.argv[2] || 'https://borfrezy.in.ua';
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const issues = [];
const stats = { urls: urls.length, product: 0, withProductLd: 0, withReturnPolicy: 0, withShipping: 0, withBreadcrumb: 0 };
const attr = (tag, name) => (tag.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];

async function check(url) {
  const r = await fetch(url, { redirect: 'manual' });
  if (r.status !== 200) { issues.push(`${url} -> HTTP ${r.status} ${r.headers.get('location') || ''}`); return; }
  const html = await r.text();
  const canon = attr((html.match(/<link[^>]+rel="canonical"[^>]*>/) || [''])[0], 'href');
  if (!canon) issues.push(`${url} -> no canonical`);
  else if (canon !== url) issues.push(`${url} -> canonical points elsewhere: ${canon}`);
  const alts = [...html.matchAll(/<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]*>/g)].map((m) => [m[1], attr(m[0], 'href')]);
  const langs = alts.map(([l]) => l);
  if (/\/(ua|ru)\//.test(url) && !(langs.includes('uk-UA') && langs.includes('ru-UA') && langs.includes('x-default'))) {
    issues.push(`${url} -> hreflang set incomplete: ${langs.join(',') || 'none'}`);
  }
  if (alts.length && !alts.some(([, h]) => h === url)) issues.push(`${url} -> hreflang has no self-reference`);
  if (!/<title>[^<]{10,}<\/title>/.test(html)) issues.push(`${url} -> missing/short <title>`);
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) issues.push(`${url} -> missing/short meta description`);
  if (/noindex/i.test(html.match(/<meta[^>]+robots[^>]*>/i)?.[0] || '')) issues.push(`${url} -> noindex!`);
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const parsed = [];
  for (const raw of lds) { try { parsed.push(JSON.parse(raw)); } catch (e) { issues.push(`${url} -> invalid JSON-LD: ${e.message}`); } }
  const flat = parsed.flatMap((x) => (x['@graph'] ? x['@graph'] : [x]));
  const isProduct = /\/borfrezy\/[a-z]{1,2}\d{4}m06\/$/.test(url);
  if (isProduct) {
    stats.product++;
    const p = flat.find((x) => x['@type'] === 'Product');
    if (!p) { issues.push(`${url} -> product page without Product JSON-LD`); return; }
    stats.withProductLd++;
    const o = Array.isArray(p.offers) ? p.offers[0] : p.offers;
    for (const k of ['name', 'image', 'sku']) if (!p[k]) issues.push(`${url} -> Product.${k} missing`);
    if (!o?.price || !o?.priceCurrency || !o?.availability) issues.push(`${url} -> Offer price/currency/availability missing`);
    if (o?.hasMerchantReturnPolicy) stats.withReturnPolicy++;
    if (o?.shippingDetails) stats.withShipping++;
    const visiblePrice = (html.replace(/<script[\s\S]*?<\/script>/g, '').match(/data-price="([\d.]+)"/) || [])[1];
    if (visiblePrice && o?.price && Number(visiblePrice) !== Number(o.price)) issues.push(`${url} -> price mismatch page ${visiblePrice} vs LD ${o.price}`);
  }
  if (flat.some((x) => x['@type'] === 'BreadcrumbList')) stats.withBreadcrumb++;
}

let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < urls.length) { const u = urls[i++]; try { await check(u); } catch (e) { issues.push(`${u} -> fetch error ${e.message}`); } } }));
// legacy URLs must canonicalize to the /ua/ version
for (const legacy of ['/borfrezy/t1205m06/', '/borfrezy/cilindrichna/', '/borfrezy/']) {
  const html = await (await fetch(BASE + legacy)).text();
  const canon = attr((html.match(/<link[^>]+rel="canonical"[^>]*>/) || [''])[0], 'href');
  if (!canon || !canon.includes('/ua/')) issues.push(`legacy ${legacy} -> canonical ${canon || 'none'}`);
}
for (const [from, to] of [['/?lang=ru', '/ru/'], ['/borfrezy/t1205m06/?lang=ru', '/ru/borfrezy/t1205m06/']]) {
  const r = await fetch(BASE + from, { redirect: 'manual' });
  const loc = r.headers.get('location') || '';
  if (!(r.status === 308 || r.status === 301) || !loc.endsWith(to)) issues.push(`redirect ${from} -> ${r.status} ${loc} (want ${to})`);
}
const grouped = {};
for (const s of issues) { const key = s.replace(/^\S+ -> /, '').replace(/\d{3,}/g, 'N').slice(0, 70); (grouped[key] ||= []).push(s.split(' -> ')[0]); }
console.log(JSON.stringify({ stats, issueCount: issues.length, groups: Object.entries(grouped).map(([k, v]) => ({ issue: k, count: v.length, sample: v.slice(0, 3) })) }, null, 1));
