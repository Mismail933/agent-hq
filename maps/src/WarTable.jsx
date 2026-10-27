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
const Piece = ({x, y, s = 1, w, h, rise = 1, fall = 0, op = 1, turn = 0, lift = 0, children}) => (
  <>
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0}}>
      <div style={{position: 'absolute', left: -w * s * 0.3, top: -h * s * 0.03, width: w * s * 0.9, height: w * s * 0.22, borderRadius: '50%',
                   background: 'rgba(0,0,0,0.55)', filter: `blur(${6 * s + lift * 0.15}px)`, opacity: rise * op * (1 - fall * 0.5) * (1 - Math.min(0.6, lift / 60)),
                   transform: `rotateZ(${-turn}deg) translate(-20%, -50%) skewX(-30deg) scale(${1 + lift / 120})`}} />
    </div>
    <div style={{position: 'absolute', left: x - (w * s) / 2, top: y - h * s, width: w * s, height: h * s, transformOrigin: '50% 100%',
                 transform: `rotateZ(${-turn}deg) rotateX(${-TILT}deg) translateY(${-lift}px) rotateZ(${fall * 84}deg) scale(${rise})`, opacity: op}}>
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
const OTHER = [...geo.world.features, ...geo.detail.features].filter((ft) => !['CAN', 'USA', 'SPM'].includes(ft.properties.a3));
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
const Table = ({children, turn, lit, overlay}) => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 30%, #2A2420 0%, #0B0907 75%)'}}>
    <div style={{position: 'absolute', left: (W - PW) / 2, top: (H - PH) / 2, width: PW, height: PH, transformStyle: 'preserve-3d', opacity: lit,
                 transform: `perspective(1900px) rotateX(${TILT}deg) rotateZ(${turn}deg)`}}>
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
function Quebec1608({f}) {
  const base = geoMercator().fitExtent([[700, 650], [PW - 700, PH - 650]], {type: 'MultiPoint', coordinates: [[-74, 40], [3, 54]]}).scale();
  const QC = [-71.205, 46.818];
  const route = [[0.23, 49.45], [-6, 48.6], [-20, 47.6], [-35, 46.9], [-48, 46.6], [-56, 47.2], [-61.5, 48.6], [-66.5, 49.3], [-69.6, 48.0], [-70.6, 47.15],
                 [-71.0, 46.9], [-71.15, 46.83], [-71.19, 46.808]];
  const along = course(route);
  const trips = [0, 1].map((i) => (fr) => interpolate(fr, [16 + i * 18, 214 + i * 6], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)}) * (1 - i * 0.0006));
  // the camera: over the lead ship's shoulder (a lag), then down to the river at Quebec; at the end it rises to show New France
  const lagged = (fr) => {
    let lo = 0, la = 0, w = 0;
    for (let k = 0; k <= 36; k += 4) { const q = along(trips[0](fr - 8 - k)), wk = 1 / (1 + k / 10); lo += q[0] * wk; la += q[1] * wk; w += wk; }
    return [lo / w, la / w - 0.6];
  };
  const followZ = (fr) => lerp(fr, 0, 150, 1.1, 2.2);
  const cam = f < 150 ? [0, lagged(f), followZ(f)]
    : cameraAt(f, [[150, lagged(150), followZ(150)], [236, [QC[0] + 0.002, QC[1] + 0.004], 380], [372, [QC[0] + 0.004, QC[1] + 0.006], 400], [446, NF_VIEW[0], NF_VIEW[1]], [580, [NF_VIEW[0][0] - 0.6, NF_VIEW[0][1]], NF_VIEW[1] * 0.97]]);
  const turn = lerp(f, 150, 236, 0, -24) + lerp(f, 372, 446, 0, 24);
  const z = cam[2];
  const proj = geoMercator().scale(base * z).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-600, -600], [PW + 600, PH + 600]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  const ships = [0, 1].map((i) => sailing({along: (u) => { const q = along(u); return [q[0] + i * 0.035 * Math.pow(u, 30), q[1] + i * 0.012 * Math.pow(u, 30)]; },
                                           trip: trips[i], f, P, turn, i}));
  const zoomed = lerp(f, 200, 236, 0, 1) * (1 - lerp(f, 380, 420, 0, 1));   // the close pieces show only near the town
  // ashore: settlers step off and are moved up the bank in hops, staggered; then they work
  const spots = [[-71.214, 46.826], [-71.198, 46.829], [-71.222, 46.836], [-71.19, 46.839]];
  const settlers = spots.map((sp, k) => {
    const a = 232 + k * 9, mv = hops(lerp(f, a, a + 34, 0, 1, (t) => t), 2);
    const from = [-71.19 + k * 0.006, 46.81];
    return {x: P(from[0] + (sp[0] - from[0]) * mv.u, from[1] + (sp[1] - from[1]) * mv.u), lift: mv.lift * 30, rise: lerp(f, a - 6, a + 4, 0, 1, Easing.out(Easing.back(1.4))), k};
  });
  const houses = [[-71.207, 46.833, 0], [-71.2, 46.836, 1], [-71.213, 46.84, 2]].map(([lon, lat, i]) => ({x: P(lon, lat), build: lerp(f, 268 + i * 16, 300 + i * 16, 0, 1, Easing.out(Easing.quad)), i}));
  // the First Nations traders come down the river by canoe, and step ashore to trade furs
  const canoeU = lerp(f, 300, 352, 0, 1, Easing.out(Easing.cubic));
  const canoePath = course([[-71.1, 46.9], [-71.15, 46.858], [-71.183, 46.836]]);
  const cn = canoePath(canoeU), cnPrev = canoePath(Math.max(0, canoeU - 0.05));
  const traders = [0, 1].map((k) => {
    const mv = hops(lerp(f, 352 + k * 8, 372 + k * 8, 0, 1, (t) => t), 1);
    const a = [cn[0] - 0.004 + k * 0.006, cn[1] + 0.004], b = [-71.186 + k * 0.007, 46.83 + k * 0.004];
    return {x: P(a[0] + (b[0] - a[0]) * mv.u, a[1] + (b[1] - a[1]) * mv.u), lift: mv.lift * 26, show: f >= 352 + k * 8, k};
  });
  // New France: the land France claimed, spreading out from Quebec along the river (by the 1700s), outlined
  const spread = lerp(f, 420, 540, 0, 1, Easing.inOut(Easing.quad));
  const [qx, qy] = P(...QC);
  const nf = ringFeature(NEW_FRANCE);
  const field = (lon, lat, w, h, at) => {
    const g = lerp(f, at, at + 26, 0, 1);
    const [x0, y0] = P(lon, lat), [x1, y1] = P(lon + w, lat - h);
    return <rect x={x0} y={y0} width={(x1 - x0) * g} height={y1 - y0} fill="#7A8A4A" opacity={0.55 * zoomed} stroke="#B8C47A" strokeWidth={1} strokeOpacity={0.6 * zoomed} />;
  };
  return (
    <Table turn={turn} lit={lerp(f, 0, 24, 0, 1)} overlay={<Title f={f} items={[['1608: Champlain sails from Honfleur', 10, true, 220], ['Quebec, 3 July 1608', 232, true, 440], ['Trade with the First Nations', 330, false, 396], ['New France grows along the river', 404]]} />}>
      <Board path={path}>
        {field(-71.232, 46.848, 0.012, 0.007, 330)}{field(-71.218, 46.852, 0.01, 0.006, 340)}{field(-71.196, 46.85, 0.012, 0.006, 350)}
        <Wake ships={ships} op={1 - lerp(f, 214, 236, 0, 1)} />
        {f > 300 && f < 380 && <Wake ships={[{i: 9, speed: (1 - canoeU) * 3, wake: [...Array(8)].map((_, k) => ({x: P(...canoePath(Math.max(0, canoeU - (k + 1) * 0.03)))[0], y: P(...canoePath(Math.max(0, canoeU - (k + 1) * 0.03)))[1], k}))}]} />}
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
        {spread > 0.25 && <text x={P(-80, 47.6)[0]} y={P(-80, 47.6)[1]} textAnchor="middle" opacity={lerp(f, 470, 490, 0, 1)}
                                 style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 64, letterSpacing: 10, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: 10}}>NEW FRANCE</text>}
      </Board>
      {/* pieces, back to front */}
      {houses.map((h) => <Piece key={`h${h.i}`} {...xy(h.x)} turn={turn} s={0.95} w={150} h={190} op={zoomed} rise={h.build > 0 ? 1 : 0}><House build={h.build} f={f + h.i * 13} /></Piece>)}
      {f >= 316 && <Piece {...xy(P(-71.204, 46.842))} turn={turn} s={0.9} w={80} h={200} op={zoomed} rise={lerp(f, 316, 326, 0, 1)}><Pole flag={<Bourbon />} f={f} raise={lerp(f, 320, 350, 0, 1, Easing.out(Easing.cubic))} /></Piece>}
      {settlers.map((st) => f >= 226 + st.k * 9 && (
        <Piece key={`s${st.k}`} {...xy(st.x)} turn={turn} s={0.82} w={120} h={200} op={zoomed} rise={st.rise} lift={st.lift}>
          <Settler k={st.k} tool={st.k % 2 ? 'bundle' : 'axe'} swing={st.k % 2 ? 0 : Math.max(0, Math.sin((f - 280 - st.k * 7) / 5)) * (f > 280 ? 1 : 0)} />
        </Piece>))}
      {traders.map((t) => t.show && (
        <Piece key={`t${t.k}`} {...xy(t.x)} turn={turn} s={0.82} w={120} h={200} op={zoomed} lift={t.lift} rise={lerp(f, 352 + t.k * 8, 360 + t.k * 8, 0, 1)}><Trader k={t.k} /></Piece>))}
      {f >= 300 && f < 400 && <Piece {...xy(P(...cn))} turn={turn} s={0.9} w={200} h={110} op={zoomed * lerp(f, 300, 312, 0, 1)} lift={Math.sin(f / 9) * 2}>
        <Canoe f={f} face={P(...cn)[0] >= P(...cnPrev)[0] ? 1 : -1} /></Piece>}
      {ships.map((sh) => (
        <Piece key={`sh${sh.i}`} x={sh.x} y={sh.y} turn={turn} s={lerp(f, 200, 236, 0.62, 0.9)} w={170} h={210} op={lerp(f, sh.i * 10, 18 + sh.i * 10, 0, 1) * (1 - lerp(f, 384, 410, 0, 1))} lift={Math.sin((f + sh.i * 11) / 13) * 2}>
          <Ship team="fr" face={sh.face} sail={f > 214 ? lerp(f, 214, 240, sh.sail, 0) : sh.sail} roll={Math.sin((f + sh.i * 17) / 16) * (1.2 + sh.speed * 0.5)} />
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
// as it is"; the owner: real, like a chess thing, never the Storygraphics cast). Carved pieces on the table, no violence shown: the cane
// is cut row by row, bundles are carried to the mill, barrels of sugar stack up, an overseer stands at the edge of the field.
const WOOD = ['#6A5A48', '#3A3026', '#9A8A74'];
const Worker = ({k = 0, swing = 0, carry = false}) => {
  const cloth = [['#E8E2D2', '#9E9682', '#FFFFFF'], ['#C9BFA8', '#7E765F', '#EDE6D2'], ['#B8A88A', '#6E6248', '#E0D2B4']][k % 3];
  return (
    <svg width={120} height={200} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
      <defs><Lacquer id={`wk${k}`} c={cloth[0]} dark={cloth[1]} light={cloth[2]} /><Lacquer id={`wsk${k}`} c="#6B4430" dark="#3A2216" light="#9A6A4E" />
        <linearGradient id="bwood" x1="0" x2="1"><stop offset="0" stopColor={WOOD[2]} /><stop offset="0.4" stopColor={WOOD[0]} /><stop offset="1" stopColor={WOOD[1]} /></linearGradient></defs>
      <path d="M 10 168 L 10 182 C 10 196 110 196 110 182 L 110 168 Z" fill="url(#bwood)" /><ellipse cx={60} cy={168} rx={50} ry={11} fill={WOOD[0]} stroke={WOOD[1]} strokeWidth={1.5} />
      <g transform={carry ? '' : `rotate(${8 + swing * 6} 60 160)`}>
        <path d="M 38 160 C 38 128 43 98 48 82 L 72 82 C 77 98 82 128 82 160 Z" fill={`url(#wk${k})`} stroke={cloth[1]} strokeWidth={1.2} />
        <rect x={44} y={118} width={32} height={4} fill="#6E6248" />
        <circle cx={60} cy={66} r={15} fill={`url(#wsk${k})`} stroke="#2A160C" strokeWidth={1} />
        {k % 2 === 0 && <path d="M 45 62 C 45 46 75 46 75 62 C 68 55 52 55 45 62 Z" fill="#D8CDB2" stroke="#8E846C" strokeWidth={1} />}
        {carry
          ? <g>{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={30 + i * 3} y={36 + (i % 2) * 3} width={62} height={5} rx={2} fill={i % 2 ? '#8AAA52' : '#6E8E3E'} stroke="#3E5A22" strokeWidth={0.8} />)}</g>
          : <g transform={`rotate(${-50 + swing * 95} 74 100)`}><rect x={72} y={70} width={5} height={34} rx={2} fill="#5A3A22" /><path d="M 70 72 L 80 72 L 86 38 L 76 36 Z" fill="#B8C0C6" stroke="#5A6268" strokeWidth={0.8} /></g>}
      </g>
      <ellipse cx={48} cy={64} rx={5} ry={12} fill="#FFFFFF" opacity={0.14} />
    </svg>
  );
};
const Overseer = () => (
  <svg width={120} height={200} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
    <defs><Lacquer id="ovc" c="#2E3E5E" dark="#141C2E" light="#6A7EA6" /><Skin id="ovs" /><Lacquer id="ovh" c="#2A2622" dark="#0C0A08" light="#6A625A" /></defs>
    <path d="M 10 168 L 10 182 C 10 196 110 196 110 182 L 110 168 Z" fill={WOOD[1]} /><ellipse cx={60} cy={168} rx={50} ry={11} fill={WOOD[0]} stroke={WOOD[1]} strokeWidth={1.5} />
    <path d="M 34 160 C 34 126 40 96 46 80 L 74 80 C 80 96 86 126 86 160 Z" fill="url(#ovc)" stroke="#141C2E" strokeWidth={1.2} />
    <circle cx={60} cy={64} r={15} fill="url(#ovs)" stroke="#6E4630" strokeWidth={1} />
    <path d="M 40 54 C 46 40 74 40 80 54 C 70 50 50 50 40 54 Z" fill="url(#ovh)" /><path d="M 44 52 C 52 36 68 36 76 52" fill="url(#ovh)" />
  </svg>
);
const Mill = ({f}) => (   // a stone windmill: the sails turn
  <svg width={170} height={240} viewBox="0 0 170 240" style={{overflow: 'visible'}}>
    <defs><linearGradient id="stone" x1="0" x2="1"><stop offset="0" stopColor="#D8CDB6" /><stop offset="0.55" stopColor="#A89A80" /><stop offset="1" stopColor="#6A5E4A" /></linearGradient></defs>
    <path d="M 20 214 L 20 226 C 20 238 150 238 150 226 L 150 214 Z" fill={WOOD[1]} /><ellipse cx={85} cy={214} rx={65} ry={12} fill={WOOD[0]} />
    <path d="M 52 212 L 60 96 L 110 96 L 118 212 Z" fill="url(#stone)" stroke="#5A4E3C" strokeWidth={1.4} />
    <path d="M 56 98 L 85 70 L 114 98 Z" fill="#5A3A22" stroke="#2E1C10" />
    <rect x={76} y={170} width={18} height={42} fill="#2E1C10" />
    <g transform={`translate(85 96) rotate(${f * 2.4})`}>
      {[0, 90, 180, 270].map((a) => <g key={a} transform={`rotate(${a})`}><rect x={-3} y={-78} width={6} height={78} fill="#4A3020" /><rect x={3} y={-74} width={20} height={56} fill="#EDE4CC" stroke="#8A7A5A" strokeWidth={0.8} /></g>)}
      <circle r={7} fill="#2E1C10" />
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
  const cam = cameraAt(f, [[0, [-72.6, 19.0], 1.0], [44, [-72.6, 19.0], 1.08], [118, C, 40], [330, [C[0] + 0.004, C[1] + 0.002], 42]]);
  const turn = lerp(f, 40, 118, 0, -16);
  const z = cam[2];
  const proj = geoMercator().scale(base * z).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-600, -600], [PW + 600, PH + 600]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  const close = lerp(f, 84, 118, 0, 1);   // the pieces show once the camera is down on the plain
  const hti = [...geo.detail.features, ...geo.world.features].find((ft) => ft.properties.a3 === 'HTI');
  // the field: rows of cane, cut from the left as the work goes on (stubble behind the cutters)
  const L0 = C[0] - 0.05, L1 = C[0] + 0.012, rows = [0, 1, 2, 3, 4].map((r) => C[1] + 0.016 - r * 0.0075);
  const cut = lerp(f, 120, 320, 0.08, 0.62, (t) => t);
  const field = rows.map((lat, r) => {
    const [x0, y0] = P(L0, lat), [x1, y1] = P(L1, lat - 0.0045), xc = x0 + (x1 - x0) * Math.min(1, cut + (r % 2) * 0.04);
    return (
      <g key={r} opacity={close}>
        <rect x={x0} y={y0} width={xc - x0} height={y1 - y0} fill="#8A7448" stroke="#5E4E2E" strokeWidth={1} />
        <rect x={xc} y={y0} width={x1 - xc} height={y1 - y0} fill="#5E8A38" stroke="#3E5E22" strokeWidth={1} />
        {[...Array(40)].map((_, i) => { const x = x0 + ((i + 0.5) / 40) * (x1 - x0); return x > xc ? <path key={i} d={`M ${x} ${y1} L ${x + 3} ${y0 + 4}`} stroke="#9CC45E" strokeWidth={3} opacity={0.8} /> : null; })}
      </g>
    );
  });
  // the cutters, one at the edge of each row, a little apart in time
  const cutters = rows.map((lat, r) => {
    const xL = L0 + (L1 - L0) * Math.min(1, cut + (r % 2) * 0.04) + 0.002;
    return {x: P(xL, lat - 0.0022), swing: Math.max(0, Math.sin((f - r * 7) / 4.5)), rise: lerp(f, 100 + r * 5, 112 + r * 5, 0, 1, Easing.out(Easing.back(1.4))), k: r};
  });
  // two carry bundles to the mill and walk back, moved like pieces in hops
  const MILL = [C[0] + 0.03, C[1] + 0.006];
  const carriers = [0, 1].map((k) => {
    const period = 90, t0 = 140 + k * 45, ph = f < t0 ? 0 : ((f - t0) % period) / period;
    const go = ph < 0.5, mv = hops(go ? ph * 2 : (ph - 0.5) * 2, 2);
    const a = [L1 + 0.004, C[1] - 0.004 - k * 0.008], b = [MILL[0] - 0.009, MILL[1] - 0.006 - k * 0.006];
    const u = go ? mv.u : 1 - mv.u;
    return {x: P(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u), lift: mv.lift * 26, carry: go && f >= t0, show: f >= 128, k: k + 3};
  });
  const barrels = [0, 1, 2, 3, 4].map((i) => ({x: P(MILL[0] + 0.006 + (i % 3) * 0.004, MILL[1] - 0.01 - Math.floor(i / 3) * 0.004), at: 190 + i * 26}));
  const [hx, hy] = P(-73.35, 19.2);
  // the plantation: its earth, a track to the mill, palms round the edge
  const G0 = P(L0 - 0.016, C[1] + 0.03), G1 = P(MILL[0] + 0.024, C[1] - 0.034);
  const palms = [[L0 - 0.012, C[1] - 0.026], [L0 + 0.01, C[1] + 0.026], [C[0] + 0.004, C[1] + 0.027], [MILL[0] + 0.018, C[1] + 0.02], [MILL[0] + 0.02, C[1] - 0.03]];
  return (
    <Table turn={turn} lit={lerp(f, 0, 18, 0, 1)} overlay={<Title f={f} items={[['Saint-Domingue, the 1700s', 6, true], ['Sugar', 96, false], ['Worked by enslaved Africans', 132, true], ['Nearly half a million enslaved by 1789', 214]]} />}>
      <Board path={path}>
        {hti && <g opacity={1 - close * 0.85}><path d={path(hti)} fill="#3FB8DE" fillOpacity={0.42 * lerp(f, 8, 30, 0, 1)} /><path d={path(hti)} fill="none" stroke="#F4FBFF" strokeWidth={5} strokeOpacity={lerp(f, 8, 30, 0, 1)} /></g>}
        {f < 110 && <text x={hx} y={hy} textAnchor="middle" opacity={lerp(f, 14, 30, 0, 1) * (1 - close)}
                          style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 64, letterSpacing: 8, fill: '#F4FBFF', paintOrder: 'stroke', stroke: 'rgba(3,8,16,0.8)', strokeWidth: 10}}>SAINT-DOMINGUE</text>}
        <rect x={G0[0]} y={G0[1]} width={G1[0] - G0[0]} height={G1[1] - G0[1]} rx={40} fill="#8C7A4E" fillOpacity={0.72 * close} stroke="#5A4A30" strokeWidth={4} strokeOpacity={close} />
        <path d={`M ${P(L1 + 0.002, C[1] - 0.004)[0]} ${P(L1 + 0.002, C[1] - 0.004)[1]} L ${P(MILL[0] - 0.006, MILL[1] - 0.004)[0]} ${P(MILL[0] - 0.006, MILL[1] - 0.004)[1]}`} stroke="#A89470" strokeWidth={26} strokeLinecap="round" opacity={0.7 * close} />
        {field}
      </Board>
      {palms.map(([lo, la], i) => <Piece key={`p${i}`} {...xy(P(lo, la))} turn={turn} s={0.8} w={120} h={220} op={close} rise={lerp(f, 98 + i * 3, 110 + i * 3, 0, 1, Easing.out(Easing.back(1.3)))}><Palm f={f + i * 9} /></Piece>)}
      <Piece {...xy(P(...MILL))} turn={turn} s={0.95} w={170} h={240} op={close} rise={lerp(f, 96, 110, 0, 1, Easing.out(Easing.back(1.3)))}><Mill f={f} /></Piece>
      {barrels.map((b, i) => f >= b.at && <Piece key={`b${i}`} {...xy(b.x)} turn={turn} s={0.7} w={60} h={80} op={close} rise={lerp(f, b.at, b.at + 10, 0, 1, Easing.out(Easing.back(1.6)))}><Barrel /></Piece>)}
      {[...cutters].reverse().map((c) => <Piece key={`c${c.k}`} {...xy(c.x)} turn={turn} s={0.76} w={120} h={200} op={close} rise={c.rise}><Worker k={c.k} swing={c.swing} /></Piece>)}
      {carriers.map((c) => c.show && <Piece key={`k${c.k}`} {...xy(c.x)} turn={turn} s={0.76} w={120} h={200} op={close} lift={c.lift} rise={lerp(f, 128, 140, 0, 1)}><Worker k={c.k} carry={c.carry} /></Piece>)}
      <Piece {...xy(P(L0 - 0.006, C[1] + 0.004))} turn={turn} s={0.8} w={120} h={200} op={close} rise={lerp(f, 116, 128, 0, 1, Easing.out(Easing.back(1.4)))}><Overseer /></Piece>
    </Table>
  );
}

const Quebec1608Sample = ({f}) => (
  <AbsoluteFill>
    {f < 604 && <Quebec1608 f={f} />}
    {f >= 580 && <AbsoluteFill style={{opacity: lerp(f, 580, 604, 0, 1)}}><PaintingCoda f={f - 580} len={220} /></AbsoluteFill>}
  </AbsoluteFill>
);
const SCENES = {quebec1608: Quebec1608Sample, quebec1608map: Quebec1608, quebec1759: Quebec1759, sugar: Sugar};
export const WAR_FRAMES = {quebec1608: 760, quebec1608map: 600, quebec1759: 390, sugar: 330};

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
