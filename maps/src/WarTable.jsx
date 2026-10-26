// War-table scenes for Bassel's long video (the owner, 2026-10-26: "dont make it cartoon make it real like a chess thing"): the real map
// (Natural Earth 10m, public domain) laid on a table in perspective, lit, with carved and lacquered game pieces (ships, soldiers, a walled
// town, flags) that sail, rise, march, fire and fall. Pieces stand up off the tilted board (CSS 3D) and keep their size on screen.
// Scene 'quebec1759': the British fleet comes up the Saint Lawrence; the Plains of Abraham, 13 September 1759; Quebec changes hands.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {geoMercator, geoPath} from 'd3-geo';
import stl from './war_stl.json';
import {FONT_CSS} from './fonts';

const W = 1920, H = 1080, PW = 3600, PH = 2600, TILT = 50;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const ease = Easing.inOut(Easing.cubic);
const lerp = (f, a, b, x, y, e = ease) => interpolate(f, [a, b], [x, y], {...clamp, easing: e});

// ───── pieces: drawn as lit, carved models (gradients for the light from the upper left, a dark rim, a glossy highlight)
const Lacquer = ({id, c, dark, light}) => (
  <radialGradient id={id} cx="32%" cy="28%" r="80%"><stop offset="0" stopColor={light} /><stop offset="0.45" stopColor={c} /><stop offset="1" stopColor={dark} /></radialGradient>
);
const Base = ({team}) => {
  const [c, d, l] = team === 'fr' ? ['#2B4A9B', '#14234D', '#7B98D8'] : ['#A3262A', '#4E1012', '#E07A74'];
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
// a soldier: 1759 regulars (France: grey-white coat, blue facings; Britain: red coat), tricorn, musket at the shoulder
const Soldier = ({team, fire = 0}) => {
  const coat = team === 'fr' ? ['#E9E4D8', '#9E9888', '#FFFFFF'] : ['#B3282C', '#5A1012', '#E6807A'];
  const g = `c${team}`, sk = `s${team}`;
  return (
    <svg width={120} height={200} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
      <defs>
        <Lacquer id={g} c={coat[0]} dark={coat[1]} light={coat[2]} />
        <Lacquer id={sk} c="#D9A27E" dark="#8E5A3E" light="#F4CDB0" />
        <Lacquer id="hat" c="#2A2622" dark="#0C0A08" light="#6A625A" />
      </defs>
      <Base team={team} />
      <path d="M 34 152 C 34 120 40 92 46 76 L 74 76 C 80 92 86 120 86 152 Z" fill={`url(#${g})`} stroke={coat[1]} strokeWidth={1.2} />
      <path d="M 46 78 L 60 104 L 74 78" fill="none" stroke={team === 'fr' ? '#2B4A9B' : '#F2E8D0'} strokeWidth={4} />
      <rect x={52} y={118} width={16} height={6} rx={2} fill="#2A2622" />
      <circle cx={60} cy={62} r={15} fill={`url(#${sk})`} stroke="#6E4630" strokeWidth={1} />
      <path d="M 40 52 C 46 38 74 38 80 52 C 70 48 50 48 40 52 Z" fill="url(#hat)" />
      <path d="M 44 50 C 52 34 68 34 76 50" fill="url(#hat)" />
      <g transform={`rotate(${-18 + fire * 62} 74 86)`}>
        <rect x={72} y={18} width={5} height={84} rx={2} fill="#5A3A22" />
        <rect x={72.5} y={14} width={4} height={14} fill="#9AA3AA" />
      </g>
      <ellipse cx={46} cy={60} rx={6} ry={14} fill="#FFFFFF" opacity={0.18} />
    </svg>
  );
};
// a carved ship of the line on a small base (sails catch the light)
const Ship = ({team}) => (
  <svg width={170} height={210} viewBox="0 0 170 210" style={{overflow: 'visible'}}>
    <defs>
      <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8A5A30" /><stop offset="1" stopColor="#3A2412" /></linearGradient>
      <linearGradient id="sail" x1="0" x2="1"><stop offset="0" stopColor="#FFF8E8" /><stop offset="0.6" stopColor="#E8DCC0" /><stop offset="1" stopColor="#A8987A" /></linearGradient>
    </defs>
    <g transform="translate(25 10)"><Base team={team} /></g>
    {[[52, 52], [86, 40], [118, 60]].map(([x, top], i) => (
      <g key={i}>
        <rect x={x - 1.5} y={top - 10} width={3} height={150 - top} fill="#4A3020" />
        <path d={`M ${x - 22} ${top} Q ${x} ${top + 8} ${x + 22} ${top} L ${x + 24} ${top + 30} Q ${x} ${top + 42} ${x - 24} ${top + 30} Z`} fill="url(#sail)" stroke="#8A7A5A" strokeWidth={0.8} />
        <path d={`M ${x - 26} ${top + 36} Q ${x} ${top + 46} ${x + 26} ${top + 36} L ${x + 28} ${top + 70} Q ${x} ${top + 84} ${x - 28} ${top + 70} Z`} fill="url(#sail)" stroke="#8A7A5A" strokeWidth={0.8} />
        <path d={`M ${x} ${top - 10} l 16 4 l -16 4 Z`} fill={team === 'fr' ? '#F2F2F2' : '#B3282C'} />
      </g>
    ))}
    <path d="M 22 136 L 150 136 L 140 160 C 120 172 50 172 30 162 Z" fill="url(#hull)" stroke="#2A180A" strokeWidth={1.2} />
    <path d="M 14 128 L 40 128 L 40 140 L 22 142 Z" fill="url(#hull)" />
    <path d="M 26 146 L 146 144" stroke="#D9B44A" strokeWidth={2} />
    {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={46 + i * 16} y={149} width={6} height={4} fill="#1A0F06" />)}
  </svg>
);
// the walled town (stone, two towers, a flag that can change)
const Town = ({flag}) => (
  <svg width={190} height={230} viewBox="0 0 190 230" style={{overflow: 'visible'}}>
    <defs><linearGradient id="stone" x1="0" x2="1"><stop offset="0" stopColor="#D8D0BE" /><stop offset="0.5" stopColor="#B4AA94" /><stop offset="1" stopColor="#6E6656" /></linearGradient></defs>
    <path d="M 10 200 L 10 214 C 10 226 180 226 180 214 L 180 200 Z" fill="#5A5246" />
    <ellipse cx={95} cy={200} rx={85} ry={14} fill="#8A8270" />
    <rect x={30} y={130} width={130} height={70} fill="url(#stone)" stroke="#4A4438" />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={30 + i * 19} y={122} width={11} height={10} fill="url(#stone)" stroke="#4A4438" />)}
    <rect x={18} y={104} width={34} height={96} fill="url(#stone)" stroke="#4A4438" /><path d="M 14 106 L 35 80 L 56 106 Z" fill="#5A6470" />
    <rect x={138} y={104} width={34} height={96} fill="url(#stone)" stroke="#4A4438" /><path d="M 134 106 L 155 80 L 176 106 Z" fill="#5A6470" />
    <path d="M 80 200 L 80 170 C 80 158 110 158 110 170 L 110 200 Z" fill="#2E2A24" />
    <rect x={93} y={40} width={3} height={90} fill="#3A3028" />
    <g transform={`translate(96 ${44 + flag.drop * 70})`} opacity={flag.op}>{flag.node}</g>
  </svg>
);
const Bourbon = () => (   // the French royal standard: white with gold fleurs-de-lis (drawn small)
  <g><rect x={0} y={0} width={56} height={36} fill="#F7F5EE" stroke="#8A8270" strokeWidth={0.8} />
    {[[12, 10], [30, 10], [46, 10], [20, 24], [38, 24]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="#C9A227" />)}</g>
);
const Union1606 = () => (   // the Union Flag of 1759 (before 1801: no Saint Patrick's cross)
  <g><rect x={0} y={0} width={56} height={36} fill="#1F3A7A" />
    <path d="M 0 0 L 56 36 M 56 0 L 0 36" stroke="#F2F2F2" strokeWidth={7} />
    <path d="M 28 0 L 28 36 M 0 18 L 56 18" stroke="#F2F2F2" strokeWidth={11} />
    <path d="M 28 0 L 28 36 M 0 18 L 56 18" stroke="#C8102E" strokeWidth={6} /></g>
);
const Smoke = ({k}) => (
  <svg width={140} height={120} viewBox="0 0 140 120" style={{overflow: 'visible', opacity: (1 - k) * 0.85}}>
    {[[40, 70, 22], [70, 56, 30], [100, 70, 24], [60, 40, 20]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y - k * 30} r={r * (0.5 + k)} fill="#EDEAE2" />))}
    <circle cx={70} cy={80} r={12 * (1 - k)} fill="#FFD166" opacity={1 - k * 2} />
  </svg>
);

