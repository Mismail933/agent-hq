// Apollo 12's film language: real film and 3D plates cut on exact words, a mission clock that never lies, tags that say what each picture is.
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate} from 'remotion';

const OSW = "'Oswald', 'Arial Narrow', sans-serif";
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9]/g, '');
// the frame (inside this line's Sequence) where a word starts; '' or null = the line's first frame
const wordAt = (line, w, off = 0) => {
  if (!w) return 0 + off;
  const k = (line.words || []).find(([x]) => norm(x) === norm(w));
  return (k ? k[1] - line.start : 0) + off;   // a word of another line may be before this one: negative is fine
};

const Clip = ({c, len}) => {
  const f = useCurrentFrame();
  const [z0, z1] = c.zoom || [1, 1.03];
  const z = interpolate(f, [0, Math.max(1, len)], [z0, z1], {extrapolateRight: 'clamp'});
  const [fx, fy] = c.focus || [0.5, 0.5];
  const style = {width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})`, transformOrigin: `${fx * 100}% ${fy * 100}%`, filter: c.look || undefined};
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
      {c.img ? <Img src={staticFile(c.src)} style={style} /> : <OffthreadVideo src={staticFile(c.src)} startFrom={c._from} muted style={style} />}
    </AbsoluteFill>
  );
};

const Plate = ({text, x, y, align = 'left', size = 28, a, b, f, gold = true}) => {
  // a tag goes on its cut, never carried over the next picture (a reconstruction read "REAL FILM" for 6 frames)
  // 2026-11-03 (Israa: tags read as missing or see-through on a cut's first frames and on bright film): up from the cut's first frame
  // (a third, full by the third frame) on a solid dark plate
  const k = f >= b || f < a ? 0 : clamp((f - a + 1) / 3);
  if (k <= 0) return null;
  return (
    <div style={{position: 'absolute', [align === 'right' ? 'right' : 'left']: x, top: y, opacity: k, background: 'rgba(8,10,14,0.9)', padding: '8px 18px 9px',
      borderLeft: gold ? '4px solid #E8A53A' : 'none', fontFamily: OSW, fontWeight: 500, fontSize: size, letterSpacing: 3.5, color: '#F4F1E8', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{text}</div>
  );
};

// the clock: each key sets the time on its word, then it runs on in real seconds
const rawClock = (line, keys, f) => {
  let s = null;
  for (const [w, v, r = 1] of keys) { const a = wordAt(line, w); if (f >= a) s = v + ((f - a) / 30) * r; }
  return s;
};
// 2026-11-03: a clock only moves forward. A slower voice let a line's clock run past the next key or the next line's start
// (T+01:02 -> T+01:01): it now holds at the highest time it has shown, in this line and the lines just before it that show
// a clock, until its own keys pass it. Where the keys never go back this is the same as before.
const seqStart = (l, i) => (i === 0 ? 0 : Math.max(0, l.cut - 8));
const clockAt = (line, keys, f) => {
  let hi = -Infinity;
  for (let g = 0; g <= f; g++) { const s = rawClock(line, keys, g); if (s != null && s > hi) hi = s; }
  const all = line.all, i = line.idx;
  if (all && i != null) {
    for (let j = i - 1, n = 0; j >= 0 && n < 4; j--, n++) {
      const pl = all[j], pk = (pl.p || {}).clk;
      if (!pk) break;
      const ps = seqStart(pl, j), pe = seqStart(all[j + 1], j + 1), sl = {...pl, start: ps};
      for (let g = 0; g < pe - ps; g++) { const s = rawClock(sl, pk, g); if (s != null && s > hi) hi = s; }
    }
  }
  return hi === -Infinity ? null : hi;
};
const fmtT = (s) => { const m = Math.floor(s / 60), r = Math.floor(s - m * 60); return `T+${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; };

// a row comes up on its word: `at` if given, else `on`. The captions (Opening.jsx) leave out a phrase holding a row's `on` word,
// so a row that only sums up the words (a number, a date) times itself with `at` and leaves `on` empty: the captions stay.
const Big = ({rows, line, f, y}) => {
  const items = rows.map((r) => ({...r, a: wordAt(line, r.at != null ? r.at : r.on, r.off || 0)}));
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: y || 90}}>
      {items.map((r, i) => {
        const k = clamp((f - r.a) / 7), e = 1 - Math.pow(1 - k, 3), gone = r.until != null && f >= wordAt(line, r.until);
        if (gone) return null;
        return <div key={i} style={{opacity: k, transform: `translateY(${(1 - e) * 26}px) scale(${1.05 - 0.05 * e})`, fontFamily: OSW, fontWeight: 700, fontSize: r.size || 124, lineHeight: 1.12, letterSpacing: 2,
          color: r.color || '#F7F4EA', textTransform: 'uppercase', whiteSpace: 'nowrap',
          // 2026-11-03 (Israa: white type sank into bright Earth and cloud): a tight dark edge and a wide dark glow under the old drop
          textShadow: '0 0 3px rgba(0,0,0,0.9), 0 0 14px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.65), 0 4px 26px rgba(0,0,0,0.85)'}}>{r.t}</div>;
      })}
    </AbsoluteFill>
  );
};

