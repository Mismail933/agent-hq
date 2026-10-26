// Storygraphics #4 (2.72.0): "He Survived Hiroshima. 3 Days Later He Was in Nagasaki." Tsutomu Yamaguchi, 1945-2010.
// The people, the two cities, the flash, the map of Japan, the office, the title (YamArt, also the thumbnail). Every scene takes
// {f, len, line}; line.p holds the script's choices. Kept respectful on purpose: no bodies and no wounds drawn, nobody under a
// mushroom cloud, the river crossing abstract; the bombs are shown as light, rings on a map and numbers.
import React from 'react';
import {noise2D} from '@remotion/noise';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Torso, Head, Figure, Box, Cloud, at, Labels} from './tis';
import {P, Txt, Cam, popAt, popBy} from './meg2';
import {LAND, K} from './mapdata';

const PAPER = '#F8F6EE';   // bandages
const R2 = (seed) => rng(seed);

// ───────────── people ─────────────
// bandages over the head (the forehead and his left cheek: our right) and both forearms (Torso's 'rest' arms)
const BandHead = ({turn = 0}) => (
  <g>
    <path d="M -130 -104 C -60 -126 60 -126 130 -104 L 128 -64 C 60 -86 -60 -86 -128 -64 Z" fill={PAPER} {...st(5)} />
    <path d="M -100 -96 L -80 -72 M -40 -110 L -24 -80 M 30 -110 L 44 -80 M 90 -100 L 104 -74" stroke="#D9D2C1" strokeWidth={4} />
    <g transform={`translate(${turn * 34} 0)`}>
      <rect x={44} y={6} width={78} height={70} rx={10} fill={PAPER} {...st(5)} transform="rotate(-8 83 41)" />
      <path d="M 56 24 L 110 60 M 110 22 L 58 60" stroke="#D9D2C1" strokeWidth={4} />
    </g>
  </g>
);
const BandArms = () => (
  <g>
    {[1, -1].map((sx) => (
      <g key={sx} transform={`scale(${sx} 1)`}>
        <path d="M 232 452 C 236 510 232 566 222 600 L 162 596 C 172 548 172 500 164 446 Z" fill={PAPER} {...st(5)} />
        {[470, 505, 540, 575].map((y) => <path key={y} d={`M 166 ${y} L 232 ${y + 12}`} stroke="#D9D2C1" strokeWidth={4} />)}
      </g>))}
  </g>
);
// a person from the waist up, like tis.Bust, plus a 3/4 turn and the bandages
export const YBust = ({who = 'yamaguchi', x = 0, y = 0, s = 1, expr = 'calm', f = 0, talk = false, arms = 'rest', turn = 0, look = 0, seed = 1, band = false, rot = 0}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <Torso who={who} arms={arms} f={f} />
    {band && arms === 'rest' && <BandArms />}
    <Head who={who} expr={expr} f={f} talk={talk} look={look} seed={seed} turn={turn} />
    {band && <BandHead turn={turn} />}
  </g>
);
// a baby wrapped in a blanket, face only
export const Baby = ({s = 1, f = 0}) => (
  <g transform={`scale(${s})`}>
    <ellipse cx={0} cy={30} rx={120} ry={90} fill="#F1E3C6" {...ST} />
    <path d="M -110 10 C -60 60 60 60 110 10" fill="none" stroke="#D9C49C" strokeWidth={8} />
    <circle cx={0} cy={-10} r={62} fill="#F2C29B" {...ST} />
    <path d="M -58 -30 C -30 -90 40 -96 62 -26 C 40 -60 -20 -66 -58 -30 Z" fill="#1A1410" />
    <path d="M -30 -6 Q -20 0 -10 -6 M 10 -6 Q 20 0 30 -6" fill="none" {...st(4)} />
    <path d="M -8 22 Q 0 28 8 22" fill="none" {...st(4)} />
    <ellipse cx={-34} cy={12} rx={12} ry={7} fill="#E8846A" opacity={0.5} /><ellipse cx={34} cy={12} rx={12} ry={7} fill="#E8846A" opacity={0.5} />
  </g>
);

