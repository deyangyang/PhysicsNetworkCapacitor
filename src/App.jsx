import { useState } from "react";

// ── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:      "#06090f",
  panel:   "#0b1120",
  border:  "#182b45",
  accent:  "#2ee8ff",
  gold:    "#ffd060",
  wire:    "#1e3d5a",
  wireHi:  "#2c567e",
  capClr:  "#2ee8ff",
  txt1:    "#ddeeff",
  txt2:    "#5a82a8",
  green:   "#3fffa8",
  orange:  "#ff9044",
  purple:  "#b07cff",
  red:     "#ff4060",
};

const FONT_MONO = "'Courier New', 'Lucida Console', monospace";
const FONT_HEAD = "'Georgia', 'Times New Roman', serif";

const MODES = { SERIES: "series", PARALLEL: "parallel", SP: "sp", PS: "ps" };

const META = {
  series:   { label: "Series Only",     accent: C.accent  },
  parallel: { label: "Parallel Only",   accent: C.green   },
  sp:       { label: "Series–Parallel", accent: C.purple  },
  ps:       { label: "Parallel–Series", accent: C.orange  },
};

// ── Equivalent capacitance ────────────────────────────────────────────────────
function calcCeq(mode, caps) {
  if (!caps.length) return 0;
  if (mode === MODES.SERIES)
    return 1 / caps.reduce((s, c) => s + 1 / c.val, 0);
  if (mode === MODES.PARALLEL)
    return caps.reduce((s, c) => s + c.val, 0);
  if (mode === MODES.SP) {
    const c1 = caps[0].val;
    const cp = caps.slice(1).reduce((s, c) => s + c.val, 0);
    return cp > 0 ? (c1 * cp) / (c1 + cp) : c1;
  }
  if (mode === MODES.PS) {
    const c1 = caps[0].val;
    if (caps.length < 2) return c1;
    const cs = 1 / caps.slice(1).reduce((s, c) => s + 1 / c.val, 0);
    return c1 + cs;
  }
  return 0;
}

// ── Per-capacitor Q, V, U ────────────────────────────────────────────────────
function calcPerCap(mode, caps, voltage) {
  if (!caps.length) return [];

  if (mode === MODES.SERIES) {
    const ceq = calcCeq(mode, caps);
    const Q = ceq * voltage;
    return caps.map((cap, i) => {
      const Vi = Q / cap.val;
      return { label: `C${i+1}`, C: cap.val, Q, V: Vi, U: 0.5 * cap.val * Vi * Vi };
    });
  }

  if (mode === MODES.PARALLEL) {
    return caps.map((cap, i) => {
      const Qi = cap.val * voltage;
      return { label: `C${i+1}`, C: cap.val, Q: Qi, V: voltage, U: 0.5 * cap.val * voltage * voltage };
    });
  }

  if (mode === MODES.SP) {
    const c1 = caps[0].val;
    const cp = caps.slice(1).reduce((s, c) => s + c.val, 0);
    const ceq = cp > 0 ? (c1 * cp) / (c1 + cp) : c1;
    const Qtotal = ceq * voltage;
    const V1 = Qtotal / c1;
    const Vp = voltage - V1;
    return caps.map((cap, i) => {
      if (i === 0) {
        return { label: "C₁", C: cap.val, Q: Qtotal, V: V1, U: 0.5 * cap.val * V1 * V1 };
      }
      const Qi = cap.val * Vp;
      return { label: `C${i+1}`, C: cap.val, Q: Qi, V: Vp, U: 0.5 * cap.val * Vp * Vp };
    });
  }

  if (mode === MODES.PS) {
    const c1 = caps[0].val;
    const serCaps = caps.slice(1);
    const cs = serCaps.length > 0 ? 1 / serCaps.reduce((s, c) => s + 1 / c.val, 0) : 0;
    const Qs = cs * voltage;
    return caps.map((cap, i) => {
      if (i === 0) {
        const Q1 = cap.val * voltage;
        return { label: "C₁", C: cap.val, Q: Q1, V: voltage, U: 0.5 * cap.val * voltage * voltage };
      }
      const Vi = Qs / cap.val;
      return { label: `C${i+1}`, C: cap.val, Q: Qs, V: Vi, U: 0.5 * cap.val * Vi * Vi };
    });
  }

  return [];
}

// ── Luminosity helpers ────────────────────────────────────────────────────────
// brightness: 0 (no voltage) → 1 (full supply voltage)
// Physically: voltage across cap = electric field between plates → drives indicator glow

