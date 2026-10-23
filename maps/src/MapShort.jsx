// Bassel's short (2026-10-23): the globe look (his pick: sample 2) with white borders between countries and the story's countries
// filled with colour (as in sample 5), timed to the narrator's words (props.cues, seconds, from the voice's word timings).
// His order: the question; Germany (border + country + length); Spain (same); "neither": France also borders Belgium, Luxembourg,
// Switzerland, Italy, Monaco, Andorra; then outside Europe: Suriname, then Brazil, the longest.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile} from 'remotion';
import {geoOrthographic, geoPath, geoInterpolate, geoGraticule10} from 'd3-geo';
import geo from './geo.json';
import {FONT_CSS} from './fonts';

export const FPS = 30, W = 1920, H = 1080;
const MAPX = W * 0.42, MAPY = H * 0.58;
const EU = [5.2, 46.3], GF = [-54.2, 3.7];
const Z = {eu: 3000, mid: 300, gf: 5600};
const C = {
  bg: ['#0A1426', '#03060D'], sea: '#0C1D38', grat: 'rgba(120,180,230,0.10)', atmo: '#4FC9F0',
  land: '#25334C', world: '#1F2B41', line: 'rgba(235,244,255,0.55)', lineW: 1.7,
  france: ['#49C6E6', '#1C93C0'],
  fill: {DEU: '#9A9AD8', ESP: '#D8B465', BRA: '#9CC27A', SUR: '#CDB78E', BEL: '#7FB3A8', LUX: '#7FB3A8', CHE: '#7FB3A8', ITA: '#7FB3A8',
         MCO: '#7FB3A8', AND: '#7FB3A8'},
  accent: '#FF6A3D', white: '#F2F7FF', text: '#EAF6FF', sub: '#C4DAE6', halo: 'rgba(3,8,16,0.85)',
};
const NAMES = {DEU: ['Germany', [10.4, 51.2]], ESP: ['Spain', [-3.7, 40.1]], BEL: ['Belgium', [4.6, 50.6]], LUX: ['Luxembourg', [6.1, 49.75]],
               CHE: ['Switzerland', [8.2, 46.8]], ITA: ['Italy', [12.6, 43.0]], MCO: ['Monaco', [7.42, 43.74]], AND: ['Andorra', [1.52, 42.55]]};
const TINY = new Set(['LUX', 'MCO', 'AND']);   // a dot and a pointer line, the country is too small to label inside
const DETAIL = new Set(geo.detail.features.map((f) => f.properties.a3));
const WORLD = {type: 'FeatureCollection', features: geo.world.features.filter((f) => !DETAIL.has(f.properties.a3) && f.properties.a3 !== 'FRA')};
const GRAT = geoGraticule10();
const ARC = (() => {
  const f = geoInterpolate(geo.places.paris, geo.places.cayenne);
  return {type: 'LineString', coordinates: Array.from({length: 97}, (_, i) => f(i / 96))};
})();
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const ease = Easing.inOut(Easing.cubic);

const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};

const Draw = ({d, p, color, width, glow}) => {
  if (!d || p <= 0) return null;
  const common = {d, fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: 1, strokeDasharray: '1 1',
                  strokeDashoffset: 1 - p};
  return <g>{glow ? <path {...common} strokeWidth={width * 3} opacity={0.45} filter="url(#blur)" /> : null}<path {...common} strokeWidth={width} /></g>;
};

const Text = ({x, y, children, size = 34, color = C.text, anchor = 'middle', op = 1, weight = 700, spacing = 4, pop = 1}) => {
  if (op <= 0.01 || !isFinite(x)) return null;
  return (
    <text x={x} y={y} textAnchor={anchor} fill={color} opacity={op} stroke={C.halo} strokeWidth={size * 0.22} strokeLinejoin="round"
          style={{fontFamily: 'Space Grotesk', fontWeight: weight, fontSize: size, letterSpacing: spacing, paintOrder: 'stroke', textTransform: 'uppercase'}}
          transform={`translate(${x} ${y}) scale(${pop}) translate(${-x} ${-y})`}>{children}</text>
  );
};

