// Storygraphics #4 (2.72.0), part 4: the long life after. Translator and teacher, his daughter growing up beside a bandaged father,
// the hibakusha certificate (one city, then both), the old man, the family altar, the memoir, the 165 double survivors, the UN,
// the record, the hospital and the visitor, why he lived (the reasons, the twin rings), and the recap.
import React from 'react';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Figure, Torso, Head, Box, Cloud, at, Labels} from './tis';
import {P, Txt, Cam, popAt, popBy} from './meg2';
import {YBust, Hanko, JapanLand, PLACES_JP, Burst, YamArt, Baby} from './yam';
import {Delta, Train} from './yam2';
import {Valley} from './yam3';

const OSW = "'Oswald', sans-serif";
const pz = (f, a, k = 140) => clamp(pop(f, a, k, 12), 0, 1.1);
const Plate = ({x, y, w, h = 120, text, s = 1, fill = '#fff', ink = INK, size}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-w / 2 + 8} y={-h / 2 + 10} width={w} height={h} fill="#000" opacity={0.3} />
    <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} {...st(6)} />
    <Txt x={0} y={h * 0.18} text={text} size={size || h * 0.5} fill={ink} stroke="none" />
  </g>
);

// ───────────── after the war: translator for the occupation (translator) | a schoolteacher (teacher) ─────────────
function YLife({f, len, line}) {
  const p = P(line);
  if (p.mode === 'teacher') {
    return (
      <g><Cam f={f} len={len} a={1.0} b={1.05}>
        <rect width={W} height={H} fill="#E3D6BC" />
        <rect x={200} y={120} width={1100} height={520} fill="#2F4A3A" {...st(10)} />
        <text x={280} y={300} fontFamily={OSW} fontWeight={700} fontSize={90} fill="#F1F5F9" opacity={0.9}>A B C</text>
        <text x={280} y={440} fontFamily={OSW} fontWeight={700} fontSize={90} fill="#F1F5F9" opacity={0.9}>{'1 + 1 = 2'}</text>
        <rect y={820} width={W} height={260} fill="#9C7B54" />
        <YBust who="yamaguchi" x={1500} y={460} s={0.85} expr="calm" talk={Math.floor(f / 5) % 2 === 0} f={f} seed={3} turn={-0.3} />
        {[0, 1, 2, 3].map((i) => <g key={i} transform={`translate(${240 + i * 300} 860) scale(0.36)`}><Head who={['colleague1', 'colleague2', 'hisako', 'colleague1'][i]} expr="calm" f={f} seed={20 + i} /></g>)}
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#DCCDB0" />
      <rect y={800} width={W} height={280} fill="#8A6A48" />
      <path d="M 400 760 L 1500 760 L 1540 830 L 360 830 Z" fill="#6B4A2E" {...st(7)} />
      <YBust who="yamaguchi" x={600} y={430} s={0.8} expr="calm" talk={Math.floor(f / 6) % 2 === 0} f={f} seed={3} band turn={0.3} />
      <YBust who="officer" x={1320} y={430} s={0.8} expr="calm" f={f} seed={12} turn={-0.3} />
      <g transform={`translate(920 210) scale(${pz(f, 6)})`}><ellipse rx={180} ry={80} fill="#fff" {...ST} /><Txt x={0} y={22} text="EN ⇄ JP" size={64} fill={INK} stroke="none" /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── his daughter grows up (age counter to 12) beside a father still in bandages ─────────────
function YGrow({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'bandages', 0.3);
  const age = Math.round(lin(f, a, Math.max(a + 30, len - 20), 0, 12));
  const k = 0.45 + 0.45 * (age / 12);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <rect width={W} height={H} fill="#E8DCC2" />
      <rect y={860} width={W} height={220} fill="#C9B48E" /><path d="M 0 860 L 1920 860" {...st(6)} />
      <YBust who="yamaguchi" x={620} y={440} s={0.9} expr="calm" f={f} seed={3} band turn={0.3} />
      {age < 2 ? <g transform="translate(1220 790)"><Baby s={0.9} f={f} /></g>
        : <g transform={`translate(1220 860) scale(${k * 0.5}) translate(0 -1090)`}><Figure who="toshiko_girl" pose="stand" f={f} expr="smile" seed={14} /></g>}
      <g transform="translate(1600 300)"><circle r={120} fill="#0B1F3A" {...st(8)} /><Txt x={0} y={30} text={`AGE ${age}`} size={60} fill="#FFE11A" /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the hibakusha certificate: one (Nagasaki only) | wait (years running) | both (Hiroshima stamped in) ─────────────
function YCert({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'one';
  const a = at(line, p.on || '', 0.3);
  const st2 = mode === 'both' ? pz(f, at(line, p.stamp_on || 'amended', 0.5), 160) : 0;
  const yr = mode === 'wait' ? Math.round(lin(f, Math.min(a, 10), len - 10, p.from || 1957, p.to || 2009)) : null;
  const stamp = (txt, c, k, rot) => k > 0.01 ? <g transform={`rotate(${rot}) scale(${k > 1 ? 1 + (k - 1) * 2 : k})`}><rect x={-230} y={-60} width={460} height={120} fill="none" stroke={c} strokeWidth={12} /><Txt x={0} y={26} text={txt} size={74} fill={c} stroke="none" /></g> : null;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <rect width={W} height={H} fill="#5B4A3A" />
      <g transform="translate(760 540) rotate(-3)">
        <rect x={-460} y={-440} width={920} height={880} fill="#FBF7EC" {...st(9)} />
        <rect x={-430} y={-410} width={860} height={820} fill="none" stroke="#B89A72" strokeWidth={6} />
        <Txt x={0} y={-320} text="ATOMIC BOMB SURVIVOR" size={56} fill={INK} stroke="none" />
        <Txt x={0} y={-260} text="CERTIFICATE · HIBAKUSHA" size={38} fill="#6B5A48" stroke="none" />
        {[...Array(5)].map((_, i) => <rect key={i} x={-360} y={-190 + i * 60} width={i % 2 ? 520 : 720} height={16} fill="#D6CBB2" />)}
        <Txt x={-200} y={180} text="NAGASAKI" size={44} fill="#6B5A48" stroke="none" /><Txt x={200} y={180} text="HIROSHIMA" size={44} fill="#6B5A48" stroke="none" />
        <g transform="translate(-200 300)">{stamp('✓ 1957', '#C81E1E', mode === 'one' ? pz(f, Math.min(at(line, p.n_on || 'nagasaki', 0.7), 999), 160) : 1, -6)}</g>
        <g transform="translate(200 300)">{mode === 'both' ? stamp('✓ 2009', '#C81E1E', st2, 5) : <rect x={-200} y={-50} width={400} height={100} fill="none" stroke="#B89A72" strokeWidth={6} strokeDasharray="20 14" />}</g>
      </g>
      {yr && <g transform="translate(1560 540)"><rect x={-260} y={-110} width={520} height={200} fill="#0B1F3A" {...st(8)} /><Txt x={0} y={50} text={String(yr)} size={150} fill="#FFE11A" /></g>}
      {mode === 'both' && p.big && <Plate x={1560} y={540} w={560} h={140} text={p.big} s={pz(f, at(line, p.big_on || 'niju', 0.6))} fill="#FFE11A" size={52} />}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the old man (cataracts, a cane, an ear that can't hear; determined) ─────────────
function YOld({f, len, line}) {
  const p = P(line);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill={p.color || '#DDE3E6'} />
      <rect x={1200} y={120} width={520} height={360} fill="#B9D3E6" {...st(8)} /><path d="M 1460 120 L 1460 480 M 1200 300 L 1720 300" stroke={INK} strokeWidth={7} />
      {p.cane && <path d="M 1010 1080 L 960 560 C 958 520 1000 510 1010 540" stroke="#6B4228" strokeWidth={22} fill="none" strokeLinecap="round" />}
      <YBust who="yamaguchi_old" x={760} y={470} s={1.0} expr={p.expr || 'calm'} f={f} seed={3} turn={0.25} talk={!!p.talk && Math.floor(f / 5) % 2 === 0} />
    </Cam>
      <Labels line={line} f={f} x0={W - 100} y0={560} align="right" /></g>
  );
}

// ───────────── the family altar: a framed photo, incense, flowers ─────────────
function YAltar({f, len, line}) {
  const p = P(line);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.06} y={480}>
      <rect width={W} height={H} fill="#3A2C22" />
      <rect x={460} y={140} width={1000} height={760} fill="#5A3E2A" {...st(9)} />
      <rect x={520} y={200} width={880} height={640} fill="#2A1D14" {...st(6)} />
      <g transform="translate(960 420)">
        <rect x={-170} y={-200} width={340} height={400} fill="#1A1410" {...st(8)} />
        <rect x={-140} y={-170} width={280} height={340} fill="#C9C2B4" />
        <clipPath id="yalt"><rect x={-140} y={-170} width={280} height={340} /></clipPath>
        <g clipPath="url(#yalt)"><g transform="translate(0 -10) scale(0.62)"><Torso who={p.who || 'colleague1'} arms="rest" f={0} /><Head who={p.who || 'colleague1'} expr="calm" f={0} seed={21} /></g></g>
        <path d="M -140 -170 L -40 -170 L -140 -70 Z M 140 -170 L 40 -170 L 140 -70 Z" fill="#111" />
      </g>
      {[760, 1160].map((x) => <g key={x}><rect x={x - 30} y={680} width={60} height={110} fill="#C9A66B" {...st(5)} />{[0, 1, 2].map((i) => <circle key={i} cx={x + (i - 1) * 26} cy={650} r={26} fill={['#F8FAFC', '#FDE68A', '#F8FAFC'][i]} {...st(4)} />)}</g>)}
      <rect x={930} y={700} width={60} height={80} fill="#8B5A2B" {...st(5)} />
      {[0, 1, 2].map((i) => { const t = ((f / 90) + i / 3) % 1; return <path key={i} d={`M ${950 + i * 10} 690 C ${940 + Math.sin(t * 8 + i) * 30} ${690 - t * 200} ${960 + Math.cos(t * 6) * 30} ${690 - t * 340} ${950 + i * 10} ${690 - t * 440}`} stroke="#D1D5DB" strokeWidth={5} fill="none" opacity={0.6 * (1 - t)} />; })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── writing: an old man at a desk, the pages of a memoir and poems stacking up ─────────────
function YWriting({f, len, line}) {
  const p = P(line);
  const n = Math.floor(lin(f, 0, len, 1, 9));
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#E4DCC8" />
      <path d="M 200 760 L 1720 760 L 1760 840 L 160 840 Z" fill="#7B5A3A" {...st(7)} />
      <YBust who="yamaguchi_old" x={640} y={420} s={0.85} expr="calm" f={f} seed={3} turn={0.3} look={8} />
      {[...Array(n)].map((_, i) => <rect key={i} x={1180 + (i % 2) * 6} y={740 - i * 12} width={300} height={12} fill="#FBF7EC" {...st(3)} />)}
      <g transform={`translate(1000 ${700 + Math.sin(f * 0.4) * 4}) rotate(-30)`}><rect x={-8} y={-110} width={16} height={120} fill="#1F2937" {...st(3)} /></g>
      <g transform={`translate(1330 360) scale(${pz(f, at(line, p.book_on || 'memoir', 0.5))}) rotate(4)`}><rect x={-140} y={-180} width={280} height={360} fill="#7C2D12" {...st(7)} /><Txt x={0} y={-40} text="MEMOIR" size={56} /></g>
      <g transform={`translate(1640 400) scale(${pz(f, at(line, p.poem_on || 'poems', 0.7))}) rotate(-5)`}><rect x={-120} y={-160} width={240} height={320} fill="#1E3A5F" {...st(7)} /><Txt x={0} y={-30} text="POEMS" size={52} /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── 165 people who were in both cities: dots between Hiroshima and Nagasaki (icons: train, road, errand) ─────────────
function Y165({f, len, line}) {
  const p = P(line);
  const center = [131.2, 33.55], ppd = 170;
  const sx = (lon) => W / 2 + (lon - center[0]) * ppd, sy = (lat) => H / 2 - (lat - center[1]) * ppd;
  const A = PLACES_JP.hiroshima, B = PLACES_JP.nagasaki;
  const a = at(line, p.on || 'one', 0.4);
  const R = rng(165);
  const dots = [...Array(165)].map(() => { const t = R(); return [sx(A[0] + (B[0] - A[0]) * t) + (R() - 0.5) * 60, sy(A[1] + (B[1] - A[1]) * t) + (R() - 0.5) * 60]; });
  const shown = Math.floor(lin(f, a, a + 40, 0, 165));
  return (
    <g>
      <JapanLand center={center} ppd={ppd} />
      <path d={`M ${sx(A[0])} ${sy(A[1])} L ${sx(B[0])} ${sy(B[1])}`} stroke="#E3232C" strokeWidth={8} strokeDasharray="20 12" />
      {[A, B].map((c, i) => <g key={i} transform={`translate(${sx(c[0])} ${sy(c[1])})`}><Burst r={30} /></g>)}
      {dots.slice(0, shown).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={8} fill="#FFE11A" stroke={INK} strokeWidth={2.5} />)}
      <g transform={`translate(1580 820) scale(${pz(f, a)})`}><rect x={-230} y={-110} width={460} height={200} fill="#0B1F3A" {...st(8)} /><Txt x={0} y={10} text={String(shown)} size={120} fill="#FFE11A" /><Txt x={0} y={70} text="IN BOTH CITIES" size={38} /></g>
      {p.icons && ['A TRAIN', 'A ROAD', 'AN ERRAND'].map((t, i) => <Plate key={i} x={300 + i * 370} y={840} w={340} h={90} text={t} s={pz(f, at(line, ['train', 'road', 'errand'][i], 0.3 + i * 0.2))} fill="#fff" size={46} />)}
      <Labels line={line} f={f} x0={100} y0={90} />
    </g>
  );
}

// ───────────── the United Nations: a hall, a podium, a small old man speaking ─────────────
function YUN({f, len, line}) {
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.08} y={500}>
      <rect width={W} height={H} fill="#2B3A55" />
      <path d="M 0 0 L 1920 0 L 1920 300 C 1500 200 420 200 0 300 Z" fill="#1E2A40" />
      <rect x={560} y={160} width={800} height={520} fill="#C9A66B" {...st(8)} />
      <circle cx={960} cy={330} r={110} fill="#8BB8E8" {...st(6)} />
      <ellipse cx={960} cy={330} rx={50} ry={110} fill="none" stroke="#fff" strokeWidth={5} />
      <path d="M 854 300 L 1066 300 M 854 360 L 1066 360 M 850 330 L 1070 330" stroke="#fff" strokeWidth={4} />
      {[...Array(6)].map((_, r) => [...Array(14)].map((_, c) => <circle key={r + '-' + c} cx={140 + c * 130 + (r % 2) * 60} cy={840 + r * 50} r={20} fill="#3A4A66" />))}
      <rect x={880} y={560} width={160} height={200} fill="#6B4A2E" {...st(6)} />
      <g transform="translate(960 560) scale(0.32)"><Head who="yamaguchi_old" expr="calm" talk={Math.floor(f / 5) % 2 === 0} f={f} seed={3} /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the world record: a plaque (record) | nobody in line to break it (empty) ─────────────
function YRecord({f, len, line}) {
  const p = P(line);
  const a = Math.min(at(line, p.on || 'guinness', 0.2), 10);
  const e = p.mode === 'empty', nb = at(line, p.b_on || 'nobody', 0.5);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <rect width={W} height={H} fill="#0B1F3A" />
      <g transform={`translate(${e ? lin(f, nb - 18, nb, 960, 640) : 960} 520) scale(${e ? 1 : pz(f, a)})`}>
        <rect x={-420} y={-300} width={840} height={600} rx={20} fill="#C9A227" {...st(10)} />
        <rect x={-380} y={-260} width={760} height={520} rx={10} fill="#1F2937" {...st(6)} />
        <Txt x={0} y={-150} text="WORLD RECORD" size={70} fill="#C9A227" />
        <Txt x={0} y={-30} text="FIRST CONFIRMED PERSON" size={50} />
        <Txt x={0} y={40} text="TO SURVIVE TWO" size={50} />
        <Txt x={0} y={110} text="NUCLEAR ATTACKS" size={50} />
        <Txt x={0} y={210} text="26 MARCH 2009" size={40} fill="#9BE1FF" />
      </g>
      {p.mode === 'empty' && <g transform={`translate(1460 520) scale(${pz(f, at(line, p.b_on || 'nobody', 0.5))})`}>
        <rect x={-260} y={-200} width={520} height={400} fill="#fff" {...st(8)} />
        <Txt x={0} y={-90} text="CHALLENGERS" size={56} fill={INK} stroke="none" />
        <Txt x={0} y={110} text="0" size={240} fill="#E3232C" stroke="none" />
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the hospital, December 2009: alone | the visitor at the bedside ─────────────
function YHospital({f, len, line}) {
  const p = P(line);
  const v = p.mode === 'visitor';
  return (
    <g><Cam f={f} len={len} a={v ? 1.0 : 1.02} b={v ? 1.05 : 1.16} x={v ? W / 2 : 760} y={v ? H / 2 : 560}>
      <rect width={W} height={H} fill="#DDE7EA" />
      <rect y={820} width={W} height={260} fill="#A7B8BC" /><path d="M 0 820 L 1920 820" {...st(6)} />
      <rect x={1340} y={130} width={420} height={320} fill="#B9D7EA" {...st(8)} /><path d="M 1550 130 L 1550 450" stroke={INK} strokeWidth={6} />
      <rect x={300} y={600} width={900} height={60} fill="#9CA3AF" {...st(6)} />
      <rect x={300} y={520} width={900} height={110} rx={16} fill="#F8FAFC" {...st(6)} />
      <path d="M 480 520 C 700 470 1000 470 1190 520 L 1190 640 L 480 640 Z" fill="#C9D6E3" {...st(6)} />
      <rect x={300} y={380} width={40} height={300} fill="#9CA3AF" {...st(5)} />
      <g transform="translate(410 470) rotate(-80) scale(0.5)"><Head who="yamaguchi_old" expr={p.expr || 'calm'} talk={v && Math.floor(f / 6) % 2 === 0 && f > len * 0.4} f={f} seed={3} /></g>
      {v && <YBust who="visitor" x={1450} y={560} s={0.75} expr="calm" f={f} seed={12} turn={-0.6} look={-12} />}
      {p.flowers && <g transform="translate(1250 760)"><rect x={-40} y={-90} width={80} height={90} fill="#B9D7EA" {...st(5)} />{[...Array(5)].map((_, i) => <circle key={i} cx={-50 + i * 25} cy={-120 - (i % 2) * 20} r={22} fill={['#F8FAFC', '#FDE68A', '#F9A8D4'][i % 3]} {...st(4)} />)}</g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── why did he live: question | the reasons (distance, cover, body) popping on their words ─────────────
function YWhy({f, len, line}) {
  const p = P(line);
  const items = p.reasons || [['DISTANCE', 'ring'], ['COVER', 'roof'], ['A BODY THAT HELD', 'heart']];   // (not `items`: story_sample reads p.items as named things)
  const show = p.show != null ? p.show : items.length;
  const icon = (k) => k === 'ring' ? <g><circle r={90} fill="none" stroke="#E3232C" strokeWidth={10} strokeDasharray="20 12" /><circle r={50} fill="#F97316" opacity={0.6} {...st(5)} /><circle cx={70} cy={0} r={16} fill="#FFE11A" {...st(5)} /></g>
    : k === 'roof' ? <g><path d="M -110 0 L 0 -90 L 110 0 Z" fill="#475569" {...st(7)} /><rect x={-80} y={0} width={160} height={90} fill="#C2B48C" {...st(6)} /></g>
      : <path d="M 0 80 C -120 0 -110 -90 -50 -90 C -20 -90 0 -60 0 -40 C 0 -60 20 -90 50 -90 C 110 -90 120 0 0 80 Z" fill="#E3232C" {...st(7)} />;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.03}>
      <rect width={W} height={H} fill="#F5EBD7" />
      <Txt x={W / 2} y={150} text={p.title || 'WHY DID HE LIVE?'} size={88} fill={INK} stroke="none" />
      {p.mode === 'question' ? <g>
        {[['HIROSHIMA', '2 IN 5 DIED'], ['NAGASAKI', 'NEARLY 1 IN 3']].map(([c, t], i) => <g key={i} transform={`translate(${560 + i * 800} 560) scale(${pz(f, at(line, i ? 'nagasaki' : 'hiroshima', 0.4 + i * 0.2))})`}>
          <circle r={230} fill="#fff" {...st(8)} /><Txt x={0} y={-30} text={c} size={60} fill={INK} stroke="none" /><Txt x={0} y={60} text={t} size={56} fill="#E3232C" stroke="none" /></g>)}
      </g> : items.slice(0, show).map(([t, k], i) => {
        const a = i === 0 ? Math.min(at(line, (p.on || [])[0] || '', 0.1), 8) : at(line, (p.on || [])[i] || '', 0.3 + i * 0.25);
        const n = Math.min(show, items.length), gap = Math.min(560, 1640 / n), fit = Math.min(1, gap / 520);
        return <g key={i} transform={`translate(${W / 2 + (i - (n - 1) / 2) * gap} 560) scale(${pz(f, a) * fit})`}>
          <circle r={210} fill="#fff" {...st(8)} />{icon(k)}<Txt x={0} y={300} text={t} size={58} fill={INK} stroke="none" /></g>; })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── distance, twice: the two cities side by side, each with its rings and his dot ─────────────
function YTwin({f, len, line}) {
  const a = Math.min(at(line, 'distance', 0.1), 8);
  const panel = (child, x, title) => (
    <g transform={`translate(${x} 560) scale(${x > 900 ? clamp(0.9 + 0.1 * pz(f, a + 6), 0, 1.05) : 1})`}>
      <svg x={-420} y={-300} width={840} height={600} viewBox="380 -40 1100 790">{child}</svg>
      <rect x={-420} y={-300} width={840} height={600} fill="none" {...st(8)} />
      <Txt x={0} y={-330} text={title} size={56} />
    </g>
  );
  const rings = (cx, cy, k = 110) => (
    <g><circle cx={cx} cy={cy} r={3.5 * k} fill="#E3232C" opacity={0.16} stroke="#E3232C" strokeWidth={8} strokeDasharray="26 16" />
      <circle cx={cx} cy={cy} r={2 * k} fill="#F97316" opacity={0.4} stroke={INK} strokeWidth={6} /></g>
  );
  return (
    <g>
      <rect width={W} height={H} fill="#0B1F3A" />
      {panel(<g><Delta f={f} />{rings(930, 400)}<circle cx={930 - 3 * 110 * 0.71} cy={400 + 3 * 110 * 0.71} r={22} fill="#FFE11A" {...st(6)} /></g>, 500, 'HIROSHIMA')}
      {panel(<g><Valley f={f} />{rings(920, 330)}<circle cx={1040} cy={641} r={22} fill="#FFE11A" {...st(6)} /></g>, 1420, 'NAGASAKI')}
      <Labels line={line} f={f} x0={100} y0={930} />
    </g>
  );
}

// ───────────── the recap: two cities, three days, a forgotten stamp and a working railway ─────────────
function YRecap({f, len, line}) {
  const p = P(line);
  const s1 = pz(f, at(line, p.stamp_on || 'stamp', 0.7)), s2 = pz(f, at(line, p.rail_on || 'railway', 0.85));
  return (
    <g>
      <g transform={`translate(960 540) scale(${lin(f, 0, len, 1.0, 1.06)}) translate(-960 -540)`}><YamArt boxes={false} f={f} bursts={[1, 1]} line={1} /></g>
      {s1 > 0.01 && <g transform={`translate(380 300) scale(${s1 * 0.9})`}><Hanko /></g>}
      {s2 > 0.01 && <g transform={`translate(560 880) scale(${s2 * 0.32})`}><Train f={f} /></g>}
      <Labels line={line} f={f} x0={100} y0={90} />
    </g>
  );
}

export const YAM4_SHOTS = {y_life: YLife, y_grow: YGrow, y_cert: YCert, y_old: YOld, y_altar: YAltar, y_writing: YWriting, y_165: Y165, y_un: YUN,
  y_record: YRecord, y_hospital: YHospital, y_why: YWhy, y_twin: YTwin, y_recap: YRecap};
