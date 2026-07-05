// ============================================================
// FLAKS · Борфрезы — приложение (реальные данные с прайса)
// ============================================================
import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { SHAPES, CUTS, PRODUCTS, STRINGS } from './data/burr-data.js'
import { MIN_ORDER } from './data/constants.js'
import { BurrShape } from './components/BurrShape.jsx'
import { MotionCtx, Reveal, CountUp, RingSeal } from './motion/motion.jsx'
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor,
} from './tweaks/tweaks-panel.jsx'

const PHONE_RAW = "380675453115";          // 067 545 31 15
const EMAIL = "tpolegat@gmail.com";
const TG_LINK = "https://t.me/+380675453115"; // прямой чат для связи (используется в шапке, контактах, модалке)
const shapeByKey = (k) => SHAPES.find((s) => s.key === k);
const hexToRgba = (hex, a) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
};
const priceFmt = (n) => Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
const catName = (p, lang) => {
  const s = shapeByKey(p.shape); if (!s) return p.shape;
  return lang === "ua" ? s.ua : s.ru;
};
const letterOf = (p) => (shapeByKey(p.shape) || {}).letter || p.shape;
const cutLabel = (p, lang) => (CUTS[p.cut] || CUTS.double)[lang];
const dimStr = (p) => (p.headD ? `Ø${p.headD}×${p.headL}` : "—");

