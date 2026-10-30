// The long map stories (Bassel's long version, 2026-10-26): one line of narration = one map beat. Each line sets where the globe
// looks (view [lon, lat, scale]), the date chip, pins that pop on their word, countries to fill, a river or an arc to draw.
// Same look as MapShort (his pick: the globe, white borders, coloured countries). Times come from the voice (props.lines t0/t1, s).
import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile, Sequence, OffthreadVideo} from 'remotion';
import {geoOrthographic, geoPath, geoInterpolate, geoGraticule10, geoDistance, geoArea, geoRotation, geoCentroid} from 'd3-geo';
import geo from './geo.json';
import {FONT_CSS} from './fonts';
import {Earth} from './Earth';

const W = 1920, H = 1080, MAPX = W * 0.5, MAPY = H * 0.54;
const C = {
  bg: ['#0A1426', '#03060D'], sea: '#0C1D38', grat: 'rgba(120,180,230,0.10)', atmo: '#4FC9F0',
  land: '#25334C', world: '#1F2B41', line: 'rgba(235,244,255,0.55)', france: ['#49C6E6', '#1C93C0'], fill: '#3FB8DE', uk: '#C8505A', es: '#E3B75A', us: '#8E9FBF', fr: '#3FB8DE', free: '#7FC47A',   /* Bassel: French blue, British red, Spanish yellow everywhere; free = independent */
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
// A line with `follow` {from, mid} and a ship rides with it (Bassel, 10-27: "zoom on France, go with the ship with a bit of zooming out",
// then land close on the destination): the camera cuts in close on the port (zoom `from`), pulls back to `mid` while the ship is at sea,
// following it with a little lag, and comes down on the line's view at the end of the voyage.
function camera(f, lines, fps) {
  let cur = lines[0].view;
  for (let i = 0; i < lines.length; i++) {   // from line 0: its own mid-line views count too (part 4's opening never moved)
    const l = lines[i];
    const a = Math.round((l.t0 - 0.15) * fps);
    if (i > 0 && f < a) break;
    const dur = l.follow ? 30 : l.move_s ? Math.round(l.move_s * fps) : Math.max(40, Math.min(90, Math.round((l.t1 - l.t0) * fps * 0.6)));
    if (i > 0) {
      const prev = cur, next = l.follow && l.ship ? followView(l, 0) : l.spin ? [l.spin.from, l.spin.lat, l.spin.scale] : l.view;
      cur = move(prev, next, interpolate(f, [a, a + dur], [0, 1], {...clamp, easing: ease}));
    }
    if (l.follow && l.ship) {
      const [s0] = sailFrames(l, fps);
      if (f >= s0) cur = followView(l, sailP(l, f, fps));
    }
    // spin {from, to, lat, scale}: the globe turns at an even speed through the line (Bassel: the overseas places' names appear as it turns)
    // spin.wait s: first a zoom out from the line's own view (e.g. close on French Guiana) to the whole globe, then the turn (Bassel)
    const sa = l.spin && l.spin.wait ? a + Math.round(l.spin.wait * fps) : a + Math.max(24, dur);   // the turn starts once the move there is done (Bassel: it cut)
    if (l.spin && l.spin.wait && f < sa) cur = move(l.view, [l.spin.from, l.spin.lat, l.spin.scale], interpolate(f, [Math.max(0, a), sa], [0, 1], {...clamp, easing: ease}));
    if (l.spin && f >= sa) {
      const end = Math.round((l.t1 + (l.spin.extra != null ? l.spin.extra : 0.4)) * fps);   // extra: the turn runs on into the line's silence
      cur = [interpolate(f, [sa, end], [l.spin.from, l.spin.to], l.spin.even ? clamp : {...clamp, easing: Easing.inOut(Easing.sin)}), l.spin.lat, l.spin.scale];
    }
    // views [{at, view}]: the camera moves on mid-line (e.g. from Pondicherry to Saint-Louis on 'the island of Saint Louis')
    let base = l.view;
    for (const v of l.views || []) {
      const va = Math.round(v.at * fps);
      if (f < va) break;
      cur = move(base, v.view, interpolate(f, [va, va + 75], [0, 1], {...clamp, easing: ease}));
      base = v.view;
    }
  }
  return cur;
}
function move(prev, next, e) {
  const far = geoDistance(prev.slice(0, 2), next.slice(0, 2));
  const la = Math.log(prev[2]), lb = Math.log(next[2]);
  // a long flight pulls back a little, to half the wider view at most; from or to a whole globe it never pulls back (the owner: no zooming in and out)
  const low = Math.min(prev[2], next[2]);
  const bump = far > 0.5 && low > 800 ? Math.max(0, (la + lb) / 2 - Math.log(Math.max(560, low * 0.5))) : 0;
  const c = geoInterpolate(prev.slice(0, 2), next.slice(0, 2))(e);
  return e >= 1 ? next : [c[0], c[1], Math.exp(la + (lb - la) * e - bump * Math.sin(Math.PI * e))];
}
// a pin on a follow line shows once the ship is there (Israa: 'Fort Maurepas' appeared in Ohio while the ship was mid-Atlantic)
const pinAt = (l, p, fps) => (l.follow && l.ship ? Math.max(p.at, sailFrames(l, fps)[1] / fps - 0.3) : p.at);
// the voyage of a ship line: frames it sails between (a follow line takes most of its line, up to 11 s), and how far along it is
function sailFrames(l, fps) {
  if (!l.follow) return [Math.round((l.t0 + 0.2) * fps), Math.round(Math.min(l.t1, l.t0 + 4.2) * fps)];
  // follow.to_end: the voyage takes the whole line, the ships arrive as the next line starts (Bassel: on 'In 1635')
  const s0 = l.t0 + 0.9, s1 = l.follow.to_end ? l.t1 + 0.1 : Math.max(s0 + 2.4, Math.min(l.t1 - 0.6, l.t0 + 11.6));
  return [Math.round(s0 * fps), Math.round(s1 * fps)];
}
function sailP(l, f, fps) {
  const [s0, s1] = sailFrames(l, fps);
  return interpolate(f, [s0, s1], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
}
// a course along great-circle legs between the waypoints, walked at even speed
const COURSES = {};
function courseOf(pts) {
  const key = JSON.stringify(pts);
  if (COURSES[key]) return COURSES[key];
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const g = geoInterpolate(pts[i], pts[i + 1]);
    for (let k = 0; k < 40; k++) dense.push(g(k / 40));
  }
  dense.push(pts[pts.length - 1]);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + geoDistance(dense[i - 1], dense[i]));
  const at = (p) => {
    const want = cum[cum.length - 1] * Math.max(0, Math.min(1, p));
    let j = 1;
    while (j < dense.length - 1 && cum[j] < want) j++;
    const u = (want - cum[j - 1]) / Math.max(1e-9, cum[j] - cum[j - 1]);
    return {here: geoInterpolate(dense[j - 1], dense[j])(Math.min(1, Math.max(0, u))), j};
  };
  return (COURSES[key] = {dense, at});
}
function followView(l, p) {
  const {at} = courseOf(l.ship);
  const fol = l.follow, end = l.view;
  let lo = 0, la = 0, w = 0;   // the camera trails the ship a little
  for (let k = 0; k < 5; k++) { const q = at(p - k * 0.012).here, wk = 1 / (1 + k); lo += q[0] * wk; la += q[1] * wk; w += wk; }
  let c = [lo / w, la / w];
  const lz = (x, y, e) => Math.exp(Math.log(x) + (Math.log(y) - Math.log(x)) * e);
  let z = p < 0.3 ? lz(fol.from, fol.mid, ease(p / 0.3)) : fol.mid;
  if (p > 0.72) {
    const e = ease((p - 0.72) / 0.28);
    c = geoInterpolate(c, end.slice(0, 2))(e);
    z = lz(fol.mid, end[2], e);
  }
  return [c[0], c[1], z];
}

