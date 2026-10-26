// Bassel's long video (France's overseas lands), 2026-10-26: short animated scenes of key events, drawn in the kit's flat outlined look
// (the owner: no Gemini, "you animate them"). Each is ~9 s at 30 fps, rendered on its own (composition FranceEvent, prop id) and laid
// over the map story by maplong. Facts: Cartier's cross at Gaspe (24 July 1534, the King's arms, "Vive le Roy de France"); Champlain's
// Habitation at Quebec (1608); the Treaty of Paris (10 February 1763); the flag change in New Orleans' Place d'Armes (20 December 1803).
import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {W, H, INK, ST, st, lin, Label, Figure, CAST, Cam, rng} from './tis';
import {FONT_CSS} from './fonts';

Object.assign(CAST, {
  cartier: {hair: '#3A2A1E', hairLight: '#5A4030', brow: '#2A1A10', dress: '#6E1F2A', dressShade: '#521620', style: 'short', beard: true, hat: 'brim', pants: '#2E2A26'},
  champlain: {hair: '#4A3628', hairLight: '#6A5040', brow: '#33241A', dress: '#2F5D50', dressShade: '#22463C', style: 'short', beard: true, mustache: true, hat: 'brim', plume: '#C9A227', pants: '#2E2A26'},
  sailor1: {hair: '#2B1A10', hairLight: '#4A2E1C', brow: '#22140A', dress: '#8A6A44', dressShade: '#6E5234', style: 'short', hat: 'cap', beard: true, pants: '#4A4038'},
  sailor2: {hair: '#6B4423', hairLight: '#8A5A30', brow: '#4A2E17', dress: '#3E5468', dressShade: '#2E4052', style: 'short', mustache: true, pants: '#4A4038'},
  iroq1: {hair: '#16110E', hairLight: '#2E2620', brow: '#0E0A08', dress: '#9C6B3E', dressShade: '#7A522E', style: 'long', skin: 'tan', pants: '#7A522E'},
  iroq2: {hair: '#16110E', hairLight: '#2E2620', brow: '#0E0A08', dress: '#A8774A', dressShade: '#875E38', style: 'short', skin: 'tan', pants: '#875E38'},
  dip_fr: {hair: '#E8E4DA', hairLight: '#F4F1EA', brow: '#8A8070', dress: '#2B4A9B', dressShade: '#1F3775', style: 'short', hat: 'wig', pants: '#F2EEE4'},
  dip_uk: {hair: '#E8E4DA', hairLight: '#F4F1EA', brow: '#8A8070', dress: '#A3262A', dressShade: '#7E1C20', style: 'short', hat: 'wig', pants: '#2E2A26'},
  dip_es: {hair: '#E8E4DA', hairLight: '#F4F1EA', brow: '#8A8070', dress: '#2E2A26', dressShade: '#1C1A18', style: 'short', hat: 'wig', mustache: true, pants: '#2E2A26'},
  sol_fr: {hair: '#3A2A1E', hairLight: '#5A4030', brow: '#2A1A10', dress: '#2B4A9B', dressShade: '#1F3775', style: 'short', hat: 'bicorne', mustache: true, pants: '#F2EEE4'},
  sol_us: {hair: '#6B4423', hairLight: '#8A5A30', brow: '#4A2E17', dress: '#1E2C4F', dressShade: '#141F38', style: 'short', hat: 'bicorne', cockade: '#1F1B18', pants: '#F2EEE4'},
});

// a figure standing on the ground at (x, ground), s = scale (the kit draws people ~1300 units tall)
const P = ({x, ground, s, children}) => <g transform={`translate(${x} ${ground - 1090 * s}) scale(${s})`}>{children}</g>;

const Sky = ({top = '#8FCBE3', bottom = '#EAF5F1'}) => (
  <g><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient></defs>
    <rect x={-200} y={-200} width={W + 400} height={H + 400} fill="url(#sky)" /></g>
);

const Pine = ({x, y, s = 1, c = '#2F6B45'}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-8} y={-20} width={16} height={40} fill="#5A3A22" {...st(4)} />
    <path d="M 0 -180 L 54 -90 L 30 -90 L 70 -20 L -70 -20 L -30 -90 L -54 -90 Z" fill={c} {...st(5)} />
  </g>
);

