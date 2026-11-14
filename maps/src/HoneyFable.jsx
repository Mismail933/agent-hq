// HoneyFable: the owner's version of the honey Short (brief 2026-11-14: "more alive, not a slideshow... animate something to explain
// the composition of honey"). 1080x1920, 30 fps, plays under a recorded narration. History (lines 0-4) uses the real footage/photos
// with drawings animated over them; science (lines 5-11) is pure animation that builds, reacts and counts ON the spoken words.
// Every frame is a pure function of the frame number. Captions are drawn by another layer at y 1180-1440 (kept empty here), top 0-120 too.
import React from 'react';
import {AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, interpolate, spring, Easing, useCurrentFrame, useVideoConfig} from 'remotion';

const W = 1080, H = 1920;
const AMBER = '#F2B233', BROWN = '#1A0F05', CREAM = '#FAF0DC';
const HONEY = '#E39A1C', DEEP = '#B86E0D', LIGHT = '#FFD98A';
const GREEN = '#6CC27A', RED = '#E2574C', BLUE = '#6FB7E8', ORANGE = '#FF8A3D', PALE = '#D9CBB0';
const BIG = "'Archivo Black', sans-serif", SMALL = "'Montserrat', sans-serif";
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const XF = 0.3;   // seconds a scene fades in over the one before it

// ---------- tiny pure helpers ----------
const lerp = (a, b, p) => a + (b - a) * p;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t, a, d = 0.4, e = Easing.out(Easing.cubic)) => interpolate(t, [a, a + d], [0, 1], {...CL, easing: e});
const lin = (t, a, d) => interpolate(t, [a, a + d], [0, 1], CL);
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // seeded, no Math.random
const fmt = (n) => Math.round(n).toLocaleString('en-US');
// a spring that starts at time a (seconds), 0 before it
const pop = (t, a, fps, cfg) => (t < a ? 0 : spring({frame: Math.round((t - a) * fps), fps, config: cfg || {damping: 11, stiffness: 170, mass: 0.7}}));
const soft = {damping: 16, stiffness: 120, mass: 0.9};
const bouncy = {damping: 8, stiffness: 190, mass: 0.6};
// word lookup: at(lineIndex, 'word', nth) -> start time of that word in the narration (prefix match, punctuation ignored)
const cleanW = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const makeAt = (lines) => (li, word, nth = 0) => {
  const L = lines[li];
  if (!L) return 0;
  const target = cleanW(word);
  let k = 0;
  for (const w of L.words) { if (cleanW(w[0]).startsWith(target)) { if (k === nth) return w[1]; k++; } }
  return L.t0;
};
const hexPts = (cx, cy, r) => {
  const p = [];
  for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
  return p.join(' ');
};
const polyPts = (cx, cy, r, n, rot = -Math.PI / 2) => {
  const p = [];
  for (let i = 0; i < n; i++) { const a = rot + Math.PI * 2 / n * i; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
  return p.join(' ');
};
// SVG arc path for donut slices (angles in degrees, 0 = top, clockwise)
const arcPath = (cx, cy, r0, r1, a0, a1) => {
  if (a1 - a0 <= 0.01) return '';
  const A = (a1 - a0 >= 359.99) ? 359.99 : a1 - a0;
  const rad = (d) => (d - 90) * Math.PI / 180;
  const p = (r, d) => `${(cx + r * Math.cos(rad(d))).toFixed(2)} ${(cy + r * Math.sin(rad(d))).toFixed(2)}`;
  const big = A > 180 ? 1 : 0;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${big} 1 ${p(r1, a0 + A)} L ${p(r0, a0 + A)} A ${r0} ${r0} 0 ${big} 0 ${p(r0, a0)} Z`;
};

// ---------- shared building blocks ----------
// warm dark science world with a honeycomb that breathes (never a flat still)
function SciBg({t, tint = 0}) {
  const cells = [];
  const r = 64;
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 10; col++) {
      const x = col * r * 1.74 + (row % 2 ? r * 0.87 : 0) - 20;
      const y = row * r * 1.5 - 40;
      const i = row * 10 + col;
      const o = 0.035 + 0.035 * Math.sin(t * 0.9 + rnd(i) * 6.28) + tint * 0.02;
      cells.push(<polygon key={i} points={hexPts(x, y, r * 0.9)} fill={AMBER} opacity={o} />);
    }
  }
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${BROWN} 0%, #2B1A08 60%, #1F1206 100%)`}}>
      <svg width={W} height={H} style={{position: 'absolute'}}>{cells}</svg>
    </AbsoluteFill>
  );
}

// the captions layer owns y 1180-1440; a soft darker band there keeps drawings from fighting the words
function CaptionBand() {
  return <div style={{position: 'absolute', left: 0, top: 1180, width: W, height: 260, background: 'linear-gradient(180deg, rgba(26,15,5,0) 0%, rgba(26,15,5,0.35) 25%, rgba(26,15,5,0.35) 75%, rgba(26,15,5,0) 100%)'}} />;
}

function AiTag({t, a}) {
  return (
    <div style={{position: 'absolute', left: 44, top: 140, padding: '8px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.55)',
                 fontFamily: SMALL, fontWeight: 700, fontSize: 24, color: '#F2F2F2', letterSpacing: 1, opacity: ease(t, a + 0.1, 0.3)}}>AI recreation</div>
  );
}

// a big word/number, Archivo Black, pops on its word
function Pop({t, a, fps, children, y = 420, size = 150, color = AMBER, stroke = true, until, x = 0, tilt = -3}) {
  if (t < a || (until && t > until + 0.25)) return null;
  const k = pop(t, a, fps, bouncy);
  const out = until ? interpolate(t, [until, until + 0.25], [1, 0], CL) : 1;
  return (
    <div style={{position: 'absolute', left: 50 + x, right: 50 - x, top: y, textAlign: 'center', opacity: out,
                 transform: `scale(${0.3 + 0.7 * k}) rotate(${tilt * (1 - k)}deg)`}}>
      <div style={{fontFamily: BIG, fontSize: size, lineHeight: 1, color, letterSpacing: -2,
                   WebkitTextStroke: stroke ? '10px #140A02' : '0', paintOrder: 'stroke', textShadow: '0 12px 30px rgba(0,0,0,0.45)'}}>{children}</div>
    </div>
  );
}

// small Montserrat label in a pill, centred on x
function Tag({t, a, fps, x, y, children, bg = AMBER, fg = BROWN, size = 30}) {
  if (t < a) return null;
  const k = pop(t, a, fps, soft);
  return (
    <div style={{position: 'absolute', left: x, top: y, padding: '8px 26px', borderRadius: 999, background: bg, color: fg, textAlign: 'center',
                 fontFamily: SMALL, fontWeight: 800, fontSize: size, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap',
                 opacity: k, transform: `translate(-50%, ${(1 - k) * 24}px) scale(${0.8 + 0.2 * k})`, boxShadow: '0 8px 20px rgba(0,0,0,0.3)'}}>{children}</div>
  );
}