const FLAG = {
  bourbon: <g><rect width={56} height={36} fill="#F7F5EE" stroke="#8A8270" strokeWidth={1} />{[[12, 10], [30, 10], [46, 10], [20, 24], [38, 24]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="#C9A227" />)}</g>,
  union: <g><rect width={56} height={36} fill="#1F3A7A" /><path d="M 0 0 L 56 36 M 56 0 L 0 36" stroke="#F2F2F2" strokeWidth={7} /><path d="M 28 0 L 28 36 M 0 18 L 56 18" stroke="#F2F2F2" strokeWidth={11} /><path d="M 28 0 L 28 36 M 0 18 L 56 18" stroke="#C8102E" strokeWidth={6} /></g>,
  burgundy: <g><rect width={56} height={36} fill="#F7F5EE" stroke="#8A8270" strokeWidth={1} /><path d="M 8 4 L 48 32 M 48 4 L 8 32" stroke="#B3282C" strokeWidth={5} strokeLinecap="round" /></g>,
  tricolore: <g><rect width={19} height={36} fill="#1F3A9A" /><rect x={19} width={18} height={36} fill="#F4F2EC" /><rect x={37} width={19} height={36} fill="#D22B33" /></g>,
  us15: <g>{[...Array(15)].map((_, i) => <rect key={i} y={i * 2.4} width={56} height={2.4} fill={i % 2 ? '#F4F2EC' : '#B22234'} />)}<rect width={24} height={19.2} fill="#2B3A78" /></g>,
};
// a flag on a short pole, scale s (0 hides it)
const PoleFlag = ({x, y, s, f, name}) => (s <= 0.01 || !FLAG[name] ? null :
  <g transform={`translate(${x} ${y}) scale(${1.5 * s})`}>
    <rect x={-1.5} y={-62} width={3} height={62} fill="#E8E4DA" /><ellipse cx={0} cy={0} rx={10} ry={3} fill="rgba(0,0,0,0.45)" />
    <g transform={`translate(1.5 -62) skewY(${Math.sin(f / 7) * 3})`}>{FLAG[name]}</g>
  </g>);

