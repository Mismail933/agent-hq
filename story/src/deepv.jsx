// Storygraphics: the "deep" look as a native vertical Short (2.76.0). The owner (2026-10-29 14:35) on the deep sample: "this could be
// our Short". Israa (redo 5.5) on the first cut, the wide picture in a strip with blurred bands: "this is not a Short ... rebuild it as a
// real vertical composition". Here every deep.jsx shot is drawn through its own 9:16 window of the wide stage (VCAM: the subject fills
// the phone; line.vert = true makes the shots' backgrounds reach past the stage and leaves their type to this file), and all the type is
// laid out for the phone: big words stacked, tags split into rows at 40 px, the depth bar across the top, the numbers in the middle,
// the cross-section stood up tall with its labels clear of the captions (y ~1330) and of the buttons (x > 950 at 45-85% height).
// The real footage is cropped to 9:16 around its subject (footage vfocus). Line 18 ('dv_end') is the end card that says its own words.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, useCurrentFrame, staticFile, OffthreadVideo, Easing} from 'remotion';
import {W, H, clamp, at, OSWALD} from './tis';
import {DEEP_SHOTS, Defs, Sea, DeepSpecks, Glow, sp, lerp as L, NUN, fmt, vstart} from './deep';
import {YSub} from './trench2';
import {VCaptions} from './trench';
import {FONT_CSS} from './fonts';

export const DW = 1080, DH = 1920;
const P = (line) => line.p || {};
// the window of the wide stage each shot is seen through: [centre x, centre y, width] (height = width x 16/9)
const VCAM = {dp_float: [880, 420, 780], dp_yank: [900, 515, 800], dp_sink: [800, 560, 960], dp_snow: [1100, 620, 1300],
  dp_close: [820, 500, 1400], dp_sub: [960, 717, 940], dp_title: [960, 740, 1000]};
// the cross-section stands up tall: x 1:1, y stretched 1.27 (a mild vertical exaggeration), the surface at y 300, the floor at y 1150
const SEC = {x0: 420, y0: -106.4, sy: 1.269};
const secX = (x) => x - SEC.x0, secY = (y) => (y - SEC.y0) * SEC.sy;
const SY = 130, FL = 800, KMP = (FL - SY) / 11, EV = 8.85 * KMP;