// honey jar in SVG, drawn around (0,0): body 300 wide, from y -170 (shoulder) to 200 (bottom). fill 0..1, lid position/rotation.
function Jar({id, fill = 0.82, lidY = 0, lidRot = 0, lidOpen = 0, honey = HONEY, glassOpacity = 0.18, children, label}) {
  const top = -170, bot = 200;
  const level = bot - (bot - top) * fill;
  return (
    <g>
      <defs>
        <clipPath id={`${id}-body`}>
          <path d="M-150,-130 Q-150,-170 -110,-170 L110,-170 Q150,-170 150,-130 L150,160 Q150,200 110,200 L-110,200 Q-150,200 -150,160 Z" />
        </clipPath>
      </defs>
      {/* honey inside */}
      <g clipPath={`url(#${id}-body)`}>
        <rect x={-150} y={level} width={300} height={bot - level + 10} fill={honey} />
        <rect x={-150} y={level} width={300} height={14} fill={LIGHT} opacity={0.55} />
        {children}
      </g>
      {/* glass */}
      <path d="M-150,-130 Q-150,-170 -110,-170 L110,-170 Q150,-170 150,-130 L150,160 Q150,200 110,200 L-110,200 Q-150,200 -150,160 Z"
            fill={CREAM} opacity={glassOpacity} stroke={CREAM} strokeWidth={8} />
      <path d="M-118,-110 L-118,120" stroke={CREAM} strokeWidth={10} strokeLinecap="round" opacity={0.35} />
      {/* neck */}
      <rect x={-118} y={-200} width={236} height={34} fill={CREAM} opacity={0.5} />
      {/* lid */}
      <g transform={`translate(${lidOpen * 230}, ${-225 + lidY - lidOpen * 160}) rotate(${lidRot + lidOpen * 28})`}>
        <rect x={-130} y={-26} width={260} height={62} rx={16} fill={DEEP} />
        <rect x={-130} y={-26} width={260} height={18} rx={9} fill={AMBER} opacity={0.6} />
        {[-90, -45, 0, 45, 90].map((x) => <rect key={x} x={x - 6} y={-10} width={12} height={40} rx={4} fill={BROWN} opacity={0.35} />)}
      </g>
      {label ? (
        <g>
          <rect x={-100} y={-20} width={200} height={90} rx={18} fill={CREAM} />
          <text x={0} y={42} textAnchor="middle" fontFamily={BIG} fontSize={44} fill={BROWN}>{label}</text>
        </g>
      ) : null}
    </g>
  );
}

// a bacterium: a capsule with flagella; shrivel 0..1 dries it out; pale 0..1 fades its colour; burst 0..1 blows it apart
function Germ({x = 0, y = 0, s = 1, t = 0, seed = 0, shrivel = 0, pale = 0, burst = 0, color = '#8FD68F'}) {
  const wob = Math.sin(t * 3 + seed) * 4;
  const sx = lerp(1, 0.45, shrivel), sy = lerp(1, 0.78, shrivel);
  const fill = pale > 0 ? (pale > 0.5 ? PALE : '#B9CF9A') : color;
  if (burst >= 1) return null;
  const bits = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = i * 1.047 + seed;
    const d = burst * 120;
    return <circle key={i} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={14 * (1 - burst)} fill={fill} />;
  });
  return (
    <g transform={`translate(${x}, ${y}) scale(${s}) rotate(${wob})`}>
      {burst > 0 ? bits : null}
      <g opacity={1 - burst} transform={`scale(${sx}, ${sy})`}>
        {/* flagella */}
        {[-1, 0, 1].map((k) => (
          <path key={k} d={`M${-70} ${k * 14} q -20 ${8 + Math.sin(t * 6 + k + seed) * 10} -40 0 t -40 0`} stroke={fill} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.9} />
        ))}
        <rect x={-72} y={-36} width={144} height={72} rx={36} fill={fill} />
        <rect x={-50} y={-24} width={60} height={14} rx={7} fill="#fff" opacity={0.35} />
        <circle cx={28} cy={-6} r={7} fill={BROWN} opacity={0.7} />
        <circle cx={50} cy={-6} r={7} fill={BROWN} opacity={0.7} />
        {/* wrinkles when dried */}
        <g opacity={shrivel}>
          {[-40, -15, 10, 35].map((wx) => <path key={wx} d={`M${wx} -22 q 6 10 0 20 t 0 20`} stroke={BROWN} strokeWidth={3} fill="none" opacity={0.5} />)}
        </g>
      </g>
    </g>
  );
}

// water droplet
const Drop = ({x, y, s = 1, o = 1, color = BLUE}) => (
  <path transform={`translate(${x}, ${y}) scale(${s})`} d="M0,-26 C10,-10 20,0 20,10 A20,20 0 0 1 -20,10 C-20,0 -10,-10 0,-26 Z" fill={color} opacity={o} />
);

// sugar ring sketch: 6 ring (glucose, hexagon) or 5 ring (fructose, pentagon) with little OH arms
function Molecule({x, y, s = 1, kind = 'glucose', color = CREAM, spin = 0, label = true, o = 1}) {
  const n = kind === 'glucose' ? 6 : 5;
  const r = 46;
  const pts = polyPts(0, 0, r, n, -Math.PI / 2 + spin);
  const arms = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + spin + Math.PI * 2 / n * i;
    arms.push(<line key={i} x1={Math.cos(a) * r} y1={Math.sin(a) * r} x2={Math.cos(a) * (r + 22)} y2={Math.sin(a) * (r + 22)} stroke={color} strokeWidth={5} strokeLinecap="round" />);
    arms.push(<circle key={`c${i}`} cx={Math.cos(a) * (r + 30)} cy={Math.sin(a) * (r + 30)} r={7} fill={i % 2 ? AMBER : color} />);
  }
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o}>
      <polygon points={pts} fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" />
      {arms}
      <text x={0} y={8} textAnchor="middle" fontFamily={BIG} fontSize={20} fill={color}>O</text>
      {label ? <text x={0} y={r + 68} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={24} fill={color} letterSpacing={2}>{kind.toUpperCase()}</text> : null}
    </g>
  );
}