export const MapStory = ({lines = [], seconds = 10, earth = false}) => {
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
    if (code.startsWith('-')) {   // '-DZA': no longer highlighted from this line on (independent; it fades out)
      const a3 = code.slice(1);
      if (i < li) fills[a3] = 0;
      else if (i === li) fills[a3] = Math.min(fills[a3] || 0, 1 - on(l.t0 + 0.3, 20));
      return;
    }
    const [a3, who] = code.split(':');
    const span = i === li ? on(l.t0, 12) : i < li ? 1 : 0;
    if (span > 0 && who) tint[a3] = C[who] || C.fill;
    if (span > 0 && !who) delete tint[a3];
    fills[a3] = Math.max(fills[a3] || 0, span);
  }));
  const wipes = [];   // tints with `from`: the new colour spreads through the country from that point
  lines.forEach((l, i) => (l.tints || []).forEach((x) => {
    if (i > li || t < x.at) return;
    const [a3, who] = x.code.split(':'), from = tint[a3] || C.fill, to = who === '-' ? C.fr : who === 'none' ? from : C[who] || C.fill;
    if (x.from && who !== '-' && who !== 'none') {
      const kw = interpolate(f, [at(x.at), at(x.at + (x.dur || 3))], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
      if (kw < 1) { wipes.push({a3, color: to, from: x.from, k: kw, old: fills[a3] > 0 ? (tint[a3] || null) : null}); return; }
      tint[a3] = to; fills[a3] = Math.max(fills[a3] || 0, 1); return;
    }
    const k = on(x.at, 18);
    if (who === '-' && k >= 1) { delete tint[a3]; return; }   // ':-' = back to France's own colour
    if (who === 'none') { fills[a3] = Math.min(fills[a3] || 0, 1 - k); if (k >= 1) delete tint[a3]; return; }   // ':none' = fades out (e.g. Britain's empire after the comparison)
    tint[a3] = k >= 1 ? to : interpolateColor(from.startsWith('#') ? from : C.fill, to, k);
    fills[a3] = Math.max(fills[a3] || 0, 1);
  }));
  const detail = geo.detail.features.map((ft) => {
    const a3 = ft.properties.a3;
    const k = fills[a3] || 0;
    const fr = a3 === 'FRA' || (FRANCE.has(a3) && k > 0 && !tint[a3]);   // a tint (e.g. ':uk') wins over France's colour   // a French territory turns France's colour once the story reaches it
    const fill = fr ? 'url(#france)' : k > 0 ? (tint[a3] || C.fill) : C.land;
    const op = fr ? (a3 === 'FRA' ? 1 : 0.3 + 0.7 * k) : k > 0 ? 0.35 + 0.6 * k : 1;
    return <path key={a3} d={path(ft)} fill={fill} fillOpacity={earth ? (k > 0 || a3 === 'FRA' ? Math.min(0.94, op) : 0.08) : op}
                 stroke={fr ? '#E8FBFF' : C.line} strokeWidth={fr ? 2 : 1.6} />;
  });
  const world = WORLD.map((ft) => {
    const k = fills[ft.properties.a3] || 0;
    return <path key={ft.properties.a3} d={path(ft)} fill={k > 0 ? (tint[ft.properties.a3] || C.fill) : C.world} fillOpacity={k > 0 ? 0.35 + 0.6 * k : earth ? 0.08 : 1} stroke={C.line} strokeWidth={1.1} />;
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
    const k = i === li ? on(l.t0 + (r.delay != null ? r.delay : 0.2), Math.round((r.slow || 0.55) * fps)) : 1;
    regions[r.id] = {ring, ft, color: r.color, from: was ? was.color : 'none', k, label: r.label || (was && was.label), wipe: i === li ? r.wipe : null, flags: i === li ? r.flags : null, flagAt: r.flagAt};
  }));
  const regionPaths = Object.entries(regions).map(([id, r]) => {
    const col = (c) => (c === 'none' ? null : C[c] || c);
    const a = col(r.from), b = col(r.color);
    const op = a && b ? 0.62 : (b ? r.k : 1 - r.k) * 0.62;   // a recolour keeps the old colour on screen until it starts (region delay)
    const fill = b && a && r.k < 1 ? interpolateColor(a, b, r.k) : b || a;
    if (!fill || op <= 0.01) return null;
    // clipped to the real land, so coasts and lakes are true; a bright outline (Bassel: refined borders and an outline, not a blob)
    if (r.wipe && a && b && r.k < 1) {   // Bassel: the new colour spreads from where it starts while the old one is pushed back
      const [wx, wy] = P(r.wipe), [[bx0, by0], [bx1, by1]] = path.bounds(r.ft), far = Math.max(...[[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]].map(([x, y]) => Math.hypot(x - wx, y - wy)));
      const R = Math.max(1, Easing.inOut(Easing.quad)(r.k) * far * 1.15);   // grows across the region itself, from its start to its far corner
      return (
        <g key={`g${id}`} clipPath="url(#land)">
          <defs><radialGradient id={`wg${id}`} cx={wx} cy={wy} r={R} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#FFF" /><stop offset="0.86" stopColor="#FFF" /><stop offset="1" stopColor="#FFF" stopOpacity="0" /></radialGradient>
            <mask id={`wm${id}`} maskUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H}><rect x={-W} y={-H} width={3 * W} height={3 * H} fill={`url(#wg${id})`} /></mask></defs>
          <path d={path(r.ft)} fill={a} fillOpacity={0.62} />
          <path d={path(r.ft)} fill={b} fillOpacity={0.7} mask={`url(#wm${id})`} />
          <path d={path(r.ft)} fill="none" stroke="#F4FBFF" strokeWidth={5} strokeOpacity={0.95} strokeLinejoin="round" />
        </g>
      );
    }
    return (
      <g key={`g${id}`} clipPath="url(#land)">
        <path d={path(r.ft)} fill={fill} fillOpacity={b && a ? 0.8 : op * 1.25} />
        <path d={path(r.ft)} fill="none" stroke="#F4FBFF" strokeWidth={5} strokeOpacity={(b ? r.k : 1 - r.k) * 0.95} strokeLinejoin="round" />
      </g>
    );
  });
  const regionFlags = Object.entries(regions).filter(([, r]) => r.flags).map(([id, r]) => {
    const [ox, oy] = P(r.flagAt || r.label?.[1] || r.wipe), [nx, ny] = P(r.wipe || r.flagAt);
    const k = r.k, out = 1 - Math.min(1, k * 1.6), inn = Math.min(1, Math.max(0, (k - 0.15) / 0.5));
    return <g key={`fl${id}`}><PoleFlag x={ox} y={oy} s={out * (1 - 0.2 * k)} f={f} name={r.flags[0]} /><PoleFlag x={nx} y={ny} s={inn < 1 ? spring({frame: Math.round(inn * 20), fps, config: {damping: 10}}) : 1} f={f + 9} name={r.flags[1]} /></g>;
  });
  // ghost {a3, to [lon, lat], label}: a country's own outline carried across the globe by a rotation (its size stays true)
  let ghost = null;
  if (line.ghost) {
    const src = geo.detail.features.find((ft) => ft.properties.a3 === line.ghost.a3) || WORLD.find((ft) => ft.properties.a3 === line.ghost.a3);
    if (src) {
      const c0 = geoCentroid(src), to = line.ghost.to, rA = geoRotation([-c0[0], -c0[1]]), rB = geoRotation([-to[0], -to[1]]);
      const move = (pt) => rB.invert(rA(pt));
      const mv = (cs) => (typeof cs[0] === 'number' ? move(cs) : cs.map(mv));
      const moved = {type: 'Feature', geometry: {type: src.geometry.type, coordinates: mv(src.geometry.coordinates)}};
      const k = on((line.ghost.at != null ? line.ghost.at : line.t0 + 0.6), 18);
      const [lx, ly] = P(to);
      ghost = <g opacity={k}><path d={path(moved)} fill="url(#france)" fillOpacity={0.85} stroke="#E8FBFF" strokeWidth={3} />
        {line.ghost.label ? <Text x={lx} y={ly + 8} size={30} color={C.white} op={k}>{line.ghost.label}</Text> : null}</g>;
    }
  }
  // ship [[lon, lat], ...]: a sailing ship crossing from France along these waypoints while the line is spoken (dashed wake behind it)
  const voyage = line.ship ? <Voyage pts={line.ship} proj={proj} path={path} p={sailP(line, f, fps)} f={f} big={!!line.follow} flag={line.shipflag} /> : null;
  // dates [[seconds, text]]: the chip changes on its words (1642 -> 1665 -> Today)
  let dateText = line.date, dateAt = line.t0;
  (line.dates || []).forEach(([s, txt]) => { if (t >= s) { dateText = txt; dateAt = s; } });
  const nextT0 = li + 1 < lines.length ? lines[li + 1].t0 : line.t1 + 0.4;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 45%, ${C.bg[0]}, ${C.bg[1]})`}}>
      <style>{FONT_CSS}</style>
      <div style={earth ? tiltOf(cam[2]) : {position: 'absolute', left: 0, top: 0, width: W, height: H}}>
      {earth ? <Earth cam={cam} cx={MAPX} cy={MAPY} W={W} H={H} /> : null}
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
        <path d={path({type: 'Sphere'})} fill={C.sea} fillOpacity={earth ? 0.3 : 1} stroke={`${C.atmo}66`} strokeWidth={2} />
        <path d={path(GRAT)} fill="none" stroke={C.grat} strokeWidth={1} />
        {world}
        {detail}
        {wipes.map((w, i) => {
          const ft = geo.detail.features.find((q) => q.properties.a3 === w.a3) || WORLD.find((q) => q.properties.a3 === w.a3);
          if (!ft) return null;
          const [wx, wy] = P(w.from), [[bx0, by0], [bx1, by1]] = path.bounds(ft);
          const far = Math.max(...[[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]].map(([x, y]) => Math.hypot(x - wx, y - wy)));
          const R = Math.max(1, w.k * far * 1.1);
          return (
            <g key={`wp${i}`}>
              <defs><radialGradient id={`wpg${i}`} cx={wx} cy={wy} r={R} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#FFF" /><stop offset="0.88" stopColor="#FFF" /><stop offset="1" stopColor="#FFF" stopOpacity="0" /></radialGradient>
                <mask id={`wpm${i}`} maskUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H}><rect x={-W} y={-H} width={3 * W} height={3 * H} fill={`url(#wpg${i})`} /></mask></defs>
              <path d={path(ft)} fill={w.color} fillOpacity={0.95} mask={`url(#wpm${i})`} />
              <circle cx={wx} cy={wy} r={R} fill="none" stroke="#F4FBFF" strokeWidth={2.5} strokeOpacity={0.5 * (1 - w.k)} />
            </g>
          );
        })}
        {regionPaths}
        {ghost}
        {regionFlags}
        {voyage}
        {lines.map((l, i) => (l.river && geo.rivers[l.river] && i === li ? (
          <g key={`r${i}`}>
            <Draw d={path(geo.rivers[l.river])} p={interpolate(f, [l.follow && l.ship ? sailFrames(l, fps)[1] : at(l.t0), (l.follow && l.ship ? sailFrames(l, fps)[1] : at(l.t0)) + 50], [0, 1], {...clamp, easing: ease})} color="#7FD7FF" width={4} />
          </g>) : null))}
        {lines.map((l, i) => (l.arc && i <= li ? (
          <Draw key={`a${i}`} d={path({type: 'LineString', coordinates: Array.from({length: 41}, (_, k) => geoInterpolate(l.arc[0], l.arc[1])(k / 40))})}
                p={interpolate(f, [at(l.t0), at(l.t0) + 40], [0, 1], {...clamp, easing: ease})} color={C.accent} width={4} />) : null))}
        {lines.flatMap((l, i) => (l.pins || []).map((p, k) => {
          if (i > li || t < pinAt(l, p, fps) - 0.05) return null;
          if (lines.some((m, j) => j > i && j <= li && m.lost && t >= m.t0 && (m.lost === '*' || m.lost.includes(p.label)))) return null;
          if (geoDistance(cam.slice(0, 2), p.ll) > 1.45) return null;
          const [x, y] = P(p.ll);
          const pa = pinAt(l, p, fps), ring = 10 + 26 * (((f - at(pa)) % 45) / 45);
          return (
            <g key={`p${i}-${k}`}>
              {i === li ? <circle cx={x} cy={y} r={ring} fill="none" stroke={C.accent} strokeWidth={2} opacity={1 - (((f - at(pa)) % 45) / 45)} /> : null}
              <circle cx={x} cy={y} r={earth ? 12 : 8} fill={C.accent} stroke={C.white} strokeWidth={3} opacity={on(pa, 6)} />
            </g>
          );
        }))}
        {lines.flatMap((l, i) => (i <= li ? (l.march || []).map((m, k) => <March key={`mr${i}-${k}`} m={m} path={path} P={P} f={f} fps={fps} live={i === li} />) : []))}
        {(line.fx || []).map((x, i) => <Battle key={`fx${i}`} x={x} P={P} f={f} fps={fps} />)}
        {line.shake ? <Shake s={line.shake} P={P} f={f} fps={fps} /> : null}
        {lines.flatMap((l, i) => (i === li && earth && cam[2] >= 1500 ? (l.flags || []).map((x, k) => {
          const [fx, fy] = P(x.ll);
          return isFinite(fx) && t >= x.at ? <PoleFlag key={`fg${i}-${k}`} x={fx} y={fy} s={spring({frame: f - at(x.at), fps, config: {damping: 11, stiffness: 150}, durationInFrames: 18})} f={f + k * 7} name={x.name} /> : null;
        }) : []))}
      </svg>
      {line.photo ? <Photo ph={line.photo} a={line.photo.at != null ? line.photo.at : line.t0 + 0.35}
                           b={line.photo.until != null ? line.photo.until : line.photo2 ? line.photo2.at - 0.1 : nextT0 - 0.15} f={f} fps={fps} /> : null}
      {line.photo2 ? <Photo ph={line.photo2} a={line.photo2.at} b={nextT0 - 0.15} f={f} fps={fps} /> : null}
      {(line.duo || []).map((ph, i) => <Photo key={`d${i}`} ph={ph} a={ph.at} b={nextT0 - 0.15} f={f} fps={fps} />)}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {(line.pins || []).map((p, k) => {
          const pa = pinAt(line, p, fps);
          if (!p.label || t < pa - 0.05 || (p.until != null && t >= p.until) || geoDistance(cam.slice(0, 2), p.ll) > 1.45) return null;
          const [x, y] = P(p.ll);
          const sz = earth ? (cam[2] < 1000 ? 36 : 54) : 34, wide = String(p.label).length * sz * 0.68, flip = x + 22 + (p.off ? p.off[0] : 0) + wide > W - 40;
          return <Text key={`n${k}`} x={flip ? x - 22 : x + 22 + (p.off ? p.off[0] : 0)} y={y - 18 + (p.off ? p.off[1] : 0)} size={sz} weight={800} anchor={flip ? 'end' : 'start'} op={on(pa, 8)} pop={pop(pa)}>{p.label}</Text>;
        })}
        {(line.labels || []).map((lb, k) => (t >= lb.at - 0.05 && geoDistance(cam.slice(0, 2), lb.ll) < 1.45
          ? <Text key={`lb${k}`} {...xy(P(lb.ll))} size={earth ? 50 : 34} color={earth ? C.white : C.sub} op={on(lb.at, 12)}>{lb.text}</Text> : null))}
        {line.label ? <Text {...xy(P([line.label[1], line.label[2]]))} size={earth ? 62 : 40} weight={800} color={earth ? C.white : C.sub} op={on(line.t0 + 0.6, 12)}>{line.label[0]}</Text> : null}
        {(line.regions || []).filter((r) => r.label && r.color !== 'none').map((r) => (
          <Text key={`rl${r.id}`} {...xy(P(r.label[1]))} size={earth ? 48 : 30} weight={800} color={C.white} op={li > 0 && (lines[li - 1].regions || []).some((q) => q.id === r.id && q.label) ? 1 : on(line.t0 + 0.5, 12)}>{r.label[0]}</Text>))}
      </svg>
      </div>
      {line.mention && t >= line.mention.at ? <Mention m={line.mention} f={f} fps={fps} /> : null}
      {line.legend ? (
        <div style={{position: 'absolute', left: 60, bottom: 60, fontFamily: 'Space Grotesk', fontSize: 36, color: C.white, opacity: on(line.t0 + 0.3, 12),
                     background: 'rgba(3,8,16,0.72)', padding: '14px 20px', borderRadius: 8}}>
          {line.legend.map(([c, txt]) => (
            <div key={txt} style={{display: 'flex', alignItems: 'center', gap: 14, margin: '4px 0'}}>
              <div style={{width: 30, height: 18, background: C[c] || c, opacity: 0.8, border: `2px dashed ${C[c] || c}`}} />{txt}
            </div>))}
          <div style={{fontSize: 16, opacity: 0.6, marginTop: 6}}>Areas approximate</div>
        </div>) : null}
      {dateText ? (
        <div style={{position: 'absolute', right: 60, top: 50, fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 84, color: C.white,
                     letterSpacing: 2, opacity: on(line.t0, 8), transform: `scale(${pop(dateAt)})`, transformOrigin: 'right top',
                     background: 'rgba(3,8,16,0.55)', padding: '0 22px', borderRadius: 10,   /* a backing: it sat on the globe's edge (Israa) */
                     textShadow: '0 2px 18px rgba(0,0,0,0.7)'}}>{dateText}</div>
      ) : null}
      <Img src={staticFile('grain.png')} style={{position: 'absolute', width: W, height: H, objectFit: 'cover', opacity: 0.04, mixBlendMode: 'overlay'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
      <div style={{position: 'absolute', right: 28, bottom: 20, fontFamily: 'Space Grotesk', fontSize: 15, color: 'rgba(150,190,215,0.5)'}}>{geo.credit}{earth ? ' · Imagery: NASA Blue Marble (public domain)' : ''}</div>
      {lines.map((l, i) => (l.event ? <EventClip key={`e${i}`} ev={l.event} t0={l.t0} f={f} fps={fps} xy={l.event.ll ? P(l.event.ll) : null} lit={earth} /> : null))}
      {lines.flatMap((l, i) => (l.plates || []).map((v, k) => <Plate key={`pl${i}-${k}`} v={v} f={f} fps={fps} xy={v.ll ? P(v.ll) : null} />))}
      {lines.map((l, i) => (l.card ? <SectionCard key={`c${i}`} c={l.card} f={f} fps={fps} /> : null))}
      {lines.map((l, i) => (l.footage ? <Footage key={`v${i}`} v={l.footage} f={f} fps={fps} xy={l.footage.ll ? P(l.footage.ll) : null} /> : null))}
    </AbsoluteFill>
  );
};

