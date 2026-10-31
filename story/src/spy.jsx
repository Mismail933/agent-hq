// The 15 s example of the Shorts-only format (the owner 2026-10-31, after the Squire Explains report): Juan Pujol Garcia, "Garbo". Built to
// the report's gaps: vertical from the start, a named person and the paradox in the first line, a new picture on nearly every beat, people
// who act, props that explain, a colour per place, crisp lines (no blur: depth from layers), bold word captions, rendered at 4K.
// Composition "SpyShort" (1080x1920). Coordinates here are the 1080x1920 stage; the render's --scale gives the 4K.
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {at, clamp} from './tis';
import {FONT_CSS} from './fonts';
import {LAND, K} from './mapdata';
import {Limb, arm, Face, INK, SKIN, SHADE, st, pop, spr, eas, lin} from './rome';

export const SW = 1080, SH = 1920;
const NUN = "'Nunito', 'Arial Rounded MT Bold', sans-serif", OSW = "'Oswald', sans-serif";
const FITS = {
  garbo: {coat: '#3C4250', coatD: '#2C313C', legs: '#2C313C', hair: '#5A3820', bow: '#D23B2B'},
  german: {coat: '#6F7A63', coatD: '#566050', legs: '#4E5747', cap: '#5F6A55', band: '#2C3327', piping: '#C23B2E', belt: true},
  british: {coat: '#B0935C', coatD: '#8F7648', legs: '#8F7648', cap: '#A58952', band: '#6A3024', tie: '#6E5A36', moustache: true},
};
// the Iron Cross and the MBE: small, but each one recognisable
const IronCross = ({s = 1}) => (<g transform={`scale(${s})`}><path d="M -9 -46 L 9 -46 L 7 -24 L -7 -24 Z" fill="#C4312A" {...st(3)} /><path d="M -3 -46 L 3 -46 L 2 -24 L -2 -24 Z" fill="#fff" />
  <path d="M -9 -24 L 9 -24 L 7 -7 L 24 -9 L 24 9 L 7 7 L 9 24 L -9 24 L -7 7 L -24 9 L -24 -9 L -7 -7 Z" fill="#1B1B1F" stroke="#E7E7EA" strokeWidth={3.5} strokeLinejoin="round" /></g>);
const MBE = ({s = 1}) => (<g transform={`scale(${s})`}><path d="M -11 -48 L 11 -48 L 9 -22 L -9 -22 Z" fill="#B7283A" {...st(3)} /><path d="M -3 -48 L 3 -48 L 2 -22 L -2 -22 Z" fill="#8A8F96" />
  <path d="M 0 -24 C 8 -14 14 -8 24 0 C 14 8 8 14 0 24 C -8 14 -14 8 -24 0 C -14 -8 -8 -14 0 -24 Z" fill="#E7C766" {...st(3.5)} /><circle r={8} fill="#B7283A" stroke={INK} strokeWidth={2.5} /></g>);

