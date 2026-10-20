// Storygraphics #3 (2.57.0): "Could the Megalodon Still Be Alive?". The 1918 crayfish boat off New South Wales, the ghostly white
// shark rising under it, the traps torn away, the size the men guessed, the run back to port, David Stead, the tooth as long as a
// hand, and the title (MegArt, also the thumbnail). Every scene takes {f, len, line}; line.p holds the script's choices.
import React from 'react';
import {noise2D} from '@remotion/noise';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Bust, Box, Cloud, at, Labels} from './tis';
import {Sea, Deep, camShake, DrawOn} from './ocean';
import {Mover} from './motion';

const P = (line) => line.p || {};
const OSW = "'Oswald', sans-serif";
const Txt = ({x, y, text, size = 60, fill = '#fff', anchor = 'middle', stroke = INK}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={OSW} fontWeight={700} fontSize={size} fill={fill} stroke={stroke} strokeWidth={size * 0.12} paintOrder="stroke">{text}</text>
);
const Cam = ({f, len, a = 1, b = 1.06, x = W / 2, y = H / 2, shake = 0, hand = 0, children}) => {
  const z = lin(f, 0, len, a, b);
  const [sx, sy] = camShake(f, shake, hand);
  return <g transform={`translate(${W / 2 + sx} ${H / 2 + sy}) scale(${z}) translate(${-x} ${-y})`}>{children}</g>;
};
export const SKY = ({id = 'msky'}) => (<g>
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6FA8D8" /><stop offset="1" stopColor="#E3EEF5" /></linearGradient>
  <rect width={W} height={H} fill={`url(#${id})`} /></g>);

