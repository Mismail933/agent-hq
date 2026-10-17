// The first 60 seconds of "She Survived a 3 km Fall" (2.49.0), in The Infographics Show's look (tis.jsx).
// props: {lines: [{shot, text, start, end, words: [[word, frame]]}], audio, frames}. Each shot is drawn for exactly what its line says.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, useCurrentFrame, staticFile, interpolate} from 'remotion';
import {W, H, INK, ST, st, clamp, lin, pop, rng, ease, Box, Label, Head, Bust, SeatBack, Plane, Bolt, Cloud, Canopy} from './tis';
import {JulianeArt} from './Thumb';
import {STORY_SHOTS, DayCard, DayCorner} from './jungle';
import {FONT_CSS} from './fonts';

// the frame (inside the line) where a word is said; fallback = a fraction of the line
const at = (line, word, frac = 0.3) => {
  const want = word.toLowerCase();
  const hit = (line.words || []).find((w) => w[0].toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(want));
  return hit ? hit[1] - line.start : Math.round((line.end - line.start) * frac);
};
// the camera: a slow push-in and an optional shake
const Cam = ({f, len, from = 1, to = 1.06, x = W / 2, y = H / 2, shake = 0, children}) => {
  const z = interpolate(f, [0, len], [from, to], {extrapolateRight: 'clamp'});
  const sx = shake ? Math.sin(f * 1.9) * shake : 0, sy = shake ? Math.cos(f * 2.3) * shake * 0.7 : 0;
  return <g transform={`translate(${x + sx} ${y + sy}) scale(${z}) translate(${-x} ${-y})`}>{children}</g>;
};

const Sky = ({top = '#2E6FD8', mid = '#7DB4F0', bottom = '#F6D9A8'}) => (
  <g>
    <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="0.6" stopColor={mid} /><stop offset="1" stopColor={bottom} /></linearGradient>
    <rect width={W} height={H} fill="url(#skyg)" />
  </g>
);
const Storm = ({k = 1}) => (
  <g>
    <linearGradient id="stormg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0F1330" /><stop offset="1" stopColor="#2E3566" /></linearGradient>
    <rect width={W} height={H} fill="url(#stormg)" opacity={k} />
  </g>
);
const Rain = ({f, n = 70, seed = 3, op = 0.35, slant = -16}) => {
  const R = rng(seed);
  return <g>{[...Array(n)].map((_, i) => { const x = R() * (W + 200), y0 = R() * H, sp = 30 + R() * 20; const y = ((y0 + f * sp) % (H + 100)) - 60;
    return <path key={i} d={`M ${x} ${y} l ${slant} 46`} stroke="#C7D2FE" strokeWidth={4} opacity={op} strokeLinecap="round" />; })}</g>;
};

// ───────────── the shots ─────────────
function Aerial({f, len, line}) {
  const px = lin(f, 0, len, 300, 880, (t) => t);
  return (
    <Cam f={f} len={len} from={1} to={1.05}>
      <Sky />
      <circle cx={1580} cy={260} r={90} fill="#FFE8A3" opacity={0.9} /><circle cx={1580} cy={260} r={150} fill="#FFE8A3" opacity={0.25} />
      <Cloud x={420 - f * 0.4} y={240} s={0.9} /><Cloud x={1260 - f * 0.6} y={360} s={0.7} op={0.9} />
      <Canopy y0={760} drift={-f * 2.2} seed={7} rows={5} />
      <g transform={`translate(${px} ${430 + Math.sin(f * 0.07) * 8}) scale(0.62)`}><Plane f={f} /></g>
      <Label x={100} y={110} text="24 DECEMBER 1971" f={f} at={8} h={96} />
      <Label x={100} y={230} text="OVER THE AMAZON, PERU" f={f} at={22} h={66} fill="#fff" />
    </Cam>
  );
}