// one piece on the board: (x, y) in board pixels; it stands up (counter-tilt), keeps its screen size (1/zoom), casts a soft shadow
const Piece = ({x, y, z, s = 1, w, h, rise = 1, fall = 0, op = 1, turn = 0, children}) => {
  const k = s / z;
  return (
    <>
      <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0}}>
        <div style={{position: 'absolute', left: -w * k * 0.3, top: -h * k * 0.03, width: w * k * 0.9, height: w * k * 0.22, borderRadius: '50%',
                     background: 'rgba(0,0,0,0.55)', filter: `blur(${6 * k}px)`, opacity: rise * op * (1 - fall * 0.5), transform: `rotateZ(${-turn}deg) translate(-20%, -50%) skewX(-30deg)`}} />
      </div>
      <div style={{position: 'absolute', left: x - (w * k) / 2, top: y - h * k, width: w * k, height: h * k, transformOrigin: '50% 100%',
                   transform: `rotateZ(${-turn}deg) rotateX(${-TILT}deg) rotateZ(${fall * 84}deg) scale(${rise})`, opacity: op}}>
        <div style={{width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0'}}>{children}</div>
      </div>
    </>
  );
};

const Title = ({f, items}) => (
  <div style={{position: 'absolute', left: 70, top: 60}}>
    {items.map(([text, at, big], i) => {
      const o = lerp(f, at, at + 12, 0, 1);
      return (
        <div key={i} style={{opacity: o, transform: `translateY(${(1 - o) * 12}px)`, marginBottom: 12, display: 'table', background: 'rgba(8,12,20,0.78)',
                             borderLeft: '6px solid #C9A227', padding: big ? '12px 22px' : '8px 18px', color: '#F4EEDC', fontFamily: 'Space Grotesk',
                             fontWeight: 700, fontSize: big ? 46 : 32, letterSpacing: 3, textTransform: 'uppercase'}}>{text}</div>
      );
    })}
  </div>
);

