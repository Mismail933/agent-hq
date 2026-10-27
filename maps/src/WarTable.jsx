// War-table scenes for Bassel's long video (the owner, 2026-10-26: "dont make it cartoon make it real like a chess thing"): the real map
// (Natural Earth, public domain) laid on a table in perspective, lit, with carved and lacquered game pieces that sail, hop, build and
// settle. Pieces stand up off the tilted board (CSS 3D) and keep their size on screen; the camera zooms by re-projecting the map (sharp).
// Motion (the owner: "learn to animate more"): ships follow a smooth course (Catmull-Rom, even speed) with eased starts and stops, turn to
// face their heading (edge-on through the turn), fill their sails with speed and furl them at anchor, pitch and roll, and leave a foam
// wake that widens and fades (no dashed line); the camera follows the lead ship with a lag; people are moved like game pieces, in hops
// (lifted in an arc and set down), with overlap and stagger so nothing moves in lockstep.
// Scenes: 'quebec1608' (Bassel 10-26: settling, not a battle: Champlain sails from Honfleur, the Habitation goes up, trade with the First
// Nations, New France spreads along the river); 'quebec1759' (the first sample: the Plains of Abraham).
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, staticFile} from 'remotion';
import {geoMercator, geoPath, geoArea} from 'd3-geo';
import stl from './war_stl.json';
import rings1750 from './rings1750.json';
import geo from './geo.json';
import {FONT_CSS} from './fonts';

const W = 1920, H = 1080, PW = 3600, PH = 2600, TILT = 50;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const ease = Easing.inOut(Easing.cubic);
const lerp = (f, a, b, x, y, e = ease) => interpolate(f, [a, b], [x, y], {...clamp, easing: e});

// ───── pieces: lit, carved models (light from the upper left, a dark rim, a glossy highlight)
const Lacquer = ({id, c, dark, light}) => (
  <radialGradient id={id} cx="32%" cy="28%" r="80%"><stop offset="0" stopColor={light} /><stop offset="0.45" stopColor={c} /><stop offset="1" stopColor={dark} /></radialGradient>
);
const TEAMS = {fr: ['#2B4A9B', '#14234D', '#7B98D8'], uk: ['#A3262A', '#4E1012', '#E07A74'], ally: ['#2F7A6A', '#143A32', '#7CC4B2']};
const Base = ({team}) => {
  const [c, d, l] = TEAMS[team] || TEAMS.fr;
  const id = `b${team}`;
  return (
    <g>
      <defs><linearGradient id={id} x1="0" x2="1"><stop offset="0" stopColor={l} /><stop offset="0.4" stopColor={c} /><stop offset="1" stopColor={d} /></linearGradient></defs>
      <path d="M 10 168 L 10 182 C 10 196 110 196 110 182 L 110 168 Z" fill={`url(#${id})`} />
      <ellipse cx={60} cy={168} rx={50} ry={11} fill={c} stroke={d} strokeWidth={1.5} />
      <path d="M 18 166 C 30 160 60 158 92 163" fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} />
      <path d="M 16 150 L 16 160 C 16 172 104 172 104 160 L 104 150 Z" fill="#D8C7A0" stroke="#7A6440" strokeWidth={1} />
      <ellipse cx={60} cy={150} rx={44} ry={9} fill="#EADBB6" stroke="#7A6440" strokeWidth={1} />
    </g>
  );
};
const Skin = ({id, tan}) => <Lacquer id={id} c={tan ? '#B07A52' : '#D9A27E'} dark={tan ? '#6E4630' : '#8E5A3E'} light={tan ? '#D9A27E' : '#F4CDB0'} />;
// a soldier of 1759 (France: grey-white coat, blue facings; Britain: red coat), tricorn, musket at the shoulder
const Soldier = ({team, fire = 0}) => {
  const coat = team === 'fr' ? ['#E9E4D8', '#9E9888', '#FFFFFF'] : ['#B3282C', '#5A1012', '#E6807A'];
  const g = `c${team}`, sk = `s${team}`;
  return (
    <svg width={120} height={200} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
      <defs><Lacquer id={g} c={coat[0]} dark={coat[1]} light={coat[2]} /><Skin id={sk} /><Lacquer id="hat" c="#2A2622" dark="#0C0A08" light="#6A625A" /></defs>
      <Base team={team} />
      <path d="M 34 152 C 34 120 40 92 46 76 L 74 76 C 80 92 86 120 86 152 Z" fill={`url(#${g})`} stroke={coat[1]} strokeWidth={1.2} />
      <path d="M 46 78 L 60 104 L 74 78" fill="none" stroke={team === 'fr' ? '#2B4A9B' : '#F2E8D0'} strokeWidth={4} />
      <circle cx={60} cy={62} r={15} fill={`url(#${sk})`} stroke="#6E4630" strokeWidth={1} />
      <path d="M 40 52 C 46 38 74 38 80 52 C 70 48 50 48 40 52 Z" fill="url(#hat)" /><path d="M 44 50 C 52 34 68 34 76 50" fill="url(#hat)" />
      <g transform={`rotate(${-18 + fire * 62} 74 86)`}><rect x={72} y={18} width={5} height={84} rx={2} fill="#5A3A22" /><rect x={72.5} y={14} width={4} height={14} fill="#9AA3AA" /></g>
      <ellipse cx={46} cy={60} rx={6} ry={14} fill="#FFFFFF" opacity={0.18} />
    </svg>
  );
};
// a settler of 1608: a brown coat, a wide hat, an axe or a bundle
const Settler = ({tool = 'axe', swing = 0, k = 0}) => {
  const coats = [['#7A5A3A', '#3E2C1C', '#A88460'], ['#5E6B4A', '#2F3826', '#8E9C72'], ['#6E4A5A', '#38242E', '#9C7484']][k % 3];
  return (
    <svg width={120} height={200} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
      <defs><Lacquer id={`st${k}`} c={coats[0]} dark={coats[1]} light={coats[2]} /><Skin id={`sk${k}`} /><Lacquer id="felt" c="#3A2E24" dark="#15100C" light="#7A6A58" /></defs>
      <Base team="fr" />
      <path d="M 36 152 C 36 122 42 94 47 78 L 73 78 C 78 94 84 122 84 152 Z" fill={`url(#st${k})`} stroke={coats[1]} strokeWidth={1.2} />
      <rect x={44} y={112} width={32} height={5} fill="#3A2412" />
      <circle cx={60} cy={63} r={15} fill={`url(#sk${k})`} stroke="#6E4630" strokeWidth={1} />
      <ellipse cx={60} cy={52} rx={28} ry={6} fill="url(#felt)" /><path d="M 46 52 C 46 34 74 34 74 52 Z" fill="url(#felt)" />
      {tool === 'axe' && <g transform={`rotate(${-30 + swing * 70} 76 96)`}><rect x={74} y={44} width={4} height={56} rx={2} fill="#6A4A2A" /><path d="M 70 44 L 88 40 L 88 54 L 70 52 Z" fill="#9AA3AA" /></g>}
      {tool === 'bundle' && <g><ellipse cx={40} cy={92} rx={14} ry={18} fill="#B89A6A" stroke="#6A5434" /><path d="M 32 84 L 50 102" stroke="#6A5434" strokeWidth={2} /></g>}
      <ellipse cx={47} cy={60} rx={6} ry={14} fill="#FFFFFF" opacity={0.16} />
    </svg>
  );
};
// a First Nations trader (Wendat / Innu, 1600s): a deerskin tunic, long hair, a bundle of furs; drawn plainly, no costume clichés
const Trader = ({k = 0}) => (
  <svg width={120} height={200} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
    <defs><Lacquer id={`tr${k}`} c="#A8774A" dark="#5E3E22" light="#D8AA7A" /><Skin id={`tsk${k}`} tan /></defs>
    <Base team="ally" />
    <path d="M 38 152 C 38 122 43 94 48 78 L 72 78 C 77 94 82 122 82 152 Z" fill={`url(#tr${k})`} stroke="#5E3E22" strokeWidth={1.2} />
    <path d="M 40 146 L 80 146" stroke="#E8D8B0" strokeWidth={3} strokeDasharray="4 4" />
    <path d="M 45 50 C 44 80 46 92 50 100 L 56 74 Z" fill="#16110E" />
    <circle cx={60} cy={63} r={15} fill={`url(#tsk${k})`} stroke="#4A2E1C" strokeWidth={1} />
    <path d="M 45 62 C 44 44 76 44 75 62 C 70 52 50 52 45 62 Z" fill="#16110E" />
    <ellipse cx={82} cy={100} rx={13} ry={17} fill="#6A4A30" stroke="#3A2414" /><path d="M 74 90 C 80 96 86 96 92 90" fill="none" stroke="#9A7A5A" strokeWidth={2} />
  </svg>
);
// a carved ship on a small base: faces its course (face -1..1), sails fill with speed (sail 0..1), it rolls
const Ship = ({team, face = 1, sail = 1, roll = 0}) => (
  <svg width={170} height={210} viewBox="0 0 170 210" style={{overflow: 'visible'}}>
    <defs>
      <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8A5A30" /><stop offset="1" stopColor="#3A2412" /></linearGradient>
      <linearGradient id="sail" x1="0" x2="1"><stop offset="0" stopColor="#FFF8E8" /><stop offset="0.6" stopColor="#E8DCC0" /><stop offset="1" stopColor="#A8987A" /></linearGradient>
    </defs>
    <g transform="translate(25 10)"><Base team={team} /></g>
    <g transform={`translate(85 160) rotate(${roll}) scale(${face} 1) translate(-85 -160)`}>
      {[[52, 52], [86, 40], [118, 60]].map(([x, top], i) => (
        <g key={i}>
          <rect x={x - 1.5} y={top - 10} width={3} height={150 - top} fill="#4A3020" />
          <g transform={`translate(0 ${top}) scale(1 ${0.25 + 0.75 * sail}) translate(0 ${-top})`}>
            <path d={`M ${x - 22} ${top} Q ${x + 6 * sail} ${top + 8} ${x + 22} ${top} L ${x + 24} ${top + 30} Q ${x + 10 * sail} ${top + 30 + 14 * sail} ${x - 24} ${top + 30} Z`} fill="url(#sail)" stroke="#8A7A5A" strokeWidth={0.8} />
            <path d={`M ${x - 26} ${top + 36} Q ${x + 6 * sail} ${top + 46} ${x + 26} ${top + 36} L ${x + 28} ${top + 70} Q ${x + 12 * sail} ${top + 70 + 16 * sail} ${x - 28} ${top + 70} Z`} fill="url(#sail)" stroke="#8A7A5A" strokeWidth={0.8} />
          </g>
          <path d={`M ${x} ${top - 10} l 16 4 l -16 4 Z`} fill={team === 'fr' ? '#F2F2F2' : '#B3282C'} />
        </g>
      ))}
      <path d="M 22 136 L 150 136 L 140 160 C 120 172 50 172 30 162 Z" fill="url(#hull)" stroke="#2A180A" strokeWidth={1.2} />
      <path d="M 14 128 L 40 128 L 40 140 L 22 142 Z" fill="url(#hull)" />
      <path d="M 26 146 L 146 144" stroke="#D9B44A" strokeWidth={2} />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={46 + i * 16} y={149} width={6} height={4} fill="#1A0F06" />)}
    </g>
  </svg>
);
// a birchbark canoe with two paddlers (no base: it floats)
const Canoe = ({f = 0, face = 1}) => {
  const st = Math.sin(f / 5);
  return (
    <svg width={200} height={110} viewBox="0 0 200 110" style={{overflow: 'visible'}}>
      <defs><linearGradient id="bark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2E6CC" /><stop offset="1" stopColor="#A8946C" /></linearGradient><Skin id="cs" tan /></defs>
      <g transform={`translate(100 0) scale(${face} 1) translate(-100 0)`}>
        {[70, 130].map((x, i) => (
          <g key={i}>
            <path d={`M ${x - 12} 82 L ${x - 8} 56 L ${x + 8} 56 L ${x + 12} 82 Z`} fill="#A8774A" stroke="#5E3E22" />
            <circle cx={x} cy={48} r={10} fill="url(#cs)" stroke="#4A2E1C" /><path d={`M ${x - 10} 46 C ${x - 10} 34 ${x + 10} 34 ${x + 10} 46 Z`} fill="#16110E" />
            <line x1={x + 4 + st * 8} y1={50} x2={x - 14 - st * 14} y2={100} stroke="#6A4A2A" strokeWidth={3} />
          </g>
        ))}
        <path d="M 10 70 C 30 96 170 96 190 70 C 160 82 40 82 10 70 Z" fill="url(#bark)" stroke="#4A3A22" strokeWidth={1.4} />
        {[40, 80, 120, 160].map((x) => <line key={x} x1={x} y1={76} x2={x} y2={88} stroke="#4A3A22" strokeWidth={1} />)}
      </g>
    </svg>
  );
};
// a log house; grows from its base (build 0..1); smoke from the chimney once it stands
const House = ({build = 1, f = 0, wide = 1}) => (
  <svg width={150} height={190} viewBox="0 0 150 190" style={{overflow: 'visible'}}>
    <defs><linearGradient id="logs" x1="0" x2="1"><stop offset="0" stopColor="#B07A48" /><stop offset="0.6" stopColor="#8A5A30" /><stop offset="1" stopColor="#4E3018" /></linearGradient></defs>
    <path d="M 8 166 L 8 176 C 8 188 142 188 142 176 L 142 166 Z" fill="#5A5246" /><ellipse cx={75} cy={166} rx={67} ry={11} fill="#8A8270" />
    <g transform={`translate(0 166) scale(1 ${build}) translate(0 -166)`}>
      <rect x={25} y={100} width={100} height={66} fill="url(#logs)" stroke="#3A2412" />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={25} y1={110 + i * 12} x2={125} y2={110 + i * 12} stroke="#5A3A1E" strokeWidth={1.4} />)}
      <rect x={66} y={132} width={18} height={34} fill="#2E1C10" /><rect x={36} y={118} width={16} height={14} fill="#3A2A1A" stroke="#D9B44A" strokeWidth={1} />
      <rect x={104} y={70} width={12} height={34} fill="#6E6656" stroke="#3A3428" />
      <path d="M 15 102 L 75 58 L 135 102 Z" fill="#4A3A2C" stroke="#2A1E14" />
    </g>
    {build > 0.98 && [0, 1, 2].map((i) => {
      const t = ((f + i * 20) % 60) / 60;
      return <circle key={i} cx={110 + t * 16} cy={62 - t * 46} r={5 + t * 10} fill="#D8D4CC" opacity={(1 - t) * 0.6} />;
    })}
  </svg>
);
const Bourbon = () => (   // the French royal standard: white with gold fleurs-de-lis (drawn small)
  <g><rect x={0} y={0} width={56} height={36} fill="#F7F5EE" stroke="#8A8270" strokeWidth={0.8} />
    {[[12, 10], [30, 10], [46, 10], [20, 24], [38, 24]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="#C9A227" />)}</g>
);
const Union1606 = () => (   // the Union Flag of 1759 (before 1801: no Saint Patrick's cross)
  <g><rect x={0} y={0} width={56} height={36} fill="#1F3A7A" /><path d="M 0 0 L 56 36 M 56 0 L 0 36" stroke="#F2F2F2" strokeWidth={7} />
    <path d="M 28 0 L 28 36 M 0 18 L 56 18" stroke="#F2F2F2" strokeWidth={11} /><path d="M 28 0 L 28 36 M 0 18 L 56 18" stroke="#C8102E" strokeWidth={6} /></g>
);
const Pole = ({flag, f, raise = 1}) => (   // a flag on a pole; it rises (raise 0..1) and waves
  <svg width={80} height={200} viewBox="0 0 80 200" style={{overflow: 'visible'}}>
    <ellipse cx={20} cy={190} rx={18} ry={5} fill="#5A5246" /><rect x={18} y={20} width={4} height={170} fill="#3A3028" />
    <g transform={`translate(22 ${20 + (1 - raise) * 140}) skewY(${Math.sin(f / 6) * 4})`}>{flag}</g>
  </svg>
);
const Smoke = ({k}) => (
  <svg width={140} height={120} viewBox="0 0 140 120" style={{overflow: 'visible', opacity: (1 - k) * 0.85}}>
    {[[40, 70, 22], [70, 56, 30], [100, 70, 24], [60, 40, 20]].map(([x, y, r], i) => <circle key={i} cx={x + k * 20} cy={y - k * 30} r={r * (0.5 + k)} fill="#EDEAE2" />)}
    <circle cx={70} cy={80} r={12 * (1 - k)} fill="#FFD166" opacity={1 - k * 2} />
  </svg>
);