const CabinRoom = ({f, dark = 0, lockersOpen = 0}) => (
  <g>
    <rect width={W} height={H} fill="#E5E7EB" />
    <rect y={0} width={W} height={150} fill="#CBD5E1" {...ST} />
    {[0, 1, 2, 3, 4].map((i) => {
      const open = lockersOpen * (i % 2 ? 1 : 0.6);
      return <g key={i}><rect x={20 + i * 384} y={20} width={360} height={110} rx={14} fill="#F1F5F9" {...ST} />
        {open > 0 && <rect x={20 + i * 384} y={130} width={360} height={60 * open} fill="#94A3B8" {...st(5)} />}</g>;
    })}
    <rect y={150} width={W} height={20} fill="#94A3B8" />
    <g transform="translate(250 450)">
      <ellipse rx={150} ry={200} fill="#94A3B8" {...ST} />
      <clipPath id="win"><ellipse rx={118} ry={168} /></clipPath>
      <g clipPath="url(#win)"><rect x={-130} y={-180} width={260} height={360} fill={dark > 0.5 ? '#1E2448' : '#7DB4F0'} /><rect x={-130} y={60} width={260} height={120} fill={dark > 0.5 ? '#0F172A' : '#15803D'} /></g>
      <ellipse rx={118} ry={168} fill="none" {...ST} />
    </g>
    {dark > 0 && <rect width={W} height={H} fill="#1E1B4B" opacity={0.35 * dark} />}
  </g>
);

function Cabin({f, len, line}) {
  return (
    <Cam f={f} len={len} from={1.02} to={1.08}>
      <CabinRoom f={f} />
      <SeatBack x={780} y={520} s={0.72} /><SeatBack x={1300} y={520} s={0.72} />
      <Bust who="juliane" x={780} y={520} s={0.72} expr={f < at(line, 'window') ? 'calm' : 'smile'} f={f} look={-8} arms="rest" seed={1} />
      <Bust who="mother" x={1300} y={520} s={0.72} expr="smile" f={f} look={-6} arms="rest" seed={2} />
      <Label x={430} y={190} text="JULIANE KOEPCKE, 17" f={f} at={at(line, 'juliane')} />
      <Label x={1230} y={190} text="HER MOTHER" f={f} at={at(line, 'mother')} fill="#fff" />
    </Cam>
  );
}

function Father({f, len, line}) {
  const R = rng(9);
  return (
    <Cam f={f} len={len} from={1} to={1.06}>
      <rect width={W} height={H} fill="#9AD1A8" />
      {[...Array(9)].map((_, i) => <rect key={i} x={i * 230 + R() * 60 - 40} y={0} width={46 + R() * 30} height={H} fill={['#5B3A1E', '#4A2F18', '#6B4423'][i % 3]} {...st(5)} />)}
      {[...Array(14)].map((_, i) => <ellipse key={'l' + i} cx={i * 150} cy={60 + (i % 3) * 40} rx={170} ry={110} fill={['#166534', '#15803D', '#14532D'][i % 3]} {...st(5)} />)}
      <rect y={860} width={W} height={220} fill="#4D7C3A" {...ST} />
      {/* the research station hut on stilts */}
      <g transform="translate(1260 520)">
        {[-180, -60, 60, 180].map((x) => <rect key={x} x={x - 10} y={150} width={20} height={200} fill="#6B4423" {...st(5)} />)}
        <rect x={-230} y={20} width={460} height={150} fill="#B08350" {...ST} />
        <rect x={-60} y={60} width={110} height={110} fill="#5B3A1E" {...st(5)} /><rect x={110} y={50} width={80} height={60} fill="#FDE68A" {...st(5)} />
        <path d="M -290 30 L 0 -140 L 290 30 Z" fill="#C8A44D" {...ST} />
        <path d="M -200 -20 L 200 -20 M -120 -70 L 120 -70" stroke="#A8832F" strokeWidth={8} />
      </g>
      <Bust who="father" x={640} y={500} s={0.8} expr="smile" f={f} arms="rest" seed={3} />
      <Label x={360} y={130} text="HER FATHER, A BIOLOGIST" f={f} at={at(line, 'father')} />
      <Label x={1020} y={330} text="HIS STATION IN THE JUNGLE" f={f} at={at(line, 'jungle')} fill="#fff" />
    </Cam>
  );
}