const tiltOf = (s) => {
  const k = Math.max(0, Math.min(1, (s - 1300) / 2400));
  return {position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '50% 62%',
          transform: `perspective(2400px) rotateX(${(7 * k).toFixed(2)}deg) scale(${(1 + 0.08 * k).toFixed(3)})`};
};

// plate {key, at, dur, size, cap, credit, from [z, x, y], to [z, x, y], fit, plain}: a period picture on the whole screen, moving slowly. It opens
// out of its place on the map (plain: fades, for one picture after another); fit: an upright portrait stands on a blurred copy of itself
function Plate({v, f, fps, xy}) {
  const a = Math.round(v.at * fps), n = Math.round((v.dur || 4) * fps);
  if (f < a - 1 || f > a + n + 1) return null;
  const e = interpolate(f, [a, a + n], [0, 1], clamp);
  const [z0, x0, y0] = v.from || [1.04, 50, 50], [z1, x1, y1] = v.to || [1.14, 50, 50];
  const z = z0 + (z1 - z0) * e, px = x0 + (x1 - x0) * e, py = y0 + (y1 - y0) * e;
  const src = staticFile(`photos/${v.key}.jpg`);
  const tag = interpolate(f, [a + 12, a + 22, a + n - 14, a + n - 6], [0, 1, 1, 0], clamp);
  const fade = v.plain ? interpolate(f, [a, a + 24, a + n - 24, a + n], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.sin)}) : 1;
  const body = (
    <AbsoluteFill style={{background: '#050608', overflow: 'hidden'}}>
      {v.fit ? <>
        <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, #26303F 0%, #0A0E15 75%)'}} />
        <Img src={src} style={{position: 'absolute', height: H * 0.88 * z / 1.1, left: `${px}%`, top: `${py - 3}%`, transform: 'translate(-50%, -50%)', border: '6px solid #E9E2D0', boxShadow: '0 24px 80px rgba(0,0,0,0.85)'}} />
      </> : <Img src={src} style={{position: 'absolute', width: W, height: H, objectFit: 'cover', objectPosition: `${px}% ${py}%`, transform: `scale(${z})`, transformOrigin: `${px}% ${py}%`}} />}
      <AbsoluteFill style={{background: 'linear-gradient(0deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 26%)'}} />
      {v.cap ? <div style={{position: 'absolute', left: 64, bottom: 44, opacity: tag, transform: `translateY(${(1 - tag) * 10}px)`, fontFamily: 'Space Grotesk', color: C.white, fontSize: 40, fontWeight: 700, textShadow: '0 2px 14px rgba(0,0,0,0.9)', maxWidth: 1500}}>{v.cap}</div> : null}
      {v.credit ? <div style={{position: 'absolute', right: 30, bottom: 18, opacity: tag * 0.8, fontFamily: 'Space Grotesk', fontSize: 16, color: '#E6EEF5', textShadow: '0 1px 6px rgba(0,0,0,0.9)'}}>{v.credit}</div> : null}
    </AbsoluteFill>
  );
  return v.plain ? <AbsoluteFill style={{opacity: fade}}>{body}</AbsoluteFill> : <Iris a={a} n={n} xy={xy} f={f}>{body}</Iris>;
}