// ───── motion helpers
// a smooth course through waypoints (Catmull-Rom), walked at even speed: course(pts)(u) -> [lon, lat]
function course(pts) {
  const at = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < 40; k++) {
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      dense.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  dense.push(pts[pts.length - 1]);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], (dense[i][1] - dense[i - 1][1]) * 1.45));
  const L = cum[cum.length - 1];
  return (u) => {
    const want = Math.max(0, Math.min(1, u)) * L;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < want) lo = m; else hi = m; }
    const t = (want - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
    return [dense[lo][0] + (dense[hi][0] - dense[lo][0]) * t, dense[lo][1] + (dense[hi][1] - dense[lo][1]) * t];
  };
}
// a smooth value through keys [[frame, value], ...] (monotone cubic: no overshoot, no stop at each key; flat at both ends)
function smoothKeys(keys) {
  const n = keys.length, x = keys.map((k) => k[0]), y = keys.map((k) => k[1]);
  const d = x.slice(1).map((xi, i) => (y[i + 1] - y[i]) / (xi - x[i]));
  const m = y.map((_, i) => {
    if (i === 0 || i === n - 1 || d[i - 1] * d[i] <= 0) return 0;
    const h0 = x[i] - x[i - 1], h1 = x[i + 1] - x[i], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  });
  return (t) => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
// moved by hand in n hops: each hop eases, the piece lifts in an arc and is set down
const hops = (u, n) => {
  const v = Math.max(0, Math.min(1, u)) * n, i = Math.min(n - 1, Math.floor(v)), t = v - i;
  return {u: (i + ease(t)) / n, lift: u > 0 && u < 1 ? Math.sin(Math.PI * t) : 0};
};
// a ship on a course: where it is, which way it faces on screen, how fast, and its wake (foam rings where it was)
function sailing({along, trip, f, P, turn, i}) {
  const [lon, lat] = along(trip(f));
  const [ax, ay] = P(...along(trip(f - 6))), [bx, by] = P(...along(trip(f + 6))), [hx, hy] = P(lon, lat);
  const rad = (turn * Math.PI) / 180;
  const sx = (bx - ax) * Math.cos(rad) - (by - ay) * Math.sin(rad);
  const speed = Math.hypot(bx - ax, by - ay) / 12;
  const wake = [...Array(14)].map((_, k) => { const [qx, qy] = P(...along(trip(f - 3 - k * 3))); return {x: qx, y: qy, k}; });
  return {x: hx, y: hy, face: Math.abs(sx) < 0.3 ? 1 : Math.tanh(sx / 5), speed, wake, sail: Math.min(1, speed / 2.5), i};
}
const Wake = ({ships, op = 1}) => ships.map((sh) => sh.wake.map((w) => (
  <ellipse key={`w${sh.i}-${w.k}`} cx={w.x} cy={w.y} rx={6 + w.k * 2.2} ry={(6 + w.k * 2.2) * 0.62} fill="none" stroke="#E8F4FF"
           strokeWidth={Math.max(0.4, 2.2 - w.k * 0.12)} opacity={op * Math.min(1, sh.speed / 2) * 0.55 * (1 - w.k / 14)} />)));

// one piece on the board: (x, y) in board pixels; it stands up (counter-tilt and counter-turn), keeps its screen size, casts a soft
// shadow; lift = held above the board (px), fall = toppled (0..1)
const Piece = ({x, y, s = 1, w, h, rise = 1, fall = 0, op = 1, turn = 0, lift = 0, tilt = TILT, children}) => (
  <>
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0}}>
      <div style={{position: 'absolute', left: -w * s * 0.3, top: -h * s * 0.03, width: w * s * 0.9, height: w * s * 0.22, borderRadius: '50%',
                   background: 'rgba(0,0,0,0.55)', filter: `blur(${6 * s + lift * 0.15}px)`, opacity: rise * op * (1 - fall * 0.5) * (1 - Math.min(0.6, lift / 60)),
                   transform: `rotateZ(${-turn}deg) translate(-20%, -50%) skewX(-30deg) scale(${1 + lift / 120})`}} />
    </div>
    <div style={{position: 'absolute', left: x - (w * s) / 2, top: y - h * s, width: w * s, height: h * s, transformOrigin: '50% 100%',
                 transform: `rotateZ(${-turn}deg) rotateX(${-tilt}deg) translateY(${-lift}px) rotateZ(${fall * 84}deg) scale(${rise})`, opacity: op}}>
      <div style={{width: w, height: h, transform: `scale(${s})`, transformOrigin: '0 0'}}>{children}</div>
    </div>
  </>
);

// titles stacked top-left; one that fades out gives its place to the next by sliding (no jump)
const Title = ({f, items}) => {
  let y = 0;
  return (
    <div style={{position: 'absolute', left: 70, top: 60}}>
      {items.map(([text, at, big, out], i) => {
        const o = lerp(f, at, at + 12, 0, 1) * (out ? lerp(f, out, out + 12, 1, 0) : 1);
        const top = y;
        y += (big ? 86 : 62) * o;
        if (o <= 0.001) return null;
        return (
          <div key={i} style={{position: 'absolute', top, left: 0, whiteSpace: 'nowrap', opacity: o, transform: `translateY(${(1 - o) * 12}px)`, background: 'rgba(8,12,20,0.78)',
                               borderLeft: '6px solid #C9A227', padding: big ? '12px 22px' : '8px 18px', color: '#F4EEDC', fontFamily: 'Space Grotesk',
                               fontWeight: 700, fontSize: big ? 46 : 32, letterSpacing: 3, textTransform: 'uppercase'}}>{text}</div>
        );
      })}
    </div>
  );
};

