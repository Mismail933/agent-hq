// Storygraphics #3 (2.59.0), the five exhibits: HMS Challenger's teeth and their manganese crust, the 1918 crew on the wharf,
// the 2013 TV film, the unmapped seabed and the megamouth. Every scene takes {f, len, line}; line.p holds the script's choices.
import React from 'react';
import {noise2D} from '@remotion/noise';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Box, Bust, Cloud, at, Labels, Figure} from './tis';
import {Sea, Deep, Seabed, Ship} from './ocean';
import {Shark, Boat, Tooth, Coast, SKY} from './meg';
import {Emoji} from './emoji';
import {P, Txt, Cam, BG, popAt, popBy, Silhouette, Gauge, Whale} from './meg2';

// ───────────── HMS Challenger: a three-masted steam corvette (bow right) ─────────────
const Challenger = ({f = 0}) => (
  <g transform={`rotate(${Math.sin(f * 0.05) * 1.4})`}>
    <path d="M -520 -30 L 560 -30 C 530 40 480 90 400 110 L -440 110 C -490 80 -510 30 -520 -30 Z" fill="#1F2937" {...ST} />
    <path d="M -510 0 L 545 0" stroke="#F8FAFC" strokeWidth={10} />
    {[-300, 0, 300].map((x, i) => <g key={x}>
      <path d={`M ${x} -30 L ${x} -560`} stroke="#5B3A1E" strokeWidth={14} />
      {[0, 1, 2].map((k) => <path key={k} d={`M ${x - 140 + k * 20} ${-150 - k * 140} C ${x - 120 + k * 20} ${-90 - k * 140} ${x + 120 - k * 20} ${-90 - k * 140} ${x + 140 - k * 20} ${-150 - k * 140} L ${x + 130 - k * 20} ${-250 - k * 140} L ${x - 130 + k * 20} ${-250 - k * 140} Z`} fill="#F3EBD8" {...st(5)} />)}
    </g>)}
    <rect x={-110} y={-140} width={60} height={110} fill="#3F3F46" {...st(5)} />
    <path d="M 560 -30 L 700 -120" stroke="#5B3A1E" strokeWidth={10} />
  </g>
);

