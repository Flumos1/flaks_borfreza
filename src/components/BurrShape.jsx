import { useMemo } from 'react'

// ============================================================
// FLAKS · Борфрезы — технические SVG-схемы профилей головок
// Горизонтальная ориентация: хвостовик слева, головка справа.
// Силуэт по контуру + диагональная насечка (clip по головке).
// 16 форм ISO/DIN: A C D E F G H J K L M N S T U Y.
// ============================================================

const HEAD_PATHS = {
  // A — цилиндрическая, плоский торец
  A: "M52,13 H128 a3,3 0 0 1 3,3 V56 a3,3 0 0 1 -3,3 H52 Z",
  // C — сфероцилиндрическая (ball nose)
  C: "M52,13 H104 a23,23 0 0 1 0,46 H52 Z",
  // D — сферическая (шар)
  D: "M70,36 a27,27 0 1 0 54,0 a27,27 0 1 0 -54,0 Z",
  // E — овальная (эллипс)
  E: "M58,36 a36,25 0 1 0 72,0 a36,25 0 1 0 -72,0 Z",
  // F — гиперболическая со сферическим (закруглённым) торцом
  F: "M55,17 C48,28 48,44 55,55 C99,51 126,45 133,38 C135,37 135,35 133,34 C126,27 99,21 55,17 Z",
  // G — гиперболическая с точечным (острым) торцом
  G: "M55,16 C49,28 49,44 55,56 C100,51 128,44 138,36 C128,28 100,21 55,16 Z",
  // H — пламевидная (параболическая, длинный тонкий нос)
  H: "M54,16 C46,30 46,42 54,56 C90,52 120,46 137,36 C120,26 90,20 54,16 Z",
  // J — коническая 60° (широкий конус)
  J: "M55,12 Q53,12 53,15 L53,57 Q53,60 55,60 L103,38 Q106,36 103,34 Z",
  // K — коническая 90° (очень широкий короткий конус / зенковка)
  K: "M55,11 Q53,11 53,14 L53,58 Q53,61 55,61 L84,38 Q87,36 84,34 Z",
  // L — сфероконическая (конус с закруглённым торцом)
  L: "M55,15 Q53,15 53,18 L53,54 Q53,57 55,57 L120,42 a7,7 0 0 1 0,-12 Z",
  // M — коническая заострённая (узкий длинный конус)
  M: "M54,13 Q54,11 57,12 L131,34 Q135,36 131,38 L57,60 Q54,61 54,59 Z",
  // N — обратный конус (узкая шейка слева, широкий плоский торец справа)
  N: "M55,27 L123,12 a3,3 0 0 1 4,3 V57 a3,3 0 0 1 -4,3 L55,45 Q52,44 52,36 Q52,28 55,27 Z",
  // S — конусная усечённая (фрустум)
  S: "M55,14 L121,26 a2,2 0 0 1 2,2 V44 a2,2 0 0 1 -2,2 L55,58 Q52,57 52,54 L52,18 Q52,15 55,14 Z",
  // T — дисковая (тонкий диск, вид с ребра)
  T: "M74,7 H86 a4,4 0 0 1 4,4 V61 a4,4 0 0 1 -4,4 H74 a4,4 0 0 1 -4,-4 V11 a4,4 0 0 1 4,-4 Z",
  // U — вогнутая цилиндрическая (талия)
  U: "M54,15 Q91,24 128,15 L128,57 Q91,48 54,57 Z",
  // Y — дисковая 90° (диск с прямыми кромками)
  Y: "M71,8 H91 V64 H71 Z",
};

// диск-формы соединяются с хвостовиком через ось — рисуем короткий хвостовик
const DISC = { T: 70, Y: 71 };

// Диагональные линии насечки
const FLUTES = (() => {
  const lines = [];
  for (let x = 24; x <= 152; x += 8) lines.push([x, 5, x + 20, 67]);
  return lines;
})();

let _burrUid = 0;

function BurrShape({ type, size = 64, strokeWidth = 2.4, flutes = true, className, style }) {
  const cid = useMemo(() => "burrclip-" + (++_burrUid), []);
  const w = size, h = (size * 72) / 144;
  const common = { className, style, width: w, height: h, viewBox: "0 0 144 72", fill: "none", stroke: "currentColor", "aria-hidden": "true" };

  const hp = HEAD_PATHS[type] || HEAD_PATHS.A;
  const shankTo = DISC[type] || 58;
  return (
    <svg {...common}>
      <defs><clipPath id={cid}><path d={hp} /></clipPath></defs>
      {/* хвостовик */}
      <rect x="2" y="31.5" width={shankTo - 2} height="9" rx="2.5" stroke="currentColor" strokeWidth={strokeWidth} />
      <line x1="2" y1="36" x2={shankTo} y2="36" stroke="currentColor" strokeWidth={strokeWidth * 0.45} strokeOpacity="0.45" />
      {/* головка */}
      <path d={hp} fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      {flutes && (
        <g clipPath={`url(#${cid})`} stroke="currentColor" strokeOpacity="0.3" strokeWidth={strokeWidth * 0.55}>
          {FLUTES.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />)}
        </g>
      )}
    </svg>
  );
}

export { BurrShape, HEAD_PATHS };