const halo = {stroke: '#02101A', strokeOpacity: 0.62, paintOrder: 'stroke', strokeLinejoin: 'round'};
// big rounded words, one row each, popping on their own words (heavy spring); p.big rows, or given rows
const Rows = ({f, line, rows, y, size = 150, gap = 1.02, x = DW / 2, off = null, always = false}) => {
  const end = off != null ? at(line, off, 1) + 6 : 1e9;
  const out = clamp((f - end) / 8, 0, 1);
  if (out >= 1) return null;
  return (
    <g opacity={1 - out} filter="url(#vsoft)">
      {rows.map((r, i) => {
        const a = always ? -99 : at(line, r.with || r.on, 0.1) - 3 + (r.with ? 4 * i : 0), k = clamp(sp(f, a, 'heavy'), 0, 1.1);
        if (f < a - 1) return null;
        const sz = r.size || size, w = String(r.t).length * sz * 0.66;
        return <text key={i} x={x} y={y + i * sz * gap + (1 - k) * 30} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={sz} letterSpacing={-1}
          fill={r.color || '#FFFFFF'} opacity={clamp((f - a) / 5, 0, 1)} style={{textTransform: 'uppercase'}} {...halo} strokeWidth={r.color ? 16 : 10} strokeOpacity={r.color ? 0.85 : 0.62}
          {...(w > DW - 90 ? {textLength: DW - 90, lengthAdjust: 'spacingAndGlyphs'} : {})}>{r.t}</text>;
      })}
    </g>
  );
};
// a label split into rows at ' · ' (40 px spaced caps, a gold rule above the first row), stacked up from y (the last row's baseline)
const VTag = ({f, a = 0, b = 1e9, x = 60, y = 1250, text, size = 40, anchor = 'start', color = '#FFFFFF', plate = false}) => {
  const k = clamp((f - a) / 10, 0, 1) * (1 - clamp((f - b) / 8, 0, 1));
  if (k <= 0) return null;
  const rows = String(text).toUpperCase().split(/\s+·\s+/);
  const top = y - (rows.length - 1) * size * 1.25;
  const w0 = rows[0].length * size * 0.62 + (rows[0].length - 1) * 7;
  const x0 = anchor === 'middle' ? x - w0 / 2 : anchor === 'end' ? x - w0 : x;
  const wmax = Math.max(...rows.map((r) => r.length * size * 0.62 + (r.length - 1) * 7));
  return (
    <g opacity={k}>
      {plate && <rect x={(anchor === 'middle' ? x - wmax / 2 : anchor === 'end' ? x - wmax : x) - 22} y={top - size - 34} width={wmax + 44} height={(rows.length - 1) * size * 1.25 + size + 58} rx={16} fill="#02101A" opacity={0.55} />}
      <path d={`M ${x0} ${top - size - 16} l ${80 * k} 0`} stroke="#FFD25A" strokeWidth={5} />
      {rows.map((r, i) => <text key={i} x={x + (1 - k) * -14} y={top + i * size * 1.25} textAnchor={anchor} fontFamily={OSWALD} fontWeight={600} fontSize={size}
        fill={color} letterSpacing={7} {...halo} strokeWidth={8}>{r}</text>)}
    </g>
  );
};
// the depth bar across the top of the phone (under the Shorts top bar)
const VBar = ({f, d, a = 0, op = 1, y = 250, x0 = 120, x1 = 960, value = true, max = 11000}) => {
  const k = clamp((f - a) / 12, 0, 1) * op;
  if (k <= 0) return null;
  const xm = x0 + (x1 - x0) * clamp(d / max, 0, 1);
  return (
    <g opacity={k}>
      <text x={x0} y={y - 26} fontFamily={OSWALD} fontWeight={600} fontSize={34} fill="#FFFFFF" letterSpacing={9} {...halo} strokeWidth={7}>DEPTH</text>
      {value !== false && <text x={x1} y={y - 26} textAnchor="end" fontFamily={OSWALD} fontWeight={600} fontSize={40} fill="#FFFFFF" letterSpacing={4} {...halo} strokeWidth={7}>{fmt(d)} M</text>}
      <rect x={x0} y={y - 4} width={x1 - x0} height={8} rx={4} fill="#FFFFFF" opacity={0.2} />
      <rect x={x0} y={y - 4} width={xm - x0} height={8} rx={4} fill="#FFC23D" />
      <circle cx={xm} cy={y} r={13} fill="#FFE08A" /><circle cx={xm} cy={y} r={30} fill="#FFC23D" opacity={0.25} />
    </g>
  );
};
const BigNum = ({f, a, text, y = 620, out = 0}) => {
  const k = clamp(sp(f, a - 2, 'heavy'), 0, 1.1);
  return <text x={DW / 2} y={y + (1 - k) * 30} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={170} fill="#FFFFFF" filter="url(#vsoft)"
    opacity={clamp((f - a + 4) / 9, 0, 1) * (1 - out)} {...halo} strokeWidth={10}>{text}</text>;
};
const VCredit = ({text}) => text ? <text x={50} y={150} fontFamily={OSWALD} fontWeight={500} fontSize={24} fill="#FFFFFF" opacity={0.8} letterSpacing={4}
  style={{textTransform: 'uppercase'}} {...halo} strokeWidth={5}>{text}</text> : null;
// the marks a line counts through (spoken depths): the depth now, and which mark is up
const marksOf = (line, f) => {
  const p = P(line), mk = (p.marks || []).map(([w, m]) => [at(line, w, 0.5), m]);
  let d = p.from != null ? p.from : 1000;
  if (p.to != null && !mk.length) d = L(f, 0, line.end - line.start, d, p.to, (x) => x);
  for (const [a, m] of mk) d = d + (m - d) * L(f, a - 6, a, 0, 1);
  const k = mk.findIndex(([a]) => f < a);
  return {d, mk, cur: k < 0 ? mk.length - 1 : k - 1};
};