/** A person, feet at y 0, about 700 units tall. Same build as the Roman test's soldier, dressed by `fit`. sq = squash/stretch on an entrance. */
export const Person = ({x = 0, y = 0, s = 1, flip = false, fit = 'garbo', expr = 'calm', look = 0, lookY = 0, armR = [12, -4], armL = [-12, 4], T = 0, seed = 1, tilt = 0, lean = 0, sq = 1, shadow = true, medals = [0, 0], held = null, walk = 0}) => {
  const F = FITS[fit], b = Math.sin(T * 0.09 + seed * 1.7) * 3.2 - Math.abs(Math.sin(T * 0.42)) * 16 * walk;
  const shR = [84, -332 + b], shL = [-84, -332 + b], R = arm(shR[0], shR[1], armR[0], armR[1]), L = arm(shL[0], shL[1], armL[0], armL[1]);
  const hand = (p) => <circle cx={p[0]} cy={p[1]} r={21} fill={SKIN} {...st(6)} />;
  return (
    <g transform={`translate(${x} ${y}) scale(${(flip ? -s : s) * (2 - sq)} ${s * sq})`}>
      {shadow && <ellipse cx={0} cy={4} rx={170} ry={22} fill="#000" opacity={0.2} />}
      <g transform={`rotate(${lean})`}>
        {[-1, 1].map((d) => { const up = Math.max(0, Math.sin(T * 0.42 + (d > 0 ? Math.PI : 0))) * 44 * walk; return <g key={d} transform={`translate(0 ${-up})`}><Limb pts={[[d * 40, -160 + up], [d * 42, -24]]} w={36} fill={F.legs} /><path d={`M ${d * 42 - 26} -3 C ${d * 42 - 28} -26 ${d * 42 + 24} -28 ${d * 42 + 42} -3 Z`} fill="#231A15" {...st(6)} /></g>; })}
        <g transform={`translate(0 ${b})`}>
          <Limb pts={L} w={34} fill={F.coatD} />{hand(L[2])}
          <path d="M -82 -352 C -94 -300 -100 -210 -104 -140 L 104 -140 C 100 -210 94 -300 82 -352 C 40 -372 -40 -372 -82 -352 Z" fill={F.coat} {...st(7)} />
          <path d="M 50 -358 C 72 -300 84 -220 88 -140 L 104 -140 C 100 -210 94 -300 82 -352 Z" fill={F.coatD} />
          <path d="M -32 -364 L 0 -300 L 32 -364 Z" fill="#fff" {...st(5)} />
          {F.tie && <path d="M -9 -340 L 9 -340 L 13 -270 L 0 -250 L -13 -270 Z" fill={F.tie} {...st(4)} />}
          {F.bow && <path d="M 0 -340 L -40 -362 L -40 -318 Z M 0 -340 L 40 -362 L 40 -318 Z" fill={F.bow} {...st(5)} />}
          <path d="M -46 -366 L -10 -290 L -30 -270 L -60 -345 Z M 46 -366 L 10 -290 L 30 -270 L 60 -345 Z" fill={F.coatD} {...st(5)} />
          {F.belt && <g><rect x={-104} y={-228} width={208} height={24} rx={6} fill="#2B241D" {...st(5)} /><rect x={-16} y={-232} width={32} height={32} rx={5} fill="#B5B9BC" {...st(4)} /></g>}
          {F.piping && <path d="M -46 -366 L -60 -345 M 46 -366 L 60 -345" stroke={F.piping} strokeWidth={8} />}
          {[-200, -170].map((py) => <circle key={py} cx={0} cy={py} r={5} fill={INK} />)}
          {medals[0] > 0 && <g transform={`translate(-48 -282) scale(${medals[0]})`}><IronCross s={1.1} /></g>}
          {medals[1] > 0 && <g transform={`translate(50 -282) scale(${medals[1]})`}><MBE s={1.1} /></g>}
        </g>
        <Limb pts={R} w={34} fill={F.coat} />{hand(R[2])}
        {held && <g transform={`translate(${R[2][0]} ${R[2][1]})`}>{held}</g>}
        <g transform={`translate(0 ${-484 + b * 1.3}) rotate(${tilt})`}>
          <circle cx={-124} cy={8} r={21} fill={SKIN} {...st(6)} />
                    <ellipse rx={126} ry={119} fill={SKIN} {...st(8)} />
          <path d="M 62 104 C 104 82 123 44 123 2 C 118 54 92 88 44 110 Z" fill={SHADE} />
          {F.hair && <path d="M -128 -6 C -150 -172 150 -186 130 -10 C 112 -62 76 -82 30 -66 C -30 -46 -92 -48 -128 -6 Z" fill={F.hair} {...st(7)} />}
          <Face expr={expr} look={look} lookY={lookY} blink={(T + seed * 23) % (92 + (seed * 37) % 60) < 4} />
          {F.moustache && <path d="M -56 34 C -30 18 2 22 14 38 C 26 22 58 18 84 34 C 66 56 30 52 14 46 C -2 52 -38 56 -56 34 Z" fill="#8A6A48" stroke={INK} strokeWidth={4} />}
                    {F.cap && <g transform="translate(0 -44)"><path d="M -118 -40 C -150 -128 150 -128 118 -40 Z" fill={F.cap} {...st(7)} /><rect x={-116} y={-58} width={232} height={28} rx={8} fill={F.band} {...st(6)} /><path d="M -96 -30 C -30 -14 40 -14 112 -32 C 120 -8 60 2 -6 0 C -56 -2 -92 -8 -96 -30 Z" fill="#26211C" {...st(5)} /><circle cx={10} cy={-46} r={11} fill="#D8C27A" {...st(4)} /></g>}
        </g>
      </g>
    </g>
  );
};
// a room: wall, floor, skirting; the place's own colour, crisp
const Room = ({wall, wallD, floor, floorD, fy = 1140, children}) => (
  <g>
    <rect x={-300} y={-300} width={SW + 600} height={fy + 300} fill={wall} />
    {[...Array(9)].map((_, i) => <rect key={i} x={-200 + i * 180} y={-300} width={90} height={fy + 300} fill={wallD} opacity={0.35} />)}
    {children}
    <rect x={-300} y={fy} width={SW + 600} height={26} fill={wallD} {...st(5)} />
    <rect x={-300} y={fy + 26} width={SW + 600} height={SH - fy + 300} fill={floor} />
    {[...Array(7)].map((_, i) => <path key={i} d={`M ${-200 + i * 240} ${fy + 26} L ${-420 + i * 320} ${SH + 40}`} stroke={floorD} strokeWidth={5} />)}
  </g>
);
const Cam = ({x = SW / 2, y = SH / 2, z = 1, children}) => <g transform={`translate(${SW / 2} ${SH / 2}) scale(${z}) translate(${-x} ${-y})`}>{children}</g>;
const Stamp = ({text, f, a, x, y, rot = -12, size = 92, color = '#C7301F', k0 = 1.3}) => { if (f < a) return null; const k = 1 + k0 * Math.exp(-(f - a) * 0.75);
  return (<g transform={`translate(${x} ${y}) rotate(${rot}) scale(${k})`} opacity={clamp((f - a + 1) / 2, 0, 1)}><rect x={-text.length * size * 0.36 - 22} y={-size * 0.82} width={text.length * size * 0.72 + 44} height={size * 1.2} rx={10} fill="none" stroke={color} strokeWidth={10} />
    <text textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={size} letterSpacing={4} fill={color}>{text}</text></g>); };