// the table and the map under the pieces; land = the detailed St Lawrence cut + the rest of the world
const DETAILED = new Set(geo.detail.features.map((ft) => ft.properties.a3));   // a country drawn in detail: not its coarse world shape too
const OTHER = [...geo.world.features.filter((ft) => !DETAILED.has(ft.properties.a3)), ...geo.detail.features].filter((ft) => !['CAN', 'USA', 'SPM'].includes(ft.properties.a3));
const Board = ({path, children}) => (
  <svg width={PW} height={PH} style={{position: 'absolute', left: 0, top: 0}}>
    <defs>
      <radialGradient id="sea" cx="40%" cy="35%" r="80%"><stop offset="0" stopColor="#24456A" /><stop offset="1" stopColor="#0C1D38" /></radialGradient>
      <radialGradient id="land" cx="35%" cy="30%" r="90%"><stop offset="0" stopColor="#4A5A70" /><stop offset="1" stopColor="#25334C" /></radialGradient>
      <filter id="emb"><feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.55" /></filter>
      <clipPath id="landclip">{[...OTHER, ...stl.land.features].map((ft, i) => <path key={i} d={path(ft)} />)}</clipPath>
    </defs>
    <rect width={PW} height={PH} fill="url(#sea)" />
    <g filter="url(#emb)">
      {OTHER.map((ft, i) => <path key={`o${i}`} d={path(ft)} fill="url(#land)" stroke="rgba(235,244,255,0.55)" strokeWidth={1.2} />)}
      {stl.land.features.map((ft, i) => <path key={i} d={path(ft)} fill="url(#land)" stroke="rgba(235,244,255,0.65)" strokeWidth={1.6} />)}
    </g>
    <path d={path(stl.rivers)} fill="none" stroke="#5FB7E6" strokeWidth={2.4} opacity={0.8} />
    {children}
  </svg>
);
const Table = ({children, turn, lit, overlay, tilt = TILT}) => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 30%, #2A2420 0%, #0B0907 75%)'}}>
    <div style={{position: 'absolute', left: (W - PW) / 2, top: (H - PH) / 2, width: PW, height: PH, transformStyle: 'preserve-3d', opacity: lit,
                 transform: `perspective(1900px) rotateX(${tilt}deg) rotateZ(${turn}deg)`}}>
      <div style={{position: 'absolute', left: -140, top: -140, width: PW + 280, height: PH + 280, borderRadius: 18,
                   background: 'linear-gradient(135deg, #5A3A22, #2E1C10 60%, #1A0F08)', boxShadow: '0 40px 120px rgba(0,0,0,0.8)'}} />
      {children}
    </div>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 45% 35%, rgba(255,214,150,0.16), rgba(0,0,0,0) 55%)', mixBlendMode: 'screen'}} />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.7) 100%)'}} />
    {overlay}
    <div style={{position: 'absolute', right: 28, bottom: 20, fontFamily: 'Space Grotesk', fontSize: 15, color: 'rgba(200,190,170,0.5)'}}>Map data: Natural Earth (public domain)</div>
  </AbsoluteFill>
);
// camera keys [frame, [lon, lat], zoom]: log zoom; the centre moves with the zoom so the target stays in view
function cameraAt(f, keys) {
  let cam = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const [a, ca, za] = keys[i - 1], [b, cb, zb] = keys[i];
    if (f >= a) {
      const e = lerp(f, a, b, 0, 1);
      const zz = Math.exp(Math.log(za) + (Math.log(zb) - Math.log(za)) * e);
      const w = za === zb ? e : (1 / zz - 1 / za) / (1 / zb - 1 / za);
      cam = [b, [ca[0] + (cb[0] - ca[0]) * w, ca[1] + (cb[1] - ca[1]) * w], zz];
    }
  }
  return cam;
}
function xy([x, y]) {
  return {x, y};
}
const NF_VIEW = [[-77.5, 46.2], 1.45];   // the end of the 1608 scene: all of New France, with the ocean and some of the world round it
const NEW_FRANCE = [[-57.2, 51.4], [-64.0, 52.5], [-72.0, 51.5], [-79.0, 50.2], [-84.0, 49.6], [-90.0, 49.5], [-95.2, 49.0], [-95.2, 48.0], [-93.8, 47.22],
  [-93.32, 46.95], [-93.54, 46.69], [-94.19, 46.38], [-94.35, 46.09], [-94.24, 45.73], [-94.11, 45.46], [-93.32, 45.15], [-93.03, 44.87], [-92.58, 44.61],
  [-91.95, 44.34], [-91.65, 44.07], [-91.28, 43.8], [-91.25, 43.46], [-91.16, 43.2], [-89.0, 42.5], [-87.5, 41.7], [-83.4, 41.7], [-79.5, 42.9], [-76.5, 43.4],
  [-75.2, 44.6], [-73.4, 45.0], [-71.0, 45.2], [-69.5, 46.6], [-67.5, 47.6], [-64.8, 47.2], [-61.5, 46.9], [-60.0, 45.6], [-59.4, 46.6], [-60.8, 48.4], [-59.2, 50.2]];
const ringFeature = (ring) => {
  let ft = {type: 'Polygon', coordinates: [[...ring, ring[0]]]};
  if (geoArea(ft) > 2 * Math.PI) ft = {type: 'Polygon', coordinates: [[...ring, ring[0]].reverse()]};
  return ft;
};