export const MapShort = ({cues = {}, seconds = 35}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const at = (k, d = 0) => Math.round(((cues[k] ?? 0) + d) * fps);
  const prog = (a, b, e = ease) => interpolate(f, [a, b], [0, 1], {...clamp, easing: e});
  const pop = (a) => spring({frame: f - a, fps, config: {damping: 12, stiffness: 160}, durationInFrames: 20});
  const on = (a, len = 10) => interpolate(f, [a, a + len], [0, 1], clamp);

  // camera: Europe (slow push) -> zoom out to the globe, turn, zoom in -> French Guiana
  const m0 = at('move'), m1 = at('arrive');
  let c, s;
  if (f <= m0) { c = EU; s = interpolate(f, [0, m0], [Z.eu * 0.95, Z.eu * 1.05], clamp); }
  else if (f >= m1) { c = GF; s = interpolate(f, [m1, m1 + 300], [Z.gf, Z.gf * 1.06], clamp); }
  else {
    const e = prog(m0, m1), er = prog(m0 + 30, m1 - 10);
    const a = Math.log(Z.eu * 1.05), b = Math.log(Z.gf), bump = (a + b) / 2 - Math.log(Z.mid);
    c = geoInterpolate(EU, GF)(er); s = Math.exp(a + (b - a) * e - bump * Math.sin(Math.PI * e));
  }
  const proj = geoOrthographic().rotate([-c[0], -c[1]]).scale(s).translate([MAPX, MAPY]).clipExtent([[-20, -20], [W + 20, H + 20]]).precision(0.35);
  const path = geoPath(proj);
  const P = (ll) => proj(ll) || [NaN, NaN];

  // when each country is named (it fills over ~0.4 s)
  const named = {DEU: at('deu'), ESP: at('esp'), BEL: at('bel'), LUX: at('lux'), CHE: at('che'), ITA: at('ita'), MCO: at('mco'), AND: at('and'),
                 SUR: at('sur'), BRA: at('bra')};
  const detail = geo.detail.features.map((ft) => {
    const a3 = ft.properties.a3;
    const focus = a3 === 'FRA' || a3 === 'GUF';
    const t = named[a3] != null ? on(named[a3], 12) : 0;
    const fill = focus ? 'url(#france)' : C.fill[a3] ? mix(C.land, C.fill[a3], t * 0.92) : C.land;
    return <path key={a3} d={path(ft)} fill={fill} stroke={focus ? '#E8FBFF' : C.line} strokeWidth={focus ? 2 : C.lineW} />;
  });
  const pDeu = prog(named.DEU, named.DEU + 30), pEsp = prog(named.ESP, named.ESP + 30), pSur = prog(named.SUR, named.SUR + 24);
  const pBra = prog(named.BRA, at('km730', 1.2), Easing.inOut(Easing.quad));
  const euOp = interpolate(f, [m0, m0 + 20], [1, 0], clamp);
  const gfOp = interpolate(f, [m1 - 20, m1 + 10], [0, 1], clamp);
  const pArc = prog(m0 + 10, m1 - 5);
  const [hx, hy] = P(geoInterpolate(geo.places.paris, geo.places.cayenne)(pArc));
  const q = on(at('q'), 14) * interpolate(f, [at('neither') - 10, at('neither')], [1, 0], clamp);
  const neither = on(at('neither'), 8) * interpolate(f, [m0 - 6, m0 + 10], [1, 0], clamp);
  const head = on(at('final'), 14);
  const braNum = Math.round(730 * prog(at('km730'), at('km730', 1.2)));
  const deuAt = P([8.5, 49.3]), espAt = P([-1.2, 42.5]), braAt = P([-51.7, 2.5]);
  const bra = geo.borders.bra.geometry.coordinates[0];
  const riv = P(bra[Math.round(bra.length * 0.18)]);
  const title = {position: 'absolute', left: 70, top: 60, fontFamily: 'Space Grotesk', fontWeight: 700, color: C.text,
                 textShadow: '0 2px 14px rgba(0,0,0,0.6)', lineHeight: 1.05};
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 40% 45%, ${C.bg[0]}, ${C.bg[1]})`}}>
      <style>{FONT_CSS}</style>
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs>
          <linearGradient id="france" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={C.france[0]} /><stop offset="1" stopColor={C.france[1]} /></linearGradient>
          <radialGradient id="atmo" cx="50%" cy="50%" r="50%">
            <stop offset="0.86" stopColor={C.atmo} stopOpacity="0" /><stop offset="0.93" stopColor={C.atmo} stopOpacity="0.35" />
            <stop offset="1" stopColor={C.atmo} stopOpacity="0" />
          </radialGradient>
          <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        <circle cx={MAPX} cy={MAPY} r={s * 1.16} fill="url(#atmo)" />
        <path d={path({type: 'Sphere'})} fill={C.sea} stroke={`${C.atmo}66`} strokeWidth={2} />
        <path d={path(GRAT)} fill="none" stroke={C.grat} strokeWidth={1} />
        <path d={path(WORLD)} fill={C.world} stroke={C.line} strokeWidth={1.1} />
        {detail}
        <Draw d={path(geo.borders.deu)} p={pDeu} color={C.white} width={5} glow />
        <Draw d={path(geo.borders.esp)} p={pEsp} color={C.white} width={5} glow />
        <Draw d={path(geo.borders.sur)} p={pSur} color={C.white} width={5} glow />
        <Draw d={path(geo.borders.bra)} p={pBra} color={C.accent} width={6} glow />
        {pArc > 0 && f < m1 + 40 ? (
          <g opacity={interpolate(f, [m1, m1 + 30], [1, 0], clamp)}>
            <Draw d={path(ARC)} p={pArc} color="#FF9B6A" width={3} glow />
            {pArc < 1 && isFinite(hx) ? <circle cx={hx} cy={hy} r={7} fill="#FF9B6A" /> : null}
          </g>
        ) : null}
        {/* Europe */}
        <g opacity={euOp}>
          <Text {...xy(P([2.4, 46.9]))} size={38} color="#FFFFFF" weight={800}>France</Text>
          {Object.entries(NAMES).map(([a3, [name, ll]]) => {
            const t = named[a3];
            const op = t != null ? on(t, 8) : 0;
            const [x, y] = P(ll);
            if (TINY.has(a3)) {
              const dx = a3 === 'MCO' ? 80 : -90, dy = a3 === 'LUX' ? -150 : 60;   // Luxembourg's label above Belgium's, clear of Germany's
              return (
                <g key={a3} opacity={op}>
                  <circle cx={x} cy={y} r={6} fill={C.fill[a3]} stroke={C.white} strokeWidth={2} />
                  <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke={C.white} strokeWidth={2} />
                  <Text x={x + dx} y={y + dy + (dy > 0 ? 34 : -10)} size={28} anchor={dx > 0 ? 'start' : 'end'} pop={pop(t)}>{name}</Text>
                </g>
              );
            }
            return <Text key={a3} x={x} y={y} size={a3 === 'DEU' || a3 === 'ESP' ? 38 : 30} op={op} pop={pop(t)}>{name}</Text>;
          })}
          <Text x={deuAt[0] + 22} y={deuAt[1] + 8} size={50} anchor="start" color={C.white} op={on(at('km418'), 6)} pop={pop(at('km418'))} spacing={1}>418 km</Text>
          <Text x={espAt[0]} y={espAt[1] + 78} size={50} color={C.white} op={on(at('km646'), 6)} pop={pop(at('km646'))} spacing={1}>646 km</Text>
        </g>
        <g opacity={interpolate(f, [m0 + 40, m0 + 60, m1 - 50, m1 - 25], [0, 1, 1, 0], clamp)}>
          <Text {...xy(P([-32, 28]))} size={34} color={C.sub}>Atlantic Ocean</Text>
        </g>
        {/* South America */}
        <g opacity={gfOp}>
          <Text {...xy(P([-53.15, 3.75]))} size={32} color="#FFFFFF" weight={800}>French Guiana</Text>
          <Text {...xy(P([-55.9, 4.2]))} size={34} op={named.SUR != null ? on(named.SUR, 8) : 1}>Suriname</Text>
          <Text {...xy(P([-52.2, 1.2]))} size={42} op={on(named.BRA, 8)}>Brazil</Text>
          <g opacity={on(at('km730', -0.6), 12)}>
            <line x1={riv[0] + 8} y1={riv[1] + 4} x2={riv[0] + 60} y2={riv[1] + 70} stroke={C.accent} strokeWidth={2.5} />
            <Text x={riv[0] + 66} y={riv[1] + 102} size={28} anchor="start" color={C.accent} weight={800}>Oyapock River</Text>
          </g>
          <Text x={braAt[0] + 40} y={braAt[1] + 130} size={96} anchor="start" color={C.accent} op={on(at('km730'), 8)} spacing={0}
                pop={f > at('km730', 1.2) ? pop(at('km730', 1.2)) : 1}>{`~${braNum} km`}</Text>
        </g>
      </svg>
      <div style={{...title, fontSize: 74, opacity: q, transform: `translateY(${(1 - q) * 14}px)`}}>Which country has the<br />longest border with France?</div>
      <div style={{...title, fontSize: 96, opacity: neither, color: C.accent}}>Neither!</div>
      <div style={{...title, opacity: head, transform: `translateY(${(1 - head) * 14}px)`}}>
        <div style={{fontSize: 40, color: C.sub}}>France&rsquo;s longest border is with</div>
        <div style={{fontSize: 110, color: C.accent}}>Brazil</div>
      </div>
      <Img src={staticFile('grain.png')} style={{position: 'absolute', width: W, height: H, objectFit: 'cover', opacity: 0.04, mixBlendMode: 'overlay'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 45% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
      <div style={{position: 'absolute', right: 28, bottom: 20, fontFamily: 'Space Grotesk', fontSize: 15, color: 'rgba(150,190,215,0.5)'}}>{geo.credit}</div>
    </AbsoluteFill>
  );
};

function xy([x, y]) {
  return {x, y};
}