// ───────────── the type of each shot, laid out for the phone ─────────────
function TypeOf({f, len, line, first}) {
  const p = P(line), shot = line.shot, v = p.footage || {};
  const big = (Array.isArray(p.big) ? p.big : []).map((b) => ({...b}));
  if (shot === 'dp_float') {
    const pac = at(line, p.pac || 'pacific', 0.5), eyes = at(line, p.eyes || 'eyes', 0.75);
    return (
      <g>
        {/* the hook: the title is up from frame 1 while the shadow already waits below */}
        {first && <g opacity={1 - clamp((f - pac - 10) / 10, 0, 1)} filter="url(#vsoft)">
          <text x={DW / 2 - 40} y={250} textAnchor="end" fontFamily={NUN} fontWeight={900} fontSize={150} fill="#FFFFFF" {...halo} strokeWidth={10}>YOU</text>
          <text x={DW / 2} y={222} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={56} fill="#FFC23D" {...halo} strokeWidth={8}>VS</text>
          <text x={DW / 2 + 40} y={250} fontFamily={NUN} fontWeight={900} fontSize={150} fill="#FFC23D" {...halo} strokeWidth={10}>11 KM</text>
        </g>}
        {big.length > 0 && <Rows f={f} line={line} rows={big} y={1080} size={170} off={p.big_off} always={first} />}
        {p.tag && <VTag f={f} a={at(line, p.tag_on || '', 0.4)} b={eyes - 6} text={p.tag} y={1250} />}
      </g>
    );
  }
  if (shot === 'dp_real') {
    const flash = p.flash ? clamp(1 - (f - 8) / 9, 0, 1) * (f >= 8 ? 1 : f / 8) : 0;
    const M = p.marks ? marksOf(line, f) : null;
    return (
      <g>
        <VCredit text={v.credit} />
        {big.length > 0 && <Rows f={f} line={line} rows={big} y={p.vbig_y || 820} size={p.vbig_size || 160} off={p.big_off} />}
        {p.tag && <VTag f={f} a={at(line, p.tag_on || '', 0.2)} text={p.tag} plate />}
        {M && <VBar f={f} d={M.d} />}
        {M && M.cur >= 0 && <BigNum f={f} a={M.mk[M.cur][0]} text={`${fmt(M.mk[M.cur][1])} M`} y={760} />}
        {flash > 0 && <g style={{mixBlendMode: 'screen'}}><radialGradient id={`vfl-${line.idx}`}><stop offset="0" stopColor="#FFFFFF" stopOpacity={1} /><stop offset="0.25" stopColor="#FFF4D6" stopOpacity={0.85} /><stop offset="1" stopColor="#FFD98A" stopOpacity={0} /></radialGradient>
          <circle cx={DW / 2} cy={800} r={300 + Math.min(f, 8) * 160} fill={`url(#vfl-${line.idx})`} opacity={flash} /></g>}
        {p.pin && (() => { const a = at(line, p.pin.on || '', 0.3), k = sp(f, a, 'bounce'); if (f < a) return null; const ring = ((f - a) % 40) / 40;
          return <g><circle cx={DW / 2} cy={DH / 2} r={22 + ring * 80} fill="none" stroke="#FFC23D" strokeWidth={6} opacity={1 - ring} />
            <circle cx={DW / 2} cy={DH / 2} r={17 * clamp(k, 0, 1.3)} fill="#FFC23D" stroke="#FFFFFF" strokeWidth={5} />
            {p.pin.label && <VTag f={f} a={a + 6} x={DW / 2} y={DH / 2 + 110} text={p.pin.label} anchor="middle" size={40} plate />}</g>; })()}
      </g>
    );
  }
  if (shot === 'dp_sink') {
    const M = marksOf(line, f);
    const numOut = p.num_off ? clamp((f - at(line, p.num_off, 0.4) - 6) / 10, 0, 1) : 0;
    return <g><VBar f={f} d={M.d} />{M.cur >= 0 && <BigNum f={f} a={M.mk[M.cur][0]} text={`${fmt(M.mk[M.cur][1])} M`} y={p.vnum_y || 470} out={numOut} />}</g>;
  }
  if (shot === 'dp_snow') {
    const open = at(line, p.open || 'bits', 0.1), poop = at(line, p.poop || 'poop', 0.5), fun = at(line, p.fun || 'fun', 0.75);
    const kk = clamp(sp(f, fun - 3, 'bounce'), 0, 1.2);
    return (
      <g>
        {f >= open + 6 && <text x={DW / 2} y={500} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={88} fill="#FFFFFF" opacity={clamp((f - open - 6) / 6, 0, 1)} filter="url(#vsoft)" {...halo} strokeWidth={9}>DEAD PLANKTON</text>}
        {f >= poop - 3 && <text x={DW / 2} y={1225} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={96} fill="#FFC23D" opacity={clamp((f - poop + 3) / 6, 0, 1)} filter="url(#vsoft)" {...halo} strokeWidth={9}>FISH POOP</text>}
        {f >= fun - 3 && <g transform={`translate(${DW / 2} 255) scale(${kk * 0.72})`} opacity={clamp(kk, 0, 1)}>
          {[0, 60, 120].map((a) => <path key={a} d="M 0 -90 L 0 90 M -22 -62 L 0 -40 L 22 -62 M -22 62 L 0 40 L 22 62" stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" fill="none" transform={`rotate(${a})`} />)}
          <circle r={128} fill="none" stroke="#FF5A4E" strokeWidth={18} /><path d="M -90 90 L 90 -90" stroke="#FF5A4E" strokeWidth={18} strokeLinecap="round" /></g>}
      </g>
    );
  }
  if (shot === 'dp_section') {
    const drop = at(line, p.drop || 'dropped', 0.35), two = at(line, p.two || 'two', 0.7);
    const k2 = clamp(sp(f, two, 'card'), 0, 1), peak = secY(FL - EV), sx = secX(960 + 135);
    const pulse = 0.5 + 0.5 * Math.sin(f * 0.15), you = [secX(660), secY(SY + 6.3 * KMP)];
    return (
      <g>
        <text x={you[0]} y={you[1] - 40} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={38} fill="#FFE08A" letterSpacing={6} {...halo} strokeWidth={7}>YOU · 6,000 M</text>
        <circle cx={you[0]} cy={you[1]} r={11} fill="#FFE08A" opacity={pulse} /><circle cx={you[0]} cy={you[1]} r={26} fill="#FFC23D" opacity={0.25 * pulse} />
        {k2 > 0.01 && <g opacity={k2}>
          <path d={`M ${sx - 18} ${secY(SY) + 6} L ${sx} ${secY(SY) + 6} L ${sx} ${secY(SY) + 6 + (peak - secY(SY) - 12) * k2} L ${sx - 18} ${secY(SY) + 6 + (peak - secY(SY) - 12) * k2}`} fill="none" stroke="#FFC23D" strokeWidth={6} />
          <text x={sx + 34} y={(secY(SY) + peak) / 2 + 30} fontFamily={NUN} fontWeight={900} fontSize={120} fill="#FFFFFF" filter="url(#vsoft)" {...halo} strokeWidth={10}>2 KM</text>
          <text x={DW - 50} y={(secY(SY) + peak) / 2 + 84} textAnchor="end" fontFamily={OSWALD} fontWeight={600} fontSize={34} fill="#FFFFFF" letterSpacing={5} {...halo} strokeWidth={7}>OF WATER</text>
          <text x={DW - 50} y={(secY(SY) + peak) / 2 + 126} textAnchor="end" fontFamily={OSWALD} fontWeight={600} fontSize={34} fill="#FFFFFF" letterSpacing={5} {...halo} strokeWidth={7}>ABOVE THE PEAK</text>
        </g>}
        {f >= drop + 18 && <text x={DW / 2} y={1010} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={42} fill="#FFFFFF" letterSpacing={7} opacity={clamp((f - drop - 18) / 10, 0, 1)} {...halo} strokeWidth={8}>MOUNT EVEREST</text>}
        <text x={DW / 2} y={1210} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={36} fill="#FFFFFF" letterSpacing={6} {...halo} strokeWidth={7}>CHALLENGER DEEP</text>
        <text x={DW / 2} y={1256} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={36} fill="#FFC23D" letterSpacing={6} {...halo} strokeWidth={7}>10,935 M</text>
      </g>
    );
  }
  if (shot === 'dp_close') {
    const air = p.mode === 'air';
    const a0 = at(line, p.air_on || 'air', 0.2), a1 = at(line, p.air_off || 'metres', 0.7);
    const left = air ? L(f, a0, a1, 1, 0, Easing.inOut(Easing.quad)) : 1;
    return (
      <g>
        {air && (() => { const R0 = 120, cx = 800, cy = 330, ang = left * 2 * Math.PI, ex = cx + R0 * Math.sin(ang), ey = cy - R0 * Math.cos(ang), col = left > 0.35 ? '#7FE3FF' : '#FF6B5B';
          return <g opacity={clamp((f - a0 + 6) / 8, 0, 1)}>
            <circle cx={cx} cy={cy} r={R0} fill="#02101A" opacity={0.35} /><circle cx={cx} cy={cy} r={R0} fill="none" stroke="#FFFFFF" strokeWidth={10} opacity={0.15} />
            {left > 0.001 && <path d={left > 0.999 ? `M ${cx} ${cy - R0} A ${R0} ${R0} 0 1 1 ${cx - 0.01} ${cy - R0}` : `M ${cx} ${cy - R0} A ${R0} ${R0} 0 ${left > 0.5 ? 1 : 0} 1 ${ex} ${ey}`} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" />}
            <text x={cx} y={cy + 22} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={64} fill="#FFFFFF">{Math.round(left * 100)}%</text>
            <text x={cx} y={cy + R0 + 56} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={34} fill="#CFEFFF" letterSpacing={9} {...halo} strokeWidth={6}>AIR</text></g>; })()}
        {p.bar_on && (() => { const a = at(line, p.bar_on, 0.8); if (f < a - 4) return null; const k = L(f, a, a + 10, 0.08, 1, Easing.out(Easing.cubic));
          return <g opacity={clamp((f - a + 4) / 5, 0, 1)}>
            <rect x={140} y={300} width={800} height={200} rx={22} fill="#000000" opacity={0.6} />
            <rect x={180} y={448} width={720} height={14} rx={7} fill="#FFFFFF" opacity={0.35} /><rect x={180} y={448} width={720 * k} height={14} rx={7} fill="#FF2D2D" />
            <circle cx={180 + 720 * k} cy={455} r={22} fill="#FF2D2D" /><path d="M 186 328 l 44 28 l -44 28 Z" fill="#FFFFFF" />
            <text x={256} y={376} fontFamily={OSWALD} fontWeight={600} fontSize={54} fill="#FFFFFF">{k >= 1 ? '0:03 / 0:03' : '0:01 / 0:03'}</text></g>; })()}
      </g>
    );
  }
  if (shot === 'dp_title') {
    const slam = p.held ? -99 : p.vslam ? at(line, p.vslam, 0.1) : p.slam === 'none' ? 1e9 : at(line, p.slam || 'find', 0.6);
    const k = sp(f, slam, 'heavy'), k2 = sp(f, slam + 8, 'heavy'), k3 = sp(f, slam + 16, 'card');
    const b0 = p.held ? -99 : p.bar_from ? at(line, p.bar_from, 0.3) : slam + 16, b1 = p.held ? -98 : p.bar_to ? at(line, p.bar_to, 0.9) : slam + 46;
    return (
      <g>
        <g filter="url(#vsoft)">
          <text x={DW / 2} y={470 + (1 - k) * 40} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={250} fill="#FFFFFF" opacity={clamp(k * 1.5, 0, 1)} {...halo} strokeWidth={10}>YOU</text>
          <text x={DW / 2} y={560} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={80} fill="#FFC23D" letterSpacing={4} opacity={clamp(k2 * 1.5, 0, 1)} {...halo} strokeWidth={8}>VS</text>
          <text x={DW / 2} y={760 + (1 - k2) * 40} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={250} fill="#FFC23D" opacity={clamp(k2 * 1.5, 0, 1)} {...halo} strokeWidth={10}>11 KM</text>
        </g>
        <VTag f={f} a={slam + 16} x={DW / 2} y={850} text="THE MARIANA TRENCH" anchor="middle" size={40} />
        <VBar f={f} d={L(f, b0, b1, 0, 10935)} a={p.held ? -99 : slam + 16} y={1220} op={p.held ? 1 : clamp(k3, 0, 1)} />
      </g>
    );
  }
  return null;
}

// ───────────── the end card: it says its own words ("The whole dive is on our channel"), the sub going on down ─────────────
function EndCard({f, len, line}) {
  const id = 'e' + line.idx, F = f + (line.start || 0);
  vstart({vert: true});   // the backgrounds reach past the stage (set every frame: the module's state isn't shared between render tabs)
  const a1 = at(line, 'whole', 0.2), a2 = at(line, 'dive', 0.4), a3 = at(line, 'our', 0.75);
  const z = L(f, 0, len, 1, 1.07, (x) => x);
  // the same sub as the title shot's, where that shot leaves it (a crossfade showed two subs), then on down slowly
  const by = 981 + f * 0.9 + Math.sin(F * 0.05) * 8;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${DW} ${DH}`} style={{position: 'absolute', inset: 0}}>
      <g transform={`translate(${DW / 2} ${DH / 2}) scale(${z}) translate(${-DW / 2} ${-DH / 2})`}>
        <g transform={`translate(${-(W - DW) / 2} 0) scale(1 ${DH / H})`}><Defs id={id} d={6000} glow="#FFF1B8" /><Sea f={F} d={6000} id={id} /></g>
        <g transform={`translate(${-(W - DW) / 2} ${(DH - H) / 2})`}><DeepSpecks f={F} id={id} rise={F * 5} n={130} /></g>
        {/* the headlamp: a warm beam fading out from the lamp (it read as a flat grey triangle) */}
        <linearGradient id={`eb-${id}`} gradientUnits="userSpaceOnUse" x1={DW / 2 - 150} y1={by} x2={-100} y2={by}><stop offset="0" stopColor="#FFF4D2" stopOpacity={0.7} /><stop offset="0.55" stopColor="#FFE9B0" stopOpacity={0.18} /><stop offset="1" stopColor="#FFE9B0" stopOpacity={0} /></linearGradient>
        <g style={{mixBlendMode: 'screen'}}><path d={`M ${DW / 2 - 150} ${by + 10} L -100 ${by - 230} L -100 ${by + 300} Z`} fill={`url(#eb-${id})`} /></g>
        <YSub T={F} x={DW / 2} y={by} s={0.67} beam={0} cup={0.6} bag={false} solo youExpr="determined" pipExpr="smile" />
        <circle cx={DW / 2 - 236 * 0.67} cy={by + 12} r={16} fill="#FFFBE6" />
      </g>
      <g filter="url(#vsoft)">
        {f >= a1 - 3 && <text x={DW / 2} y={430 + (1 - clamp(sp(f, a1 - 3, 'heavy'), 0, 1)) * 30} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={106} fill="#FFFFFF" {...halo} strokeWidth={10}>THE WHOLE DIVE</text>}
        {f >= a2 - 3 && <text x={DW / 2} y={610 + (1 - clamp(sp(f, a2 - 3, 'heavy'), 0, 1)) * 30} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={170} fill="#FFC23D" {...halo} strokeWidth={10}>ALL 11 KM</text>}
      </g>
      <VTag f={f} a={a3 - 6} x={DW / 2} y={750} text="ON STORYGRAPHICS" anchor="middle" size={52} />
      {f >= a3 && <text x={DW / 2} y={830} textAnchor="middle" fontFamily={OSWALD} fontWeight={500} fontSize={44} fill="#FFFFFF" opacity={clamp((f - a3) / 8, 0, 1) * 0.9} letterSpacing={3}>@Storygraphics</text>}
    </svg>
  );
}

// the real footage cropped to the phone (vfocus = where across the frame the subject is); the world map wraps round as in Opening
const FootageV = ({line, len}) => {
  const f = useCurrentFrame();
  const v = P(line).footage;
  if (!v || !v.src) return null;
  const [z0, z1] = v.vzoom || v.zoom || [1.03, 1.1];
  const [fx, fy] = v.focus || [0.5, 0.5];
  const look = {filter: `saturate(${v.sat != null ? v.sat : 0.92}) contrast(${v.con != null ? v.con : 1.06}) brightness(${v.bri != null ? v.bri : 0.96})${v.hue ? ` hue-rotate(${v.hue}deg)` : ''}`};
  const z = L(f, 0, len, z0, z1, (x) => x);
  if (v.center) {
    const vh = Math.max(DH * z * (v.vscale || 1.2), DH * 1.2), vw = vh * (v.aspect || 2);
    const left = DW / 2 - v.center[0] * vw, top = DH / 2 - v.center[1] * vh;
    return (
      <AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
        {[-1, 0, 1].filter((k) => left + k * vw < DW && left + (k + 1) * vw > 0).map((k) => (
          <OffthreadVideo key={k} src={staticFile(v.src)} startFrom={Math.round((v.from || 0) * 30)} playbackRate={v.rate || 1} muted
            style={{position: 'absolute', left: left + k * vw, top, width: vw, height: vh, ...look}} />))}
      </AbsoluteFill>
    );
  }
  const vf = Array.isArray(v.vfocus) ? L(f, 0, len, v.vfocus[0], v.vfocus[1], (x) => x) : v.vfocus != null ? v.vfocus : fx;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
      <OffthreadVideo src={staticFile(v.src)} startFrom={Math.round((v.from || 0) * 30)} playbackRate={v.rate || 1} muted
        style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${vf * 100}% ${fy * 100}%`, transform: `scale(${z})`, transformOrigin: `${vf * 100}% ${fy * 100}%`, ...look}} />
      {v.tint !== false && <div style={{position: 'absolute', inset: 0, background: v.tint || '#0B3A52', mixBlendMode: 'soft-light', opacity: v.tint_a != null ? v.tint_a : 0.45}} />}
    </AbsoluteFill>
  );
};

const VShot = ({line, len, first}) => {
  const f = useCurrentFrame();
  if (line.shot === 'dv_end') return <EndCard f={f} len={len} line={line} />;
  const S = DEEP_SHOTS[line.shot];
  const vl = {...line, vert: true};
  const p = P(line);
  let view = null;
  if (S && line.shot === 'dp_section') view = <svg width="100%" height="100%" viewBox={`${SEC.x0} ${SEC.y0} ${DW} ${DH / SEC.sy}`} preserveAspectRatio="none" style={{position: 'absolute', inset: 0}}><S f={f} len={len} line={vl} /></svg>;
  else if (S && line.shot !== 'dp_real') {
    const [cx, cy, ww] = p.vcam || VCAM[line.shot] || [960, 540, 1000], wh = ww * DH / DW;
    view = <svg width="100%" height="100%" viewBox={`${cx - ww / 2} ${cy - wh / 2} ${ww} ${wh}`} style={{position: 'absolute', inset: 0}}><S f={f} len={len} line={vl} /></svg>;
  }
  return (
    <AbsoluteFill>
      <FootageV line={line} len={len} />
      {view}
      <svg width="100%" height="100%" viewBox={`0 0 ${DW} ${DH}`} style={{position: 'absolute', inset: 0}}>
        <defs>
          <filter id="vsoft" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx={0} dy={6} stdDeviation={10} floodColor="#000" floodOpacity={0.55} /></filter>
          <radialGradient id="vvig" cx="50%" cy="46%" r="72%"><stop offset="0.5" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.72} /></radialGradient>
          <linearGradient id="vlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0.62" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.55} /></linearGradient>
          <linearGradient id="vcapband" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#02101A" stopOpacity={0} /><stop offset="0.35" stopColor="#02101A" stopOpacity={0.55} /><stop offset="0.75" stopColor="#02101A" stopOpacity={0.55} /><stop offset="1" stopColor="#02101A" stopOpacity={0} /></linearGradient>
          <linearGradient id="vwaist" x1="0" y1="0" x2="0" y2="1"><stop offset="0.52" stopColor="#010A10" stopOpacity={0} /><stop offset="0.66" stopColor="#010A10" stopOpacity={0.93} /><stop offset="1" stopColor="#010A10" stopOpacity={0.97} /></linearGradient>
        </defs>
        <rect width={DW} height={DH} fill="url(#vvig)" />
        <rect width={DW} height={DH} fill="url(#vlow)" />
        {/* a close-up is framed from the waist up: the body goes into the dark above the captions (they never cross the character) */}
        {line.shot === 'dp_close' && <rect width={DW} height={DH} fill="url(#vwaist)" />}
        {line.shot === 'dp_real' && <rect x={0} y={1240} width={DW} height={300} fill="url(#vcapband)" />}
        <TypeOf f={f} len={len} line={line} first={first} />
      </svg>
    </AbsoluteFill>
  );
};

const FadeIn = ({on, children}) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{opacity: on ? clamp(f / 8, 0, 1) : 1}}>{children}</AbsoluteFill>;
};
// the captions leave out a phrase the picture already shows in big type (p.big cue words, p.nocap) and stop at the end card
const norm = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9']/g, '');
const capLines = (lines) => lines.filter((l) => l.shot !== 'dv_end').map((l) => {
  const q = l.p || {}, cues = [...(Array.isArray(q.big) ? q.big : []).map((b) => b.on), ...(q.nocap || [])].map(norm).filter(Boolean);
  if (!cues.length) return l;
  const ph = [], out = [];
  let cur = [];
  (l.words || []).forEach((w) => { cur.push(w); if (/[,.?!:;]$/.test(w[0])) { ph.push(cur); cur = []; } });
  if (cur.length) ph.push(cur);
  ph.forEach((c) => { if (!c.some((w) => cues.some((k) => norm(w[0]).startsWith(k)))) out.push(...c); });
  return {...l, words: out};
});

export const VDeep = ({lines = [], audio, captions = true}) => {
  const endAt = (lines.find((l) => l.shot === 'dv_end') || {}).cut;
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <style>{FONT_CSS}</style>
      {audio && <Audio src={staticFile(audio)} />}
      {lines.map((l, i) => {
        const XF = 8;
        const from = i === 0 ? 0 : Math.max(0, l.cut - XF), to = i + 1 < lines.length ? lines[i + 1].cut : l.until;
        const shifted = {...l, idx: i, start: from, end: l.end, words: (l.words || []).map(([w, fr]) => [w, fr])};
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(1, to - from)} layout="none">
            <FadeIn on={i > 0 && !(l.p || {}).cut}><VShot line={shifted} len={to - from} first={i === 0} /></FadeIn>
          </Sequence>
        );
      })}
      {captions && <VCaptions lines={capLines(lines)} stop={endAt != null ? endAt : 1e9} hold={45} />}
    </AbsoluteFill>
  );
};