// ───── after the map (Bassel: "a small animation, not very cartoonish but a bit more animated"): a real painting brought to life.
// Ambroise-Louis Garneray, "The founding of Quebec by Samuel de Champlain in 1608" (1848), public domain (Wikimedia Commons). The water
// shimmers (moving noise displaces it), the flags ripple, mist drifts along the far shore, a few birds cross, the camera pushes in.
const PAINT = {src: 'photos/quebec1608.jpg', w: 1260, h: 814};
function PaintingCoda({f, len = 200}) {
  const k = W / PAINT.w, ph = PAINT.h * k;   // fitted to the width; the camera moves over it
  const z = lerp(f, 0, len, 1.06, 1.2, Easing.inOut(Easing.sin));
  const fx = lerp(f, 0, len, 960, 1100, Easing.inOut(Easing.sin)), fy = lerp(f, 0, len, 560, 600, Easing.inOut(Easing.sin));
  const img = <image href={staticFile(PAINT.src)} x={0} y={0} width={W} height={ph} preserveAspectRatio="none" />;
  const R = (x, y, w, h) => ({x: x * k, y: y * k, width: w * k, height: h * k});
  const birds = [[0.0, 210, 1.0], [0.08, 240, 0.8], [0.15, 190, 0.7]];
  return (
    <AbsoluteFill style={{background: '#0B0907'}}>
      <svg width={W} height={H}>
        <defs>
          <filter id="water" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.004 0.06" numOctaves="2" seed="4" result="n" />
            <feOffset in="n" dx={f * 1.4} dy={0} result="m" />
            <feDisplacementMap in="SourceGraphic" in2="m" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="cloth" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="turbulence" baseFrequency="0.035 0.02" numOctaves="2" seed="9" result="n" />
            <feOffset in="n" dx={f * 3.2} dy={Math.sin(f / 9) * 6} result="m" />
            <feDisplacementMap in="SourceGraphic" in2="m" scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <clipPath id="cWater"><path d={`M ${300 * k} ${350 * k} L ${1150 * k} ${350 * k} L ${1150 * k} ${470 * k} L ${700 * k} ${560 * k} L ${560 * k} ${640 * k} L ${330 * k} ${640 * k} L ${300 * k} ${520 * k} Z`} /></clipPath>
          <clipPath id="cFlags"><rect {...R(770, 145, 150, 150)} /><rect {...R(990, 262, 135, 105)} /><rect {...R(985, 478, 130, 95)} /></clipPath>
          <linearGradient id="mist" x1="0" x2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0" /><stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.5" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></linearGradient>
        </defs>
        <g transform={`translate(${W / 2} ${H / 2}) scale(${z}) translate(${-fx} ${-fy})`}>
          {img}{/* still (Bassel, 10-27: the moving water and flags made the picture look broken): only the slow push */}
        </g>
      </svg>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'}} />
      <div style={{position: 'absolute', left: 70, bottom: 60, background: 'rgba(8,12,20,0.72)', borderLeft: '6px solid #C9A227', padding: '10px 18px',
                   color: '#F4EEDC', fontFamily: 'Space Grotesk', opacity: lerp(f, 10, 24, 0, 1)}}>
        <div style={{fontSize: 30, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase'}}>The founding of Quebec, 1608</div>
        <div style={{fontSize: 18, opacity: 0.8, marginTop: 4}}>As imagined by Ambroise-Louis Garneray, 1848 (public domain, Wikimedia Commons)</div>
      </div>
    </AbsoluteFill>
  );
}

// ───────── Quebec, 1608: Champlain sails from Honfleur; the Habitation goes up; trade with the First Nations; New France spreads
// Bassel (10-27 18:48): the camera stays on the ships the whole way, slower, in by the water, and the land seen more from above. The
// route is checked against the board's own land (scratchpad route_check.py): out of the Seine and round the Cotentin and Ushant, south
// of Newfoundland, the Cabot Strait, the middle of the estuary, east of Ile aux Coudres, north of Ile d'Orleans, to the narrows. The
// lead ship keeps an even pace on screen (brisk over the open ocean, slower in the Gulf and the river; scratchpad sim1608.py), the camera
// zooms in as it goes and the table flattens; once they anchor the camera goes down to the town (the old timing from there on: g).
const ROUTE_1608 = [[0.23, 49.45], [-0.5, 49.62], [-1.6, 49.92], [-3.2, 49.75], [-5.6, 48.8], [-12, 48.1], [-25, 47.2], [-38, 46.5], [-48, 46.0],
  [-53.3, 46.15], [-56.6, 46.45], [-58.8, 46.95], [-59.9, 47.3], [-61.6, 48.3], [-64.0, 49.15], [-66.5, 49.3], [-68.3, 48.75], [-69.0, 48.42],
  [-69.6, 48.0], [-69.75, 47.8], [-70.03, 47.6], [-70.2, 47.39], [-70.4, 47.3], [-70.52, 47.15], [-70.66, 47.05], [-70.8, 47.035], [-70.87, 47.038],
  [-70.957, 47.0], [-71.043, 46.943], [-71.12, 46.896], [-71.18, 46.845], [-71.205, 46.828]];
const SAIL_1608 = smoothKeys([[16, 0], [20, 0.00001], [30, 0.00151], [40, 0.00888], [50, 0.02205], [60, 0.03755], [70, 0.05475], [80, 0.07357],
  [90, 0.09553], [100, 0.1305], [110, 0.17931], [120, 0.24407], [130, 0.33178], [140, 0.4411], [150, 0.54337], [160, 0.63806], [170, 0.72496],
  [180, 0.78259], [190, 0.81649], [200, 0.84035], [210, 0.85886], [220, 0.87437], [230, 0.88799], [240, 0.9003], [250, 0.91163], [260, 0.92199],
  [270, 0.9303], [280, 0.9372], [290, 0.94322], [300, 0.94863], [310, 0.95359], [320, 0.95819], [330, 0.96249], [340, 0.96654], [350, 0.97013],
  [360, 0.9731], [370, 0.9757], [380, 0.97806], [390, 0.98025], [400, 0.98231], [410, 0.98425], [420, 0.98611], [430, 0.98788], [440, 0.98958],
  [450, 0.9912], [460, 0.99268], [470, 0.99402], [480, 0.99527], [490, 0.99647], [500, 0.99761], [510, 0.99849], [520, 0.99905], [530, 0.9994],
  [540, 0.99962], [560, 1]]);
const ZOOM_1608 = smoothKeys([[0, 5.5], [0.0854, 4.0], [0.35, 1.6], [0.7262, 2.2], [0.818, 5.0], [0.918, 9.0], [0.967, 18.0], [0.991, 32.0], [1, 40.0]]
  .map(([u, z]) => [u, Math.log(z)]));
const ANCHOR_1608 = 550, D1608 = 374;   // the camera leaves the ships at 550; it is down at the town at 610 = the old frame 236
function Quebec1608({f}) {
  const g = f - D1608;
  const base = geoMercator().fitExtent([[700, 650], [PW - 700, PH - 650]], {type: 'MultiPoint', coordinates: [[-74, 40], [3, 54]]}).scale();
  const QC = [-71.205, 46.818];
  const along = course(ROUTE_1608);
  const trips = [0, 1].map((i) => (fr) => SAIL_1608(fr - i * 14) * (1 - i * 0.0004));
  const zf = (fr) => Math.exp(ZOOM_1608(trips[0](fr)));
  // the camera: on the lead ship (a short lag, so it sits a little ahead of the middle and never jerks), then down to the town; at the
  // end it rises to show New France
  const lagged = (fr) => {
    let lo = 0, la = 0, w = 0;
    for (let k = 2; k <= 14; k += 2) { const q = along(trips[0](fr - k)), wk = 1 / (1 + k / 6); lo += q[0] * wk; la += q[1] * wk; w += wk; }
    return [lo / w, la / w];
  };
  const cam = f < ANCHOR_1608 ? [0, lagged(f), zf(f)]
    : cameraAt(f, [[ANCHOR_1608, lagged(ANCHOR_1608), zf(ANCHOR_1608)], [236 + D1608, [QC[0] - 0.008, QC[1] + 0.012], 380], [372 + D1608, [QC[0] - 0.006, QC[1] + 0.014], 400],
                   [446 + D1608, NF_VIEW[0], NF_VIEW[1]], [580 + D1608, [NF_VIEW[0][0] - 0.6, NF_VIEW[0][1]], NF_VIEW[1] * 0.97]]);
  const turn = lerp(f, 330, 236 + D1608, 0, -24) + lerp(g, 372, 446, 0, 24);
  const tilt = lerp(f, 300, 236 + D1608, 46, 16) + lerp(g, 372, 446, 0, 10);   // Bassel: the land seen from above, not at an angle
  const z = cam[2];
  const proj = geoMercator().scale(base * z).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-600, -600], [PW + 600, PH + 600]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  const ships = [0, 1].map((i) => sailing({along, trip: trips[i], f, P, turn, i}));
  const zoomed = lerp(g, 200, 236, 0, 1) * (1 - lerp(g, 380, 420, 0, 1));   // the close pieces show only near the town
  // ashore: settlers step off and are moved up the bank in hops, staggered; then they work
  // all on the north shore (the board's own coast: the bank runs -71.216 at 46.82 to -71.196 at 46.85); they used to stand in the river
  const spots = [[-71.228, 46.829], [-71.219, 46.834], [-71.234, 46.84], [-71.214, 46.843]];
  const settlers = spots.map((sp, k) => {
    const a = 232 + k * 9, mv = hops(lerp(g, a, a + 34, 0, 1, (t) => t), 2);
    const from = [-71.206 + k * 0.003, 46.828 + k * 0.002];   // off the anchored ships
    return {x: P(from[0] + (sp[0] - from[0]) * mv.u, from[1] + (sp[1] - from[1]) * mv.u), lift: mv.lift * 30, rise: lerp(g, a - 6, a + 4, 0, 1, Easing.out(Easing.back(1.4))), k};
  });
  const houses = [[-71.224, 46.835, 0], [-71.217, 46.839, 1], [-71.229, 46.844, 2]].map(([lon, lat, i]) => ({x: P(lon, lat), build: lerp(g, 268 + i * 16, 300 + i * 16, 0, 1, Easing.out(Easing.quad)), i}));
  // the First Nations traders come down the river by canoe, and step ashore to trade furs
  const canoeU = lerp(g, 300, 352, 0, 1, Easing.out(Easing.cubic));
  const canoePath = course([[-71.12, 46.893], [-71.17, 46.86], [-71.198, 46.842]]);
  const cn = canoePath(canoeU), cnPrev = canoePath(Math.max(0, canoeU - 0.05));
  const traders = [0, 1].map((k) => {
    const mv = hops(lerp(g, 352 + k * 8, 372 + k * 8, 0, 1, (t) => t), 1);
    const a = [cn[0] - 0.004 + k * 0.006, cn[1] + 0.004], b = [-71.212 + k * 0.004, 46.847 + k * 0.003];
    return {x: P(a[0] + (b[0] - a[0]) * mv.u, a[1] + (b[1] - a[1]) * mv.u), lift: mv.lift * 26, show: g >= 352 + k * 8, k};
  });
  // New France: the land France claimed, spreading out from Quebec along the river (by the 1700s), outlined
  const spread = lerp(g, 420, 540, 0, 1, Easing.inOut(Easing.quad));
  const [qx, qy] = P(...QC);
  const nf = ringFeature(NEW_FRANCE);
  const field = (lon, lat, w, h, at) => {
    const gr = lerp(g, at, at + 26, 0, 1);
    const [x0, y0] = P(lon, lat), [x1, y1] = P(lon + w, lat - h);
    return <rect x={x0} y={y0} width={(x1 - x0) * gr} height={y1 - y0} fill="#7A8A4A" opacity={0.55 * zoomed} stroke="#B8C47A" strokeWidth={1} strokeOpacity={0.6 * zoomed} />;
  };
  const titles = [['1608: Champlain sails from Honfleur', 10, true, 220 + D1608], ['Into the Gulf of St. Lawrence', 186, false, 300], ['Up the St. Lawrence River', 312, false, 214 + D1608],
                  ['Quebec, on the St. Lawrence, 3 July 1608', 232 + D1608, true, 440 + D1608], ['Trade with the First Nations', 330 + D1608, false, 396 + D1608],
                  ['New France grows along the river', 404 + D1608]];
  return (
    <Table turn={turn} tilt={tilt} lit={lerp(f, 0, 24, 0, 1)} overlay={<Title f={f} items={titles} />}>
      <Board path={path}>
        {field(-71.25, 46.85, 0.012, 0.007, 330)}{field(-71.236, 46.855, 0.01, 0.006, 340)}{field(-71.222, 46.858, 0.012, 0.006, 350)}
        <Wake ships={ships} op={1 - lerp(g, 214, 236, 0, 1)} />
        {g > 300 && g < 380 && <Wake ships={[{i: 9, speed: (1 - canoeU) * 3, wake: [...Array(8)].map((_, k) => ({x: P(...canoePath(Math.max(0, canoeU - (k + 1) * 0.03)))[0], y: P(...canoePath(Math.max(0, canoeU - (k + 1) * 0.03)))[1], k}))}]} />}
        {spread > 0 && (
          <g clipPath="url(#landclip)">
            <defs>
              <radialGradient id="growg" cx={qx} cy={qy} r={Math.max(1, spread * 1500)} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFF" /><stop offset="0.72" stopColor="#FFF" /><stop offset="1" stopColor="#FFF" stopOpacity="0" />
              </radialGradient>
              <mask id="grow" maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={PW + 4000} height={PH + 4000}><rect x={-2000} y={-2000} width={PW + 4000} height={PH + 4000} fill="url(#growg)" /></mask>
            </defs>
            <g mask="url(#grow)">
              <path d={path(nf)} fill="#3FB8DE" fillOpacity={0.42} />
              <path d={path(nf)} fill="none" stroke="#F4FBFF" strokeWidth={5} strokeLinejoin="round" />
            </g>
          </g>
        )}
        {zoomed > 0.01 && (() => { const [px, py] = P(-71.228, 46.824);   // where this is (Israa): a pin by the settlement, its name clear of the pieces
          return <g opacity={zoomed}><circle cx={px} cy={py} r={12} fill="#FF6A3D" stroke="#F2F7FF" strokeWidth={3} />
            <text x={px - 26} y={py + 10} textAnchor="end" style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 44, letterSpacing: 4, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: 9}}>QUÉBEC</text></g>; })()}
        {spread > 0.25 && <text x={P(-80, 47.6)[0]} y={P(-80, 47.6)[1]} textAnchor="middle" opacity={lerp(g, 470, 490, 0, 1)}
                                 style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 64, letterSpacing: 10, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: 10}}>NEW FRANCE</text>}
      </Board>
      {/* pieces, back to front */}
      {houses.map((h) => <Piece key={`h${h.i}`} {...xy(h.x)} turn={turn} tilt={tilt} s={0.95} w={150} h={190} op={zoomed} rise={h.build > 0 ? 1 : 0}><House build={h.build} f={g + h.i * 13} /></Piece>)}
      {g >= 316 && <Piece {...xy(P(-71.221, 46.846))} turn={turn} tilt={tilt} s={0.9} w={80} h={200} op={zoomed} rise={lerp(g, 316, 326, 0, 1)}><Pole flag={<Bourbon />} f={f} raise={lerp(g, 320, 350, 0, 1, Easing.out(Easing.cubic))} /></Piece>}
      {settlers.map((st) => g >= 226 + st.k * 9 && (
        <Piece key={`s${st.k}`} {...xy(st.x)} turn={turn} tilt={tilt} s={0.82} w={120} h={200} op={zoomed} rise={st.rise} lift={st.lift}>
          <Settler k={st.k} tool={st.k % 2 ? 'bundle' : 'axe'} swing={st.k % 2 ? 0 : Math.max(0, Math.sin((g - 280 - st.k * 7) / 5)) * (g > 280 ? 1 : 0)} />
        </Piece>))}
      {traders.map((t) => t.show && (
        <Piece key={`t${t.k}`} {...xy(t.x)} turn={turn} tilt={tilt} s={0.82} w={120} h={200} op={zoomed} lift={t.lift} rise={lerp(g, 352 + t.k * 8, 360 + t.k * 8, 0, 1)}><Trader k={t.k} /></Piece>))}
      {g >= 300 && g < 400 && <Piece {...xy(P(...cn))} turn={turn} tilt={tilt} s={0.9} w={200} h={110} op={zoomed * lerp(g, 300, 312, 0, 1)} lift={Math.sin(f / 9) * 2}>
        <Canoe f={f} face={P(...cn)[0] >= P(...cnPrev)[0] ? 1 : -1} /></Piece>}
      {ships.map((sh) => (
        <Piece key={`sh${sh.i}`} x={sh.x} y={sh.y} turn={turn} tilt={tilt} s={lerp(g, 200, 236, 0.62, 0.9)} w={170} h={210} op={lerp(f, sh.i * 10, 18 + sh.i * 10, 0, 1) * (1 - lerp(g, 384, 410, 0, 1))} lift={Math.sin((f + sh.i * 11) / 13) * 2}>
          <Ship team="fr" face={sh.face} sail={g > 214 ? lerp(g, 214, 240, sh.sail, 0) : sh.sail} roll={Math.sin((f + sh.i * 17) / 16) * (1.2 + sh.speed * 0.5)} />
        </Piece>))}
    </Table>
  );
}