const Waves = ({f, y0, x0 = -100, x1 = W + 100, n = 5}) => (
  <g stroke="#E8F6FF" strokeWidth={4} fill="none" opacity={0.55} strokeLinecap="round">
    {[...Array(n)].map((_, i) => {
      const y = y0 + i * 70, off = ((f * (1.2 + i * 0.3)) % 160);
      return <path key={i} d={[...Array(16)].map((__, k) => `M ${x0 + k * 160 - off} ${y} q 20 -10 40 0`).join(' ')} />;
    })}
  </g>
);

// a 1500s-1600s sailing ship, side view, facing right; flag = colour of its pennants
export const Galleon = ({x, y, s = 1, f = 0, sails = 1, flag = '#F2EEE4'}) => {
  const roll = Math.sin(f / 18) * 1.6, bob = Math.sin(f / 14) * 4;
  const mast = (mx, h, w) => (
    <g>
      <line x1={mx} y1={0} x2={mx} y2={-h} {...st(6)} />
      {sails > 0 && <path d={`M ${mx - w} ${-h + 30} Q ${mx + 14} ${-h + 30 + 60 * sails} ${mx + w} ${-h + 30} L ${mx + w} ${-h + 30 + 120 * sails} Q ${mx + 20} ${-h + 50 + 150 * sails} ${mx - w} ${-h + 30 + 120 * sails} Z`} fill="#F2EAD6" {...st(5)} />}
      <path d={`M ${mx} ${-h} l 46 10 l -46 10 Z`} fill={flag} {...st(4)} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s}) rotate(${roll})`}>
      {mast(-90, 250, 70)}{mast(30, 300, 84)}{mast(140, 220, 58)}
      <line x1={200} y1={-10} x2={300} y2={-80} {...st(5)} />
      <path d="M -230 -70 L -130 -70 L -120 -10 L 200 -10 L 250 -40 L 230 10 C 200 70 -170 80 -210 40 Z" fill="#7A4A2A" {...ST} />
      <path d="M -220 -30 L 220 -20" stroke="#E0B85A" strokeWidth={8} />
      {[...Array(6)].map((_, i) => <rect key={i} x={-90 + i * 50} y={8} width={20} height={14} fill="#2E1C10" />)}
    </g>
  );
};

const Longboat = ({x, y, s = 1, f = 0, row = true}) => {
  const k = row ? Math.sin(f / 5) * 18 : 0;
  return (
    <g transform={`translate(${x} ${y + Math.sin(f / 10) * 3}) scale(${s})`}>
      {[-50, 0, 50].map((ox, i) => (
        <g key={i}><line x1={ox} y1={-10} x2={ox - 50 + k} y2={40} stroke="#5A3A22" strokeWidth={7} /><circle cx={ox} cy={-40} r={20} fill="#E3B08A" {...st(4)} /><path d={`M ${ox - 22} -18 L ${ox + 22} -18 L ${ox + 18} 0 L ${ox - 18} 0 Z`} fill="#8A6A44" {...st(4)} /></g>
      ))}
      <path d="M -110 -4 L 110 -4 L 90 30 L -90 30 Z" fill="#8A5A30" {...ST} />
    </g>
  );
};

const Fleur = ({x, y, s = 1, c = '#E0B85A'}) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M 0 -30 C 12 -16 12 -4 4 6 L 18 4 C 26 -10 40 -6 36 8 C 32 18 20 16 14 12 L 6 14 L 6 30 L -6 30 L -6 14 L -14 12 C -20 16 -32 18 -36 8 C -40 -6 -26 -10 -18 4 L -4 6 C -12 -4 -12 -16 0 -30 Z" fill={c} {...st(2)} />
);

const Title = ({f, lines}) => lines.map(([text, at], i) => <Label key={i} x={80} y={70 + i * 100} text={text} f={f} at={at} h={i ? 64 : 78} />);

// ───────── 1. Gaspe, 1534: Cartier's men raise a cross for the King of France, watched by the people who lived there
function Gaspe({f}) {
  const up = lin(f, 95, 175, -80, 0);
  return (
    <Cam f={f} len={270} from={1} to={1.06} x={1150} y={700}>
      <Sky />
      <path d="M -100 640 C 300 560 600 590 900 600 L 900 700 L -100 700 Z" fill="#7FA8B8" opacity={0.7} />
      <rect x={-100} y={620} width={W + 200} height={500} fill="#3D7FA8" />
      <Waves f={f} y0={680} x1={1100} />
      <path d="M 1000 1180 C 1040 900 1080 720 1180 640 L 2100 600 L 2100 1180 Z" fill="#E5C88E" {...st(6)} />
      <path d="M 1140 650 C 1300 610 1600 590 2100 580 L 2100 640 C 1700 640 1400 650 1180 660 Z" fill="#6E9E4E" />
      {[...Array(14)].map((_, i) => <Pine key={i} x={1180 + i * 70 + (i % 2) * 20} y={620 - (i % 3) * 8} s={0.9 + (i % 3) * 0.15} c={i % 2 ? '#2F6B45' : '#3A7A50'} />)}
      <Galleon x={170} y={600} s={0.55} f={f + 40} sails={0.4} />
      <Galleon x={520} y={650} s={0.95} f={f} sails={0.3} />
      <Longboat x={lin(f, 0, 80, 620, 990)} y={790} s={0.9} f={f} row={f < 80} />
      {/* the people who lived there, at the edge of the trees, watching */}
      <P x={1700} ground={720} s={0.2}><Figure who="iroq1" pose="stand" f={f} seed={3} look={-10} /></P>
      <P x={1800} ground={712} s={0.2}><Figure who="iroq2" pose={f > 150 ? 'shade' : 'stand'} f={f} seed={5} look={-10} /></P>
      {/* the cross: 9 m of wood with the King's arms, pushed up from its base */}
      <g transform={`translate(1420 900) rotate(${up})`}>
        <rect x={-14} y={-560} width={28} height={560} fill="#8A5A30" {...ST} />
        <rect x={-120} y={-470} width={240} height={26} fill="#8A5A30" {...ST} />
        <path d="M -44 -420 L 44 -420 L 44 -360 C 44 -330 20 -316 0 -308 C -20 -316 -44 -330 -44 -360 Z" fill="#2B4A9B" {...st(4)} />
        <Fleur x={-18} y={-392} s={0.45} /><Fleur x={18} y={-392} s={0.45} /><Fleur x={0} y={-350} s={0.45} />
      </g>
      <P x={lin(f, 70, 140, 1040, 1180)} ground={930} s={0.27}><Figure who="cartier" pose={f < 140 && f > 70 ? 'walk' : f > 190 ? 'signal' : 'stand'} dir={1} f={f} seed={1} /></P>
      <P x={1330} ground={920} s={0.25}><Figure who="sailor1" pose={f > 90 && f < 175 ? 'push' : 'stand'} f={f} seed={2} /></P>
      <P x={1530} ground={915} s={0.25}><Figure who="sailor2" pose={f > 90 && f < 175 ? 'push' : 'stand'} f={f} seed={4} /></P>
      <Title f={f} lines={[['GASPE, 1534', 6], ['A CROSS FOR THE KING OF FRANCE', 178]]} />
    </Cam>
  );
}

// ───────── 2. Quebec, 1608: Champlain's men build the Habitation under the cliff
function Quebec({f}) {
  const wall = (i) => lin(f, 30 + i * 40, 110 + i * 40, 0, 1);
  const bld = (x, w, h, i) => {
    const k = wall(i);
    if (k < 0.02) return null;
    return (
      <g key={i}>
        <rect x={x} y={820 - h * k} width={w} height={h * k} fill="#A0703F" {...ST} />
        {k > 0.98 && <path d={`M ${x - 16} ${820 - h} L ${x + w / 2} ${820 - h - 90} L ${x + w + 16} ${820 - h} Z`} fill="#5A3A22" {...ST} />}
        {k > 0.6 && [0, 1].map((j) => <rect key={j} x={x + 26 + j * (w - 80)} y={820 - h * 0.62} width={28} height={36} fill="#3A2412" />)}
      </g>
    );
  };
  return (
    <Cam f={f} len={270} from={1.02} to={1.08} x={900} y={700}>
      <Sky top="#A9D4E6" />
      <rect x={-100} y={720} width={W + 200} height={420} fill="#4A86A8" />
      <Waves f={f} y0={880} x0={1100} />
      <path d="M -100 860 L -100 220 C 80 200 240 260 380 330 C 470 380 560 520 640 700 L 700 860 Z" fill="#8D9A8A" {...ST} />
      <path d="M -100 240 C 120 210 260 260 380 330" fill="none" stroke="#5E7A55" strokeWidth={40} />
      {[...Array(6)].map((_, i) => <Pine key={i} x={-40 + i * 70} y={240 + i * 16} s={0.7} />)}
      <path d="M -100 860 L 1250 860 C 1280 830 1300 800 1260 780 L -100 780 Z" fill="#7FA05A" {...st(5)} />
      {bld(560, 170, 200, 0)}{bld(740, 140, 240, 1)}{bld(890, 180, 190, 2)}
      {f > 200 && [...Array(10)].map((_, i) => <rect key={i} x={540 + i * 40} y={lin(f, 200 + i * 2, 220 + i * 2, 860, 790)} width={22} height={70} fill="#8A5A30" {...st(4)} />)}
      <line x1={1110} y1={820} x2={1110} y2={500} {...st(6)} />
      <g transform={`translate(1110 ${lin(f, 200, 250, 800, 510)})`} opacity={f >= 200 ? 1 : 0}>
        <path d={`M 0 0 L 110 ${Math.sin(f / 6) * 6} L 110 ${70 + Math.sin(f / 6) * 6} L 0 70 Z`} fill="#F2EEE4" {...st(4)} />
        <Fleur x={55} y={35} s={0.6} />
      </g>
      <Galleon x={1650} y={800} s={0.75} f={f} sails={0} />
      <P x={lin(f, 0, 160, -120, 420)} ground={880} s={0.24}><Figure who="sailor1" pose={f < 160 ? 'walk' : 'stand'} dir={1} f={f} seed={2} /></P>
      <P x={lin(f, 0, 160, -260, 280)} ground={884} s={0.24}><Figure who="sailor2" pose={f < 160 ? 'walk' : 'stand'} dir={1} f={f + 9} seed={4} /></P>
      <rect x={lin(f, 0, 160, -300, 240)} y={lin(f, 0, 160, 700, 700)} width={240} height={26} rx={12} fill="#7A4A2A" {...st(5)} />
      <P x={1250} ground={900} s={0.27}><Figure who="champlain" pose="hold" f={f} seed={1} talk={f > 120 && f < 200} look={-12} /></P>
      <Title f={f} lines={[['QUEBEC, 1608', 6], ["CHAMPLAIN'S HABITATION", 150]]} />
    </Cam>
  );
}

// ───────── 3. Paris, 10 February 1763: France, Britain and Spain sign; the map on the wall changes hands
function Treaty({f}) {
  const k = lin(f, 120, 175, 0, 1);
  const sig = lin(f, 50, 120, 1, 0);
  return (
    <Cam f={f} len={270} from={1} to={1.05} x={960} y={560}>
      <rect x={-100} y={-100} width={W + 200} height={H + 200} fill="#E9DCC3" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={60 + i * 380} y={80} width={300} height={560} fill="none" stroke="#C9B48E" strokeWidth={8} />)}
      <rect x={120} y={120} width={190} height={440} fill="#9CC9E0" {...st(6)} />
      <path d="M 215 120 L 215 560 M 120 340 L 310 340" {...st(6)} />
      {/* the map on the wall: French claims in blue turn British red (east) and Spanish gold (west) */}
      <g transform="translate(720 120)">
        <rect x={0} y={0} width={480} height={330} fill="#F2EAD6" {...ST} />
        <path d="M 60 40 C 160 20 300 30 420 60 C 440 120 400 170 360 210 C 330 250 300 300 250 310 C 200 300 150 270 120 220 C 80 170 50 110 60 40 Z" fill="#CFE0C8" {...st(4)} />
        <path d="M 200 70 C 260 60 330 80 380 100 C 360 150 330 190 300 220 C 280 240 260 260 250 290 C 240 250 230 200 220 150 C 210 120 200 100 200 70 Z" fill={k > 0 ? `rgb(${Math.round(63 + 137 * k)},${Math.round(184 - 104 * k)},${Math.round(222 - 132 * k)})` : '#3FB8DE'} opacity={0.85} {...st(3)} />
        <path d="M 120 90 C 150 80 180 80 200 90 C 210 150 225 220 245 290 C 200 280 160 250 130 210 C 110 170 110 130 120 90 Z" fill={k > 0 ? `rgb(${Math.round(63 + 164 * k)},${Math.round(184 - 1 * k)},${Math.round(222 - 132 * k)})` : '#3FB8DE'} opacity={0.85} {...st(3)} />
        <text x={240} y={36} textAnchor="middle" style={{fontFamily: 'Oswald', fontSize: 26, fill: INK}}>NORTH AMERICA</text>
      </g>
      {/* chandelier */}
      <line x1={960} y1={-100} x2={960} y2={40} {...st(4)} />
      <path d="M 880 40 L 1040 40 L 1000 80 L 920 80 Z" fill="#D9B44A" {...st(4)} />
      {[880, 960, 1040].map((x) => <g key={x}><rect x={x - 6} y={14} width={12} height={26} fill="#F2EEE4" {...st(3)} /><ellipse cx={x} cy={8} rx={6} ry={10} fill="#FFD166" /></g>)}
      <rect x={-100} y={760} width={W + 200} height={400} fill="#8A5A3A" />
      <P x={600} ground={1150} s={0.5}><Figure who="dip_fr" pose="stand" f={f} seed={1} talk={f > 180} expr="grim" /></P>
      <P x={960} ground={1150} s={0.5}><Figure who="dip_uk" pose="stand" f={f} seed={2} expr="smile" /></P>
      <P x={1320} ground={1150} s={0.5}><Figure who="dip_es" pose="stand" f={f} seed={3} /></P>
      <path d="M 300 760 L 1620 760 L 1680 820 L 240 820 Z" fill="#2F6B45" {...ST} />
      <rect x={240} y={820} width={1440} height={300} fill="#6B3F22" {...ST} />
      <path d="M 820 772 L 1100 772 L 1110 812 L 810 812 Z" fill="#F7F1E3" {...st(4)} />
      <path d="M 860 798 C 890 780 910 806 940 790 C 970 776 990 806 1030 788" fill="none" stroke="#1F2A44" strokeWidth={4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={sig} />
      <g transform={`translate(${lin(f, 50, 120, 860, 1030)} ${790 + Math.sin(f / 3) * (f > 50 && f < 120 ? 6 : 0)}) rotate(-35)`}>
        <path d="M 0 0 L 6 -120 C 30 -100 34 -60 6 -10 Z" fill="#F2EEE4" {...st(3)} />
      </g>
      <Title f={f} lines={[['PARIS, 10 FEBRUARY 1763', 6], ['THE TREATY OF PARIS', 125]]} />
    </Cam>
  );
}

// ───────── 4. New Orleans, 20 December 1803: in the Place d'Armes the French flag comes down and the American flag goes up
const Tricolour = ({f}) => (
  <g transform={`skewY(${Math.sin(f / 7) * 3})`}>
    <rect x={0} y={0} width={60} height={110} fill="#2B4A9B" /><rect x={60} y={0} width={60} height={110} fill="#F2F2F2" /><rect x={120} y={0} width={60} height={110} fill="#C8102E" />
    <rect x={0} y={0} width={180} height={110} fill="none" {...st(4)} />
  </g>
);
const StarsAndStripes = ({f}) => (   // 1803: 15 stripes, 15 stars
  <g transform={`skewY(${Math.sin(f / 7) * 3})`}>
    {[...Array(15)].map((_, i) => <rect key={i} x={0} y={i * (110 / 15)} width={180} height={110 / 15 + 0.5} fill={i % 2 ? '#F2F2F2' : '#B22234'} />)}
    <rect x={0} y={0} width={80} height={110 * 8 / 15} fill="#3C3B6E" />
    {[...Array(15)].map((_, i) => <circle key={i} cx={10 + (i % 5) * 15} cy={9 + Math.floor(i / 5) * 18} r={3.2} fill="#F2F2F2" />)}
    <rect x={0} y={0} width={180} height={110} fill="none" {...st(4)} />
  </g>
);
function Flags({f}) {
  const fr = lin(f, 30, 120, 200, 780), us = lin(f, 140, 235, 780, 200);
  const R = rng(9);
  return (
    <Cam f={f} len={270} from={1} to={1.06} x={960} y={520}>
      <Sky top="#F2C18A" bottom="#FBE8CF" />
      {/* the cathedral and the Cabildo on the square */}
      <g fill="#EDE6D6" {...ST}>
        <rect x={700} y={330} width={520} height={420} /><path d="M 700 330 L 960 230 L 1220 330 Z" />
        <rect x={680} y={250} width={80} height={500} /><path d="M 680 250 L 720 150 L 760 250 Z" fill="#3A3A3A" />
        <rect x={1160} y={250} width={80} height={500} /><path d="M 1160 250 L 1200 150 L 1240 250 Z" fill="#3A3A3A" />
        <rect x={930} y={170} width={60} height={100} /><path d="M 930 170 L 960 80 L 990 170 Z" fill="#3A3A3A" />
        <rect x={100} y={420} width={520} height={330} /><rect x={1300} y={420} width={520} height={330} />
      </g>
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M ${130 + i * 100} 750 L ${130 + i * 100} 560 C ${130 + i * 100} 510 ${200 + i * 100} 510 ${200 + i * 100} 560 L ${200 + i * 100} 750`} fill="#B9AE98" {...st(4)} />)}
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M ${1330 + i * 100} 750 L ${1330 + i * 100} 560 C ${1330 + i * 100} 510 ${1400 + i * 100} 510 ${1400 + i * 100} 560 L ${1400 + i * 100} 750`} fill="#B9AE98" {...st(4)} />)}
      <rect x={-100} y={750} width={W + 200} height={400} fill="#CDB892" />
      {/* the crowd watching, at the back */}
      {[...Array(26)].map((_, i) => { const x = 60 + i * 70 + R() * 30, y = 790 + R() * 20;
        return <g key={i} opacity={0.85}><circle cx={x} cy={y - 40} r={18} fill={['#5A4636', '#3A2A20', '#7A6050'][i % 3]} /><path d={`M ${x - 26} ${y + 30} C ${x - 26} ${y - 16} ${x + 26} ${y - 16} ${x + 26} ${y + 30} Z`} fill={['#4A5D7A', '#6B5A48', '#7C2D12', '#3F4A5A'][i % 4]} /></g>; })}
      <line x1={960} y1={980} x2={960} y2={180} stroke={INK} strokeWidth={10} />
      <circle cx={960} cy={176} r={12} fill="#D9B44A" {...st(4)} />
      {f < 130 && <g transform={`translate(966 ${fr})`}><Tricolour f={f} /></g>}
      {f > 135 && <g transform={`translate(966 ${us})`}><StarsAndStripes f={f} /></g>}
      <P x={560} ground={1040} s={0.3}><Figure who="sol_fr" pose="stand" f={f} seed={1} expr={f > 120 ? 'sad' : 'calm'} /></P>
      <P x={740} ground={1050} s={0.3}><Figure who="sol_fr" pose="stand" f={f} seed={6} /></P>
      <P x={1180} ground={1050} s={0.3}><Figure who="sol_us" pose={f > 235 ? 'signal' : 'stand'} f={f} seed={2} /></P>
      <P x={1360} ground={1040} s={0.3}><Figure who="sol_us" pose="stand" f={f} seed={7} expr={f > 235 ? 'smile' : 'calm'} /></P>
      <Title f={f} lines={[['NEW ORLEANS, 20 DECEMBER 1803', 6], ['FRENCH FLAG DOWN, AMERICAN FLAG UP', 140]]} />
    </Cam>
  );
}

const SCENES = {gaspe: Gaspe, quebec: Quebec, treaty: Treaty, flags: Flags};

export const FranceEvent = ({id = 'gaspe', frame}) => {
  const cur = useCurrentFrame();
  const f = frame != null ? Number(frame) : cur;
  const Scene = SCENES[id] || Gaspe;
  const fade = interpolate(f, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#0A1426'}}>
      <style>{FONT_CSS}</style>
      <svg width={W} height={H} style={{opacity: fade}}><Scene f={f} /></svg>
    </AbsoluteFill>
  );
};
