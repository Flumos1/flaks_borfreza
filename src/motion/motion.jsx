// ============================================================
// FLAKS · Борфрезы — модуль движения (motion.jsx)
// Reveal при скролле, счётчики, шестерни, кольцевой бейдж.
// Всё уважает prefers-reduced-motion и тумблер «Рух».
// ============================================================
import { useState, useEffect, useRef, createContext, useContext } from 'react'

const prefersReduced = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Контекст: включено ли движение глобально ──
const MotionCtx = createContext(true);
const useMotion = () => useContext(MotionCtx) && !prefersReduced();

// ── Reveal: добавляет класс .is-in когда элемент входит во вьюпорт ──
function Reveal({ children, className = "", delay = 0, tag = "div", once = true, ...rest }) {
  const motion = useMotion();
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!motion) { setSeen(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { setSeen(true); if (once) io.unobserve(e.target); }
        else if (!once) setSeen(false);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [motion, once]);
  const Tag = tag;
  return (
    <Tag ref={ref} className={`bf-reveal ${className} ${seen ? "is-in" : ""}`}
      style={{ transitionDelay: seen ? `${delay}ms` : "0ms" }} {...rest}>
      {children}
    </Tag>
  );
}

// ── CountUp: считает целое число при появлении (иначе просто текст) ──
function CountUp({ value, duration = 1100, className }) {
  const motion = useMotion();
  const isInt = /^\d+$/.test(String(value));
  const ref = useRef(null);
  const [disp, setDisp] = useState(isInt && motion ? 0 : value);
  useEffect(() => {
    if (!isInt || !motion) { setDisp(value); return; }
    const el = ref.current;
    if (!el) return;
    let raf, started = false;
    const target = parseInt(value, 10);
    const run = (t0) => {
      const step = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisp(Math.round(eased * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started) { started = true; run(performance.now()); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, motion]);
  return <span ref={ref} className={className}>{disp}</span>;
}

// ── Gears: чертёжные шестерни, медленно вращаются (фон героя) ──
function gearPath(teeth, rOut, rIn, rHole) {
  const step = (Math.PI * 2) / teeth;
  const tw = step * 0.34;          // полуширина зуба
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const p = (ang, r) => `${(Math.cos(ang) * r).toFixed(2)},${(Math.sin(ang) * r).toFixed(2)}`;
    d += (i === 0 ? "M" : "L") + p(a - tw, rIn);
    d += "L" + p(a - tw * 0.6, rOut);
    d += "L" + p(a + tw * 0.6, rOut);
    d += "L" + p(a + tw, rIn);
  }
  d += "Z";
  // отверстие (как отдельный подконтур, evenodd)
  let hole = "";
  const seg = 24;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    hole += (i === 0 ? "M" : "L") + `${(Math.cos(a) * rHole).toFixed(2)},${(Math.sin(a) * rHole).toFixed(2)}`;
  }
  return d + " " + hole + "Z";
}

function Gears({ color = "currentColor" }) {
  const motion = useMotion();
  const gears = [
    { x: 86, y: 60, r: 78, teeth: 16, dur: 46, dir: 1 },
    { x: 250, y: 150, r: 50, teeth: 12, dur: 34, dir: -1 },
    { x: 150, y: 250, r: 38, teeth: 10, dur: 28, dir: 1 },
  ];
  return (
    <svg className="bf-gears" viewBox="0 0 320 320" fill="none" aria-hidden="true">
      {gears.map((g, i) => (
        <g key={i} style={{ transformOrigin: `${g.x}px ${g.y}px`,
          animation: motion ? `bf-rot ${g.dur}s linear infinite ${g.dir < 0 ? "reverse" : ""}` : "none" }}>
          <path d={gearPath(g.teeth, g.r, g.r * 0.82, g.r * 0.28)} transform={`translate(${g.x} ${g.y})`}
            fill="none" stroke={color} strokeWidth="1.4" strokeOpacity="0.5" fillRule="evenodd" />
          <circle cx={g.x} cy={g.y} r={g.r * 0.52} fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        </g>
      ))}
    </svg>
  );
}

// ── RingSeal: металлический диск логотипа + вращающийся кольцевой текст ──
function RingSeal({ size = 220, text = "FLAKS · TOOL SOLUTIONS · PROFESSIONAL GRADE · ВК8 · ", disc = "assets/flaks-disc.png" }) {
  const motion = useMotion();
  const rid = useRef("ring-" + Math.random().toString(36).slice(2, 8)).current;
  const R = 92;
  return (
    <div className="bf-seal" style={{ width: size, height: size }}>
      <svg className="bf-seal-ring" viewBox="0 0 220 220"
        style={{ animation: motion ? "bf-rot 22s linear infinite" : "none" }}>
        <defs>
          <path id={rid} d={`M110,110 m-${R},0 a${R},${R} 0 1,1 ${R * 2},0 a${R},${R} 0 1,1 -${R * 2},0`} />
        </defs>
        <text className="bf-seal-text">
          <textPath href={`#${rid}`} startOffset="0">{text.repeat(2)}</textPath>
        </text>
      </svg>
      <img className="bf-seal-disc" src={disc} alt="FLAKS Tool Solutions" loading="lazy" />
    </div>
  );
}

export { MotionCtx, useMotion, prefersReduced, Reveal, CountUp, Gears, RingSeal };