function capColorFromBrightness(t) {
  // dim dark blue → cyan → white-cyan
  const stops = [
    { t: 0.0, r: 0x0c, g: 0x1e, b: 0x30 },
    { t: 0.4, r: 0x10, g: 0x6a, b: 0x9a },
    { t: 0.75, r: 0x2e, g: 0xe8, b: 0xff },
    { t: 1.0,  r: 0xcc, g: 0xf6, b: 0xff },
  ];
  const clamped = Math.max(0, Math.min(1, t));
  let lo = stops[0], hi = stops[1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].t && clamped <= stops[i + 1].t) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const s = (hi.t === lo.t) ? 1 : (clamped - lo.t) / (hi.t - lo.t);
  const r = Math.round(lo.r + (hi.r - lo.r) * s);
  const g = Math.round(lo.g + (hi.g - lo.g) * s);
  const b = Math.round(lo.b + (hi.b - lo.b) * s);
  return `rgb(${r},${g},${b})`;
}

function batColorFromBrightness(t) {
  // dim dark amber → bright gold → pale gold-white
  const stops = [
    { t: 0.0, r: 0x30, g: 0x22, b: 0x04 },
    { t: 0.4, r: 0x99, g: 0x6a, b: 0x08 },
    { t: 0.8, r: 0xff, g: 0xd0, b: 0x60 },
    { t: 1.0, r: 0xff, g: 0xf0, b: 0xb0 },
  ];
  const clamped = Math.max(0, Math.min(1, t));
  let lo = stops[0], hi = stops[1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].t && clamped <= stops[i + 1].t) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const s = (hi.t === lo.t) ? 1 : (clamped - lo.t) / (hi.t - lo.t);
  const r = Math.round(lo.r + (hi.r - lo.r) * s);
  const g = Math.round(lo.g + (hi.g - lo.g) * s);
  const b = Math.round(lo.b + (hi.b - lo.b) * s);
  return `rgb(${r},${g},${b})`;
}

function capGlow(t, color) {
  // glow radius: 0px at t=0, up to 10px at t=1
  const r = (t * t) * 10; // quadratic so low voltages barely glow
  return r < 0.3 ? "none" : `drop-shadow(0 0 ${r.toFixed(1)}px ${color})`;
}

function batGlow(t, color) {
  const r = (t * t) * 14;
  return r < 0.3 ? "none" : `drop-shadow(0 0 ${r.toFixed(1)}px ${color})`;
}

// ── SVG primitives ────────────────────────────────────────────────────────────
const CapH = ({ x, y, label, brightness = 0.7, labelBelow = false }) => {
  const clr = capColorFromBrightness(brightness);
  const sw  = 1.4 + brightness * 0.8;
  const filter = capGlow(brightness, clr);
  const labelY = labelBelow ? y + 26 : y - 19;
  return (
    <g>
      <g style={{ filter }}>
        <line x1={x-21} y1={y}    x2={x-4}  y2={y}    stroke={clr} strokeWidth={sw}/>
        <line x1={x-4}  y1={y-13} x2={x-4}  y2={y+13} stroke={clr} strokeWidth={sw + 0.8}/>
        <line x1={x+4}  y1={y-13} x2={x+4}  y2={y+13} stroke={clr} strokeWidth={sw + 0.8}/>
        <line x1={x+4}  y1={y}    x2={x+21} y2={y}    stroke={clr} strokeWidth={sw}/>
      </g>
      {label && (
        <text x={x} y={labelY} textAnchor="middle"
          fill={brightness > 0.5 ? clr : "#3a6080"} fillOpacity={0.6 + brightness * 0.4}
          fontSize="10" fontFamily={FONT_MONO}>{label}</text>
      )}
    </g>
  );
};

const CapV = ({ x, y, label, brightness = 0.7, labelLeft = false }) => {
  const clr = capColorFromBrightness(brightness);
  const sw  = 1.4 + brightness * 0.8;
  const filter = capGlow(brightness, clr);
  return (
    <g>
      <g style={{ filter }}>
        <line x1={x}    y1={y-21} x2={x}    y2={y-4}  stroke={clr} strokeWidth={sw}/>
        <line x1={x-13} y1={y-4}  x2={x+13} y2={y-4}  stroke={clr} strokeWidth={sw + 0.8}/>
        <line x1={x-13} y1={y+4}  x2={x+13} y2={y+4}  stroke={clr} strokeWidth={sw + 0.8}/>
        <line x1={x}    y1={y+4}  x2={x}    y2={y+21} stroke={clr} strokeWidth={sw}/>
      </g>
      {label && (
        <text
          x={labelLeft ? x - 20 : x + 18} y={y + 4}
          textAnchor={labelLeft ? "end" : "start"}
          fill={brightness > 0.5 ? clr : "#3a6080"} fillOpacity={0.6 + brightness * 0.4}
          fontSize="10" fontFamily={FONT_MONO}>{label}</text>
      )}
    </g>
  );
};