// ───────── Quebec, 1759 (the first sample): the British fleet, the Plains of Abraham, Quebec changes hands
function Quebec1759({f}) {
  const base = geoMercator().fitExtent([[720, 650], [PW - 720, PH - 650]], {type: 'MultiPoint', coordinates: [[-75, 44.5], [-57, 50.3]]}).scale();
  const route = [[-59.6, 47.7], [-63.6, 49.15], [-67.2, 48.95], [-69.6, 47.95], [-70.55, 47.18], [-71.0, 46.88], [-71.18, 46.8], [-71.27, 46.772]];
  const along = course(route);
  const trips = [0, 1, 2].map((i) => (fr) => interpolate(fr, [14 + i * 14, 206 - i * 6], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)}) * (1 - i * 0.022));
  const lagged = (fr) => {
    let lo = 0, la = 0, w = 0;
    for (let k = 0; k <= 30; k += 3) { const q = along(trips[0](fr - 10 - k)), wk = 1 / (1 + k / 8); lo += q[0] * wk; la += q[1] * wk; w += wk; }
    return [lo / w + 0.9, la / w + 0.25];
  };
  const cam = f < 140 ? [0, lagged(f), lerp(f, 0, 140, 1, 1.5)] : cameraAt(f, [[140, lagged(140), 1.5], [225, [-71.25, 46.815], 34], [390, [-71.25, 46.815], 36]]);
  const turn = lerp(f, 140, 225, 0, -78), z = cam[2];
  const proj = geoMercator().scale(base * z).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-600, -600], [PW + 600, PH + 600]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  const ships = [0, 1, 2].map((i) => sailing({along, trip: trips[i], f, P, turn, i}));
  const rows = [46.802, 46.818, 46.834, 46.85];
  const ukMove = hops(lerp(f, 246, 282, 0, 1, (t) => t), 2), frMove = hops(lerp(f, 250, 284, 0, 1, (t) => t), 2);
  const ukX = -71.3 + 0.015 * ukMove.u, frX = -71.222 - 0.023 * frMove.u;
  const retreat = hops(lerp(f, 326, 352, 0, 1, (t) => t), 2);
  const fireUK = lerp(f, 292, 300, 0, 1) - lerp(f, 300, 312, 0, 1), fireFR = lerp(f, 286, 294, 0, 1) - lerp(f, 294, 306, 0, 1);
  const flag = f < 353 ? <Bourbon /> : <Union1606 />;
  return (
    <Table turn={turn} lit={lerp(f, 0, 30, 0, 1)} overlay={<Title f={f} items={[['Quebec, 1759', 12, true], ['The Plains of Abraham, 13 September', 228], ['Quebec falls to Britain', 352]]} />}>
      <Board path={path}><Wake ships={ships} op={1 - lerp(f, 206, 230, 0, 1)} /></Board>
      <Piece {...xy(P(-71.207, 46.813))} turn={turn} s={1.15} w={80} h={200} rise={lerp(f, 196, 214, 0, 1)}><Pole flag={flag} f={f} raise={f < 353 ? 1 - lerp(f, 330, 352, 0, 1) : lerp(f, 355, 380, 0, 1)} /></Piece>
      {rows.map((lat, i) => f >= 232 + i * 4 && (
        <Piece key={`fr${i}`} {...xy(P(frX + (i === 1 || i === 2 ? 0 : 0.03 * retreat.u), lat))} turn={turn} w={120} h={200} lift={(frMove.lift + (i === 1 || i === 2 ? 0 : retreat.lift)) * 26}
               rise={lerp(f, 232 + i * 4, 248 + i * 4, 0, 1, Easing.out(Easing.back(1.6)))} fall={i === 1 || i === 2 ? lerp(f, 308 + i * 5, 330 + i * 5, 0, 1, Easing.out(Easing.bounce)) : 0}>
          <Soldier team="fr" fire={fireFR} /></Piece>))}
      {ships.map((sh) => <Piece key={`sh${sh.i}`} x={sh.x} y={sh.y} turn={turn} s={0.75} w={170} h={210} lift={Math.sin((f + sh.i * 11) / 13) * 2}>
        <Ship team="uk" face={sh.face} sail={f > 206 ? lerp(f, 206, 230, sh.sail, 0) : sh.sail} roll={Math.sin((f + sh.i * 17) / 16) * (1.2 + sh.speed * 0.5)} /></Piece>)}
      {rows.map((lat, i) => f >= 226 + i * 4 && (
        <Piece key={`uk${i}`} {...xy(P(ukX - fireUK * 0.002, lat))} turn={turn} w={120} h={200} lift={ukMove.lift * 26} rise={lerp(f, 226 + i * 4, 242 + i * 4, 0, 1, Easing.out(Easing.back(1.6)))}>
          <Soldier team="uk" fire={fireUK} /></Piece>))}
      {[0, 1, 2, 3].map((i) => f > 286 && f < 330 && (
        <Piece key={`sm${i}`} {...xy(P(i % 2 ? ukX + 0.008 : frX - 0.008, rows[i]))} turn={turn} w={140} h={120}><Smoke k={lerp(f, 286 + i * 3, 326 + i * 3, 0, 1, Easing.out(Easing.quad))} /></Piece>))}
    </Table>
  );
}