// a hand on a rubber stamp: eased down, a short hold on the paper, eased up; a beat between hits, then away. The sleeve comes from below: the form's header stays clear
const StampHand = ({f, hits}) => {
  const i = hits.findIndex((h) => f < h + 8), n = i < 0 ? hits.length - 1 : i, h = hits[n];
  const lift = i < 0 ? eas(f, h + 3, h + 13, 0, 1100) : (f < h - 1 ? eas(f, h - 5, h - 1, 110, 0) : eas(f, h + 2, h + 8, 0, 110));
  const at = StampHand.at[n];
  return (
    <g transform={`translate(${at[0]} ${at[1] - lift})`}>
      <rect x={-84} y={-42} width={168} height={42} rx={6} fill="#7A4A2A" {...st(7)} />
      <rect x={-24} y={-124} width={48} height={86} fill="#8C5A34" {...st(7)} />
      <path d="M 44 -152 L 760 500 L 620 660 L -44 -78 Z" fill="#3C4250" {...st(8)} />
      <path d="M 44 -152 L 92 -108 L 2 -24 L -44 -78 Z" fill="#fff" {...st(7)} />
      <g><rect x={-62} y={-176} width={124} height={92} rx={36} fill={SKIN} {...st(7)} />{[-30, 0, 30].map((x) => <path key={x} d={`M ${x} -170 L ${x} -128`} {...st(5)} />)}<path d="M 42 -148 C 70 -142 76 -112 48 -100" fill={SKIN} {...st(6)} /></g>
    </g>
  );
};
StampHand.at = [[420, 720], [640, 900], [450, 1080]];
const Tag = ({x, y, text, k = 1, size = 54, fill = '#FFFFFF', color = INK}) => (<g transform={`translate(${x} ${y}) rotate(-2) scale(${k})`}><rect x={-text.length * size * 0.31 - 24} y={-size * 0.96} width={text.length * size * 0.62 + 48} height={size * 1.36} rx={12} fill={fill} {...st(7)} /><text textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={size} letterSpacing={2} fill={color}>{text}</text></g>);

