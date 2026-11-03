// shortkit.jsx: the parts of the spy Short (spy.jsx, composition SpyShort) that a new Short needs, in one file you can import.
// spy.jsx keeps these private, so they are copied here unchanged. Two additions: `fit` may be an object (a new costume without
// touching FITS), and a line's p.photo shows a real picture as a print over the cartoon (PrintLayer).
// Coordinates are the 1080x1920 stage; the render's --scale=2 gives 2160x3840. Keep the middle at x 540.
import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {at, clamp} from './tis';
import {FONT_CSS} from './fonts';
import {Limb, arm, Face, INK, SKIN, SHADE, st, pop, spr, eas, lin} from './rome';

export {at, clamp, Limb, arm, Face, INK, SKIN, SHADE, st, pop, spr, eas, lin};
export const SW = 1080, SH = 1920;
export const NUN = "'Nunito', 'Arial Rounded MT Bold', sans-serif", OSW = "'Oswald', sans-serif";
// a word's frame inside its line: p.cue[key] names the spoken word, `word` is the default, frac the fallback share of the line
export const cue = (line, key, word, frac) => at(line, (line.p && line.p.cue && line.p.cue[key]) || word, frac);

// Check every historical figure at thumbnail size: a dark fringe, a small moustache and German banners read as Hitler (our first spy did).
export const FITS = {
  garbo: {coat: '#3C4250', coatD: '#2C313C', legs: '#2C313C', hair: '#5A3820', bow: '#D23B2B'},
  german: {coat: '#6F7A63', coatD: '#566050', legs: '#4E5747', cap: '#5F6A55', band: '#2C3327', piping: '#C23B2E', belt: true},
  handler: {coat: '#6B6F76', coatD: '#54585F', legs: '#3F4247', hair: '#2B241D', tie: '#7A2A2A'},
  british: {coat: '#B0935C', coatD: '#8F7648', legs: '#8F7648', cap: '#A58952', band: '#6A3024', tie: '#6E5A36', moustache: true},
};

/** A person, feet at y 0, about 700 units tall. fit = a FITS name or an object of the same shape. `extra` draws on the chest, `headExtra` over the head (a helmet). */
export const Person = ({x = 0, y = 0, s = 1, flip = false, fit = 'garbo', expr = 'calm', look = 0, lookY = 0, armR = [12, -4], armL = [-12, 4], T = 0, seed = 1, tilt = 0, lean = 0, sq = 1, shadow = true, extra = null, headExtra = null, held = null, walk = 0}) => {
  const F = typeof fit === 'string' ? FITS[fit] : fit, b = Math.sin(T * 0.09 + seed * 1.7) * 3.2 - Math.abs(Math.sin(T * 0.42)) * 16 * walk;
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
          {extra}
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
          {headExtra}
        </g>
      </g>
    </g>
  );
};
// a room: wall, floor, skirting; the place's own colour, crisp
export const Room = ({wall, wallD, floor, floorD, fy = 1140, children}) => (
  <g>
    <rect x={-300} y={-300} width={SW + 600} height={fy + 300} fill={wall} />
    {[...Array(9)].map((_, i) => <rect key={i} x={-200 + i * 180} y={-300} width={90} height={fy + 300} fill={wallD} opacity={0.35} />)}
    {children}
    <rect x={-300} y={fy} width={SW + 600} height={26} fill={wallD} {...st(5)} />
    <rect x={-300} y={fy + 26} width={SW + 600} height={SH - fy + 300} fill={floor} />
    {[...Array(7)].map((_, i) => <path key={i} d={`M ${-200 + i * 240} ${fy + 26} L ${-420 + i * 320} ${SH + 40}`} stroke={floorD} strokeWidth={5} />)}
  </g>
);
export const Cam = ({x = SW / 2, y = SH / 2, z = 1, children}) => <g transform={`translate(${SW / 2} ${SH / 2}) scale(${z}) translate(${-x} ${-y})`}>{children}</g>;
export const Stamp = ({text, f, a, x, y, rot = -12, size = 92, color = '#C7301F', k0 = 1.3, plate = false}) => { if (f < a) return null; const k = 1 + k0 * Math.exp(-(f - a) * 0.75);
  return (<g transform={`translate(${x} ${y}) rotate(${rot}) scale(${k})`} opacity={clamp((f - a + 1) / 2, 0, 1)}><rect x={-text.length * size * 0.36 - 22} y={-size * 0.82} width={text.length * size * 0.72 + 44} height={size * 1.2} rx={10} fill={plate ? '#F7F1DF' : 'none'} stroke={color} strokeWidth={10} />
    <text textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={size} letterSpacing={4} fill={color}>{text}</text></g>); };
