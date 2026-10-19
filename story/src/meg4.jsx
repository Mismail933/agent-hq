// Storygraphics #3 (2.59.0), the tests and the verdict: the six test gauges, the cold deep, the conveyor belt of teeth, the whale
// check, the cooling world, the energy budget, the new rival, the recap and the verdict. Every scene takes {f, len, line}.
import React from 'react';
import {noise2D} from '@remotion/noise';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Box, Bust, Cloud, at, Labels, Figure} from './tis';
import {Sea, Deep, Seabed, mix} from './ocean';
import {Shark, Tooth, Coast, SKY} from './meg';
import {Emoji} from './emoji';
import {P, Txt, Cam, BG, popAt, Silhouette, Gauge} from './meg2';

// ───────────── the tests: six gauges, one test at a time, FAIL stamps ─────────────
const TESTS = ['THE CHALLENGER TEETH', 'THE 1918 CREW', 'THE TV FILM', 'THE UNMAPPED OCEAN', 'THE MISSING TEETH', 'THE WHALE CHECK'];
function MGauges({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'six';
  if (mode === 'one') {   // one test's title card; with fail: true the needle swings to FAIL on the fail word
    const n = p.n || 1;
    const fl = p.fail ? at(line, p.fail_on || 'fails', 0.6) : 1e9;
    const v = p.fail ? lin(f, fl - 18, fl, 0.5, 0.02) : 0.5 + 0.08 * Math.sin(f * 0.08);
    return (
      <g><Cam f={f} len={len} a={1} b={1.04}>
        <BG c="#0B1F3A" />
        <g transform={`translate(560 540) scale(${clamp(pop(f, 2, 140, 12), 0, 1)})`}>
          <Txt x={0} y={-120} text={p.both ? `TESTS ${n} & ${n + 1}` : `TEST ${n}`} size={150} fill="#FDE047" />
          <Txt x={0} y={20} text={p.title || TESTS[n - 1]} size={64} />
        </g>
        <g transform="translate(1360 520)"><Gauge v={v} s={1.15} fail={f > fl} /></g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={830} /></g>
    );
  }
  // six (or the fails so far): a row of gauges, failed ones stamped
  const failed = p.failed || 0, now = p.now || [];
  return (
    <g><Cam f={f} len={len} a={1} b={1.03}>
      <BG c="#0B1F3A" />
      {TESTS.map((t, i) => {
        const x = 250 + (i % 3) * 710, y = 300 + Math.floor(i / 3) * 420;
        const s = clamp(pop(f, 4 + i * 5, 150, 12), 0, 1);
        const dn = now.indexOf(i + 1), fa = dn >= 0 ? at(line, (p.on || [])[dn] || '', 0.3 + dn * 0.2) : null;
        const isFail = i < failed || (fa != null && f > fa);
        return <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <Gauge v={i < failed ? 0.02 : fa != null ? lin(f, fa - 14, fa, 0.5, 0.02) : 0.5 + 0.06 * Math.sin(f * 0.07 + i)} s={0.62} fail={isFail} />
          <Txt x={0} y={190} text={`${i + 1}. ${t}`} size={36} />
        </g>; })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={60} /></g>
  );
}

// the cold deep: a column from the surface down to 5,000 m with the temperature; mode 'whale': the warm shark can't wait down there
function MDepth({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'descend';
  if (mode === 'descend') {
    const d = lin(f, 6, len - 8, 0, 1);
    const t2 = at(line, p.deep_on || '5,000', 0.5), fr = at(line, p.fridge_on || 'fridge', 0.7);
    const depth = Math.round(lin(f, 6, len * 0.6, 0, 5000) / 100) * 100;
    return (
      <g>
        <Deep f={f} depth={0.3 + 0.7 * d} id="dd" />
        <g transform="translate(260 120)">
          <rect x={-30} y={0} width={60} height={800} rx={30} fill="#F8FAFC" opacity={0.25} {...st(5)} />
          <rect x={-30} y={0} width={60} height={800 * d} rx={30} fill="#38BDF8" />
          {[['200 M', 0.04], ['1,000 M', 0.2], ['5,000 M', 1]].map(([t, y], i) => <g key={i}><path d={`M 40 ${800 * y} L 90 ${800 * y}`} stroke="#fff" strokeWidth={5} /><Txt x={110} y={800 * y + 18} text={t} size={44} anchor="start" /></g>)}
        </g>
        <g transform="translate(1100 470)"><Txt x={0} y={0} text={`${depth.toLocaleString('en-US')} M`} size={130} fill="#E0F2FE" /><Txt x={0} y={150} text={f > t2 ? '2.2°C' : '4°C'} size={160} fill="#7DD3FC" /></g>
        {f > fr && <g transform={`translate(1560 760) scale(${clamp(pop(f, fr, 140, 12), 0, 1)})`}><Emoji name="snowflake" size={220} /></g>}
        <Labels line={line} f={f} x0={W - 100} y0={90} align="right" />
      </g>
    );
  }
  // whale: whales breathing at the surface, the warm giant down in the cold dark, a long way from the food
  return (
    <g><Cam f={f} len={len} a={1} b={1.05}>
      <linearGradient id="dwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2E8FC4" /><stop offset="0.45" stopColor="#0B3756" /><stop offset="1" stopColor="#020A10" /></linearGradient>
      <rect width={W} height={H} fill="url(#dwg)" />
      <rect width={W} height={70} fill="#9CD3F5" />
      {[460, 1260].map((x, i) => <g key={x} transform={`translate(${x + Math.sin(f * 0.02 + i) * 40} 170)`}><Emoji name="spouting whale" size={260} flip={i === 1} /></g>)}
      <g transform={`translate(960 ${860 + Math.sin(f * 0.04) * 10}) scale(0.4)`}><Shark f={f} color="grey" glow={0.6} /></g>
      <path d={`M 960 760 L 960 ${lin(f, 10, 50, 760, 320)}`} stroke="#FDE047" strokeWidth={8} strokeDasharray="20 16" />
      <Txt x={1500} y={600} text="FOOD LIVES UPSTAIRS" size={60} fill="#FDE047" op={clamp((f - 30) / 12, 0, 1)} />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={600} /></g>
  );
}

// teeth: the conveyor belt (40,000 a lifetime), the divers off Florida, and the rain of fresh teeth that never happened
function MTeeth({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'belt';
  const R = rng(21);
  if (mode === 'belt') {
    const n = Math.round(lin(f, at(line, p.on || '40,000', 0.6) - 4, at(line, p.on || '40,000', 0.6) + 34, 0, 40000));
    return (
      <g><Cam f={f} len={len} a={1} b={1.04}>
        <BG c="#3B0D12" />
        <path d="M -40 300 C 400 200 1500 200 1960 300 L 1960 -40 L -40 -40 Z" fill="#AEBBC7" {...ST} />
        {[0, 1, 2, 3].map((r) => [...Array(16)].map((_, i) => { const x = ((i * 130 + f * (2 + r) + r * 60) % 2200) - 140, y = 330 + r * 90;
          return <g key={r + '-' + i} transform={`translate(${x} ${y}) scale(${0.14 - r * 0.018}) rotate(${r === 0 ? 0 : 180 * 0})`} opacity={1 - r * 0.2}><Tooth /></g>; }))}
        <g transform="translate(960 800)"><Box x={-330} y={-70} w={660} h={140} text={`${n.toLocaleString('en-US')} TEETH`} fill="#FDE047" /></g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  if (mode === 'sand') {
    return (
      <g><Cam f={f} len={len} a={1} b={1.06}>
        <Deep f={f} depth={0.2} id="ts" />
        <Seabed y={760} f={f} seed={4} />
        {[...Array(9)].map((_, i) => <g key={i} transform={`translate(${200 + R() * 1500} ${820 + R() * 140}) rotate(${R() * 80 - 40}) scale(0.09)`}><Tooth /></g>)}
        <g transform={`translate(${lin(f, 0, len, 1300, 1150)} 520) rotate(-20)`}>
          <ellipse cx={0} cy={0} rx={200} ry={60} fill="#111827" {...ST} />
          <circle cx={210} cy={-10} r={60} fill="#F2C29B" {...ST} />
          <rect x={210} y={-40} width={80} height={44} rx={14} fill="#38BDF8" opacity={0.8} {...st(5)} />
          <path d="M -200 -20 L -380 -60 M -200 20 L -380 40" stroke="#111827" strokeWidth={34} strokeLinecap="round" />
          <path d="M 120 40 L 240 160" stroke="#111827" strokeWidth={26} strokeLinecap="round" />
          <g transform="translate(250 190) scale(0.12)"><Tooth /></g>
        </g>
        <g transform={`translate(1600 220) scale(${popAt(f, line, 'dealers', 0.2)})`}><Emoji name="money bag" size={200} /></g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  // rain: three million years of fresh teeth would carpet the seabed... but FOUND: 0
  const z = at(line, p.zero_on || 'not', 0.6);
  const shown = mode === 'rain' ? 1 : 0;
  return (
    <g><Cam f={f} len={len} a={1} b={1.05}>
      <Deep f={f} depth={0.75} id="tr" />
      <Seabed y={820} f={f} seed={6} />
      {[...Array(60)].map((_, i) => { const x = R() * W, y0 = -100 - R() * 900, sp = 5 + R() * 4, y = Math.min(840 + R() * 120, y0 + f * sp);
        return <g key={i} transform={`translate(${x} ${y}) rotate(${(i * 37) % 360}) scale(0.06)`} opacity={shown * (f < z ? 0.9 : lin(f, z, z + 14, 0.9, 0.12))}><Tooth /></g>; })}
      {mode === 'none' && <Txt x={960} y={500} text="FRESH TEETH FOUND: 0" size={110} fill="#FDE047" />}
      {mode === 'rain' && f > z && <g transform={`translate(960 480) scale(${clamp(pop(f, z, 150, 12), 0, 1.05)})`}><Box x={-480} y={-80} w={960} h={160} text="FRESH TEETH FOUND: 0" fill="#E3232C" color="#fff" outline /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// the whale check: tagged, filmed and followed whales, and nothing like a bite the width of a garage door
function MWhaleCheck({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'scan';
  const g = at(line, p.door_on || 'garage', 0.75);
  const scan = lin(f, 6, g, -300, 300);
  return (
    <g><Cam f={f} len={len} a={1} b={1.04}>
      <Deep f={f} depth={0.15} id="wc" />
      <g transform="translate(860 520)">
        <path d="M -620 0 C -500 -170 300 -200 560 -60 C 640 -20 640 60 560 90 C 300 200 -500 170 -620 0 Z" fill="#475569" {...ST} />
        <path d="M -620 0 L -780 -120 L -740 0 L -780 120 Z" fill="#475569" {...ST} />
        <path d="M 560 90 C 300 160 -300 150 -560 40" fill="#94A3B8" opacity={0.7} />
        <circle cx={430} cy={-20} r={14} fill={INK} />
        <rect x={-60} y={-160} width={70} height={40} rx={8} fill="#F97316" {...st(5)} />
        <path d="M -25 -160 L -25 -210" stroke={INK} strokeWidth={5} />
        <g transform={`translate(${scan} 20)`}><circle r={130} fill="#E0F2FE" opacity={0.25} {...st(10)} /><path d="M 92 92 L 190 190" stroke={INK} strokeWidth={28} strokeLinecap="round" /></g>
      </g>
      <g transform="translate(1500 200)"><Emoji name="camera" size={150} /></g>
      {f > g && <g transform={`translate(1520 690) scale(${clamp(pop(f, g, 140, 12), 0, 1)})`}>
        <rect x={-210} y={-170} width={420} height={300} fill="#CBD5E1" {...ST} />
        {[...Array(5)].map((_, i) => <path key={i} d={`M -210 ${-110 + i * 60} L 210 ${-110 + i * 60}`} stroke="#94A3B8" strokeWidth={8} />)}
        <path d="M -230 -170 L 230 -170 M -230 130 L 230 130" stroke={INK} strokeWidth={10} />
        <path d="M -200 -150 L 200 110 M 200 -150 L -200 110" stroke="#E3232C" strokeWidth={22} strokeLinecap="round" opacity={0.9} />
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// the cooling world: the planet four million years ago, the shelves draining, the whales moving to the poles
function MCool({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'world';
  const t = lin(f, 6, len - 6, 0, 1);
  if (mode === 'world') {
    return (
      <g><Cam f={f} len={len} a={1.04} b={1}>
        <BG c="#061629" />
        <g transform="translate(760 540)">
          <circle r={380} fill={mix('#2B7BB9', '#1E5A8A', t)} {...ST} />
          <path d="M -260 -140 C -180 -220 -60 -180 -20 -100 C 40 -20 -40 60 -120 40 C -220 20 -300 -60 -260 -140 Z M 60 40 C 140 -40 260 -20 300 60 C 320 160 220 240 120 200 C 40 160 20 100 60 40 Z" fill="#9BC88B" {...st(6)} />
          <clipPath id="coolclip"><circle r={376} /></clipPath>
          <g clipPath="url(#coolclip)">
            <path d={`M -400 -400 L 400 -400 L 400 ${-330 + 140 * t} C 200 ${-300 + 150 * t} -200 ${-300 + 150 * t} -400 ${-330 + 140 * t} Z`} fill="#F8FAFC" {...st(5)} />
            <path d={`M -400 400 L 400 400 L 400 ${330 - 140 * t} C 200 ${300 - 150 * t} -200 ${300 - 150 * t} -400 ${330 - 140 * t} Z`} fill="#F8FAFC" {...st(5)} />
          </g>
        </g>
        <g transform="translate(1440 520)">
          <rect x={-50} y={-300} width={100} height={500} rx={50} fill="#F8FAFC" {...ST} /><circle cx={0} cy={230} r={86} fill="#38BDF8" {...ST} />
          <rect x={-26} y={210 - 420 * (0.75 - 0.45 * t)} width={52} height={420 * (0.75 - 0.45 * t)} fill="#38BDF8" />
          <Txt x={0} y={-350} text="4 MILLION YEARS AGO" size={48} fill="#FDE047" />
        </g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={850} /></g>
    );
  }
  if (mode === 'shelf') {   // a cut-away of the coast: the sea level falls, the warm shallow shelf drains, the nursery shrinks
    const sea = lin(f, 6, len - 10, 420, 640);
    return (
      <g><Cam f={f} len={len} a={1} b={1.04}>
        <SKY id="cls" />
        <rect y={sea} width={W} height={H - sea} fill="#2B7BB9" />
        <path d={`M 0 ${sea} L ${W} ${sea}`} stroke="#E0F2FE" strokeWidth={8} />
        <path d="M -40 340 L 520 380 C 700 520 900 560 1200 590 L 1500 900 L 1960 1000 L 1960 1120 L -40 1120 Z" fill="#C9A66B" {...ST} />
        {sea < 560 && [...Array(3)].map((_, i) => <g key={i} transform={`translate(${760 + i * 160} ${520 + i * 6}) scale(0.09)`} opacity={lin(sea, 470, 560, 1, 0)}><Shark f={f + i * 9} color="grey" /></g>)}
        <path d={`M 760 ${sea - 70} L 1180 ${sea - 70}`} stroke="#FDE047" strokeWidth={6} strokeDasharray="20 14" opacity={lin(sea, 470, 560, 1, 0)} />
        <Txt x={970} y={sea - 90} text="THE NURSERY" size={44} fill="#FDE047" op={lin(sea, 470, 560, 1, 0)} />
        <path d={`M 1700 420 L 1700 ${sea - 10}`} stroke="#fff" strokeWidth={10} /><path d={`M 1670 ${sea - 50} L 1700 ${sea - 10} L 1730 ${sea - 50}`} stroke="#fff" strokeWidth={10} fill="none" />
        <Txt x={1700} y={390} text="SEA LEVEL" size={44} />
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  // whales: fewer medium-sized whales, the rest moving toward the poles into cold water
  return (
    <g><Cam f={f} len={len} a={1} b={1.04}>
      <linearGradient id="clw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#CFE8F7" /><stop offset="0.5" stopColor="#2B7BB9" /><stop offset="1" stopColor="#CFE8F7" /></linearGradient>
      <rect width={W} height={H} fill="url(#clw)" />
      <Txt x={1780} y={120} text="COLD" size={60} fill="#0B3756" stroke="#fff" anchor="end" />
      <Txt x={1780} y={560} text="WARM" size={60} fill="#FDE047" anchor="end" />
      {[...Array(6)].map((_, i) => { const up = i % 2 === 0; const y = lin(f, 10 + i * 6, len, 540, up ? 150 : 930); const op = i > 3 ? lin(f, 20, 50, 1, 0) : 1;
        return <g key={i} transform={`translate(${300 + i * 220} ${y})`} opacity={op}><Emoji name="whale" size={170} /></g>; })}
      <g transform={`translate(${lin(f, 0, len, 800, 900)} 600) scale(0.3)`}><Shark f={f} color="grey" /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// the energy budget: a ledger with food in and food needed
function MLedger({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'meals';
  const k = lin(f, 6, len - 10, 1, 0.35);
  return (
    <g><Cam f={f} len={len} a={1} b={1.04}>
      <BG c="#F5EBD7" />
      <rect x={320} y={120} width={1280} height={780} fill="#FFFDF5" {...ST} />
      {[...Array(10)].map((_, i) => <path key={i} d={`M 340 ${220 + i * 66} L 1580 ${220 + i * 66}`} stroke="#BFDBFE" strokeWidth={3} />)}
      <path d="M 1080 140 L 1080 880" stroke="#FCA5A5" strokeWidth={4} />
      <Txt x={960} y={200} text={mode === 'budget' ? 'THE MEGALODON: ENERGY BUDGET' : 'A GIANT NEEDS A GIANT MEAL'} size={54} fill={INK} stroke="none" />
      <Txt x={420} y={340} text="FOOD NEEDED" size={52} fill={INK} stroke="none" anchor="start" />
      <rect x={420} y={370} width={1100} height={70} fill="#E3232C" {...st(5)} />
      <Txt x={420} y={560} text="FOOD AVAILABLE" size={52} fill={INK} stroke="none" anchor="start" />
      <rect x={420} y={590} width={1100 * k} height={70} fill="#22C55E" {...st(5)} />
      {mode === 'budget' && f > at(line, p.lost_on || 'budget', 0.6) && <g transform={`translate(1240 790) rotate(-8) scale(${clamp(pop(f, at(line, p.lost_on || 'budget', 0.6), 150, 11), 0, 1.1)})`}>
        <rect x={-260} y={-70} width={520} height={140} rx={16} fill="none" stroke="#E3232C" strokeWidth={14} /><Txt x={0} y={36} text="OVER BUDGET" size={84} fill="#E3232C" stroke="#FFFDF5" /></g>}
      {mode !== 'budget' && <g transform="translate(560 790)"><Emoji name="fork and knife with plate" size={160} /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={930} /></g>
  );
}

// the new neighbour: the great white arrives; the zinc in tooth enamel puts them on the same step of the food chain
function MRivals({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'arrive';
  if (mode === 'arrive') {
    const x = lin(f, 0, len * 0.7, 2300, 1300);
    return (
      <g><Cam f={f} len={len} a={1} b={1.05}>
        <Deep f={f} depth={0.25} id="ra" />
        <g transform={`translate(560 600) scale(0.6)`}><Shark f={f} color="dark" /></g>
        <g transform={`translate(${x} 420) scale(-0.3 0.4)`}><Shark f={f} color="grey" /></g>
        <Txt x={x} y={260} text="GREAT WHITE" size={52} fill="#FDE047" />
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  // zinc: a food-chain ladder; both sharks land on the same top step
  const a = at(line, p.a_on || 'same', 0.6);
  const steps = ['PLANKTON', 'SMALL FISH', 'BIG FISH', 'SEALS & WHALES', 'TOP PREDATORS'];
  return (
    <g><Cam f={f} len={len} a={1} b={1.04}>
      <BG c="#0B1F3A" />
      {steps.map((t, i) => <g key={t}><rect x={640} y={860 - i * 150} width={640} height={110} rx={12} fill={i === 4 ? '#FDE047' : '#1E4466'} {...st(5)} />
        <Txt x={960} y={935 - i * 150} text={t} size={52} fill={i === 4 ? INK : '#fff'} stroke={i === 4 ? 'none' : INK} /></g>)}
      <g transform={`translate(380 ${lin(f, 6, a, 900, 300)}) scale(0.22)`}><Shark f={f} color="dark" /></g>
      <g transform={`translate(1560 ${lin(f, 12, a + 6, 900, 300)}) scale(-0.12 0.17)`}><Shark f={f} color="grey" /></g>
      <g transform={`translate(260 160) scale(${popAt(f, line, 'zinc', 0.2)})`}><circle r={80} fill="#CBD5E1" {...ST} /><Txt x={0} y={26} text="Zn" size={80} fill={INK} stroke="none" /></g>
    </Cam>
      <Labels line={line} f={f} x0={W - 100} y0={60} align="right" /></g>
  );
}

// the recap: five reasons, each crossed out on its words
const RECAP = [['YOUNG DATES', 'clock'], ['THE WITNESSES', 'witnesses'], ['THE FILM', 'film'], ['THE DEEP SEA', 'deep'], ['TEETH AND BITES', 'teeth']];
function MRecap({f, len, line}) {
  const p = P(line);
  const show = p.show || 5, cross = p.cross || [];
  return (
    <g>
      <BG c="#F5EBD7" />
      <Txt x={960} y={150} text="THE CASE FOR A LIVING MEGALODON" size={70} fill={INK} stroke="none" />
      {RECAP.slice(0, show).map(([t, w], i) => {
        const a = (p.prev || 0) > i ? -99 : at(line, (p.on || [])[i] || w, 0.1 + i * 0.18);
        const s = clamp(pop(f, a, 150, 12), 0, 1);
        const x = clamp((f - a - 8) / 10, 0, 1) * (cross.includes(i + 1) || (p.prev || 0) > i ? 1 : 0);
        return <g key={t} transform={`translate(560 ${280 + i * 150}) scale(${s})`}>
          <Txt x={0} y={60} text={`${i + 1}. ${t}`} size={76} fill={INK} stroke="none" anchor="start" />
          <path d={`M -20 40 L ${(-20 + 860) * x} 40`} stroke="#E3232C" strokeWidth={16} strokeLinecap="round" opacity={x > 0 ? 1 : 0} />
        </g>; })}
    </g>
  );
}

// the verdict: the megalodon fades to an outline, EXTINCT; the great white is still out there
function MVerdict({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'gone';
  if (mode === 'gone') {
    const g = at(line, p.on || 'gone', 0.5);
    const op = lin(f, g - 6, g + 30, 1, 0.12);
    return (
      <g><Cam f={f} len={len} a={1} b={1.06}>
        <Deep f={f} depth={0.6} id="vg" />
        <g transform="translate(960 560) scale(0.75)" opacity={op}><Shark f={f} color="dark" swim={op} /></g>
        <g transform="translate(960 560) scale(0.75)" opacity={1 - op}><path d="M 790 14 C 700 -100 420 -182 60 -192 C -262 -186 -482 -112 -602 -30 C -642 -10 -642 20 -602 40 C -482 112 -262 172 60 172 C 400 162 640 112 790 14 Z" fill="none" stroke="#E0F2FE" strokeWidth={10} strokeDasharray="34 26" /></g>
        {f > g && <g transform={`translate(960 150) scale(${clamp(pop(f, g + 4, 150, 12), 0, 1)})`}><Box x={-520} y={-70} w={1040} h={140} text="EXTINCT FOR 3.6 MILLION YEARS" fill="#FDE047" /></g>}
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  // white: the great white in the warm coastal water, still the top hunting shark
  return (
    <g><Cam f={f} len={len} a={1} b={1.06} y={560}>
      <rect width={W} height={H} fill="#1F7FB8" />
      <rect width={W} height={150} fill="#9CD3F5" />
      {[...Array(5)].map((_, i) => <path key={i} d={`M ${180 + i * 390 + Math.sin(f * 0.02 + i) * 30} 150 L ${300 + i * 390} 150 L ${520 + i * 390} ${H} L ${360 + i * 390} ${H} Z`} fill="#BFE6FF" opacity={0.12} />)}
      <path d="M -40 1000 C 400 940 900 1010 1960 960 L 1960 1120 L -40 1120 Z" fill="#E9D7A5" {...ST} />
      <g transform={`translate(${lin(f, 0, len, 600, 1100)} 560) scale(0.5 0.62)`}><Shark f={f} color="grey" /></g>
      {p.top && <g transform={`translate(960 820) scale(${popAt(f, line, p.top_on || 'biggest', 0.6)})`}><Box x={-470} y={-60} w={940} h={120} text={p.top} fill="#FDE047" /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={200} /></g>
  );
}

export const MEG4_SHOTS = {m_gauges: MGauges, m_depth: MDepth, m_teeth: MTeeth, m_whalecheck: MWhaleCheck, m_cool: MCool, m_ledger: MLedger,
  m_rivals: MRivals, m_recap: MRecap, m_verdict: MVerdict};