function StormWindow({f, len, line}) {
  const k = lin(f, 0, Math.min(len, 70), 0, 1);
  return (
    <Cam f={f} len={len} from={1} to={1.12} shake={f > len * 0.55 ? 4 : 0}>
      <rect width={W} height={H} fill="#CBD5E1" />
      <g transform="translate(820 540)">
        <ellipse rx={380} ry={470} fill="#94A3B8" {...ST} />
        <clipPath id="bigwin"><ellipse rx={320} ry={410} /></clipPath>
        <g clipPath="url(#bigwin)">
          <rect x={-340} y={-430} width={680} height={860} fill={k > 0.5 ? '#232A55' : '#7DB4F0'} />
          <rect x={-340} y={-430} width={680} height={860} fill="#141833" opacity={k} />
          {[0, 1, 2].map((i) => <g key={i} transform={`translate(${lin(f, 0, len, 420, -260) + i * 220} ${-260 + i * 120})`}><Cloud s={1.1} dark /></g>)}
          <path d="M -340 160 L 340 80 L 340 150 L -340 240 Z" fill="#E2E8F0" {...ST} />
          <g transform="translate(60 112)"><ellipse rx={60} ry={24} fill="#CBD5E1" {...st(6)} /></g>
          <g opacity={k}><Rain f={f} n={40} op={0.6} slant={-30} /></g>
        </g>
        <ellipse rx={320} ry={410} fill="none" {...ST} />
      </g>
      <Bust who="juliane" x={1460} y={560} s={0.82} expr={k > 0.6 ? 'worried' : 'calm'} f={f} look={-10} arms="rest" seed={1} />
      <Label x={120} y={100} text="A THUNDERSTORM" f={f} at={at(line, 'thunderstorm')} fill="#E3232C" color="#fff" />
    </Cam>
  );
}

function Shaking({f, len, line}) {
  const R = rng(4);
  const lanes = [[460, 600], [980, 1120], [1520, 1840]];
  const items = [...Array(9)].map((_, i) => ({x: (([a, b]) => a + R() * (b - a))(lanes[i % 3]), t0: 6 + R() * 50, gift: i % 2 === 0, c: ['#E3232C', '#22A06B', '#2563EB', '#F59E0B'][i % 4], r: R() * 360, sp: (R() - 0.5) * 8}));
  return (
    <Cam f={f} len={len} from={1.04} to={1.04} shake={10}>
      <CabinRoom f={f} dark={0.6} lockersOpen={clamp(f / 12, 0, 1)} />
      <SeatBack x={780} y={540} s={0.72} /><SeatBack x={1300} y={540} s={0.72} />
      <Bust who="juliane" x={780} y={540} s={0.72} expr="scared" f={f} arms="grip" seed={1} />
      <Bust who="mother" x={1300} y={540} s={0.72} expr="worried" f={f} arms="grip" seed={2} />
      {items.map((o, i) => {
        const t = Math.max(0, f - o.t0), y = 160 + 0.9 * t * t;
        if (y > H + 120) return null;
        return (
          <g key={i} transform={`translate(${o.x} ${y}) rotate(${o.r + o.sp * t})`}>
            {o.gift ? <g><rect x={-46} y={-38} width={92} height={76} rx={6} fill={o.c} {...st(6)} /><rect x={-8} y={-38} width={16} height={76} fill="#FDE047" /><rect x={-46} y={-8} width={92} height={16} fill="#FDE047" /><path d="M -8 -38 C -40 -70 -30 -80 0 -42 C 30 -80 40 -70 8 -38" fill="#FDE047" {...st(4)} /></g>
              : <g><rect x={-70} y={-44} width={140} height={88} rx={18} fill="#7C4A1E" {...st(6)} /><rect x={-30} y={-62} width={60} height={22} rx={10} fill="none" {...st(8)} /></g>}
          </g>
        );
      })}
      <Label x={120} y={200} text="CHRISTMAS PRESENTS" f={f} at={at(line, 'christmas')} />
    </Cam>
  );
}

