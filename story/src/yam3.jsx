// Storygraphics #4 (2.72.0), part 3: the stamp, the bomber, the fork in the road, Nagasaki (the harbour, the doctor, the door, home),
// the calendar, Bockscar and its targets, Everest, the yield bars, the 43-second counter, the valley, the office windows, the
// textbooks, the bandages, the tunnel, the black rain, the counts, the stadiums, the sick week, the radio, the lanterns, the years,
// and a quote card. Respectful as in yam.jsx: no bodies, no wounds, the bombs as light, rings and numbers.
import React from 'react';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Figure, Torso, Head, Box, Cloud, at, Labels} from './tis';
import {P, Txt, Cam, popAt, popBy} from './meg2';
import {YBust, B29, Chute, Hanko, House, Morning, Street, Field, Ruins, Burst, JapanLand, PLACES_JP, Baby, Crane} from './yam';

const OSW = "'Oswald', sans-serif";
const pz = (f, a, k = 140) => clamp(pop(f, a, k, 12), 0, 1.1);
const Plate = ({x, y, w, h = 130, text, sub, s = 1, fill = '#fff', ink = INK, size}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-w / 2 + 8} y={-h / 2 + 10} width={w} height={h} fill="#000" opacity={0.3} />
    <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} {...st(6)} />
    <Txt x={0} y={sub ? -h * 0.02 : h * 0.18} text={text} size={size || h * 0.5} fill={ink} stroke="none" />
    {sub && <Txt x={0} y={h * 0.36} text={sub} size={h * 0.24} fill={ink === INK ? '#475569' : ink} stroke="none" />}
  </g>
);
const Clock = ({x, y, r = 90, time = '8:15', s = 1}) => {
  const [hh, mm] = String(time).split(':').map(Number);
  const ma = mm / 60 * 360, ha = ((hh % 12) + mm / 60) / 12 * 360, rad = (d) => d * Math.PI / 180;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r={r} fill="#FBF7EC" {...st(8)} />
      {[...Array(12)].map((_, i) => <path key={i} d={`M ${Math.sin(rad(i * 30)) * r * 0.8} ${-Math.cos(rad(i * 30)) * r * 0.8} L ${Math.sin(rad(i * 30)) * r * 0.92} ${-Math.cos(rad(i * 30)) * r * 0.92}`} stroke={INK} strokeWidth={5} />)}
      <path d={`M 0 0 L ${Math.sin(rad(ha)) * r * 0.5} ${-Math.cos(rad(ha)) * r * 0.5}`} stroke={INK} strokeWidth={10} strokeLinecap="round" />
      <path d={`M 0 0 L ${Math.sin(rad(ma)) * r * 0.76} ${-Math.cos(rad(ma)) * r * 0.76}`} stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <circle r={9} fill="#E3232C" />
    </g>
  );
};