function MChallenger({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'sail';
  if (mode === 'sail') {
    const x = lin(f, 0, len, 700, 1150, (t) => t);
    return (
      <g><Cam f={f} len={len} a={1} b={1.05} y={560}>
        <SKY id="chs" />
        <Cloud x={300 + f * 0.3} y={200} s={1} /><Cloud x={1300 + f * 0.2} y={150} s={0.8} />
        <Sea f={f} y0={680} id="chsea" />
        <g transform={`translate(${x} 700) scale(0.85)`}><Challenger f={f} /></g>
        <Sea f={f + 20} y0={800} id="chsea2" front />
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  // dredge: a cut-away of the ocean, the ship above, the dredge on its cable down to the red clay and back up with two teeth
  const d = at(line, p.up_on || 'came', 0.45);
  const down = lin(f, 0, d, 0, 1), up = lin(f, d, d + 60, 0, 1);
  const y = 260 + 600 * down - 600 * up;
  const tooth = at(line, p.teeth_on || 'teeth', 0.8);
  return (
    <g><Cam f={f} len={len} a={1} b={1.04}>
      <rect width={W} height={H} fill="#0B2742" />
      <rect width={W} height={170} fill="#7FB8E0" />
      <path d={`M 0 170 L ${W} 170`} stroke="#E0F2FE" strokeWidth={6} />
      <g transform="translate(560 160) scale(0.4)"><Challenger f={f} /></g>
      <rect y={900} width={W} height={180} fill="#8E3B2A" {...ST} />
      {[...Array(14)].map((_, i) => <ellipse key={i} cx={i * 150 + 40} cy={960 + (i % 3) * 30} rx={40} ry={10} fill="#6E2A1E" />)}
      <Txt x={1500} y={1000} text="RED CLAY" size={50} fill="#FCA5A5" op={0} />
      <path d={`M 760 170 L 980 ${y}`} stroke="#CBD5E1" strokeWidth={5} />
      <Txt x={640} y={620} text="DEEP PACIFIC" size={60} fill="#7FB8E0" stroke="none" />
      <g transform={`translate(980 ${y}) scale(1.6)`}>
        <path d="M -90 -30 L 90 -30 L 70 70 L -70 70 Z" fill="#475569" {...st(5)} />
        {[-50, -10, 30].map((x2) => <path key={x2} d={`M ${x2} -30 L ${x2 + 10} 70`} stroke="#94A3B8" strokeWidth={4} />)}
        {f > d && <g><g transform="translate(-30 -40) scale(0.14) rotate(-10)"><Tooth /></g><g transform="translate(36 -36) scale(0.12) rotate(12)"><Tooth /></g></g>}
      </g>
      <Txt x={1560} y={560} text="SOUTH OF TAHITI, 1875" size={46} fill="#E0F2FE" op={0} />
      {f > tooth && <g transform={`translate(1450 520) scale(${clamp(pop(f, tooth, 140, 12), 0, 1.05)})`}>
        <circle r={240} fill="#F8FAFC" {...ST} />
        <g transform="translate(-70 -60) scale(0.36) rotate(-10)"><Tooth /></g><g transform="translate(80 -40) scale(0.32) rotate(12)"><Tooth /></g>
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={240} /></g>
  );
}

// the manganese crust: a kettle's limescale, the crust's thickness, the growth rate, the arithmetic run again, the tooth lying exposed, the stopwatch
const CrustTooth = ({crust = 0, s = 1, rot = 0, worn = false}) => (
  <g transform={`rotate(${rot}) scale(${s})`}>
    <Tooth />
    {crust > 0 && <g opacity={0.25 + 0.6 * clamp(crust, 0, 1)}>
      <path d="M -250 -40 C -260 -120 -150 -192 0 -194 C 150 -192 260 -120 250 -40 L 0 450 Z" fill="#1F1A17" stroke="#1F1A17" strokeWidth={6 + 20 * crust} strokeLinejoin="round" />
      {[...Array(12)].map((_, i) => <circle key={i} cx={-150 + (i % 4) * 100} cy={-100 + Math.floor(i / 4) * 130} r={10 + (i % 3) * 6} fill="#3B2F28" />)}
    </g>}
    {worn && <g stroke={INK} strokeWidth={5} fill="none"><path d="M -80 120 l 30 30 l -10 30" /><path d="M 60 40 l -20 40" /><path d="M -180 -60 l 40 20" /></g>}
  </g>
);
const Kettle = () => (
  <g>
    <path d="M -200 160 C -230 40 -200 -100 -120 -150 L 120 -150 C 200 -100 230 40 200 160 Z" fill="#CBD5E1" {...ST} />
    <path d="M -120 -150 C -100 -200 100 -200 120 -150" fill="#94A3B8" {...ST} />
    <path d="M 200 0 C 300 -40 330 -120 340 -170 L 300 -170 C 290 -110 260 -60 196 -40" fill="#CBD5E1" {...ST} />
    <path d="M -170 -120 C -310 -110 -320 80 -196 110" fill="none" {...st(26)} />
    <path d="M -170 -120 C -310 -110 -320 80 -196 110" fill="none" stroke="#475569" strokeWidth={14} />
  </g>
);
function MCrust({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'kettle';
  const a = at(line, p.on || '', 0.3);
  if (mode === 'kettle') {
    const g = lin(f, 6, len - 10, 0, 1);
    return (
      <g><Cam f={f} len={len} a={1} b={1.05}>
        <BG c="#F5EBD7" />
        <g transform="translate(560 560)"><Kettle /></g>
        <g transform="translate(560 560)"><path d="M -150 140 L 150 140" stroke="#E7E1D3" strokeWidth={40 * g + 2} /><Txt x={0} y={280} text="LIMESCALE" size={52} fill={INK} stroke="none" /></g>
        <g transform="translate(1360 470)"><CrustTooth crust={g} s={0.6} /><Txt x={0} y={360} text="MANGANESE CRUST" size={52} fill={INK} stroke="none" /></g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  if (mode === 'date') {   // the two crusts and the answer
    const b = at(line, p.b_on || 'growth', 0.5), c = at(line, p.c_on || '11,000', 0.8);
    return (
      <g>
        <BG c="#0B1F3A" />
        {[[480, 0.45, '1.7 MM', '11,000 YEARS'], [1440, 0.95, '3.64 MM', '24,000 YEARS']].map(([x, cr, mm, yrs], i) => (
          <g key={i} transform={`translate(${x} 380)`}>
            <circle cx={0} cy={60} r={200} fill="#CBD5E1" opacity={0.22} />
            <CrustTooth crust={cr} s={0.55} />
            <g transform={`translate(0 330) scale(${clamp(pop(f, i ? 18 : 6, 150, 12), 0, 1)})`}><Box x={-160} y={-50} w={320} h={90} text={mm} fill="#fff" /></g>
            {f > c + i * 12 && <g transform={`translate(0 480) scale(${clamp(pop(f, c + i * 12, 150, 12), 0, 1.05)})`}><Box x={-230} y={-50} w={460} h={100} text={yrs} fill="#FFE11A" /></g>}
          </g>))}
        {f > b && <g opacity={clamp((f - b) / 10, 0, 1)}><Txt x={960} y={150} text="0.15 MM PER 1,000 YEARS" size={64} fill="#FDE047" /></g>}
      </g>
    );
  }
  if (mode === 'rate') {   // the rate from old radium estimates: x20 too fast
    const x = at(line, p.x_on || 'twenty', 0.7);
    return (
      <g>
        <BG c="#0B1F3A" />
        <g transform="translate(960 330)"><Box x={-560} y={-70} w={1120} h={140} text="0.15 MM PER 1,000 YEARS" fill="#fff" /></g>
        <g transform="translate(560 650)"><g transform={`scale(${popAt(f, line, p.radium_on || 'radium', 0.3)})`}><circle r={150} fill="#FDE047" {...ST} />
          {[0, 120, 240].map((r) => <path key={r} transform={`rotate(${r + f * 0.6})`} d="M 0 -20 L -60 -125 A 120 120 0 0 1 60 -125 Z" fill={INK} />)}<circle r={26} fill={INK} /></g>
          <Txt x={0} y={240} text="OLD RADIUM ESTIMATES" size={44} /></g>
        {f > x && <g transform={`translate(1360 650) rotate(-8) scale(${clamp(pop(f, x, 150, 11), 0, 1.1)})`}>
          <rect x={-330} y={-110} width={660} height={220} rx={20} fill="none" stroke="#E3232C" strokeWidth={16} />
          <Txt x={0} y={-10} text="20x TOO FAST" size={100} fill="#E3232C" stroke="#0B1F3A" /><Txt x={0} y={80} text="OR MORE" size={56} fill="#FCA5A5" stroke="#0B1F3A" /></g>}
      </g>
    );
  }
  if (mode === 'rewind') {   // the arithmetic again: 11,000 -> 200,000+, 24,000 -> ~500,000
    const b = at(line, p.b_on || '200,000', 0.4), c = at(line, p.c_on || 'half', 0.6), r = at(line, p.r_on || 'rough', 0.85);
    const n1 = Math.round(lin(f, b - 6, b + 30, 11000, 220000) / 1000) * 1000, n2 = Math.round(lin(f, c - 6, c + 30, 24000, 480000) / 1000) * 1000;
    return (
      <g>
        <BG c="#0B1F3A" />
        <Txt x={960} y={180} text="CRUST GROWS 20x SLOWER" size={70} fill="#FDE047" />
        {[[540, n1, '1.7 MM'], [1380, n2, '3.64 MM']].map(([x, n, mm], i) => (
          <g key={i} transform={`translate(${x} 520)`}>
            <rect x={-330} y={-150} width={660} height={300} rx={26} fill="#F8FAFC" {...ST} />
            <Txt x={0} y={-60} text={mm} size={56} fill="#64748B" stroke="none" />
            <Txt x={0} y={80} text={`${n.toLocaleString('en-US')}${i === 0 && n > 200000 ? '+' : ''}`} size={130} fill={INK} stroke="none" />
            <Txt x={0} y={210} text="YEARS" size={50} />
          </g>))}
        {f > r && <g transform={`translate(960 875) rotate(-3) scale(${clamp(pop(f, r, 150, 12), 0, 1.05)})`}><Box x={-430} y={-50} w={860} h={100} text="AND STILL TOO ROUGH TO TRUST" fill="#E3232C" color="#fff" outline /></g>}
      </g>
    );
  }
  if (mode === 'exposed' || mode === 'buried') {   // a cut-away of the seabed: the tooth buried in old clay, washed out, and only then a crust
    const wash = at(line, p.wash_on || 'exposed', 0.4);
    const out = mode === 'exposed' ? lin(f, wash, wash + 40, 0, 1) : 0;
    const crust = mode === 'exposed' ? lin(f, wash + 40, len, 0, 0.8) : 0;
    return (
      <g><Cam f={f} len={len} a={1} b={1.04}>
        <Deep f={f} depth={0.9} id="cre" />
        <rect y={560} width={W} height={520} fill="#6E4B32" {...ST} />
        {[...Array(5)].map((_, i) => <path key={i} d={`M 0 ${640 + i * 80} C 500 ${620 + i * 80} 1400 ${660 + i * 80} 1920 ${630 + i * 80}`} stroke="#5A3C27" strokeWidth={10} fill="none" />)}
        <g transform={`translate(960 ${lin(out, 0, 1, 680, 520)}) rotate(${lin(out, 0, 1, 30, 80)})`}><CrustTooth crust={crust} s={0.38} worn={!!p.worn} /></g>
        {out > 0 && out < 1 && [...Array(6)].map((_, i) => <path key={i} d={`M ${300 + i * 60 + f * 8 % 400} ${430 + i * 14} q 60 -20 120 0`} stroke="#BAE6FD" strokeWidth={6} fill="none" opacity={0.7} />)}
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  if (mode === 'worn') {   // already worn and battered before any crust
    return (
      <g><Cam f={f} len={len} a={1} b={1.06}>
        <BG c="#0B1F3A" />
        {[[620, -12], [1300, 10]].map(([x, r], i) => <g key={i} transform={`translate(${x} 420)`}><CrustTooth crust={0} s={0.62} rot={r} worn /></g>)}
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  // stopwatch: a timeline from the shark's death to today; the crust's stopwatch starts late
  const late = at(line, p.late_on || 'late', 0.7);
  return (
    <g>
      <BG c="#0B1F3A" />
      <path d="M 160 640 L 1760 640" stroke="#94A3B8" strokeWidth={8} />
      <g transform="translate(260 640)"><circle r={18} fill="#E3232C" /><Txt x={0} y={90} text="THE SHARK DIES" size={40} /></g>
      <g transform="translate(1700 640)"><circle r={18} fill="#22C55E" /><Txt x={0} y={90} text="TODAY" size={40} /></g>
      <g transform="translate(1180 640)"><circle r={18} fill="#FDE047" /><Txt x={0} y={90} text="CRUST STARTS" size={40} fill="#FDE047" /></g>
      <rect x={1180} y={600} width={lin(f, 10, 60, 0, 520)} height={20} fill="#FDE047" />
      <rect x={260} y={600} width={920} height={20} fill="#475569" opacity={clamp((f - late) / 12, 0, 1)} />
      <Txt x={720} y={560} text="NOT MEASURED" size={48} fill="#94A3B8" op={clamp((f - late) / 12, 0, 1)} />
      <g transform={`translate(1180 330) rotate(${(f * 6) % 360 * 0}) scale(${popAt(f, line, 'stopwatch', 0.2)})`}><Emoji name="stopwatch" size={300} /></g>
    </g>
  );
}

// people painting on a cave wall (the last Ice Age)
function MCave({f, len, line}) {
  const p = P(line);
  const sh = at(line, p.on || 'painting', 0.5);
  return (
    <g><Cam f={f} len={len} a={1} b={1.06}>
      <rect width={W} height={H} fill="#3B2416" />
      <path d="M -40 120 C 400 40 1500 60 1960 140 L 1960 900 C 1500 980 400 960 -40 900 Z" fill="#C08A57" {...ST} />
      <circle cx={1700} cy={980} r={300} fill="#F59E0B" opacity={0.12 + 0.04 * Math.sin(f * 0.3)} />
      {[[300, 300], [380, 360], [1600, 260]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y}) rotate(${i * 20 - 10}) scale(0.9)`} opacity={0.75}>
        <path d="M -40 60 C -50 0 -46 -40 -40 -70 M -20 60 L -20 -90 M 0 60 L 4 -96 M 20 60 L 26 -84 M 34 66 L 70 -20" stroke="#7F1D1D" strokeWidth={22} strokeLinecap="round" fill="none" /></g>)}
      <g transform="translate(760 430)" opacity={0.85}>
        <path d="M -200 0 C -140 -80 0 -100 120 -60 L 200 -110 L 180 -20 L 220 40 L 120 20 C 0 60 -140 60 -200 0 Z" fill="none" stroke="#3B1A0E" strokeWidth={16} strokeLinejoin="round" />
        {[-120, -60].map((x) => <path key={x} d={`M ${x} 30 L ${x - 10} 120 M ${x + 30} 30 L ${x + 40} 120`} stroke="#3B1A0E" strokeWidth={14} strokeLinecap="round" />)}
      </g>
      {f > sh && <g transform={`translate(1240 560) scale(${clamp(pop(f, sh, 120, 13), 0, 1)})`} opacity={0.9}>
        <path d="M -260 0 C -150 -90 120 -90 260 -10 L 330 -100 L 310 10 L 330 100 L 250 20 C 100 70 -150 70 -260 0 Z M -40 -70 L 0 -160 L 60 -70" fill="#1E293B" opacity={0.75} stroke="#0F172A" strokeWidth={10} strokeLinejoin="round" />
        <Txt x={0} y={180} text="?" size={140} fill="#FDE047" /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the wharf: Stead, the inspector and the crew; sizes against the wharf ─────────────
const Wharf = ({y = 760, w = 1500, x = 210}) => (
  <g>
    <rect x={x} y={y} width={w} height={40} fill="#8B5A2B" {...ST} />
    {[...Array(Math.round(w / 120) + 1)].map((_, i) => <rect key={i} x={x + i * 120} y={y + 40} width={22} height={240} fill="#6B4220" {...st(5)} />)}
  </g>
);
function MWharf({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'tell';
  if (mode === 'tell' || mode === 'crew') {
    const crew = mode === 'crew';
    return (
      <g><Cam f={f} len={len} a={crew ? 1.08 : 1} b={crew ? 1.0 : 1.05} y={600}>
        <SKY id="whs" />
        <Sea f={f} y0={820} id="whsea" />
        <Wharf y={790} w={2000} x={-40} />
        {[['fisher1', 360, 'worried'], ['fisher2', 600, crew ? 'scared' : 'worried'], ['fisher1', 840, 'grim']].map(([w, x, e], i) => (
          <g key={i} transform={`translate(${x} 340) scale(0.4)`}><Figure who={w} pose={i === 0 && !crew ? 'signal' : 'stand'} expr={e} f={f} talk={!crew && i === 0 && Math.floor(f / 7) % 2 === 0} seed={i + 2} /></g>))}
        {!crew && <g transform="translate(1250 340) scale(0.4)"><Figure who="stead" pose="stand" expr="calm" f={f} seed={7} look={-2} /></g>}
        {!crew && <g transform="translate(1480 340) scale(0.4)"><Figure who="passenger" pose="stand" expr="calm" f={f} seed={8} look={-2} /></g>}
        {!crew && <g transform={`translate(1560 250) scale(${popAt(f, line, p.book_on || 'book', 0.8)})`}><Emoji name="open book" size={190} /></g>}
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  if (mode === 'measure300' || mode === 'measure115') {   // the claimed length against the wharf (35 m long)
    const m = mode === 'measure300' ? 91.4 : 35;
    const px = mode === 'measure300' ? 17 : 38, x0 = 120;
    const g = clamp(pop(f, at(line, p.grow_on || '', 0.25), 110, 14), 0, 1.03);
    return (
      <g><Cam f={f} len={len} a={1} b={1.04}>
        <rect width={W} height={H} fill="#0F2A44" />
        <g transform={`translate(${x0 + 35 * px / 2} 640)`}><rect x={-35 * px / 2} y={0} width={35 * px} height={34} fill="#8B5A2B" {...st(5)} />
          {[...Array(8)].map((_, i) => <rect key={i} x={-35 * px / 2 + i * 35 * px / 7 - 8} y={34} width={16} height={120} fill="#6B4220" {...st(4)} />)}
          <Txt x={0} y={200} text="THE WHARF: 35 M" size={44} /></g>
        <g transform={`translate(${x0 + m * px / 2} 380) scale(${g} 1)`}><Silhouette len={m * px} color="pale" f={f} /></g>
        <g transform="translate(0 760)"><path d={`M ${x0} 0 L ${x0 + m * px * g} 0`} stroke="#FDE047" strokeWidth={8} />
          <Txt x={x0 + m * px * g + 20} y={18} text={mode === 'measure300' ? '300 FT' : '115 FT'} size={50} fill="#FDE047" anchor="start" /></g>
      </Cam>
        <Labels line={line} f={f} x0={W - 100} y0={90} align="right" /></g>
    );
  }
  // tapes: 300 against 115, nearly three times
  const b = at(line, p.b_on || '115', 0.5), c = at(line, p.c_on || 'gap', 0.8);
  return (
    <g>
      <BG c="#0B1F3A" />
      {[[330, 300, '300 FT', 6], [600, 115, '115 FT', b]].map(([y, ft, t, a0], i) => {
        const k = lin(f, a0, a0 + 30, 0, 1);
        return <g key={i} transform={`translate(160 ${y})`}>
          <rect x={0} y={-50} width={1600 * ft / 300 * k} height={100} rx={10} fill="#FDE047" {...st(6)} />
          {[...Array(Math.floor(ft * k / 25) + 1)].map((_, j) => <path key={j} d={`M ${j * 25 * 1600 / 300} -50 L ${j * 25 * 1600 / 300} -10`} stroke={INK} strokeWidth={4} />)}
          <Txt x={Math.max(170, 1600 * ft / 300 * k - 20)} y={30} text={t} size={70} fill={INK} stroke="none" anchor="end" op={clamp((k - 0.12) * 6, 0, 1)} />
        </g>; })}
      {[440, 600, 760].map((x, i) => <g key={i} transform={`translate(${x + 380} 640) scale(0.22)`}><Figure who={i === 1 ? 'fisher2' : 'fisher1'} expr="worried" f={f} seed={i + 1} /></g>)}
      {f > c && <g transform={`translate(1500 820) rotate(-6) scale(${clamp(pop(f, c, 150, 12), 0, 1.05)})`}><Box x={-200} y={-60} w={400} h={120} text="~3x" fill="#E3232C" color="#fff" outline /></g>}
    </g>
  );
}

// a shark seen from a small boat: from above, through moving water, no ruler
function MAbove({f, len, line}) {
  const R = rng(4);
  return (
    <g><Cam f={f} len={len} a={1} b={1.08} hand={2}>
      <rect width={W} height={H} fill="#1D5C85" />
      <g opacity={0.5} transform={`translate(${960 + noise2D('ab', f * 0.01, 0) * 80} 560) rotate(-12) scale(${0.65 + 0.06 * Math.sin(f * 0.04)} 0.65)`}><Shark f={f} color="pale" /></g>
      {[...Array(30)].map((_, i) => { const x = R() * W, y = R() * H; return <path key={i} d={`M ${x + Math.sin(f * 0.07 + i) * 30} ${y} q 60 ${-20 + Math.sin(f * 0.1 + i) * 14} 120 0`} stroke="#BAE6FD" strokeWidth={8} fill="none" opacity={0.5} />; })}
      <path d="M -40 -40 L 1960 -40 L 1960 140 C 1500 220 400 220 -40 140 Z" fill="#8B5A2B" {...ST} />
      <path d="M -40 1120 L 1960 1120 L 1960 960 C 1500 880 400 880 -40 960 Z" fill="#8B5A2B" {...ST} />
    </Cam>
      <Labels line={line} f={f} x0={W - 100} y0={240} align="right" /></g>
  );
}

// ───────────── the 2013 TV film ─────────────
const TV = ({children, w = 1100, h = 660, f = 0, snow = 0}) => {
  const R = rng(f + 1);   // new snow every frame (every other frame read as 70 stalls in the motion check)
  return (
    <g>
      <rect x={-w / 2 - 50} y={-h / 2 - 50} width={w + 100} height={h + 100} rx={40} fill="#1F2937" {...ST} />
      <clipPath id="tvclip"><rect x={-w / 2} y={-h / 2} width={w} height={h} rx={20} /></clipPath>
      <g clipPath="url(#tvclip)"><rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#0B2742" />{children}
        {snow > 0 && [...Array(160)].map((_, i) => <rect key={i} x={-w / 2 + R() * w} y={-h / 2 + R() * h} width={12 + R() * 30} height={6} fill={R() > 0.5 ? '#fff' : '#94A3B8'} opacity={snow} />)}
      </g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={20} fill="none" {...st(8)} />
      <path d={`M -120 ${h / 2 + 50} L -200 ${h / 2 + 130} M 120 ${h / 2 + 50} L 200 ${h / 2 + 130}`} stroke="#1F2937" strokeWidth={18} />
    </g>
  );
};
function MTv({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'show';
  const room = (inner, opts = {}) => (
    <g><Cam f={f} len={len} a={opts.a || 1} b={opts.b || 1.06} y={500}>
      <rect width={W} height={H} fill="#2A2238" />
      <rect y={820} width={W} height={260} fill="#3B2F4F" />
      <g transform="translate(960 460)"><TV f={f} snow={opts.snow || 0}>{inner}</TV></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
  if (mode === 'show') return room(<g>
    <g transform={`translate(${lin(f, 0, len, 300, -300)} 120) scale(0.5)`}><path d="M -40 0 L 120 -260 L 220 0 Z" fill="#475569" {...ST} /></g>
    <path d={`M -560 120 C -300 100 -100 140 200 110 S 500 130 560 120`} stroke="#7DD3FC" strokeWidth={8} fill="none" />
    <g transform="translate(0 -200)"><Box x={-430} y={-60} w={860} h={110} text="MEGALODON: THE MONSTER SHARK LIVES" fill="#E3232C" color="#fff" outline s={popAt(f, line, p.title_on || 'megalodon', 0.3)} /></g>
    <g transform="translate(380 220)"><Box x={-120} y={-30} w={240} h={60} text="SHARK WEEK" fill="#FDE047" /></g>
  </g>);
  if (mode === 'static') return room(<g />, {snow: 1});
  if (mode === 'actor') {   // the man on screen: a 'marine biologist', then the truth
    const tr = at(line, p.truth_on || 'actor', 0.6);
    return room(<g>
      <rect x={-550} y={-330} width={1100} height={660} fill="#5B7E9A" />
      <g transform="translate(-60 120) scale(0.95)"><Bust who="actor" x={0} y={0} s={1} expr="calm" f={f} talk={f < tr && Math.floor(f / 6) % 2 === 0} arms="rest" seed={4} /></g>
      <g transform="translate(-520 230)"><Box x={0} y={0} w={520} h={70} text={f < tr ? 'COLIN DRAKE, MARINE BIOLOGIST' : 'DARRON MEYER, ACTOR'} fill={f < tr ? '#fff' : '#FDE047'} /></g>
      {f > tr && <g transform={`translate(260 -120) rotate(-10) scale(${clamp(pop(f, tr, 150, 11), 0, 1.1)})`}><rect x={-200} y={-70} width={400} height={140} rx={16} fill="none" stroke="#E3232C" strokeWidth={16} /><Txt x={0} y={36} text="ACTOR" size={110} fill="#E3232C" stroke="#fff" /></g>}
    </g>);
  }
  if (mode === 'fake') {   // the missing boat and the bitten whale that never were (2.61.1: dark words, the X behind them)
    const b = at(line, p.b_on || 'whale', 0.5);
    const X1 = p.x !== false ? popAt(f, line, p.a_on || 'no', 0.2) : 0, X2 = p.x !== false && f > b ? clamp(pop(f, b + 10, 150, 12), 0, 1) : 0;
    const cross = (k) => k > 0 && <g transform={`scale(${k})`}><path d="M -260 -200 L 260 200 M 260 -200 L -260 200" stroke="#E3232C" strokeWidth={34} strokeLinecap="round" opacity={0.85} /></g>;
    return (
      <g>
        <BG c="#0B1F3A" />
        <g transform="translate(520 470)"><rect x={-360} y={-260} width={720} height={520} rx={30} fill="#7FB8E0" {...ST} />
          <g transform="translate(0 0) scale(0.5)"><Boat f={f} /></g>{cross(X1)}
          <rect x={-330} y={170} width={660} height={64} rx={10} fill="#F8FAFC" {...st(4)} /><Txt x={0} y={216} text="BOAT LOST OFF SOUTH AFRICA" size={40} fill={INK} stroke="none" /></g>
        <g transform="translate(1400 470)"><rect x={-360} y={-260} width={720} height={520} rx={30} fill="#F6E7B8" {...ST} />
          <path d="M -360 120 L 360 120 L 360 230 C 360 250 350 260 330 260 L -330 260 C -350 260 -360 250 -360 230 Z" fill="#E9D7A5" />
          <g transform="translate(0 40)"><Whale len={520} f={0} bite /></g>{cross(X2)}
          <rect x={-330} y={170} width={660} height={64} rx={10} fill="#F8FAFC" {...st(4)} /><Txt x={0} y={216} text="BITTEN WHALE IN HAWAII" size={40} fill={INK} stroke="none" /></g>
        {p.x !== false && <g transform="translate(960 870)"><Box x={-300} y={-50} w={600} h={100} text="NEVER HAPPENED" fill="#E3232C" color="#fff" outline s={popAt(f, line, p.c_on || '', 0.8)} /></g>}
      </g>
    );
  }
  if (mode === 'disclaimer') return room(<g>
    <g transform={`translate(${lin(f, 0, len, 200, -200)} 60) scale(0.45)`}><path d="M -40 0 L 120 -260 L 220 0 Z" fill="#475569" {...ST} /></g>
    <text x={0} y={300} textAnchor="middle" fontFamily="Arial" fontSize={14} fill="#CBD5E1">Although some events and characters are dramatized, sightings of megalodon persist to this day...</text>
    <g transform={`translate(${lin(f, 10, 40, 400, 0)} 250) scale(${popAt(f, line, 'brief', 0.2)})`}><circle r={110} fill="#E0F2FE" opacity={0.3} {...st(10)} /><path d="M 78 78 L 190 190" stroke={INK} strokeWidth={30} strokeLinecap="round" /></g>
  </g>, {a: 1, b: 1.25});
  // poll: do you believe? YES > 70%
  const yes = at(line, p.yes_on || 'seven', 0.5);
  const k = lin(f, yes - 10, yes + 30, 0, 1);
  return (
    <g><Cam f={f} len={len} a={1} b={1.04}>
      <BG c="#2A2238" />
      <Txt x={960} y={190} text="DO YOU BELIEVE MEGALODON SURVIVED?" size={72} fill="#fff" />
      {[['YES', 0.73, '#22C55E'], ['NO', 0.27, '#E3232C']].map(([t, v, c], i) => (
        <g key={t} transform={`translate(360 ${400 + i * 230})`}>
          <Txt x={-40} y={70} text={t} size={80} anchor="end" />
          <rect x={0} y={0} width={1200 * v * k} height={110} rx={14} fill={c} {...st(6)} />
          <Txt x={1200 * v * k + 30} y={80} text={i === 0 ? 'MORE THAN 70%' : ''} size={64} fill="#FDE047" anchor="start" op={clamp(k * 3, 0, 1)} />
        </g>))}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={830} /></g>
  );
}

// the world's seabed: 28.7% mapped sharp, the rest a blur
function MGlobe({f, len, line}) {
  const p = P(line);
  const k = lin(f, 6, 46, 0, 0.287);
  const R = rng(12);
  return (
    <g><Cam f={f} len={len} a={1} b={1.06}>
      <BG c="#061629" />
      <g transform="translate(700 540)">
        <circle r={400} fill="#0E3A5F" {...ST} />
        <clipPath id="gclip"><circle r={396} /></clipPath>
        <g clipPath="url(#gclip)">
          {[...Array(26)].map((_, i) => <ellipse key={i} cx={-400 + R() * 800} cy={-400 + R() * 800} rx={60 + R() * 120} ry={30 + R() * 60} fill="#123F66" opacity={0.6} />)}
          <path d={`M 0 0 L 0 -420 A 420 420 0 ${k > 0.5 ? 1 : 0} 1 ${420 * Math.sin(2 * Math.PI * k)} ${-420 * Math.cos(2 * Math.PI * k)} Z`} fill="#38BDF8" opacity={0.85} />
          {[...Array(12)].map((_, i) => <path key={'c' + i} d={`M ${-400} ${-330 + i * 60} C -200 ${-350 + i * 60 + (i % 3) * 20} 200 ${-310 + i * 60} 400 ${-330 + i * 60}`} stroke="#0B2742" strokeWidth={3} fill="none" opacity={0.6} />)}
        </g>
        <circle r={400} fill="none" {...st(8)} />
      </g>
      <g transform="translate(1440 420)"><Txt x={0} y={0} text={`${(k * 100).toFixed(1)}%`} size={190} fill="#38BDF8" /><Txt x={0} y={90} text="OF THE SEABED MAPPED" size={56} /></g>
      {p.mode === 'cont' && <g transform={`translate(1440 760) scale(${popAt(f, line, 'looked', 0.6)})`}><Emoji name="magnifying glass tilted left" size={220} /></g>}
      {p.mode !== 'cont' && <g transform="translate(1440 740)" opacity={clamp((f - at(line, p.b_on || '104', 0.6)) / 12, 0, 1)}><Txt x={0} y={0} text="104 MILLION KM² DONE" size={52} fill="#FDE047" /><Txt x={0} y={80} text="71% STILL A BLUR" size={52} fill="#E2E8F0" /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// the megamouth: caught in a US Navy ship's sea anchor off Hawaii, 1976
const Megamouth = ({f = 0}) => {   // side view, head right: soft brown-grey body, a broad rounded head, a huge wide mouth
  const tail = Math.sin(f * 0.1) * 8;
  return (
    <g>
      <g transform={`rotate(${tail} -620 0)`}><path d="M -600 -20 L -860 -250 C -830 -130 -800 -60 -760 0 L -820 160 C -780 110 -740 60 -700 20 Z" fill="#6B5E55" {...ST} /></g>
      <path d="M 640 -10 C 660 -150 540 -230 300 -240 C 0 -250 -350 -170 -620 -30 C -650 -10 -650 20 -620 40 C -350 170 0 230 300 225 C 540 215 650 140 640 -10 Z" fill="#7A6C62" {...ST} />
      <path d="M 40 -238 L -90 -420 C -50 -400 60 -300 170 -236 Z" fill="#6B5E55" {...ST} />
      <path d="M 610 40 C 560 110 420 150 230 150 C 380 120 520 90 610 40 Z" fill="#3B1F1A" {...st(6)} />
      <path d="M 640 0 C 600 60 460 110 240 128 C 440 140 600 100 650 30 Z" fill="#D9C8BE" {...st(5)} />
      <path d="M 200 130 L 20 330 C 120 320 240 220 290 150 Z" fill="#6B5E55" {...ST} />
      <circle cx={520} cy={-60} r={16} fill={INK} /><circle cx={526} cy={-66} r={5} fill="#fff" />
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M ${120 - i * 34} -70 C ${108 - i * 34} -20 ${108 - i * 34} 30 ${120 - i * 34} 80`} fill="none" {...st(4)} />)}
    </g>
  );
};
function MNavy({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'catch';
  if (mode === 'catch') {
    const up = lin(f, 10, len * 0.8, 0, 1);
    return (
      <g><Cam f={f} len={len} a={1} b={1.05}>
        <rect width={W} height={H} fill="#0B3756" />
        <rect width={W} height={260} fill="#7FB8E0" />
        <g transform="translate(560 250) scale(0.7)"><Ship f={f} hull="#4B5563" funnel="#6B7280" /></g>
        <path d={`M 880 250 L 1180 ${900 - 560 * up}`} stroke="#E5E7EB" strokeWidth={5} />
        <g transform={`translate(1180 ${900 - 560 * up})`}>
          <path d="M -170 0 C -170 -120 170 -120 170 0 L 0 160 Z" fill="#F97316" opacity={0.85} {...st(6)} />
          <g transform="translate(0 210) rotate(-70) scale(0.17)"><Megamouth f={f} /></g>
        </g>
        <Txt x={1500} y={150} text="1976" size={90} fill="#0B3756" stroke="#fff" />
      </Cam>
        <Labels line={line} f={f} x0={100} y0={330} /></g>
    );
  }
  const st0 = at(line, p.stamp_on || 'species', 0.5);
  return (
    <g><Cam f={f} len={len} a={1} b={1.05}>
      <Deep f={f} depth={0.6} id="mm" />
      <g transform={`translate(${900 + Math.sin(f * 0.02) * 30} 520) scale(0.62)`}><Megamouth f={f} /></g>
      {f > st0 && <g transform={`translate(1420 820) rotate(-8) scale(${clamp(pop(f, st0, 150, 11), 0, 1.1)})`}><rect x={-300} y={-80} width={600} height={160} rx={18} fill="none" stroke="#FDE047" strokeWidth={14} /><Txt x={0} y={30} text="NEW SPECIES" size={90} fill="#FDE047" /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// the five exhibits as cards, each popping on its words
const EXHIBITS = [['A', ['OLD TEETH', 'YOUNG DATES'], 'teeth'], ['B', ['HONEST', 'WITNESSES'], 'honest'], ['C', ['A TV FILM'], 'film'], ['D', ['AN UNMAPPED', 'OCEAN'], 'ocean'], ['E', ['THE', 'MEGAMOUTH'], 'shark']];
function MExhibits({f, len, line}) {
  const p = P(line);
  const all = p.mode === 'cont';
  return (
    <g><Cam f={f} len={len} a={1} b={1.03}>
      <BG c="#0B1F3A" />
      {EXHIBITS.map(([l, t, w], i) => {
        const s = all ? 1 : clamp(pop(f, at(line, (p.on || [])[i] || w, 0.15 + i * 0.16) + (p.stagger ? i * 5 : 0), 150, 12), 0, 1.05);
        return <g key={l} transform={`translate(${210 + i * 375} 500) rotate(${(i % 2 ? 2 : -2)}) scale(${s})`}>
          <rect x={-170} y={-260} width={340} height={520} rx={24} fill="#F5EBD7" {...ST} />
          <Txt x={0} y={-100} text={l} size={200} fill="#E3232C" />
          {t.map((r, k) => <Txt key={k} x={0} y={90 + k * 70} text={r} size={46} fill={INK} stroke="none" />)}
        </g>; })}
      {all && <g transform={`translate(960 840) scale(${popAt(f, line, p.case_on || 'better', 0.2)})`}><Box x={-420} y={-55} w={840} h={110} text="BETTER THAN YOU'D EXPECT" fill="#FDE047" /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

export const MEG3_SHOTS = {m_challenger: MChallenger, m_crust: MCrust, m_cave: MCave, m_wharf: MWharf, m_above: MAbove, m_tv: MTv, m_globe: MGlobe,
  m_navy: MNavy, m_exhibits: MExhibits};