// ───────── Saint-Domingue, the 1700s: sugar, worked by enslaved Africans (Bassel, 10-27: "people cultivating sugarcane ... show the labour
// as it is"; the owner: real, like a chess thing, never the Storygraphics cast). Carved pieces, no violence shown. Israa's redo: tall
// cane that falls to stubble as it is cut, workers bent over cutting, a row carrying bundles to a cattle mill (oxen walk the beam
// round), the overseer apart in a pale coat with a coiled whip; a slow camera, low light, nothing bounces.
const WOOD = ['#5A4A38', '#2E2418', '#86745E'];
const SKIN_D = ['#5E3A26', '#2E1A10', '#8A5A3E'];
const CLOTH = [['#8C6A48', '#4E3A26', '#B08C68'], ['#6E6A5A', '#3E3A30', '#9A9686'], ['#7A5E42', '#45331F', '#A2845F'], ['#5E5648', '#322C22', '#8A806C']];
const WoodBase = ({id}) => (
  <g><defs><linearGradient id={id} x1="0" x2="1"><stop offset="0" stopColor={WOOD[2]} /><stop offset="0.4" stopColor={WOOD[0]} /><stop offset="1" stopColor={WOOD[1]} /></linearGradient></defs>
    <path d="M 10 168 L 10 182 C 10 196 110 196 110 182 L 110 168 Z" fill={`url(#${id})`} /><ellipse cx={60} cy={168} rx={50} ry={11} fill={WOOD[0]} stroke={WOOD[1]} strokeWidth={1.5} /></g>
);
// an enslaved worker: earth-toned clothes, bent over the cane (cut 0..1 = the knife's stroke), or upright with a bundle on the shoulder
const Worker = ({k = 0, cut = 0, carry = false}) => {
  const cl = CLOTH[k % 4];
  const bend = carry ? 4 : 18 + cut * 10;
  return (
    <svg width={120} height={200} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
      <defs><Lacquer id={`wk${k}`} c={cl[0]} dark={cl[1]} light={cl[2]} /><Lacquer id={`wsk${k}`} c={SKIN_D[0]} dark={SKIN_D[1]} light={SKIN_D[2]} /></defs>
      <WoodBase id={`wb${k}`} />
      <path d="M 42 166 L 46 120 L 58 120 L 56 166 Z M 64 166 L 62 120 L 74 120 L 78 166 Z" fill={`url(#wk${k})`} stroke={cl[1]} strokeWidth={1} />
      <g transform={`rotate(${bend} 60 122)`}>
        <path d="M 40 124 C 40 104 44 92 48 84 L 72 84 C 76 92 80 104 80 124 Z" fill={`url(#wk${k})`} stroke={cl[1]} strokeWidth={1.2} />
        <circle cx={60} cy={70} r={14} fill={`url(#wsk${k})`} stroke={SKIN_D[1]} strokeWidth={1} />
        {k % 2 === 0 && <path d="M 46 66 C 46 52 74 52 74 66 C 67 60 53 60 46 66 Z" fill={cl[2]} stroke={cl[1]} strokeWidth={1} />}
        {carry
          ? <g transform="rotate(-24 60 80)">{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={22 + (i % 3) * 3} y={58 + i * 3.4} width={84} height={5} rx={2} fill={i % 2 ? '#8AA452' : '#6E8A3A'} stroke="#3E5A22" strokeWidth={0.8} />)}</g>
          : <g transform={`rotate(${-70 + cut * 120} 72 98)`}><path d="M 70 98 L 72 72" stroke={SKIN_D[0]} strokeWidth={7} strokeLinecap="round" />
              <rect x={70} y={58} width={5} height={16} rx={2} fill="#4A3020" /><path d="M 68 60 L 78 60 L 88 22 L 80 20 Z" fill="#AEB6BC" stroke="#4E565C" strokeWidth={0.8} /></g>}
      </g>
    </svg>
  );
};
// the overseer, set apart: a pale coat, a dark hat, a coiled whip hanging from his hand (shown, never used)
const Overseer = () => (
  <svg width={120} height={220} viewBox="0 0 120 220" style={{overflow: 'visible'}}>
    <defs><Lacquer id="ovc" c="#D8CCB0" dark="#8E8268" light="#F4ECD8" /><Skin id="ovs" /><Lacquer id="ovh" c="#2A2622" dark="#0C0A08" light="#6A625A" /></defs>
    <path d="M 0 196 L 0 206 C 0 220 120 220 120 206 L 120 196 Z" fill="#4A3C2A" /><ellipse cx={60} cy={196} rx={60} ry={14} fill="#6A5A40" />
    <path d="M 10 170 L 10 182 C 10 196 110 196 110 182 L 110 170 Z" fill={WOOD[1]} /><ellipse cx={60} cy={170} rx={50} ry={11} fill={WOOD[0]} />
    <path d="M 44 168 L 46 126 L 58 126 L 56 168 Z M 64 168 L 62 126 L 74 126 L 76 168 Z" fill="#3A3028" />
    <path d="M 34 132 C 34 106 40 92 46 82 L 74 82 C 80 92 86 106 86 132 Z" fill="url(#ovc)" stroke="#8E8268" strokeWidth={1.2} />
    <circle cx={60} cy={66} r={15} fill="url(#ovs)" stroke="#6E4630" strokeWidth={1} />
    <path d="M 40 56 C 46 42 74 42 80 56 C 70 52 50 52 40 56 Z" fill="url(#ovh)" /><path d="M 44 54 C 52 38 68 38 76 54" fill="url(#ovh)" />
    <path d="M 84 104 C 96 110 98 124 90 130 C 82 136 74 126 82 118 C 88 112 96 118 92 124" fill="none" stroke="#2A1C10" strokeWidth={2.6} />
  </svg>
);
// sugar cane: a clump of tall jointed stalks with long leaves, or the stubble left once it is cut
const Cane = ({cut = false, sway = 0}) => (
  <svg width={70} height={170} viewBox="0 0 70 170" style={{overflow: 'visible'}}>
    {cut ? <g>{[16, 28, 40, 52].map((x, i) => <rect key={i} x={x} y={150 - (i % 2) * 4} width={5} height={14 + (i % 2) * 4} fill="#A89060" stroke="#6E5A34" strokeWidth={0.8} />)}
      {[0, 1, 2].map((i) => <path key={'l' + i} d={`M ${12 + i * 18} 166 l 16 -4`} stroke="#9A8A4E" strokeWidth={2} />)}</g>
      : <g transform={`rotate(${sway} 35 166)`}>{[12, 22, 32, 42, 52].map((x, i) => {
          const top = 18 + (i % 3) * 10;
          return <g key={i}><rect x={x} y={top} width={5} height={166 - top} fill={i % 2 ? '#8CA44E' : '#A2B65A'} stroke="#4E6228" strokeWidth={0.8} />
            {[0, 1, 2, 3].map((j) => <rect key={j} x={x - 0.5} y={top + 26 + j * 30} width={6} height={2.5} fill="#5E7230" />)}
            <path d={`M ${x + 2} ${top + 4} q ${i % 2 ? 22 : -22} -6 ${i % 2 ? 30 : -30} 14`} fill="none" stroke="#5E8A38" strokeWidth={4} strokeLinecap="round" />
            <path d={`M ${x + 2} ${top + 30} q ${i % 2 ? -20 : 20} -4 ${i % 2 ? -28 : 28} 12`} fill="none" stroke="#4A7A2A" strokeWidth={3.5} strokeLinecap="round" /></g>; })}</g>}
  </svg>
);
// the mill house of a cattle mill: rollers under a thatched roof (the beam and the oxen go round it on the board)
const MillHouse = () => (
  <svg width={170} height={200} viewBox="0 0 170 200" style={{overflow: 'visible'}}>
    <defs><linearGradient id="mhw" x1="0" x2="1"><stop offset="0" stopColor="#A88A5E" /><stop offset="0.6" stopColor="#7A5E3A" /><stop offset="1" stopColor="#4A3620" /></linearGradient></defs>
    <path d="M 20 176 L 20 186 C 20 198 150 198 150 186 L 150 176 Z" fill={WOOD[1]} /><ellipse cx={85} cy={176} rx={65} ry={12} fill={WOOD[0]} />
    <rect x={44} y={96} width={82} height={80} fill="url(#mhw)" stroke="#3A2A16" strokeWidth={1.2} />
    {[0, 1, 2].map((i) => <rect key={i} x={56 + i * 20} y={132} width={14} height={44} rx={6} fill="#5A4630" stroke="#2E2214" />)}
    <path d="M 30 100 L 85 46 L 140 100 Z" fill="#B89A58" stroke="#6E5A30" strokeWidth={1.2} />
    {[0, 1, 2, 3].map((i) => <path key={i} d={`M ${44 + i * 14} ${88 - i * 8} L ${126 - i * 14} ${88 - i * 8}`} stroke="#8E7440" strokeWidth={2} />)}
  </svg>
);
const Ox = ({face = 1, step = 0}) => (
  <svg width={140} height={110} viewBox="0 0 140 110" style={{overflow: 'visible'}}>
    <defs><Lacquer id="oxc" c="#7A5A3A" dark="#3E2A18" light="#A8845E" /></defs>
    <ellipse cx={70} cy={100} rx={46} ry={8} fill="rgba(0,0,0,0.3)" />
    <g transform={`translate(70 0) scale(${face} 1) translate(-70 0)`}>
      {[34, 50, 90, 104].map((x, i) => <rect key={i} x={x} y={66} width={8} height={30 + (i % 2 ? step : -step) * 2} fill="#4A3220" />)}
      <ellipse cx={70} cy={58} rx={44} ry={22} fill="url(#oxc)" stroke="#3E2A18" strokeWidth={1.2} />
      <path d="M 108 52 C 120 46 130 50 132 60 C 132 70 122 74 112 70 Z" fill="url(#oxc)" stroke="#3E2A18" />
      <path d="M 118 46 C 116 36 124 34 128 38 M 112 48 C 106 38 112 34 116 38" fill="none" stroke="#E8DCC0" strokeWidth={3} />
    </g>
  </svg>
);
const Palm = ({f}) => (   // a carved palm on a small base; the fronds sway a little
  <svg width={120} height={220} viewBox="0 0 120 220" style={{overflow: 'visible'}}>
    <path d="M 20 196 L 20 206 C 20 216 100 216 100 206 L 100 196 Z" fill={WOOD[1]} /><ellipse cx={60} cy={196} rx={40} ry={9} fill={WOOD[0]} />
    <path d="M 56 196 C 54 150 60 110 66 70 L 72 70 C 66 110 62 150 64 196 Z" fill="#8A6A44" stroke="#4E3A22" strokeWidth={1} />
    <g transform={`translate(69 70) rotate(${Math.sin(f / 14) * 4})`}>
      {[-150, -110, -70, -30, 10, 50].map((a, i) => <path key={i} d={`M 0 0 Q ${Math.cos((a * Math.PI) / 180) * 30} ${Math.sin((a * Math.PI) / 180) * 30 - 14} ${Math.cos((a * Math.PI) / 180) * 56} ${Math.sin((a * Math.PI) / 180) * 56 + 10}`} stroke={i % 2 ? '#5E8A38' : '#4A7A2A'} strokeWidth={9} fill="none" strokeLinecap="round" />)}
    </g>
  </svg>
);
const Barrel = () => (
  <svg width={60} height={80} viewBox="0 0 60 80" style={{overflow: 'visible'}}>
    <path d="M 10 18 C 6 36 6 52 10 70 L 50 70 C 54 52 54 36 50 18 Z" fill="#9A6A3A" stroke="#4A2E16" strokeWidth={1.2} />
    {[26, 44, 62].map((y) => <path key={y} d={`M 9 ${y} L 51 ${y}`} stroke="#3A2A1A" strokeWidth={2.4} />)}
    <ellipse cx={30} cy={18} rx={20} ry={5} fill="#B8864E" stroke="#4A2E16" />
  </svg>
);
function Sugar({f}) {
  const base = geoMercator().fitExtent([[700, 650], [PW - 700, PH - 650]], {type: 'MultiPoint', coordinates: [[-74.6, 17.6], [-68.2, 20.1]]}).scale();
  const C = [-72.28, 19.64];
  // down close on the cutters at work, then along the track to the mill where the bundles arrive
  const cam = cameraAt(f, [[0, [-72.6, 19.0], 1.0], [34, [-72.6, 19.0], 1.04], [126, [C[0] - 0.034, C[1] + 0.001], 96], [210, [C[0] - 0.027, C[1] + 0.001], 98],
    [300, [C[0] + 0.018, C[1] + 0.001], 82], [360, [C[0] + 0.021, C[1] + 0.001], 82]]);
  const turn = lerp(f, 34, 126, 0, -14);
  const proj = geoMercator().scale(base * cam[2]).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-600, -600], [PW + 600, PH + 600]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  const close = lerp(f, 92, 126, 0, 1);
  const rise = (at) => lerp(f, at, at + 14, 0, 1, Easing.out(Easing.cubic));   // set down, no bounce
  const hti = geo.detail.features.find((ft) => ft.properties.a3 === 'HTI') || geo.world.features.find((ft) => ft.properties.a3 === 'HTI');
  // the field: 5 rows of cane, 10 clumps a row; the cutters work along each row from the left (stubble behind them)
  const L0 = C[0] - 0.05, L1 = C[0] + 0.012, rows = [0, 1, 2, 3, 4].map((r) => C[1] + 0.016 - r * 0.0075);
  const cutAt = (r) => lerp(f, 130 + r * 6, 350, 0.12, 0.6, (t) => t) + (r % 2) * 0.03;
  const clumps = [];
  rows.forEach((lat, r) => [...Array(10)].forEach((_, c) => {
    const u = (c + 0.5) / 10;
    clumps.push({x: P(L0 + (L1 - L0) * u, lat - 0.002), cut: u < cutAt(r), r, c});
  }));
  const cutters = rows.map((lat, r) => {
    const u = cutAt(r);
    return {x: P(L0 + (L1 - L0) * u - 0.0025, lat - 0.0045), cut: Math.max(0, Math.sin((f - r * 9) / 7)), k: r, at: 112 + r * 6};
  });
  // the cattle mill: the beam turns, two oxen walk its ends round the mill house
  const MILL = [C[0] + 0.03, C[1] + 0.004];
  const ang = (f - 100) * 0.018, R0 = 0.0085;
  const oxen = [0, Math.PI].map((d, i) => {
    const a = ang + d, lon = MILL[0] + Math.cos(a) * R0 * 1.06, lat = MILL[1] + Math.sin(a) * R0;
    const [x1] = P(MILL[0] + Math.cos(a + 0.05) * R0, lat);
    const [x0] = P(lon, lat);
    return {x: P(lon, lat), face: x1 >= x0 ? 1 : -1, step: Math.sin(f / 4 + i), i};
  });
  // carriers: a row of three bring bundles from the field to the mill and walk back, moved like pieces in hops
  const carriers = [0, 1, 2].map((k) => {
    const period = 100, t0 = 150 + k * 32, ph = f < t0 ? 0 : ((f - t0) % period) / period;
    const go = ph < 0.5, mv = hops(go ? ph * 2 : (ph - 0.5) * 2, 2);
    const A = [L1 + 0.004, C[1] - 0.003 - k * 0.006], B = [MILL[0] - 0.012, MILL[1] - 0.004 - k * 0.004];
    const u = go ? mv.u : 1 - mv.u;
    return {x: P(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u), lift: mv.lift * 22, carry: go && f >= t0, show: f >= 136, k: k + 5};
  });
  const barrels = [0, 1, 2, 3, 4].map((i) => ({x: P(MILL[0] + 0.014 + (i % 3) * 0.004, MILL[1] - 0.012 - Math.floor(i / 3) * 0.004), at: 210 + i * 28}));
  const [hx, hy] = P(-73.35, 19.2);
  const G0 = P(L0 - 0.016, C[1] + 0.03), G1 = P(MILL[0] + 0.026, C[1] - 0.034);
  const palms = [[L0 - 0.012, C[1] - 0.026], [L0 + 0.01, C[1] + 0.026], [C[0] + 0.004, C[1] + 0.027], [MILL[0] + 0.02, C[1] + 0.022], [MILL[0] + 0.022, C[1] - 0.03]];
  const ring = [...Array(49)].map((_, i) => { const a = (i / 48) * 2 * Math.PI; return P(MILL[0] + Math.cos(a) * R0 * 1.06, MILL[1] + Math.sin(a) * R0); });
  const [mx, my] = P(...MILL), beam = [0, Math.PI].map((d) => P(MILL[0] + Math.cos(ang + d) * R0 * 1.06, MILL[1] + Math.sin(ang + d) * R0));
  // back to front: everything that stands on the board, sorted by its screen y
  const stand = [
    ...clumps.map((c) => ({y: c.x[1], el: <Piece key={`cn${c.r}-${c.c}`} {...xy(c.x)} turn={turn} s={1.3} w={70} h={170} op={close} rise={rise(100 + c.c * 2)}><Cane cut={c.cut} sway={Math.sin(f / 20 + c.c + c.r) * 2} /></Piece>})),
    ...cutters.map((c) => ({y: c.x[1], el: <Piece key={`w${c.k}`} {...xy(c.x)} turn={turn} s={1.35} w={120} h={200} op={close} rise={rise(c.at)}><Worker k={c.k} cut={c.cut} /></Piece>})),
    ...carriers.filter((c) => c.show).map((c) => ({y: c.x[1], el: <Piece key={`k${c.k}`} {...xy(c.x)} turn={turn} s={1.35} w={120} h={200} op={close} lift={c.lift} rise={rise(136 + c.k * 4)}><Worker k={c.k} carry={c.carry} /></Piece>})),
    ...oxen.map((o) => ({y: o.x[1], el: <Piece key={`ox${o.i}`} {...xy(o.x)} turn={turn} s={1.3} w={140} h={110} op={close} rise={rise(104)}><Ox face={o.face} step={o.step} /></Piece>})),
    {y: my, el: <Piece key="mill" x={mx} y={my} turn={turn} s={1.5} w={170} h={200} op={close} rise={rise(100)}><MillHouse /></Piece>},
    ...barrels.filter((b) => f >= b.at).map((b, i) => ({y: b.x[1], el: <Piece key={`b${i}`} {...xy(b.x)} turn={turn} s={1.0} w={60} h={80} op={close} rise={rise(b.at)}><Barrel /></Piece>})),
    ...palms.map(([lo, la], i) => { const q = P(lo, la); return {y: q[1], el: <Piece key={`p${i}`} {...xy(q)} turn={turn} s={0.8} w={120} h={220} op={close} rise={rise(98 + i * 3)}><Palm f={f + i * 9} /></Piece>}; }),
    (() => { const q = P(L0 + 0.004, C[1] + 0.021); return {y: q[1], el: <Piece key="ov" {...xy(q)} turn={turn} s={1.35} w={120} h={220} op={close} rise={rise(122)}><Overseer /></Piece>}; })(),
  ].sort((p1, p2) => p1.y - p2.y);
  return (
    <Table turn={turn} lit={lerp(f, 0, 18, 0, 1) * 0.86} overlay={<><AbsoluteFill style={{background: 'rgba(10,6,2,0.22)'}} />
      <Title f={f} items={[['Saint-Domingue, the 1700s', 6, true], ['Sugar', 100, false], ['Worked by enslaved Africans', 140, true], ['Nearly half a million enslaved by 1789', 230]]} /></>}>
      <Board path={path}>
        {hti && <g opacity={1 - close * 0.85}><path d={path(hti)} fill="#3FB8DE" fillOpacity={0.42 * lerp(f, 8, 30, 0, 1)} /><path d={path(hti)} fill="none" stroke="#F4FBFF" strokeWidth={5} strokeOpacity={lerp(f, 8, 30, 0, 1)} /></g>}
        {f < 118 && <text x={hx} y={hy} textAnchor="middle" opacity={lerp(f, 14, 30, 0, 1) * (1 - close)}
                          style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 64, letterSpacing: 8, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: 10}}>SAINT-DOMINGUE</text>}
        <rect x={G0[0]} y={G0[1]} width={G1[0] - G0[0]} height={G1[1] - G0[1]} rx={40} fill="#8C7A4E" fillOpacity={0.72 * close} stroke="#5A4A30" strokeWidth={4} strokeOpacity={close} />
        {rows.map((lat, r) => { const [x0, y0] = P(L0, lat), [x1, y1] = P(L1, lat - 0.0045);
          return <rect key={r} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#6E5A36" opacity={0.8 * close} stroke="#4E3E22" strokeWidth={1} />; })}
        <path d={`M ${P(L1 + 0.002, C[1] - 0.004)[0]} ${P(L1 + 0.002, C[1] - 0.004)[1]} L ${P(MILL[0] - 0.012, MILL[1] - 0.004)[0]} ${P(MILL[0] - 0.012, MILL[1] - 0.004)[1]}`} stroke="#A89470" strokeWidth={26} strokeLinecap="round" opacity={0.7 * close} />
        <path d={`M ${ring.map((q) => q.join(' ')).join(' L ')}`} fill="none" stroke="#A89470" strokeWidth={22} opacity={0.75 * close} />
        <path d={`M ${beam[0].join(' ')} L ${beam[1].join(' ')}`} stroke="#4A3020" strokeWidth={10} strokeLinecap="round" opacity={close} />
      </Board>
      {stand.map((p) => p.el)}
    </Table>
  );
}

// ───────── Part 2. Paris, 10 February 1763: no battle on the board: the claims change hands. French standards are lifted off New France,
// one by one from the east, and British ones set down in their place; the land turns British red; New Orleans keeps its flag (it was
// not part of it); Saint-Pierre and Miquelon, given back, keep theirs.
const R1750 = rings1750;
const tint = (path, ring, from, to, k, edge = 1) => {
  const ft = ringFeature(ring);
  return (
    <g>
      <path d={path(ft)} fill={from} fillOpacity={0.42 * (1 - k)} />
      <path d={path(ft)} fill={to} fillOpacity={0.46 * k} />
      <path d={path(ft)} fill="none" stroke="#F4FBFF" strokeWidth={4.5} strokeLinejoin="round" opacity={edge} />
    </g>
  );
};
const BoardLabel = ({P, ll, text, op = 1, size = 56}) => {
  const [x, y] = P(...ll);
  return <text x={x} y={y} textAnchor="middle" opacity={op}
               style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: size, letterSpacing: size / 7, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: size / 6}}>{text}</text>;
};
function Treaty1763({f}) {
  const base = geoMercator().fitExtent([[700, 650], [PW - 700, PH - 650]], {type: 'MultiPoint', coordinates: [[-96, 29], [-55, 52]]}).scale();
  const cam = cameraAt(f, [[0, [-79, 41.5], 1.0], [200, [-81, 40.5], 1.06], [252, [-84, 36.5], 0.98], [330, [-84.5, 36], 1.0]]);
  const turn = lerp(f, 0, 330, 4, -6, Easing.inOut(Easing.sin));
  const proj = geoMercator().scale(base * cam[2]).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-600, -600], [PW + 600, PH + 600]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  // the posts, east to west: the French standard is lifted off (in an arc, then gone), the British one set down after it
  const posts = [['Quebec', -71.21, 46.81], ['Montreal', -73.57, 45.5], ['Detroit', -83.05, 42.33], ['Kaskaskia', -89.9, 37.9]].map(([name, lon, lat], i) => {
    const off = 70 + i * 34, on = off + 22;
    const up = lerp(f, off, off + 20, 0, 1, Easing.in(Easing.quad));
    return {name, x: P(lon, lat), i, liftFr: up * 90, opFr: 1 - lerp(f, off + 12, off + 22, 0, 1), showUk: f >= on, riseUk: lerp(f, on, on + 14, 0, 1, Easing.out(Easing.cubic)), lab: P(lon, lat - 0.35)};
  });
  const canK = lerp(f, 70, 140, 0, 1), illK = lerp(f, 130, 200, 0, 1);
  const nola = P(-90.07, 29.95), spm = P(-56.3, 46.9);
  const glow = lerp(f, 236, 256, 0, 1) * (0.6 + 0.4 * Math.sin(f / 5));
  const stand = [
    ...posts.map((p) => ({y: p.x[1], el: <React.Fragment key={`p${p.i}`}>
      {p.opFr > 0 && <Piece {...xy(p.x)} turn={turn} s={1.15} w={80} h={200} lift={p.liftFr} op={p.opFr * lerp(f, 6, 26, 0, 1)}><Pole flag={<Bourbon />} f={f + p.i * 7} /></Piece>}
      {p.showUk && <Piece {...xy(p.x)} turn={turn} s={1.15} w={80} h={200} rise={p.riseUk}><Pole flag={<Union1606 />} f={f + p.i * 7} /></Piece>}
    </React.Fragment>})),
    {y: nola[1], el: <Piece key="nola" {...xy(nola)} turn={turn} s={1.15} w={80} h={200} op={lerp(f, 6, 26, 0, 1)}><Pole flag={<Bourbon />} f={f + 40} /></Piece>},
    {y: spm[1], el: <Piece key="spm" {...xy(spm)} turn={turn} s={0.9} w={80} h={200} op={lerp(f, 6, 26, 0, 1)}><Pole flag={<Bourbon />} f={f + 60} /></Piece>},
  ].sort((a, b) => a.y - b.y);
  return (
    <Table turn={turn} lit={lerp(f, 0, 20, 0, 1)} overlay={<Title f={f} items={[['Treaty of Paris, 10 February 1763', 8, true], ['Canada: to Britain', 92, false], ['East of the Mississippi: to Britain', 150, false], ['Not New Orleans', 236, false]]} />}>
      <Board path={path}>
        <g clipPath="url(#landclip)">
          {tint(path, R1750.canada, '#3FB8DE', '#C8505A', canK)}
          {tint(path, R1750.illinois, '#3FB8DE', '#C8505A', illK)}
        </g>
        <path d={path(stl.rivers)} fill="none" stroke="#5FB7E6" strokeWidth={3} opacity={0.9} />
        <BoardLabel P={P} ll={[-77, 50]} text="CANADA" op={lerp(f, 20, 40, 0, 1)} />
        <BoardLabel P={P} ll={[-85.5, 37.6]} text="EAST OF THE MISSISSIPPI" size={40} op={lerp(f, 150, 170, 0, 1)} />
        {posts.map((p) => <text key={`l${p.i}`} x={p.lab[0]} y={p.lab[1] + 40} textAnchor="middle" opacity={lerp(f, 20, 40, 0, 1) * 0.9}
                                style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 30, letterSpacing: 2, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: 7}}>{p.name}</text>)}
        <circle cx={nola[0]} cy={nola[1]} r={46} fill="none" stroke="#FFD166" strokeWidth={6} opacity={glow} />
        <text x={nola[0] + 60} y={nola[1] + 12} opacity={lerp(f, 20, 40, 0, 1)}
              style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 34, letterSpacing: 2, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: 8}}>New Orleans</text>
      </Board>
      {stand.map((p) => p.el)}
    </Table>
  );
}