const BatSVG = ({ x, y, brightness = 0.6 }) => {
  const clr    = batColorFromBrightness(brightness);
  const dimClr = batColorFromBrightness(brightness * 0.55);
  const filter = batGlow(brightness, clr);
  return (
    <g style={{ filter }}>
      <line x1={x} y1={y-30} x2={x}    y2={y-6}  stroke={clr}    strokeWidth="1.5"/>
      <line x1={x-12} y1={y-6}  x2={x+12} y2={y-6}  stroke={clr}    strokeWidth="2.6"/>
      <line x1={x-7}  y1={y+6}  x2={x+7}  y2={y+6}  stroke={dimClr} strokeWidth="1.5"/>
      <line x1={x} y1={y+6}  x2={x}    y2={y+30} stroke={clr}    strokeWidth="1.5"/>
      <text x={x+16} y={y-3}  fill={clr}    fontSize="11" fontFamily={FONT_MONO}>+</text>
      <text x={x+16} y={y+13} fill={dimClr} fontSize="11" fontFamily={FONT_MONO}>−</text>
    </g>
  );
};

const JDot = ({ x, y }) => (
  <circle cx={x} cy={y} r="4" fill={C.wireHi}/>
);

// ── Circuit diagrams ──────────────────────────────────────────────────────────
const SW = 450, SH = 195;
const TY = 56, BY = 150, LX = 42, RX = 410;
const batY = (TY + BY) / 2;

function DiagSeries({ caps, perCap, voltage }) {
  const n = caps.length;
  const batB = Math.max(0.08, voltage / 50);

  // Distribute caps around the circuit perimeter: top wire, right wall, bottom wire.
  // Pattern — n=1: [1,0,0]  n=2: [1,0,1]  n=3: [1,1,1]  n=4: [2,0,2]  n=5: [2,1,2]  n=6: [3,0,3]
  let nT, nR, nB;
  if (n === 1) { nT = 1; nR = 0; nB = 0; }
  else         { nT = Math.floor(n / 2); nR = n % 2; nB = Math.floor(n / 2); }

  // x range for top/bottom wire caps — tighten right end when right wall has a cap
  const xStart = LX + 54;
  const xEnd   = nR ? RX - 40 : RX - 16;

  const topXs = Array.from({ length: nT }, (_, i) =>
    nT === 1
      ? (xStart + xEnd) / 2
      : xStart + (xEnd - xStart) * (i + 1) / (nT + 1)
  );

  // Build ordered placements: top (L→R), right (middle), bottom (L→R)
  const placements = [];
  for (let i = 0; i < nT; i++)
    placements.push({ side: 'top',    x: topXs[i], y: TY,   ci: i });
  if (nR)
    placements.push({ side: 'right',  x: RX,       y: batY, ci: nT });
  for (let i = 0; i < nB; i++)
    placements.push({ side: 'bottom', x: topXs[i], y: BY,   ci: nT + nR + i });

  return (
    <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} style={{maxWidth:"100%"}}>
      <line x1={LX} y1={TY} x2={RX} y2={TY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={LX} y1={BY} x2={RX} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={RX} y1={TY} x2={RX} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <BatSVG x={LX} y={batY} brightness={batB}/>
      {placements.map(({ side, x, y, ci }) => {
        const cap = caps[ci];
        const b   = perCap[ci] ? Math.max(0.05, perCap[ci].V / voltage) : 0.7;
        const lbl = `C${ci + 1}`;
        if (side === 'top')    return <CapH key={cap.id} x={x} y={y} label={lbl} brightness={b}/>;
        if (side === 'bottom') return <CapH key={cap.id} x={x} y={y} label={lbl} brightness={b} labelBelow/>;
        if (side === 'right')  return <CapV key={cap.id} x={x} y={y} label={lbl} brightness={b} labelLeft/>;
        return null;
      })}
    </svg>
  );
}