export const Tag = ({x, y, text, k = 1, size = 54, fill = '#FFFFFF', color = INK}) => (<g transform={`translate(${x} ${y}) rotate(-2) scale(${k})`}><rect x={-text.length * size * 0.31 - 24} y={-size * 0.96} width={text.length * size * 0.62 + 48} height={size * 1.36} rx={12} fill={fill} {...st(7)} /><text textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={size} letterSpacing={2} fill={color}>{text}</text></g>);
export const tagIn = (f, a) => clamp(pop(f, a, 18, 0.6), 0.7, 1.15);   // a tag readable from its first frame

// captions: two or three bold words at a time, no box, the spoken word yellow, centred on x 540 (p.caps = words per chunk, p.capy = height, p.nocap = none)
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
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: (l.p && l.p.capy) || 1350, paddingRight: 0}}>
      <div style={{transform: `scale(${bump})`, maxWidth: 860, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 22, textAlign: 'center', fontFamily: NUN, fontWeight: 900, fontSize: 84, lineHeight: 1.08, textTransform: 'uppercase', WebkitTextStroke: '16px #17110C', paintOrder: 'stroke fill'}}>
        {g.map((w, i) => <span key={i} style={{whiteSpace: 'nowrap', color: i === now ? '#FDE047' : '#FFFFFF'}}>{w[0].replace(/[.,:;]$/, '')}</span>)}
      </div>
    </AbsoluteFill>
  );
};
// a real picture as a framed print over the cartoon. p.photo = {src: "photos/x.jpg", on: "word", off: "word", x, y, w, h, rot, cap, credit}.
// Pictures go in content/project-5/photos/ (create it), public domain or CC BY only. story_sample and stills_one_bundle copy them into the app.
// photos/credits.json = {"file.jpg": {"title": ..., "source": ..., "licence": ..., "author": ..., "credit": "the line for the description"}}: an entry without `credit` is skipped silently.
const PrintLayer = ({line, f}) => {
  const P = line.p && line.p.photo;
  if (!P) return null;
  const a = P.on ? at(line, P.on, 0.1) : 0, b = P.off ? at(line, P.off, 1) : 1e9;
  if (f < a || f >= b) return null;
  const k = 0.86 + 0.14 * clamp(pop(f, a, 16, 0.65), 0, 1.1), w = P.w || 860, h = P.h || 620, push = 1 + clamp((f - a) / 150, 0, 1) * 0.05;
  return (
    <AbsoluteFill><div style={{position: 'absolute', left: (P.x === undefined ? 540 : P.x) - w / 2 - 14, top: P.y === undefined ? 300 : P.y, width: w, background: '#F7F1DF', border: `6px solid ${INK}`, padding: 8, transform: `rotate(${P.rot === undefined ? -1.5 : P.rot}deg) scale(${k})`}}>
      <div style={{width: w, height: h, overflow: 'hidden'}}><Img src={staticFile(P.src)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${push})`}} /></div>
      {(P.cap || P.credit) && <div style={{fontFamily: OSW, fontSize: 30, color: INK, padding: '8px 4px 2px', textAlign: 'center'}}>{P.cap || ''}{P.cap && P.credit ? ' · ' : ''}{P.credit || ''}</div>}
    </div></AbsoluteFill>
  );
};
const Shot = ({line, len, SHOTS}) => {
  const f = useCurrentFrame(), S = SHOTS[line.shot] || Object.values(SHOTS)[0];
  return <AbsoluteFill><svg width="100%" height="100%" viewBox={`0 0 ${SW} ${SH}`} style={{position: 'absolute', inset: 0}}><S f={f} len={len} line={line} T={line.cut + f} /></svg><PrintLayer line={line} f={f} /></AbsoluteFill>;
};
/** The composition for a new Short: makeShort({k_open: ShotOpen, ...}). */
export const makeShort = (SHOTS) => ({lines = [], frames = 450, captions = true}) => (
  <AbsoluteFill style={{backgroundColor: '#111'}}>
    <style>{FONT_CSS}</style>
    {lines.map((l, i) => { const to = i + 1 < lines.length ? lines[i + 1].cut : frames;
      return <Sequence key={i} from={l.cut} durationInFrames={Math.max(1, to - l.cut)} layout="none"><Shot line={{...l, start: l.cut}} len={to - l.cut} SHOTS={SHOTS} /></Sequence>; })}
    {captions && <Caps lines={lines} />}
  </AbsoluteFill>
);