function Lightning({f, len, line}) {
  const hit = at(line, 'flash');
  const flash = f >= hit && f < hit + 10 ? 1 - (f - hit) / 10 : 0;
  return (
    <Cam f={f} len={len} from={1.1} to={1.18} shake={f > hit ? 8 : 2}>
      <Storm />
      <Rain f={f} n={90} op={0.45} />
      <Cloud x={300} y={200} s={1.4} dark /><Cloud x={1500} y={160} s={1.6} dark />
      <g transform={`translate(${900 + Math.sin(f * 0.1) * 10} 560) scale(0.95)`}><Plane f={f} fire={f > hit ? 1 : 0} /></g>
      {f >= hit && f < hit + 14 && <Bolt x={1030} y={-40} s={1.9} />}
      <rect width={W} height={H} fill="#fff" opacity={flash} />
      <Label x={120} y={110} text="LIGHTNING HITS THE RIGHT WING" f={f} at={hit + 6} fill="#E3232C" color="#fff" />
    </Cam>
  );
}

function Mother({f, len, line}) {
  const q0 = at(line, 'now', 0.4);
  return (
    <Cam f={f} len={len} from={1} to={1.1}>
      <CabinRoom f={f} dark={1} />
      <rect width={W} height={H} fill="#7F1D1D" opacity={0.25 + Math.sin(f * 0.4) * 0.05} />
      <SeatBack x={1220} y={600} s={1.05} />
      <Bust who="mother" x={1220} y={600} s={1.05} expr="grim" f={f} talk={f >= q0 && f < len - 10} arms="rest" seed={2} />
      {f >= q0 && (() => { const s = clamp(pop(f, q0, 150, 13), 0, 1.1); return (
        <g transform={`translate(160 360) scale(${s})`}>
          <rect x={8} y={10} width={760} height={200} fill="#000" opacity={0.35} /><rect width={760} height={200} fill="#fff" {...ST} />
          <rect x={30} y={30} width={14} height={140} fill="#E3232C" />
          <text x={80} y={130} fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={92} fill={INK} textLength={640} lengthAdjust="spacingAndGlyphs">"NOW IT'S ALL OVER."</text>
          <text x={80} y={188} fontFamily="'Oswald', sans-serif" fontWeight={400} fontSize={32} fill="#475569">HER MOTHER, MARIA KOEPCKE</text>
        </g>); })()}
    </Cam>
  );
}

function Breakup({f, len, line}) {
  const b = lin(f, 6, Math.max(20, len - 10), 0, 1);
  const R = rng(12);
  return (
    <Cam f={f} len={len} from={1.15} to={1.0} shake={12}>
      <Storm />
      <Rain f={f} n={90} op={0.45} />
      <Cloud x={300} y={240} s={1.4} dark /><Cloud x={1600} y={180} s={1.5} dark />
      <g transform="translate(980 520) scale(1.05)"><Plane f={f} broken={b} fire={1} /></g>
      {b > 0.05 && [...Array(16)].map((_, i) => { const a = R() * Math.PI * 2, sp = 6 + R() * 10, t = f - 8;
        return <rect key={i} x={960 + Math.cos(a) * sp * t} y={520 + Math.sin(a) * sp * t + 0.3 * t * t} width={20 + R() * 20} height={10} fill="#CBD5E1" {...st(3)} transform={`rotate(${i * 40 + t * 8} ${960 + Math.cos(a) * sp * t} ${520 + Math.sin(a) * sp * t})`} />; })}
      <circle cx={940} cy={520} r={b * 220} fill="#F97316" opacity={b > 0 ? 0.35 * (1 - b) : 0} />
      <Label x={120} y={110} text="THE PLANE BREAKS APART" f={f} at={at(line, 'breaks')} fill="#E3232C" color="#fff" />
    </Cam>
  );
}