function DiagParallel({ caps, perCap, voltage }) {
  const n = caps.length;
  const jl = 88, jr = RX;
  const xs = caps.map((_, i) =>
    n === 1 ? (jl + jr) / 2 : jl + ((jr - jl) / (n - 1)) * i
  );
  const batB = Math.max(0.08, voltage / 50);
  return (
    <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} style={{maxWidth:"100%"}}>
      <line x1={jl} y1={TY} x2={jr} y2={TY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={jl} y1={BY} x2={jr} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={LX} y1={TY} x2={jl} y2={TY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={LX} y1={BY} x2={jl} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <BatSVG x={LX} y={batY} brightness={batB}/>
      {xs.map((x, i) => {
        // all parallel caps share the full supply voltage → same brightness
        const b = Math.max(0.08, voltage / 50);
        return (
          <g key={caps[i].id}>
            <line x1={x} y1={TY} x2={x} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
            <CapV x={x} y={batY} label={`C${i+1}`} brightness={b}/>
          </g>
        );
      })}
    </svg>
  );
}

function DiagSP({ caps, perCap, voltage }) {
  const juncX = 188;
  const c1cx = (LX + juncX) / 2;
  const pCaps = caps.slice(1);
  const n = pCaps.length;
  const pL = juncX + 18, pR = RX - 14;
  const xs = pCaps.map((_, i) =>
    n === 1 ? (pL + pR) / 2 : pL + ((pR - pL) / (n - 1)) * i
  );
  const batB = Math.max(0.08, voltage / 50);
  const b0   = perCap[0] ? Math.max(0.05, perCap[0].V / voltage) : 0.7;
  return (
    <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} style={{maxWidth:"100%"}}>
      <line x1={LX} y1={TY} x2={RX} y2={TY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={LX} y1={BY} x2={RX} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={RX} y1={TY} x2={RX} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <BatSVG x={LX} y={batY} brightness={batB}/>
      <CapH x={c1cx} y={TY} label="C₁" brightness={b0}/>
      <JDot x={juncX} y={TY}/>
      {xs.map((x, i) => {
        const b = perCap[i + 1] ? Math.max(0.05, perCap[i + 1].V / voltage) : 0.7;
        return (
          <g key={pCaps[i].id}>
            <line x1={x} y1={TY} x2={x} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
            <CapV x={x} y={batY} label={`C${i+2}`} brightness={b}/>
          </g>
        );
      })}
    </svg>
  );
}

function DiagPS({ caps, perCap, voltage }) {
  const c1x = 128;
  const serStart = 200;
  const sCaps = caps.slice(1);
  const n = sCaps.length;
  const avail = RX - serStart - 40;
  const xs = sCaps.map((_, i) => serStart + (avail / (n + 1)) * (i + 1));
  const batB = Math.max(0.08, voltage / 50);
  const b0   = perCap[0] ? Math.max(0.05, perCap[0].V / voltage) : 0.7;
  return (
    <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} style={{maxWidth:"100%"}}>
      <line x1={LX} y1={TY} x2={RX} y2={TY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={LX} y1={BY} x2={RX} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <line x1={RX} y1={TY} x2={RX} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <BatSVG x={LX} y={batY} brightness={batB}/>
      <line x1={c1x} y1={TY} x2={c1x} y2={BY} stroke={C.wire} strokeWidth="1.5"/>
      <CapV x={c1x} y={batY} label="C₁" brightness={b0}/>
      <JDot x={c1x} y={TY}/>
      <JDot x={c1x} y={BY}/>
      {xs.map((x, i) => {
        const b = perCap[i + 1] ? Math.max(0.05, perCap[i + 1].V / voltage) : 0.7;
        return <CapH key={sCaps[i].id} x={x} y={TY} label={`C${i+2}`} brightness={b}/>;
      })}
    </svg>
  );
}

const Diagrams = { series: DiagSeries, parallel: DiagParallel, sp: DiagSP, ps: DiagPS };

// ── Mini previews ─────────────────────────────────────────────────────────────
function MiniSeries() {
  return (
    <svg width={110} height={54} viewBox="0 0 110 54">
      <line x1={6} y1={14} x2={104} y2={14} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6} y1={42} x2={104} y2={42} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={104} y1={14} x2={104} y2={42} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6} y1={17} x2={6} y2={22} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={1} y1={22} x2={11} y2={22} stroke={C.gold} strokeWidth="1.8"/>
      <line x1={3} y1={28} x2={9}  y2={28} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={6} y1={28} x2={6}  y2={39} stroke={C.gold} strokeWidth="1.2"/>
      {[32, 68].map((x, i) => (
        <g key={i}>
          <line x1={x-12} y1={14} x2={x-3} y2={14} stroke={C.capClr} strokeWidth="1.2"/>
          <line x1={x-3}  y1={7}  x2={x-3} y2={21} stroke={C.capClr} strokeWidth="1.8"/>
          <line x1={x+3}  y1={7}  x2={x+3} y2={21} stroke={C.capClr} strokeWidth="1.8"/>
          <line x1={x+3}  y1={14} x2={x+15} y2={14} stroke={C.capClr} strokeWidth="1.2"/>
        </g>
      ))}
    </svg>
  );
}

