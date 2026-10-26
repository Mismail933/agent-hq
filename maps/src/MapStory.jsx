// The long map stories (Bassel's long version, 2026-10-26): one line of narration = one map beat. Each line sets where the globe
// looks (view [lon, lat, scale]), the date chip, pins that pop on their word, countries to fill, a river or an arc to draw.
// Same look as MapShort (his pick: the globe, white borders, coloured countries). Times come from the voice (props.lines t0/t1, s).
import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile, Sequence, OffthreadVideo} from 'remotion';
import {geoOrthographic, geoPath, geoInterpolate, geoGraticule10, geoDistance, geoArea} from 'd3-geo';
import geo from './geo.json';
import {FONT_CSS} from './fonts';

const W = 1920, H = 1080, MAPX = W * 0.5, MAPY = H * 0.54;
const C = {
  bg: ['#0A1426', '#03060D'], sea: '#0C1D38', grat: 'rgba(120,180,230,0.10)', atmo: '#4FC9F0',
  land: '#25334C', world: '#1F2B41', line: 'rgba(235,244,255,0.55)', france: ['#49C6E6', '#1C93C0'], fill: '#FF9B6A', uk: '#C8505A', es: '#E3B75A', us: '#8E9FBF', fr: '#3FB8DE',
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
  // "CAN:uk" = filled in a rival's colour (Britain red, Spain yellow) instead of the highlight
  const fills = {}, tint = {};
  lines.forEach((l, i) => (l.fill || []).forEach((code) => {
    const [a3, who] = code.split(':');
    const span = i === li ? on(l.t0, 12) : i < li ? 1 : 0;
    if (span > 0 && who) tint[a3] = C[who] || C.fill;
    fills[a3] = Math.max(fills[a3] || 0, span);
  }));
  const detail = geo.detail.features.map((ft) => {
    const a3 = ft.properties.a3;
    const k = fills[a3] || 0;
    const fr = a3 === 'FRA' || (FRANCE.has(a3) && k > 0);   // a French territory turns France's colour once the story reaches it
    const fill = fr ? 'url(#france)' : k > 0 ? (tint[a3] || C.fill) : C.land;
    return <path key={a3} d={path(ft)} fill={fill} fillOpacity={fr ? (a3 === 'FRA' ? 1 : 0.3 + 0.7 * k) : k > 0 ? 0.35 + 0.6 * k : 1}
                 stroke={fr ? '#E8FBFF' : C.line} strokeWidth={fr ? 2 : 1.6} />;
  });
  const world = WORLD.map((ft) => {
    const k = fills[ft.properties.a3] || 0;
    return <path key={ft.properties.a3} d={path(ft)} fill={k > 0 ? (tint[ft.properties.a3] || C.fill) : C.world} fillOpacity={k > 0 ? 0.35 + 0.6 * k : 1} stroke={C.line} strokeWidth={1.1} />;
  });
  // regions [{id, color, ring [[lon, lat]...]}]: a drawn historical area (approximate claims, not a modern border). It stays from its
  // line on; a later line naming the same id recolours it (color 'none' hides it). Rings are turned the way d3 needs (small side filled).
  const regions = {};
  lines.forEach((l, i) => (l.regions || []).forEach((r) => {
    if (i > li) return;
    const was = regions[r.id];
    let ring = r.ring || (was && was.ring);
    if (!ring) return;
    let ft = {type: 'Polygon', coordinates: [[...ring, ring[0]]]};
    if (geoArea(ft) > 2 * Math.PI) ft = {type: 'Polygon', coordinates: [[...ring, ring[0]].reverse()]};
    const k = i === li ? on(l.t0 + 0.2, 16) : 1;
    regions[r.id] = {ring, ft, color: r.color, from: was ? was.color : 'none', k, label: r.label || (was && was.label)};
  }));
  const regionPaths = Object.entries(regions).map(([id, r]) => {
    const col = (c) => (c === 'none' ? null : C[c] || c);
    const a = col(r.from), b = col(r.color);
    const op = (b ? r.k : 1 - r.k) * 0.62;
    const fill = b && a && r.k < 1 ? interpolateColor(a, b, r.k) : b || a;
    if (!fill || op <= 0.01) return null;
    // clipped to the real land, so coasts and lakes are true; a bright outline (Bassel: refined borders and an outline, not a blob)
    return (
      <g key={`g${id}`} clipPath="url(#land)">
        <path d={path(r.ft)} fill={fill} fillOpacity={b && a ? 0.62 : op} />
        <path d={path(r.ft)} fill="none" stroke="#F4FBFF" strokeWidth={5} strokeOpacity={(b ? r.k : 1 - r.k) * 0.95} strokeLinejoin="round" />
      </g>
    );
  });
  // ship [[lon, lat], ...]: a sailing ship crossing from France along these waypoints while the line is spoken (dashed wake behind it)
  const voyage = line.ship ? <Voyage pts={line.ship} proj={proj} path={path}
    p={interpolate(f, [at(line.t0 + 0.2), at(Math.min(line.t1, line.t0 + 4.2))], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)})} f={f} /> : null;
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
          {Object.keys(regions).length ? <clipPath id="land">{[...WORLD, ...geo.detail.features].map((ft, i) => <path key={i} d={path(ft)} />)}</clipPath> : null}
        </defs>
        <circle cx={MAPX} cy={MAPY} r={cam[2] * 1.16} fill="url(#atmo)" />
        <path d={path({type: 'Sphere'})} fill={C.sea} stroke={`${C.atmo}66`} strokeWidth={2} />
        <path d={path(GRAT)} fill="none" stroke={C.grat} strokeWidth={1} />
        {world}
        {detail}
        {regionPaths}
        {voyage}
        {lines.map((l, i) => (l.river && geo.rivers[l.river] && i === li ? (
          <g key={`r${i}`}>
            <Draw d={path(geo.rivers[l.river])} p={interpolate(f, [at(l.t0), at(l.t0) + 50], [0, 1], {...clamp, easing: ease})} color="#7FD7FF" width={4} />
          </g>) : null))}
        {lines.map((l, i) => (l.arc && i <= li ? (
          <Draw key={`a${i}`} d={path({type: 'LineString', coordinates: Array.from({length: 41}, (_, k) => geoInterpolate(l.arc[0], l.arc[1])(k / 40))})}
                p={interpolate(f, [at(l.t0), at(l.t0) + 40], [0, 1], {...clamp, easing: ease})} color={C.accent} width={4} />) : null))}
        {lines.flatMap((l, i) => (l.pins || []).map((p, k) => {
          if (i > li || t < p.at - 0.05) return null;
          if (geoDistance(cam.slice(0, 2), p.ll) > 1.45) return null;
          const [x, y] = P(p.ll);
          const ring = 10 + 26 * (((f - at(p.at)) % 45) / 45);
          return (
            <g key={`p${i}-${k}`}>
              {i === li ? <circle cx={x} cy={y} r={ring} fill="none" stroke={C.accent} strokeWidth={2} opacity={1 - (((f - at(p.at)) % 45) / 45)} /> : null}
              <circle cx={x} cy={y} r={8} fill={C.accent} stroke={C.white} strokeWidth={2} opacity={on(p.at, 6)} />
            </g>
          );
        }))}
      </svg>
      {line.photo ? <Photo line={line} f={f} fps={fps} /> : null}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {(line.pins || []).map((p, k) => {
          if (!p.label || t < p.at - 0.05 || geoDistance(cam.slice(0, 2), p.ll) > 1.45) return null;
          const [x, y] = P(p.ll);
          return <Text key={`n${k}`} x={x + 18 + (p.off ? p.off[0] : 0)} y={y - 16 + (p.off ? p.off[1] : 0)} size={34} anchor="start" op={on(p.at, 8)} pop={pop(p.at)}>{p.label}</Text>;
        })}
        {line.label ? <Text {...xy(P([line.label[1], line.label[2]]))} size={40} color={C.sub} op={on(line.t0 + 0.6, 12)}>{line.label[0]}</Text> : null}
        {(line.regions || []).filter((r) => r.label && r.color !== 'none').map((r) => (
          <Text key={`rl${r.id}`} {...xy(P(r.label[1]))} size={30} color={C.white} op={on(line.t0 + 0.5, 12)}>{r.label[0]}</Text>))}
      </svg>
      {line.legend ? (
        <div style={{position: 'absolute', left: 60, bottom: 60, fontFamily: 'Space Grotesk', fontSize: 28, color: C.white, opacity: on(line.t0 + 0.3, 12),
                     background: 'rgba(3,8,16,0.72)', padding: '14px 20px', borderRadius: 8}}>
          {line.legend.map(([c, txt]) => (
            <div key={txt} style={{display: 'flex', alignItems: 'center', gap: 14, margin: '4px 0'}}>
              <div style={{width: 30, height: 18, background: C[c] || c, opacity: 0.8, border: `2px dashed ${C[c] || c}`}} />{txt}
            </div>))}
          <div style={{fontSize: 16, opacity: 0.6, marginTop: 6}}>Areas approximate</div>
        </div>) : null}
      {dateText ? (
        <div style={{position: 'absolute', right: 60, top: 50, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 84, color: C.white,
                     letterSpacing: 2, opacity: on(line.t0, 8), transform: `scale(${pop(line.t0)})`, transformOrigin: 'right top',
                     textShadow: '0 2px 18px rgba(0,0,0,0.7)'}}>{dateText}</div>
      ) : null}
      <Img src={staticFile('grain.png')} style={{position: 'absolute', width: W, height: H, objectFit: 'cover', opacity: 0.04, mixBlendMode: 'overlay'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
      <div style={{position: 'absolute', right: 28, bottom: 20, fontFamily: 'Space Grotesk', fontSize: 15, color: 'rgba(150,190,215,0.5)'}}>{geo.credit}</div>
      {lines.map((l, i) => (l.event ? <EventClip key={`e${i}`} ev={l.event} t0={l.t0} f={f} fps={fps} /> : null))}
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
  const maxW = 780, maxH = 580;   // smaller prints keep the named place free (Israa, part 1)
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

// event {key, delay, dur}: an animated scene of the event (story kit, rendered beforehand into public/events/<key>.mp4), full screen over
// the map from the line's start + delay, fading in and out (Bassel: a short animation of a key event about every 2 minutes)
function EventClip({ev, t0, f, fps}) {
  const a = Math.round((t0 + (ev.delay || 0)) * fps), n = Math.round((ev.dur || 8) * fps);
  if (f < a - 1 || f > a + n + 1) return null;
  const op = interpolate(f, [a, a + 10, a + n - 12, a + n], [0, 1, 1, 0], clamp);
  return (
    <Sequence from={a} durationInFrames={n}>
      <AbsoluteFill style={{opacity: op}}><OffthreadVideo src={staticFile(`events/${ev.key}.mp4`)} muted /></AbsoluteFill>
    </Sequence>
  );
}

function Voyage({pts, proj, path, p, f}) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const g = geoInterpolate(pts[i], pts[i + 1]);
    for (let k = 0; k < 40; k++) dense.push(g(k / 40));
  }
  dense.push(pts[pts.length - 1]);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + geoDistance(dense[i - 1], dense[i]));
  const want = cum[cum.length - 1] * p;
  let j = 1;
  while (j < dense.length - 1 && cum[j] < want) j++;
  const u = (want - cum[j - 1]) / Math.max(1e-9, cum[j] - cum[j - 1]);
  const here = geoInterpolate(dense[j - 1], dense[j])(Math.min(1, Math.max(0, u)));
  const done = [...dense.slice(0, j), here];
  const a = proj(here), b = proj(dense[Math.min(dense.length - 1, j + 1)]) || a;
  if (!a) return null;
  const dir = b && b[0] < a[0] ? -1 : 1;   // the ship faces the way it sails
  const bob = Math.sin(f / 6) * 2.5;
  return (
    <g>
      <path d={path({type: 'LineString', coordinates: done})} fill="none" stroke="#F2EEE4" strokeWidth={3} strokeDasharray="10 8" opacity={0.85} />
      <g transform={`translate(${a[0]} ${a[1] + bob}) scale(${dir} 1)`} opacity={p > 0 ? 1 : 0}>
        <ellipse cx={0} cy={14} rx={30} ry={6} fill="rgba(0,0,0,0.35)" />
        <path d="M-28 2 L28 2 L20 14 L-22 14 Z" fill="#7A4A2A" stroke="#F2EEE4" strokeWidth={2} />
        <line x1={-4} y1={2} x2={-4} y2={-38} stroke="#F2EEE4" strokeWidth={2.5} />
        <line x1={12} y1={2} x2={12} y2={-28} stroke="#F2EEE4" strokeWidth={2.5} />
        <path d="M-4 -36 Q10 -22 -4 -4 Z" fill="#F2EEE4" />
        <path d="M12 -26 Q24 -16 12 -2 Z" fill="#F2EEE4" />
        <path d="M-4 -38 L-18 -33 L-4 -29 Z" fill="#49C6E6" />
      </g>
    </g>
  );
}

function interpolateColor(a, b, k) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [h(a), h(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}

function xy([x, y]) {
  return {x, y};
}