// ───────────── the shark, side view (snout to the right), about 1600 long at s 1 ─────────────
const SHARK = {pale: ['#DCE5EC', '#B9C7D3', '#F4F7FA'], grey: ['#7F8D9A', '#64717D', '#E4E8EC'], dark: ['#4C5763', '#3A434D', '#9AA5AF']};
export function Shark({f = 0, color = 'pale', mouth = 0, swim = 1, glow = 0}) {
  const [B, S, L] = SHARK[color] || SHARK.pale;
  const tail = Math.sin(f * 0.13) * 9 * swim;
  const m = clamp(mouth, 0, 1);
  return (
    <g>
      {glow > 0 && <ellipse cx={60} cy={0} rx={980} ry={360} fill="#E8F4FF" opacity={0.16 * glow} />}
      <g transform={`rotate(${tail} -600 0)`}>
        <path d="M -600 -30 L -840 -340 C -810 -210 -775 -105 -716 -2 Z" fill={S} {...ST} />
        <path d="M -600 30 L -805 236 C -768 152 -736 82 -712 12 Z" fill={S} {...ST} />
      </g>
      <path d="M -420 -112 L -478 -182 L -372 -122 Z" fill={S} {...st(5)} />
      <path d="M -430 100 L -480 160 L -380 108 Z" fill={S} {...st(5)} />
      <path d="M 60 -186 L -64 -430 C -20 -410 94 -262 238 -172 Z" fill={B} {...ST} />
      <path d="M 790 14 C 700 -100 420 -182 60 -192 C -262 -186 -482 -112 -602 -30 C -642 -10 -642 20 -602 40 C -482 112 -262 172 60 172 C 400 162 640 112 790 14 Z" fill={B} {...ST} />
      <path d="M 770 34 C 600 112 380 152 60 158 C -242 152 -462 102 -592 42 C -462 72 -200 98 60 102 C 380 98 600 72 770 34 Z" fill={L} />
      <path d="M 300 -150 C 120 -170 -120 -160 -360 -100" fill="none" stroke={S} strokeWidth={22} strokeLinecap="round" opacity={0.6} />
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M ${430 + i * 26} -50 C ${418 + i * 26} -10 ${418 + i * 26} 30 ${430 + i * 26} 70`} fill="none" {...st(4)} />)}
      <path d={`M 222 118 L 30 ${352 + Math.sin(f * 0.13 + 1) * 10} C 120 340 262 222 342 140 Z`} fill={S} {...ST} />
      <circle cx={628} cy={-42} r={17} fill={INK} /><circle cx={634} cy={-48} r={5} fill="#fff" />
      {m > 0.02 ? (
        <g>
          <path d={`M 560 52 C 640 46 720 30 792 14 L 780 ${30 + 120 * m} C 700 ${80 + 120 * m} 620 ${86 + 100 * m} 560 ${70 + 60 * m} Z`} fill="#3B0D12" {...ST} />
          {[...Array(7)].map((_, i) => { const x = 580 + i * 30, y = 48 - (i * 4); return <path key={'u' + i} d={`M ${x} ${y} l 10 ${18 + m * 8} l 10 -${18 + m * 8} Z`} fill="#fff" {...st(2)} />; })}
          {[...Array(6)].map((_, i) => { const x = 588 + i * 30, y = 70 + 60 * m + (i * 14 * m); return <path key={'l' + i} d={`M ${x} ${y} l 10 -${16 + m * 8} l 10 ${16 + m * 8} Z`} fill="#fff" {...st(2)} />; })}
        </g>
      ) : <path d="M 792 16 C 720 44 640 58 560 60" fill="none" {...st(6)} />}
    </g>
  );
}

// the megalodon's jaws from the front: the thumbnail's monster
export function Jaws({f = 0, open = 1}) {
  const o = clamp(open, 0.2, 1);
  const R = rng(4);
  const up = [...Array(13)].map((_, i) => -420 + i * 70), lo = [...Array(12)].map((_, i) => -385 + i * 70);
  return (
    <g>
      <path d="M -720 -60 C -700 -360 -380 -520 0 -530 C 380 -520 700 -360 720 -60 C 720 160 520 420 0 470 C -520 420 -720 160 -720 -60 Z" fill="#AEBBC7" {...ST} />
      <path d="M -720 -60 C -700 -360 -380 -520 0 -530 C 380 -520 700 -360 720 -60 C 560 -300 300 -400 0 -404 C -300 -400 -560 -300 -720 -60 Z" fill="#8D9BA8" />
      <circle cx={-520} cy={-210} r={34} fill={INK} /><circle cx={-512} cy={-220} r={9} fill="#fff" />
      <circle cx={520} cy={-210} r={34} fill={INK} /><circle cx={528} cy={-220} r={9} fill="#fff" />
      <ellipse cx={0} cy={60} rx={500} ry={300 * o} fill="#2A070B" {...st(10)} />
      <ellipse cx={0} cy={80 + 60 * o} rx={300} ry={140 * o} fill="#5A1219" />
      {up.map((x, i) => { const y = 60 - 300 * o * Math.sqrt(Math.max(0, 1 - (x / 500) ** 2)); const h = 70 + R() * 30;
        return <path key={'u' + i} d={`M ${x - 30} ${y - 6} L ${x + 30} ${y - 6} L ${x} ${y + h} Z`} fill="#FBFBF6" {...st(4)} />; })}
      {lo.map((x, i) => { const y = 60 + 300 * o * Math.sqrt(Math.max(0, 1 - (x / 500) ** 2)); const h = 60 + R() * 30;
        return <path key={'l' + i} d={`M ${x - 28} ${y + 6} L ${x + 28} ${y + 6} L ${x} ${y - h} Z`} fill="#FBFBF6" {...st(4)} />; })}
    </g>
  );
}

// ───────────── the 1918 crayfish boat, side view (bow to the right) ─────────────
export function Boat({f = 0, sail = 0}) {
  const roll = Math.sin(f * 0.05) * 1.6;
  return (
    <g transform={`rotate(${roll})`}>
      <path d="M -430 -40 L 470 -40 C 440 30 400 90 330 110 L -360 110 C -400 80 -420 30 -430 -40 Z" fill="#8B5A2B" {...ST} />
      {[0, 1, 2].map((i) => <path key={i} d={`M ${-420 + i * 6} ${-6 + i * 36} L ${450 - i * 30} ${-6 + i * 36}`} stroke="#6B4220" strokeWidth={6} />)}
      <rect x={-440} y={-62} width={920} height={26} rx={8} fill="#A9744A" {...st(5)} />
      <path d="M 40 -62 L 40 -560" stroke="#6B4220" strokeWidth={18} />
      <path d="M 40 -62 L 40 -560" fill="none" {...st(4)} />
      {sail > 0 ? <path d={`M 52 -540 C ${150 + 140 * sail} -420 ${170 + 150 * sail} -220 60 -90 Z`} fill="#F1E7D0" {...ST} />
        : <rect x={10} y={-200} width={60} height={130} rx={24} fill="#E7DAC0" {...st(5)} />}
      <path d="M 40 -150 L -300 -70" stroke="#6B4220" strokeWidth={10} />
    </g>
  );
}

// a crayfish trap: a little wire cage
export const Trap = ({x, y, s = 1, tilt = 0}) => (
  <g transform={`translate(${x} ${y}) rotate(${tilt}) scale(${s})`}>
    <path d="M -70 0 C -70 -70 70 -70 70 0 L 70 50 L -70 50 Z" fill="#6B4F35" opacity={0.85} {...st(5)} />
    {[-40, 0, 40].map((x2) => <path key={x2} d={`M ${x2} -52 L ${x2} 50`} stroke="#3B2A1A" strokeWidth={4} />)}
    <path d="M -70 20 L 70 20" stroke="#3B2A1A" strokeWidth={4} />
  </g>
);

export const Coast = ({y = 640, side = 'left'}) => side === 'left'
  ? <path d={`M -40 ${y} L -40 ${y - 70} C 120 ${y - 110} 260 ${y - 60} 420 ${y - 80} C 520 ${y - 90} 600 ${y - 40} 680 ${y} Z`} fill="#5E7F55" {...st(5)} />
  : <g><path d={`M 1240 ${y} C 1340 ${y - 60} 1500 ${y - 120} 1700 ${y - 110} C 1820 ${y - 104} 1900 ${y - 90} 1960 ${y - 80} L 1960 ${y} Z`} fill="#6E8F5F" {...st(5)} />
      {[1480, 1560, 1640].map((x, i) => <g key={x}><rect x={x} y={y - 150 - i * 6} width={56} height={46} fill="#F3EAD6" {...st(4)} /><path d={`M ${x - 6} ${y - 150 - i * 6} L ${x + 28} ${y - 182 - i * 6} L ${x + 62} ${y - 150 - i * 6} Z`} fill="#B5543C" {...st(4)} /></g>)}
      <path d={`M 1300 ${y - 20} L 1460 ${y - 20}`} stroke="#6B4220" strokeWidth={14} /></g>;

// ───────────── the scenes ─────────────
// 1. a calm morning off New South Wales: two men haul up a trap (motion capture: dragging a heavy load)
function MBoat({f, len, line}) {
  const rope = 0.5 + 0.5 * Math.sin(f * 0.08);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.07} y={600}>
      <SKY />
      <circle cx={1580} cy={230} r={80} fill="#FFF1B8" /><circle cx={1580} cy={230} r={140} fill="#FFF1B8" opacity={0.3} />
      <Cloud x={420 - f * 0.4} y={190} s={0.9} /><Cloud x={1150 - f * 0.5} y={300} s={0.7} op={0.9} />
      <Coast y={640} side="left" />
      <Sea f={f} y0={640} id="mb" />
      <g transform={`translate(1000 ${700 + Math.sin(f * 0.05) * 5}) scale(0.95)`}>
        <Boat f={f} />
        {[[-250, 'fisher1', 0], [-60, 'fisher2', 9]].map(([x, who, off]) => (
          <g key={who} transform={`translate(${x} -30) scale(0.3) translate(0 -1090)`}>
            <Mover who={who} motion="drag" t={f + off + 60} dir={-1} expr="calm" f={f} seed={off + 1} shadow={false} />
          </g>))}
        <path d={`M -330 -190 C -430 -150 -470 ${-30 + rope * 10} -500 120`} fill="none" stroke="#E8DCC2" strokeWidth={8} />
      </g>
      <Trap x={500} y={830 - rope * 30} s={0.9} tilt={-8} />
      <Sea f={f} y0={760} id="mb2" front />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 2. under the boat: the traps hang on their lines... and something huge and pale rises out of the dark
function MRise({f, len, line}) {
  const p = P(line);
  const r = at(line, p.rise_on || 'rises', 0.2), g = at(line, p.glow_on || 'ghostly', 0.6);
  const y = lin(f, r - 4, r + 50, 1450, 760);
  const glow = clamp((f - g) / 12, 0, 1);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.08} y={500} hand={2}>
      <Deep f={f} depth={0.3} id="mr" surface />
      <g transform="translate(960 20) scale(0.75)"><path d="M -430 -40 L 470 -40 C 440 30 400 90 330 110 L -360 110 C -400 80 -420 30 -430 -40 Z" fill="#23384A" opacity={0.95} /></g>
      {[[700, 470], [1180, 520]].map(([x, d], i) => <g key={i}><path d={`M ${x} 140 L ${x + Math.sin(f * 0.04 + i) * 10} ${d}`} stroke="#D8CBB0" strokeWidth={5} opacity={0.8} />
        <Trap x={x + Math.sin(f * 0.04 + i) * 10} y={d + 30} s={0.8} /></g>)}
      <g transform={`translate(${980 + noise2D('mr', f * 0.01, 0) * 30} ${y}) rotate(-10) scale(0.78)`}><Shark f={f} color="pale" glow={glow} /></g>
      <rect width={W} height={H} fill="#020A10" opacity={0.25 * (1 - glow)} />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 3. the jaws close on a trap, the line pulls tight, snaps, and the shark is gone
function MTake({f, len, line}) {
  const p = P(line);
  const bite = at(line, p.pull_on || 'drags', 0.15), snap = at(line, p.snap_on || 'disappears', 0.75);
  const mouth = f < bite ? clamp((f - (bite - 18)) / 14, 0, 1) : Math.max(0, 1 - (f - bite) / 5) * 0.2;
  const sx = f < bite ? lin(f, 0, bite, -500, 620) : lin(f, bite, len, 620, 2200, (t) => t * t);
  const trapX = f < bite ? 960 : sx + 520 * 0.7, trapY = f < bite ? 560 : 560 + Math.sin(f * 0.3) * 6;
  const taut = f >= bite && f < snap;
  const broken = f >= snap;
  return (
    <g><Cam f={f} len={len} a={1.04} b={1.0} shake={f >= snap && f < snap + 10 ? 10 : 0} hand={2}>
      <Deep f={f} depth={0.42} id="mt" />
      {!broken ? <path d={`M 960 -20 ${taut ? `L ${trapX} ${trapY - 40}` : `C 970 200 940 380 ${trapX} ${trapY - 40}`}`} stroke="#D8CBB0" strokeWidth={taut ? 6 : 5} fill="none" />
        : <><path d={`M 960 -20 C 980 120 1010 ${200 + Math.sin(f * 0.2) * 20} 990 ${260 + Math.sin(f * 0.2) * 30}`} stroke="#D8CBB0" strokeWidth={5} fill="none" />
          {[0, 1, 2].map((k) => <DrawOn key={k} d={`M 990 260 l ${-30 + k * 30} ${30 + k * 6}`} k={(f - snap) / 4} stroke="#fff" w={4} op={clamp(1 - (f - snap) / 14, 0, 1)} />)}</>}
      {(!broken || f < snap + 6) && <Trap x={trapX} y={trapY} s={1.1} tilt={taut ? 18 : 0} />}
      <g transform={`translate(${sx} 600) scale(0.7)`} opacity={broken ? clamp(1 - (f - snap) / 20, 0, 1) : 1}><Shark f={f} color="pale" mouth={mouth} glow={0.6} /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 4. the size the men guessed: their boat against a 35-metre shark (and "even more": a dashed outline keeps growing)
function MSize({f, len, line}) {
  const p = P(line);
  const g = at(line, p.grow_on || '35', 0.3), m = at(line, p.more_on || 'more', 0.75);
  const k = clamp(pop(f, g, 120, 14), 0, 1.05);
  const px = 38;   // pixels per metre
  const more = clamp((f - m) / 20, 0, 1);
  return (
    <g>
      <rect width={W} height={H} fill="#0F2A44" />
      <path d={`M 0 470 L ${W} 470`} stroke="#5FA8E8" strokeWidth={6} opacity={0.5} />
      <g transform="translate(330 440) scale(0.42)"><Boat f={0} /></g>
      <Txt x={330} y={550} text="THEIR BOAT" size={34} />
      <g transform={`translate(${280 + 35 * px / 2 + 120} 640) scale(${k * (35 * px) / 1630} ${k * (35 * px) / 1630})`}><Shark f={f} color="pale" /></g>
      {more > 0 && <g opacity={more} transform={`translate(${280 + 35 * px / 2 + 120} 640) scale(${(35 * px) / 1630 * (1 + 0.5 * more)})`}>
        <path d="M 790 14 C 700 -100 420 -182 60 -192 C -262 -186 -482 -112 -602 -30 C -642 -10 -642 20 -602 40 C -482 112 -262 172 60 172 C 400 162 640 112 790 14 Z" fill="none" stroke="#FDE047" strokeWidth={10} strokeDasharray="30 22" /></g>}
      {more > 0 && <Txt x={1760} y={420} text="?" size={160} fill="#FDE047" />}
      <g transform="translate(120 860)">
        <path d={`M 0 0 L ${35 * px * k} 0`} stroke="#fff" strokeWidth={8} />
        {[0, 10, 20, 30, 35].map((mm) => mm * px <= 35 * px * k + 1 && <g key={mm}><path d={`M ${mm * px} -18 L ${mm * px} 18`} stroke="#fff" strokeWidth={6} /><Txt x={mm * px} y={-30} text={`${mm} M`} size={30} /></g>)}
      </g>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// 5. the run back to port: full sail, two scared men looking back
function MFlee({f, len, line}) {
  const p = P(line);
  const x = lin(f, 0, len, 520, 1060, (t) => t);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05} hand={1.5}>
      <SKY id="mfs" />
      <Coast y={640} side="right" />
      <Sea f={f * 2.2} y0={640} id="mf" swell={1.3} />
      {[...Array(6)].map((_, i) => <path key={i} d={`M ${x - 420 - i * 70} ${730 + (i % 2) * 18} q 30 -10 60 0`} stroke="#fff" strokeWidth={6} fill="none" opacity={0.8 - i * 0.12} />)}
      <g transform={`translate(${x} ${700 + Math.sin(f * 0.09) * 8}) rotate(${Math.sin(f * 0.07) * 2}) scale(0.95)`}>
        <Boat f={f} sail={1} />
        <g transform="translate(-260 -150) scale(0.32)"><Bust who="fisher1" x={0} y={0} s={1} expr={p.expr || 'scared'} f={f} arms="grip" seed={2} look={-1} /></g>
        <g transform="translate(-120 -140) scale(0.3)"><Bust who="fisher2" x={0} y={0} s={1} expr="scared" f={f} arms="rest" seed={5} look={-1} /></g>
      </g>
      <Sea f={f * 2.2} y0={760} id="mf2" front swell={1.3} />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 6. David Stead hears the story: the fisherman's giant, the scientist's doubt
function MStead({f, len, line}) {
  const talk = Math.floor(f / 6) % 2 === 0;
  const half = len * 0.45;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#E9DFC9" />
      <rect y={780} width={W} height={300} fill="#B89A72" />
      <rect x={760} y={140} width={420} height={300} fill="#BFD6E6" {...st(8)} /><path d="M 970 140 L 970 440 M 760 290 L 1180 290" stroke={INK} strokeWidth={6} />
      <g transform="translate(470 520)"><Bust who="fisher1" x={0} y={0} s={1} expr="worried" f={f} talk={f < half && talk} arms="flail" seed={2} /></g>
      <g transform="translate(1450 520)"><Bust who="stead" x={0} y={0} s={1} expr="calm" f={f} talk={f >= half && talk} arms="rest" seed={7} look={-1} /></g>
      <g opacity={clamp(pop(f, 6, 140, 14), 0, 1)} transform="translate(700 200)">
        <ellipse rx={290} ry={150} fill="#fff" {...ST} /><path d="M -120 130 L -190 230 L -40 140" fill="#fff" {...ST} />
        <g transform="translate(0 10) scale(0.3)"><Shark f={f} color="pale" /></g>
        <Txt x={0} y={-90} text="35 M!" size={52} fill="#E3232C" />
      </g>
      <g opacity={clamp(pop(f, half, 140, 14), 0, 1)} transform="translate(1230 190)">
        <ellipse rx={230} ry={120} fill="#fff" {...ST} /><circle cx={130} cy={150} r={22} fill="#fff" {...st(5)} /><circle cx={170} cy={200} r={13} fill="#fff" {...st(4)} />
        <g transform="translate(-20 10) scale(0.16)"><Shark f={f} color="pale" /></g>
        <path d="M -150 -70 L 150 80 M 150 -70 L -150 80" stroke="#E3232C" strokeWidth={10} opacity={0.0} />
        <Txt x={150} y={-40} text="?" size={90} fill="#2B6CB0" />
      </g>
    </Cam>
      <Labels line={line} f={f} x0={W - 100} y0={800} align="right" /></g>
  );
}

// 7. the real thing: a megalodon tooth, as long as a human hand
export const Tooth = () => (
  <g>
    <path d="M -230 -40 C -240 -110 -150 -170 0 -172 C 150 -170 240 -110 230 -40 C 150 -60 60 -64 0 -60 C -60 -64 -150 -60 -230 -40 Z" fill="#5A4636" {...ST} />
    <path d="M -230 -40 L 0 420 L 230 -40 C 150 -60 60 -64 0 -60 C -60 -64 -150 -60 -230 -40 Z" fill="#6E6A66" {...ST} />
    <path d="M -150 -30 L 0 330 L 150 -30" fill="none" stroke="#8E8A85" strokeWidth={10} opacity={0.7} />
    {[...Array(14)].map((_, i) => { const t = (i + 0.5) / 14; return <g key={i}>
      <path d={`M ${-230 + 230 * t} ${-40 + 460 * t} l -12 4`} stroke={INK} strokeWidth={4} />
      <path d={`M ${230 - 230 * t} ${-40 + 460 * t} l 12 4`} stroke={INK} strokeWidth={4} /></g>; })}
  </g>
);
export const Hand = () => (
  <g>
    <path d="M -110 420 C -130 300 -140 200 -150 110 C -156 60 -100 50 -92 100 L -80 190 L -90 -20 C -94 -70 -36 -74 -32 -24 L -20 160 L -20 -90 C -20 -140 40 -140 40 -90 L 44 150 L 66 -40 C 72 -90 128 -84 122 -34 L 104 180 L 140 90 C 160 46 210 66 194 112 C 160 220 130 320 110 420 Z" fill="#F3C9A8" {...ST} />
    <path d="M -20 300 C 20 290 60 300 90 320" fill="none" {...st(4)} opacity={0.5} />
  </g>
);
function MTooth({f, len, line}) {
  const p = P(line);
  const t = at(line, p.tooth_on || 'teeth', 0.3), hd = at(line, p.hand_on || 'hand', 0.8);
  const ts = clamp(pop(f, t, 130, 12), 0, 1.08);
  const hx = lin(f, hd - 14, hd + 8, 2300, 1340);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.06}>
      <rect width={W} height={H} fill="#0F2A44" />
      <circle cx={960} cy={500} r={520} fill="#1E4466" opacity={0.6} />
      <g transform={`translate(760 360) scale(${ts}) rotate(-4)`}><Tooth /></g>
      {p.hand !== false && <g transform={`translate(${hx} 330) rotate(4)`}><Hand /></g>}
      {p.hand !== false && f > hd && <g opacity={clamp((f - hd) / 10, 0, 1)}>
        <path d="M 560 860 L 960 860" stroke="#FDE047" strokeWidth={8} /><path d="M 560 840 L 560 880 M 960 840 L 960 880" stroke="#FDE047" strokeWidth={8} />
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={W - 100} y0={120} align="right" /></g>
  );
}

// 8. THE TITLE (and the thumbnail): the jaws rising under a tiny boat
export function MegArt({boxes = true, f = 0, top = 'MEGALODON', bottom = 'STILL ALIVE?', open = 1}) {
  return (
    <g>
      <Deep f={f} depth={0.55} id="ma" surface />
      <g transform={`translate(1300 ${70 + Math.sin(f * 0.05) * 4}) scale(0.5)`}><path d="M -430 -40 L 470 -40 C 440 30 400 90 330 110 L -360 110 C -400 80 -420 30 -430 -40 Z" fill="#1B2D3D" /></g>
      <path d="M 1290 120 L 1300 300" stroke="#D8CBB0" strokeWidth={4} opacity={0.7} />
      <g transform={`translate(1290 ${700 - Math.min(f, 40) * 1.2}) scale(1.05)`}><Jaws f={f} open={open} /></g>
      {boxes && <><Box x={60} y={110} w={820} h={190} text={top} rot={-3} />
        <Box x={60} y={320} w={900} h={220} text={bottom} fill="#E3232C" color="#fff" outline rot={-3} /></>}
    </g>
  );
}
function MTitle({f, len, line}) {
  const p = P(line);
  const a = at(line, p.top_on || 'megalodon', 0.3), b = at(line, p.bottom_on || 'alive', 0.7);
  return (
    <g>
      <g transform={`translate(960 540) scale(${lin(f, 0, len, 1.1, 1.0)}) translate(-960 -540)`}><MegArt boxes={false} f={f} open={lin(f, 0, len * 0.6, 0.4, 1)} /></g>
      <Box x={60} y={110} w={p.top_w || 820} h={190} text={p.top || 'MEGALODON'} rot={-3} s={clamp(pop(f, a, 160, 12), 0, 1.1)} />
      <Box x={60} y={320} w={p.bottom_w || 900} h={220} text={p.bottom || 'STILL ALIVE?'} fill="#E3232C" color="#fff" outline rot={-3} s={clamp(pop(f, b, 160, 12), 0, 1.1)} />
    </g>
  );
}

export const MEG_SHOTS = {m_boat: MBoat, m_rise: MRise, m_take: MTake, m_size: MSize, m_flee: MFlee, m_stead: MStead, m_tooth: MTooth, m_title: MTitle};
