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
const cue = (line, key, word, frac) => at(line, (line.p && line.p.cue && line.p.cue[key]) || word, frac);
const NUN = "'Nunito', 'Arial Rounded MT Bold', sans-serif", OSW = "'Oswald', sans-serif";
const FITS = {
  garbo: {coat: '#3C4250', coatD: '#2C313C', legs: '#2C313C', hair: '#5A3820', bow: '#D23B2B'},
  german: {coat: '#6F7A63', coatD: '#566050', legs: '#4E5747', cap: '#5F6A55', band: '#2C3327', piping: '#C23B2E', belt: true},
  british: {coat: '#B0935C', coatD: '#8F7648', legs: '#8F7648', cap: '#A58952', band: '#6A3024', tie: '#6E5A36', moustache: true},
};
// the Iron Cross and the MBE: small, but each one recognisable
const IronCross = ({s = 1}) => (<g transform={`scale(${s})`}><path d="M -9 -46 L 9 -46 L 7 -24 L -7 -24 Z" fill="#C4312A" {...st(3)} /><path d="M -3 -46 L 3 -46 L 2 -24 L -2 -24 Z" fill="#fff" />
  <path d="M -12 -26 L 12 -26 L 5 -5 L 26 -12 L 26 12 L 5 5 L 12 26 L -12 26 L -5 5 L -26 12 L -26 -12 L -5 -5 Z" fill="#1B1B1F" stroke="#E7E7EA" strokeWidth={3.5} strokeLinejoin="round" /></g>);
const MBE = ({s = 1}) => (<g transform={`scale(${s})`}><path d="M -11 -48 L 11 -48 L 9 -22 L -9 -22 Z" fill="#D98A9C" {...st(3)} /><path d="M -10 -47 L -7 -47 L -6 -23 L -8 -23 Z M 7 -47 L 10 -47 L 8 -23 L 6 -23 Z" fill="#A4A9AE" />
  <path d="M -7 -24 L 7 -24 L 4 -5 L 24 -7 L 24 7 L 4 5 L 7 24 L -7 24 L -4 5 L -24 7 L -24 -7 L -4 -5 Z" fill="#E7C766" {...st(3.5)} /><circle r={7} fill="#B7283A" stroke={INK} strokeWidth={2.5} /></g>);

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
const Stamp = ({text, f, a, x, y, rot = -12, size = 92, color = '#C7301F', k0 = 1.3, plate = false}) => { if (f < a) return null; const k = 1 + k0 * Math.exp(-(f - a) * 0.75);
  return (<g transform={`translate(${x} ${y}) rotate(${rot}) scale(${k})`} opacity={clamp((f - a + 1) / 2, 0, 1)}><rect x={-text.length * size * 0.36 - 22} y={-size * 0.82} width={text.length * size * 0.72 + 44} height={size * 1.2} rx={10} fill={plate ? '#F7F1DF' : 'none'} stroke={color} strokeWidth={10} />
    <text textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={size} letterSpacing={4} fill={color}>{text}</text></g>); };