// card {at, year, title}: where we are in the story: a band across the picture, a little over 2 s
function SectionCard({c, f, fps}) {
  const a = Math.round(c.at * fps), n = Math.round((c.dur || 2.4) * fps);
  if (f < a || f > a + n) return null;
  const k = interpolate(f, [a, a + 9, a + n - 9, a + n], [0, 1, 1, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: H * 0.34, height: H * 0.32, background: `rgba(4,8,16,${0.82 * k})`, display: 'flex', flexDirection: 'column',
                 alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk', color: C.white, opacity: k, clipPath: `inset(0 ${(1 - k) * 50}% 0 ${(1 - k) * 50}%)`}}>
      <div style={{fontSize: 118, fontWeight: 700, letterSpacing: 6, lineHeight: 1}}>{c.year}</div>
      <div style={{width: 120, height: 5, background: '#FFD37A', margin: '16px 0 14px'}} />
      <div style={{fontSize: 52, fontWeight: 700, letterSpacing: 10, textTransform: 'uppercase', color: '#FFD37A'}}>{c.title}</div>
    </div>
  );
}

// mention {at, flag, text, dur}: a country only named: its flag and name in the corner, the camera stays where the story is
function Mention({m, f, fps}) {
  const a = Math.round(m.at * fps), n = Math.round((m.dur || 3.5) * fps);
  if (f > a + n) return null;
  const k = spring({frame: f - a, fps, config: {damping: 12, stiffness: 160}, durationInFrames: 18}) * interpolate(f, [a + n - 8, a + n], [1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 60, top: 56, opacity: k, transform: `translateX(${(k - 1) * 40}px)`, display: 'flex', alignItems: 'center', gap: 20, background: 'rgba(3,8,16,0.72)', padding: '14px 26px', borderRadius: 10}}>
      <svg width={112} height={72} viewBox="0 0 56 36">{FLAG[m.flag]}</svg>
      <div style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 46, letterSpacing: 4, color: C.white, textTransform: 'uppercase'}}>{m.text}</div>
    </div>
  );
}