// who is speaking: their real photo, their name, where the words come from
const Who = ({w, line, f}) => {
  const a = wordAt(line, w.on);
  // hold: the same badge carries on from the line before, so it is already up (no blink at the line's first frame)
  const k = w.hold ? 1 : clamp((f - a) / 8), e = 1 - Math.pow(1 - k, 3), out = w.until != null ? clamp((f - wordAt(line, w.until)) / 6) : 0;
  if (k <= 0 || out >= 1) return null;
  return (
    <div style={{position: 'absolute', left: 70, bottom: 190, display: 'flex', alignItems: 'center', gap: 22, opacity: k * (1 - out), transform: `translateY(${(1 - e) * 18}px)`}}>
      <div style={{width: 148, height: 148, borderRadius: '50%', overflow: 'hidden', border: '4px solid #E8A53A', background: '#111', flexShrink: 0}}>
        <Img src={staticFile(w.src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: w.pos || '50% 22%'}} />
      </div>
      <div style={{background: 'rgba(8,10,14,0.9)', padding: '10px 22px 12px'}}>
        <div style={{fontFamily: OSW, fontWeight: 700, fontSize: 46, letterSpacing: 2, color: '#F7F4EA', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{w.name}</div>
        {w.role && <div style={{fontFamily: OSW, fontWeight: 400, fontSize: 28, letterSpacing: 3, color: '#E8A53A', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{w.role}</div>}
      </div>
    </div>
  );
};

export const ClipLayer = ({line, len}) => {
  const f = useCurrentFrame();
  const p = line.p || {}, clips = p.clips;
  if (!clips) return null;
  const starts = clips.map((c, i) => (i === 0 ? 0 : wordAt(line, c.on, c.off || 0)));
  const clock = p.clk ? clockAt(line, p.clk, f) : null;
  // the tag the line before ended on: the same tag on this line's first clip is already up (no dip at the line's cut)
  const prevClips = line.all && line.idx ? ((line.all[line.idx - 1] || {}).p || {}).clips : null;
  const carried = prevClips && prevClips.length ? prevClips[prevClips.length - 1].tag : null;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {clips.map((c, i) => {
        const a = starts[i], b = i + 1 < clips.length ? starts[i + 1] : len + 16;
        // `sync` [word, seconds]: the plate reaches that second of its own time exactly on the word (a strike lands on its word)
        const syncAt = c.sync ? (c.sync[3] != null ? wordAt({...line.all[c.sync[3]], start: line.start}, c.sync[0], c.sync[2] || 0) : wordAt(line, c.sync[0], c.sync[2] || 0)) : 0;
        const from = c.sync ? Math.max(0, Math.round(c.sync[1] * 30) - (syncAt - a)) : Math.round((c.from || 0) * 30);
        return <Sequence key={i} from={a} durationInFrames={Math.max(1, b - a)} layout="none"><Clip c={{...c, _from: from}} len={b - a} /></Sequence>;
      })}
      {clips.map((c, i) => {
        // a run of clips with the same tag shows one tag, up until the first clip with another (or none)
        if (!c.tag || (i && clips[i - 1].tag === c.tag)) return null;
        let j = i + 1;
        while (j < clips.length && clips[j].tag === c.tag) j++;
        // `tag_y` (optional): a lower tag where the default spot would cover a key row of the picture
        return <Plate key={i} f={f} text={c.tag} x={56} y={c.tag_y != null ? c.tag_y : 48} a={i === 0 && carried && c.tag === carried ? starts[i] - 3 : starts[i]} b={j < clips.length ? starts[j] : 1e9} size={26} />;
      })}
      {clock != null && <div style={{position: 'absolute', right: 56, top: 44, fontFamily: OSW, fontWeight: 600, fontSize: 58, letterSpacing: 3, color: p.clk_alarm ? '#FF5A3C' : '#F7F4EA', background: 'rgba(8,10,14,0.62)', padding: '2px 22px 6px', fontVariantNumeric: 'tabular-nums'}}>{fmtT(clock)}</div>}
      {p.big && <Big rows={p.big} line={line} f={f} y={p.big_y} />}
      {(p.who || []).map((w, i) => <Who key={i} w={w} line={line} f={f} />)}
    </AbsoluteFill>
  );
};