// a scene wrapper: fades in over XF seconds on top of the previous scene
function Scene({t, a, children}) {
  return <AbsoluteFill style={{opacity: a <= 0 ? 1 : ease(t, a, XF, Easing.inOut(Easing.quad))}}>{children}</AbsoluteFill>;
}
// real footage / photo, full frame, with a punch-in on the cut and a slow push; `a`..`b` in global seconds
function Clip({src, from = 0, a, b, t, fps, zoom = [1.04, 1.14], fx = 50, fy = 50, dark = 0.35, photo = false, rate = 1, ai = false, sepia = 0, blur = 0}) {
  if (t < a || t > b + XF) return null;
  const p = lin(t, a, Math.max(0.1, b - a));
  const z = lerp(zoom[0], zoom[1], p) + interpolate(t, [a, a + 0.35], [0.06, 0], {...CL, easing: Easing.out(Easing.cubic)});
  const filters = [sepia ? `sepia(${sepia}) contrast(1.05)` : '', blur ? `blur(${blur}px)` : ''].filter(Boolean).join(' ');
  const style = {position: 'absolute', width: W, height: H, objectFit: 'cover', objectPosition: `${fx}% ${fy}%`,
                 transform: `scale(${z})`, transformOrigin: `${fx}% ${fy}%`, filter: filters || undefined};
  const fade = interpolate(t, [a, a + 0.2], [0, 1], CL);
  return (
    <AbsoluteFill style={{opacity: fade, background: '#000'}}>
      <Sequence from={Math.round(a * fps)} durationInFrames={Math.max(1, Math.round((b - a + XF) * fps))} layout="none">
        {photo ? <Img src={staticFile(`fs/${src}`)} style={style} />
               : <OffthreadVideo src={staticFile(`fs/${src}`)} muted startFrom={Math.round(from * fps)} playbackRate={rate} style={style} />}
      </Sequence>
      <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(0,0,0,${dark + 0.2}) 0%, rgba(0,0,0,${dark * 0.4}) 30%, rgba(0,0,0,${dark * 0.4}) 55%, rgba(0,0,0,${dark + 0.35}) 100%)`}} />
      {ai ? <AiTag t={t} a={a} /> : null}
    </AbsoluteFill>
  );
}

// the history timeline: 3000 BC ... 2026, compact, at y 1080 just above the caption band (review 1: below y 1500 is hidden by the
// Shorts UI). pins drop on their word above the bar; the year bracket counts below the bar and takes the tick labels' place.
function Timeline({t, fps, a, pins = [], bracket, y = 1080}) {
  if (t < a) return null;
  const yx = (yr) => interpolate(yr, [-3000, 2026], [110, 970]);
  const draw = ease(t, a, 0.7);
  const ticks = [-3000, -2000, -1000, 0, 1000, 2000];
  const tickO = bracket ? 1 - ease(t, bracket.at, 0.3) : 1;
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      <rect x={110} y={y - 5} width={860 * draw} height={10} rx={5} fill={CREAM} opacity={0.85} />
      {ticks.map((yr, i) => {
        const o = interpolate(t, [a + 0.1 + i * 0.09, a + 0.4 + i * 0.09], [0, 1], CL) * tickO;
        return (
          <g key={yr} opacity={o}>
            <rect x={yx(yr) - 2} y={y - 14} width={4} height={28} fill={CREAM} />
            <text x={yx(yr)} y={y + 48} textAnchor="middle" fontFamily={SMALL} fontWeight={700} fontSize={20} fill={CREAM} opacity={0.75}>
              {yr < 0 ? `${-yr} BC` : yr === 0 ? '0' : `${yr} AD`}</text>
          </g>
        );
      })}
      {pins.map((p, i) => {
        if (t < p.at) return null;
        const k = pop(t, p.at, fps, bouncy);
        const px = yx(p.year);
        const col = p.color || AMBER;
        return (
          <g key={i} transform={`translate(${px}, ${y + (1 - k) * -160})`} opacity={Math.min(1, k * 2)}>
            <path d="M0,0 L-18,-44 A24,24 0 1 1 18,-44 Z" fill={col} />
            <circle cx={0} cy={-50} r={10} fill={BROWN} />
            <text x={0} y={-86} textAnchor="middle" fontFamily={BIG} fontSize={32} fill={col}>{p.label}</text>
            <text x={0} y={-112} textAnchor="middle" fontFamily={SMALL} fontWeight={700} fontSize={20} fill={CREAM} opacity={0.85}>{p.sub}</text>
          </g>
        );
      })}
      {bracket && t >= bracket.at ? (() => {
        const k = ease(t, bracket.at, 1.0, Easing.out(Easing.quad));
        const x0 = yx(bracket.from), x1 = yx(bracket.to);
        const xe = lerp(x0, x1, k);
        return (
          <g>
            <path d={`M${x0} ${y + 22} L${x0} ${y + 42} L${xe} ${y + 42} L${xe} ${y + 22}`} stroke={AMBER} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x={(x0 + x1) / 2} y={y + 88} textAnchor="middle" fontFamily={BIG} fontSize={44} fill={AMBER}>{fmt(bracket.n * k)}{k >= 1 ? '+' : ''} YEARS</text>
          </g>
        );
      })() : null}
    </svg>
  );
}

// ---------- SCENE 0+1 (lines 0-1): the hook. honey footage, a counter that spins 100 / 200 / 1,000 ... then way past 3,000 ----------
function SceneHook({t, at, fps, a, b, lines}) {
  const h1 = at(0, 'hundred'), h2 = at(0, 'hundred', 1), th = at(0, 'thousand'), way = at(1, 'way');
  const value = t < h1 ? 0
    : t < h2 ? lerp(0, 100, ease(t, h1, 0.35))
    : t < th ? lerp(100, 200, ease(t, h2, 0.35))
    : t < way ? lerp(200, 1000, ease(t, th, 0.45))
    : lerp(1000, 3000, ease(t, way, 1.2, Easing.out(Easing.quad)));
  const last = t < h1 ? -10 : t < h2 ? h1 : t < th ? h2 : t < way ? th : way;
  const punch = 1 + 0.18 * (1 - ease(t, last, 0.35));
  const spinning = t >= way && t < way + 1.2;
  const shake = spinning ? Math.sin(t * 60) * 6 : 0;
  const done = t >= way + 1.2;
  return (
    <Scene t={t} a={a}>
      <Clip src="honey-drip-ai.mp4" a={a} b={lines[1].t0} t={t} fps={fps} ai zoom={[1.02, 1.12]} dark={0.3} />
      <Clip src="pyramids-1897.mp4" a={lines[1].t0} b={b} t={t} fps={fps} zoom={[1.1, 1.22]} fx={50} fy={40} dark={0.3} sepia={0.6} />
      {/* the counter (review 3: no title words, the footage carries the question) */}
      {t >= h1 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', transform: `scale(${punch}) translateX(${shake}px)`}}>
          <div style={{fontFamily: BIG, fontSize: 230, lineHeight: 1, color: done ? AMBER : CREAM, letterSpacing: -4, WebkitTextStroke: '12px #140A02', paintOrder: 'stroke',
                       textShadow: done ? `0 0 60px ${AMBER}` : '0 12px 30px rgba(0,0,0,0.5)'}}>{fmt(value)}{done ? '+' : ''}</div>
          <div style={{fontFamily: SMALL, fontWeight: 800, fontSize: 48, color: CREAM, letterSpacing: 6, marginTop: 10, WebkitTextStroke: '8px #140A02', paintOrder: 'stroke'}}>YEARS</div>
        </div>
      ) : null}
      {t >= h1 && t < way ? (
        <svg width={W} height={H} style={{position: 'absolute'}}>
          {[h1, h2, th].map((w, i) => (t >= w ? <circle key={i} cx={540} cy={430} r={160 + 500 * lin(t, w, 0.7)} fill="none" stroke={AMBER} strokeWidth={10 * (1 - lin(t, w, 0.7))} opacity={1 - lin(t, w, 0.7)} /> : null))}
        </svg>
      ) : null}
    </Scene>
  );
}

// ---------- SCENE 2 (line 2): the tomb. review 2: only the footage. AI tomb clip, then the real Burton photo of the jars; "3,000+" pops ----------
function SceneTomb({t, at, fps, a, b}) {
  const jars = at(2, 'jars'), three = at(2, 'three');
  return (
    <Scene t={t} a={a}>
      <Clip src="honey-tomb-ai.mp4" a={a} b={jars} t={t} fps={fps} ai zoom={[1.04, 1.16]} dark={0.3} />
      <Clip src="tut-burton-020.jpg" photo a={jars} b={b} t={t} fps={fps} zoom={[1.1, 1.3]} fx={50} fy={45} dark={0.35} />
      <Pop t={t} a={three} fps={fps} y={300} size={200} color={AMBER}>3,000+</Pop>
    </Scene>
  );
}

// ---------- SCENE 3 (line 3): still good to eat? review 2: only the Burton photo with its slow push; the narration carries the words ----------
function SceneProven({t, at, fps, a, b}) {
  return (
    <Scene t={t} a={a}>
      <Clip src="tut-burton-026.jpg" photo a={a} b={b} t={t} fps={fps} zoom={[1.15, 1.3]} fx={40} fy={50} dark={0.45} />
    </Scene>
  );
}

// ---------- SCENE 4 (line 4): Georgia. a drawn map (Black Sea, Caucasus, Caspian), a clay pot rises, a pin drops, the timeline gets 2500 BC ----------
function SceneGeorgia({t, at, fps, a, b}) {
  const oldest = at(4, 'oldest'), honey = at(4, 'honey'), clay = at(4, 'clay'), geo = at(4, 'Georgia'), four = at(4, 'four');
  const draw = ease(t, oldest, 1.2);
  const cam = 1 + 0.12 * lin(t, a, b - a);
  const kPot = pop(t, clay, fps, bouncy);
  const kPin = pop(t, geo, fps, bouncy);
  const gx = 600, gy = 540;   // where Georgia sits on the drawing: between the seas, south of the ridge
  return (
    <Scene t={t} a={a}>
      <SciBg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(540, 640) scale(${cam}) translate(-540, -640)`}>
          {/* land */}
          <rect x={0} y={160} width={W} height={940} fill="#4A3014" opacity={0.5 * draw} />
          {/* Black Sea: wide west-east, the Crimea peninsula hanging from its north coast; its east coast is Georgia's shore */}
          <path d="M-60,430 C20,395 110,385 180,392 C215,396 235,420 250,445 C262,470 285,478 305,455 C320,432 335,400 370,392 C420,384 460,420 470,470 C478,520 470,580 440,630 C400,690 300,712 180,700 C60,688 -30,660 -60,620 Z"
                fill="#2E4F6B" opacity={draw} />
          {/* Caspian: tall north-south, east of Georgia */}
          <path d="M840,200 C900,190 960,215 985,300 C1010,400 985,520 960,620 C935,720 960,840 925,930 C890,1000 820,985 800,900 C785,800 820,700 800,600 C780,500 770,380 790,290 C803,235 820,205 840,200 Z"
                fill="#2E4F6B" opacity={draw} />
          <text x={230} y={580} textAnchor="middle" fontFamily={SMALL} fontWeight={700} fontSize={26} fill={CREAM} opacity={0.6 * draw} letterSpacing={3}>BLACK SEA</text>
          <text x={880} y={560} textAnchor="middle" fontFamily={SMALL} fontWeight={700} fontSize={26} fill={CREAM} opacity={0.6 * draw} letterSpacing={3}>CASPIAN</text>
          {/* Georgia: between the two seas, just south of the ridge */}
          <path d="M470,480 C540,455 640,460 740,500 C775,520 770,575 735,600 C660,630 570,630 505,598 C462,570 448,510 470,480 Z" fill={AMBER} opacity={0.35 + 0.5 * kPin} />
          {/* Caucasus ridge draws on, from the Black Sea's north-east corner down to the Caspian */}
          <path d="M455,430 L510,392 L560,440 L615,398 L665,450 L720,410 L770,462 L810,428" stroke={CREAM} strokeWidth={9} fill="none" strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={600} strokeDashoffset={600 * (1 - ease(t, oldest + 0.3, 1.0))} opacity={0.9} />
          <text x={760} y={362} textAnchor="middle" fontFamily={SMALL} fontWeight={700} fontSize={24} fill={CREAM} opacity={0.7 * ease(t, oldest + 1.0, 0.4)} letterSpacing={3}>CAUCASUS</text>
          {/* honey traces: amber sparkles drifting up out of the ground on "honey" */}
          {t >= honey ? [0, 1, 2, 3, 4, 5].map((i) => {
            const ph = ((t - honey) * 0.6 + rnd(i + 9)) % 1;
            return <circle key={i} cx={gx - 60 + i * 24 + Math.sin(t * 2 + i) * 8} cy={gy + 20 - ph * 140} r={5 + 5 * (1 - ph)} fill={AMBER} opacity={(1 - ph) * 0.9} />;
          }) : null}
          {/* the clay pot rises out of the ground */}
          <g transform={`translate(${gx}, ${gy + 40 + (1 - kPot) * 120}) scale(${kPot})`} opacity={kPot}>
            <path d="M-60,-120 L60,-120 L72,-96 Q110,-30 80,60 Q60,110 0,112 Q-60,110 -80,60 Q-110,-30 -72,-96 Z" fill="#B0623A" />
            <path d="M-72,-96 Q0,-70 72,-96" stroke="#7A3F22" strokeWidth={6} fill="none" />
            <ellipse cx={0} cy={-120} rx={60} ry={14} fill={HONEY} />
            <path d="M-20,-60 q 10 30 -5 70" stroke="#7A3F22" strokeWidth={5} fill="none" opacity={0.6} />
            <path d="M-45,-10 L45,-10" stroke="#7A3F22" strokeWidth={5} opacity={0.6} />
          </g>
          {/* the pin */}
          <g transform={`translate(${gx}, ${gy - 110 + (1 - kPin) * -220})`} opacity={Math.min(1, kPin * 2)}>
            <path d="M0,0 L-30,-70 A42,42 0 1 1 30,-70 Z" fill={RED} />
            <circle cx={0} cy={-80} r={16} fill={CREAM} />
          </g>
        </g>
      </svg>
      <Tag t={t} a={geo} fps={fps} x={600} y={760} size={38} bg={RED} fg={CREAM}>Georgia</Tag>
      {/* Kodiani, Georgia: 27th-25th century BC, so the pin sits at 2500 BC (review 1) */}
      <Timeline t={t} fps={fps} a={a}
                pins={[{year: -1323, at: a + 0.3, label: '1323 BC', sub: 'Tutankhamun', color: CREAM}, {year: 1922, at: a + 0.6, label: '1922', sub: 'tomb opened', color: CREAM},
                       {year: -2500, at: four, label: '2500 BC', sub: 'Georgia pots'}]}
                bracket={{from: -2500, to: 2026, at: four, n: 4500}} />
    </Scene>
  );
}
// ---------- SCENE 5 (line 5): why does it last? the jar; germs fly in; on "desert" the honey becomes a desert with a sun and heat shimmer ----------
function SceneDesert({t, at, fps, a, b}) {
  const germs = at(5, 'germs'), desert = at(5, 'desert');
  const kJar = pop(t, a, fps, soft);
  const cam = 1 + 0.08 * lin(t, a, b - a);
  const kDes = ease(t, desert, 0.8);
  const germIn = ease(t, germs, 0.9, Easing.out(Easing.back(1.2)));
  const starts = [[-150, 300], [1230, 420], [-120, 900]];
  const lands = [[-80, -60], [70, -40], [0, 40]];
  return (
    <Scene t={t} a={a}>
      <SciBg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(540, 640) scale(${cam * (0.9 + 0.5 * kJar)})`} opacity={kJar}>
          <Jar id="jd" fill={0.78} honey={HONEY}>
            {/* desert inside the jar: a sun and two dunes and shimmer, all rising with kDes */}
            <circle cx={60} cy={lerp(60, -70, kDes)} r={48} fill={CREAM} opacity={0.9 * kDes} />
            <path d={`M-160,${lerp(200, 70, kDes)} Q-80,${lerp(200, 20, kDes)} 0,${lerp(200, 80, kDes)} T160,${lerp(200, 40, kDes)} L160,220 L-160,220 Z`} fill={LIGHT} opacity={0.55 * kDes} />
            <path d={`M-160,${lerp(200, 130, kDes)} Q-60,${lerp(200, 90, kDes)} 40,${lerp(200, 140, kDes)} T160,${lerp(200, 110, kDes)} L160,220 L-160,220 Z`} fill={DEEP} opacity={0.6 * kDes} />
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M${-90 + i * 70} ${-20 - ((t * 0.7 + rnd(i)) % 1) * 120} q 8 -14 0 -28 t 0 -28`} stroke={CREAM} strokeWidth={4} fill="none" strokeLinecap="round"
                    opacity={kDes * 0.5 * (1 - ((t * 0.7 + rnd(i)) % 1))} />
            ))}
          </Jar>
          {/* germs fly in from the edges, land on the dunes, start to feel the heat */}
          {starts.map((s0, i) => {
            const sx = lerp(s0[0] - 540, lands[i][0], germIn), sy = lerp(s0[1] - 640, lands[i][1], germIn);
            const heat = lin(t, desert + 0.3, 0.9);
            return (
              <g key={i}>
                <Germ x={sx} y={sy} s={0.55} t={t} seed={i * 2} shrivel={heat * 0.35} />
                {t > desert + 0.4 ? [0, 1].map((d) => {
                  const ph = ((t - desert) * 1.4 + rnd(i * 3 + d)) % 1;
                  return <Drop key={d} x={sx + (d ? 40 : -40) + ph * (d ? 40 : -40)} y={sy - 20 - ph * 60} s={0.45 * (1 - ph)} o={(1 - ph) * 0.9} color={BLUE} />;
                }) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </Scene>
  );
}

// ---------- SCENE 6 (line 6): 17% water. a gauge fills to 17 on the number; a bacterium lands in honey and dries out (osmosis arrows) ----------
function SceneWater({t, at, fps, a, b}) {
  const seventeen = at(6, 'seventeen'), water = at(6, 'water'), bact = at(6, 'bacteria'), lands = at(6, 'lands'), dries = at(6, 'dries');
  const kG = pop(t, a, fps, soft);
  const fillP = ease(t, seventeen, 0.9, Easing.out(Easing.cubic));
  const pct = 17 * fillP;
  const gx = 150, gy0 = 260, gh = 820, gw = 220;   // gauge rect
  const wh = gh * 0.17 * fillP;
  const kB = pop(t, bact, fps, soft);
  const drop = ease(t, bact, 0.8, Easing.in(Easing.quad));
  const dry = ease(t, dries, 0.9);
  const arrows = ease(t, dries - 0.15, 0.5);
  const by = lerp(-200, 800, drop);
  return (
    <Scene t={t} a={a}>
      <SciBg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {/* the gauge: all honey, with the water share in blue at the bottom */}
        <g transform={`translate(${gx + gw / 2}, ${gy0 + gh / 2}) scale(${0.8 + 0.2 * kG}) translate(${-(gx + gw / 2)}, ${-(gy0 + gh / 2)})`} opacity={kG}>
          <rect x={gx} y={gy0} width={gw} height={gh} rx={40} fill={HONEY} />
          <defs><clipPath id="gauge"><rect x={gx} y={gy0} width={gw} height={gh} rx={40} /></clipPath></defs>
          <g clipPath="url(#gauge)">
            <rect x={gx} y={gy0 + gh - wh} width={gw} height={wh + 10} fill={BLUE} />
            <path d={`M${gx} ${gy0 + gh - wh} q 28 ${-8 * Math.sin(t * 5)} 55 0 t 55 0 t 55 0 t 55 0 L${gx + gw} ${gy0 + gh} L${gx} ${gy0 + gh} Z`} fill={BLUE} />
            {[0, 1, 2].map((i) => <circle key={i} cx={gx + 40 + i * 70} cy={gy0 + gh - wh + 20 + ((t * 0.4 + rnd(i)) % 1) * (wh - 40)} r={6} fill={CREAM} opacity={0.5 * (wh > 60 ? 1 : 0)} />)}
          </g>
          <rect x={gx} y={gy0} width={gw} height={gh} rx={40} fill="none" stroke={CREAM} strokeWidth={8} />
          {[0, 25, 50, 75, 100].map((p) => <rect key={p} x={gx + gw} y={gy0 + gh - gh * p / 100 - 2} width={p % 50 === 0 ? 26 : 14} height={4} fill={CREAM} opacity={0.6} />)}
          <text x={gx + gw / 2} y={gy0 + 110} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={24} fill={BROWN} opacity={0.75} letterSpacing={2}>SUGARS</text>
          <text x={gx + gw / 2} y={gy0 + 142} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={24} fill={BROWN} opacity={0.75} letterSpacing={2}>& MORE</text>
        </g>
        {/* the honey pool on the right where the germ lands */}
        <g opacity={kB}>
          <path d={`M520,860 Q560,${790 + Math.sin(t * 2) * 6} 740,800 T960,850 L960,1120 L520,1120 Z`} fill={HONEY} />
          <path d="M520,1120 L960,1120" stroke={CREAM} strokeWidth={6} opacity={0.3} />
          <Germ x={740} y={by} s={1.1} t={t} seed={7} shrivel={dry} pale={dry} />
          {/* splash on landing */}
          {t > lands && t < lands + 0.6 ? [0, 1, 2, 3, 4].map((i) => {
            const p = lin(t, lands, 0.6);
            return <circle key={i} cx={740 + (i - 2) * 60 * p} cy={790 - Math.sin(p * Math.PI) * 90 - i * 6} r={10 * (1 - p)} fill={LIGHT} />;
          }) : null}
          {/* osmosis: arrows pointing OUT of the cell into the honey, water droplets following them */}
          {t > dries - 0.15 ? [0, 1, 2, 3].map((i) => {
            const ang = -Math.PI / 2 + i * Math.PI / 2 + 0.6;
            const x0 = 740 + Math.cos(ang) * 95, y0 = by + Math.sin(ang) * 60;
            const x1 = 740 + Math.cos(ang) * (95 + 110 * arrows), y1 = by + Math.sin(ang) * (60 + 110 * arrows);
            const ph = ((t - dries) * 1.3 + rnd(i + 20)) % 1;
            return (
              <g key={i}>
                <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={BLUE} strokeWidth={8} strokeLinecap="round" opacity={0.9} />
                <polygon points={polyPts(x1, y1, 18, 3, ang)} fill={BLUE} opacity={arrows} />
                {t > dries ? <Drop x={lerp(x0, x1, ph)} y={lerp(y0, y1, ph) - 10} s={0.5 * (1 - ph * 0.5)} o={1 - ph} /> : null}
              </g>
            );
          }) : null}
        </g>
      </svg>
      {/* the counting number */}
      {t >= seventeen ? (
        <div style={{position: 'absolute', left: 400, top: 330, fontFamily: BIG, fontSize: 180, color: BLUE, lineHeight: 1, WebkitTextStroke: '10px #140A02', paintOrder: 'stroke',
                     transform: `scale(${1 + 0.1 * (1 - fillP)})`, transformOrigin: 'left center'}}>{Math.round(pct)}%</div>
      ) : null}
      <Tag t={t} a={water} fps={fps} x={560} y={530} bg={BLUE} fg={BROWN} size={36}>water</Tag>
      <Tag t={t} a={dries} fps={fps} x={700} y={1105} bg={BLUE} fg={BROWN} size={30}>water pulled out</Tag>
    </Scene>
  );
}

// ---------- SCENE 7 (line 7): acidic. a pH scale 0-14 builds; the honey marker slides from 7 to 3.9; orange juice pops next to it at 3.5 ----------
function ScenePH({t, at, fps, a, b}) {
  const acidic = at(7, 'acidic'), ph = at(7, 'pH'), three = at(7, 'three'), oj = at(7, 'orange');
  const build = ease(t, a + 0.1, 0.8);
  const px = (v) => interpolate(v, [0, 14], [110, 970]);
  const slide = ease(t, three, 1.0, Easing.inOut(Easing.cubic));
  const val = lerp(7, 3.9, slide);
  const kOJ = pop(t, oj, fps, bouncy);
  const barY = 660;   // review 3: nudged up now that the ACIDIC title is gone
  const stops = ['#D7352B', '#E8632B', '#F2A42B', '#E8D24A', '#9CC94B', '#4FB36B', '#3F9F8E', '#3B7FBF', '#4C5BB2', '#6B48A8'];
  return (
    <Scene t={t} a={a}>
      <SciBg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs>
          <linearGradient id="phg" x1="0" x2="1" y1="0" y2="0">
            {stops.map((c, i) => <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={c} />)}
          </linearGradient>
        </defs>
        <g transform={`translate(540, ${barY}) scale(${build}, 1) translate(-540, ${-barY})`} opacity={build}>
          <rect x={110} y={barY - 30} width={860} height={60} rx={30} fill="url(#phg)" />
          {[0, 2, 4, 6, 7, 8, 10, 12, 14].map((v) => (
            <g key={v}>
              <rect x={px(v) - 2} y={barY + 36} width={4} height={18} fill={CREAM} opacity={0.6} />
              <text x={px(v)} y={barY + 86} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={26} fill={CREAM} opacity={0.8}>{v}</text>
            </g>
          ))}
          <text x={120} y={barY - 56} fontFamily={SMALL} fontWeight={800} fontSize={24} fill={CREAM} opacity={0.7} letterSpacing={3}>ACID</text>
          <text x={960} y={barY - 56} textAnchor="end" fontFamily={SMALL} fontWeight={800} fontSize={24} fill={CREAM} opacity={0.7} letterSpacing={3}>ALKALINE</text>
        </g>
        {/* water reference at 7 */}
        <g transform={`translate(${px(7)}, ${barY + 150})`} opacity={ease(t, a + 0.8, 0.4)}>
          <Drop x={0} y={0} s={1.2} />
          <text x={0} y={60} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={22} fill={CREAM} opacity={0.8}>WATER 7</text>
        </g>
        {/* honey marker: a little jar above the bar that slides */}
        <g transform={`translate(${px(val)}, ${barY - 160}) scale(${0.42 * pop(t, acidic, fps, soft)}) rotate(${Math.sin(t * 6) * 3 * (slide > 0 && slide < 1 ? 1 : 0)})`}>
          <Jar id="jph" fill={0.8} />
          <path transform="translate(0, 236)" d="M-40,0 L40,0 L0,52 Z" fill={CREAM} />
        </g>
        {/* the orange juice glass at 3.5 */}
        <g transform={`translate(${px(3.5)}, ${barY + 190}) scale(${kOJ}) translate(0, ${(1 - kOJ) * 80})`} opacity={kOJ}>
          <path d="M-50,-70 L50,-70 L40,70 Q0,84 -40,70 Z" fill={CREAM} opacity={0.35} />
          <path d="M-45,-30 L45,-30 L40,70 Q0,84 -40,70 Z" fill={ORANGE} />
          <rect x={30} y={-110} width={10} height={70} rx={5} fill={CREAM} transform="rotate(12 35 -75)" />
          <circle cx={-56} cy={-66} r={24} fill={ORANGE} />
          <circle cx={-56} cy={-66} r={14} fill={LIGHT} opacity={0.8} />
          <text x={0} y={130} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={22} fill={CREAM}>ORANGE JUICE 3.5</text>
        </g>
      </svg>
      {t >= ph ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', fontFamily: BIG, fontSize: 170, color: CREAM, lineHeight: 1,
                     WebkitTextStroke: '10px #140A02', paintOrder: 'stroke', transform: `scale(${0.5 + 0.5 * pop(t, ph, fps, bouncy)})`}}>
          pH {t < three ? '?' : val.toFixed(1)}
        </div>
      ) : null}
    </Scene>
  );
}