// a real picture of the time (public domain / CC0 / CC BY, credited on its frame): a framed print over the dimmed map, a slow push-in;
// up from `a` to `b` seconds (by default from just after the line starts until the next line: Israa, a print gone before its line ended)
const Photo = ({ph, a: as, b: bs, f, fps}) => {
  const a = Math.round(as * fps), b = Math.max(a + 30, Math.round(bs * fps));
  const op = interpolate(f, [a, a + 20, b - 20, b], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  if (op <= 0.01) return null;
  const [iw, ih] = ph.size || [4, 3];
  const maxW = 780, maxH = 580;   // smaller prints keep the named place free (Israa, part 1)
  const k = Math.min(maxW / iw, maxH / ih);
  const w = Math.round(iw * k), h = Math.round(ih * k);
  const left = ph.x != null ? ph.x : ph.side === 'left' ? 90 : W - w - 90;
  const top = Math.max(110, (H - h - 70) / 2);
  const zoom = interpolate(f, [a, b], [1.0, 1.07], clamp);
  return (
    <>
      <AbsoluteFill style={{background: 'rgba(2,6,14,0.14)', opacity: op}} />
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

// the map opens onto a picture and closes back onto it (the owner 2026-10-29, "zoom transitions from the map into scenes and back, no hard
// cuts"): a circle grows from the place on the map (or the middle) to the whole screen while the picture inside settles from a close
// push, a thin light ring on its edge; at the end it shrinks back onto that place
function Iris({a, n, f, children}) {
  const op = interpolate(f, [a, a + 24, a + n - 24, a + n], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
  if (op <= 0) return null;
  const sc = interpolate(f, [a, a + n], [1.03, 1.0], clamp);
  return <AbsoluteFill style={{opacity: op}}><AbsoluteFill style={{transform: `scale(${sc})`}}>{children}</AbsoluteFill></AbsoluteFill>;
}

// event {key, delay, dur}: an animated scene of the event (rendered beforehand into public/events/<key>.mp4), full screen over the map
// from the line's start + delay (Bassel: a short animation of a key event about every 2 minutes). `lit`: the scene is graded like a
// lit set (a warm key light from the upper left, a cool fill, a vignette) so the flat pieces read as lit miniatures
function EventClip({ev, t0, f, fps, xy, lit}) {
  const a = Math.round((t0 + (ev.delay || 0)) * fps), n = Math.round((ev.dur || 8) * fps);
  if (f < a - 1 || f > a + n + 1) return null;
  return (
    <Sequence from={a} durationInFrames={n}>
      <Iris a={a} n={n} xy={xy} f={f}>
        <OffthreadVideo src={staticFile(`events/${ev.key}.mp4`)} muted style={lit ? {filter: 'contrast(1.06) saturate(1.1) brightness(1.06)'} : null} />
        {lit ? <>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 22% 12%, rgba(255,222,170,0.42), rgba(255,214,150,0) 60%)', mixBlendMode: 'screen', opacity: 0.35}} />
          <AbsoluteFill style={{background: 'linear-gradient(200deg, rgba(40,70,120,0) 55%, rgba(20,40,90,0.16) 100%)', mixBlendMode: 'multiply'}} />
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 46%, transparent 60%, rgba(0,0,0,0.32) 100%)'}} />
        </> : null}
      </Iris>
    </Sequence>
  );
}

// footage {key, at, dur, from, caption, credit, ll}: real footage of the place today (public domain / CC BY, credited on screen), opened
// from its place on the map and closed back onto it, a 'REAL FOOTAGE' tag with what it shows
function Footage({v, f, fps, xy}) {
  const a = Math.round(v.at * fps), n = Math.round((v.dur || 5) * fps);
  if (f < a - 1 || f > a + n + 1) return null;
  const tag = interpolate(f, [a + 14, a + 26, a + n - 18, a + n - 8], [0, 1, 1, 0], clamp);
  const push = (v.zoom || 1) * interpolate(f, [a, a + n], [1.0, 1.07], clamp);   // zoom: a letterboxed clip filled (Reunion's is 2.35:1)
  return (
    <Sequence from={a} durationInFrames={n}>
      <Iris a={a} n={n} xy={xy} f={f}>
        <AbsoluteFill style={{transform: `scale(${push})`, background: '#000'}}>
          <OffthreadVideo src={staticFile(`footage/${v.key}.mp4`)} startFrom={Math.round((v.from || 0) * fps)} muted
                          style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'contrast(1.04) saturate(0.95) brightness(0.92)'}} />
        </AbsoluteFill>
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.45) 100%)'}} />
        <div style={{position: 'absolute', left: 70, top: 64, opacity: tag, transform: `translateY(${(1 - tag) * 10}px)`, fontFamily: 'Space Grotesk', color: C.white}}>
          {v.ai ? null : <><div style={{fontSize: 22, letterSpacing: 6, fontWeight: 700, color: '#FFD37A'}}>REAL FOOTAGE</div>
          <div style={{width: 64, height: 3, background: '#FFD37A', margin: '10px 0 12px'}} /></>}
          <div style={{fontSize: 40, fontWeight: 700, textShadow: '0 2px 16px rgba(0,0,0,0.8)', maxWidth: 1100}}>{v.caption}</div>
        </div>
        <div style={{position: 'absolute', right: 34, bottom: 26, opacity: tag * 0.8, fontFamily: 'Space Grotesk', fontSize: 17, color: '#E6EEF5',
                     textShadow: '0 1px 6px rgba(0,0,0,0.9)'}}>{v.credit}</div>
      </Iris>
    </Sequence>
  );
}