function Falling({f, len, line}) {
  const spin = Math.sin(f * 0.05) * 9;
  const alt = Math.round(lin(f, 0, len, 3000, 400, (t) => t) / 50) * 50;
  const ground = lin(f, 0, len, 1120, 700, (t) => t);
  const R = rng(21);
  return (
    <g>
      <linearGradient id="fallsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B2A6B" /><stop offset="0.6" stopColor="#3D57A8" /><stop offset="1" stopColor="#A9C3E8" /></linearGradient>
      <rect width={W} height={H} fill="url(#fallsky)" />
      <g transform={`translate(0 ${ground - 760})`}><Canopy y0={760} f={f} seed={8} rows={5} /></g>
      {[...Array(18)].map((_, i) => { const x = R() * W, y0 = R() * H, sp = 40 + R() * 30, y = H - ((y0 + f * sp) % (H + 300)); return <path key={i} d={`M ${x} ${y} L ${x - 10} ${y - 200}`} stroke="#fff" strokeWidth={6} opacity={0.4} strokeLinecap="round" />; })}
      <g transform={`translate(${1060 + Math.sin(f * 0.03) * 40} 520) rotate(${spin}) scale(0.95)`}>
        <SeatBack x={540} y={0} /><SeatBack x={0} y={0} />
        <Bust who="juliane" x={0} y={0} s={1} expr="scared" f={f} arms="flail" hair="flying" seed={1} />
        <rect x={-260} y={700} width={1060} height={60} fill="#94A3B8" {...ST} /><rect x={-50} y={690} width={100} height={80} rx={10} fill="#E2E8F0" {...ST} />
      </g>
      {/* altitude, counting down */}
      <g transform="translate(1500 120)">
        <Box x={0} y={0} w={320} h={70} text="ALTITUDE" fill="#fff" />
        <Box x={0} y={80} w={320} h={120} text={`${alt.toLocaleString('en-US')} M`} fill="#FFE11A" />
      </g>
      <Label x={110} y={120} text="STILL STRAPPED IN" f={f} at={at(line, 'strapped')} fill="#E3232C" color="#fff" />
      <Label x={110} y={230} text="3 KM TO THE GROUND" f={f} at={at(line, 'three')} />
    </g>
  );
}

function Wake({f, len, line}) {
  const w = at(line, 'wakes', 0.15);
  const R = rng(31);
  return (
    <Cam f={f} len={len} from={1.12} to={1.0}>
      <rect width={W} height={H} fill="#3F5A2A" />
      {[...Array(60)].map((_, i) => <ellipse key={i} cx={R() * W} cy={R() * H} rx={30 + R() * 40} ry={14 + R() * 12} fill={['#5B7A34', '#6B4423', '#4D6B2C', '#7C5A2E'][i % 4]} {...st(3)} transform={`rotate(${R() * 180} ${R() * W} ${R() * H})`} />)}
      {[...Array(5)].map((_, i) => <path key={'r' + i} d={`M ${300 + i * 330} -40 L ${380 + i * 330} -40 L ${560 + i * 330} ${H + 40} L ${400 + i * 330} ${H + 40} Z`} fill="#FFF7CC" opacity={0.12} />)}
      <g transform="translate(1320 470) rotate(24) scale(0.5)"><SeatBack /><SeatBack x={540} /></g>
      <g transform="translate(760 560) rotate(-90) scale(0.62)">
        <Torso2 />
        <Head who="juliane" expr={f < w ? 'closed' : 'waking'} f={f} seed={1} />
      </g>
      {[...Array(6)].map((_, i) => <path key={'f' + i} d={`M ${i * 360} ${H} C ${i * 360 + 40} ${H - 200} ${i * 360 + 140} ${H - 240} ${i * 360 + 220} ${H - 260}`} stroke="#22A06B" strokeWidth={26} fill="none" strokeLinecap="round" />)}
      <Label x={120} y={110} text="THE NEXT MORNING" f={f} at={at(line, 'next')} />
      <Label x={120} y={220} text="ALONE" f={f} at={at(line, 'alone')} fill="#E3232C" color="#fff" />
    </Cam>
  );
}
// lying on her back: a torso without arms flung (simple)
const Torso2 = () => (
  <g>
    <path d="M -70 214 C -160 230 -214 262 -226 350 L -246 780 L 246 780 L 226 350 C 214 262 160 230 70 214 C 40 262 -40 262 -70 214 Z" fill="#D62828" {...ST} />
    <path d="M 120 236 C 190 262 214 300 220 360 L 238 780 L 150 780 Z" fill="#A11D1D" />
    <path d="M -206 300 C -250 400 -280 500 -300 600 L -240 612 C -232 520 -206 430 -150 350 Z" fill="#F2C29B" {...ST} />
    <path d="M 206 300 C 236 400 240 500 222 600 L 162 596 C 176 500 170 420 150 340 Z" fill="#F2C29B" {...ST} />
  </g>
);