// ───────────── things ─────────────
// the B-29, seen from below, nose to the right: about 1000 long, 1320 across the wings at s 1
export const B29 = ({f = 0, tone = 'silver'}) => {
  const [a, b, c] = tone === 'dark' ? ['#3A4250', '#2C333E', '#566070'] : ['#B9C2CB', '#9AA5B0', '#D3DAE1'];
  return (
    <g>
      <path d="M 70 -46 L 26 -660 L -58 -660 L -118 -46 L -118 46 L -58 660 L 26 660 L 70 46 Z" fill={a} {...ST} />
      <path d="M -40 -600 L 10 -600 M -40 600 L 10 600" stroke={b} strokeWidth={10} />
      {[-470, -235, 235, 470].map((y) => (
        <g key={y}>
          <rect x={-70} y={y - 28} width={190} height={56} rx={24} fill={b} {...st(5)} />
          <ellipse cx={128} cy={y} rx={7} ry={70} fill="#E8ECF0" opacity={0.55 + 0.25 * Math.sin(f * 2.1 + y)} />
          <circle cx={124} cy={y} r={9} fill={INK} />
        </g>))}
      <path d="M -390 -14 L -430 -236 L -486 -236 L -486 236 L -430 236 L -390 14 Z" fill={a} {...ST} />
      <path d="M 450 0 C 450 -52 400 -66 310 -66 L -500 -52 C -540 -50 -560 -22 -560 0 C -560 22 -540 50 -500 52 L 310 66 C 400 66 450 52 450 0 Z" fill={c} {...ST} />
      <path d="M 450 0 C 450 -42 418 -58 360 -62 L 360 62 C 418 58 450 42 450 0 Z" fill="#7FA6C9" {...st(5)} />
      <path d="M 300 -40 L -440 -30" stroke={b} strokeWidth={8} opacity={0.6} />
    </g>
  );
};
// a small parachute with its canister
export const Chute = ({s = 1, sway = 0}) => (
  <g transform={`rotate(${sway}) scale(${s})`}>
    <path d="M -64 0 L 0 76 L 64 0 M -22 -4 L 0 76 L 22 -4" stroke={INK} strokeWidth={3} fill="none" />
    <path d="M -66 0 C -66 -58 66 -58 66 0 C 44 -10 22 -10 0 0 C -22 -10 -44 -10 -66 0 Z" fill="#F1F5F9" {...st(5)} />
    <rect x={-14} y={74} width={28} height={44} rx={8} fill="#6B7280" {...st(4)} />
  </g>
);
// the hanko: his personal seal and its red print, 山口 (Yamaguchi), in a speech-bubble circle
export const Hanko = () => (
  <g>
    <path d="M -46 104 L -96 176 L 4 112" fill="#fff" {...ST} />
    <circle r={126} fill="#fff" {...ST} />
    <g transform="translate(-48 6) rotate(-10)">
      <rect x={-24} y={-74} width={48} height={124} rx={12} fill="#8B3A2E" {...st(5)} />
      <ellipse cx={0} cy={-74} rx={24} ry={9} fill="#B05A48" {...st(4)} />
      <rect x={-24} y={36} width={48} height={14} fill="#D7262E" />
    </g>
    <g transform="translate(52 6)" stroke="#D7262E" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle r={44} strokeWidth={6} />
      <path d="M 0 -32 L 0 -2 M -18 -22 L -18 -2 M 18 -22 L 18 -2 M -20 -2 L 20 -2" />
      <path d="M -14 8 L 14 8 L 14 28 L -14 28 Z" />
    </g>
  </g>
);
// a 1940s Japanese wooden house: tiled roof with turned-up eaves, plank walls, a paper window, a sliding door
export const House = ({x = 0, y = 0, w = 280, h = 170, wall = '#C49A63', roof = '#3D4652', storeys = 1, dark = 0}) => {
  const hw = w / 2;
  const win = (yy) => (
    <g>
      <rect x={-hw * 0.62} y={yy} width={w * 0.5} height={h * 0.34} fill="#F4ECD8" {...st(5)} />
      {[0.25, 0.5, 0.75].map((t) => <path key={t} d={`M ${-hw * 0.62 + w * 0.5 * t} ${yy} L ${-hw * 0.62 + w * 0.5 * t} ${yy + h * 0.34}`} stroke="#A88A5E" strokeWidth={3} />)}
      <path d={`M ${-hw * 0.62} ${yy + h * 0.17} L ${-hw * 0.62 + w * 0.5} ${yy + h * 0.17}`} stroke="#A88A5E" strokeWidth={3} />
    </g>
  );
  const top = -h * storeys;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-hw} y={top} width={w} height={-top} fill={wall} {...st(6)} />
      {[...Array(Math.max(1, Math.floor(w / 34)))].map((_, i) => <path key={i} d={`M ${-hw + 17 + i * 34} ${top + 8} L ${-hw + 17 + i * 34} -8`} stroke="#9C7748" strokeWidth={3} opacity={0.6} />)}
      {win(-h * 0.78)}
      {storeys > 1 && <g>{win(top + h * 0.24)}<path d={`M ${-hw - 30} ${-h} L ${hw + 30} ${-h}`} stroke={roof} strokeWidth={18} /></g>}
      <rect x={hw * 0.12} y={-h * 0.66} width={w * 0.26} height={h * 0.66} fill="#7A5634" {...st(5)} />
      <path d={`M ${-hw - 52} ${top + 6} C ${-hw - 22} ${top - 4} ${-hw + 8} ${top - 20} ${-hw + 20} ${top - 34} L ${hw - 20} ${top - 34} C ${hw - 8} ${top - 20} ${hw + 22} ${top - 4} ${hw + 52} ${top + 6} Z`} fill={roof} {...st(6)} />
      <path d={`M ${-hw + 20} ${top - 34} L ${-hw + 72} ${top - 98} L ${hw - 72} ${top - 98} L ${hw - 20} ${top - 34} Z`} fill={roof} {...st(6)} />
      {[0.33, 0.66].map((t) => <path key={t} d={`M ${-hw + 20 + 52 * t} ${top - 34 - 64 * t} L ${hw - 20 - 52 * t} ${top - 34 - 64 * t}`} stroke="#576170" strokeWidth={4} />)}
      <path d={`M ${-hw + 64} ${top - 98} L ${hw - 64} ${top - 98}`} stroke={INK} strokeWidth={16} strokeLinecap="round" />
      {dark > 0 && <rect x={-hw - 54} y={top - 106} width={w + 108} height={-top + 106} fill="#000" opacity={dark} />}
    </g>
  );
};
const Pole = ({x, y, h = 430}) => (
  <g>
    <rect x={x - 9} y={y - h} width={18} height={h} fill="#6B4F35" {...st(4)} />
    <path d={`M ${x - 64} ${y - h + 34} L ${x + 64} ${y - h + 34}`} stroke="#6B4F35" strokeWidth={12} strokeLinecap="round" />
    <path d={`M ${x - 64} ${y - h + 34} L ${x + 64} ${y - h + 34}`} stroke={INK} strokeWidth={3} opacity={0.6} />
  </g>
);
export const Crane = ({x, y, s = 1, color = '#56677A'}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M -22 0 L -22 -380 L 22 -380 L 22 0 Z" fill={color} {...st(4)} />
    {[...Array(7)].map((_, i) => <path key={i} d={`M -22 ${-i * 54} L 22 ${-i * 54 - 54}`} stroke={INK} strokeWidth={3} opacity={0.6} />)}
    <path d="M -150 -392 L 320 -392 L 320 -368 L -150 -368 Z" fill={color} {...st(4)} />
    <rect x={-170} y={-404} width={60} height={40} fill={color} {...st(4)} />
    <path d="M 260 -368 L 260 -220" stroke={INK} strokeWidth={3} />
    <path d="M 252 -220 L 268 -220 L 268 -206 Q 260 -196 252 -206 Z" fill={INK} />
  </g>
);
// a morning sky over Hiroshima: clear, a low sun, hills, the shipyard's cranes far off
export const Morning = ({f = 0, id = 'ymorn', hills = true, cranes = true, dim = 0, clouds = true}) => (
  <g>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4F8FD0" /><stop offset="1" stopColor="#E9F0F2" /></linearGradient>
    <rect width={W} height={H} fill={`url(#${id})`} />
    <circle cx={1650} cy={250} r={70} fill="#FFF3C4" /><circle cx={1650} cy={250} r={130} fill="#FFF3C4" opacity={0.3} />
    {clouds && <><Cloud x={380 - f * 0.25} y={170} s={0.7} op={0.85} /><Cloud x={1150 - f * 0.3} y={250} s={0.55} op={0.75} /></>}
    {hills && <path d="M 0 640 C 200 520 380 560 560 590 C 760 520 960 540 1140 600 C 1340 520 1560 540 1920 600 L 1920 760 L 0 760 Z" fill="#8FAE98" opacity={0.75} />}
    {cranes && <g opacity={0.7}><Crane x={1480} y={700} s={0.55} /><Crane x={1700} y={700} s={0.45} /></g>}
    {dim > 0 && <rect width={W} height={H} fill="#1B1410" opacity={dim} />}
  </g>
);
// a row of houses on a street, with poles and wires (the street's ground starts at y)
export const Street = ({y = 760, seed = 1, f = 0, dark = 0}) => {
  const R = R2(seed);
  const hs = [...Array(7)].map((_, i) => ({x: 120 + i * 290 + R() * 30, w: 230 + R() * 60, h: 150 + R() * 40, st: R() > 0.6 ? 2 : 1, wall: ['#C49A63', '#B98E58', '#CDA772'][i % 3], roof: ['#3D4652', '#454B55', '#353C46'][i % 3]}));
  return (
    <g>
      {hs.map((h, i) => <House key={i} x={h.x} y={y} w={h.w} h={h.h} storeys={h.st} wall={h.wall} roof={h.roof} dark={dark} />)}
      <path d={`M 40 ${y - 396} Q 420 ${y - 350} 800 ${y - 396} Q 1180 ${y - 350} 1560 ${y - 396} Q 1740 ${y - 370} 1960 ${y - 390}`} stroke={INK} strokeWidth={3} fill="none" opacity={0.7} />
      {[40, 800, 1560].map((x) => <Pole key={x} x={x} y={y + 10} />)}
      <rect y={y} width={W} height={H - y} fill="#C9B48E" />
      <path d={`M 0 ${y} L ${W} ${y}`} {...st(6)} />
      <path d={`M 0 ${y + 120} L ${W} ${y + 120}`} stroke="#B49E77" strokeWidth={6} opacity={0.6} />
    </g>
  );
};
// a potato field: brown furrows and leafy plants, seen from the side
export const Field = ({y = 760, dark = 0, seed = 5}) => {
  const R = R2(seed);
  return (
    <g>
      <rect y={y} width={W} height={H - y} fill="#7A5A3A" />
      {[...Array(6)].map((_, i) => <path key={i} d={`M -20 ${y + 30 + i * 52} C 600 ${y + 14 + i * 52} 1300 ${y + 44 + i * 52} 1940 ${y + 24 + i * 52}`} stroke="#5E4329" strokeWidth={14} fill="none" />)}
      {[...Array(26)].map((_, i) => { const x = R() * W, yy = y + 20 + R() * (H - y - 40); return (
        <g key={i} transform={`translate(${x} ${yy}) scale(${0.6 + (yy - y) / 600})`}>
          <ellipse cx={-18} cy={-10} rx={26} ry={14} fill="#5C7A3A" {...st(3)} transform="rotate(-30 -18 -10)" />
          <ellipse cx={18} cy={-10} rx={26} ry={14} fill="#6B8A44" {...st(3)} transform="rotate(30 18 -10)" />
          <ellipse cx={0} cy={-24} rx={16} ry={22} fill="#7A9A4E" {...st(3)} />
        </g>); })}
      <path d={`M 0 ${y} L ${W} ${y}`} {...st(5)} />
      {dark > 0 && <rect y={y - 4} width={W} height={H - y + 4} fill="#120C08" opacity={dark} />}
    </g>
  );
};
// dark at eight in the morning: brown dust, a dim red sun, specks drifting
const DustSky = ({f = 0, k = 1, seed = 9}) => {
  const R = R2(seed);
  return (
    <g>
      <linearGradient id="ydust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2B2220" /><stop offset="1" stopColor="#6B4A36" /></linearGradient>
      <rect width={W} height={H} fill="url(#ydust)" opacity={k} />
      <circle cx={1500} cy={260} r={60} fill="#C2543A" opacity={0.35 * k} />
      {[...Array(60)].map((_, i) => { const x = (R() * W + f * (0.6 + R())) % W, y = (R() * H + Math.sin(f * 0.02 + i) * 20); return <circle key={i} cx={x} cy={y} r={2 + R() * 4} fill="#C9A27E" opacity={0.25 * k} />; })}
    </g>
  );
};
// what is left of a street: broken walls and bare frames as dark shapes (never people)
export const Ruins = ({y = 760, seed = 12, color = '#2B1F1A'}) => {
  const R = R2(seed);
  return (
    <g fill={color}>
      {[...Array(9)].map((_, i) => { const x = i * 230 + R() * 60, w = 90 + R() * 120, h = 60 + R() * 150;
        return <g key={i}>
          <path d={`M ${x} ${y} L ${x} ${y - h} L ${x + w * 0.3} ${y - h + 30} L ${x + w * 0.5} ${y - h - 20} L ${x + w * 0.7} ${y - h + 40} L ${x + w} ${y - h * 0.5} L ${x + w} ${y} Z`} />
          {R() > 0.5 && <path d={`M ${x + w + 30} ${y} L ${x + w + 38} ${y - h - 60} L ${x + w + 50} ${y - h - 60} L ${x + w + 46} ${y} Z`} />}
        </g>; })}
    </g>
  );
};
// a white flash filling the screen: a burst from (x, y) that covers everything in a few frames
// (after the first moments the picture ghosts through, overexposed, so a long white line isn't an empty screen)
const WhiteOut = ({f, at: a, x = 960, y = -200, hold = 1, ghost = 0.86}) => {
  if (f < a) return null;
  const r = lin(f, a, a + 6, 0, 2600, (t) => t);
  const op = clamp((f - a - 2) / 4, 0, 1) * lin(f, a + 14, a + 40, 1, ghost);
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#FFFDF2" opacity={lin(f, a + 14, a + 40, 1, ghost)} />
      <rect width={W} height={H} fill="#FFFDF2" opacity={op * hold} />
      <circle cx={x} cy={Math.max(y, 120)} r={lin(f, a, a + 60, 200, 520)} fill="#FFFFFF" opacity={0.7} />
    </g>
  );
};