// ---------- SCENE 8 (line 8): the enzyme. a bee drops a friendly blob; glucose rings go in, H2O2 bubbles come out and pop germs; first aid kit ----------
function Bee({x, y, t, s = 1, flip = false}) {
  const flap = Math.sin(t * 60) * 0.5 + 0.6;
  return (
    <g transform={`translate(${x}, ${y}) scale(${flip ? -s : s}, ${s})`}>
      <ellipse cx={-22} cy={-28} rx={30} ry={14} fill={CREAM} opacity={0.8} transform={`scale(1, ${flap})`} />
      <ellipse cx={8} cy={-30} rx={30} ry={14} fill={CREAM} opacity={0.8} transform={`scale(1, ${flap})`} />
      <ellipse cx={0} cy={0} rx={46} ry={30} fill={AMBER} />
      <rect x={-20} y={-30} width={14} height={60} fill={BROWN} opacity={0.8} />
      <rect x={10} y={-30} width={14} height={60} fill={BROWN} opacity={0.8} />
      <circle cx={-48} cy={-4} r={16} fill={BROWN} />
      <path d="M46,0 L62,4 L46,8 Z" fill={BROWN} />
    </g>
  );
}

function SceneEnzyme({t, at, fps, a, b}) {
  const bees = at(8, 'bees'), enzyme = at(8, 'enzyme'), slowly = at(8, 'slowly'), hydrogen = at(8, 'hydrogen'), first = at(8, 'first');
  const beeIn = ease(t, bees, 1.0, Easing.inOut(Easing.quad));
  const beeOut = ease(t, enzyme + 0.4, 1.0, Easing.in(Easing.quad));
  const bx = lerp(-120, 540, beeIn) + beeOut * 760, by = 380 + Math.sin(t * 7) * 14 - beeOut * 300;
  const kBlob = pop(t, enzyme, fps, bouncy);
  const blobY = lerp(400, 600, ease(t, enzyme, 0.6, Easing.bounce));
  const feeds = [0, 1, 2, 3, 4].map((i) => slowly + i * 0.75);
  const eating = feeds.reduce((m, f) => Math.max(m, t > f + 0.8 && t < f + 1.1 ? Math.sin((t - f - 0.8) / 0.3 * Math.PI) : 0), 0);
  const germsR = [[880, 380], [900, 600], [860, 820]];
  const kKit = pop(t, first, fps, bouncy);
  return (
    <Scene t={t} a={a}>
      <SciBg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {/* glucose rings glide in from the left and get eaten */}
        {feeds.map((f, i) => {
          if (t < f || t > f + 0.85) return null;
          const p = ease(t, f, 0.85, Easing.in(Easing.quad));
          return <Molecule key={i} x={lerp(-80, 470, p)} y={lerp(560 + (i % 2) * 120, blobY, p)} s={lerp(0.9, 0.2, p * p)} kind="glucose" spin={t * 2} label={p < 0.5} o={1} />;
        })}
        {/* the enzyme blob */}
        <g transform={`translate(540, ${blobY}) scale(${kBlob * (1 + 0.12 * eating)}, ${kBlob * (1 - 0.1 * eating)})`} opacity={kBlob}>
          <path d={`M-120,${-30 + Math.sin(t * 3) * 6} C-130,-120 -40,-150 20,-130 C100,-110 150,-60 130,20 C115,90 50,130 -20,120 C-90,110 -150,60 -120,${-30 + Math.sin(t * 3) * 6} Z`} fill={AMBER} />
          <path d="M-70,-80 C-40,-110 10,-110 40,-90" stroke={LIGHT} strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.7} />
          <circle cx={-30} cy={-10} r={9} fill={BROWN} />
          <circle cx={30} cy={-10} r={9} fill={BROWN} />
          <path d={`M-20,30 Q0,${40 + eating * 10} 20,30`} stroke={BROWN} strokeWidth={6} fill="none" strokeLinecap="round" />
        </g>
        {/* H2O2 bubbles drift right and pop the germs */}
        {t >= hydrogen ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const life = 1.6, start = hydrogen + i * 0.32;
          if (t < start) return null;
          const p = ((t - start) % life) / life;
          const tgt = germsR[i % 3];
          const x = lerp(640, tgt[0], p), y = lerp(blobY, tgt[1], p) + Math.sin(p * 9 + i) * 18;
          return (
            <g key={i} transform={`translate(${x}, ${y})`} opacity={p < 0.9 ? 1 : (1 - p) * 10}>
              <circle r={34} fill={CREAM} opacity={0.25} stroke={CREAM} strokeWidth={4} />
              <text y={8} textAnchor="middle" fontFamily={BIG} fontSize={22} fill={CREAM}>H₂O₂</text>
            </g>
          );
        }) : null}
        {germsR.map((g, i) => {
          const hit = hydrogen + 0.32 * i + 1.55;   // the first bubble aimed at this germ arrives (start + life)
          const burst = t > hit ? lin(t, hit, 0.5) : 0;
          return <Germ key={i} x={g[0]} y={g[1]} s={0.8} t={t} seed={i * 5 + 1} burst={burst} color="#8FD68F" />;
        })}
        {/* the bee */}
        {t > bees && beeOut < 1 ? <Bee x={bx} y={by} t={t} s={1.1} /> : null}
        {/* enzyme drop falls from the bee */}
        {t > enzyme - 0.3 && t < enzyme ? <circle cx={540} cy={lerp(400, 600, lin(t, enzyme - 0.3, 0.3))} r={20} fill={AMBER} /> : null}
        {/* first aid kit */}
        <g transform={`translate(230, 1000) scale(${kKit}) rotate(${-8 * (1 - kKit)})`} opacity={kKit}>
          <rect x={-120} y={-80} width={240} height={160} rx={22} fill={CREAM} />
          <rect x={-40} y={-100} width={80} height={30} rx={10} fill={CREAM} />
          <rect x={-22} y={-60} width={44} height={120} rx={8} fill={RED} />
          <rect x={-60} y={-22} width={120} height={44} rx={8} fill={RED} />
          <rect x={60} y={-30} width={36} height={80} rx={8} fill={DEEP} />
          <text x={78} y={70} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={14} fill={CREAM}>H₂O₂</text>
        </g>
      </svg>
      <Tag t={t} a={enzyme} fps={fps} x={560} y={790} bg={AMBER} size={28}>enzyme · glucose oxidase</Tag>
      <Tag t={t} a={slowly} fps={fps} x={210} y={420} bg={CREAM} size={26}>glucose in</Tag>
    </Scene>
  );
}
// ---------- SCENE 9 (line 9): crystallised. liquid honey in the jar turns grainy and solid from the bottom up; STILL GOOD tick ----------
function SceneCrystal({t, at, fps, a, b}) {
  const solid = at(9, 'solid'), grainy = at(9, 'grainy'), hasnt = at(9, "hasn't");
  const kJar = pop(t, a, fps, soft);
  const grow = ease(t, solid, 1.6, Easing.inOut(Easing.quad));
  const kTick = pop(t, hasnt, fps, bouncy);
  const crystals = [];
  for (let i = 0; i < 46; i++) {
    const cx = -135 + rnd(i) * 270, cy = 190 - rnd(i + 100) * 330;
    const yn = (190 - cy) / 330;                       // 0 bottom .. 1 top
    const k = clamp01((grow - yn * 0.85) / 0.15);        // bottom first
    if (k <= 0) continue;
    const r = 14 + rnd(i + 200) * 16;
    crystals.push(<polygon key={i} points={hexPts(cx, cy, r * k)} fill={i % 3 ? LIGHT : CREAM} opacity={0.75 + 0.25 * rnd(i + 300)} transform={`rotate(${rnd(i + 400) * 60} ${cx} ${cy})`} />);
  }
  const grains = [];
  if (t > grainy) for (let i = 0; i < 70; i++) {
    const cx = -140 + rnd(i + 500) * 280, cy = 195 - rnd(i + 600) * 340;
    const k = clamp01((grow - ((195 - cy) / 340) * 0.85) / 0.15);
    grains.push(<circle key={i} cx={cx} cy={cy} r={3 * k} fill={DEEP} opacity={0.5} />);
  }
  const shake = t > solid && t < solid + 0.5 ? Math.sin((t - solid) * 50) * 3 * (1 - lin(t, solid, 0.5)) : 0;
  return (
    <Scene t={t} a={a}>
      <SciBg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${440 + shake}, 650) scale(${(0.9 + 0.5 * kJar) * 1.2}) rotate(${shake})`} opacity={kJar}>
          <Jar id="jc" fill={0.82} honey={HONEY}>
            {/* liquid: a gentle wave while it is still liquid */}
            <path d={`M-160,${-105 + Math.sin(t * 2.5) * 5 * (1 - grow)} q 60 ${-10 * (1 - grow)} 120 0 t 120 0 L160,-80 L-160,-80 Z`} fill={LIGHT} opacity={0.4} />
            {/* the set honey gets paler and opaque from the bottom */}
            <rect x={-160} y={200 - 340 * grow} width={320} height={340 * grow + 20} fill={LIGHT} opacity={0.55} />
            {crystals}
            {grains}
          </Jar>
        </g>
        {/* the tick */}
        <g transform={`translate(830, 480) scale(${kTick})`} opacity={kTick}>
          <circle r={110} fill={GREEN} />
          <path d="M-52,6 L-14,46 L58,-46" stroke={CREAM} strokeWidth={26} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const an = i * 1.047, d = 130 + 60 * ((t - hasnt) % 1);
            return <circle key={i} cx={Math.cos(an) * d} cy={Math.sin(an) * d} r={8 * (1 - ((t - hasnt) % 1))} fill={GREEN} />;
          })}
        </g>
      </svg>
    </Scene>
  );
}

// ---------- SCENE 10 (line 10): what is honey made of? a donut chart builds slice by slice on the words; molecules fly into their slices ----------
function SceneComposition({t, at, fps, a, b}) {
  const made = at(10, 'made'), mostly = at(10, 'Mostly');
  const t38 = at(10, 'thirty'), fru = at(10, 'fructose'), t31 = at(10, 'thirty', 1), glu = at(10, 'glucose'), plus = at(10, 'plus');
  const mal = at(10, 'maltose'), aci = at(10, 'acids'), min = at(10, 'minerals'), enz = at(10, 'enzymes');
  const slices = [
    {name: 'Fructose', pct: 38, color: AMBER, at: t38, dur: 1.0},
    {name: 'Glucose', pct: 31, color: LIGHT, at: t31, dur: 1.0},
    {name: 'Water', pct: 17, color: BLUE, at: plus, dur: 0.7},
    {name: 'Maltose', pct: 7, color: CREAM, at: mal, dur: 0.5},
    {name: 'Other sugars', pct: 3, color: PALE, at: mal + 0.45, dur: 0.4},
    {name: 'Acids, minerals, enzymes', lines: ['Acids, minerals', '& enzymes'], pct: 4, color: GREEN, at: aci, dur: 0.4, steps: [aci, min, enz]},
  ];
  // donut on the left, legend to its right (review 1: nothing of the composition below y 1100)
  const cx = 340, cy = 600, r0 = 175, r1 = 300;
  let ang = 0;
  const drawn = slices.map((s) => {
    let k;
    if (s.steps) k = s.steps.reduce((m, st) => m + ease(t, st, 0.35) / 3, 0);
    else k = ease(t, s.at, s.dur, Easing.out(Easing.cubic));
    const a0 = ang, a1 = ang + s.pct * 3.6 * k;
    ang += s.pct * 3.6;
    return {...s, k, a0, a1, mid: (a0 + ang) / 2};
  });
  const current = [...drawn].reverse().find((s) => s.k > 0);
  const kJar = pop(t, made - 0.3, fps, soft) * (1 - ease(t, mostly, 0.4));
  const ring = ease(t, mostly, 0.6);
  const flyIn = (start, from, slice) => {
    if (t < start) return null;
    const p = ease(t, start, 0.9, Easing.inOut(Easing.cubic));
    const rad = (slice.mid - 90) * Math.PI / 180, rr = (r0 + r1) / 2;
    const x = lerp(from[0], cx + Math.cos(rad) * rr, p), y = lerp(from[1], cy + Math.sin(rad) * rr, p);
    return <Molecule x={x} y={y} s={lerp(1.1, 0.55, p)} kind={slice.name.toLowerCase()} color={p > 0.8 ? BROWN : CREAM} spin={t * 1.5 * (1 - p)} label={p < 0.7} />;
  };
  return (
    <Scene t={t} a={a}>
      <SciBg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {/* the ring track */}
        <circle cx={cx} cy={cy} r={(r0 + r1) / 2} fill="none" stroke={CREAM} strokeWidth={(r1 - r0) * ring} opacity={0.12} />
        {drawn.map((s, i) => <path key={i} d={arcPath(cx, cy, r0, r1, s.a0, s.a1)} fill={s.color} stroke={BROWN} strokeWidth={4} />)}
        {/* the jar with a question mark, before the chart takes over */}
        <g transform={`translate(${cx}, ${cy + 30}) scale(${0.7 * kJar})`} opacity={kJar}>
          <Jar id="jq" fill={0.8} />
          <text x={0} y={60} textAnchor="middle" fontFamily={BIG} fontSize={150} fill={BROWN} opacity={0.8}>?</text>
        </g>
        {/* the hole shows the slice being built */}
        {current && t >= mostly ? (
          <g>
            <text x={cx} y={cy + 20} textAnchor="middle" fontFamily={BIG} fontSize={120} fill={current.color} stroke={BROWN} strokeWidth={6} paintOrder="stroke">{Math.round(current.pct * current.k)}%</text>
            <text x={cx} y={cy + 80} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={current.name.length > 10 ? 22 : 30} fill={CREAM} letterSpacing={2}>{current.name.toUpperCase()}</text>
          </g>
        ) : null}
        {flyIn(fru, [-80, 260], drawn[0])}
        {flyIn(glu, [1160, 200], drawn[1])}
        {/* legend to the right of the donut (x 650..1000, y 430..830), rows arrive with their slices */}
        {drawn.map((s, i) => {
          if (s.k <= 0) return null;
          const k = pop(t, s.steps ? s.steps[0] : s.at, fps, soft);
          const y = 410 + i * 72;
          return (
            <g key={i} transform={`translate(${(1 - k) * 60}, 0)`} opacity={k}>
              <rect x={650} y={y - 20} width={40} height={40} rx={10} fill={s.color} />
              {s.lines
                ? s.lines.map((ln, j) => <text key={j} x={706} y={y - 2 + j * 26} fontFamily={SMALL} fontWeight={800} fontSize={22} fill={CREAM}>{ln}</text>)
                : <text x={706} y={y + 10} fontFamily={SMALL} fontWeight={800} fontSize={28} fill={CREAM}>{s.name}</text>}
              <text x={1000} y={y + 10} textAnchor="end" fontFamily={BIG} fontSize={30} fill={s.color}>{Math.round(s.pct * s.k)}%</text>
            </g>
          );
        })}
      </svg>
    </Scene>
  );
}

// ---------- SCENE 11 (line 11): the catch. water drops in, honey ferments; the lid screws on; the closed jar glows and holds to the end ----------
function SceneLid({t, at, fps, a, b}) {
  const water = at(11, 'water'), inW = at(11, 'in'), ferment = at(11, 'ferment'), lid = at(11, 'lid'), on = at(11, 'on');
  const kJar = pop(t, a, fps, soft);
  const lidOpen = 1 - ease(t, lid, 0.5, Easing.inOut(Easing.cubic));
  const screw = ease(t, on, 0.6, Easing.out(Easing.cubic));
  const closed = t > on + 0.3;
  const ferm = t > ferment ? Math.min(1, lin(t, ferment, 0.5)) * (1 - ease(t, on, 0.8)) : 0;
  const shake = ferm > 0 ? Math.sin(t * 40) * 4 * ferm : 0;
  const drops = [0, 1, 2].map((i) => water + i * 0.35);
  // review 2: no family tree. after the lid is on, the jar settles back to the centre, glows gently and pushes in slowly to the end
  const settle = ease(t, on + 0.6, 0.8, Easing.inOut(Easing.cubic));
  const push = lin(t, on + 0.6, Math.max(0.5, b - on - 0.6));
  const jarS = 1.25 + 0.12 * push;
  const glow = ease(t, on + 0.4, 1.2) * (0.42 + 0.08 * Math.sin(t * 2));
  return (
    <Scene t={t} a={a}>
      <SciBg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs>
          <radialGradient id="jarglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={AMBER} stopOpacity={0.9} />
            <stop offset="55%" stopColor={AMBER} stopOpacity={0.25} />
            <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={540} cy={660} r={460 + 40 * push} fill="url(#jarglow)" opacity={glow} />
        <g transform={`translate(${540 + shake * (1 - settle)}, 660) scale(${jarS * (0.8 + 0.2 * kJar)})`} opacity={kJar}>
          <Jar id="jl" fill={0.8} lidOpen={lidOpen} lidRot={screw * 360} lidY={screw < 1 ? -10 * Math.sin(screw * Math.PI) : 0}>
            {/* fermentation bubbles */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
              const ph = ((t - ferment) * (0.5 + rnd(i + 70) * 0.5) + rnd(i + 80)) % 1;
              return <circle key={i} cx={-120 + rnd(i + 90) * 240 + Math.sin(t * 3 + i) * 6} cy={190 - ph * 290} r={(6 + rnd(i) * 10) * ferm} fill={CREAM} opacity={0.6 * ferm * (1 - ph * 0.5)} />;
            })}
            {/* foam on the surface */}
            {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={-125 + i * 50} cy={-100 - Math.abs(Math.sin(t * 4 + i)) * 10 * ferm} r={18 * ferm} fill={CREAM} opacity={0.7} />)}
          </Jar>
          {/* the water drops: fall into the open jar; after the lid is on, they bounce off */}
          {drops.map((d, i) => {
            const cyc = 2.2;
            if (t < d) return null;
            const p = ((t - d) % cyc) / cyc;
            if (p > 0.55) return null;
            const q = p / 0.55;
            const dx = -40 + i * 40;
            if (closed) {
              const hitQ = 0.55;
              if (q < hitQ) return <Drop key={i} x={dx} y={lerp(-520, -260, q / hitQ)} s={0.9} />;
              const r = (q - hitQ) / (1 - hitQ);
              return <Drop key={i} x={dx + (i - 1) * 160 * r} y={-260 - Math.sin(r * Math.PI) * 60 + r * 30} s={0.9 * (1 - r)} o={1 - r} />;
            }
            return <Drop key={i} x={dx} y={lerp(-520, -110, q * q)} s={0.9} o={q < 0.95 ? 1 : 0} />;
          })}
          {/* ripples where a drop hits the honey */}
          {!closed && t > inW ? [0, 1, 2].map((i) => {
            const p = ((t - inW) * 1.2 + i * 0.33) % 1;
            return <ellipse key={i} cx={-40 + i * 40} cy={-112} rx={20 + 60 * p} ry={5 + 12 * p} fill="none" stroke={LIGHT} strokeWidth={4} opacity={1 - p} />;
          }) : null}
          {/* sparkle on the sealed jar */}
          {closed ? [0, 1, 2].map((i) => {
            const p = ((t - on) * 0.8 + i * 0.33) % 1;
            return <polygon key={i} points={polyPts(120 - i * 110, -200 - i * 25, 16 * Math.sin(p * Math.PI), 4)} fill={CREAM} />;
          }) : null}
        </g>
      </svg>
    </Scene>
  );
}

// ---------- the composition ----------
export const HoneyFable = ({lines = [], words = [], seconds = 80}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const at = makeAt(lines);
  const T = (i) => (lines[i] ? lines[i].t0 : seconds);
  const scenes = [
    [0, T(2), SceneHook], [T(2), T(3), SceneTomb], [T(3), T(4), SceneProven], [T(4), T(5), SceneGeorgia],
    [T(5), T(6), SceneDesert], [T(6), T(7), SceneWater], [T(7), T(8), ScenePH], [T(8), T(9), SceneEnzyme],
    [T(9), T(10), SceneCrystal], [T(10), T(11), SceneComposition], [T(11), seconds + 1, SceneLid],
  ];
  return (
    <AbsoluteFill style={{background: BROWN}}>
      {scenes.map(([a, b, C], i) => (t >= a && t < b + XF ? <C key={i} t={t} at={at} fps={fps} a={a} b={b} lines={lines} /> : null))}
      <CaptionBand />
      <AbsoluteFill style={{background: BROWN, opacity: interpolate(t, [seconds - 0.5, seconds], [0, 1], CL), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