// ───────── Part 2. New Orleans, 20 December 1803: the French tricolour comes down in the square, the American flag goes up (no troops,
// no fighting); then the camera rises and all of Louisiana, west of the river, turns to the United States.
const Tricolore = () => (
  <g><rect x={0} y={0} width={19} height={36} fill="#1F3A9A" /><rect x={19} y={0} width={18} height={36} fill="#F4F2EC" /><rect x={37} y={0} width={19} height={36} fill="#D22B33" />
    <rect x={0} y={0} width={56} height={36} fill="none" stroke="#3A3028" strokeWidth={0.6} /></g>
);
const US1803 = () => (   // the 15-star, 15-stripe flag of 1795-1818
  <g>{[...Array(15)].map((_, i) => <rect key={i} x={0} y={i * 2.4} width={56} height={2.4} fill={i % 2 ? '#F4F2EC' : '#B22234'} />)}
    <rect x={0} y={0} width={24} height={19.2} fill="#2B3A78" />
    {[...Array(15)].map((_, i) => <circle key={`s${i}`} cx={3 + (i % 5) * 4.5} cy={3 + Math.floor(i / 5) * 6.2} r={1.1} fill="#F4F2EC" />)}</g>
);
function Sale1803({f}) {
  const base = geoMercator().fitExtent([[700, 650], [PW - 700, PH - 650]], {type: 'MultiPoint', coordinates: [[-114, 29], [-85, 49]]}).scale();
  const NO = [-90.063, 29.957], SQ = [-90.04, 29.9];   // the square: drawn just south of the town, clear of Lake Pontchartrain
  const cam = cameraAt(f, [[0, [SQ[0], SQ[1] + 0.03], 36], [120, [SQ[0], SQ[1] + 0.03], 40], [180, [-95, 37.5], 1.02], [330, [-95.5, 38], 1.06]]);
  const turn = lerp(f, 120, 196, -10, 0);
  const proj = geoMercator().scale(base * cam[2]).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-600, -600], [PW + 600, PH + 600]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  const close = 1 - lerp(f, 122, 146, 0, 1);
  const frDown = lerp(f, 28, 78, 1, 0, Easing.inOut(Easing.quad)), usUp = lerp(f, 88, 132, 0, 1, Easing.out(Easing.cubic));
  const spread = lerp(f, 138, 260, 0, 1, Easing.inOut(Easing.quad));
  const [ox, oy] = P(...NO);
  const lou = ringFeature(rings1750.louisiana);
  const pole = P(SQ[0], SQ[1] - 0.004);
  const onlookers = [[SQ[0] - 0.1, SQ[1] - 0.03], [SQ[0] - 0.065, SQ[1] - 0.045], [SQ[0] + 0.065, SQ[1] - 0.045], [SQ[0] + 0.1, SQ[1] - 0.03]].map((ll, k) => ({x: P(...ll), k}));
  const houses = [[SQ[0] - 0.09, SQ[1] + 0.045, 0], [SQ[0], SQ[1] + 0.055, 1], [SQ[0] + 0.09, SQ[1] + 0.045, 2]].map(([lo, la, i]) => ({x: P(lo, la), i}));
  const stand = [
    ...houses.map((h) => ({y: h.x[1], el: <Piece key={`h${h.i}`} {...xy(h.x)} turn={turn} s={1.1} w={150} h={190} op={close}><House build={1} f={f + h.i * 13} /></Piece>})),
    {y: pole[1] - 1, el: <Piece key="fr" {...xy([pole[0] - 90, pole[1]])} turn={turn} s={1.3} w={80} h={200} op={close}><Pole flag={<Tricolore />} f={f} raise={frDown} /></Piece>},
    {y: pole[1], el: <Piece key="us" {...xy([pole[0] + 90, pole[1]])} turn={turn} s={1.3} w={80} h={200} op={close}><Pole flag={<US1803 />} f={f + 20} raise={usUp} /></Piece>},
    ...onlookers.map((o) => ({y: o.x[1], el: <Piece key={`o${o.k}`} {...xy(o.x)} turn={turn} s={0.95} w={120} h={200} op={close}><Settler k={o.k} tool="bundle" /></Piece>})),
  ].sort((a, b) => a.y - b.y);
  return (
    <Table turn={turn} lit={lerp(f, 0, 18, 0, 1)} overlay={<Title f={f} items={[['Louisiana Purchase, 1803', 6, true, 164], ['New Orleans, 20 December: the French flag comes down', 30, false, 130], ['Sold to the United States for $15 million', 170, true], ['About 2.1 million km²', 226, false]]} />}>
      <Board path={path}>
        {close > 0 && <rect x={P(...SQ)[0] - 470} y={P(...SQ)[1] - 200} width={920} height={360} rx={20} fill="#7C6E52" opacity={0.55 * close} stroke="#A89470" strokeWidth={4} strokeOpacity={close} />}
        {spread > 0 && (
          <g clipPath="url(#landclip)">
            <defs>
              <radialGradient id="saleg" cx={ox} cy={oy} r={Math.max(1, spread * 2300)} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFF" /><stop offset="0.75" stopColor="#FFF" /><stop offset="1" stopColor="#FFF" stopOpacity="0" />
              </radialGradient>
              <mask id="sale" maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={PW + 4000} height={PH + 4000}><rect x={-2000} y={-2000} width={PW + 4000} height={PH + 4000} fill="url(#saleg)" /></mask>
            </defs>
            <g mask="url(#sale)">
              <path d={path(lou)} fill="#5E7BB0" fillOpacity={0.42} />
              <path d={path(lou)} fill="none" stroke="#F4FBFF" strokeWidth={5} strokeLinejoin="round" />
            </g>
          </g>
        )}
        {f >= 150 && <BoardLabel P={P} ll={[-99, 40.5]} text="LOUISIANA" size={64} op={lerp(f, 200, 222, 0, 1)} />}
        {f >= 120 && <g opacity={lerp(f, 126, 146, 0, 1)}><circle cx={ox} cy={oy} r={12} fill="#FF6A3D" stroke="#F2F7FF" strokeWidth={3} />
          <text x={ox + 22} y={oy + 12} style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 34, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: 8}}>New Orleans</text></g>}
      </Board>
      {stand.map((p) => p.el)}
    </Table>
  );
}