function MiniParallel() {
  return (
    <svg width={110} height={54} viewBox="0 0 110 54">
      <line x1={20} y1={12} x2={100} y2={12} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={20} y1={44} x2={100} y2={44} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6}  y1={12} x2={20}  y2={12} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6}  y1={44} x2={20}  y2={44} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6} y1={15} x2={6} y2={20} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={1} y1={20} x2={11} y2={20} stroke={C.gold} strokeWidth="1.8"/>
      <line x1={3} y1={26} x2={9}  y2={26} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={6} y1={26} x2={6}  y2={41} stroke={C.gold} strokeWidth="1.2"/>
      {[34, 60, 86].map((x, i) => (
        <g key={i}>
          <line x1={x} y1={12} x2={x} y2={44} stroke={C.wire} strokeWidth="1.2"/>
          <line x1={x-8} y1={25} x2={x+8} y2={25} stroke={C.capClr} strokeWidth="1.8"/>
          <line x1={x-8} y1={31} x2={x+8} y2={31} stroke={C.capClr} strokeWidth="1.8"/>
        </g>
      ))}
    </svg>
  );
}

function MiniSP() {
  return (
    <svg width={110} height={54} viewBox="0 0 110 54">
      <line x1={6}  y1={14} x2={104} y2={14} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6}  y1={44} x2={104} y2={44} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={104} y1={14} x2={104} y2={44} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6} y1={17} x2={6} y2={22} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={1} y1={22} x2={11} y2={22} stroke={C.gold} strokeWidth="1.8"/>
      <line x1={3} y1={28} x2={9}  y2={28} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={6} y1={28} x2={6}  y2={41} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={18} y1={14} x2={27} y2={14} stroke={C.capClr} strokeWidth="1.2"/>
      <line x1={27} y1={8}  x2={27} y2={20} stroke={C.capClr} strokeWidth="1.8"/>
      <line x1={33} y1={8}  x2={33} y2={20} stroke={C.capClr} strokeWidth="1.8"/>
      <line x1={33} y1={14} x2={44} y2={14} stroke={C.capClr} strokeWidth="1.2"/>
      <circle cx={44} cy={14} r="3" fill={C.wireHi}/>
      {[62, 88].map((x, i) => (
        <g key={i}>
          <line x1={x} y1={14} x2={x} y2={44} stroke={C.wire} strokeWidth="1.2"/>
          <line x1={x-8} y1={26} x2={x+8} y2={26} stroke={C.capClr} strokeWidth="1.8"/>
          <line x1={x-8} y1={32} x2={x+8} y2={32} stroke={C.capClr} strokeWidth="1.8"/>
        </g>
      ))}
    </svg>
  );
}

function MiniPS() {
  return (
    <svg width={110} height={54} viewBox="0 0 110 54">
      <line x1={6}  y1={14} x2={104} y2={14} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6}  y1={44} x2={104} y2={44} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={104} y1={14} x2={104} y2={44} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={6} y1={17} x2={6} y2={22} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={1} y1={22} x2={11} y2={22} stroke={C.gold} strokeWidth="1.8"/>
      <line x1={3} y1={28} x2={9}  y2={28} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={6} y1={28} x2={6}  y2={41} stroke={C.gold} strokeWidth="1.2"/>
      <line x1={30} y1={14} x2={30} y2={44} stroke={C.wire} strokeWidth="1.2"/>
      <line x1={22} y1={26} x2={38} y2={26} stroke={C.capClr} strokeWidth="1.8"/>
      <line x1={22} y1={32} x2={38} y2={32} stroke={C.capClr} strokeWidth="1.8"/>
      <circle cx={30} cy={14} r="3" fill={C.wireHi}/>
      <circle cx={30} cy={44} r="3" fill={C.wireHi}/>
      {[58, 84].map((x, i) => (
        <g key={i}>
          <line x1={x-10} y1={14} x2={x-3} y2={14} stroke={C.capClr} strokeWidth="1.2"/>
          <line x1={x-3}  y1={8}  x2={x-3} y2={20} stroke={C.capClr} strokeWidth="1.8"/>
          <line x1={x+3}  y1={8}  x2={x+3} y2={20} stroke={C.capClr} strokeWidth="1.8"/>
          <line x1={x+3}  y1={14} x2={x+13} y2={14} stroke={C.capClr} strokeWidth="1.2"/>
        </g>
      ))}
    </svg>
  );
}

const MiniPreviews = { series: MiniSeries, parallel: MiniParallel, sp: MiniSP, ps: MiniPS };

