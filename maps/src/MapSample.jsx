// "France's longest border?" in ~30 s, real geography (Natural Earth, public domain) drawn with d3-geo every frame.
// One timeline (T) for every look; looks.js only changes the design.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Img} from 'remotion';
import {geoOrthographic, geoPath, geoInterpolate, geoGraticule10} from 'd3-geo';
import geo from './geo.json';
import {LOOKS} from './looks';
import {FONT_CSS} from './fonts';

export const FPS = 30, W = 1920, H = 1080, FRAMES = 900;
const T = {title: 8, deu: [50, 110], esp: [138, 198], bars: 222, wrong: 282, move: [330, 520], arc: [348, 505],
           gf: 505, bra: [545, 668], oyapock: 590, final: 692, head: 718};
const EU = [2.4, 46.5], GF = [-53.15, 3.95];
const MAPX = W * 0.40, MAPY = H * 0.60;   // the map sits left of the comparison panel
const KM = {deu: 418, esp: 646, bra: 730};
const FOCUS = new Set(['FRA', 'GUF']);
const DETAIL = new Set(geo.detail.features.map((f) => f.properties.a3));
const SKIP = new Set([...DETAIL, 'FRA']);
const WORLD = {type: 'FeatureCollection', features: geo.world.features.filter((f) => !SKIP.has(f.properties.a3))};
const GRAT = geoGraticule10();
const ARC = (() => {
  const f = geoInterpolate(geo.places.paris, geo.places.cayenne);
  return {type: 'LineString', coordinates: Array.from({length: 97}, (_, i) => f(i / 96))};
})();
const STARS = Array.from({length: 260}, (_, i) => {
  const r = (k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  return [r(1) * W, r(2) * H, 0.6 + r(3) * 1.4, 0.25 + r(4) * 0.6];
});
const ease = Easing.inOut(Easing.cubic);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const prog = (f, [a, b], e = ease) => interpolate(f, [a, b], [0, 1], {...clamp, easing: e});
const fade = (f, a, b, c, d) => interpolate(f, [a, b, c, d], [0, 1, 1, 0], clamp);

function camera(f, zoom) {
  const [zEU, zMid, zGF] = zoom.map(Math.log);
  if (f <= T.move[0]) return {c: EU, s: interpolate(f, [0, T.move[0]], [zoom[0] * 0.94, zoom[0] * 1.04])};
  if (f >= T.move[1]) return {c: GF, s: interpolate(f, [T.move[1], FRAMES], [zoom[2], zoom[2] * 1.08], clamp)};
  const e = prog(f, T.move);
  const a = Math.log(zoom[0] * 1.04), b = zEU * 0 + zGF;
  const bump = (a + b) / 2 - zMid;
  return {c: geoInterpolate(EU, GF)(e), s: Math.exp(a + (b - a) * e - bump * Math.sin(Math.PI * e))};
}

const Draw = ({d, p, color, width, glow, dash}) => {
  if (!d || p <= 0) return null;
  const common = {d, fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: 1,
                  strokeDasharray: '1 1', strokeDashoffset: 1 - p};
  return (
    <g>
      {glow ? <path {...common} strokeWidth={width * 3.2} opacity={0.45} filter="url(#blur)" /> : null}
      <path {...common} strokeWidth={width} />
    </g>
  );
};

const Label = ({L, x, y, text, op = 1, size, color, anchor = 'middle', rot = 0, focus, weight}) => {
  if (op <= 0.01 || !isFinite(x)) return null;
  const s = size || L.lab.size;
  const t = L.lab.upper ? text.toUpperCase() : text;
  const style = {fontFamily: L.lab.font, fontWeight: weight || L.lab.weight, fontSize: s, letterSpacing: L.lab.spacing};
  if (L.tape) {
    const w = t.length * s * 0.5 + 24;
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    return (
      <g opacity={op} transform={`rotate(${rot} ${x} ${y})`}>
        <rect x={x0} y={y - s * 0.86} width={w} height={s * 1.18} fill={focus ? '#FFD400' : '#FFFFFF'} transform={`rotate(-1.5 ${x} ${y})`} />
        <text x={x0 + w / 2} y={y} textAnchor="middle" fill="#111" style={style}>{t}</text>
      </g>
    );
  }
  return (
    <text x={x} y={y} textAnchor={anchor} fill={color || (focus ? L.focusLabel : L.label)} opacity={op} style={style}
          transform={`rotate(${rot} ${x} ${y})`}>{t}</text>
  );
};

const Num = ({L, x, y, text, color, size, op = 1, anchor = 'start', pop = 1}) => {
  if (op <= 0.01 || !isFinite(x)) return null;
  const style = {fontFamily: L.num.font, fontWeight: L.num.weight, fontStyle: L.num.italic ? 'italic' : 'normal', fontSize: size};
  if (L.tape) {
    const w = text.length * size * 0.42 + 26;
    const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    return (
      <g opacity={op} transform={`translate(${x} ${y}) scale(${pop}) translate(${-x} ${-y})`}>
        <rect x={x0} y={y - size * 0.82} width={w} height={size * 1.0} fill={color} />
        <text x={x0 + w / 2} y={y} textAnchor="middle" fill="#111" style={style}>{text}</text>
      </g>
    );
  }
  return (
    <text x={x} y={y} textAnchor={anchor} fill={color} opacity={op} style={{...style, paintOrder: 'stroke'}}
          stroke={L.glow ? 'rgba(0,0,0,0.35)' : 'none'} strokeWidth={L.glow ? 6 : 0}
          transform={`translate(${x} ${y}) scale(${pop}) translate(${-x} ${-y})`}>{text}</text>
  );
};

const Bar = ({L, f, start, label, km, color, y, max = 730}) => {
  const {fps} = useVideoConfig();
  const op = interpolate(f, [start, start + 10], [0, 1], clamp);
  if (op <= 0) return null;
  const grow = spring({frame: f - start, fps, config: {damping: 200}, durationInFrames: 32});
  const width = 430 * (km / max) * grow;
  const shown = Math.round(km * grow);
  return (
    <div style={{position: 'absolute', left: 1360, top: y, width: 470, opacity: op}}>
      <div style={{height: 16, width, background: color, borderRadius: L.tape ? 0 : 3,
                   boxShadow: L.glow ? `0 0 18px ${color}88` : 'none'}} />
      <div style={{display: 'flex', justifyContent: 'space-between', width: Math.max(width, 300), marginTop: 10,
                   fontFamily: L.panel.font, fontSize: L.tape ? 40 : 30, color: L.text}}>
        <span style={{fontWeight: L.title.font === 'Montserrat' ? 700 : 600}}>{label}</span>
        <span style={{color, fontStyle: L.num.italic ? 'italic' : 'normal', fontWeight: 700}}>{label === 'Brazil' ? '~' : ''}{shown} km</span>
      </div>
    </div>
  );
};

export const MapSample = ({look}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = LOOKS[look] || LOOKS.midnight;
  const cam = camera(f, L.zoom);
  const proj = geoOrthographic().rotate([-cam.c[0], -cam.c[1]]).scale(cam.s).translate([MAPX, MAPY])
    .clipExtent([[-20, -20], [W + 20, H + 20]]).precision(0.35);
  const path = geoPath(proj);
  const P = (ll) => proj(ll) || [NaN, NaN];
  const sphere = path({type: 'Sphere'});

  const pDeu = prog(f, T.deu), pEsp = prog(f, T.esp), pBra = prog(f, T.bra, Easing.inOut(Easing.quad));
  const pArc = prog(f, T.arc);
  const euOp = interpolate(f, [T.move[0], T.move[0] + 24], [1, 0], clamp);
  const gfOp = interpolate(f, [T.gf - 10, T.gf + 20], [0, 1], clamp);
  const popAt = (at) => spring({frame: f - at, fps, config: {damping: 12, stiffness: 160}, durationInFrames: 20});
  const doneFade = (p, end) => (L.fadeDone && f > end + 30 ? interpolate(f, [end + 30, end + 60], [1, 0.35], clamp) : 1);

  const detail = geo.detail.features.map((ft) => {
    const a3 = ft.properties.a3;
    const focus = FOCUS.has(a3);
    return (
      <path key={a3} d={path(ft)} fill={focus ? 'url(#focus)' : (L.neighbour[a3] || L.land)} stroke={focus ? L.focusStroke : L.landStroke}
            strokeWidth={focus ? 1.6 : 1} />
    );
  });
  const bra = geo.borders.bra.geometry.coordinates;
  const riverA = P(bra[0][0]), riverB = P(bra[0][Math.min(45, bra[0].length - 1)]);
  const riverRot = Math.atan2(riverB[1] - riverA[1], riverB[0] - riverA[0]) * 180 / Math.PI;
  const riverMid = P(bra[0][22]);
  const head = geoInterpolate(geo.places.paris, geo.places.cayenne)(pArc);
  const [hx, hy] = P(head);
  const paris = P(geo.places.paris), cay = P(geo.places.cayenne);
  const deuAt = P([8.4, 49.4]), espAt = P([-0.9, 42.4]), braAt = P([-51.55, 2.6]);
  const titleOp = interpolate(f, [T.title, T.title + 18, T.wrong - 4, T.wrong + 6], [0, 1, 1, 0], clamp);
  const wrongOp = fade(f, T.wrong, T.wrong + 10, T.move[0] + 6, T.move[0] + 26);
  const headOp = interpolate(f, [T.head, T.head + 16], [0, 1], clamp);
  const braNum = Math.round(KM.bra * pBra);
  const tStyle = {fontFamily: L.title.font, fontWeight: L.title.weight, fontStyle: L.title.italic ? 'italic' : 'normal',
                  fontSize: L.title.size, color: L.text, lineHeight: 1.05, textTransform: L.title.upper ? 'uppercase' : 'none'};

  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 40% 45%, ${L.bg[0]}, ${L.bg[1]})`}}>
      <style>{FONT_CSS}</style>
      {L.stars ? <svg width={W} height={H} style={{position: 'absolute'}}>{STARS.map(([x, y, r, o], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={o * (0.75 + 0.25 * Math.sin(f / 23 + i))} />))}</svg> : null}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs>
          <linearGradient id="focus" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={L.focus[0]} /><stop offset="1" stopColor={L.focus[1]} />
          </linearGradient>
          <radialGradient id="atmo" cx="50%" cy="50%" r="50%">
            <stop offset="0.86" stopColor={L.atmosphere || '#000'} stopOpacity="0" />
            <stop offset="0.93" stopColor={L.atmosphere || '#000'} stopOpacity="0.35" />
            <stop offset="1" stopColor={L.atmosphere || '#000'} stopOpacity="0" />
          </radialGradient>
          <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        {L.atmosphere ? <circle cx={MAPX} cy={MAPY} r={cam.s * 1.16} fill="url(#atmo)" /> : null}
        <path d={sphere} fill={L.sea} stroke={L.atmosphere ? `${L.atmosphere}66` : 'none'} strokeWidth={2} />
        <path d={path(GRAT)} fill="none" stroke={L.grat} strokeWidth={1} strokeDasharray={L.gratDash || 'none'} />
        <path d={path(WORLD)} fill={L.world} stroke={L.worldStroke} strokeWidth={0.8} />
        <g style={{filter: L.shadow || 'none'}}>{detail}</g>
        {geo.borders.deu ? <g opacity={doneFade(pDeu, T.deu[1])}><Draw d={path(geo.borders.deu)} p={pDeu} color={L.deu} width={L.borderW} glow={L.glow} /></g> : null}
        <g opacity={doneFade(pEsp, T.esp[1])}><Draw d={path(geo.borders.esp)} p={pEsp} color={L.esp} width={L.borderW} glow={L.glow} /></g>
        <Draw d={path(geo.borders.bra)} p={pBra} color={L.bra} width={L.borderW * 1.15} glow={L.glow} />
        {/* the flight: Paris -> Cayenne on the great circle */}
        {pArc > 0 && f < T.bra[0] + 20 ? (
          <g opacity={interpolate(f, [T.bra[0], T.bra[0] + 20], [1, 0], clamp)}>
            <Draw d={path(ARC)} p={pArc} color={L.arc} width={2.5} glow={L.glow} />
            {pArc < 1 && isFinite(hx) ? <circle cx={hx} cy={hy} r={7} fill={L.arc} filter={L.glow ? undefined : undefined} /> : null}
          </g>
        ) : null}
        {/* places */}
        <g opacity={euOp * interpolate(f, [T.title + 10, T.title + 25], [0, 1], clamp)}>
          <circle cx={paris[0]} cy={paris[1]} r={6} fill={L.focusStroke} stroke={L.focusLabel} strokeWidth={1.5} />
          <Label L={L} x={paris[0] + 12} y={paris[1] - 10} text="Paris" anchor="start" size={L.lab.size * 0.8} focus />
        </g>
        <g opacity={gfOp}>
          <circle cx={cay[0]} cy={cay[1]} r={6} fill={L.focusStroke} stroke={L.focusLabel} strokeWidth={1.5} />
          <Label L={L} x={cay[0] + 12} y={cay[1] - 10} text="Cayenne" anchor="start" size={L.lab.size * 0.8} focus />
        </g>
        {/* Europe labels */}
        <g opacity={euOp}>
          <Label L={L} {...xy(P([2.5, 46.9]))} text="France" focus size={L.lab.size * 1.25} />
          <Label L={L} {...xy(P([10.4, 51.2]))} text="Germany" />
          <Label L={L} {...xy(P([-3.7, 40.1]))} text="Spain" />
          <Label L={L} {...xy(P([12.6, 43.2]))} text="Italy" op={0.6} />
          <Num L={L} x={deuAt[0] + 18} y={deuAt[1]} text="418 km" color={L.deu} size={46} op={f >= T.deu[1] - 6 ? 1 : 0}
               pop={popAt(T.deu[1] - 6)} />
          <Num L={L} x={espAt[0]} y={espAt[1] + 70} text="646 km" color={L.esp} size={46} anchor="middle" op={f >= T.esp[1] - 6 ? 1 : 0}
               pop={popAt(T.esp[1] - 6)} />
        </g>
        <g opacity={fade(f, T.move[0] + 50, T.move[0] + 70, T.move[1] - 60, T.move[1] - 30)}>
          <Label L={L} {...xy(P([-32, 28]))} text="Atlantic Ocean" size={L.lab.size * 1.1} />
        </g>
        {/* Guiana labels */}
        <g opacity={gfOp}>
          <Label L={L} {...xy(P([-53.25, 4.15]))} text="French Guiana" focus size={L.lab.size * 1.1} />
          <Label L={L} {...xy(P([-55.9, 4.3]))} text="Suriname" />
          <Label L={L} {...xy(P([-52.0, 1.35]))} text="Brazil" size={L.lab.size * 1.2} />
          <Label L={L} x={riverMid[0] + 28} y={riverMid[1]} rot={riverRot} text="Oyapock River" anchor="middle" size={L.lab.size * 0.8}
                 color={L.bra} op={interpolate(f, [T.oyapock, T.oyapock + 15], [0, 1], clamp)} />
          <Num L={L} x={braAt[0] + 40} y={braAt[1] + 40} text={`~${braNum} km`} color={L.bra} size={92}
               op={interpolate(f, [T.bra[0] + 6, T.bra[0] + 16], [0, 1], clamp)} pop={f > T.bra[1] ? popAt(T.bra[1]) : 1} />
        </g>
      </svg>
      {/* type */}
      <div style={{position: 'absolute', left: 0, width: MAPX * 2, top: 70, textAlign: 'center', ...tStyle, opacity: titleOp,
                   transform: `translateY(${(1 - titleOp) * 16}px)`}}>
        {L.title.upper ? "France's longest border?" : <>What is France&rsquo;s<br />longest border?</>}
      </div>
      <div style={{position: 'absolute', left: 0, width: MAPX * 2, top: 90, textAlign: 'center', ...tStyle, opacity: wrongOp}}>Both wrong.</div>
      <div style={{position: 'absolute', left: 90, top: 70, opacity: headOp, transform: `translateY(${(1 - headOp) * 16}px)`}}>
        <div style={{...tStyle, fontSize: L.title.size * 0.5, color: L.sub}}>France&rsquo;s longest border is with</div>
        <div style={{...tStyle, fontSize: L.title.size * 1.15, color: L.tape ? '#111' : L.bra, background: L.tape ? L.bra : 'none',
                     display: 'inline-block', padding: L.tape ? '0 18px' : 0}}>Brazil</div>
      </div>
      <div style={{position: 'absolute', left: 1360, top: 330, width: 470, fontFamily: L.panel.font, fontSize: L.tape ? 34 : 20,
                   letterSpacing: L.tape ? 3 : 6, color: L.sub, textTransform: "uppercase", borderBottom: `1px solid ${L.panel.line}`, paddingBottom: 12,
                   opacity: interpolate(f, [T.bars - 10, T.bars + 6], [0, 1], clamp)}}>{L.barTitle || "Border length"}</div>
      <Bar L={L} f={f} start={T.final} label="Brazil" km={KM.bra} color={L.bra} y={385} />
      <Bar L={L} f={f} start={T.bars} label="Spain" km={KM.esp} color={L.barOther || L.esp} y={f >= T.final ? 490 : 385} />
      <Bar L={L} f={f} start={T.bars + 14} label="Germany" km={KM.deu} color={L.barOther || L.deu} y={f >= T.final ? 595 : 490} />
      {L.grain ? <Img src={staticFile('grain.png')} style={{position: 'absolute', width: W, height: H, objectFit: 'cover',
                                                              opacity: L.grain, mixBlendMode: 'overlay'}} /> : null}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 45% 50%, transparent 55%, rgba(0,0,0,${L.vignette}) 100%)`}} />
      <div style={{position: 'absolute', right: 28, bottom: 20, fontFamily: L.panel.font, fontSize: 15, color: L.credit}}>
        {geo.credit}
      </div>
    </AbsoluteFill>
  );
};

function xy([x, y]) {
  return {x, y};
}