// ───────── Part 3. New Caledonia, 24 September 1853: a French ship comes in to the north-east coast and the tricolour is raised ashore;
// the islands were already home to the Kanak, so their village stands there first (a round 'grande case' with its carved spire) and
// its people watch from it. No fighting. At the end the camera rises over Grande Terre, outlined.
const Case = ({big = false}) => (   // a Kanak round house: a low round wall, a tall conical thatched roof, a carved spire on its top
  <svg width={130} height={210} viewBox="0 0 130 210" style={{overflow: 'visible'}}>
    <defs><linearGradient id="thatch" x1="0" x2="1"><stop offset="0" stopColor="#C8A86A" /><stop offset="0.55" stopColor="#9A7A44" /><stop offset="1" stopColor="#5A4422" /></linearGradient>
      <linearGradient id="cwall" x1="0" x2="1"><stop offset="0" stopColor="#A88A60" /><stop offset="1" stopColor="#5E4A30" /></linearGradient></defs>
    <path d="M 8 176 L 8 184 C 8 196 122 196 122 184 L 122 176 Z" fill="#5A5246" /><ellipse cx={65} cy={176} rx={57} ry={10} fill="#8A8270" />
    <path d="M 26 176 L 26 146 C 40 140 90 140 104 146 L 104 176 C 90 182 40 182 26 176 Z" fill="url(#cwall)" stroke="#3A2A18" />
    <rect x={58} y={152} width={14} height={26} rx={2} fill="#21160C" />
    <path d={`M 18 148 L 65 ${big ? 36 : 56} L 112 148 C 90 156 40 156 18 148 Z`} fill="url(#thatch)" stroke="#4A3618" strokeWidth={1} />
    {[0.25, 0.5, 0.75].map((k) => <path key={k} d={`M ${18 + 94 * k - 47 * k * 0} ${148 - 8 * Math.sin(Math.PI * k)} L 65 ${big ? 40 : 60}`} stroke="#6E5430" strokeWidth={0.8} opacity={0.5} />)}
    <rect x={62} y={big ? 10 : 30} width={6} height={big ? 30 : 30} fill="#4A3220" stroke="#2A1A0E" />
    <ellipse cx={65} cy={big ? 12 : 32} rx={8} ry={5} fill="#5A3E26" stroke="#2A1A0E" />
  </svg>
);
const Villager = ({k = 0}) => {   // a Kanak man or woman of the 1850s, drawn plainly: a wrap in earth tones, dark hair
  const cloth = [['#8A5A3A', '#4A2E1C', '#B08460'], ['#6E6A4A', '#3A3826', '#9A9670'], ['#7A4A3A', '#40261C', '#A8705E']][k % 3];
  return (
    <svg width={120} height={200} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
      <defs><Lacquer id={`vl${k}`} c={cloth[0]} dark={cloth[1]} light={cloth[2]} />
        <Lacquer id={`vs${k}`} c="#6A4430" dark="#3A2216" light="#946650" /></defs>
      <Base team="ally" />
      <path d="M 40 152 C 40 128 44 100 48 82 L 72 82 C 76 100 80 128 80 152 Z" fill={`url(#vs${k})`} stroke="#3A2216" strokeWidth={1.2} />
      <path d="M 40 152 C 40 136 42 122 44 112 L 76 112 C 78 122 80 136 80 152 Z" fill={`url(#vl${k})`} stroke={cloth[1]} strokeWidth={1.2} />
      <circle cx={60} cy={64} r={15} fill={`url(#vs${k})`} stroke="#2A160C" strokeWidth={1} />
      <path d={k % 2 ? 'M 44 64 C 40 40 80 40 76 64 C 74 50 46 50 44 64 Z' : 'M 45 60 C 44 44 76 44 75 60 C 70 52 50 52 45 60 Z'} fill="#120C08" />
      <ellipse cx={48} cy={62} rx={5} ry={12} fill="#FFFFFF" opacity={0.12} />
    </svg>
  );
};
function NewCal1853({f}) {
  const base = geoMercator().fitExtent([[700, 650], [PW - 700, PH - 650]], {type: 'MultiPoint', coordinates: [[163.6, -22.8], [168.2, -19.6]]}).scale();
  const LAND = [164.47, -20.31];   // the north-east coast
  const route = [[166.2, -18.9], [165.6, -19.45], [165.0, -19.92], [164.66, -20.17], [164.5, -20.282]];
  const along = course(route);
  const trip = (fr) => interpolate(fr, [10, 170], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  const lagged = (fr) => {
    let lo = 0, la = 0, w = 0;
    for (let k = 0; k <= 36; k += 4) { const q = along(trip(fr - 8 - k)), wk = 1 / (1 + k / 10); lo += q[0] * wk; la += q[1] * wk; w += wk; }
    return [lo / w, la / w - 0.05];
  };
  const followZ = (fr) => lerp(fr, 0, 150, 2.2, 6);
  const cam = f < 150 ? cameraAt(f, [[0, [165.4, -19.7], 0.95], [40, [165.4, -19.7], 1.0], [150, lagged(150), followZ(150)]])
    : cameraAt(f, [[150, lagged(150), followZ(150)], [196, [LAND[0] + 0.01, LAND[1] - 0.004], 34], [262, [LAND[0] + 0.012, LAND[1] - 0.006], 36], [316, [165.6, -21.2], 1.0], [360, [165.6, -21.2], 0.98]]);
  const turn = lerp(f, 150, 196, 0, -14) + lerp(f, 262, 316, 0, 14);
  const proj = geoMercator().scale(base * cam[2]).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-600, -600], [PW + 600, PH + 600]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  const ship = sailing({along, trip, f, P, turn, i: 0});
  const close = lerp(f, 176, 198, 0, 1) * (1 - lerp(f, 266, 292, 0, 1));
  const rise = (at) => lerp(f, at, at + 14, 0, 1, Easing.out(Easing.cubic));
  // the village is there before anyone lands
  const huts = [[LAND[0] + 0.022, LAND[1] - 0.012, true], [LAND[0] + 0.034, LAND[1] - 0.006, false], [LAND[0] + 0.03, LAND[1] - 0.02, false]].map(([lo, la, big], i) => ({x: P(lo, la), big, i}));
  const people = [[LAND[0] + 0.016, LAND[1] - 0.004], [LAND[0] + 0.02, LAND[1] + 0.001], [LAND[0] + 0.026, LAND[1] - 0.001]].map((ll, k) => ({x: P(...ll), k}));
  // two sailors come ashore in hops, the flag goes up between them
  const crew = [0, 1].map((k) => {
    const a = 206 + k * 10, mv = hops(lerp(f, a, a + 30, 0, 1, (t) => t), 2);
    const from = [LAND[0] - 0.006 + k * 0.004, LAND[1] + 0.01], to = [LAND[0] - 0.004 + k * 0.008, LAND[1] - 0.003];
    return {x: P(from[0] + (to[0] - from[0]) * mv.u, from[1] + (to[1] - from[1]) * mv.u), lift: mv.lift * 26, show: f >= a - 4, k};
  });
  const flagAt = P(LAND[0], LAND[1] - 0.006);
  const ncl = geo.detail.features.find((ft) => ft.properties.a3 === 'NCL') || geo.world.features.find((ft) => ft.properties.a3 === 'NCL');
  const outline = lerp(f, 290, 316, 0, 1);
  const stand = [
    ...huts.map((h) => ({y: h.x[1], el: <Piece key={`c${h.i}`} {...xy(h.x)} turn={turn} s={1.05} w={130} h={210} op={close} rise={rise(178 + h.i * 4)}><Case big={h.big} /></Piece>})),
    ...people.map((p) => ({y: p.x[1], el: <Piece key={`v${p.k}`} {...xy(p.x)} turn={turn} s={0.9} w={120} h={200} op={close} rise={rise(184 + p.k * 5)}><Villager k={p.k} /></Piece>})),
    ...crew.filter((c) => c.show).map((c) => ({y: c.x[1], el: <Piece key={`cr${c.k}`} {...xy(c.x)} turn={turn} s={0.9} w={120} h={200} op={close} lift={c.lift} rise={rise(202 + c.k * 10)}><Settler k={c.k + 1} tool="bundle" /></Piece>})),
    ...(f >= 226 ? [{y: flagAt[1], el: <Piece key="flag" {...xy(flagAt)} turn={turn} s={1.1} w={80} h={200} op={close} rise={rise(226)}><Pole flag={<Tricolore />} f={f} raise={lerp(f, 232, 262, 0, 1, Easing.out(Easing.cubic))} /></Piece>}] : []),
  ].sort((a, b) => a.y - b.y);
  return (
    <Table turn={turn} lit={lerp(f, 0, 18, 0, 1)} overlay={<Title f={f} items={[['New Caledonia, 24 September 1853', 8, true], ['The home of the Kanak people', 186, false, 300], ['France takes possession', 236, false]]} />}>
      <Board path={path}>
        {ncl && <g opacity={outline}><path d={path(ncl)} fill="#3FB8DE" fillOpacity={0.42} /><path d={path(ncl)} fill="none" stroke="#F4FBFF" strokeWidth={5} strokeLinejoin="round" /></g>}
        {f >= 300 && <BoardLabel P={P} ll={[165.9, -21.0]} text="NEW CALEDONIA" size={60} op={lerp(f, 304, 322, 0, 1)} />}
        <Wake ships={[ship]} op={1 - lerp(f, 176, 200, 0, 1)} />
      </Board>
      {stand.map((p) => p.el)}
      <Piece x={ship.x} y={ship.y} turn={turn} s={lerp(f, 150, 196, 0.62, 0.95)} w={170} h={210} op={lerp(f, 0, 14, 0, 1) * (1 - lerp(f, 280, 300, 0, 1))} lift={Math.sin(f / 13) * 2}>
        <Ship team="fr" face={ship.face} sail={f > 170 ? lerp(f, 170, 196, ship.sail, 0) : ship.sail} roll={Math.sin(f / 16) * (1.2 + ship.speed * 0.5)} />
      </Piece>
    </Table>
  );
}

const Quebec1608Sample = ({f}) => (
  <AbsoluteFill>
    {f < 604 + D1608 && <Quebec1608 f={f} />}
    {f >= 580 + D1608 && <AbsoluteFill style={{opacity: lerp(f, 580 + D1608, 604 + D1608, 0, 1)}}><PaintingCoda f={f - 580 - D1608} len={220} /></AbsoluteFill>}
  </AbsoluteFill>
);
const SCENES = {quebec1608: Quebec1608Sample, quebec1608map: Quebec1608, quebec1759: Quebec1759, sugar: Sugar, treaty1763: Treaty1763, sale1803: Sale1803, newcal1853: NewCal1853};
export const WAR_FRAMES = {quebec1608: 760 + D1608, quebec1608map: 600 + D1608, quebec1759: 390, sugar: 360, treaty1763: 330, sale1803: 330, newcal1853: 360};

export const WarTable = ({id = 'quebec1608', frame}) => {
  const cur = useCurrentFrame();
  const f = frame != null ? Number(frame) : cur;
  const Scene = SCENES[id] || Quebec1608;
  return (
    <AbsoluteFill>
      <style>{FONT_CSS}</style>
      <Scene f={f} />
    </AbsoluteFill>
  );
};