function Quebec1759({f}) {
  // the camera zooms by re-projecting the map (sharp at every zoom; a CSS scale of a 3D layer blurs it)
  const base = geoMercator().fitExtent([[720, 650], [PW - 720, PH - 650]], {type: 'MultiPoint', coordinates: [[-75, 44.5], [-57, 50.3]]}).scale();
  const keys = [[0, [-64.2, 47.7], 1], [140, [-68.8, 47.6], 1.5], [225, [-71.25, 46.815], 34], [390, [-71.25, 46.815], 36]];
  let cam = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const [a, ca, za] = keys[i - 1], [b, cb, zb] = keys[i];
    if (f >= a) {
      const e = lerp(f, a, b, 0, 1);
      const zz = Math.exp(Math.log(za) + (Math.log(zb) - Math.log(za)) * e);
      const w = (1 / zz - 1 / za) / (1 / zb - 1 / za || 1);   // the centre moves with the zoom, so the target stays in view
      cam = [0, [ca[0] + (cb[0] - ca[0]) * w, ca[1] + (cb[1] - ca[1]) * w], zz];
    }
  }
  const z = cam[2];
  const turn = lerp(f, 140, 225, 0, -78);
  const proj = geoMercator().scale(base * z).center(cam[1]).translate([PW / 2, PH / 2]).clipExtent([[-400, -400], [PW + 400, PH + 400]]);
  const path = geoPath(proj);
  const P = (lon, lat) => proj([lon, lat]);
  const cx = PW / 2, cy = PH / 2;
  // the fleet: up the Saint Lawrence (summer 1759), anchoring off the cliffs west of the town
  const route = [[-59.6, 47.7], [-63.6, 49.2], [-67.2, 48.9], [-69.6, 47.9], [-70.6, 47.15], [-71.05, 46.86], [-71.2, 46.79], [-71.27, 46.772]];
  const along = (p) => {
    const segs = route.length - 1, u = Math.min(segs - 1e-6, p * segs), i = Math.floor(u), t = u - i;
    return [route[i][0] + (route[i + 1][0] - route[i][0]) * t, route[i][1] + (route[i + 1][1] - route[i][1]) * t];
  };
  const ships = [0, 1, 2].map((i) => {
    const p = lerp(f, 16 + i * 16, 200 + i * 8, 0, 1) * (1 - i * 0.012);
    const [lon, lat] = along(p);
    const k = Math.pow(p, 6);   // near the end, each anchors further downstream
    return {lon: lon + i * 0.045 * k, lat: lat + i * 0.02 * k, op: lerp(f, i * 10, 18 + i * 10, 0, 1)};
  });
  // the battle (13 September): Wolfe's line west, formed after climbing from the river; Montcalm's line out of the town to the east;
  // they close, fire, and the French line breaks and falls back to the town
  const rows = [46.802, 46.818, 46.834, 46.85];
  const ukX = lerp(f, 228, 280, -71.300, -71.285), frX = lerp(f, 240, 282, -71.222, -71.245);
  const fireUK = lerp(f, 292, 300, 0, 1) - lerp(f, 300, 312, 0, 1), fireFR = lerp(f, 286, 294, 0, 1) - lerp(f, 294, 306, 0, 1);
  const back = lerp(f, 318, 350, 0, 0.03);
  const town = {lon: -71.207, lat: 46.813};
  const flagDown = lerp(f, 330, 352, 0, 1), flagUp = lerp(f, 355, 380, 1, 0);
  const flag = f < 353 ? {node: <Bourbon />, drop: flagDown, op: 1} : {node: <Union1606 />, drop: flagUp, op: 1};
  const show = (a) => f >= a;
  const lit = lerp(f, 0, 30, 0, 1);
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 30%, #2A2420 0%, #0B0907 75%)'}}>
      <div style={{position: 'absolute', left: (W - PW) / 2, top: (H - PH) / 2, width: PW, height: PH, transformStyle: 'preserve-3d', opacity: lit,
                   transform: `perspective(1900px) rotateX(${TILT}deg) rotateZ(${turn}deg)`}}>
        {/* the table: a dark wood frame under the map */}
        <div style={{position: 'absolute', left: -140, top: -140, width: PW + 280, height: PH + 280, borderRadius: 18,
                     background: 'linear-gradient(135deg, #5A3A22, #2E1C10 60%, #1A0F08)', boxShadow: '0 40px 120px rgba(0,0,0,0.8)'}} />
        <svg width={PW} height={PH} style={{position: 'absolute', left: 0, top: 0}}>
          <defs>
            <radialGradient id="sea" cx="40%" cy="35%" r="80%"><stop offset="0" stopColor="#24456A" /><stop offset="1" stopColor="#0C1D38" /></radialGradient>
            <radialGradient id="land" cx="35%" cy="30%" r="90%"><stop offset="0" stopColor="#4A5A70" /><stop offset="1" stopColor="#25334C" /></radialGradient>
            <filter id="emb"><feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.55" /></filter>
          </defs>
          <rect width={PW} height={PH} fill="url(#sea)" />
          <g filter="url(#emb)">
            {stl.land.features.map((ft, i) => <path key={i} d={path(ft)} fill="url(#land)" stroke="rgba(235,244,255,0.65)" strokeWidth={1.6} />)}
          </g>
          <path d={path(stl.rivers)} fill="none" stroke="#5FB7E6" strokeWidth={2.4} opacity={0.8} />
          {/* the fleet's wake */}
          <path d={path({type: 'LineString', coordinates: [route[0], along(lerp(f, 20, 190, 0, 1))]})} fill="none" stroke="#F2EEE4" strokeWidth={3}
                strokeDasharray="12 10" opacity={0.7 * (1 - lerp(f, 200, 230, 0, 1))} />
          {/* the plains: a faint field where the battle is fought */}
          <ellipse cx={P(-71.265, 46.826)[0]} cy={P(-71.265, 46.826)[1]} rx={0.05 * Math.PI / 180 * base * z} ry={0.04 * Math.PI / 180 * base * z} fill="#8A9A5A" opacity={0.18 * lerp(f, 215, 240, 0, 1)} />
        </svg>
        {/* pieces, back to front */}
        {show(196) && <Piece turn={turn} {...xy(P(town.lon, town.lat))} z={1} s={1.15} w={190} h={230} rise={lerp(f, 196, 214, 0, 1, Easing.out(Easing.back(1.5)))}><Town flag={flag} /></Piece>}
        {rows.map((lat, i) => show(232 + i * 4) && (
          <Piece turn={turn} key={`fr${i}`} {...xy(P(frX + (i === 1 || i === 2 ? 0 : back), lat))} z={1} w={120} h={200}
                 rise={lerp(f, 232 + i * 4, 248 + i * 4, 0, 1, Easing.out(Easing.back(1.6)))} fall={i === 1 || i === 2 ? lerp(f, 308 + i * 5, 326 + i * 5, 0, 1, Easing.in(Easing.quad)) : 0}>
            <Soldier team="fr" fire={fireFR} />
          </Piece>))}
        {ships.map((s, i) => <Piece turn={turn} key={`sh${i}`} {...xy(P(s.lon, s.lat))} z={1} s={0.75} w={170} h={210} op={s.op}><Ship team="uk" /></Piece>)}
        {rows.map((lat, i) => show(226 + i * 4) && (
          <Piece turn={turn} key={`uk${i}`} {...xy(P(ukX, lat))} z={1} w={120} h={200} rise={lerp(f, 226 + i * 4, 242 + i * 4, 0, 1, Easing.out(Easing.back(1.6)))}>
            <Soldier team="uk" fire={fireUK} />
          </Piece>))}
        {[0, 1, 2, 3].map((i) => f > 286 && f < 330 && (
          <Piece turn={turn} key={`sm${i}`} {...xy(P((i % 2 ? ukX + 0.008 : frX - 0.008), rows[i]))} z={1} w={140} h={120}>
            <Smoke k={lerp(f, 286 + i * 3, 326 + i * 3, 0, 1, Easing.out(Easing.quad))} />
          </Piece>))}
      </div>
      {/* the light: a warm lamp over the table, the edges in shadow */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 45% 35%, rgba(255,214,150,0.16), rgba(0,0,0,0) 55%)', mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.7) 100%)'}} />
      <Title f={f} items={[['Quebec, 1759', 12, true], ['The Plains of Abraham, 13 September', 228], ['Quebec falls to Britain', 352]]} />
      <div style={{position: 'absolute', right: 28, bottom: 20, fontFamily: 'Space Grotesk', fontSize: 15, color: 'rgba(200,190,170,0.5)'}}>Map data: Natural Earth (public domain)</div>
    </AbsoluteFill>
  );
}

function xy([x, y]) {
  return {x, y};
}

const SCENES = {quebec1759: Quebec1759};
export const WAR_FRAMES = {quebec1759: 390};

export const WarTable = ({id = 'quebec1759', frame}) => {
  const cur = useCurrentFrame();
  const f = frame != null ? Number(frame) : cur;
  const Scene = SCENES[id] || Quebec1759;
  return (
    <AbsoluteFill>
      <style>{FONT_CSS}</style>
      <Scene f={f} />
    </AbsoluteFill>
  );
};