function Voyage({pts, proj, path, p, f, big = false, flag = null}) {
  const {dense, at} = courseOf(pts);
  const {here, j} = at(p);
  const done = [...dense.slice(0, j), here];
  const a = proj(here), b = proj(dense[Math.min(dense.length - 1, j + 1)]) || a;
  if (!a) return null;
  const dir = b && b[0] < a[0] ? -1 : 1;   // the ship faces the way it sails
  const bob = Math.sin(f / 6) * 2.5;
  return (
    <g>
      <path d={path({type: 'LineString', coordinates: done})} fill="none" stroke="#F2EEE4" strokeWidth={3} strokeDasharray="10 8" opacity={0.85} />
      <g transform={`translate(${a[0]} ${a[1] + bob}) scale(${dir * (big ? 1.35 : 1)} ${big ? 1.35 : 1})`} opacity={p > 0 ? 1 : 0}>
        <ellipse cx={0} cy={14} rx={30} ry={6} fill="rgba(0,0,0,0.35)" />
        <path d="M-28 2 L28 2 L20 14 L-22 14 Z" fill="#7A4A2A" stroke="#F2EEE4" strokeWidth={2} />
        <line x1={-4} y1={2} x2={-4} y2={-38} stroke="#F2EEE4" strokeWidth={2.5} />
        <line x1={12} y1={2} x2={12} y2={-28} stroke="#F2EEE4" strokeWidth={2.5} />
        <path d="M-4 -36 Q10 -22 -4 -4 Z" fill="#F2EEE4" />
        <path d="M12 -26 Q24 -16 12 -2 Z" fill="#F2EEE4" />
        {flag && FLAG[flag] ? <g transform={`translate(-4 -54) scale(${0.42 * dir} 0.42)`}>{FLAG[flag]}</g> : <path d="M-4 -38 L-18 -33 L-4 -29 Z" fill="#49C6E6" />}
      </g>
    </g>
  );
}