// a hand on a rubber stamp: eased down, a short hold on the paper, eased up; a beat between hits, then away to the right. The arm comes from the right: the form's header stays clear
const StampHand = ({f, hits}) => {
  const i = hits.findIndex((h) => f < h + 6), n = i < 0 ? hits.length - 1 : i, h = hits[n];
  const away = i < 0 ? eas(f, h + 3, h + 13, 0, 1000) : 0, lift = i < 0 ? 0 : (f < h - 1 ? eas(f, h - 3, h, 110, 0) : eas(f, h + 1, h + 6, 0, 110));
  const at = StampHand.at[n];
  return (
    <g transform={`translate(${at[0] + away} ${at[1] - lift})`}>
      <rect x={-84} y={-42} width={168} height={42} rx={6} fill="#7A4A2A" {...st(7)} />
      <rect x={-24} y={-124} width={48} height={86} fill="#8C5A34" {...st(7)} />
      <path d="M 50 -172 C 300 -210 600 -250 1000 -300 L 1000 -180 C 600 -140 300 -100 50 -88 Z" fill="#3C4250" {...st(8)} />
      <path d="M 50 -178 L 112 -186 L 112 -92 L 50 -84 Z" fill="#fff" {...st(7)} />
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
  const gIn = 0.86 + 0.14 * spr(f / 24, 13, 0.75), bIn = 0.86 + 0.14 * spr(f / 24, 13, 0.75);
  const pin = (a) => clamp(pop(f, a, 22, 0.5), 0, 1.25);
  const z = close ? eas(f, same - 5, same + 26, 2.25, 2.5) : chest ? eas(f, m - 2, same, 2.6, 2.75) : eas(f, 0, m, 1.0, 1.1);
  return (
    <g><Cam x={close || chest ? 495 : 540} y={chest ? 1000 : close ? 1040 : 900} z={z}>
      <Room wall="#27477F" wallD="#1E3966" floor="#8A5A34" floorD="#6F4728">
        {/* a great hall: two banners, gold columns; each side's own colours, no party emblems */}
        <clipPath id="spyflag"><rect x={780} y={150} width={220} height={560} /></clipPath>
        {!close && !chest && [190, 890].map((cx, i) => <g key={cx}><rect x={cx - 110} y={150} width={220} height={560} fill={i ? '#1F3F8F' : '#F2EFE6'} {...st(7)} />{i === 0 ? <g transform={`translate(${cx} 430) scale(3.6)`}><path d="M -12 -26 L 12 -26 L 5 -5 L 26 -12 L 26 12 L 5 5 L 12 26 L -12 26 L -5 5 L -26 12 L -26 -12 L -5 -5 Z" fill="#1B1B1F" stroke="#fff" strokeWidth={2} /></g>
          : <g clipPath="url(#spyflag)"><g transform={`translate(${cx} 430)`}><path d="M -110 -280 L 110 280 M 110 -280 L -110 280" stroke="#fff" strokeWidth={34} /><path d="M -110 -280 L 110 280 M 110 -280 L -110 280" stroke="#C8102E" strokeWidth={13} /><path d="M 0 -280 L 0 280 M -110 0 L 110 0" stroke="#fff" strokeWidth={62} /><path d="M 0 -280 L 0 280 M -110 0 L 110 0" stroke="#C8102E" strokeWidth={36} /></g></g>}<rect x={cx - 110} y={150} width={220} height={560} fill="none" {...st(7)} /></g>)}
      </Room>
      {!close && !chest && <Person x={208 - (1 - gIn) * 560} y={1320} s={0.88} fit="german" T={T} seed={4} expr="stare" look={1} walk={1 - gIn} armR={[14 + 56 * reach, -4 + 44 * reach]} />}
      {!close && !chest && <Person x={781 + (1 - bIn) * 560} y={1320} s={0.88} flip fit="british" T={T} seed={7} expr="calm" look={1} walk={1 - bIn} armR={[14 + 56 * reach, -4 + 44 * reach]} />}
      <Person x={495} y={1340} s={1.0} T={T} seed={3} expr={close ? 'wink' : f >= m ? 'smug' : 'calm'} look={close ? 0.6 : f < b ? -0.8 : 0.8} medals={[f >= m ? pin(m) : 0, f >= m + 5 ? pin(m + 5) : 0]} />
    </Cam>
      {!close && !chest && <Tag x={190} y={170} text="GERMANY" size={54} />}
      {!close && !chest && <Tag x={850} y={170} text="BRITAIN" size={54} />}
      </g>
  );
}
// ───────────── 2. turned down: the embassy door, the three stamps; then the Germans ─────────────
function ShotRejected({f, line, T}) {
  const shut = cue(line, 'shut', 'turned', 0.25), three = cue(line, 'three', 'three', 0.45), so = cue(line, 'so', 'so', 0.6), joined = cue(line, 'joined', 'joined', 0.72);
  if (f >= so - 2 && !(line.p && line.p.no_office)) {   // the German office: red light, one handshake, a briefcase
    const k = spr((f - joined + 6) / 30, 15, 0.7);
    return (
      <Cam x={540} y={880} z={eas(f, so, so + 50, 1.02, 1.14)}>
        <Room wall="#6E2620" wallD="#57201C" floor="#3C2A22" floorD="#2B1E18" fy={1120}>
          
        </Room>
        <Person x={200} y={1340} s={1.1} T={T} seed={3} expr="smug" look={1} armR={[lin(k, 0, 1, 12, 74), lin(k, 0, 1, -4, 74)]} />
        <Person x={800} y={1340} s={1.1} flip fit="german" T={T} seed={4} expr="stare" look={1} armR={[lin(k, 0, 1, 12, 74), lin(k, 0, 1, -4, 74)]} />
      </Cam>
    );
  }
  if (f >= three - 3) {   // the form on the desk, stamped three times, on the beat
    const shake = f >= three && f < three + 36 ? -5 * Math.exp(-(((f - three) % 9)) * 0.6) : 0;
    return (
      <g transform={`translate(0 ${shake})`}>
        <rect x={-60} y={-60} width={SW + 120} height={SH + 120} fill="#6B4227" />
        {[...Array(7)].map((_, i) => <path key={i} d={`M -60 ${i * 300} L ${SW + 60} ${i * 300 + 34}`} stroke="#573420" strokeWidth={7} />)}
        <g transform="rotate(-3 540 760)"><rect x={130} y={230} width={820} height={1040} rx={8} fill="#F3EBD6" {...st(8)} />
          <text x={540} y={340} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={58} letterSpacing={3} fill={INK}>BRITISH EMBASSY, MADRID</text>
          <text x={540} y={420} textAnchor="middle" fontFamily={OSW} fontWeight={500} fontSize={44} fill="#5B5145">APPLICATION TO SPY FOR BRITAIN</text>
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M 210 ${500 + i * 70} L 870 ${500 + i * 70}`} stroke="#B9AE93" strokeWidth={6} />)}</g>
        <Stamp text="REJECTED" f={f} a={three} x={420} y={720} rot={-14} k0={0.12} />
        <Stamp text="REJECTED" f={f} a={three + 9} x={640} y={900} rot={7} k0={0.12} />
        <Stamp text="REJECTED" f={f} a={three + 18} x={450} y={1080} rot={-7} k0={0.12} />
        <StampHand f={f} hits={[three, three + 9, three + 18]} />
      </g>
    );
  }
  // the embassy door in the Madrid sun: hopeful, then shut in his face
  const doorK = eas(f, shut - 4, shut + 3, 0, 1), jolt = f >= shut + 2 ? Math.exp(-(f - shut - 2) * 0.4) * 22 : 0;
  const has = line.p && line.p.cue && line.p.cue.juan, juan = has ? at(line, line.p.cue.juan, 0.1) : 1e9, form = has ? at(line, line.p.cue.form, 0.2) : 1e9;
  const isFace = f >= juan - 2 && f < form - 2, isForm = f >= form - 2 && f < shut - 8;
  return (
    <g>
    <Cam x={isFace ? 350 : isForm ? 590 : 540} y={isFace ? 760 : isForm ? 1000 : 860} z={isFace ? eas(f, juan, form, 2.1, 2.25) : isForm ? eas(f, form - 2, shut - 8, 3.4, 3.6) : eas(f, 0, three, 1.06, 1.16)}>
      <rect x={-300} y={-300} width={SW + 600} height={1440} fill="#E2C89A" />
      {[...Array(5)].map((_, i) => <path key={i} d={`M -300 ${i * 230} L ${SW + 300} ${i * 230}`} stroke="#CDB184" strokeWidth={6} />)}
      <rect x={-300} y={1140} width={SW + 600} height={1200} fill="#B8A483" />
      <g transform={`translate(${jolt} 0)`}>
        <rect x={520} y={230} width={460} height={910} fill={INK} /><rect x={540} y={250} width={420} height={890} fill="#1A1410" />
        <g transform={`translate(540 250) scale(${0.28 + doorK * 0.72} 1)`}><rect width={420} height={890} fill="#27553F" {...st(7)} /><rect x={50} y={70} width={320} height={300} fill="#2F6A4F" {...st(5)} /><rect x={50} y={430} width={320} height={380} fill="#2F6A4F" {...st(5)} /><circle cx={50} cy={420} r={17} fill="#E7C766" {...st(4)} /></g>
        <rect x={570} y={130} width={360} height={84} rx={8} fill="#E7C766" {...st(6)} /><text x={750} y={190} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={46} fill={INK}>BRITISH EMBASSY</text>
      </g>
      <Person x={290} y={1270} s={1.14} T={T} seed={3} expr={f >= shut + 2 ? 'stunned' : 'hopeful'} look={1} lean={f >= shut + 2 ? -3 : 1} armR={[62, 44]} held={<g transform="rotate(-8) translate(-50 -66)"><rect width={100} height={124} fill="#F3EBD6" {...st(5)} /><text x={50} y={22} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={13} fill={INK}>I WANT TO SPY</text><text x={50} y={38} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={13} fill={INK}>FOR BRITAIN</text><path d="M 16 58 L 84 58 M 16 78 L 84 78 M 16 98 L 66 98" stroke="#A9A087" strokeWidth={5} /></g>} />
    </Cam>
    {has && f < juan - 2 && <Tag x={290} y={120} text="MADRID, 1941" size={58} k={clamp(pop(f, 1, 18, 0.6), 0.7, 1.15)} />}
    </g>
  );
}
// ───────────── 3. the reports: a café in Lisbon, never been to Britain, one guidebook ─────────────
function ShotGuide({f, line, T}) {
  const g = cue(line, 'book', 'tourist', 0.5), reel = line.p && line.p.cue && line.p.cue.reel ? at(line, line.p.cue.reel, 0.8) : 1e9, close = f >= g - 6;
  if (f >= reel - 2) return <Newsreel f={f - reel} T={T} />;
  if (close) {
    const k = clamp(pop(f, g - 3, 16, 0.65), 0.7, 1.15);
    return (
      <Cam x={540} y={760} z={eas(f, g, g + 60, 1.0, 1.08)}>
        <rect x={-300} y={-300} width={SW + 600} height={SH + 600} fill="#C97B3A" />
        {[...Array(9)].map((_, i) => <path key={i} d={`M ${-100 + i * 180} -300 L ${-100 + i * 180} ${SH + 300}`} stroke="#B56D31" strokeWidth={7} />)}
        <g transform={`translate(540 640) rotate(-4) scale(${k})`}>
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
  const paid = line.p && line.p.cue && line.p.cue.paid ? at(line, line.p.cue.paid, 0.8) : null, n27 = cue(line, 'n', '27', 0.6), ex = cue(line, 'gone', 'who', 0.7), name = line.p && line.p.cue && line.p.cue.name ? at(line, line.p.cue.name, 0.1) : null, R = (i) => (i * 37 + 11) % 100 / 100;
  return (
    <g>
      <Cam x={540} y={900} z={eas(f, 0, ex + 20, 1.0, 1.08)}>
        <rect x={-300} y={-300} width={SW + 600} height={SH + 600} fill="#1F4E58" />
        {[...Array(6)].map((_, i) => <rect key={i} x={-200 + i * 280} y={-300} width={140} height={SH + 600} fill="#1A434C" />)}
        <rect x={50} y={240} width={920} height={890} rx={12} fill="#B98E5C" {...st(9)} />
        {[...Array(27)].map((_, i) => { const row = Math.floor(i / 6), c = i % 6, a = 2 + i * Math.max(0, n27 - 4) / 26, x = 128 + c * 148, y = 340 + row * 175;
          if (f < a) return null; const k = 0.55 + 0.45 * clamp(pop(f, a, 22, 0.55), 0, 1.2), gone = f >= ex + i * 0.45 - 3;
          return (<g key={i} transform={`translate(${x} ${y}) rotate(${(R(i) - 0.5) * 9}) scale(${k * 0.85})`}>
            <rect x={-74} y={-80} width={148} height={166} fill={gone ? 'none' : '#F3EBD6'} stroke={gone ? '#F7F1DF' : INK} strokeWidth={6} strokeDasharray={gone ? '14 12' : 'none'} />
            {gone ? <text y={32} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={92} fill="#F7F1DF">?</text>
              : <g transform="translate(0 6) scale(0.42)"><ellipse rx={126} ry={119} fill={SKIN} {...st(13)} /><Face expr={['stare', 'calm', 'deadpan', 'smug'][i % 4]} dx={8} />
                {i % 3 === 0 && <path d="M -120 -36 C -130 -134 130 -134 120 -36 Z" fill={['#2E211A', '#6F7A63', '#8A8378'][i % 3 === 0 ? (i % 9) / 3 : 0]} {...st(10)} />}
                {i % 3 === 1 && <path d="M -22 40 C -8 28 8 32 14 40 C 22 32 38 28 52 40 C 40 50 26 50 14 46 C 2 50 -12 50 -22 40 Z" fill="#3A2A20" {...st(5)} />}</g>}
            <circle cy={-82} r={9} fill="#C7301F" {...st(3)} /></g>); })}
      </Cam>
      {paid !== null && f >= paid - 4 && [...Array(16)].map((_, i) => { const r = R(i + 3), d = paid - 4 + i * 2, y = (f - d) * (15 + r * 7) - 130; return f < d || y > 1230 ? null : <g key={i} transform={`translate(${90 + ((i * 271) % 880)} ${y}) rotate(${(r - 0.5) * 60 + (f - d) * (r > 0.5 ? 3 : -3)})`}><rect x={-62} y={-30} width={124} height={60} rx={4} fill="#7FA76C" {...st(5)} /><circle r={16} fill="#E7E2B8" {...st(3)} /></g>; })}
      {name !== null && f >= name - 2 && f < n27 - 3 && <Tag x={500} y={190} text="CODENAME: GARBO" size={64} k={clamp(pop(f, name - 2, 18, 0.55), 0.7, 1.15)} />}
      {f >= n27 - 3 && <Tag x={500} y={190} text="27 PAID AGENTS" size={64} fill="#FDE047" k={clamp(pop(f, n27 - 3, 18, 0.55), 0, 1.15)} />}
      <rect y={1690} width={SW} height={SH - 1690} fill="#123038" />
      {line.p && line.p.cue && line.p.cue.handler && <g transform="translate(830 1860)"><Person s={0.9} flip fit="british" T={T} seed={7} expr={f >= ex ? 'smug' : 'calm'} look={1} lookY={-0.8} armR={[150, 24]} /></g>}
      {(f >= ex - 8 || (line.p && line.p.cue && line.p.cue.handler)) && <g transform={`translate(${line.p && line.p.cue && line.p.cue.handler ? 220 : eas(f, ex - 8, ex + 6, -180, 200)} 1860)`}><Person s={0.9} T={T} seed={3} expr="smug" look={1} armR={[60, 150]} /></g>}
    </g>
  );
}
// ───────────── 5. the D-Day lie: the real map, an arrow, one stamp ─────────────
function ShotMap({f, line, T}) {
  const told = cue(line, 'told', 'told', 0.15), trick = cue(line, 'trick', 'trick', 0.8), beach = line.p && line.p.cue && line.p.cue.beach ? at(line, line.p.cue.beach, 0.8) : null, radio = line.p && line.p.cue && line.p.cue.radio ? at(line, line.p.cue.radio, 0.3) : null, decoy = line.p && line.p.cue && line.p.cue.decoy ? at(line, line.p.cue.decoy, 0.4) : null, land = line.p && line.p.cue && line.p.cue.land ? at(line, line.p.cue.land, 0.1) : null;
  if (radio !== null && f >= radio - 2 && f < decoy - 2) return <Radio f={f - radio} T={T} />;
  if (beach !== null && f >= beach - 2) return <Beach f={f - beach} T={T} watch={cue(line, 'watch', 'watching', 0.9) - beach} />;
  const ppd = 150, clon = -0.5, clat = 50.2;
  const sx = (lon) => SW / 2 + (lon - clon) * ppd, sy = (lat) => 720 - (lat - clat) * ppd * 1.45;
  const kk = land !== null ? eas(f, land - 4, land + 22, 0, 1) : eas(f, told - 6, trick, 0, 1);
  const nx = sx(-0.6), ny = sy(49.35), cx = sx(1.85), cy = sy(50.95), fx = sx(-1.2), fy = sy(50.9);
  return (
    <g>
      <rect width={SW} height={SH} fill="#1B2A3A" />
      <rect y={1190} width={SW} height={SH - 1190} fill="#C9A46B" />
      <clipPath id="spymap"><rect x={70} y={150} width={880} height={900} /></clipPath>
      <g clipPath="url(#spymap)"><rect x={70} y={150} width={880} height={900} fill="#7FB4C4" />
        <g transform={`translate(${sx(-180)} ${sy(90)}) scale(${ppd / K} ${ppd * 1.45 / K})`}><path d={LAND} fill="#E2CF9C" stroke="#3B2B1E" strokeWidth={0.18} /></g></g>
      <rect x={70} y={150} width={880} height={900} fill="none" stroke="#F2E6C8" strokeWidth={9} />
      <text x={sx(-1.8)} y={sy(51.8)} fontFamily={OSW} fontWeight={700} fontSize={56} letterSpacing={6} fill={INK}>BRITAIN</text>
      <text x={sx(0.1)} y={sy(48.9)} fontFamily={OSW} fontWeight={700} fontSize={56} letterSpacing={6} fill={INK}>FRANCE</text>
      {/* the real landing, Normandy, and the place he pointed them at instead, Calais */}
      <path d={`M ${fx} ${fy} Q ${(fx + nx) / 2 - 70} ${(fy + ny) / 2} ${fx + (nx - fx) * kk} ${fy + (ny - fy) * kk}`} fill="none" stroke="#C7301F" strokeWidth={15} strokeDasharray="30 20" />
      {land !== null && f < radio && [0, 1, 2].map((i) => { const q = clamp(kk - i * 0.12, 0, 1); return <path key={i} transform={`translate(${fx + (nx - fx) * q + (i - 1) * 46} ${fy + (ny - fy) * q - 14})`} d="M -26 0 L 26 0 L 18 14 L -18 14 Z M -8 0 L -8 -12 L 8 -12 L 8 0" fill="#3C4650" stroke="#F7F1DF" strokeWidth={3} />; })}
      {land !== null && f < radio && <Tag x={540} y={100} text={f >= cue(line, 'three', 'three', 0.4) ? 'D-DAY + 3 DAYS' : 'D-DAY: 6 JUNE 1944'} size={58} fill="#FDE047" k={clamp(pop(f, 1, 18, 0.6), 0.7, 1.15)} />}
      <circle cx={nx} cy={ny} r={18} fill="#C7301F" {...st(5)} /><Tag x={nx - 220} y={ny + 96} text="NORMANDY" size={50} />
      <circle cx={cx} cy={cy} r={18} fill={INK} />{f < trick + 6 && <Tag x={cx - 30} y={cy - 40} text="CALAIS" size={44} />}
      <Stamp text={(line.p && line.p.stamp) || 'A TRICK'} f={f} a={trick - 1} x={nx + 20} y={ny - 170} rot={-11} size={68} k0={0.35} plate />
      {f >= trick + 6 && <Tag x={cx - 165} y={cy - 40} text="REAL ONE: CALAIS" size={44} fill="#FDE047" k={clamp(pop(f, trick + 6, 18, 0.6), 0.7, 1.15)} />}
      {f >= trick && [0, 14].map((d) => { const q = clamp((f - trick - d) / 24, 0, 1); return <circle key={d} cx={cx} cy={cy} r={18 + q * 90} fill="none" stroke="#C7301F" strokeWidth={9} opacity={1 - q} />; })}
      <g transform={`translate(${lin(clamp(pop(f, -9, 13, 0.8), 0, 1), 0, 1, 1230, 790)} 1780)`}><Person s={0.78} flip fit="german" T={T} seed={4} expr={f >= trick ? 'hopeful' : 'stare'} look={f >= told + 14 ? 0.3 : 1} lookY={-1} armR={[14, -4]} shadow={false} tilt={f >= trick ? Math.sin((f - trick) * 0.3) * 4 : 0} /></g>
      <g transform={`translate(${lin(clamp(pop(f, -9, 13, 0.8), 0, 1), 0, 1, -200, 190)} 1780)`}><Person s={0.78} T={T} seed={3} expr={f >= trick ? 'wink' : 'smug'} look={0.4} lookY={-1} armR={[14, -4]} shadow={false} /></g>
    </g>
  );
}


// he taps out the lie: the key, the dots and dashes crossing to a BERLIN tag
const Radio = ({f, T}) => (
  <g><Room wall="#7D8796" wallD="#6F7988" floor="#3C2A22" floorD="#2B1E18" fy={1060}><circle cx={880} cy={260} r={92} fill="#F3EBD6" {...st(8)} /><path d="M 880 260 L 880 196 M 880 260 L 924 288" {...st(8)} /></Room>
    <Person x={350} y={1370} s={1.18} T={T} seed={3} expr="smug" look={1} lookY={0.7} armR={[66, 62 + (Math.floor(T / 3) % 2) * 12]} />
    <path d="M 40 1040 L 1040 1040 L 1080 1160 L 0 1160 Z" fill="#7A4A2A" {...st(8)} />
    <g transform="translate(610 1020)"><rect x={-90} y={-14} width={180} height={34} fill="#2B241D" {...st(5)} /><rect x={-70} y={-34 + (Math.floor(T / 3) % 2) * 8} width={120} height={14} fill="#B5B9BC" {...st(4)} /><circle cx={56} cy={-46 + (Math.floor(T / 3) % 2) * 8} r={17} fill="#2B241D" {...st(4)} /></g>
    {[...Array(9)].map((_, i) => { const x = 640 + ((f * 11 + i * 62) % 420), dot = i % 3 !== 1; return <rect key={i} x={x} y={640 - (x - 640) * 0.65} width={dot ? 18 : 46} height={16} rx={8} fill="#FDE047" stroke={INK} strokeWidth={3} />; })}
    <Tag x={850} y={430} text="TO BERLIN" size={58} k={clamp(pop(f, 1, 18, 0.6), 0.7, 1.15)} /></g>
);
// the payoff of the lie: rows of tanks on the French shore, looking at nothing
const Beach = ({f, T, watch, instead = 1e9, calais = 1e9}) => (
  <g>
    <rect x={-100} y={-100} width={SW + 200} height={760} fill="#A9CDE0" /><circle cx={820} cy={230} r={70} fill="#F7E7A8" />
    <rect x={-100} y={560} width={SW + 200} height={260} fill="#3D7FA3" />{[0, 1, 2, 3].map((i) => <path key={i} d={`M ${-120 + ((f * (1 + i * 0.3)) % 180)} ${600 + i * 54} q 90 -16 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0`} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={5} />)}
    <rect x={-100} y={800} width={SW + 200} height={1300} fill="#D9C08C" /><rect x={-100} y={1075} width={SW + 200} height={1000} fill="#5E4E30" />
    {[...Array(21)].map((_, i) => { const row = Math.floor(i / 7), c = i % 7, a = i * 1.1, k = clamp(pop(f, a, 16, 0.6), 0, 1.1), sc = 0.68 + row * 0.14; return f < a ? null : <g key={i} transform={`translate(${70 + c * 156 + (row % 2) * 40} ${862 + row * 92}) scale(${sc * k})`}><path d="M -68 0 L 68 0 L 54 26 L -54 26 Z" fill="#2B241D" {...st(5)} /><rect x={-58} y={-30} width={116} height={32} rx={8} fill="#566050" {...st(5)} /><path d="M -22 -30 L -14 -58 L 28 -58 L 34 -30 Z" fill="#6F7A63" {...st(5)} /><rect x={2} y={-96} width={12} height={46} fill="#2B241D" stroke={INK} strokeWidth={3} /></g>; })}
    {f >= 8 && <Tag x={540} y={170} text="21 GERMAN DIVISIONS" size={64} fill="#FDE047" k={clamp(pop(f, 8, 18, 0.6), 0.7, 1.15)} />}
    {f >= watch && <g transform={`translate(${eas(f, watch - 2, watch + 12, 1240, 610)} 1810)`}><Person s={0.78} flip fit="german" T={T} seed={4} expr="stare" look={0.2} lookY={-1} armR={[150, 30]} armL={[-150, -30]} shadow={false} /></g>}
    {f >= watch + 10 && f < instead && <Tag x={380} y={680} text="NOTHING" size={56} k={clamp(pop(f, watch + 10, 18, 0.6), 0.7, 1.15)} />}
    {f >= calais && f < instead && <Tag x={540} y={320} text="CALAIS" size={72} k={clamp(pop(f, calais, 18, 0.6), 0.7, 1.15)} />}
    {f >= instead && <Tag x={540} y={320} text="NOT IN NORMANDY" size={72} fill="#fff" k={clamp(pop(f, instead, 18, 0.6), 0.7, 1.15)} />}
  </g>
);
// 'Hitler awarded him': the real wording, on a telegram; nobody draws Hitler
const Telegram = ({f}) => (
  <g><rect x={-100} y={-100} width={SW + 200} height={SH + 200} fill="#6E2620" />
    <g transform={`rotate(-3 540 700) scale(${eas(f, 0, 50, 1, 1.05)})`}><rect x={120} y={300} width={840} height={620} fill="#F0E2BF" {...st(9)} /><text x={540} y={410} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={66} letterSpacing={8} fill={INK}>TELEGRAM</text><path d="M 180 450 L 900 450" {...st(6)} />
      {['TO: OUR BEST AGENT', 'THE FÜHRER AWARDS YOU', 'THE IRON CROSS'].map((t, i) => <text key={t} x={175} y={560 + i * 96} fontFamily="'Courier New', monospace" fontWeight={700} fontSize={52} fill={i === 2 ? '#C7301F' : INK}>{t.slice(0, Math.floor(clamp(f - i * 10, 0, 40) * 1.8))}</text>)}</g>
    <g transform={`translate(540 1130) scale(${4 * clamp(pop(f, 24, 18, 0.6), 0, 1.1)})`}><IronCross /></g></g>
);

const Hen = ({x, y, s = 1, flip, T = 0, seed = 0}) => { const b = Math.sin(T * 0.22 + seed * 2) * 6, peck = (Math.floor((T + seed * 17) / 40) % 3 === 0) ? 22 : 0;
  return (<g transform={`translate(${x} ${y}) scale(${(flip ? -s : s)} ${s})`}><path d="M -8 30 L -8 62 M 18 30 L 18 62" stroke="#D98E2B" strokeWidth={8} /><path d="M -62 -14 C -60 -56 -10 -40 10 -32 C 44 -28 52 10 22 30 C -8 44 -50 32 -62 -14 Z" fill="#F7F1DF" {...st(6)} />
    <g transform={`translate(${34} ${-34 + b + peck}) rotate(${peck})`}><circle r={24} fill="#F7F1DF" {...st(6)} /><path d="M 18 -4 L 42 4 L 18 10 Z" fill="#E7A531" {...st(4)} /><path d="M -12 -22 q 6 -18 12 -6 q 6 -14 12 4 Z" fill="#C7301F" {...st(4)} /><circle cx={6} cy={-4} r={4} fill={INK} /></g></g>); };
// who he was: a farm in Spain, and what he wanted
function ShotFarm({f, line, T}) {
  const nm = cue(line, 'name', 'Juan', 0.2), hen = cue(line, 'farm', 'chicken', 0.5), want = cue(line, 'want', 'wanted', 0.65), z = eas(f, 0, nm + 40, 1.04, 1.12);
  return (
    <g><Cam x={540} y={880} z={z}><rect x={-300} y={-300} width={SW + 600} height={1220} fill="#8CCFEF" /><circle cx={880} cy={220} r={86} fill="#F7D56E" />
      <path d="M -300 800 C 100 660 400 740 600 690 C 800 650 1100 700 1400 660 L 1400 1000 L -300 1000 Z" fill="#C9A85C" /><rect x={-300} y={900} width={SW + 600} height={1400} fill="#B98E4E" />
      <g transform="translate(790 900)"><path d="M -150 0 L -150 -180 L 150 -180 L 150 0 Z" fill="#D9C7A0" {...st(7)} /><path d="M -190 -180 L 0 -300 L 190 -180 Z" fill="#B5412F" {...st(7)} /><rect x={-40} y={-100} width={80} height={100} fill="#5E3820" {...st(6)} /></g>
      {[...Array(7)].map((_, i) => <rect key={i} x={40 + i * 150} y={860} width={18} height={100} fill="#8C5A34" {...st(4)} />)}<path d="M 0 884 L 1080 884 M 0 930 L 1080 930" stroke="#8C5A34" strokeWidth={9} />
      <Person x={330} y={1320} s={1.08} T={T} seed={3} expr={f >= want ? 'hopeful' : 'calm'} look={1} lookY={f >= want ? -0.7 : 0} />
      {f >= hen - 8 && [[650, 1080, 0], [830, 1130, 1], [110, 1100, 2]].map(([x, y, i]) => <Hen key={i} x={x} y={y} s={1.15 * clamp(pop(f, hen - 8 + i * 3, 16, 0.6), 0, 1.1)} flip={i === 2} T={T} seed={i} />)}
      {f >= want - 2 && <g transform={`translate(670 470) scale(${clamp(pop(f, want - 2, 18, 0.6), 0, 1.1)})`}><path d="M -210 -130 C -250 -180 250 -180 210 -130 C 280 -60 240 120 120 120 L -120 120 C -240 120 -280 -60 -210 -130 Z" fill="#fff" {...st(7)} /><g transform="translate(0 -8)"><rect x={-130} y={-80} width={260} height={160} fill="#1F3F8F" {...st(4)} /><path d="M -130 -80 L 130 80 M 130 -80 L -130 80" stroke="#fff" strokeWidth={30} /><path d="M -130 -80 L 130 80 M 130 -80 L -130 80" stroke="#C8102E" strokeWidth={12} /><path d="M 0 -80 L 0 80 M -130 0 L 130 0" stroke="#fff" strokeWidth={46} /><path d="M 0 -80 L 0 80 M -130 0 L 130 0" stroke="#C8102E" strokeWidth={26} /></g><circle cx={-90} cy={150} r={18} fill="#fff" {...st(5)} /><circle cx={-120} cy={190} r={11} fill="#fff" {...st(4)} /></g>}
    </Cam>
    {f >= hen - 2 && f < want - 2 && <Tag x={540} y={200} text="HE ONCE RAN A CHICKEN FARM" size={52} k={clamp(pop(f, hen - 2, 18, 0.6), 0.7, 1.15)} />}</g>
  );
}
// the plan, on a board, line by line on its words
function ShotPlan({f, line, T}) {
  const one = cue(line, 'one', 'become', 0.45), two = cue(line, 'two', 'then', 0.75);
  const typ = (t, a) => t.slice(0, Math.floor(clamp(f - a + 2, 0, 60) * 1.5));
  return (
    <Cam x={540} y={850} z={eas(f, 0, two + 40, 1.0, 1.06)}><Room wall="#3C2F27" wallD="#32271F" floor="#6F4728" floorD="#5A3920" fy={1090}><g /></Room>
      <rect x={70} y={150} width={940} height={760} rx={10} fill="#2D4A3C" stroke="#8C5A34" strokeWidth={22} />
      <text x={540} y={270} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={84} letterSpacing={8} fill="#F7F1DF">THE PLAN</text><path d="M 170 300 L 910 300" stroke="#F7F1DF" strokeWidth={6} />
      {f >= one - 2 && <text x={130} y={420} fontFamily={NUN} fontWeight={900} fontSize={60} fill="#FDE047">1</text>}<text x={190} y={420} fontFamily={NUN} fontWeight={800} fontSize={58} fill="#F7F1DF">{f >= one - 2 ? typ('BECOME A GERMAN SPY', one) : ''}</text>
      {f >= two - 2 && <g><text x={130} y={560} fontFamily={NUN} fontWeight={900} fontSize={60} fill="#FDE047">2</text><text x={190} y={560} fontFamily={NUN} fontWeight={800} fontSize={58} fill="#F7F1DF">{typ('OFFER BRITAIN A SPY', two)}</text><text x={190} y={640} fontFamily={NUN} fontWeight={800} fontSize={58} fill="#F7F1DF">{f >= two + 12 ? typ('ALREADY INSIDE', two + 12) : ''}</text></g>}
      <Person x={230} y={1330} s={0.86} T={T} seed={3} expr="smug" look={1} lookY={-0.8} armR={[150, 24]} />
    </Cam>
  );
}
// what a double agent is, in one picture: he stands between them; one is his real boss, the other only thinks so
function ShotDouble({f, line, T}) {
  const lon = cue(line, 'london', 'London', 0.15), dbl = cue(line, 'double', 'double', 0.4), nm = cue(line, 'name', 'codename', 0.5), wrk = cue(line, 'work', 'worked', 0.62), th = cue(line, 'think', 'thought', 0.8);
  if (f < dbl - 2) {
    return (<g><rect x={-100} y={-100} width={SW + 200} height={SH + 200} fill="#7C8FA3" /><g transform="translate(760 1000)"><rect x={-70} y={-740} width={140} height={740} fill="#C2A25F" {...st(7)} /><path d="M -80 -740 L 0 -900 L 80 -740 Z" fill="#7A8C8A" {...st(7)} /><circle cy={-610} r={56} fill="#F7F1DF" {...st(6)} /><path d="M 0 -610 L 0 -650 M 0 -610 L 28 -594" {...st(6)} /></g>
      <rect x={-100} y={1000} width={SW + 200} height={1100} fill="#4E5660" /><Tag x={350} y={230} text="LONDON, 1942" size={70} k={clamp(pop(f, Math.max(0, lon - 2), 18, 0.6), 0.7, 1.15)} />
      <Person x={300} y={1330} s={1.05} T={T} seed={3} expr="smug" look={1} lookY={-0.5} /></g>);
  }
  return (
    <g><rect x={-100} y={-100} width={SW / 2 + 100} height={SH + 200} fill="#27477F" /><rect x={SW / 2} y={-100} width={SW / 2 + 100} height={SH + 200} fill="#5A2A24" />
      <rect x={-100} y={1110} width={SW + 200} height={1000} fill="#3C2F27" />
      <Person x={165} y={1330} s={0.76} fit="british" T={T} seed={7} expr={f >= wrk ? 'smug' : 'calm'} look={1} />
      <Person x={830} y={1330} s={0.76} flip fit="german" T={T} seed={4} expr={f >= th ? 'hopeful' : 'stare'} look={1} />
      <Person x={495} y={1330} s={0.96} T={T} seed={3} expr={f >= th ? 'wink' : 'smug'} look={f >= th ? 1 : -1} />
      <Tag x={500} y={170} text={f >= nm - 2 ? 'CODENAME: GARBO' : 'DOUBLE AGENT'} size={70} fill="#FDE047" k={clamp(pop(f, f >= nm - 2 ? nm - 2 : dbl - 2, 18, 0.6), 0.7, 1.15)} />
      {f >= wrk - 2 && <Tag x={290} y={430} text="HIS REAL BOSS" size={56} k={clamp(pop(f, wrk - 2, 18, 0.6), 0.7, 1.15)} />}
      {f >= th - 2 && <Tag x={640} y={560} text="THINKS HE'S THEIRS" size={56} k={clamp(pop(f, th - 2, 18, 0.6), 0.7, 1.15)} />}
    </g>
  );
}
// the turn: the words alone, in the dark
function ShotTurn({f, line}) {
  const k = eas(f, 0, 12, 0.9, 1);
  return (<g><rect x={-100} y={-100} width={SW + 200} height={SH + 200} fill="#141821" /><g transform={`translate(500 720) scale(${k * eas(f, 0, 80, 1, 1.06)})`}>
    <text y={-70} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={104} letterSpacing={4} fill="#F7F1DF">THE LIE THAT</text><text y={70} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={138} letterSpacing={4} fill="#FDE047">MATTERED</text>
    <text y={170} textAnchor="middle" fontFamily={OSW} fontWeight={500} fontSize={54} letterSpacing={10} fill="#A9B0BC">JUNE 1944</text></g></g>);
}
const ShotBeach = ({f, line, T}) => <Beach f={f} T={T} watch={cue(line, 'watch', 'waiting', 0.5)} instead={cue(line, 'instead', 'instead', 0.8)} calais={cue(line, 'calais', 'Calais', 0.4)} />;
const Sea = ({children, tone = '#2F6F8F'}) => (<g><rect x={-200} y={-200} width={SW + 400} height={SH + 400} fill={tone} />{[...Array(11)].map((_, i) => <path key={i} d={`M -100 ${80 + i * 130} q 90 -22 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0 t 180 0`} fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={6} />)}{children}</g>);
const Ship = ({x, y, s = 1, flip, hull = '#4A5560', ghost, k = 1}) => (<g transform={`translate(${x} ${y}) scale(${(flip ? -s : s) * k} ${s * k})`} opacity={ghost ? 0.9 : 1}><path d="M -130 0 L 130 0 L 100 44 L -100 44 Z" fill={ghost ? 'none' : hull} stroke={ghost ? '#F7F1DF' : INK} strokeWidth={7} strokeDasharray={ghost ? '16 12' : 'none'} /><rect x={-54} y={-40} width={88} height={40} fill={ghost ? 'none' : '#8995A0'} stroke={ghost ? '#F7F1DF' : INK} strokeWidth={6} strokeDasharray={ghost ? '12 10' : 'none'} /><rect x={-14} y={-76} width={26} height={36} fill={ghost ? 'none' : '#2B241D'} stroke={ghost ? '#F7F1DF' : INK} strokeWidth={5} strokeDasharray={ghost ? '10 8' : 'none'} /></g>);

// the cinema: the only other 'source' he had, a newsreel on a screen
const Newsreel = ({f, T}) => (
  <g>
    <rect x={-100} y={-100} width={SW + 200} height={SH + 200} fill="#1C1A22" />
    <g transform={`scale(${1 + clamp(f / 90, 0, 1) * 0.05})`}><rect x={90} y={250} width={900} height={640} rx={8} fill="#D9D5C8" {...st(9)} />
      <g transform="translate(540 570)"><path d="M -300 110 L -120 -40 L -20 40 L 130 -90 L 310 110 Z" fill="#8F8B7F" {...st(6)} /><rect x={-60} y={40} width={120} height={70} fill="#6F6B60" {...st(5)} /></g>
      <rect x={90} y={250} width={900} height={90} fill="#2B2A2E" /><text x={540} y={312} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={54} letterSpacing={6} fill="#F2EFE6">NEWS OF THE WEEK</text>
      {[...Array(5)].map((_, i) => <rect key={i} x={120 + ((f * 37 + i * 211) % 840)} y={350 + ((f * 13 + i * 97) % 520)} width={3} height={60} fill="#fff" opacity={0.3} />)}</g>
    <path d="M 540 1240 L 110 880 L 970 880 Z" fill="#FFF3C4" opacity={0.08} />
    {[[250, 1600, 1], [540, 1560, 1.25], [830, 1600, 1]].map(([x, y, k], i) => <g key={i} transform={`translate(${x} ${y}) scale(${k})`}><path d="M -150 330 C -150 170 -80 110 0 110 C 80 110 150 170 150 330 Z" fill={i === 1 ? '#3C4250' : '#2B2830'} /><circle r={112} fill={i === 1 ? '#5A3820' : '#37323C'} /></g>)}
  </g>
);

// 'told to go to Britain' -> a real map: Madrid, the arrow to Britain struck out, the arrow to Lisbon drawn
function ShotLisbon({f, line, T}) {
  const brit = cue(line, 'brit', 'Britain', 0.4), lis = cue(line, 'lis', 'Lisbon', 0.8), xat = cue(line, 'x', 'Lisbon', 0.7), mapAt = line.p && line.p.cue && line.p.cue.map ? at(line, line.p.cue.map, 0.2) : 0, ppd = 46, clon = -5, clat = 46.5;
  const sx = (lon) => SW / 2 + (lon - clon) * ppd, sy = (lat) => 640 - (lat - clat) * ppd * 1.3;
  if (f < mapAt - 2) {
    const k = spr((f + 6) / 30, 15, 0.7);
    return (<Cam x={540} y={880} z={eas(f, 0, mapAt, 1.02, 1.1)}><Room wall="#6E2620" wallD="#57201C" floor="#3C2A22" floorD="#2B1E18" fy={1120}><g /></Room>
      <Person x={200} y={1190} s={1.1} T={T} seed={3} expr="smug" look={1} armR={[lin(k, 0, 1, 12, 74), lin(k, 0, 1, -4, 74)]} />
      <Person x={800} y={1190} s={1.1} flip fit="german" T={T} seed={4} expr="stare" look={1} armR={[lin(k, 0, 1, 12, 74), lin(k, 0, 1, -4, 74)]} /></Cam>);
  }
  const M = [sx(-3.7), sy(40.4)], B = [sx(-1), sy(52)], L = [sx(-9.14), sy(38.72)], k1 = eas(f, Math.max(0, brit - 10), brit + 6, 0, 1), k2 = eas(f, lis - 8, lis + 8, 0, 1);
  return (
    <g>
      <rect width={SW} height={SH} fill="#1B2A3A" />
      <clipPath id="spyeu"><rect x={70} y={150} width={880} height={1000} /></clipPath>
      <g clipPath="url(#spyeu)"><rect x={70} y={150} width={880} height={1000} fill="#7FB4C4" /><g transform={`translate(${sx(-180)} ${sy(90)}) scale(${ppd / K} ${ppd * 1.3 / K})`}><path d={LAND} fill="#E2CF9C" stroke="#3B2B1E" strokeWidth={0.35} /></g></g>
      <rect x={70} y={150} width={880} height={1000} fill="none" stroke="#F2E6C8" strokeWidth={9} />
      <path d={`M ${M[0]} ${M[1]} L ${M[0] + (B[0] - M[0]) * k1} ${M[1] + (B[1] - M[1]) * k1}`} fill="none" stroke={f >= xat - 2 ? '#8A8F96' : '#C7301F'} strokeWidth={13} strokeDasharray="26 18" />
      {f >= xat - 2 && <path d={`M ${(M[0] + B[0]) / 2 - 44} ${(M[1] + B[1]) / 2 - 44} l 88 88 m 0 -88 l -88 88`} stroke="#C7301F" strokeWidth={16} strokeLinecap="round" />}
      <path d={`M ${M[0]} ${M[1]} L ${M[0] + (L[0] - M[0]) * k2} ${M[1] + (L[1] - M[1]) * k2}`} fill="none" stroke="#FDE047" strokeWidth={13} />
      {[[M, 'MADRID', 130, 16], [B, 'BRITAIN', 170, 16], [L, 'LISBON', -30, -36]].map(([q, t, dx, dy]) => <g key={t}><circle cx={q[0]} cy={q[1]} r={15} fill={INK} /><Tag x={q[0] + dx} y={q[1] + dy} text={t} size={42} fill={t === 'LISBON' && f >= lis - 2 ? '#FDE047' : '#fff'} /></g>)}
      <rect y={1270} width={SW} height={SH - 1270} fill="#C9A46B" />
      <Person x={270} y={1860} s={0.78} T={T} seed={3} expr={f >= lis ? 'smug' : 'calm'} look={1} lookY={-0.6} armR={[20, 10]} />
      <Person x={720} y={1860} s={0.78} flip fit="german" T={T} seed={4} expr="stare" look={1} lookY={-0.6} armR={[125, 125]} />
    </g>
  );
}
// the Glasgow line: his report, then a pint against a litre, the officer stamps it anyway
function ShotWine({f, line, T}) {
  const pint = cue(line, 'pint', 'pint', 0.55), ok = cue(line, 'ok', 'trusting', 0.8), rep = cue(line, 'wine', 'wine', 0.35), l1 = cue(line, 'l1', 'contact', 0.1), l2 = cue(line, 'l2', 'would', 0.2);
  if (f >= ok - 2) {
    return (
      <g><Room wall="#6E2620" wallD="#57201C" floor="#3C2A22" floorD="#2B1E18" fy={1060}></Room>
        <path d="M 60 1030 L 1020 1030 L 1060 1140 L 20 1140 Z" fill="#7A4A2A" {...st(8)} />
        <Person x={540} y={1120} s={0.98} fit="german" T={T} seed={4} expr="smug" lookY={0.8} armR={[60, 74]} armL={[-60, -74]} />
        <path d="M 60 1030 L 1020 1030 L 1060 1140 L 20 1140 Z" fill="#7A4A2A" {...st(8)} />
        <g transform="rotate(-3 540 1000)"><rect x={280} y={890} width={520} height={190} fill="#F3EBD6" {...st(7)} /><text x={540} y={960} textAnchor="middle" fontFamily={OSW} fontWeight={600} fontSize={44} fill={INK}>GLASGOW REPORT</text></g>
        <Stamp text="EXCELLENT" f={f} a={ok + 4} x={540} y={1050} rot={-6} size={60} color="#2E7D32" k0={0.2} plate /></g>
    );
  }
  if (f >= pint - 3) {
    return (
      <g><rect x={-100} y={-100} width={SW + 200} height={SH + 200} fill="#5A3417" />{[...Array(5)].map((_, i) => <rect key={i} x={-100} y={i * 240} width={SW + 200} height={110} fill="#4B2B13" opacity={0.6} />)}
        <rect x={-100} y={1040} width={SW + 200} height={500} fill="#7A4A2A" {...st(8)} />
        <g transform={`translate(330 1040) scale(${clamp(pop(f, pint - 3, 16, 0.6), 0.6, 1.1)})`}><path d="M -105 -430 L 105 -430 L 82 0 L -82 0 Z" fill="#D9892B" {...st(9)} /><path d="M -112 -430 C -120 -500 120 -500 112 -430 Z" fill="#FBF7EE" {...st(8)} /><rect x={105} y={-330} width={55} height={190} rx={26} fill="none" {...st(13)} /></g>
        <g transform={`translate(760 1040) rotate(4) scale(${clamp(pop(f, pint + 3, 16, 0.6), 0.6, 1.1)})`}><path d="M -70 0 L 70 0 L 70 -300 C 70 -360 28 -380 28 -440 L 28 -520 L -28 -520 L -28 -440 C -28 -380 -70 -360 -70 -300 Z" fill="#5B1E2D" {...st(9)} /><rect x={-58} y={-230} width={116} height={130} fill="#F3EBD6" {...st(5)} /><text y={-152} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={46} fill={INK}>1 L</text>
          </g>
        <Tag x={330} y={460} text="PINT" size={78} fill="#FDE047" k={clamp(pop(f, pint - 1, 16, 0.6), 0.7, 1.15)} />
        <Tag x={760} y={400} text="LITRE" size={78} k={clamp(pop(f, pint + 3, 16, 0.6), 0.7, 1.15)} />
        {f >= pint + 8 && <path d={`M 620 ${342 + eas(f, pint + 8, pint + 13, 0, 66)} L ${620 + eas(f, pint + 8, pint + 13, 0, 280)} ${408 - eas(f, pint + 8, pint + 13, 0, 66) + 0}`} stroke="#C7301F" strokeWidth={18} strokeLinecap="round" />}
        <Tag x={540} y={210} text="BRITAIN IN THE 1940s" size={48} /></g>
    );
  }
  return (
    <g><rect x={-100} y={-100} width={SW + 200} height={SH + 200} fill="#C97B3A" />
      <g transform={`rotate(-2 540 680) scale(${eas(f, 0, 90, 1, 1.05)})`}><rect x={120} y={190} width={840} height={960} fill="#F3EBD6" {...st(9)} />
        <text x={540} y={300} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={64} letterSpacing={6} fill={INK}>SECRET REPORT</text><path d="M 190 340 L 890 340" {...st(6)} />
        {['MY CONTACT IN GLASGOW', 'WOULD DO ANYTHING'].map((t, i) => <text key={t} x={180} y={450 + i * 96} fontFamily="'Courier New', monospace" fontWeight={700} fontSize={58} fill={INK}>{t.slice(0, Math.floor(clamp(f - (i ? l2 : 1) + 2, 0, 40) * 1.6))}</text>)}
        <text x={180} y={642} fontFamily="'Courier New', monospace" fontWeight={700} fontSize={58} fill="#C7301F">{'FOR A LITRE OF WINE'.slice(0, Math.floor(clamp(f - rep + 2, 0, 40) * 1.6))}</text></g></g>
  );
}
// a convoy that exists only on paper: dashed ghost ships; the German navy steams after them
function ShotConvoy({f, line, T}) {
  const brit = cue(line, 'brit', 'suddenly', 0.65), ghost = cue(line, 'ghost', 'convoy', 0.35), navy = cue(line, 'navy', 'navy', 0.25);
  if (f >= brit - 3) {
    const k = spr((f - brit + 3) / 30, 13, 0.75);
    return (
      <Cam x={540} y={880} z={eas(f, brit, brit + 50, 1.02, 1.1)}><Room wall="#27477F" wallD="#1E3966" floor="#8A5A34" floorD="#6F4728" fy={1120}><g transform="translate(540 430)"><path d="M -220 -170 L 220 170 M 220 -170 L -220 170" stroke="#fff" strokeWidth={60} /><path d="M -220 -170 L 220 170 M 220 -170 L -220 170" stroke="#C8102E" strokeWidth={26} /><path d="M 0 -170 L 0 170 M -220 0 L 220 0" stroke="#fff" strokeWidth={100} /><path d="M 0 -170 L 0 170 M -220 0 L 220 0" stroke="#C8102E" strokeWidth={60} /></g></Room>
        <Person x={230} y={1190} s={1.05} T={T} seed={3} expr="smug" look={1} armR={[lin(k, 0, 1, 12, 70), lin(k, 0, 1, -4, 76)]} />
        <Person x={800 + (1 - k) * 500} y={1190} s={1.05} flip fit="british" T={T} seed={7} expr="hopeful" look={1} walk={1 - k} armR={[lin(k, 0, 1, 12, 70), lin(k, 0, 1, -4, 76)]} /></Cam>
    );
  }
  const go = eas(f, navy - 8, ghost + 30, 0, 1);
  if (f < navy - 8) {
    return (<g><Sea /><g transform={`rotate(-3 540 700) scale(${eas(f, 0, navy, 1, 1.06)})`}><rect x={170} y={260} width={740} height={760} fill="#F3EBD6" {...st(9)} />
      <text x={540} y={370} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={60} letterSpacing={5} fill={INK}>SECRET REPORT</text><path d="M 230 410 L 850 410" {...st(6)} />
      {['BIG BRITISH CONVOY', 'SAILING NOW'].map((t, i) => <text key={t} x={225} y={520 + i * 92} fontFamily="'Courier New', monospace" fontWeight={700} fontSize={56} fill={INK}>{t.slice(0, Math.floor(clamp(f - i * 12, 0, 40) * 1.6))}</text>)}
      {f >= 34 && <Stamp text="MADE UP" f={f} a={34} x={540} y={820} rot={-8} size={92} k0={0.3} />}</g></g>);
  }
  return (
    <Sea><g transform={`translate(${-go * 120} ${-go * 40}) scale(${1 + go * 0.08})`}>
      {[[640, 420], [860, 620], [600, 760]].map(([x, y], i) => <Ship key={i} x={x + 20 * Math.sin(T * 0.03 + i)} y={y} s={0.95} ghost k={clamp(pop(f, ghost + i * 3, 16, 0.6), 0, 1.1)} />)}
      {[[120, 520], [40, 860], [230, 1020]].map(([x, y], i) => <g key={i}><path d={`M ${x + go * 420 - 130} ${y + 30} L ${x + go * 420 - 340 - go * 120} ${y + 8} L ${x + go * 420 - 340 - go * 120} ${y + 52} Z`} fill="#FFFFFF" opacity={0.22 + go * 0.2} /><Ship x={x + go * 420} y={y + Math.sin(T * 0.05 + i) * 6} s={1.05} hull="#3C4650" /></g>)}
      {f >= ghost + 8 && <Tag x={700} y={240} text="DOESN'T EXIST" size={56} fill="#FDE047" k={clamp(pop(f, ghost + 8, 18, 0.6), 0.7, 1.15)} />}
      <Tag x={270} y={1180} text="GERMAN NAVY" size={50} />
    </g></Sea>
  );
}
// the two medals, each on its own words; 'in secret' closes the British one in a box
function ShotMedals2({f, line, T}) {
  const a = cue(line, 'iron', 'Iron', 0.2), b = cue(line, 'mbe', 'MBE', 0.65), sec = cue(line, 'sec', 'secret', 0.85), king = cue(line, 'king', 'King', 0.5);
  if (f < king - 6) return <Telegram f={f} />;
  const pin = (q) => (f < q ? 0 : clamp(pop(f, q, 20, 0.55), 0, 1.2)), ic = f >= king - 6 ? 1 : 0;
  return (
    <g><Cam x={495} y={1000} z={eas(f, 0, sec, 2.35, 2.6)}><Room wall="#27477F" wallD="#1E3966" floor="#8A5A34" floorD="#6F4728" />
      <Person x={495} y={1340} s={1} T={T} seed={3} expr={f >= sec ? 'wink' : 'smug'} look={0.3} medals={[ic, pin(b)]} /></Cam>
      {f >= b - 2 && f < sec && <Tag x={540} y={210} text="FROM THE KING" size={60} k={clamp(pop(f, b - 2, 18, 0.6), 0.7, 1.15)} />}
      <Stamp text="SECRET" f={f} a={sec} x={520} y={150} rot={-6} size={84} k0={0.3} plate /></g>
  );
}
// the payoff: both officers hold their medals up; the British one is holding the script
function ShotEnd({f, line, T}) {
  const w = cue(line, 'write', 'write', 0.85), k = eas(f, w - 10, w + 2, 0, 1), only = cue(line, 'only', 'only', 0.5), mv = eas(f, only - 8, only + 10, 0, 1);
  return (
    <Cam x={540 + mv * 120} y={880 - mv * 40} z={1.02 + mv * 0.42}><Room wall="#27477F" wallD="#1E3966" floor="#8A5A34" floorD="#6F4728" />
      {mv < 0.4 && <Person x={208} y={1320} s={0.88} fit="german" T={T} seed={4} expr="hopeful" look={1} armR={[60, 40]} />}
      <Person x={495} y={1340} s={1} T={T} seed={3} expr={f >= w ? 'wink' : 'smug'} look={0.5} medals={[1, 1]} />
      <Person x={781} y={1320} s={0.88} flip fit="british" T={T} seed={7} expr={f >= w ? 'wink' : 'calm'} look={1} armR={[lin(k, 0, 1, 14, 150), lin(k, 0, 1, -4, 20)]} />
      {k > 0 && <g transform={`translate(885 ${900 - 260 * k}) rotate(6) scale(${0.6 + 0.4 * k})`}><rect x={-110} y={-140} width={220} height={280} fill="#F3EBD6" {...st(7)} /><text y={-70} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={38} fill={INK}>THE LIE</text><text y={-22} textAnchor="middle" fontFamily={OSW} fontWeight={600} fontSize={28} fill="#5B5145">BY MI5 + GARBO</text>{[20, 60, 100].map((y) => <path key={y} d={`M -80 ${y} L 80 ${y}`} stroke="#A9A087" strokeWidth={6} />)}</g>}
    </Cam>
  );
}
const SHOTS = {s_farm: ShotFarm, s_plan: ShotPlan, s_double: ShotDouble, s_turn: ShotTurn, s_beach: ShotBeach, s_lisbon: ShotLisbon, s_wine: ShotWine, s_convoy: ShotConvoy, s_medals2: ShotMedals2, s_end: ShotEnd, s_medals: ShotMedals, s_rejected: ShotRejected, s_guide: ShotGuide, s_agents: ShotAgents, s_map: ShotMap};

// captions: two or three bold words at a time, no box, the spoken word yellow, clear of the Shorts buttons
const Caps = ({lines}) => {
  const f = useCurrentFrame();
  const l = lines.find((x, i) => f >= x.cut && (i + 1 >= lines.length || f < lines[i + 1].cut));
  if (!l || !(l.words || []).length || (l.p && l.p.nocap)) return null;
  if (l === lines[0] && f < l.words[0][1] - 1) return null;
  let at0 = 0;
  const groups = (l.p && l.p.caps || []).map((n) => { const x = l.words.slice(at0, at0 + n); at0 += n; return x; });
  if (at0 < l.words.length) groups.push(l.words.slice(at0));
  const g = groups.filter((x) => x.length).reduce((cur, x) => (x[0][1] <= f + 1 ? x : cur), groups[0]);
  const now = g.reduce((a, w, i) => (w[1] <= f ? i : a), 0), bump = 1 + 0.06 * Math.exp(-Math.max(0, f - g[0][1]) * 0.35);
  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: (l.p && l.p.capy) || 1350, paddingRight: 110}}>
      <div style={{transform: `scale(${bump})`, maxWidth: 860, textAlign: 'center', fontFamily: NUN, fontWeight: 900, fontSize: 84, lineHeight: 1.08, textTransform: 'uppercase', WebkitTextStroke: '16px #17110C', paintOrder: 'stroke fill'}}>
        {g.map((w, i) => <span key={i} style={{display: 'inline-block', whiteSpace: 'nowrap', color: i === now ? '#FDE047' : '#FFFFFF', marginRight: i + 1 < g.length ? 22 : 0}}>{w[0].replace(/[.,:;]$/, '')}</span>)}
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