// ───────────── 1. the paradox: one man, two medals ─────────────
function ShotMedals({f, line, T}) {
  const g = at(line, 'germany', 0.02), b = at(line, 'britain', 0.1), m = at(line, 'medal', 0.45), same = at(line, 'same', 0.7);
  const close = f >= same - 5, chest = !close && f >= m - 2, reach = eas(f, m - 16, m - 5, 0, 1);
  const gIn = spr((f - g + 8) / 30, 13, 0.75), bIn = spr((f - b + 6) / 30, 13, 0.75);
  const pin = (a) => clamp(pop(f, a, 22, 0.5), 0, 1.25);
  const z = close ? eas(f, same - 5, same + 26, 2.25, 2.5) : chest ? eas(f, m - 2, same, 3.1, 3.3) : eas(f, 0, m, 1.0, 1.1);
  return (
    <g><Cam x={close || chest ? 495 : 540} y={close || chest ? 1040 : 900} z={z}>
      <Room wall="#27477F" wallD="#1E3966" floor="#8A5A34" floorD="#6F4728">
        {/* a great hall: two banners, gold columns; each side's own colours, no party emblems */}
        <clipPath id="spyflag"><rect x={780} y={150} width={220} height={560} /></clipPath>
        {[190, 890].map((cx, i) => <g key={cx}><rect x={cx - 110} y={150} width={220} height={560} fill={i ? '#1F3F8F' : '#F2EFE6'} {...st(7)} />{i === 0 ? <g transform={`translate(${cx} 430) scale(3.6)`}><path d="M -9 -24 L 9 -24 L 7 -7 L 24 -9 L 24 9 L 7 7 L 9 24 L -9 24 L -7 7 L -24 9 L -24 -9 L -7 -7 Z" fill="#1B1B1F" stroke="#fff" strokeWidth={2} /></g>
          : <g clipPath="url(#spyflag)"><g transform={`translate(${cx} 430)`}><path d="M -110 -280 L 110 280 M 110 -280 L -110 280" stroke="#fff" strokeWidth={34} /><path d="M -110 -280 L 110 280 M 110 -280 L -110 280" stroke="#C8102E" strokeWidth={13} /><path d="M 0 -280 L 0 280 M -110 0 L 110 0" stroke="#fff" strokeWidth={62} /><path d="M 0 -280 L 0 280 M -110 0 L 110 0" stroke="#C8102E" strokeWidth={36} /></g></g>}<rect x={cx - 110} y={150} width={220} height={560} fill="none" {...st(7)} /></g>)}
      </Room>
      {!close && <Person x={208 - (1 - gIn) * 560} y={1320} s={0.88} fit="german" T={T} seed={4} expr="stare" look={1} walk={1 - gIn} armR={[14 + 56 * reach, -4 + 44 * reach]} />}
      {!close && <Person x={781 + (1 - bIn) * 560} y={1320} s={0.88} flip fit="british" T={T} seed={7} expr="calm" look={1} walk={1 - bIn} armR={[14 + 56 * reach, -4 + 44 * reach]} />}
      <Person x={495} y={1340} s={1.0} T={T} seed={3} expr={close ? 'wink' : f >= m ? 'smug' : 'calm'} look={close ? 0.6 : f < b ? -0.8 : 0.8} medals={[f >= m ? pin(m) : 0, f >= m + 5 ? pin(m + 5) : 0]} />
    </Cam>
      {!close && !chest && f >= g && <Tag x={190} y={110} text="GERMANY" size={54} k={clamp(pop(f, g, 20, 0.6), 0, 1.15)} />}
      {!close && !chest && f >= b && <Tag x={850} y={110} text="BRITAIN" size={54} k={clamp(pop(f, b, 20, 0.6), 0, 1.15)} />}
      {close && <Tag x={540} y={1262} text="JUAN PUJOL GARCÍA" size={62} k={clamp(pop(f, same - 2, 20, 0.6), 0, 1.15)} />}</g>
  );
}
// ───────────── 2. turned down: the embassy door, the three stamps; then the Germans ─────────────
function ShotRejected({f, line, T}) {
  const shut = at(line, 'turned', 0.25), three = at(line, 'three', 0.45), so = at(line, 'so', 0.6), joined = at(line, 'joined', 0.72);
  if (f >= so - 2) {   // the German office: red light, one handshake, a briefcase
    const k = spr((f - joined + 6) / 30, 15, 0.7);
    return (
      <Cam x={540} y={880} z={eas(f, so, so + 50, 1.02, 1.14)}>
        <Room wall="#6E2620" wallD="#57201C" floor="#3C2A22" floorD="#2B1E18" fy={1120}>
          <g><rect x={330} y={120} width={420} height={330} fill="#F0E2BF" {...st(8)} /><path d="M 390 200 L 690 200 M 390 260 L 650 260 M 390 320 L 690 320" stroke="#A58C5A" strokeWidth={9} /><circle cx={650} cy={380} r={30} fill="none" stroke="#C7301F" strokeWidth={8} /></g>
        </Room>
        <Person x={200} y={1340} s={1.1} T={T} seed={3} expr="smug" look={1} armR={[lin(k, 0, 1, 12, 74), lin(k, 0, 1, -4, 74)]} />
        <Person x={800} y={1340} s={1.1} flip fit="german" T={T} seed={4} expr="stare" look={1} armR={[lin(k, 0, 1, 12, 74), lin(k, 0, 1, -4, 74)]} />
      </Cam>
    );
  }
  if (f >= three - 3) {   // the form on the desk, stamped three times, on the beat
    const shake = f >= three && f < three + 36 ? -5 * Math.exp(-(((f - three) % 12)) * 0.55) : 0;
    return (
      <g transform={`translate(0 ${shake})`}>
        <rect x={-60} y={-60} width={SW + 120} height={SH + 120} fill="#6B4227" />
        {[...Array(7)].map((_, i) => <path key={i} d={`M -60 ${i * 300} L ${SW + 60} ${i * 300 + 34}`} stroke="#573420" strokeWidth={7} />)}
        <g transform="rotate(-3 540 760)"><rect x={130} y={230} width={820} height={1040} rx={8} fill="#F3EBD6" {...st(8)} />
          <text x={540} y={340} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={58} letterSpacing={3} fill={INK}>BRITISH EMBASSY, MADRID</text>
          <text x={540} y={420} textAnchor="middle" fontFamily={OSW} fontWeight={500} fontSize={44} fill="#5B5145">APPLICATION TO SPY FOR BRITAIN</text>
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M 210 ${500 + i * 70} L 870 ${500 + i * 70}`} stroke="#B9AE93" strokeWidth={6} />)}</g>
        <Stamp text="REJECTED" f={f} a={three} x={420} y={720} rot={-14} k0={0.12} />
        <Stamp text="REJECTED" f={f} a={three + 12} x={640} y={900} rot={7} k0={0.12} />
        <Stamp text="REJECTED" f={f} a={three + 24} x={450} y={1080} rot={-7} k0={0.12} />
        <StampHand f={f} hits={[three, three + 12, three + 24]} />
      </g>
    );
  }
  // the embassy door in the Madrid sun: hopeful, then shut in his face
  const doorK = eas(f, shut - 4, shut + 3, 0, 1), jolt = f >= shut + 2 ? Math.exp(-(f - shut - 2) * 0.4) * 22 : 0;
  return (
    <Cam x={540} y={860} z={eas(f, 0, three, 1.06, 1.16)}>
      <rect x={-300} y={-300} width={SW + 600} height={1440} fill="#E2C89A" />
      {[...Array(5)].map((_, i) => <path key={i} d={`M -300 ${i * 230} L ${SW + 300} ${i * 230}`} stroke="#CDB184" strokeWidth={6} />)}
      <rect x={-300} y={1140} width={SW + 600} height={1200} fill="#B8A483" />
      <g transform={`translate(${jolt} 0)`}>
        <rect x={520} y={230} width={460} height={910} fill={INK} /><rect x={540} y={250} width={420} height={890} fill="#1A1410" />
        <g transform={`translate(540 250) scale(${0.28 + doorK * 0.72} 1)`}><rect width={420} height={890} fill="#27553F" {...st(7)} /><rect x={50} y={70} width={320} height={300} fill="#2F6A4F" {...st(5)} /><rect x={50} y={430} width={320} height={380} fill="#2F6A4F" {...st(5)} /><circle cx={50} cy={420} r={17} fill="#E7C766" {...st(4)} /></g>
        <rect x={570} y={130} width={360} height={84} rx={8} fill="#E7C766" {...st(6)} /><text x={750} y={190} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={46} fill={INK}>BRITISH EMBASSY</text>
      </g>
      <Person x={290} y={1340} s={1.14} T={T} seed={3} expr={f >= shut + 2 ? 'stunned' : 'hopeful'} look={1} lean={f >= shut + 2 ? -3 : 1} armR={[62, 44]} held={<g transform="rotate(-8) translate(-50 -66)"><rect width={100} height={124} fill="#F3EBD6" {...st(5)} /><path d="M 16 28 L 84 28 M 16 56 L 84 56 M 16 84 L 66 84" stroke="#A9A087" strokeWidth={5} /></g>} />
    </Cam>
  );
}
// ───────────── 3. the reports: a café in Lisbon, never been to Britain, one guidebook ─────────────
function ShotGuide({f, line, T}) {
  const g = at(line, 'tourist', 0.5), close = f >= g - 3;
  if (close) {
    const k = clamp(pop(f, g - 3, 16, 0.65), 0, 1.15);
    return (
      <Cam x={540} y={760} z={eas(f, g, g + 60, 1.0, 1.08)}>
        <rect x={-300} y={-300} width={SW + 600} height={SH + 600} fill="#C97B3A" />
        {[...Array(9)].map((_, i) => <path key={i} d={`M ${-100 + i * 180} -300 L ${-100 + i * 180} ${SH + 300}`} stroke="#B56D31" strokeWidth={7} />)}
        <g transform={`translate(540 720) rotate(-4) scale(${k})`}>
          <path d="M -360 -440 L 360 -440 L 372 440 L -372 440 Z" fill="#1E5F93" {...st(9)} /><path d="M -320 -400 L 320 -400 L 330 400 L -330 400 Z" fill="none" stroke="#E7C766" strokeWidth={8} />
          <text y={-230} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={120} letterSpacing={6} fill="#F7F1DF">BRITAIN</text>
          <text y={-130} textAnchor="middle" fontFamily={OSW} fontWeight={600} fontSize={60} letterSpacing={6} fill="#E7C766">A TOURIST GUIDE</text>
          <g transform="translate(0 120)"><path d="M -220 120 L -160 -20 L -100 60 L -20 -110 L 70 70 L 130 -10 L 220 120 Z" fill="#7FA76C" {...st(7)} /><circle cx={150} cy={-110} r={46} fill="#F2C94C" {...st(6)} /><rect x={-60} y={20} width={120} height={100} fill="#D9C7A0" {...st(6)} /><path d="M -74 20 L 0 -44 L 74 20 Z" fill="#B5412F" {...st(6)} /></g>
        </g>
      </Cam>
    );
  }
  return (
    <Cam x={540} y={850} z={eas(f, 0, g, 1.04, 1.15)}>
      <Room wall="#F0C76B" wallD="#E5B654" floor="#A9663A" floorD="#8C5230" fy={1090}>
        {/* Lisbon's blue tiles under a sunny window */}
        <g>{[...Array(6)].map((_, i) => [...Array(3)].map((_, j) => <g key={i + '-' + j} transform={`translate(${i * 190 + 12} ${820 + j * 90})`}><rect width={186} height={86} fill="#F7F1DF" stroke="#2E6AA6" strokeWidth={5} /><path d="M 93 8 L 138 43 L 93 78 L 48 43 Z" fill="none" stroke="#2E6AA6" strokeWidth={6} /></g>))}</g>
        <g transform="translate(540 300)"><rect x={-210} y={-190} width={420} height={380} fill="#8CCFEF" {...st(8)} /><path d="M 0 -190 L 0 190 M -210 0 L 210 0" {...st(8)} /><path d="M -120 190 C -80 120 -20 120 20 190 Z" fill="#E36414" {...st(5)} /></g>
      </Room>
      <Person x={540} y={1320} s={1.14} T={T} seed={3} expr="smug" look={-0.5} lookY={0.8} armR={[46, 64 + Math.sin(T * 0.8) * 8]} armL={[-46, -64]} tilt={2} />
      <path d="M 90 1085 L 990 1085 L 1060 1190 L 20 1190 Z" fill="#7A4A2A" {...st(8)} /><rect x={120} y={1190} width={44} height={260} fill="#5E3820" {...st(6)} /><rect x={916} y={1190} width={44} height={260} fill="#5E3820" {...st(6)} />
      <g transform="translate(540 1060)"><rect x={-130} y={-44} width={260} height={84} rx={12} fill="#3E4650" {...st(6)} /><rect x={-92} y={-120} width={184} height={80} fill="#F7F1DF" {...st(5)} /><path d="M -70 -96 L 70 -96 M -70 -70 L 44 -70" stroke="#A9A087" strokeWidth={5} /></g>
      <g transform="translate(860 1050) rotate(8)"><rect x={-70} y={-46} width={140} height={92} fill="#1E5F93" {...st(6)} /><path d="M -44 -14 L 44 -14 M -44 12 L 24 12" stroke="#E7C766" strokeWidth={6} /></g>
    </Cam>
  );
}
// ───────────── 4. 27 agents who didn't exist: a wall of faces, then blanks, and one man behind them ─────────────
function ShotAgents({f, line, T}) {
  const n27 = at(line, '27', 0.6), ex = at(line, 'exist', 0.8), R = (i) => (i * 37 + 11) % 100 / 100;
  return (
    <g>
      <Cam x={540} y={760} z={eas(f, 0, ex + 20, 1.0, 1.08)}>
        <rect x={-300} y={-300} width={SW + 600} height={SH + 600} fill="#1F4E58" />
        {[...Array(6)].map((_, i) => <rect key={i} x={-200 + i * 280} y={-300} width={140} height={SH + 600} fill="#1A434C" />)}
        <rect x={60} y={170} width={960} height={930} rx={12} fill="#B98E5C" {...st(9)} />
        {[...Array(27)].map((_, i) => { const row = Math.floor(i / 6), c = i % 6, a = 2 + i * Math.max(0, n27 - 4) / 26, x = 152 + c * 155, y = 270 + row * 175;
          if (f < a) return null; const k = clamp(pop(f, a, 22, 0.55), 0, 1.2), gone = f >= ex + i * 0.45 - 3;
          return (<g key={i} transform={`translate(${x} ${y}) rotate(${(R(i) - 0.5) * 9}) scale(${k * 0.9})`}>
            <rect x={-74} y={-80} width={148} height={166} fill={gone ? 'none' : '#F3EBD6'} stroke={gone ? '#F7F1DF' : INK} strokeWidth={6} strokeDasharray={gone ? '14 12' : 'none'} />
            {gone ? <text y={32} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={92} fill="#F7F1DF">?</text>
              : <g transform="translate(0 6) scale(0.42)"><ellipse rx={126} ry={119} fill={SKIN} {...st(13)} /><Face expr={['stare', 'calm', 'deadpan', 'smug'][i % 4]} dx={8} />
                {i % 3 === 0 && <path d="M -120 -36 C -130 -134 130 -134 120 -36 Z" fill={['#2E211A', '#6F7A63', '#8A8378'][i % 3 === 0 ? (i % 9) / 3 : 0]} {...st(10)} />}
                {i % 3 === 1 && <path d="M -22 40 C -8 28 8 32 14 40 C 22 32 38 28 52 40 C 40 50 26 50 14 46 C 2 50 -12 50 -22 40 Z" fill="#3A2A20" {...st(5)} />}</g>}
            <circle cy={-82} r={9} fill="#C7301F" {...st(3)} /></g>); })}
      </Cam>
      {f >= n27 && <Tag x={760} y={140} text="27 AGENTS" size={68} fill="#FDE047" k={clamp(pop(f, n27, 18, 0.55), 0, 1.15)} />}
      {f >= ex - 3 && <g transform={`translate(${lin(f, ex - 3, ex + 8, -180, 170)} 1900)`}><Person s={0.9} T={T} seed={3} expr="smug" look={1} armR={[60, 150]} shadow={false} /></g>}
    </g>
  );
}
// ───────────── 5. the D-Day lie: the real map, an arrow, one stamp ─────────────
function ShotMap({f, line, T}) {
  const told = at(line, 'told', 0.15), trick = at(line, 'trick', 0.8);
  const ppd = 150, clon = -0.5, clat = 50.2;
  const sx = (lon) => SW / 2 + (lon - clon) * ppd, sy = (lat) => 720 - (lat - clat) * ppd * 1.45;
  const kk = eas(f, told - 6, trick, 0, 1);
  const nx = sx(-0.6), ny = sy(49.35), cx = sx(1.85), cy = sy(50.95), fx = sx(-1.2), fy = sy(50.9);
  return (
    <g>
      <rect width={SW} height={SH} fill="#1B2A3A" />
      <clipPath id="spymap"><rect x={70} y={170} width={940} height={1040} /></clipPath>
      <g clipPath="url(#spymap)"><rect x={70} y={170} width={940} height={1040} fill="#7FB4C4" />
        <g transform={`translate(${sx(-180)} ${sy(90)}) scale(${ppd / K} ${ppd * 1.45 / K})`}><path d={LAND} fill="#E2CF9C" stroke="#3B2B1E" strokeWidth={0.18} /></g></g>
      <rect x={70} y={170} width={940} height={1040} fill="none" stroke="#F2E6C8" strokeWidth={9} />
      <text x={sx(-1.8)} y={sy(51.8)} fontFamily={OSW} fontWeight={700} fontSize={56} letterSpacing={6} fill={INK}>BRITAIN</text>
      <text x={sx(0.15)} y={sy(48.2)} fontFamily={OSW} fontWeight={700} fontSize={56} letterSpacing={6} fill={INK}>FRANCE</text>
      {/* the real landing, Normandy, and the place he pointed them at instead, Calais */}
      <path d={`M ${fx} ${fy} Q ${(fx + nx) / 2 - 70} ${(fy + ny) / 2} ${fx + (nx - fx) * kk} ${fy + (ny - fy) * kk}`} fill="none" stroke="#C7301F" strokeWidth={15} strokeDasharray="30 20" />
      <circle cx={nx} cy={ny} r={18} fill="#C7301F" {...st(5)} /><Tag x={nx - 220} y={ny + 96} text="NORMANDY" size={50} />
      <circle cx={cx} cy={cy} r={18} fill={INK} /><Tag x={cx + 10} y={cy - 40} text="CALAIS" size={44} />
      <Stamp text="A TRICK" f={f} a={trick - 1} x={nx + 240} y={ny + 118} rot={-11} size={80} />
      <g transform={`translate(${lin(clamp(pop(f, told - 8, 13, 0.8), 0, 1), 0, 1, 1230, 770)} 1935)`}><Person s={0.78} flip fit="german" T={T} seed={4} expr="stare" look={1} armR={[62, 118]} shadow={false} tilt={f >= trick ? Math.sin((f - trick) * 0.3) * 4 : 0} /></g>
      <g transform={`translate(${lin(clamp(pop(f, told - 8, 13, 0.8), 0, 1), 0, 1, -200, 230)} 1935)`}><Person s={0.78} T={T} seed={3} expr={f >= trick ? 'wink' : 'smug'} look={1} armR={[60, 140]} shadow={false} /></g>
    </g>
  );
}
const SHOTS = {s_medals: ShotMedals, s_rejected: ShotRejected, s_guide: ShotGuide, s_agents: ShotAgents, s_map: ShotMap};

// captions: two or three bold words at a time, no box, the spoken word yellow, clear of the Shorts buttons
const Caps = ({lines}) => {
  const f = useCurrentFrame();
  const l = lines.find((x, i) => f >= x.cut && (i + 1 >= lines.length || f < lines[i + 1].cut));
  if (!l || !(l.words || []).length) return null;
  if (f < l.words[0][1] - 1) return null;
  let at0 = 0;
  const groups = (l.p && l.p.caps || []).map((n) => { const x = l.words.slice(at0, at0 + n); at0 += n; return x; });
  if (at0 < l.words.length) groups.push(l.words.slice(at0));
  const g = groups.filter((x) => x.length).reduce((cur, x) => (x[0][1] <= f + 1 ? x : cur));
  const now = g.reduce((a, w, i) => (w[1] <= f ? i : a), 0), bump = 1 + 0.06 * Math.exp(-Math.max(0, f - g[0][1]) * 0.35);
  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: 1350, paddingRight: 110}}>
      <div style={{transform: `scale(${bump})`, maxWidth: 860, textAlign: 'center', fontFamily: NUN, fontWeight: 900, fontSize: 84, lineHeight: 1.08, textTransform: 'uppercase', WebkitTextStroke: '16px #17110C', paintOrder: 'stroke fill'}}>
        {g.map((w, i) => <span key={i} style={{color: i === now ? '#FDE047' : '#FFFFFF', marginRight: i + 1 < g.length ? 22 : 0}}>{w[0].replace(/[.,:;]$/, '')}</span>)}
      </div>
    </AbsoluteFill>
  );
};
const Shot = ({line, len}) => {
  const f = useCurrentFrame(), S = SHOTS[line.shot] || ShotMedals;
  return <AbsoluteFill><svg width="100%" height="100%" viewBox={`0 0 ${SW} ${SH}`} style={{position: 'absolute', inset: 0}}><S f={f} len={len} line={line} T={line.cut + f} /></svg></AbsoluteFill>;
};
export const SpyShort = ({lines = [], frames = 450, captions = true}) => (
  <AbsoluteFill style={{backgroundColor: '#111'}}>
    <style>{FONT_CSS}</style>
    {lines.map((l, i) => { const to = i + 1 < lines.length ? lines[i + 1].cut : frames;
      return <Sequence key={i} from={l.cut} durationInFrames={Math.max(1, to - l.cut)} layout="none"><Shot line={{...l, start: l.cut}} len={to - l.cut} /></Sequence>; })}
    {captions && <Caps lines={lines} />}
  </AbsoluteFill>
);