// ─────────── ICONS ───────────
const I = {
  phone:(p)=><svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 011 1.2 2 2 0 013 0h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L6.1 7.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.8.7a2 2 0 011.7 2z"/></svg>,
  mail:(p)=><svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/></svg>,
  search:(p)=><svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  cart:(p)=><svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6"/></svg>,
  tg:(p)=><svg width={p.s||18} height={p.s||18} viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.3-.1-.5-.6-.2L5.5 13 .7 11.5c-1-.3-1.1-1 .2-1.5l19.4-7.5c.9-.3 1.7.2 1.4 1.8z"/></svg>,
  pin:(p)=><svg width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
  arrow:(p)=><svg className="arr" width={p.s||16} height={p.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>,
  check:(p)=><svg width={p.s||14} height={p.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  layers:()=><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>,
  zap:()=><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h7l-1 8 10-12h-7l1-8L4 14Z"/></svg>,
  truck:()=><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a1 1 0 0 0-1-1H2v13"/><path d="M14 9h4l4 4v5h-8"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>,
  msg:()=><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 20l1-3.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/></svg>,
};
const PILLAR_ICONS = { forms: I.layers, cut: I.zap, ship: I.truck, help: I.msg };

// фото товара с откатом на SVG-схему
function ProdImage({ p, size, flutes, photos, sw, frame }) {
  const [err, setErr] = useState(false);
  if (photos && p.img && !err) {
    const img = <img src={p.img} alt="" loading="lazy" onError={() => setErr(true)}
      style={{ maxWidth: "100%", maxHeight: (size * 0.6) + "px", objectFit: "contain", display: "block" }} />;
    if (frame) {
      return <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", maxWidth: "100%", background: "#f4f5f7", borderRadius: "4px", padding: "8px", boxSizing: "border-box" }}>{img}</div>;
    }
    return img;
  }
  return <BurrShape type={p.shape} size={size} strokeWidth={sw || 2.4} flutes={flutes} />;
}

// ─────────── HEADER ───────────
function Header({ t, lang, setLang, cartCount, openCart, onNav }) {
  return (
    <header className="bf-header">
      <div className="bf-htop"><div className="wrap bf-htop-in">
        <div className="bf-contacts">
          <a href={`tel:+${PHONE_RAW}`} className="bf-toplink"><I.phone s={14}/> {t.top_phone}</a>
          <a href={TG_LINK} target="_blank" rel="noopener noreferrer" className="bf-toplink tg"><I.tg s={14}/> Telegram</a>
          <span className="bf-topcity"><I.pin s={13}/> {t.top_city}</span>
        </div>
        <div className="bf-lang-sw">
          <button className={"bf-lang"+(lang==="ua"?" active":"")} onClick={()=>setLang("ua")}>UA</button>
          <button className={"bf-lang"+(lang==="ru"?" active":"")} onClick={()=>setLang("ru")}>RU</button>
        </div>
      </div></div>
      <div className="bf-hmain"><div className="wrap bf-hmain-in">
        <a href="#top" className="bf-logo" onClick={(e)=>{e.preventDefault();onNav("top");}}>
          <span className="bf-logo-mark">F</span>
          <span><span className="bf-logo-name">FLAKS</span><span className="bf-logo-sub">{t.foot_tag}</span></span>
        </a>
        <nav className="bf-nav">
          <a href="#shapes" onClick={(e)=>{e.preventDefault();onNav("shapes");}}>{t.nav_shapes}</a>
          <a href="#catalog" onClick={(e)=>{e.preventDefault();onNav("catalog");}}>{t.nav_catalog}</a>
          <a href="#about" onClick={(e)=>{e.preventDefault();onNav("about");}}>{t.nav_about}</a>
          <a href="#delivery" onClick={(e)=>{e.preventDefault();onNav("delivery");}}>{t.nav_delivery}</a>
          <a href="#articles" onClick={(e)=>{e.preventDefault();onNav("articles");}}>{t.nav_articles}</a>
          <a href="#contact" onClick={(e)=>{e.preventDefault();onNav("contact");}}>{t.nav_contact}</a>
        </nav>
        <button className="bf-cartbtn" onClick={openCart} aria-label={t.cart}>
          <I.cart/>{cartCount > 0 && <span className="bf-cartbadge">{cartCount}</span>}
        </button>
        <a href="#contact" className="bf-cta" onClick={(e)=>{e.preventDefault();onNav("contact");}}>{t.lead}</a>
      </div></div>
    </header>
  );
}

// ─────────── TICKER ───────────
function Ticker({ t, lang }) {
  const facts = lang === "ua"
    ? ["16 форм головки", "Твердосплав ВК", "Ø головки 6–25 мм", "Хвостовик 6 мм", "Подвійна насічка", "Відправка в день замовлення", "Нова Пошта по Україні", "Гуртом і вроздріб"]
    : ["16 форм головки", "Твёрдосплав ВК", "Ø головки 6–25 мм", "Хвостовик 6 мм", "Двойная насечка", "Отправка в день заказа", "Новая Почта по Украине", "Оптом и в розницу"];
  const row = (key) => (
    <div className="bf-ticker-track" aria-hidden={key === "b" ? "true" : undefined}>
      {[...facts, ...facts].map((f, i) => (
        <span key={key + i} className="bf-ticker-item"><b>{f}</b><span className="bf-ticker-dot"/></span>
      ))}
    </div>
  );
  return <div className="bf-ticker">{row("a")}</div>;
}

// ─────────── HERO ───────────
function Hero({ t, flutes, onNav }) {
  return (
    <section className="bf-hero" id="top">
      <div className="bf-noise"/>
      <picture>
        <source srcSet="/assets/logo-flaks.webp" type="image/webp"/>
        <img className="bf-hero-emblem" src="/assets/logo-flaks.png" alt="" aria-hidden="true" width="560" height="305" fetchpriority="high"/>
      </picture>
      <div className="wrap bf-hero-inner">
        <Reveal tag="p" className="bf-hero-kicker">{t.hero_kicker}</Reveal>
        <Reveal tag="h1" className="bf-hero-title" delay={60}>{t.hero_title}</Reveal>
        <Reveal tag="p" className="bf-hero-sub" delay={120}>{t.hero_sub}</Reveal>
        <Reveal tag="p" className="bf-hero-desc" delay={180}>{t.hero_desc}</Reveal>
        <Reveal className="bf-hero-actions" delay={240}>
          <a href="#shapes" className="bf-btn" onClick={(e)=>{e.preventDefault();onNav("shapes");}}>{t.hero_cta1} <I.arrow/></a>
          <a href={TG_LINK} target="_blank" rel="noopener noreferrer" className="bf-btn-tg"><I.tg/> {t.hero_cta2}</a>
        </Reveal>
        <Reveal className="bf-hero-stats" delay={320}>
          <div><span className="bf-stat-n"><CountUp value={t.stat1_n}/></span><span className="bf-stat-l">{t.stat1_l}</span></div>
          <div className="bf-stat-div"/>
          <div><span className="bf-stat-n">{t.stat2_n}</span><span className="bf-stat-l">{t.stat2_l}</span></div>
          <div className="bf-stat-div"/>
          <div><span className="bf-stat-n">{t.stat3_n}</span><span className="bf-stat-l">{t.stat3_l}</span></div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────── SHAPE SELECTOR ───────────
function ShapeSelector({ t, lang, shape, setShape, counts, flutes, refEl }) {
  return (
    <section className="bf-sec bf-shapes" id="shapes" ref={refEl}>
      <div className="wrap">
        <Reveal tag="div" className="bf-sechead">
          <p className="eyebrow">{t.shapes_eyebrow}</p>
          <h2 className="bf-sectitle">{t.shapes_title}</h2>
          <p className="bf-secsub">{t.shapes_sub}</p>
        </Reveal>
        <Reveal tag="div" className="bf-shape-grid" delay={80}>
          <button className={"bf-shape all" + (shape === "all" ? " on" : "")} onClick={() => setShape("all")}>
            <span className="bf-shape-allnum">{counts.all}</span>
            <span className="bf-shape-name">{t.shapes_all}</span>
            <span className="bf-shape-sub">{lang === "ua" ? "усі типи в наявності" : "все типы в наличии"}</span>
          </button>
          {SHAPES.map((s) => (
            <button key={s.key} className={"bf-shape" + (shape === s.key ? " on" : "")} onClick={() => setShape(s.key)}>
              <span className="bf-shape-letter">{s.letter}</span>
              <span className="bf-shape-art"><BurrShape type={s.key} size={118} strokeWidth={2.8} flutes={flutes}/></span>
              <span className="bf-shape-name">{lang === "ua" ? s.ua : s.ru}</span>
              <span className="bf-shape-sub">{lang === "ua" ? s.ua_sub : s.ru_sub}</span>
              <span className="bf-shape-count">{counts[s.key] || 0} {t.pcs}</span>
            </button>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ─────────── GUIDE (как подобрать форму) ───────────
function Guide({ t, lang, onPick, flutes }) {
  return (
    <section className="bf-sec bf-guide" id="guide">
      <div className="wrap">
        <Reveal tag="div" className="bf-sechead">
          <p className="eyebrow">{t.guide_eyebrow}</p>
          <h2 className="bf-sectitle">{t.guide_title}</h2>
          <p className="bf-secsub">{t.guide_sub}</p>
        </Reveal>
        <div className="bf-guide-grid">
          {t.guide_rows.map(([task, forms], i) => (
            <Reveal key={i} tag="div" className="bf-guide-card" delay={(i % 4) * 70} onClick={() => onPick(forms[0])}>
              <div className="bf-guide-task">{task}</div>
              <div className="bf-guide-forms">
                {forms.map((f) => {
                  const s = shapeByKey(f);
                  return (
                    <button key={f} className="bf-guide-form" title={s ? (lang==="ua"?s.ua:s.ru) : f}
                      onClick={(e) => { e.stopPropagation(); onPick(f); }}>
                      <BurrShape type={f} size={56} strokeWidth={3.2} flutes={flutes}/>
                      <span className="bf-guide-letter">{f}</span>
                    </button>
                  );
                })}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────── CATALOG ───────────
function Catalog({ t, lang, shape, setShape, view, setView, cart, onAdd, onOpen, flutes, photos, refEl }) {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [sort, setSort] = useState(() => new URLSearchParams(window.location.search).get("sort") || "default");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [shape, query, sort, view]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (query) p.set("q", query); else p.delete("q");
    if (sort !== "default") p.set("sort", sort); else p.delete("sort");
    const qs = p.toString();
    window.history.replaceState({}, "", qs ? "?" + qs : window.location.pathname);
  }, [query, sort]);

  const filtered = useMemo(() => {
    let r = PRODUCTS;
    if (shape !== "all") r = r.filter((p) => p.shape === shape);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((p) => (lang === "ua" ? p.name_ua : p.name_ru).toLowerCase().includes(q)
        || (p.code || "").toLowerCase().includes(q)
        || catName(p, lang).toLowerCase().includes(q)
        || (p.headD && String(p.headD).includes(q)));
    }
    r = [...r];
    if (sort === "d-asc") r.sort((a,b)=>(a.headD||0)-(b.headD||0)||a.price-b.price);
    if (sort === "d-desc") r.sort((a,b)=>(b.headD||0)-(a.headD||0)||a.price-b.price);
    if (sort === "p-asc") r.sort((a,b)=>a.price-b.price);
    if (sort === "p-desc") r.sort((a,b)=>b.price-a.price);
    return r;
  }, [shape, query, sort, lang]);

  const perPage = view === "cards" ? 9 : 12;
  const totalPages = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice((page-1)*perPage, page*perPage);
  const inCart = (id) => cart.some((c) => c.id === id);
  const activeShape = shape !== "all" ? shapeByKey(shape) : null;

  return (
    <section className="bf-sec bf-catalog" id="catalog" ref={refEl}>
      <div className="wrap">
        <Reveal tag="div" className="bf-sechead">
          <p className="eyebrow">{t.catalog_eyebrow}</p>
          <h2 className="bf-sectitle">{t.catalog_title}</h2>
          <p className="bf-secsub">{t.catalog_sub}</p>
        </Reveal>

        <div className="bf-toolbar">
          <div className="bf-search">
            <span className="bf-search-ico"><I.search/></span>
            <input className="bf-search-in" placeholder={t.search} value={query} onChange={(e)=>setQuery(e.target.value)}/>
          </div>
          <div className="bf-sort">
            <span className="bf-sort-l">{t.sort}</span>
            <select className="bf-sort-s" aria-label={t.sort} value={sort} onChange={(e)=>setSort(e.target.value)}>
              <option value="default">{t.sort_default}</option>
              <option value="d-asc">{t.sort_d_asc}</option>
              <option value="d-desc">{t.sort_d_desc}</option>
              <option value="p-asc">{t.sort_p_asc}</option>
              <option value="p-desc">{t.sort_p_desc}</option>
            </select>
          </div>
          <div className="bf-view">
            <button className={view === "table" ? "on" : ""} onClick={()=>setView("table")}>{t.view_table}</button>
            <button className={view === "cards" ? "on" : ""} onClick={()=>setView("cards")}>{t.view_cards}</button>
          </div>
        </div>

        <div className="bf-results">
          <span className="bf-results-l"><b>{filtered.length}</b> {t.found}</span>
          {activeShape && (
            <span className="bf-activefilter">
              {lang === "ua" ? activeShape.ua : activeShape.ru} · {activeShape.letter}
              <button onClick={()=>setShape("all")} aria-label={t.reset}>✕</button>
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="bf-empty">
            <div className="bf-empty-ico"><I.search s={40}/></div>
            <h3>{t.empty_title}</h3><p>{t.empty_sub}</p>
          </div>
        ) : view === "table" ? (
          <div className="bf-tablewrap">
            <table className="bf-table">
              <thead><tr>
                <th>{t.col_name}</th><th className="c">{t.col_shape}</th><th>{t.col_dim}</th>
                <th>{t.col_cut}</th><th>{t.col_stock}</th><th className="r">{t.col_price}</th><th></th>
              </tr></thead>
              <tbody>
                {pageData.map((p) => (
                  <tr key={p.id} onClick={()=>onOpen(p)}>
                    <td><div className="bf-tname">
                      <span className="bf-tglyph"><BurrShape type={p.shape} size={48} strokeWidth={3} flutes={flutes}/></span>
                      <span className="bf-tname-txt">
                        <span className="bf-tname-main">{catName(p, lang)}{p.alu ? " · Al" : ""}</span>
                        <span className="bf-tname-meta">{p.code ? p.code + " · " : ""}{t.mat}</span>
                      </span>
                    </div></td>
                    <td className="c"><span className="bf-tag">{letterOf(p)}</span></td>
                    <td><span className="bf-tdim">{dimStr(p)}</span><br/><span className="bf-tcut">хв. Ø{p.shankD} {t.mm}</span></td>
                    <td><span className="bf-tcut">{cutLabel(p, lang)}</span></td>
                    <td><span className="bf-tqty"><span className="bf-tstockdot"/>{t.in_stock}</span></td>
                    <td className="r"><span className="bf-tprice">{priceFmt(p.price)}</span></td>
                    <td className="r" onClick={(e)=>e.stopPropagation()}>
                      <button className={"bf-add" + (inCart(p.id) ? " in" : "")} onClick={()=>onAdd(p)}>
                        {inCart(p.id) ? <I.check s={14}/> : "+"} {inCart(p.id) ? (lang==="ua"?"Додано":"Добавлено") : t.add}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bf-cards">
            {pageData.map((p) => (
              <div key={p.id} className="bf-card" onClick={()=>onOpen(p)}>
                <div className="bf-card-top">
                  <span className="bf-card-cat">{catName(p, lang)} · {letterOf(p)}</span>
                  <span className="bf-card-stock"><span className="bf-tstockdot"/>{t.in_stock}</span>
                </div>
                <div className="bf-card-art"><ProdImage p={p} size={150} sw={2.6} flutes={flutes} photos={photos} frame/></div>
                <div className="bf-card-name">{dimStr(p)}{p.headD ? " · хв." + p.shankD : ""}</div>
                <div className="bf-card-specs">
                  <span>{cutLabel(p, lang)}</span>
                  {p.code && <span>{p.code}</span>}
                  <span>ВК</span>
                </div>
                <div className="bf-card-foot">
                  <span className="bf-card-price">{priceFmt(p.price)}<small>грн</small></span>
                  <button className={"bf-add" + (inCart(p.id) ? " in" : "")} onClick={(e)=>{e.stopPropagation();onAdd(p);}}>
                    {inCart(p.id) ? <I.check s={14}/> : "+"} {inCart(p.id) ? (lang==="ua"?"Додано":"Добавлено") : t.add}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="bf-pag">
            {Array.from({length: totalPages}, (_,i)=>i+1).map((n) => (
              <button key={n} className={"bf-page" + (n === page ? " on" : "")} onClick={()=>{ setPage(n); refEl.current && refEl.current.scrollIntoView({behavior:"smooth",block:"start"}); }}>{n}</button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────── ABOUT ───────────
function About({ t, lang }) {
  return (
    <section className="bf-sec bf-about" id="about">
      <div className="wrap bf-about-grid">
        <Reveal tag="div">
          <p className="eyebrow">{t.about_eyebrow}</p>
          <h2 className="bf-sectitle">{t.about_title}</h2>
          <p className="lead">{t.about_desc}</p>
          <div className="bf-about-seal-row">
            <RingSeal size={132}/>
            <div className="bf-about-seal-cap">
              <span className="bf-about-seal-t">FLAKS Tool Solutions</span>
              <span className="bf-about-seal-s">{lang==="ua"?"Професійний інструмент · гарантія якості":"Профессиональный инструмент · гарантия качества"}</span>
            </div>
          </div>
          <ul className="bf-checks">
            {t.checks.map((c,i)=><li key={i}><span className="n">{String(i+1).padStart(2,"0")}</span><span>{c}</span></li>)}
          </ul>
        </Reveal>
        <div className="bf-pillars">
          {t.pillars.map(([key,h,b],i)=>{ const Ico = PILLAR_ICONS[key]||I.layers;
            return <Reveal key={i} tag="div" className="bf-pillar" delay={(i%2)*80}><div className="bf-pillar-ico"><Ico/></div><h3>{h}</h3><p>{b}</p></Reveal>;
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────── CONTACT ───────────
function Contact({ t, lang }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [company, setCompany] = useState(""); // honeypot — заполняют только боты
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const items = [
    [I.phone, t.c_phone, t.top_phone, `tel:+${PHONE_RAW}`, "", false],
    [I.tg, t.c_tg, "+38 (067) 545-31-15", TG_LINK, "tg", true],
    [I.mail, t.c_email, EMAIL, `mailto:${EMAIL}`, "", false],
    [I.pin, t.c_city, t.c_city_val, null, "", false],
  ];
  const submit = async (e) => {
    e.preventDefault();
    if (company) return; // honeypot сработал — тихо игнорируем
    if (!name.trim()) { setErr(lang==="ua"?"Введіть ваше ім'я":"Введите ваше имя"); return; }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setErr(lang==="ua"?"Введіть телефон (мін. 10 цифр)":"Введите телефон (мин. 10 цифр)"); return; }
    setSubmitting(true); setErr("");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          type: "lead", language: lang,
          customer: { name: name.trim(), phone: phone.trim(), comment: msg.trim() },
          company,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      setSent(true); setName(""); setPhone(""); setMsg("");
    } catch {
      setErr(lang==="ua"
        ? "Не вдалося відправити. Спробуйте ще раз або зателефонуйте: +38 (067) 545-31-15"
        : "Не удалось отправить. Попробуйте снова или позвоните: +38 (067) 545-31-15");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section className="bf-sec bf-contact" id="contact">
      <picture>
        <source srcSet="/assets/flaks-disc.webp" type="image/webp"/>
        <img className="bf-contact-wm" src="/assets/flaks-disc.png" alt="" aria-hidden="true" loading="lazy" width="600" height="600"/>
      </picture>
      <div className="wrap bf-contact-grid">
        <Reveal tag="div">
          <p className="eyebrow">{t.contact_eyebrow}</p>
          <h2 className="bf-sectitle">{t.contact_title}</h2>
          <p className="lead">{t.contact_desc}</p>
          <div className="bf-citems">
            {items.map(([Ico,label,val,href,kind,blank],i)=>{
              const inner = <Fragment>
                <span className={"bf-cico"+(kind?" "+kind:"")}><Ico s={18}/></span>
                <span><span className="bf-clabel">{label}</span><span className="bf-cval">{val}</span></span>
              </Fragment>;
              return href ? <a key={i} className="bf-citem" href={href} target={blank?"_blank":undefined} rel={blank?"noopener noreferrer":undefined}>{inner}</a>
                : <div key={i} className="bf-citem">{inner}</div>;
            })}
          </div>
        </Reveal>
        {sent ? (
          <Reveal tag="div" className="bf-form" delay={120}>
            <div className="bf-cart-success-ico"><I.check s={28}/></div>
            <h3 className="bf-form-title">{t.order_sent_title}</h3>
            <p className="bf-fnote">{t.order_sent_desc}</p>
          </Reveal>
        ) : (
        <Reveal tag="form" className="bf-form" delay={120} onSubmit={submit}>
          <h3 className="bf-form-title">{t.form_title}</h3>
          <div className="bf-fg"><label>{t.f_name}</label><input type="text" placeholder={t.f_name_ph} value={name} onChange={(e)=>setName(e.target.value)}/></div>
          <div className="bf-fg"><label>{t.f_phone}</label><input type="tel" placeholder={t.f_phone_ph} value={phone} onChange={(e)=>setPhone(e.target.value)}/></div>
          <div className="bf-fg"><label>{t.f_msg}</label><textarea rows="3" placeholder={t.f_msg_ph} value={msg} onChange={(e)=>setMsg(e.target.value)}></textarea></div>
          <input type="text" name="company" tabIndex={-1} autoComplete="off" value={company} onChange={(e)=>setCompany(e.target.value)} style={{position:"absolute",left:"-9999px",width:1,height:1,opacity:0}} aria-hidden="true"/>
          {err && <p className="bf-order-err">{err}</p>}
          <button type="submit" className="bf-submit" disabled={submitting}><I.tg s={16}/> {submitting ? t.order_sending : t.f_submit}</button>
          <p className="bf-fnote">{t.f_note}</p>
        </Reveal>
        )}
      </div>
    </section>
  );
}

// ─────────── DELIVERY ───────────
function Delivery({ t }) {
  return (
    <section className="bf-sec bf-delivery" id="delivery">
      <div className="wrap">
        <Reveal tag="div" className="bf-sechead">
          <p className="eyebrow">{t.del_eyebrow}</p>
          <h2 className="bf-sectitle">{t.del_title}</h2>
          <p className="bf-secsub">{t.del_sub}</p>
        </Reveal>
        <Reveal tag="div" className="bf-del-steps">
          {t.del_how.map(([n, h, b]) => (
            <div key={n} className="bf-del-step">
              <span className="bf-del-step-n">{n}</span>
              <h3 className="bf-del-step-h">{h}</h3>
              <p className="bf-del-step-b">{b}</p>
            </div>
          ))}
        </Reveal>
        <div className="bf-del-info">
          <Reveal tag="div" className="bf-del-block">
            <div className="bf-del-block-title">{t.del_ship_title}</div>
            <ul className="bf-del-list">
              {t.del_ship_items.map((s,i) => <li key={i}><span className="bf-del-dot"/>{s}</li>)}
            </ul>
          </Reveal>
          <Reveal tag="div" className="bf-del-block" delay={80}>
            <div className="bf-del-block-title">{t.del_pay_title}</div>
            <ul className="bf-del-list">
              {t.del_pay_items.map((s,i) => <li key={i}><span className="bf-del-dot"/>{s}</li>)}
            </ul>
          </Reveal>
          <Reveal tag="div" className="bf-del-block bf-del-wholesale" delay={160}>
            <div className="bf-del-block-title">{t.del_wholesale_title}</div>
            <p className="bf-del-wholesale-desc">{t.del_wholesale_desc}</p>
            <a href={TG_LINK} target="_blank" rel="noopener noreferrer" className="bf-del-wa"><I.tg s={16}/> Telegram</a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─────────── ARTICLES ───────────
function Articles({ t, lang }) {
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === "ua" ? "uk-UA" : "ru-RU", { year: "numeric", month: "long", day: "numeric" });
  };
  return (
    <section className="bf-sec bf-articles" id="articles">
      <div className="wrap">
        <Reveal tag="div" className="bf-sechead">
          <p className="eyebrow">{t.art_eyebrow}</p>
          <h2 className="bf-sectitle">{t.art_title}</h2>
          <p className="bf-secsub">{t.art_sub}</p>
        </Reveal>
        <div className="bf-art-grid">
          {t.articles.map((a) => (
            <Reveal key={a.slug} tag="a" className="bf-art-card" href={`/articles/${a.slug}.html?lang=${lang}`}>
              <div className="bf-art-date">{fmt(a.date)}</div>
              <h3 className="bf-art-title">{lang === "ua" ? a.ua : a.ru}</h3>
              <p className="bf-art-desc">{lang === "ua" ? a.desc_ua : a.desc_ru}</p>
              <span className="bf-art-read">{t.art_read} <I.arrow s={14}/></span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────── FOOTER ───────────
function Footer({ t }) {
  return (
    <footer className="bf-footer"><div className="wrap bf-footer-in">
      <a href="#top" className="bf-logo"><span className="bf-logo-mark">F</span>
        <span><span className="bf-logo-name">FLAKS</span><span className="bf-logo-sub">{t.foot_tag}</span></span></a>
      <picture>
        <source srcSet="/assets/flaks-disc.webp" type="image/webp"/>
        <img className="bf-footer-disc" src="/assets/flaks-disc.png" alt="FLAKS Tool Solutions" loading="lazy" width="600" height="600"/>
      </picture>
      <p className="bf-footer-copy">© 2025–{new Date().getFullYear()} FLAKS · {t.top_city}. {t.foot_rights}</p>
    </div></footer>
  );
}

// Поле количества: держит локальную строку, чтобы её можно было очистить и
// набрать новое значение (без мгновенного «схлопывания» в 1 при стирании).
function QtyInput({ qty, onCommit }) {
  const [raw, setRaw] = useState(String(qty));
  useEffect(() => { setRaw(String(qty)); }, [qty]);
  return (
    <input className="bf-qty-inp" inputMode="numeric" value={raw}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d]/g, "");
        setRaw(v);
        if (v !== "") onCommit(Math.min(9999, Math.max(1, parseInt(v, 10))));
      }}
      onBlur={() => { if (raw === "" || parseInt(raw, 10) < 1) setRaw(String(qty)); }} />
  );
}

// ─────────── CART ───────────
function Cart({ t, lang, open, onClose, items, onQty, onRemove, flutes, onClearCart }) {
  const total = items.reduce((s,i)=>s+i.price*i.qty,0);
  const count = items.reduce((s,i)=>s+i.qty,0);

  const [cName,    setCName]    = useState("");
  const [cPhone,   setCPhone]   = useState("");
  const [cEmail,   setCEmail]   = useState("");
  const [cCity,    setCCity]    = useState("");
  const [cComment, setCComment] = useState("");
  const [company, setCompany] = useState(""); // honeypot — заполняют только боты
  const [submitting, setSubmitting] = useState(false);
  const [sent,  setSent]  = useState(false);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    if (!open) { const id = setTimeout(()=>{ setSent(false); setOrderError(""); }, 350); return ()=>clearTimeout(id); }
  }, [open]);

  const submitOrder = async (e) => {
    e.preventDefault();
    if (company) return; // honeypot сработал — тихо игнорируем
    if (!cName.trim()) { setOrderError(lang==="ua"?"Введіть ваше ім'я":"Введите ваше имя"); return; }
    const digits = cPhone.replace(/\D/g, "");
    if (digits.length < 10) { setOrderError(lang==="ua"?"Введіть повний номер телефону (мін. 10 цифр)":"Введите полный номер телефона (мин. 10 цифр)"); return; }
    if (!cEmail.trim()) { setOrderError(lang==="ua"?"Введіть ваш email":"Введите ваш email"); return; }
    if (!cCity.trim()) { setOrderError(lang==="ua"?"Введіть місто доставки":"Введите город доставки"); return; }
    setSubmitting(true); setOrderError("");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          language: lang,
          customer: { name: cName.trim(), phone: cPhone.trim(), email: cEmail.trim(), city: cCity.trim(), comment: cComment.trim() },
          items: items.map((i)=>({ name_ua:i.name_ua, name_ru:i.name_ru, code:i.code, headD:i.headD, headL:i.headL, qty:i.qty })),
          company,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.error||"error"); }
      setSent(true);
      onClearCart();
    } catch {
      setOrderError(t.order_failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Fragment>
      <div className={"bf-overlay"+(open?" on":"")} onClick={onClose}/>
      <aside className={"bf-cart"+(open?" on":"")}>
        <div className="bf-cart-head">
          <h3 className="bf-cart-title">{t.cart} {count>0 && !sent && <small>{count} {t.positions}</small>}</h3>
          <button className="bf-cart-close" onClick={onClose}>✕</button>
        </div>

        {/* ── items panel ── */}
        {!sent && (
          <div className="bf-cart-panel">
            {items.length === 0 ? (
              <div className="bf-cart-empty"><div className="ico"><I.cart s={46}/></div><p>{t.cart_empty}</p><span>{t.cart_hint}</span></div>
            ) : items.map((it)=>(
              <div key={it.id} className="bf-citemc">
                <span className="bf-citemc-art"><BurrShape type={it.shape} size={46} strokeWidth={3} flutes={flutes}/></span>
                <div className="bf-citemc-body">
                  <div className="bf-citemc-name">{catName(it,lang)} · {dimStr(it)}{it.headD?" · хв."+it.shankD:""}</div>
                  <div className="bf-citemc-row">
                    <div className="bf-qty">
                      <button className="bf-qty-btn" onClick={()=>onQty(it.id, Math.max(1,it.qty-1))}>−</button>
                      <QtyInput qty={it.qty} onCommit={(q)=>onQty(it.id, q)}/>
                      <button className="bf-qty-btn" onClick={()=>onQty(it.id, it.qty+1)}>+</button>
                    </div>
                    <span className="bf-citemc-price">{priceFmt(it.price*it.qty)} грн</span>
                    <button className="bf-citemc-rem" onClick={()=>onRemove(it.id)}>✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── order form ── */}
        {items.length > 0 && !sent && (
          <div className="bf-cart-foot">
            <div className="bf-cart-total"><span className="l">{t.total}</span><span className="v">{priceFmt(total)} грн</span></div>
            {total < MIN_ORDER && (
              <div className="bf-cart-minwarn">
                <b>{t.cart_min_warn} — {MIN_ORDER} грн.</b> {t.cart_min_note}
                <div className="bf-cart-minbar"><div className="bf-cart-minbar-fill" style={{width:Math.min(100,(total/MIN_ORDER)*100)+"%"}}/></div>
              </div>
            )}
            <form className="bf-order-form" onSubmit={submitOrder}>
              <p className="bf-order-form-label">{t.order_form_title}</p>
              <input className="bf-order-inp" placeholder={t.f_name_ph+" *"} value={cName} onChange={(e)=>setCName(e.target.value)}/>
              <input className="bf-order-inp" type="tel" placeholder={t.f_phone_ph+" *"} value={cPhone} onChange={(e)=>setCPhone(e.target.value)}/>
              <input className="bf-order-inp" type="email" placeholder={"Email *"} value={cEmail} onChange={(e)=>setCEmail(e.target.value)}/>
              <input className="bf-order-inp" placeholder={t.f_city_ph+" *"} value={cCity} onChange={(e)=>setCCity(e.target.value)}/>
              <textarea className="bf-order-inp" rows={2} placeholder={t.f_msg_ph} value={cComment} onChange={(e)=>setCComment(e.target.value)}/>
              <input type="text" name="company" tabIndex={-1} autoComplete="off" value={company} onChange={(e)=>setCompany(e.target.value)} style={{position:"absolute",left:"-9999px",width:1,height:1,opacity:0}} aria-hidden="true"/>
              {orderError && <p className="bf-order-err">{orderError}</p>}
              <button type="submit" className="bf-cart-send-tg" disabled={submitting||total<MIN_ORDER}>
                {submitting ? t.order_sending : t.order_submit}
              </button>
            </form>
            <p className="bf-cart-note">{t.order_note_new}</p>
          </div>
        )}

        {/* ── success state ── */}
        {sent && (
          <div className="bf-cart-success-state">
            <div className="bf-cart-success-ico"><I.check s={28}/></div>
            <h4 className="bf-cart-success-title">{t.order_sent_title}</h4>
            <p className="bf-cart-success-desc">{t.order_sent_desc}</p>
            <button className="bf-cart-close-btn" onClick={onClose}>{t.order_close}</button>
          </div>
        )}
      </aside>
    </Fragment>
  );
}

// ─────────── MODAL ───────────
function Modal({ t, lang, p, onClose, onAdd, flutes, photos }) {
  const isOpen = !!p;
  useEffect(() => {
    if (!isOpen) return;                         // слушатель только когда модалка открыта
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";      // блокируем прокрутку фона
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);
  if (!p) return null;
  const s = shapeByKey(p.shape);
  const rows = [
    [t.spec_shape, `${catName(p,lang)} · ${letterOf(p)}`],
    ...(p.code ? [[t.spec_art, p.code]] : []),
    ...(p.headD ? [[t.spec_headD, `Ø${p.headD} ${t.mm}`], [t.spec_headL, `${p.headL} ${t.mm}`], [t.spec_shankD, `Ø${p.shankD} ${t.mm}`]] : []),
    [t.spec_cut, cutLabel(p,lang)],
    [t.spec_mat, t.mat],
    [t.spec_stock, t.in_stock],
  ];
  const useText = s ? (lang==="ua"?s.use_ua:s.use_ru) : null;
  return (
    <div className="bf-modal-overlay" onClick={onClose}>
      <div className="bf-modal" onClick={(e)=>e.stopPropagation()}>
        <button className="bf-modal-close" onClick={onClose}>✕</button>
        <div className="bf-modal-art">
          <span className="bf-modal-art-svg"><ProdImage p={p} size={230} sw={2.2} flutes={flutes} photos={photos} frame={photos && !!p.img}/></span>
          <span className="bf-modal-letter">{(lang==="ua"?"ТИП ":"ТИП ")+letterOf(p)}</span>
        </div>
        <div className="bf-modal-body">
          <div className="bf-modal-cat">{catName(p,lang)}{p.alu?(lang==="ua"?" · по алюмінію":" · по алюминию"):""}</div>
          <h2 className="bf-modal-name">{lang==="ua"?p.name_ua:p.name_ru}</h2>
          <div className="bf-modal-rows">
            {rows.map(([k,v],i)=><div key={i} className="bf-modal-row"><span className="bf-modal-k">{k}</span><span className="bf-modal-v">{v}</span></div>)}
          </div>
          {useText && <div className="bf-modal-use"><div className="l">{t.use_label}</div><p>{useText}</p></div>}
          <div className="bf-modal-price-row">
            <span className="bf-modal-price">{priceFmt(p.price)}</span><span className="bf-modal-unit">грн / {t.pcs}</span>
          </div>
          <div className="bf-modal-actions">
            <a className="bf-modal-wa" href={TG_LINK} target="_blank" rel="noopener noreferrer"><I.tg/> Telegram</a>
            <button className="bf-modal-cart" onClick={()=>{onAdd(p);onClose();}}><I.cart s={18}/> {t.to_cart}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── TWEAKS ───────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#e85d04", "#ff7c2a"],
  "density": "regular",
  "view": "table",
  "flutes": true,
  "photos": true,
  "motion": true
}/*EDITMODE-END*/;

// ─────────── APP ───────────
export default function App() {
  const [tw, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [lang, setLang] = useState(() => {
    const p = new URLSearchParams(window.location.search).get("lang");
    return p === "ru" ? "ru" : "ua";
  });
  const [shape, setShape] = useState(() => {
    return new URLSearchParams(window.location.search).get("shape") || "all";
  });
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const shapesRef = useRef(null);
  const catalogRef = useRef(null);
  const t = STRINGS[lang];
  const cartCount = cart.reduce((s,i)=>s+i.qty,0);

  const counts = useMemo(() => {
    const c = { all: PRODUCTS.length };
    SHAPES.forEach((s)=>{ c[s.key] = PRODUCTS.filter((p)=>p.shape===s.key).length; });
    return c;
  }, []);

  const showToast = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(()=>setToast(""),2200); };
  const addCart = (p) => {
    setCart((prev)=>{ const f=prev.find((i)=>i.id===p.id); if(f) return prev.map((i)=>i.id===p.id?{...i,qty:i.qty+1}:i); return [...prev,{...p,qty:1}]; });
    showToast(lang==="ua"?"Додано в кошик":"Добавлено в корзину");
  };
  const setQty = (id,q)=>setCart((prev)=>prev.map((i)=>i.id===id?{...i,qty:q}:i));
  const remove = (id)=>setCart((prev)=>prev.filter((i)=>i.id!==id));

  useEffect(() => {
    document.documentElement.lang = lang === "ua" ? "uk" : "ru";
    const p = new URLSearchParams(window.location.search);
    if (lang !== "ua") p.set("lang", lang); else p.delete("lang");
    if (shape !== "all") p.set("shape", shape); else p.delete("shape");
    const qs = p.toString();
    window.history.replaceState({}, "", qs ? "?" + qs : window.location.pathname);
  }, [lang, shape]);

  const pickShape = (k) => { setShape(k); setTimeout(()=>catalogRef.current && catalogRef.current.scrollIntoView({behavior:"smooth",block:"start"}),60); };
  const onNav = (id) => {
    if (id === "top") { window.scrollTo({top:0,behavior:"smooth"}); return; }
    const el = document.getElementById(id); if (el) el.scrollIntoView({behavior:"smooth",block:"start"});
  };

  const accent = Array.isArray(tw.accent) ? tw.accent : [tw.accent, tw.accent];
  const rootStyle = { "--flaks-orange": accent[0], "--flaks-orange-hot": accent[1]||accent[0], "--flaks-orange-dim": hexToRgba(accent[0], 0.12) };

  return (
    <MotionCtx.Provider value={!!tw.motion}>
    <div className="bf-app" style={rootStyle} data-density={tw.density}>
      <Header t={t} lang={lang} setLang={setLang} cartCount={cartCount} openCart={()=>setCartOpen(true)} onNav={onNav}/>
      <main>
      <Hero t={t} flutes={tw.flutes} onNav={onNav}/>
      <ShapeSelector t={t} lang={lang} shape={shape} setShape={pickShape} counts={counts} flutes={tw.flutes} refEl={shapesRef}/>
      <Guide t={t} lang={lang} onPick={pickShape} flutes={tw.flutes}/>
      <Catalog t={t} lang={lang} shape={shape} setShape={setShape} view={tw.view} setView={(v)=>setTweak("view",v)} cart={cart} onAdd={addCart} onOpen={setActive} flutes={tw.flutes} photos={tw.photos} refEl={catalogRef}/>
      <About t={t} lang={lang}/>
      <Delivery t={t}/>
      <Articles t={t} lang={lang}/>
      <Contact t={t} lang={lang}/>
      </main>
      <Footer t={t}/>
      <Cart t={t} lang={lang} open={cartOpen} onClose={()=>setCartOpen(false)} items={cart} onQty={setQty} onRemove={remove} flutes={tw.flutes} onClearCart={()=>setCart([])}/>
      <Modal t={t} lang={lang} p={active} onClose={()=>setActive(null)} onAdd={addCart} flutes={tw.flutes} photos={tw.photos}/>
      <div className={"bf-toast"+(toast?" on":"")}><span className="ok"><I.check s={16}/></span>{toast}</div>

      {import.meta.env.DEV && (
      <TweaksPanel title="Tweaks">
        <TweakSection label={lang==="ua"?"Вигляд каталогу":"Вид каталога"}/>
        <TweakRadio label={lang==="ua"?"Подання":"Отображение"} value={tw.view}
          options={[{value:"table",label:t.view_table},{value:"cards",label:t.view_cards}]} onChange={(v)=>setTweak("view",v)}/>
        <TweakRadio label={lang==="ua"?"Щільність":"Плотность"} value={tw.density}
          options={[{value:"compact",label:lang==="ua"?"Щільно":"Плотно"},{value:"regular",label:lang==="ua"?"Звичайно":"Обычно"},{value:"comfy",label:lang==="ua"?"Просторо":"Просторно"}]} onChange={(v)=>setTweak("density",v)}/>
        <TweakToggle label={lang==="ua"?"Реальні фото товару":"Реальные фото товара"} value={tw.photos} onChange={(v)=>setTweak("photos",v)}/>
        <TweakToggle label={lang==="ua"?"Насічка на схемах":"Насечка на схемах"} value={tw.flutes} onChange={(v)=>setTweak("flutes",v)}/>
        <TweakSection label={lang==="ua"?"Рух":"Движение"}/>
        <TweakToggle label={lang==="ua"?"Анімація на сайті":"Анимация на сайте"} value={tw.motion} onChange={(v)=>setTweak("motion",v)}/>
        <TweakSection label={lang==="ua"?"Акцент":"Акцент"}/>
        <TweakColor label={lang==="ua"?"Колір бренду":"Цвет бренда"} value={tw.accent}
          options={[["#e85d04","#ff7c2a"],["#f0a500","#ffc02e"],["#d6402a","#ff6a4d"],["#2a86d6","#4da6ff"]]} onChange={(v)=>setTweak("accent",v)}/>
      </TweaksPanel>
      )}
    </div>
    </MotionCtx.Provider>
  );
}

