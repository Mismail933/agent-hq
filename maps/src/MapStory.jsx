// The long map stories (Bassel's long version, 2026-10-26): one line of narration = one map beat. Each line sets where the globe
// looks (view [lon, lat, scale]), the date chip, pins that pop on their word, countries to fill, a river or an arc to draw.
// Same look as MapShort (his pick: the globe, white borders, coloured countries). Times come from the voice (props.lines t0/t1, s).
import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile} from 'remotion';
import {geoOrthographic, geoPath, geoInterpolate, geoGraticule10, geoDistance} from 'd3-geo';
import geo from './geo.json';
import {FONT_CSS} from './fonts';

const W = 1920, H = 1080, MAPX = W * 0.5, MAPY = H * 0.54;
const C = {
  bg: ['#0A1426', '#03060D'], sea: '#0C1D38', grat: 'rgba(120,180,230,0.10)', atmo: '#4FC9F0',
  land: '#25334C', world: '#1F2B41', line: 'rgba(235,244,255,0.55)', france: ['#49C6E6', '#1C93C0'], fill: '#FF9B6A',
  accent: '#FF6A3D', white: '#F2F7FF', text: '#EAF6FF', sub: '#C4DAE6', halo: 'rgba(3,8,16,0.85)',
};
const FRANCE = new Set(['FRA', 'GUF', 'FRO', 'MAF', 'BLM', 'SPM', 'NCL', 'PYF', 'WLF', 'ATF', 'CLP']);
const DETAIL = new Set(geo.detail.features.map((f) => f.properties.a3));
const WORLD = geo.world.features.filter((f) => !DETAIL.has(f.properties.a3) && f.properties.a3 !== 'FRA');
const GRAT = geoGraticule10();
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const ease = Easing.inOut(Easing.cubic);

const Text = ({x, y, children, size = 30, color = C.text, anchor = 'middle', op = 1, weight = 700, pop = 1}) => {
  if (op <= 0.01 || !isFinite(x)) return null;
  return (
    <text x={x} y={y} textAnchor={anchor} fill={color} opacity={op} stroke={C.halo} strokeWidth={size * 0.22} strokeLinejoin="round"
          style={{fontFamily: 'Space Grotesk', fontWeight: weight, fontSize: size, letterSpacing: 4, paintOrder: 'stroke', textTransform: 'uppercase'}}
          transform={`translate(${x} ${y}) scale(${pop}) translate(${-x} ${-y})`}>{children}</text>
  );
};

const Draw = ({d, p, color, width}) => {
  if (!d || p <= 0) return null;
  const c = {d, fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 - p};
  return <g><path {...c} strokeWidth={width * 3} opacity={0.4} filter="url(#blur)" /><path {...c} strokeWidth={width} /></g>;
};

// the camera at frame f: each line's view, reached by a move that starts just before the line (a far move zooms out on the way)
function camera(f, lines, fps) {
  let cur = lines[0].view;
  for (let i = 1; i < lines.length; i++) {
    const a = Math.round((lines[i].t0 - 0.15) * fps);
    if (f < a) break;
    const prev = cur, next = lines[i].view;
    const dur = Math.max(18, Math.min(48, Math.round((lines[i].t1 - lines[i].t0) * fps * 0.5)));
    const e = interpolate(f, [a, a + dur], [0, 1], {...clamp, easing: ease});
    const far = geoDistance(prev.slice(0, 2), next.slice(0, 2));
    const la = Math.log(prev[2]), lb = Math.log(next[2]);
    const bump = far > 0.5 ? Math.max(0, (la + lb) / 2 - Math.log(360)) : 0;
    const c = geoInterpolate(prev.slice(0, 2), next.slice(0, 2))(e);
    cur = e >= 1 ? next : [c[0], c[1], Math.exp(la + (lb - la) * e - bump * Math.sin(Math.PI * e))];
  }
  return cur;
}