// ── Menu Screen ───────────────────────────────────────────────────────────────
function MenuScreen({ onSelect }) {
  const [hovered, setHovered] = useState(null);
  const order = [MODES.SERIES, MODES.PARALLEL, MODES.SP, MODES.PS];

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "32px 16px", boxSizing: "border-box",
      backgroundImage: `radial-gradient(circle at 50% 30%, #0d1f3a 0%, ${C.bg} 70%)`,
    }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "4px",
          color: C.txt2, textTransform: "uppercase", marginBottom: "10px" }}>
          Physics Simulator
        </div>
        <h1 style={{ fontFamily: FONT_HEAD, fontSize: "clamp(22px,4vw,34px)",
          color: C.txt1, margin: 0, letterSpacing: "1px", fontWeight: "normal" }}>
          Networks of Capacitors
        </h1>
        <div style={{ width: "60px", height: "2px", background: C.accent,
          margin: "14px auto 0", opacity: 0.6 }}/>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "18px", maxWidth: "680px", width: "100%",
      }}>
        {order.map((mode) => {
          const m = META[mode];
          const isH = hovered === mode;
          const Preview = MiniPreviews[mode];
          return (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              onMouseEnter={() => setHovered(mode)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: isH ? "#111d30" : C.panel,
                border: `1.5px solid ${isH ? m.accent : C.border}`,
                borderRadius: "10px",
                padding: "22px 20px 18px",
                cursor: "pointer", textAlign: "left",
                transition: "all 0.18s ease",
                boxShadow: isH ? `0 0 18px ${m.accent}22` : "none",
                transform: isH ? "translateY(-2px)" : "none",
                display: "flex", flexDirection: "column", gap: "12px",
              }}
            >
              <div style={{ opacity: isH ? 1 : 0.7, transition: "opacity 0.18s" }}>
                <Preview/>
              </div>
              {/* Name only — no formula */}
              <div style={{
                fontFamily: FONT_MONO, fontSize: "13px", fontWeight: "bold",
                color: isH ? m.accent : C.txt1, letterSpacing: "0.5px",
                transition: "color 0.18s",
              }}>
                {m.label}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{
        marginTop: "32px", fontFamily: FONT_MONO, fontSize: "10px",
        color: C.txt2, opacity: 0.5, letterSpacing: "1px",
      }}>
        SELECT AN ORIENTATION TO BEGIN
      </div>
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ value, min, max, onChange, color = C.accent }) {
  return (
    <input
      type="range" min={min} max={max} step={1} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", height: "4px", accentColor: color, cursor: "pointer",
        background: "transparent", display: "block" }}
    />
  );
}

// ── Capacitor control row ─────────────────────────────────────────────────────
function CapRow({ cap, label, canRemove, onRemove, onChange, accent }) {
  return (
    <div style={{
      background: "#0d1828", border: `1px solid ${C.border}`,
      borderRadius: "7px", padding: "10px 12px", marginBottom: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: "11px",
          color: accent || C.accent, flex: 1, letterSpacing: "0.3px" }}>{label}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: "13px",
          color: C.txt1, marginRight: "10px" }}>{cap.val} μF</span>
        {canRemove && (
          <button onClick={onRemove} style={{
            background: "none", border: `1px solid ${C.red}44`,
            color: C.red, borderRadius: "4px", cursor: "pointer",
            fontSize: "13px", lineHeight: 1, padding: "2px 7px",
            fontFamily: FONT_MONO, transition: "background 0.15s",
          }}
            onMouseEnter={e => e.target.style.background = "#ff40600f"}
            onMouseLeave={e => e.target.style.background = "none"}
          >×</button>
        )}
      </div>
      <Slider value={cap.val} min={1} max={100} onChange={onChange} color={accent || C.accent}/>
    </div>
  );
}

// ── Summary row ───────────────────────────────────────────────────────────────
function SummaryRow({ label, value, unit, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "6px 0", borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: "10.5px", color: C.txt2,
        letterSpacing: "0.5px", flexShrink: 0, marginRight: "8px" }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: "14px", color: color || C.green,
        textAlign: "right" }}>
        {value}
        {unit && <span style={{ fontSize: "10px", color: C.txt2, marginLeft: "3px" }}>{unit}</span>}
      </span>
    </div>
  );
}