// ───────────── "Japanese paperwork ... at a quarter past eight": a form, the seal coming down, a clock at 8:15 ─────────────
function YStamp({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'paperwork', 0.3);
  const down = clamp((f - a) / 6, 0, 1), up = clamp((f - a - 10) / 8, 0, 1);
  const y = -260 + 230 * down - 230 * up;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#7B5A3A" />
      <g transform="translate(760 560) rotate(-4)">
        <rect x={-380} y={-440} width={760} height={880} fill="#FBF7EC" {...st(8)} />
        {[...Array(9)].map((_, i) => <rect key={i} x={-310} y={-340 + i * 70} width={i % 3 === 2 ? 380 : 560} height={18} fill="#CBD5E1" />)}
        <rect x={-310} y={-410} width={300} height={34} fill="#94A3B8" />
        {f > a + 5 && <g transform="translate(200 280)" opacity={0.9}><circle r={58} fill="none" stroke="#D7262E" strokeWidth={8} />
          <path d="M 0 -40 L 0 -4 M -22 -28 L -22 -4 M 22 -28 L 22 -4 M -24 -4 L 24 -4 M -16 10 L 16 10 L 16 34 L -16 34 Z" stroke="#D7262E" strokeWidth={8} fill="none" strokeLinejoin="round" /></g>}
        <g transform={`translate(200 ${280 + y})`}>
          <rect x={-40} y={-200} width={80} height={200} rx={16} fill="#8B3A2E" {...st(6)} />
          <ellipse cx={0} cy={-200} rx={40} ry={14} fill="#B05A48" {...st(5)} />
        </g>
      </g>
      <Clock x={1480} y={420} r={170} time={p.time || '8:15'} s={popBy(f, line, p.clock_on || 'quarter', 0.6, 999)} />
      <Txt x={1480} y={680} text={p.clock_text || '8:15 AM'} size={90} fill="#FFE11A" op={popAt(f, line, p.clock_on || 'quarter', 0.6) > 0.5 ? 1 : 0} />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the bomber from below, the bomb bay opening; an altitude plate ─────────────
function YBomber({f, len, line}) {
  const p = P(line);
  const o = at(line, p.open_on || 'opens', 0.8);
  const k = clamp((f - o) / 10, 0, 1);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.08}>
      <linearGradient id="ybmsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.dark ? '#3B4C6B' : '#2F6FB8'} /><stop offset="1" stopColor={p.dark ? '#8C99AE' : '#BFD9EE'} /></linearGradient>
      <rect width={W} height={H} fill="url(#ybmsky)" />
      {p.clouds && [0, 1, 2, 3].map((i) => <Cloud key={i} x={200 + i * 520 - f * 0.6} y={880 + (i % 2) * 60} s={1.6} op={0.95} />)}
      <g transform={`translate(${lin(f, 0, len, 820, 1060)} 470) rotate(-8) scale(0.78)`}>
        <B29 f={f} tone={p.tone} />
        <rect x={-90} y={-26} width={140} height={52} fill="#1A1F27" opacity={k} />
        {k > 0 && <g><rect x={-94} y={-26 - 30 * k} width={146} height={20} fill="#9AA5B0" {...st(4)} /><rect x={-94} y={26 + 10 * k} width={146} height={20} fill="#9AA5B0" {...st(4)} /></g>}
      </g>
      {p.name && <g transform={`translate(${lin(f, 0, len, 820, 1060) + 240} 300) scale(${popBy(f, line, p.name_on, 0.2, 999)})`}><rect x={-6} y={-60} width={String(p.name).length * 34 + 50} height={80} fill="#FFE11A" {...st(6)} /><text x={18} y={4} fontFamily={OSW} fontWeight={700} fontSize={60} fill={INK}>{p.name}</text></g>}
      {p.alt && <Plate x={1560} y={900} w={460} h={140} text={p.alt} sub={p.alt_sub || 'ABOVE THE CITY'} s={popAt(f, line, p.alt_on, 0.3)} fill="#0B1F3A" ink="#FFE11A" />}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the fork: the station (if he'd had his seal) or the shipyard (where he was) ─────────────
function YFork({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'station', 0.3), q = at(line, p.q_on || 'calculate', 0.8);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <Morning f={f} cranes={false} />
      <path d="M 960 1080 L 920 700 L 500 420 L 560 400 L 960 640 L 1360 400 L 1420 420 L 1000 700 L 1000 1080 Z" fill="#C9B48E" {...st(6)} />
      <g transform={`translate(470 360) scale(${pz(f, Math.min(a, 8))})`}><Plate x={0} y={0} w={420} h={110} text="THE STATION" fill="#fff" /></g>
      <g transform={`translate(1450 360) scale(${pz(f, Math.min(a, 8) + 6)})`}><Plate x={0} y={0} w={440} h={110} text="THE SHIPYARD" fill="#FFE11A" /></g>
      <g transform="translate(960 1000) scale(0.42) translate(0 -1090)"><Figure who="yamaguchi" pose="stand" f={f} expr="worried" seed={3} /></g>
      {[0, 1].map((i) => <g key={i} transform={`translate(${i ? 1450 : 470} 560) scale(${pz(f, q + i * 6)})`}><Txt x={0} y={0} text="?" size={170} fill="#E3232C" /></g>)}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── Nagasaki: green hills round a long harbour, the shipyard's cranes ─────────────
export const Harbour = ({f = 0, dim = 0, grey = 0}) => (
  <g>
    <Morning f={f} hills={false} cranes={false} />
    <path d="M 0 520 C 200 360 420 380 560 470 C 700 380 860 330 980 430 C 1120 340 1320 330 1460 440 C 1620 360 1800 380 1920 470 L 1920 760 L 0 760 Z" fill={grey ? '#7C7F79' : '#6E9A6A'} {...st(5)} />
    <path d="M 0 640 C 300 560 600 600 760 640 L 1160 640 C 1320 600 1620 560 1920 620 L 1920 760 L 0 760 Z" fill={grey ? '#8E8C84' : '#86AE78'} />
    {[...Array(22)].map((_, i) => { const x = 60 + i * 86, y = 650 + Math.sin(i * 1.7) * 20; return <g key={i}><rect x={x} y={y} width={46} height={30} fill={grey ? '#7A7068' : '#E8DCC2'} {...st(3)} /><path d={`M ${x - 6} ${y} L ${x + 23} ${y - 18} L ${x + 52} ${y} Z`} fill={grey ? '#4A4440' : '#4B5563'} {...st(3)} /></g>; })}
    <path d="M 0 760 L 1920 760 L 1920 1080 L 0 1080 Z" fill="#4E86B8" />
    <path d="M 0 760 C 500 740 1400 740 1920 760" {...st(5)} fill="none" />
    {[...Array(5)].map((_, i) => <path key={i} d={`M ${((i * 420 + f * 0.8) % 2200) - 200} ${840 + (i % 3) * 60} q 50 -12 100 0`} stroke="#9CC3E4" strokeWidth={6} fill="none" />)}
    <g opacity={0.9}><Crane x={1500} y={770} s={0.7} /><Crane x={1700} y={770} s={0.6} /></g>
    {dim > 0 && <rect width={W} height={H} fill="#000" opacity={dim} />}
  </g>
);
function YNagasaki({f, len, line}) {
  const p = P(line);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.06} y={600}>
      <Harbour f={f} grey={p.grey ? 1 : 0} />
      {p.train && <g transform={`translate(${lin(f, 0, len, -300, 700, (t) => t)} 730) scale(0.35)`}><TrainMini f={f} /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}
const TrainMini = ({f}) => (
  <g>{[0, 1, 2].map((i) => <rect key={i} x={-420 - i * 470} y={-230} width={440} height={220} rx={10} fill="#6B3B2A" {...st(7)} />)}
    <rect x={-160} y={-200} width={330} height={190} fill="#222831" {...st(7)} /><rect x={60} y={-300} width={110} height={110} fill="#2C333E" {...st(6)} /></g>
);

// ───────────── the hospital: the old classmate doesn't know him (close: the bandaged face) ─────────────
const ClinicRoom = () => (
  <g>
    <rect width={W} height={H} fill="#DDE7EA" />
    <rect y={800} width={W} height={280} fill="#9FB3B8" /><path d="M 0 800 L 1920 800" {...st(6)} />
    <rect x={160} y={140} width={300} height={230} fill="#B9D7EA" {...st(7)} /><path d="M 310 140 L 310 370" stroke={INK} strokeWidth={6} />
    <g transform="translate(1720 200)"><rect x={-60} y={-60} width={120} height={120} rx={14} fill="#fff" {...st(6)} /><path d="M -14 -40 L 14 -40 L 14 -14 L 40 -14 L 40 14 L 14 14 L 14 40 L -14 40 L -14 14 L -40 14 L -40 -14 L -14 -14 Z" fill="#E3232C" /></g>
  </g>
);
function YDoctor({f, len, line}) {
  const p = P(line);
  if (p.mode === 'close') {
    return (
      <g><Cam f={f} len={len} a={1.05} b={1.15} y={420}>
        <ClinicRoom />
        <YBust who="yamaguchi" x={960} y={480} s={1.3} expr="sad" f={f} seed={3} band />
        <g opacity={0.35}>{[[880, 470], [1010, 430], [930, 380]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={50} ry={30} fill="#3A2A22" />)}</g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  const q = popAt(f, line, p.q_on || 'recognise', 0.8);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <ClinicRoom />
      <YBust who="yamaguchi" x={620} y={470} s={0.85} expr="sad" f={f} seed={3} band turn={0.3} />
      <YBust who="classmate" x={1300} y={470} s={0.85} expr={q > 0.5 ? 'worried' : 'calm'} f={f} seed={9} turn={-0.3} look={-8} />
      {q > 0.01 && <g transform={`translate(1500 230) scale(${q})`}><path d="M -80 60 L -140 140 L -20 80" fill="#fff" {...ST} /><ellipse rx={130} ry={100} fill="#fff" {...ST} /><Txt x={0} y={40} text="?" size={130} fill="#2B6CB0" stroke="none" /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the family's door: his mother takes him for a ghost ─────────────
function YDoor({f, len, line}) {
  const p = P(line);
  const g = popAt(f, line, p.ghost_on || 'ghost', 0.6);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#C9A66B" />
      {[...Array(30)].map((_, i) => <path key={i} d={`M ${i * 66} 0 L ${i * 66} 1080`} stroke="#A9864E" strokeWidth={4} />)}
      <rect x={980} y={120} width={720} height={960} fill="#4A3A2A" {...st(8)} />
      <rect x={1020} y={160} width={640} height={920} fill="#E8DCC2" />
      {[1180, 1340, 1500].map((x) => <path key={x} d={`M ${x} 160 L ${x} 1080`} stroke="#B8A27A" strokeWidth={6} />)}
      <YBust who="ymother" x={1340} y={470} s={0.85} expr={g > 0.5 ? 'scared' : 'shock'} f={f} seed={11} turn={-0.4} />
      <YBust who="yamaguchi" x={520} y={520} s={0.95} expr="sad" f={f} seed={3} band turn={0.5} />
      {g > 0.01 && <g transform={`translate(1600 200) scale(${g})`}><path d="M -80 60 L -150 150 L -20 80" fill="#fff" {...ST} /><ellipse rx={190} ry={100} fill="#fff" {...ST} /><Txt x={0} y={30} text="A GHOST?" size={70} fill="#7C3AED" stroke="none" /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── home: the house standing, Hisako and the baby, him lying down (rest) | the empty plot (gone) ─────────────
function YHome({f, len, line}) {
  const p = P(line);
  if (p.mode === 'gone') {
    return (
      <g><Cam f={f} len={len} a={1.0} b={1.05} y={600}>
        <rect width={W} height={H} fill="#8C857C" />
        <Ruins y={760} color="#4A4440" seed={41} />
        <rect y={760} width={W} height={320} fill="#7C7268" />
        <House x={760} y={900} w={420} h={200} wall="#A8875A" roof="#3D4652" />
        <g transform="translate(1200 900)">{[...Array(16)].map((_, i) => <rect key={i} x={-200 + (i * 53) % 400} y={-20 - (i * 37) % 120} width={110} height={16} fill="#6B4F35" {...st(3)} transform={`rotate(${(i * 47) % 60 - 30})`} />)}
          <path d="M -240 0 L -200 -150 L -120 -110 L -60 -190 L 0 -120 L 80 -160 L 160 -60 L 220 0 Z" fill="#4A3A2C" {...st(5)} /></g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#E8DCC2" />
      <rect y={760} width={W} height={320} fill="#C9B48E" /><path d="M 0 760 L 1920 760" {...st(6)} />
      <rect x={160} y={120} width={420} height={300} fill="#F4ECD8" {...st(7)} />{[300, 440].map((x) => <path key={x} d={`M ${x} 120 L ${x} 420`} stroke="#A88A5E" strokeWidth={4} />)}
      <rect x={860} y={800} width={760} height={110} rx={20} fill="#F1E3C6" {...st(6)} />
      <rect x={880} y={760} width={720} height={70} rx={20} fill="#9FB7D0" {...st(6)} />
      <g transform="translate(900 790) rotate(-90) scale(0.42)"><Head who="yamaguchi" expr="closed" f={f} seed={3} /></g>
      <YBust who="hisako" x={420} y={500} s={0.8} expr="worried" f={f} seed={5} turn={0.3} />
      <g transform="translate(560 700)"><Baby s={0.8} f={f} /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the calendar: a page flips (8 -> 9), Thursday ─────────────
function YCalendar({f, len, line}) {
  const p = P(line);
  const a = at(line, p.flip_on || 'thursday', 0.3);
  const t = clamp((f - a) / 10, 0, 1);
  const page = (n, day, op = 1, sk = 1) => (
    <g opacity={op} transform={`scale(1 ${sk})`}>
      <rect x={-260} y={-300} width={520} height={600} fill="#FBF7EC" {...st(8)} />
      <rect x={-260} y={-300} width={520} height={140} fill="#E3232C" {...st(8)} />
      <Txt x={0} y={-200} text="AUGUST 1945" size={60} />
      <Txt x={0} y={110} text={String(n)} size={300} fill={INK} stroke="none" />
      <Txt x={0} y={240} text={day} size={64} fill="#475569" stroke="none" />
    </g>
  );
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <rect width={W} height={H} fill="#C9A66B" />
      <g transform="translate(700 540)">{page(p.to || 9, p.to_day || 'THURSDAY')}{t < 1 && <g transform="translate(0 -300)"><g transform={`scale(1 ${1 - t})`}><g transform="translate(0 300)">{page(p.from || 8, p.from_day || 'WEDNESDAY')}</g></g></g>}</g>
      <Plate x={1400} y={540} w={520} h={150} text={p.big || 'A WORKDAY'} s={popAt(f, line, p.big_on || 'workday', 0.6)} fill="#FFE11A" />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── Kokura under cloud, low fuel, on to Nagasaki, a gap in the clouds (a map of north Kyushu) ─────────────
function YTargets({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'kokura';
  const center = [130.4, 33.3], ppd = lin(f, 0, len, 330, 350);
  const sx = (lon) => W / 2 + (lon - center[0]) * ppd, sy = (lat) => H / 2 - (lat - center[1]) * ppd;
  const K = PLACES_JP.kokura, N = PLACES_JP.nagasaki;
  const kx = sx(K[0]), ky = sy(K[1]), nx = sx(N[0]), ny = sy(N[1]);
  const a = at(line, p.on || '', 0.3), fuel = at(line, p.fuel_on || 'fuel', 0.2), op = at(line, p.open_on || 'opening', 0.8);
  const cross = mode === 'nagasaki' ? 1 : clamp((f - at(line, p.cross_on || 'cloud', 0.85)) / 8, 0, 1);
  const route = mode === 'nagasaki' ? lin(f, fuel, fuel + 40, 0, 1) : 0;
  const hole = mode === 'nagasaki' ? clamp((f - op) / 16, 0, 1) : 0;
  const cloud = (x, y, s, o = 0.92) => <g transform={`translate(${x} ${y})`}><Cloud x={0} y={0} s={s} op={o} /></g>;
  return (
    <g>
      <JapanLand center={center} ppd={ppd} />
      <g>{[[-120, -40], [40, -70], [-40, 30], [110, 20]].map(([dx, dy], i) => <g key={i}>{cloud(kx + dx, ky + dy, 1.1)}</g>)}</g>
      {cross > 0 && <path d={`M ${kx - 90} ${ky - 90} L ${kx + 90} ${ky + 90} M ${kx + 90} ${ky - 90} L ${kx - 90} ${ky + 90}`} stroke="#E3232C" strokeWidth={22} strokeLinecap="round" opacity={cross} />}
      <g transform={`translate(${kx} ${ky - 150})`}><rect x={-120} y={-44} width={240} height={70} fill="#fff" {...st(5)} /><Txt x={0} y={10} text="KOKURA" size={48} fill={INK} stroke="none" /></g>
      {route > 0 && <path d={`M ${kx} ${ky} Q ${(kx + nx) / 2 + 120} ${(ky + ny) / 2 - 40} ${nx} ${ny}`} stroke="#E3232C" strokeWidth={10} fill="none" strokeDasharray={`${route * 900} 900`} strokeLinecap="round" />}
      {mode === 'nagasaki' && <g>
        {[[-150, -30], [-30, -80], [100, -30], [-90, 60], [60, 60]].map(([dx, dy], i) => { const away = hole * 220; const d = Math.hypot(dx, dy) || 1; return <g key={i}>{cloud(nx + dx + away * dx / d, ny + dy + away * dy / d, 1.0, 0.95 - hole * 0.25)}</g>; })}
        <g transform={`translate(${nx} ${ny - 150})`}><rect x={-140} y={-44} width={280} height={70} fill="#FFE11A" {...st(5)} /><Txt x={0} y={10} text="NAGASAKI" size={48} fill={INK} stroke="none" /></g>
        <g transform={`translate(1600 820) scale(${pz(f, fuel)})`}>
          <path d="M -150 60 A 150 150 0 0 1 150 60" fill="#fff" {...st(8)} />
          <path d={`M 0 50 L ${-Math.cos(0.35) * 120} ${50 - Math.sin(0.35) * 120}`} stroke="#E3232C" strokeWidth={10} strokeLinecap="round" />
          <Txt x={-120} y={110} text="E" size={50} fill="#E3232C" /><Txt x={120} y={110} text="F" size={50} />
          <Txt x={0} y={-130} text="FUEL" size={46} />
        </g>
      </g>}
      {mode === 'kokura' && <Plate x={1560} y={860} w={460} h={130} text="PRIMARY TARGET" s={pz(f, Math.min(a, 8))} fill="#fff" />}
      <Labels line={line} f={f} x0={100} y0={560} />
    </g>
  );
}

// ───────────── 9,600 m: higher than Everest (8,849 m) ─────────────
export const Mountain = ({h = 500, w = 700, snow = true}) => (
  <g>
    <path d={`M ${-w / 2} 0 L ${-w * 0.1} ${-h * 0.82} L 0 ${-h} L ${w * 0.16} ${-h * 0.78} L ${w / 2} 0 Z`} fill="#7C8794" {...ST} />
    {snow && <path d={`M ${-w * 0.18} ${-h * 0.72} L ${-w * 0.1} ${-h * 0.82} L 0 ${-h} L ${w * 0.16} ${-h * 0.78} L ${w * 0.1} ${-h * 0.68} L ${w * 0.02} ${-h * 0.76} L ${-w * 0.06} ${-h * 0.66} Z`} fill="#F8FAFC" {...st(5)} />}
  </g>
);
function YEverest({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || '9600', 0.15), b = at(line, p.b_on || 'everest', 0.35);
  const px = 0.085;   // pixels per metre
  const y0 = 1000;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.03}>
      <linearGradient id="yev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D3A6B" /><stop offset="1" stopColor="#9CC3E4" /></linearGradient>
      <rect width={W} height={H} fill="url(#yev)" />
      <g transform={`translate(760 ${y0}) scale(1 ${pz(f, b)})`}><Mountain h={8849 * px} w={900} /></g>
      <g opacity={pz(f, b) > 0.5 ? 1 : 0}><Txt x={1080} y={y0 - 8849 * px + 120} text="EVEREST 8,849 M" size={50} /></g>
      <path d={`M 200 ${y0 - 9600 * px} L 1760 ${y0 - 9600 * px}`} stroke="#FFE11A" strokeWidth={6} strokeDasharray="22 14" opacity={pz(f, Math.min(a, 8))} />
      <g transform={`translate(${lin(f, 0, len, 1300, 1500)} ${y0 - 9600 * px - 10}) rotate(-6) scale(0.17)`} opacity={pz(f, Math.min(a, 8))}><B29 f={f} /></g>
      <Txt x={420} y={y0 - 9600 * px - 40} text="9,600 M" size={64} fill="#FFE11A" op={pz(f, Math.min(a, 8))} />
      <rect y={y0} width={W} height={H - y0} fill="#6E9A6A" />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={600} /></g>
  );
}

// ───────────── bars: [[label, value], ...] growing on their words (the two yields) ─────────────
function YBars({f, len, line}) {
  const p = P(line);
  const bars = p.bars || [['HIROSHIMA', 15000], ['NAGASAKI', 21000]];
  const max = Math.max(...bars.map((b) => b[1]));
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.03}>
      <rect width={W} height={H} fill="#0B1F3A" />
      <Txt x={W / 2} y={150} text={p.title || 'TONS OF TNT'} size={70} fill="#9BE1FF" />
      {bars.map(([lab, v], i) => { const a = i === 0 ? Math.min(at(line, (p.on || [])[0] || '', 0.1), 8) : at(line, (p.on || [])[i] || '', 0.3 + i * 0.3);
        const k = lin(f, a, a + 26, 0, 1); const wv = 1100 * (v / max) * k; const y = 330 + i * 260;
        return (<g key={i}>
          <Txt x={420} y={y + 70} text={lab} size={64} anchor="end" />
          <rect x={460} y={y} width={wv} height={110} fill={i === bars.length - 1 ? '#E3232C' : '#FFE11A'} {...st(6)} />
          {k > 0.2 && <Txt x={480 + wv} y={y + 78} text={Math.round(v * k).toLocaleString('en-US')} size={70} anchor="start" />}
        </g>); })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the 43-second fall: a counter (from p.from to p.to over the line); split = the office beside it; zero = white ─────────────
function YTimer({f, len, line}) {
  const p = P(line);
  const from = p.from != null ? p.from : 43, to = p.to != null ? p.to : 0;
  const end = p.mode === 'zero' ? at(line, 'zero', 0.6) : len;
  const v = Math.max(to, Math.ceil(lin(f, 0, end, from, to, (t) => t)));
  const white = p.mode === 'zero' ? clamp((f - end - 4) / 6, 0, 1) : 0;
  const counter = (
    <g>
      <rect x={-300} y={-170} width={600} height={340} rx={30} fill="#111827" {...st(10)} />
      <Txt x={0} y={80} text={`0:${String(v).padStart(2, '0')}`} size={210} fill={v <= 5 ? '#E3232C' : '#FFE11A'} stroke="none" />
      <Txt x={0} y={-110} text="TIME TO FALL" size={44} fill="#9BE1FF" stroke="none" />
      <Txt x={0} y={240} text="SHOWN FASTER" size={44} fill="#F1F5F9" />
      <Txt x={0} y={294} text={`THE REAL FALL: ${p.total || 47} SECONDS`} size={44} fill="#F1F5F9" />
    </g>
  );
  return (
    <g>
      {p.mode === 'split' ? (
        <g>
          <svg x={0} y={0} width={1140} height={H} viewBox={`380 0 1140 ${H}`}>
            <rect width={W} height={H} fill="#DCCDB0" /><rect y={820} width={W} height={260} fill="#8A6A48" />
            <YBust who="yamaguchi" x={680} y={440} s={0.8} expr="worried" talk={Math.floor(f / 5) % 2 === 0} f={f} seed={3} band turn={0.25} />
            <YBust who="boss" x={1260} y={440} s={0.8} expr="grim" f={f} seed={6} turn={-0.25} />
          </svg>
          <rect x={1140} y={0} width={780} height={H} fill="#0B1F3A" />
          <path d="M 1140 0 L 1140 1080" stroke={INK} strokeWidth={12} />
          <g transform="translate(1530 520) scale(0.95)">{counter}</g>
        </g>
      ) : (
        <g>
          <linearGradient id="ytsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2F4F7A" /><stop offset="1" stopColor="#A9BED3" /></linearGradient>
          <rect width={W} height={H} fill="url(#ytsky)" />
          {[0, 1, 2].map((i) => <Cloud key={i} x={300 + i * 640 - f * 0.4} y={880} s={1.5} op={0.9} />)}
          <g transform={`translate(960 520) scale(${popBy(f, line, '', 0.1, 4)})`}>{counter}</g>
        </g>
      )}
      <rect width={W} height={H} fill="#FFFDF2" opacity={white} />
      <Labels line={line} f={f} x0={100} y0={90} />
    </g>
  );
}

// ───────────── Nagasaki's Urakami valley (diagram): aim (the aiming point and the burst 500 m north) | rings (3 km, the hills) ─────────────
const KMV = 110;
const HY = [920, 330], AIM = [920, 330 + 0.5 * KMV], OFF = [920 + 120, 330 + 311];   // his office about 3 km south, by the harbour
export const Valley = ({f = 0, blast = 0}) => (
  <g>
    <rect width={W} height={H} fill="#4E86B8" />
    <path d="M -20 -20 L 1940 -20 L 1940 1100 L 1300 1100 C 1200 1000 1150 860 1120 760 C 1100 700 1060 680 1020 700 C 980 760 920 860 820 1100 L -20 1100 Z" fill="#D9CDA6" {...st(6)} />
    <path d="M -20 -20 L 640 -20 C 660 200 640 420 700 600 C 740 720 700 860 560 1100 L -20 1100 Z" fill="#6E9A6A" {...st(5)} />
    <path d="M 1940 -20 L 1220 -20 C 1180 200 1210 420 1170 600 C 1150 700 1230 900 1340 1100 L 1940 1100 Z" fill="#6E9A6A" {...st(5)} />
    <path d="M 900 -20 C 880 200 940 420 960 640" stroke={INK} strokeWidth={34} fill="none" /><path d="M 900 -20 C 880 200 940 420 960 640" stroke="#4E86B8" strokeWidth={24} fill="none" />
    {[...Array(12)].map((_, i) => <path key={i} d={`M ${640 + (i % 4) * 30} ${80 + i * 80} q 40 -30 80 0`} stroke="#557F52" strokeWidth={6} fill="none" />)}
    {[...Array(12)].map((_, i) => <path key={'r' + i} d={`M ${1240 + (i % 4) * 40} ${80 + i * 80} q 40 -30 80 0`} stroke="#557F52" strokeWidth={6} fill="none" />)}
    {blast > 0 && <path d={`M ${HY[0]} ${HY[1] - 300} C ${HY[0] + 260} ${HY[1] - 240} ${HY[0] + 270} ${HY[1] + 200} ${HY[0] + 160} ${HY[1] + 330} C ${HY[0] + 40} ${HY[1] + 380} ${HY[0] - 120} ${HY[1] + 360} ${HY[0] - 190} ${HY[1] + 240} C ${HY[0] - 270} ${HY[1] + 60} ${HY[0] - 250} ${HY[1] - 240} ${HY[0]} ${HY[1] - 300} Z`} fill="#F97316" opacity={0.4 * blast} stroke="#E3232C" strokeWidth={6} />}
    <g transform="translate(1180 920)"><Crane x={0} y={0} s={0.45} /></g>
  </g>
);
function YValley({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'aim';
  const a = at(line, p.on || '', 0.2), b = at(line, p.b_on || '', 0.6);
  const ring = mode === 'rings' ? lin(f, a, a + 26, 0, 3 * KMV) : 0;
  const Tag = ({x, y, text, s, color = '#FFE11A', ink = INK}) => s > 0.01 ? <g transform={`translate(${x} ${y}) scale(${s})`}><rect x={-6} y={-48} width={String(text).length * 23 + 40} height={60} fill={color} {...st(5)} /><text x={14} y={0} fontFamily={OSW} fontWeight={700} fontSize={44} fill={ink}>{text}</text></g> : null;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <Valley f={f} blast={mode === 'rings' ? clamp((f - b) / 20, 0, 1) : 0} />
      {mode === 'aim' && <g>
        <g transform={`translate(${AIM[0]} ${AIM[1]})`} opacity={pz(f, Math.min(a, 8))}><circle r={36} fill="none" stroke={INK} strokeWidth={8} /><path d="M -50 0 L 50 0 M 0 -50 L 0 50" stroke={INK} strokeWidth={6} /></g>
        <Tag x={AIM[0] + 60} y={AIM[1] + 40} text="AIMING POINT" s={pz(f, Math.min(a, 8) + 4)} color="#fff" />
        {f > b && <g transform={`translate(${HY[0]} ${HY[1]})`}><Burst r={70} k={pz(f, b, 120)} /></g>}
        <Tag x={HY[0] + 70} y={HY[1] - 40} text="500 M NORTH" s={pz(f, b + 8)} color="#E3232C" ink="#fff" />
      </g>}
      {mode === 'rings' && <g>
        <g transform={`translate(${HY[0]} ${HY[1]})`}><path d="M -22 -22 L 22 22 M 22 -22 L -22 22" stroke={INK} strokeWidth={12} strokeLinecap="round" /></g>
        {ring > 1 && <circle cx={HY[0]} cy={HY[1]} r={ring} fill="none" stroke="#E3232C" strokeWidth={8} strokeDasharray="26 16" />}
        <Tag x={HY[0] - 3 * KMV - 130} y={HY[1] + 20} text="3 KM" s={pz(f, a + 20)} />
        <Tag x={HY[0] - 520} y={HY[1] - 120} text="HILLS" s={pz(f, b)} color="#fff" /><Tag x={HY[0] + 340} y={HY[1] - 120} text="HILLS" s={pz(f, b + 4)} color="#fff" />
        <Tag x={HY[0] - 130} y={HY[1] - 330} text="URAKAMI VALLEY" s={pz(f, b + 10)} />
      </g>}
      {(mode === 'rings' || p.him) && <g transform={`translate(${OFF[0]} ${OFF[1]})`}><circle r={20} fill="#FFE11A" {...st(6)} /><Tag x={36} y={20} text="HIS OFFICE" s={pz(f, Math.min(a, 8))} color="#fff" /></g>}
      {p.clock && <Plate x={1640} y={140} w={340} h={110} text={p.clock} s={pz(f, Math.min(a, 6))} fill="#0B1F3A" ink="#FFE11A" />}
    </Cam>
      <rect width={W} height={H} fill="#FFFDF2" opacity={mode === 'aim' ? clamp(1 - Math.abs(f - b - 3) / 10, 0, 1) * 0.8 : 0} />
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the office windows blow in: glass frozen in the air, he is on the floor ─────────────
function YGlass({f, len, line}) {
  const R = rng(14);
  const t = clamp(f / 20, 0, 1);
  const shards = [...Array(26)].map(() => [1380 + R() * 420, 120 + R() * 330, R() * 360, 20 + R() * 40, R()]);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.14} x={900} y={640} shake={f < 18 ? 12 : 0}>
      <rect width={W} height={H} fill="#BBAA88" />
      <rect y={0} width={W} height={60} fill="#A8987A" />
      <rect y={820} width={W} height={260} fill="#7A5C40" />
      <g transform="translate(1380 120)"><rect width={420} height={330} fill="#F2EEDC" {...st(8)} /><path d="M 0 0 L 60 80 L 0 160 M 420 0 L 360 120 L 420 200" stroke={INK} strokeWidth={6} fill="none" /></g>
      {shards.map(([x, y, r, s, k], i) => { const x2 = x - 900 * t * (0.4 + k), y2 = y + 300 * t * k; return <path key={i} d={`M ${x2} ${y2} l ${s} ${s * 0.3} l ${-s * 0.4} ${s}`} fill="#DDEFFA" stroke={INK} strokeWidth={3} transform={`rotate(${r + f * 3} ${x2} ${y2})`} />; })}
      {[...Array(16)].map((_, i) => { const q = ((f / 60) + i / 16) % 1; return <circle key={'d' + i} cx={200 + R() * 1500} cy={300 + R() * 500 - q * 100} r={30 + q * 50} fill="#9E8E74" opacity={0.35 * (1 - q)} />; })}
      <g transform="translate(1180 905) rotate(-90) scale(0.38)"><Torso who="boss" arms="rest" f={f} /><Head who="boss" expr="closed" f={f} seed={6} /></g>
      <g transform="translate(760 900) rotate(-90) scale(0.42)"><Torso who="yamaguchi" arms="rest" f={f} /><Head who="yamaguchi" expr="closed" f={f} seed={3} /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the textbooks, about to be rewritten over his head ─────────────
function YBooks({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'rewritten', 0.7);
  const k = clamp((f - a) / 30, 0, 1);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <rect width={W} height={H} fill="#E9DFC9" />
      {[['PHYSICS', '#2B6CB0'], ['ENGINEERING', '#7C2D12'], ['EXPLOSIVES', '#166534'], ['WARFARE', '#5B21B6']].map(([t, c], i) => (
        <g key={i} transform={`translate(${380 + i * 200} 820) rotate(${i % 2 ? 2 : -3}) scale(${popBy(f, line, '', 0.1, 4 + i * 4)})`}>
          <rect x={-80} y={-560} width={160} height={560} fill={c} {...st(7)} />
          <text x={0} y={-280} textAnchor="middle" transform="rotate(-90 0 -280)" fontFamily={OSW} fontWeight={700} fontSize={64} fill="#fff">{t}</text>
        </g>))}
      <g transform="translate(1400 520) rotate(4)">
        <rect x={-300} y={-360} width={600} height={720} fill="#FBF7EC" {...st(8)} />
        {[...Array(8)].map((_, i) => <rect key={i} x={-240} y={-280 + i * 70} width={i === 3 ? 300 : 460} height={18} fill="#CBD5E1" />)}
        <g opacity={1 - k}><Txt x={0} y={20} text="1 BOMB ≠ 1 CITY" size={64} fill={INK} stroke="none" /></g>
        {k > 0 && <g><path d="M -260 20 L 260 -10" stroke="#E3232C" strokeWidth={14} opacity={k} /><Txt x={0} y={170} text="REWRITTEN" size={84} fill="#E3232C" stroke="none" op={k} /></g>}
      </g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the bandages blown away, and an empty first-aid box ─────────────
function YBandage({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'clean', 0.6), bl = at(line, p.blow_on || 'blows', 0.15);
  const t = clamp((f - bl) / 40, 0, 1);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <rect width={W} height={H} fill="#5B4F45" />
      <g opacity={0.5}><Ruins y={820} color="#3A302A" seed={63} /></g>
      <rect y={820} width={W} height={260} fill="#4A3F36" />
      <YBust who="yamaguchi" x={1180} y={470} s={0.9} expr={f > bl ? 'shock' : 'worried'} f={f} seed={3} band={f < bl} turn={-0.2} />
      {f >= bl && [...Array(7)].map((_, i) => { const x = 1100 + i * 20 + t * (500 + i * 70), y = 340 + (i % 3) * 120 + Math.sin(i * 2 + f * 0.15) * 40 - t * (160 + i * 20);
        return <path key={i} d={`M ${x} ${y} C ${x + 60} ${y - 40} ${x + 120} ${y + 40} ${x + 180} ${y}`} stroke="#F8F6EE" strokeWidth={26} fill="none" strokeLinecap="round" opacity={1 - t * 0.5} />; })}
      <g transform={`translate(480 520) scale(${pz(f, a)})`}>
        <rect x={-220} y={-150} width={440} height={300} rx={20} fill="#FBF7EC" {...st(8)} />
        <path d="M -220 -150 L 220 -150 L 180 -240 L -180 -240 Z" fill="#E8E2D4" {...st(6)} />
        <path d="M -30 -100 L 30 -100 L 30 -40 L 90 -40 L 90 20 L 30 20 L 30 80 L -30 80 L -30 20 L -90 20 L -90 -40 L -30 -40 Z" fill="#E3232C" />
        <Txt x={0} y={230} text="EMPTY" size={80} fill="#FFE11A" />
      </g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the tunnel: Hisako and the baby inside, the light outside ─────────────
function YTunnel({f, len, line}) {
  const p = P(line);
  const w = at(line, p.flash_on || 'went', 0.5);
  const fl = clamp(1 - Math.abs(f - w - 4) / 12, 0, 1);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#6E9A6A" />
      <path d="M 0 400 C 400 200 1500 200 1920 380 L 1920 1080 L 0 1080 Z" fill="#7A6A55" {...st(6)} />
      <path d="M 520 1080 L 520 640 C 520 360 1400 360 1400 640 L 1400 1080 Z" fill="#1A1410" {...st(10)} />
      <path d="M 520 1080 L 520 640 C 520 360 1400 360 1400 640 L 1400 1080" fill="none" stroke="#9C8B70" strokeWidth={30} />
      <rect width={W} height={H} fill="#FFFDF2" opacity={fl * 0.7} />
      <YBust who="hisako" x={900} y={700} s={0.7} expr={f > w ? 'closed' : 'worried'} f={f} seed={5} turn={0.2} />
      <g transform="translate(1040 900)"><Baby s={0.75} f={f} /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the black rain (dark drops over a grey city; Hisako small, outside) ─────────────
function YBlackRain({f, len, line}) {
  const R = rng(5);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#5E5A58" />
      <Harbour f={f} grey={1} dim={0.5} />
      <rect width={W} height={H} fill="#1A1614" opacity={0.25} />
      <YBust who="hisako" x={960} y={520} s={0.62} expr="worried" f={f} seed={5} turn={0.15} lookY={-8} />
      {[...Array(140)].map((_, i) => { const x = R() * (W + 200), y0 = R() * H, sp = 20 + R() * 12; const y = ((y0 + f * sp) % (H + 100)) - 60;
        return <path key={i} d={`M ${x} ${y} l -10 54`} stroke="#0B0908" strokeWidth={10} opacity={0.85} strokeLinecap="round" />; })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── two numbers side by side (dead / injured) ─────────────
function YCounts({f, len, line}) {
  const p = P(line);
  const items = p.items || [['73,884', 'DEAD'], ['74,909', 'INJURED']];
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.03}>
      <rect width={W} height={H} fill="#0B1F3A" />
      {p.title && <Txt x={W / 2} y={170} text={p.title} size={60} fill="#9BE1FF" />}
      {items.map(([v, lab], i) => { const a = i === 0 ? Math.min(at(line, (p.on || [])[0] || '', 0.2), 8) : at(line, (p.on || [])[i] || '', 0.6); const n = Number(String(v).replace(/[^0-9]/g, ''));
        return (<g key={i} transform={`translate(${W / 2 + (i - (items.length - 1) / 2) * 820} 560) scale(${pz(f, a, 110)})`}>
          <Txt x={0} y={0} text={Math.round(lin(f, a, a + 36, 0, n)).toLocaleString('en-US')} size={170} fill={i === 0 ? '#FFE11A' : '#fff'} />
          <Txt x={0} y={120} text={lab} size={70} fill="#9BE1FF" /></g>); })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── two stadiums: most of one filled (the dead), a second more than half (the injured) ─────────────
const Stadium = ({fill = 0, color = '#E3232C'}) => (
  <g>
    <ellipse cx={0} cy={0} rx={380} ry={210} fill="#9CA3AF" {...st(8)} />
    <clipPath id={`yst${color.slice(1)}`}><ellipse cx={0} cy={0} rx={380} ry={210} /></clipPath>
    <g clipPath={`url(#yst${color.slice(1)})`}><rect x={-380} y={210 - 420 * fill} width={760} height={420 * fill} fill={color} opacity={0.75} /></g>
    <ellipse cx={0} cy={0} rx={220} ry={110} fill="#4D9A55" {...st(6)} />
    <path d="M -380 0 C -380 120 380 120 380 0" fill="none" stroke={INK} strokeWidth={5} opacity={0.5} />
  </g>
);
function YStadium({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'wembley', 0.2), b = at(line, p.b_on || 'injured', 0.6);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.03}>
      <rect width={W} height={H} fill="#0B1F3A" />
      <g transform="translate(520 520)"><Stadium fill={lin(f, a, a + 30, 0, 0.82)} color="#E3232C" /></g>
      <g transform={`translate(1400 520) scale(${pz(f, b)})`}><Stadium fill={lin(f, b, b + 30, 0, 0.65)} color="#F59E0B" /></g>
      <Txt x={520} y={810} text="WEMBLEY · 90,000 SEATS" size={50} op={pz(f, a)} /><Txt x={520} y={880} text="82% FULL" size={56} fill="#FFE11A" op={pz(f, a)} />
      <Txt x={1400} y={810} text="A SECOND STADIUM" size={50} op={pz(f, b)} /><Txt x={1400} y={880} text="65% FULL" size={56} fill="#FFE11A" op={pz(f, b)} />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the sick week: a futon, a sheet, a thermometer, days crossed off ─────────────
function YSick({f, len, line}) {
  const p = P(line);
  const days = p.days || 0;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#B8A586" />
      <rect y={720} width={W} height={360} fill="#9C8664" /><path d="M 0 720 L 1920 720" {...st(6)} />
      <rect x={300} y={760} width={1100} height={150} rx={30} fill="#F1E3C6" {...st(7)} />
      <path d="M 520 760 C 700 700 1100 700 1380 760 L 1390 900 L 520 900 Z" fill="#C9D6E3" {...st(6)} />
      <g transform="translate(430 790) rotate(-90) scale(0.42)"><Head who="yamaguchi" expr={p.expr || 'closed'} f={f} seed={3} hair="normal" /></g>
      {p.hair && <g opacity={0.6}>{[...Array(10)].map((_, i) => <path key={i} d={`M ${380 + i * 14} ${880 + (i % 3) * 8} q 10 -10 20 0`} stroke="#16110E" strokeWidth={3} fill="none" />)}</g>}
      <g transform="translate(1560 300)">
        <rect x={-180} y={-180} width={360} height={360} fill="#FBF7EC" {...st(7)} />
        <rect x={-180} y={-180} width={360} height={80} fill="#E3232C" {...st(7)} />
        {[...Array(9)].map((_, i) => <g key={i} transform={`translate(${-120 + (i % 3) * 120} ${-40 + Math.floor(i / 3) * 80})`}><Txt x={0} y={20} text={String(10 + i)} size={44} fill={INK} stroke="none" />
          {i < days && f > i * 6 && <path d="M -30 -20 L 30 30 M 30 -20 L -30 30" stroke="#E3232C" strokeWidth={8} />}</g>)}
        <Txt x={0} y={-124} text="AUGUST" size={44} />
      </g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the radio: the Emperor's voice, 15 August 1945 ─────────────
function YRadio({f, len, line}) {
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.06}>
      <rect width={W} height={H} fill="#5B4A3A" />
      <rect y={760} width={W} height={320} fill="#4A3A2C" />
      <g transform="translate(960 560)">
        <path d="M -330 220 L -330 -120 C -330 -330 330 -330 330 -120 L 330 220 Z" fill="#8B5A2B" {...st(9)} />
        <path d="M -260 140 L -260 -90 C -260 -240 260 -240 260 -90 L 260 140 Z" fill="#E8D9B5" {...st(6)} />
        {[...Array(7)].map((_, i) => <path key={i} d={`M ${-200 + i * 66} -150 L ${-200 + i * 66} 120`} stroke="#B89A72" strokeWidth={10} />)}
        <circle cx={-170} cy={180} r={26} fill="#3A2A1A" {...st(4)} /><circle cx={170} cy={180} r={26} fill="#3A2A1A" {...st(4)} />
      </g>
      {[0, 1, 2].map((i) => { const q = ((f / 48) + i / 3) % 1, o = Math.sin(Math.PI * q);   // each wave fades in and out: no pop (the motion check called the old ones uneven)
        return <g key={i}><path d={`M ${1320 + q * 200} ${380} C ${1360 + q * 220} 480 ${1360 + q * 220} 640 ${1320 + q * 200} 740`} stroke="#FFE11A" strokeWidth={12} fill="none" opacity={o} strokeLinecap="round" />
        <path d={`M ${600 - q * 200} ${380} C ${560 - q * 220} 480 ${560 - q * 220} 640 ${600 - q * 200} 740`} stroke="#FFE11A" strokeWidth={12} fill="none" opacity={o} strokeLinecap="round" /></g>; })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── paper lanterns on the river at dusk (the way Hiroshima remembers its dead) ─────────────
function YLanterns({f, len, line}) {
  const p = P(line);
  const R = rng(17);
  const n = p.n || 26;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05} y={640}>
      <linearGradient id="ylan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D2547" /><stop offset="0.55" stopColor="#7A4E6B" /><stop offset="1" stopColor="#2B3558" /></linearGradient>
      <rect width={W} height={H} fill="url(#ylan)" />
      <path d="M 0 560 C 500 520 1400 530 1920 560 L 1920 600 L 0 600 Z" fill="#141A33" />
      <rect y={600} width={W} height={480} fill="#253055" />
      {[...Array(n)].map((_, i) => { const x0 = R() * 2200 - 140, y = 640 + R() * 380, s = 0.5 + (y - 600) / 600; const x = ((x0 + f * (0.5 + R() * 0.5)) % 2200) - 140;
        return (<g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse cx={0} cy={40} rx={60} ry={14} fill="#FDBA74" opacity={0.25} />
          <rect x={-34} y={-60} width={68} height={80} fill="#FDE7B0" {...st(4)} /><rect x={-34} y={-60} width={68} height={80} fill="#FDBA74" opacity={0.4 + 0.2 * Math.sin(f * 0.1 + i)} />
          <rect x={-40} y={18} width={80} height={14} fill="#6B4228" {...st(3)} />
        </g>); })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── years running (1945 -> 2004), the same quiet man ─────────────
function YYears({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'sixty', 0.4);
  const y = Math.round(lin(f, a, Math.max(a + 40, len - 10), p.from || 1945, p.to || 2004));
  const old = (y - 1945) / 60;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.03}>
      <rect width={W} height={H} fill="#E4DCC8" />
      <YBust who={old > 0.6 ? 'yamaguchi_old' : 'yamaguchi'} x={620} y={480} s={0.95} expr="calm" f={f} seed={3} turn={0.2} />
      <g transform="translate(1340 520)"><rect x={-330} y={-150} width={660} height={260} fill="#0B1F3A" {...st(8)} /><Txt x={0} y={60} text={String(y)} size={190} fill="#FFE11A" /></g>
      <g transform={`translate(1340 780) scale(${pz(f, a + 10)})`}><rect x={-300} y={-60} width={600} height={110} fill="#fff" {...st(6)} /><Txt x={0} y={16} text={p.big || 'SAYS VERY LITTLE'} size={56} fill={INK} stroke="none" /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── a quote card: the words (wrapped), the speaker (a bust, bandaged if p.band; or none), and where he said it ─────────────
function YQuote({f, len, line}) {
  const p = P(line);
  const a = Math.min(at(line, p.on || '', 0.1), 10);
  const s = pz(f, a);
  const words = String(p.text || '').split(' ');
  const width = p.who === 'none' ? 34 : 26;
  const rows = [];
  let row = '';
  for (const w of words) { if ((row + ' ' + w).trim().length > width && row) { rows.push(row); row = w; } else row = (row + ' ' + w).trim(); }
  if (row) rows.push(row);
  const fs = rows.length > 5 ? 58 : 70, lh = fs * 1.2;
  const h = 110 + rows.length * lh, bw = p.who === 'none' ? 1300 : 1000;
  const x0 = p.who === 'none' ? W / 2 - bw / 2 : 100;
  // a quote of 3+ rows is written out row by row as the voice reaches each row's first word (Israa: 11-14 s of a still card)
  const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
  const qw = words.map(norm), lw = (line.words || []).map((w) => [norm(w[0]), w[1] - line.start]);
  let j = -1;
  for (let i = 0; rows.length >= 3 && i + 2 < lw.length; i++) if (lw[i][0] === qw[0] && lw[i + 1][0] === qw[1] && lw[i + 2][0] === qw[2]) { j = i; break; }
  let k0 = 0;
  const rowAt = rows.map((r) => { const k = k0; k0 += r.split(' ').length; return j < 0 ? -1 : (lw[j + k] ? lw[j + k][1] - 4 : -1); });
  if (rowAt.length) rowAt[0] = Math.min(rowAt[0], a);
  return (
    <g><Cam f={f} len={len} a={1.0} b={j >= 0 ? 1.1 : 1.05}>
      <rect width={W} height={H} fill={p.color || '#0F2A44'} />
      {p.who !== 'none' && !p.photo && <YBust who={p.who || 'yamaguchi_old'} x={1500} y={p.y || 480} s={p.s || 0.9} expr={p.expr || 'calm'} f={f} talk={p.talk !== false && f >= a && f < len - 8} seed={3} band={!!p.band} turn={-0.3} />}
      <g transform={`translate(${x0} ${500 - h / 2}) scale(${s})`}>
        <rect x={10} y={12} width={bw} height={h} fill="#000" opacity={0.35} /><rect width={bw} height={h} fill="#fff" {...ST} />
        <rect x={30} y={30} width={14} height={h - 60} fill="#E3232C" />
        {rows.map((r, i) => <text key={i} x={80} y={80 + fs * 0.6 + i * lh} opacity={clamp((f - rowAt[i]) / 6, 0, 1)} fontFamily={OSW} fontWeight={700} fontSize={fs} fill={INK}>{(i === 0 ? '“' : '') + r + (i === rows.length - 1 ? '”' : '')}</text>)}
      </g>
      {p.who_label && <g transform={`translate(${x0} ${500 + h / 2 + 40}) scale(${pz(f, a + 8, 170)})`}><rect width={String(p.who_label).length * 30 + 50} height={70} fill="#FFE11A" {...st(5)} /><text x={25} y={52} fontFamily={OSW} fontWeight={700} fontSize={50} fill={INK}>{String(p.who_label).toUpperCase()}</text></g>}
    </Cam></g>
  );
}

export const YAM3_SHOTS = {y_stamp: YStamp, y_bomber: YBomber, y_fork: YFork, y_nagasaki: YNagasaki, y_doctor: YDoctor, y_door: YDoor, y_home: YHome,
  y_calendar: YCalendar, y_targets: YTargets, y_everest: YEverest, y_bars: YBars, y_timer: YTimer, y_valley: YValley, y_glass: YGlass,
  y_books: YBooks, y_bandage: YBandage, y_tunnel: YTunnel, y_blackrain: YBlackRain, y_counts: YCounts, y_stadium: YStadium, y_sick: YSick,
  y_radio: YRadio, y_lanterns: YLanterns, y_years: YYears, y_quote: YQuote};