// fx {kind 'battle', at, dur, pts}: small battles over the map while the narrator goes on (Bassel): bursts flare and fade at each
// point in turn, crossed swords over the first point
function Battle({x, P, f, fps}) {
  const a = Math.round(x.at * fps), b = a + Math.round((x.dur || 3) * fps);
  if (f < a - 2 || f > b + 20) return null;
  const fade = interpolate(f, [a, a + 8, b, b + 20], [0, 1, 1, 0], clamp);
  const [sx, sy] = P(x.pts[0]);
  return (
    <g opacity={fade}>
      {x.pts.flatMap((ll, j) => [0, 1, 2].map((r) => {
        const start = a + Math.round(((j * 7 + r * 13) % 23) * 1.3) + r * 22;   // staggered, a new flare every ~0.7 s per point
        const k = (f - start) / 18;
        if (k < 0 || k > 1 || start > b) return null;
        const [cx, cy] = P(ll), R = 10 + 34 * k;
        return (
          <g key={`b${j}-${r}`} opacity={1 - k}>
            <circle cx={cx} cy={cy} r={R} fill="#FFB35A" fillOpacity={0.35} stroke="#FFE2A8" strokeWidth={3} />
            {[...Array(8)].map((_, q) => {
              const ang = (q / 8) * Math.PI * 2 + j;
              return <line key={q} x1={cx + Math.cos(ang) * R * 0.5} y1={cy + Math.sin(ang) * R * 0.5} x2={cx + Math.cos(ang) * R * 1.15} y2={cy + Math.sin(ang) * R * 1.15}
                           stroke="#FFF3D6" strokeWidth={3} strokeLinecap="round" />;
            })}
          </g>
        );
      }))}
      <image href={staticFile('icons/crossed-swords.svg')} x={sx - 34} y={sy - 96} width={68} height={68}
             transform={`rotate(${Math.sin(f / 5) * 6} ${sx} ${sy - 62})`} />
    </g>
  );
}

// march {at, dur, pts [[lon, lat], ...]}: an army moves across the map (Bassel: 'show armies moving across the map to capture these
// lands'): a blue arrow grows along the route, a column of small pieces with the French flag at its head, a clash at each stop it
// reaches; afterwards the route stays as a faint trail
function March({m, path, P, f, fps, live}) {
  const a = Math.round(m.at * fps), n = Math.round((m.dur || 4) * fps);
  if (f < a) return null;
  const dense = [];
  for (let i = 0; i < m.pts.length - 1; i++) for (let k = 0; k < 20; k++) dense.push(geoInterpolate(m.pts[i], m.pts[i + 1])(k / 20));
  dense.push(m.pts[m.pts.length - 1]);
  const u = interpolate(f, [a, a + n], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  const j = Math.max(1, Math.round(u * (dense.length - 1)));
  const done = dense.slice(0, j + 1);
  const head = P(done[done.length - 1]), prev = P(done[Math.max(0, done.length - 3)]);
  const ang = Math.atan2(head[1] - prev[1], head[0] - prev[0]);
  const marching = live && u < 1;
  const trail = live ? 1 : 0.35;
  const stops = m.pts.slice(1).map((ll, i) => ({ll, at: a + Math.round(((i + 1) / (m.pts.length - 1)) * n)}));
  return (
    <g>
      <path d={path({type: 'LineString', coordinates: done})} fill="none" stroke="#0B1A33" strokeOpacity={0.55 * trail} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path({type: 'LineString', coordinates: done})} fill="none" stroke="#3FB8DE" strokeOpacity={trail} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="18 10" strokeDashoffset={-f * 1.6} />
      {marching && <g transform={`translate(${head[0]} ${head[1]}) rotate(${(ang * 180) / Math.PI})`}>
        <path d="M 14 0 L -8 -12 L -3 0 L -8 12 Z" fill="#3FB8DE" stroke="#F4FBFF" strokeWidth={2} />
      </g>}
      {marching && [0, 1, 2, 3, 4].map((q) => {
        const p2 = P(dense[Math.max(0, j - 2 - q * 2)]), bob = Math.abs(Math.sin((f + q * 5) / 4)) * 4;
        return <g key={q} transform={`translate(${p2[0]} ${p2[1] - bob})`}><circle r={7} fill="#2B3E7A" stroke="#F4FBFF" strokeWidth={1.6} /><rect x={-3} y={-15} width={6} height={7} fill="#B0302C" /></g>;
      })}
      {marching && <g transform={`translate(${head[0] - 4} ${head[1] - 60})`}><rect x={0} y={0} width={3} height={50} fill="#E8E4DA" />
        <g transform={`skewY(${Math.sin(f / 6) * 5})`}><rect x={3} y={0} width={13} height={22} fill="#1F3A9A" /><rect x={16} y={0} width={13} height={22} fill="#F4F2EC" /><rect x={29} y={0} width={13} height={22} fill="#D22B33" /></g></g>}
      {live && stops.map((s, i) => {
        const k = (f - s.at) / 22;
        if (k < 0 || k > 1) return null;
        const [cx, cy] = P(s.ll), R = 12 + 46 * k;
        return <g key={i} opacity={1 - k}><circle cx={cx} cy={cy} r={R} fill="#FFB35A" fillOpacity={0.35} stroke="#FFE2A8" strokeWidth={3} />
          {[...Array(8)].map((_, q) => { const g2 = (q / 8) * Math.PI * 2; return <line key={q} x1={cx + Math.cos(g2) * R * 0.5} y1={cy + Math.sin(g2) * R * 0.5} x2={cx + Math.cos(g2) * R * 1.15} y2={cy + Math.sin(g2) * R * 1.15} stroke="#FFF3D6" strokeWidth={3} strokeLinecap="round" />; })}</g>;
      })}
    </g>
  );
}

// shake {ll, flags [a, b], at}: two hands shaking over the area with each country's flag (Bassel: the secret deal with Spain)
function Shake({s, P, f, fps}) {
  const a = Math.round(s.at * fps);
  if (f < a) return null;
  const k = spring({frame: f - a, fps, config: {damping: 11, stiffness: 140}, durationInFrames: 22});
  const [x, y] = P(s.ll), bob = Math.sin((f - a) / 4) * 4 * Math.max(0, 1 - (f - a) / 40);
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r={74} fill="rgba(3,8,16,0.55)" />
      <image href={staticFile('icons/handshake.svg')} x={-56} y={-56 + bob} width={112} height={112} />
      <PoleFlag x={-96} y={34} s={1} f={f} name={s.flags[0]} />
      <PoleFlag x={96} y={34} s={1} f={f + 9} name={s.flags[1]} />
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