function Title({f, len, line}) {
  const a = at(line, 'survived', 0.3), b = at(line, 'fall', 0.5);
  const z = lin(f, 0, len, 1.12, 1.0);
  return (
    <g>
      <g transform={`translate(960 540) scale(${z}) translate(-960 -540)`}><JulianeArt boxes={false} /></g>
      <Box x={50} y={70} w={900} h={170} text="SHE SURVIVED" rot={-3} s={clamp(pop(f, a, 160, 12), 0, 1.1)} />
      <Box x={50} y={262} w={980} h={210} text="A 3 KM FALL" fill="#E3232C" color="#fff" outline rot={-3} s={clamp(pop(f, b, 160, 12), 0, 1.1)} />
      <rect width={W} height={H} fill="#000" opacity={lin(f, len - 18, len, 0, 1)} />
    </g>
  );
}

const SHOTS = {aerial: Aerial, cabin: Cabin, father: Father, storm_window: StormWindow, shaking: Shaking, lightning: Lightning, mother: Mother,
  breakup: Breakup, falling: Falling, wake: Wake, title: Title, ...STORY_SHOTS};

const ShotLayer = ({line, len}) => {
  const f = useCurrentFrame();
  const S = SHOTS[line.shot] || Aerial;
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}><S f={f} len={len} line={line} /></svg>
    </AbsoluteFill>
  );
};

// the day: a big red card when it changes (line.p.day), then small in the corner until the next change (or day "" to clear)
const DayLayer = ({lines}) => {
  const frame = useCurrentFrame();
  let day = null, since = 0;
  for (const l of lines) {
    const from = l.cut != null ? l.cut : l.start;
    if (from > frame) break;
    const d = (l.p || {}).day;
    if (d !== undefined && d !== day) { day = d; since = from; }
  }
  if (day === null || day === '' || day === undefined) return null;
  const f = frame - since;
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>{f < 26 ? <DayCard day={day} f={f} /> : <DayCorner day={day} />}</svg>
    </AbsoluteFill>
  );
};

export const Opening = ({lines = [], audio}) => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    <style>{FONT_CSS}</style>
    {audio && <Audio src={staticFile(audio)} />}
    {lines.map((l, i) => {
      const from = i === 0 ? 0 : l.cut, to = i + 1 < lines.length ? lines[i + 1].cut : l.until;
      const prev = i > 0 ? lines[i - 1] : null;
      const cont = !!prev && prev.shot === l.shot && l.shot === 'item' && ((prev.p || {}).thing === (l.p || {}).thing);
      const shifted = {...l, idx: i, cont, start: from, end: l.end, words: (l.words || []).map(([w, fr]) => [w, fr])};
      return (
        <Sequence key={i} from={from} durationInFrames={Math.max(1, to - from)} layout="none">
          <ShotLayer line={shifted} len={to - from} />
        </Sequence>
      );
    })}
    <DayLayer lines={lines} />
  </AbsoluteFill>
);