// ───────────── the map of southern Japan (Natural Earth land, like the other story maps) ─────────────
export const PLACES_JP = {hiroshima: [132.455, 34.385, 'HIROSHIMA'], nagasaki: [129.873, 32.750, 'NAGASAKI'], kokura: [130.875, 33.885, 'KOKURA'],
  tokyo: [139.69, 35.69, 'TOKYO']};
// center [lon, lat], ppd = pixels per degree; returns the projection and the land path's transform
const proj = (center, ppd) => {
  const [clon, clat] = center;
  const sc = ppd / K;
  return {sx: (lon) => W / 2 + (lon - clon) * ppd, sy: (lat) => H / 2 - (lat - clat) * ppd,
    land: `translate(${W / 2} ${H / 2}) scale(${sc}) translate(${-(clon + 180) * K} ${-(90 - clat) * K})`};
};
export const JapanLand = ({center = [131.2, 33.6], ppd = 160, sea = '#5BA4D4', land = '#C9D9A8'}) => {
  const pr = proj(center, ppd);
  return (
    <g>
      <rect width={W} height={H} fill={sea} />
      <g transform={pr.land}><path d={LAND} fill={land} stroke={INK} strokeWidth={5} vectorEffect="non-scaling-stroke" /></g>
    </g>
  );
};
// a white starburst (a city hit), drawn flat
export const Burst = ({r = 60, k = 1, color = '#FFFDF2'}) => (
  <g transform={`scale(${k})`}>
    <circle r={r * 1.9} fill={color} opacity={0.25} />
    <path d={[...Array(16)].map((_, i) => { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.55 : r * 1.35; return `${i ? 'L' : 'M'} ${Math.cos(a) * rr} ${Math.sin(a) * rr}`; }).join(' ') + ' Z'} fill={color} {...st(4)} />
    <circle r={r * 0.45} fill="#FFE8A3" />
  </g>
);
// a map pin with its name
const Pin = ({x, y, name, f, a, side = 1, color = '#FFE11A', ink = INK}) => {
  const s = clamp(pop(f, a, 150, 12), 0, 1.15);
  if (s < 0.01) return null;
  const w = name.length * 30 + 44;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform={`scale(${s})`}><path d="M 0 0 Q -30 -40 -30 -60 A 30 30 0 0 1 30 -60 Q 30 -40 0 0 Z" fill={color} {...st(5)} /><circle cx={0} cy={-60} r={10} fill={INK} /></g>
      <g transform={`translate(${side > 0 ? 40 : -40 - w} -128) scale(${s})`}>
        <rect x={6} y={8} width={w} height={62} fill="#000" opacity={0.3} /><rect width={w} height={62} fill={color} {...st(5)} />
        <text x={w / 2} y={50} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={50} fill={ink}>{name}</text>
      </g>
    </g>
  );
};
// the route: Hiroshima -> Nagasaki by train (p.route_on), the distance on it (p.km_on), a flash on a city (p.flash: ['hiroshima', 'nagasaki'])
function YMap({f, len, line}) {
  const p = P(line);
  const center = p.center || [131.2, 33.55];
  const ppd = lin(f, 0, len, p.zoom0 || 165, p.zoom1 || 185);
  const pr = proj(center, ppd);
  const pins = p.pins || ['hiroshima', 'nagasaki'];
  const ra = at(line, p.route_on || '', 0.35);
  const A = PLACES_JP.hiroshima, B = PLACES_JP.nagasaki;
  const x1 = pr.sx(A[0]), y1 = pr.sy(A[1]), x2 = pr.sx(B[0]), y2 = pr.sy(B[1]);
  const L = Math.hypot(x2 - x1, y2 - y1), d = lin(f, ra, ra + 45, 0, L);
  const ka = at(line, p.km_on || '', 0.6);
  return (
    <g>
      <JapanLand center={center} ppd={ppd} />
      <text x={pr.sx(135.4)} y={pr.sy(35.6)} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={110} fill="#fff" opacity={0.6} stroke={INK} strokeWidth={4} paintOrder="stroke">JAPAN</text>
      {(p.flash || []).map((k, i) => { const pl = PLACES_JP[k]; const a = at(line, (p.flash_on || [])[i] || '', 0.2 + i * 0.3);
        return f >= a ? <g key={k} transform={`translate(${pr.sx(pl[0])} ${pr.sy(pl[1])})`}><Burst r={44} k={clamp(pop(f, a, 120, 10), 0, 1.1)} /></g> : null; })}
      {p.route_on && <g>
        <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="#fff" strokeWidth={18} strokeDasharray={`${d} ${L}`} strokeLinecap="round" opacity={0.7} />
        <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="#E3232C" strokeWidth={9} strokeDasharray={`${d} ${L}`} strokeLinecap="round" />
        {p.km && f > ka && <g transform={`translate(${(x1 + x2) / 2 - 40} ${(y1 + y2) / 2 + 80}) rotate(-8) scale(${clamp(pop(f, ka, 150, 12), 0, 1.1)})`}>
          <rect x={-120} y={-52} width={240} height={88} fill="#fff" {...st(6)} /><Txt x={0} y={20} text={p.km} size={66} fill={INK} stroke="none" /></g>}
      </g>}
      {p.target && (() => { const pl = PLACES_JP[p.target]; const a = at(line, p.target_on || '', 0.4); return f > a ? [0, 1].map((i) => { const q = ((f - a) / 40 + i / 2) % 1;
        return <circle key={i} cx={pr.sx(pl[0])} cy={pr.sy(pl[1])} r={40 + q * 160} fill="none" stroke="#E3232C" strokeWidth={8} opacity={1 - q} />; }) : null; })()}
      {pins.map((k, i) => { const pl = PLACES_JP[k]; return <Pin key={k} x={pr.sx(pl[0])} y={pr.sy(pl[1])} name={pl[2]} f={f} a={Math.min(at(line, (p.pin_on || [])[i] || '', 0.1 + i * 0.12), 6 + i * 6)} side={k === 'nagasaki' ? -1 : 1} />; })}
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// ───────────── the scenes ─────────────
// 1. a few minutes past eight: Hiroshima's shipyard district, Yamaguchi walking back for his seal (the hanko pops on "seal")
function YStreet({f, len, line}) {
  const p = P(line);
  const tn = p.turn_on ? at(line, p.turn_on, 0.7) : len + 1;   // he turns round there and walks back the other way
  const wx = f < tn ? lin(f, 0, len, p.from || 1180, p.to || 820, (t) => t) : lin(tn, 0, len, p.from || 1180, p.to || 820, (t) => t) + (f - tn) * 2.4;
  const dir = f < tn ? -1 : 1;
  const k = popAt(f, line, p.seal_on || 'seal', 0.6);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05} y={620}>
      <Morning f={f} />
      <Street y={760} seed={p.seed || 2} f={f} />
      {p.bag && <g transform={`translate(${wx - 60 * dir} 960)`}><rect x={-50} y={-70} width={100} height={70} rx={8} fill="#7A4A2A" {...st(5)} /><path d="M -20 -70 L -20 -86 L 20 -86 L 20 -70" stroke={INK} strokeWidth={6} fill="none" /></g>}
      <g transform={`translate(${wx} 1010) scale(0.5) translate(0 -1090)`}><Figure who="yamaguchi" pose="walk" dir={dir} f={f} expr={f < tn ? 'calm' : 'worried'} seed={3} /></g>
      {k > 0.01 && <g transform={`translate(${wx + 230} 380) scale(${k})`}><Hanko /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 2. meet him: Yamaguchi, 29, and the people waiting at home (a photo of Hisako and the baby pops on "wife")
function YMeet({f, len, line}) {
  const p = P(line);
  const k = popAt(f, line, p.home_on || 'today', 0.4);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <Morning f={f} hills={false} cranes={false} dim={0.05} clouds={false} />
      <g opacity={0.5}><Street y={900} seed={4} /></g>
      <rect width={W} height={H} fill="#F3E7CC" opacity={0.55} />
      <YBust who="yamaguchi" x={p.x || 600} y={470} s={0.95} expr={p.expr || 'smile'} f={f} seed={3} turn={0.2} />
      {p.bag && <g transform={`translate(240 960) scale(${popAt(f, line, p.bag_on || 'bags', 0.3)})`}><rect x={-120} y={-170} width={240} height={170} rx={16} fill="#7A4A2A" {...st(7)} /><path d="M -50 -170 L -50 -205 L 50 -205 L 50 -170" stroke={INK} strokeWidth={10} fill="none" /><path d="M -120 -90 L 120 -90" stroke="#5A341C" strokeWidth={8} /></g>}
      {k > 0.01 && <g transform={`translate(1340 470) rotate(4) scale(${k})`}>
        <rect x={-300} y={-260} width={600} height={500} fill="#FBF7EC" {...st(8)} />
        <clipPath id="yphoto"><rect x={-270} y={-230} width={540} height={400} /></clipPath>
        <rect x={-270} y={-230} width={540} height={400} fill="#D9C7A4" />
        <g clipPath="url(#yphoto)">
          <g transform="translate(-70 -60)"><YBust who="hisako" x={0} y={0} s={0.42} expr="smile" f={f} seed={5} /></g>
          <g transform="translate(70 70)"><Baby s={0.7} f={f} /></g>
        </g>
        <rect x={-270} y={-230} width={540} height={400} fill="none" {...st(5)} />
        <Txt x={0} y={216} text={p.photo || 'HISAKO AND THEIR SON'} size={34} fill={INK} stroke="none" />
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={80} /></g>
  );
}

// 3. a single bomber across a clear sky, two small parachutes drift out of it; he stops to look up
function YSky({f, len, line}) {
  const p = P(line);
  const c = at(line, p.chute_on || 'two', 0.5), stop = at(line, p.look_on || 'stops', 0.8);
  const bx = lin(f, 0, len, -300, 1600, (t) => t);
  const cx = lin(c, 0, len, -300, 1600, (t) => t);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.06} y={500}>
      <linearGradient id="yskyup" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2F6FB8" /><stop offset="1" stopColor="#BFD9EE" /></linearGradient>
      <rect width={W} height={H} fill="url(#yskyup)" />
      <Cloud x={300} y={760} s={0.9} op={0.6} /><Cloud x={1250} y={820} s={0.7} op={0.5} />
      <g transform={`translate(${bx} 250) rotate(-6) scale(0.3)`}><B29 f={f} /></g>
      {f > c && [0, 1].map((i) => { const t = f - c - i * 8; if (t < 0) return null;
        return <g key={i} transform={`translate(${cx - 80 - i * 150 + Math.sin(t * 0.05 + i) * 30} ${320 + t * 1.1 + i * 40})`}><Chute s={clamp(pop(t, 0, 120, 14), 0, 1) * 1.4} sway={Math.sin(t * 0.06 + i) * 10} /></g>; })}
      <g>{[0, 1, 2, 3, 4, 5].map((i) => <g key={i} transform={`translate(${-60 + i * 330} 1080)`}><path d="M -200 0 L -150 -60 L -170 -60 L -120 -110 L 120 -110 L 170 -60 L 150 -60 L 200 0 Z" fill="#222831" /></g>)}</g>
      <YBust who="yamaguchi" x={1600} y={860} s={0.62} expr={f > stop ? 'worried' : 'calm'} f={f} seed={3} rot={-14} look={-14} />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 4. "the sky turns white ... and the ground throws him into a potato field": the street goes white, then dust, a tumble, the field
function YFlash({f, len, line}) {
  const p = P(line);
  const tumble = p.mode === 'tumble';   // no white phase: the dust, he stands, and he is thrown on p.throw_on
  const w = tumble ? -99 : at(line, p.white_on || 'white', 0.15), t = at(line, p.throw_on || 'throws', tumble ? 0.2 : 0.65);
  if (f < t && !tumble) {
    return (
      <g>
        <Morning f={f} />
        <Street y={760} seed={2} />
        <g transform="translate(900 1010) scale(0.5) translate(0 -1090)"><Figure who="yamaguchi" pose="stand" f={f} expr={f > w ? 'shock' : 'worried'} seed={3} /></g>
        <WhiteOut f={f} at={w} x={760} y={-300} />
        {f >= w && <g opacity={clamp(1 - (f - w - 10) / 30, 0.15, 1)}><Labels line={line} f={f} x0={100} y0={100} /></g>}
        {f < w && <Labels line={line} f={f} x0={100} y0={100} />}
      </g>
    );
  }
  const u = clamp((f - t) / (tumble ? Math.max(30, at(line, p.land_on || 'dumped', 0.75) - t) : 26), 0, 1);
  const fx = lin(u, 0, 1, 520, 1080, (q) => q), fy = 820 - Math.sin(Math.PI * u) * 330 - (1 - u) * 60;
  const white = tumble ? 0 : clamp(1 - (f - t) / 16, 0, 1);
  return (
    <g>
      <Cam f={f - t} len={len - t} a={1.04} b={1.0} shake={f < t + 16 ? 16 : 0}>
        <DustSky f={f} k={1} />
        <g opacity={0.6}><Ruins y={762} /></g>
        <Field y={760} dark={0.3} />
        {tumble && f < t ? <g transform="translate(520 1000) scale(0.42) translate(0 -1090)"><Figure who="yamaguchi" pose="stand" f={f} expr="shock" seed={3} /></g>
          : u < 1 ? <g transform={`translate(${fx} ${fy}) rotate(${u * 520}) scale(0.32)`}><YBust who="yamaguchi" x={0} y={-300} s={1} expr="scared" f={f} arms="flail" seed={3} /></g>
          : <g transform="translate(980 880) rotate(-90) scale(0.42)"><YBust who="yamaguchi" x={0} y={0} s={1} expr="closed" f={f} seed={3} /></g>}
        {u >= 1 && f >= t && [...Array(8)].map((_, i) => { const q = clamp((f - t - 26) / 30, 0, 1); return <circle key={i} cx={1060 + Math.cos(i) * 90 * (0.4 + q)} cy={860 - Math.abs(Math.sin(i * 1.7)) * 60 * q} r={30 + 20 * q} fill="#8A6A4E" opacity={0.5 * (1 - q)} />; })}
      </Cam>
      <rect width={W} height={H} fill="#FFFDF2" opacity={white} />
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// 5. dark at eight in the morning: he opens his eyes in the field, his left side burning, his ears ringing with silence
function YDark({f, len, line}) {
  const p = P(line);
  const o = at(line, p.open_on || 'opens', 0.12), b = at(line, p.burn_on || 'burning', 0.45), r = at(line, p.ring_on || 'ring', 0.7);
  const burn = clamp((f - b) / 12, 0, 1) * (0.55 + 0.15 * Math.sin(f * 0.25));
  return (
    <g><Cam f={f} len={len} a={1.1} b={1.0} x={1000} y={640}>
      <DustSky f={f} k={1} />
      <Field y={700} dark={0.55} />
      <ellipse cx={1000} cy={800} rx={360} ry={150} fill="#F3D9B8" opacity={0.16} />
      <g transform="translate(900 800) rotate(-90) scale(0.5)">
        <Torso who="yamaguchi" arms="rest" f={f} />
        <ellipse cx={150} cy={360} rx={120} ry={330} fill="#FF6A3D" opacity={0.45 * burn} />
        <Head who="yamaguchi" expr={f < o ? 'closed' : 'waking'} f={f} seed={3} />
        <ellipse cx={70} cy={10} rx={80} ry={120} fill="#FF6A3D" opacity={0.35 * burn} />
      </g>
      {f > r && [0, 1, 2].map((i) => { const q = ((f - r) / 40 + i / 3) % 1; return <circle key={i} cx={900} cy={800} r={120 + q * 420} fill="none" stroke="#F5EEDF" strokeWidth={6} opacity={0.5 * (1 - q)} />; })}
    </Cam>
      <rect width={W} height={H} fill="#000" opacity={clamp(1 - (f - o) / 10, 0, 0.6)} />
      {p.quote && (() => { const k = clamp(pop(f, Math.min(at(line, p.quote_on || '', 0.1), 10), 140, 12), 0, 1.05); const rows = p.quote;
        return <g transform={`translate(90 70) scale(${k})`}><rect x={10} y={12} width={1000} height={70 + rows.length * 74} fill="#000" opacity={0.35} /><rect width={1000} height={70 + rows.length * 74} fill="#fff" {...ST} />
          <rect x={26} y={26} width={12} height={18 + rows.length * 74} fill="#E3232C" />
          {rows.map((r, i) => <text key={i} x={64} y={92 + i * 74} fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={60} fill={INK}>{(i === 0 ? '\u201C' : '') + r + (i === rows.length - 1 ? '\u201D' : '')}</text>)}</g>; })()}
      <Labels line={line} f={f} x0={100} y0={p.quote ? 120 + p.quote.length * 74 : 100} /></g>
  );
}

// the Nagasaki office: plain walls, a window over the harbour, a clock, the boss's desk
const OfficeRoom = ({f = 0, white = 0, clock = '11:00', blown = 0}) => (
  <g>
    <rect width={W} height={H} fill="#DCCDB0" />
    <rect y={0} width={W} height={60} fill="#C8B795" />
    <rect y={820} width={W} height={260} fill="#8A6A48" />
    <path d="M 0 820 L 1920 820" {...st(6)} />
    <g transform="translate(1380 120)">
      <rect width={420} height={330} fill={white > 0 ? '#FFFDF2' : '#A8C9E4'} {...st(8)} />
      {white <= 0 && <g><path d="M 0 230 C 80 170 160 200 220 180 C 300 150 360 190 420 170 L 420 330 L 0 330 Z" fill="#7E9E78" /><rect y={280} width={420} height={50} fill="#5B8FC0" /></g>}
      {blown <= 0 && <path d="M 210 0 L 210 330 M 0 165 L 420 165" stroke={INK} strokeWidth={8} />}
    </g>
    <g transform="translate(960 170)"><circle r={70} fill="#FBF7EC" {...st(7)} />
      {(() => { const [hh, mm] = clock.split(':').map(Number); const ma = mm / 60 * 360, ha = ((hh % 12) + mm / 60) / 12 * 360;
        return <g stroke={INK} strokeLinecap="round"><path d={`M 0 0 L ${Math.sin(ha * Math.PI / 180) * 36} ${-Math.cos(ha * Math.PI / 180) * 36}`} strokeWidth={8} /><path d={`M 0 0 L ${Math.sin(ma * Math.PI / 180) * 54} ${-Math.cos(ma * Math.PI / 180) * 54}`} strokeWidth={5} /></g>; })()}
    </g>
    <path d="M 560 760 L 1320 760 L 1360 830 L 520 830 Z" fill="#6B4A2E" {...st(7)} />
    <rect x={640} y={720} width={180} height={40} fill="#F4EEE0" {...st(4)} transform="rotate(-4 730 740)" />
  </g>
);
// 7. the office in Nagasaki: bandaged Yamaguchi tells it, the boss doesn't believe a word (a "?!" bubble on p.mad_on)
function YOffice({f, len, line}) {
  const p = P(line);
  const m = at(line, p.mad_on || 'mad', 0.5);
  const half = p.boss_talks === false ? len + 1 : m - 6;
  const talk = Math.floor(f / 5) % 2 === 0;
  const k = clamp(pop(f, m, 150, 12), 0, 1.1);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <OfficeRoom f={f} clock={p.clock || '10:55'} />
      <YBust who="yamaguchi" x={600} y={430} s={0.85} expr={f < half ? 'worried' : 'shock'} talk={f < half && talk && p.he_talks !== false} f={f} seed={3} band turn={0.25} />
      <YBust who="boss" x={1300} y={430} s={0.85} expr={f >= m - 4 && p.boss_talks !== false ? 'shock' : 'grim'} talk={f >= half && talk && f < m - 4} f={f} seed={6} turn={-0.25} />
      {p.ybubble && (() => { const q = clamp(pop(f, at(line, p.ybubble_on || '', 0.3), 150, 12), 0, 1.1); return q > 0.01 ? <g transform={`translate(560 190) scale(${q})`}>
        <path d="M 60 70 L 120 150 L -10 90" fill="#fff" {...ST} /><rect x={-330} y={-90} width={660} height={170} rx={60} fill="#fff" {...ST} />
        <text x={0} y={22} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={58} fill={INK}>{p.ybubble}</text></g> : null; })()}
      {k > 0.01 && p.bubble !== false && <g transform={`translate(1500 230) scale(${k})`}>
        <path d="M -90 60 L -150 150 L -20 80" fill="#fff" {...ST} />
        <ellipse rx={170} ry={110} fill="#fff" {...ST} />
        <Txt x={0} y={30} text={p.bubble || '?!'} size={Math.min(110, 560 / Math.max(1, String(p.bubble || '?!').length))} fill="#E3232C" stroke="none" />
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 8. "and then the light will come again": the office window turns white and fills the room
function YWindow({f, len, line}) {
  const p = P(line);
  const w = at(line, p.white_on || 'light', 0.55);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.18} x={1100} y={460}>
      <OfficeRoom f={f} clock="11:02" white={f >= w ? 1 : 0} />
      <YBust who="yamaguchi" x={1180} y={560} s={0.7} expr={f >= w ? 'shock' : 'worried'} f={f} seed={3} band turn={0.6} look={10} />
    </Cam>
      {f >= w && <rect width={W} height={H} fill="#FFFDF2" opacity={clamp((f - w) / 14, 0, 1)} />}
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// ───────────── THE TITLE (and the thumbnail) ─────────────
// southern Japan, the red train line from Hiroshima to Nagasaki, a white burst over each city, Yamaguchi bandaged in front
export function YamArt({boxes = true, f = 0, top = 'HE SURVIVED BOTH', bottom = '3 DAYS APART', bursts = [1, 1], line = 1, face = 'determined', big = false, bottom_w = 760, tags = 0}) {
  const pr = proj([131.4, 33.3], 230);
  const A = PLACES_JP.hiroshima, B = PLACES_JP.nagasaki;
  const x1 = pr.sx(A[0]), y1 = pr.sy(A[1]), x2 = pr.sx(B[0]), y2 = pr.sy(B[1]);
  return (
    <g>
      <JapanLand center={[131.4, 33.3]} ppd={230} sea="#1D4E7A" land="#B9C99A" />
      <rect width={W} height={H} fill="#0B1F3A" opacity={0.25} />
      <path d={`M ${x1} ${y1} L ${x1 + (x2 - x1) * line} ${y1 + (y2 - y1) * line}`} stroke="#fff" strokeWidth={20} strokeLinecap="round" opacity={0.7} />
      <path d={`M ${x1} ${y1} L ${x1 + (x2 - x1) * line} ${y1 + (y2 - y1) * line}`} stroke="#E3232C" strokeWidth={10} strokeLinecap="round" strokeDasharray="26 14" />
      {bursts[0] > 0 && <g transform={`translate(${x1} ${y1})`}><Burst r={big ? 100 : 70} k={bursts[0]} /></g>}
      {bursts[1] > 0 && <g transform={`translate(${x2} ${y2})`}><Burst r={big ? 100 : 70} k={bursts[1]} /></g>}
      {tags > 0 && <g>
        <g transform={`translate(${x1 - 340} ${y1 + 140}) scale(${tags})`}><rect x={0} y={-46} width={390} height={62} fill="#fff" {...st(5)} /><text x={195} y={0} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={44} fill={INK}>HIROSHIMA · 6 AUG</text></g>
        <g transform={`translate(${x2 - 100} ${y2 + 110}) scale(${tags})`}><rect x={0} y={-46} width={390} height={62} fill="#fff" {...st(5)} /><text x={195} y={0} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={44} fill={INK}>NAGASAKI · 9 AUG</text></g>
      </g>}
      <g transform={big ? 'translate(1480 600)' : 'translate(1500 560)'}><YBust who="yamaguchi" x={0} y={0} s={big ? 1.3 : 0.95} expr={face} f={f} seed={3} band turn={big ? -0.2 : -0.35} look={-6} /></g>
      {boxes && <><Box x={60} y={90} w={980} h={180} text={top} rot={-3} />
        <Box x={60} y={290} w={bottom_w} h={200} text={bottom} fill="#E3232C" color="#fff" outline rot={-3} /></>}
    </g>
  );
}
function YTitle({f, len, line}) {
  const p = P(line);
  const a = at(line, p.top_on || 'both', 0.25), b = at(line, p.bottom_on || 'apart', 0.45);
  const h1 = clamp(pop(f, Math.min(a, 10), 120, 12), 0, 1.05), h2 = clamp(pop(f, b, 120, 12), 0, 1.05);
  return (
    <g>
      <g transform={`translate(960 540) scale(${lin(f, 0, len, 1.08, 1.0)}) translate(-960 -540)`}>
        <YamArt boxes={false} f={f} bursts={[h1, h2]} line={lin(f, Math.min(a, 10), b, 0, 1)} tags={p.tags === false ? 0 : clamp(pop(f, b + 6, 150, 12), 0, 1.05)} />
      </g>
      <Box x={60} y={90} w={p.top_w || 980} h={180} text={p.top || 'HE SURVIVED BOTH'} rot={-3} s={clamp(pop(f, a, 160, 12), 0, 1.1)} />
      <Box x={60} y={290} w={p.bottom_w || 760} h={200} text={p.bottom || '3 DAYS APART'} fill="#E3232C" color="#fff" outline rot={-3} s={clamp(pop(f, b, 160, 12), 0, 1.1)} />
      <Labels line={line} f={f} x0={100} y0={800} />
    </g>
  );
}

export const YAM_SHOTS = {y_street: YStreet, y_meet: YMeet, y_sky: YSky, y_flash: YFlash, y_dark: YDark, y_map: YMap, y_office: YOffice,
  y_window: YWindow, y_title: YTitle};