export const MapStory = ({lines = [], seconds = 10}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!lines.length) return null;
  const cam = camera(f, lines, fps);
  const proj = geoOrthographic().rotate([-cam[0], -cam[1]]).scale(cam[2]).translate([MAPX, MAPY]).clipExtent([[-20, -20], [W + 20, H + 20]]).precision(0.35);
  const path = geoPath(proj);
  const P = (ll) => proj(ll) || [NaN, NaN];
  const t = f / fps;
  const li = Math.max(0, lines.findIndex((l, i) => t >= l.t0 - 0.15 && (i === lines.length - 1 || t < lines[i + 1].t0 - 0.15)));
  const line = lines[li];
  const at = (s) => Math.round(s * fps);
  const on = (s, len = 10) => interpolate(f, [at(s), at(s) + len], [0, 1], clamp);
  const pop = (s) => spring({frame: f - at(s), fps, config: {damping: 12, stiffness: 160}, durationInFrames: 20});
  // fills: the countries this line names, fading in on the line
  // a country named by a line fills in on it and stays (the story's history: only mainland France is French from the start)
  const fills = {};
  lines.forEach((l, i) => (l.fill || []).forEach((a3) => {
    const span = i === li ? on(l.t0, 12) : i < li ? 1 : 0;
    fills[a3] = Math.max(fills[a3] || 0, span);
  }));
  const detail = geo.detail.features.map((ft) => {
    const a3 = ft.properties.a3;
    const k = fills[a3] || 0;
    const fr = a3 === 'FRA' || (FRANCE.has(a3) && k > 0);   // a French territory turns France's colour once the story reaches it
    const fill = fr ? 'url(#france)' : k > 0 ? C.fill : C.land;
    return <path key={a3} d={path(ft)} fill={fill} fillOpacity={fr ? (a3 === 'FRA' ? 1 : 0.3 + 0.7 * k) : k > 0 ? 0.35 + 0.6 * k : 1}
                 stroke={fr ? '#E8FBFF' : C.line} strokeWidth={fr ? 2 : 1.6} />;
  });
  const world = WORLD.map((ft) => {
    const k = fills[ft.properties.a3] || 0;
    return <path key={ft.properties.a3} d={path(ft)} fill={k > 0 ? C.fill : C.world} fillOpacity={k > 0 ? 0.35 + 0.6 * k : 1} stroke={C.line} strokeWidth={1.1} />;
  });
  const dateText = line.date;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 45%, ${C.bg[0]}, ${C.bg[1]})`}}>
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
        <circle cx={MAPX} cy={MAPY} r={cam[2] * 1.16} fill="url(#atmo)" />
        <path d={path({type: 'Sphere'})} fill={C.sea} stroke={`${C.atmo}66`} strokeWidth={2} />
        <path d={path(GRAT)} fill="none" stroke={C.grat} strokeWidth={1} />
        {world}
        {detail}
        {lines.map((l, i) => (l.river && geo.rivers[l.river] && i <= li ? (
          <g key={`r${i}`} opacity={i === li ? 1 : 0.5}>
            <Draw d={path(geo.rivers[l.river])} p={interpolate(f, [at(l.t0), at(l.t0) + 50], [0, 1], {...clamp, easing: ease})} color="#7FD7FF" width={4} />
          </g>) : null))}
        {lines.map((l, i) => (l.arc && i <= li ? (
          <Draw key={`a${i}`} d={path({type: 'LineString', coordinates: Array.from({length: 41}, (_, k) => geoInterpolate(l.arc[0], l.arc[1])(k / 40))})}
                p={interpolate(f, [at(l.t0), at(l.t0) + 40], [0, 1], {...clamp, easing: ease})} color={C.accent} width={4} />) : null))}
        {lines.flatMap((l, i) => (l.pins || []).map((p, k) => {
          if (i > li || t < p.at - 0.05) return null;
          if (geoDistance(cam.slice(0, 2), p.ll) > 1.45) return null;
          const [x, y] = P(p.ll);
          const fresh = i === li;   // a pin's name only on its own line (older names cluttered the next beats)
          const ring = 10 + 26 * (((f - at(p.at)) % 45) / 45);
          return (
            <g key={`p${i}-${k}`}>
              {i === li ? <circle cx={x} cy={y} r={ring} fill="none" stroke={C.accent} strokeWidth={2} opacity={1 - (((f - at(p.at)) % 45) / 45)} /> : null}
              <circle cx={x} cy={y} r={8} fill={C.accent} stroke={C.white} strokeWidth={2} opacity={on(p.at, 6)} />
              {p.label && fresh ? <Text x={x + 18} y={y - 16} size={34} anchor="start" op={on(p.at, 8) * (i === li ? 1 : 0.7)} pop={pop(p.at)}>{p.label}</Text> : null}
            </g>
          );
        }))}
        {line.label ? <Text {...xy(P([line.label[1], line.label[2]]))} size={40} color={C.sub} op={on(line.t0 + 0.6, 12)}>{line.label[0]}</Text> : null}
      </svg>
      {line.photo ? <Photo line={line} f={f} fps={fps} /> : null}
      {dateText ? (
        <div style={{position: 'absolute', right: 60, top: 50, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 84, color: C.white,
                     letterSpacing: 2, opacity: on(line.t0, 8), transform: `scale(${pop(line.t0)})`, transformOrigin: 'right top',
                     textShadow: '0 2px 18px rgba(0,0,0,0.7)'}}>{dateText}</div>
      ) : null}
      <Img src={staticFile('grain.png')} style={{position: 'absolute', width: W, height: H, objectFit: 'cover', opacity: 0.04, mixBlendMode: 'overlay'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
      <div style={{position: 'absolute', right: 28, bottom: 20, fontFamily: 'Space Grotesk', fontSize: 15, color: 'rgba(150,190,215,0.5)'}}>{geo.credit}</div>
    </AbsoluteFill>
  );
};

// a real picture of the time (public domain / CC0 / CC BY, credited on its frame): a framed print over the dimmed map, a slow push-in
const Photo = ({line, f, fps}) => {
  const ph = line.photo;
  const a = Math.round((line.t0 + 0.35) * fps), b = Math.round((line.t1 + 0.25) * fps);
  const op = interpolate(f, [a, a + 10, b - 8, b], [0, 1, 1, 0], clamp);
  if (op <= 0.01) return null;
  const [iw, ih] = ph.size || [4, 3];
  const maxW = 900, maxH = 680;
  const k = Math.min(maxW / iw, maxH / ih);
  const w = Math.round(iw * k), h = Math.round(ih * k);
  const left = ph.side === 'left' ? 90 : W - w - 90;
  const top = Math.max(110, (H - h - 70) / 2);
  const zoom = interpolate(f, [a, b], [1.0, 1.07], clamp);
  return (
    <>
      <AbsoluteFill style={{background: 'rgba(2,6,14,0.42)', opacity: op}} />
      <div style={{position: 'absolute', left, top, width: w, opacity: op, transform: `translateY(${(1 - op) * 18}px)`}}>
        <div style={{width: w, height: h, overflow: 'hidden', border: '8px solid #F2EEE4', boxShadow: '0 18px 50px rgba(0,0,0,0.65)', background: '#111'}}>
          <Img src={staticFile(`photos/${ph.key}.jpg`)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}} />
        </div>
        <div style={{background: '#F2EEE4', padding: '8px 14px 10px', fontFamily: 'Space Grotesk', color: '#1B2433'}}>
          <div style={{fontSize: 26, fontWeight: 700}}>{ph.caption}</div>
          <div style={{fontSize: 16, opacity: 0.75, marginTop: 2}}>{ph.credit}</div>
        </div>
      </div>
    </>
  );
};

function xy([x, y]) {
  return {x, y};
}