// ── Per-capacitor breakdown table ─────────────────────────────────────────────
function CapTable({ rows, accent }) {
  const headers = ["Cap", "C (μF)", "Q (μC)", "V (V)", "U (μJ)"];
  const hColors = [accent, C.green, C.accent, C.gold, C.purple];
  const dColors = [accent, C.green, C.accent, C.gold, C.purple];

  const fmt = (n, digits = 3) =>
    Math.abs(n) < 1e-9 ? "0" : Number(n.toFixed(digits)).toString();

  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: "9px", color: C.txt2,
        letterSpacing: "1.5px", marginBottom: "7px", textTransform: "uppercase",
      }}>Per-Capacitor Breakdown</div>

      <div style={{ overflowX: "auto", borderRadius: "6px",
        border: `1px solid ${C.border}`, background: "#070d1a" }}>
        <table style={{ width: "100%", borderCollapse: "collapse",
          fontFamily: FONT_MONO, fontSize: "11px", minWidth: "260px" }}>
          <thead>
            <tr style={{ background: "#0d1828" }}>
              {headers.map((h, ci) => (
                <th key={ci} style={{
                  padding: "7px 8px",
                  textAlign: ci === 0 ? "center" : "right",
                  color: hColors[ci],
                  fontSize: "9px", letterSpacing: "0.5px",
                  borderBottom: `1px solid ${C.border}`,
                  fontWeight: "bold", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{
                background: ri % 2 === 0 ? "transparent" : "#0a1220",
                borderBottom: ri < rows.length - 1 ? `1px solid ${C.border}33` : "none",
              }}>
                {/* Cap label */}
                <td style={{ padding: "6px 8px", color: dColors[0],
                  fontWeight: "bold", textAlign: "center" }}>{row.label}</td>
                {/* C */}
                <td style={{ padding: "6px 8px", color: dColors[1], textAlign: "right" }}>
                  {fmt(row.C, 1)}
                </td>
                {/* Q */}
                <td style={{ padding: "6px 8px", color: dColors[2], textAlign: "right" }}>
                  {fmt(row.Q)}
                </td>
                {/* V */}
                <td style={{ padding: "6px 8px", color: dColors[3], textAlign: "right" }}>
                  {fmt(row.V)}
                </td>
                {/* U — already in μJ (cap.val is in μF, V in Volts → μF·V² = μJ) */}
                <td style={{ padding: "6px 8px", color: dColors[4], textAlign: "right" }}>
                  {fmt(row.U)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Simulator screen ──────────────────────────────────────────────────────────
let _id = 1;
const mkCap = (val = 10) => ({ id: _id++, val });

function SimulatorScreen({ mode, onBack }) {
  const m = META[mode];
  const isCompound = mode === MODES.SP || mode === MODES.PS;

  const [voltage, setVoltage] = useState(12);
  const [caps, setCaps] = useState(() =>
    isCompound ? [mkCap(10), mkCap(10)] : [mkCap(10)]
  );

  const canAdd    = caps.length < 6;
  const minCaps   = isCompound ? 2 : 1;
  const canRemove = caps.length > minCaps;

  const addCap    = () => canAdd && setCaps(p => [...p, mkCap(10)]);
  const removeCap = (id) => {
    const idx = caps.findIndex(c => c.id === id);
    if (isCompound && idx === 0) return;
    if (!canRemove) return;
    setCaps(p => p.filter(c => c.id !== id));
  };
  const updateCap = (id, val) =>
    setCaps(p => p.map(c => c.id === id ? { ...c, val } : c));

  const ceq    = calcCeq(mode, caps);
  const Q      = ceq * voltage;
  const perCap = calcPerCap(mode, caps, voltage);

  const Diagram = Diagrams[mode];

  const capLabel = (i) => {
    if (!isCompound) return `C${i+1}`;
    if (i === 0) return mode === MODES.SP ? `C₁  (series)` : `C₁  (parallel)`;
    return mode === MODES.SP ? `C${i+1}  (parallel group)` : `C${i+1}  (series group)`;
  };
  const capAccent = (i) =>
    !isCompound ? m.accent : i === 0 ? C.gold : m.accent;

  const typeLabel = {
    series:   "Series Network",
    parallel: "Parallel Network",
    sp:       "Series–Parallel Compound",
    ps:       "Parallel–Series Compound",
  }[mode];

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      flexDirection: "column", boxSizing: "border-box",
      backgroundImage: `radial-gradient(ellipse at 30% 10%, #0c1e36 0%, ${C.bg} 60%)`,
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", padding: "14px 24px",
        borderBottom: `1px solid ${C.border}`, background: C.panel, gap: "16px",
      }}>
        <button onClick={onBack} style={{
          background: "none", border: `1px solid ${C.border}`, color: C.txt2,
          borderRadius: "6px", padding: "5px 12px", cursor: "pointer",
          fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.5px",
          transition: "border-color 0.15s, color 0.15s",
        }}
          onMouseEnter={e => { e.target.style.borderColor = C.accent; e.target.style.color = C.txt1; }}
          onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.txt2; }}
        >← MENU</button>
        <div style={{ fontFamily: FONT_MONO, fontSize: "12px",
          color: m.accent, letterSpacing: "1px" }}>{m.label.toUpperCase()}</div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: "flex", flexWrap: "wrap",
        padding: "24px", gap: "24px", boxSizing: "border-box",
      }}>
        {/* Left — diagram */}
        <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: "10px", color: C.txt2,
            letterSpacing: "2px", marginBottom: "14px", textTransform: "uppercase" }}>
            Circuit Diagram
          </div>
          <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: "10px", padding: "20px 10px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Diagram caps={caps} perCap={perCap} voltage={voltage}/>
          </div>

          {isCompound && (
            <div style={{
              marginTop: "14px", background: C.panel, border: `1px solid ${C.border}`,
              borderRadius: "8px", padding: "12px 16px",
              fontFamily: FONT_MONO, fontSize: "11px", color: C.txt2, lineHeight: "1.7",
            }}>
              {mode === MODES.SP ? (
                <>
                  <span style={{color: C.gold}}>C₁</span> is in{" "}
                  <span style={{color: C.accent}}>series</span> with the rest of the circuit.<br/>
                  <span style={{color: m.accent}}>C₂…Cₙ</span> form a{" "}
                  <span style={{color: m.accent}}>parallel</span> bank → equivalent{" "}
                  <span style={{color: m.accent}}>Cₚ</span>.<br/>
                  Final: <span style={{color: C.txt1}}>C₁ in series with Cₚ</span>
                </>
              ) : (
                <>
                  <span style={{color: C.gold}}>C₁</span> is in{" "}
                  <span style={{color: m.accent}}>parallel</span> with the rest of the circuit.<br/>
                  <span style={{color: m.accent}}>C₂…Cₙ</span> form a{" "}
                  <span style={{color: m.accent}}>series</span> chain → equivalent{" "}
                  <span style={{color: m.accent}}>Cₛ</span>.<br/>
                  Final: <span style={{color: C.txt1}}>C₁ in parallel with Cₛ</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right — controls + summary */}
        <div style={{ flex: "0 1 320px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Voltage */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: "10px", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "baseline",
              justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: "10.5px",
                color: C.txt2, letterSpacing: "1px" }}>SUPPLY VOLTAGE</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: "18px", color: C.gold }}>
                {voltage} V
              </span>
            </div>
            <Slider value={voltage} min={1} max={50} onChange={setVoltage} color={C.gold}/>
          </div>

          {/* Capacitors */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: "10px", padding: "16px", flex: 1 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: "10.5px",
              color: C.txt2, letterSpacing: "1px", marginBottom: "12px" }}>
              CAPACITORS  ({caps.length})
            </div>
            <div style={{ maxHeight: "260px", overflowY: "auto", paddingRight: "2px" }}>
              {caps.map((cap, i) => (
                <CapRow
                  key={cap.id} cap={cap} label={capLabel(i)} accent={capAccent(i)}
                  canRemove={canRemove && !(isCompound && i === 0)}
                  onRemove={() => removeCap(cap.id)}
                  onChange={val => updateCap(cap.id, val)}
                />
              ))}
            </div>
            <button onClick={addCap} disabled={!canAdd} style={{
              marginTop: "8px", width: "100%",
              background: canAdd ? "#0d1e35" : "#0b1420",
              border: `1px dashed ${canAdd ? m.accent + "60" : C.border}`,
              color: canAdd ? m.accent : C.txt2,
              borderRadius: "7px", padding: "9px", cursor: canAdd ? "pointer" : "not-allowed",
              fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.5px",
              transition: "background 0.15s",
            }}
              onMouseEnter={e => canAdd && (e.target.style.background = "#0d2040")}
              onMouseLeave={e => canAdd && (e.target.style.background = "#0d1e35")}
            >
              {canAdd ? `+ ADD CAPACITOR` : `MAX 6 CAPACITORS`}
            </button>
          </div>

          {/* Summary panel */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: "10px", padding: "16px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: "9.5px", color: C.txt2,
              letterSpacing: "1.5px", marginBottom: "10px", textTransform: "uppercase" }}>
              Summary
            </div>

            {/* Orientation — stacked so long names don't collide */}
            <div style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}`,
              marginBottom: "1px" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: "9.5px", color: C.txt2,
                letterSpacing: "0.5px", marginBottom: "4px" }}>Orientation</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: "13px", color: m.accent,
                letterSpacing: "0.2px" }}>{typeLabel}</div>
            </div>

            <SummaryRow label="Capacitors"          value={caps.length}             color={C.txt1}/>
            <SummaryRow label="Total Voltage"        value={voltage}       unit="V"  color={C.gold}/>
            <SummaryRow label="Equiv. Capacitance"   value={ceq.toFixed(3)} unit="μF" color={C.green}/>
            <SummaryRow label="Total Charge"         value={Q.toFixed(3)}   unit="μC" color={C.accent}/>

            {/* Per-capacitor table */}
            <CapTable rows={perCap} accent={m.accent}/>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState(null);
  return mode
    ? <SimulatorScreen mode={mode} onBack={() => setMode(null)}/>
    : <MenuScreen onSelect={setMode}/>;
}