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
  const k = clamp((f - a) / 6) * (1 - clamp((f - b) / 6));
  if (k <= 0) return null;
  return (
    <div style={{position: 'absolute', [align === 'right' ? 'right' : 'left']: x, top: y, opacity: k, background: 'rgba(8,10,14,0.72)', padding: '8px 18px 9px',
      borderLeft: gold ? '4px solid #E8A53A' : 'none', fontFamily: OSW, fontWeight: 500, fontSize: size, letterSpacing: 3.5, color: '#F4F1E8', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>{text}</div>
  );
};

// the clock: each key sets the time on its word, then it runs on in real seconds
const clockAt = (line, keys, f) => {
  let s = null;
  for (const [w, v, r = 1] of keys) { const a = wordAt(line, w); if (f >= a) s = v + ((f - a) / 30) * r; }
  return s;
};
const fmtT = (s) => { const m = Math.floor(s / 60), r = Math.floor(s - m * 60); return `T+${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; };

const Big = ({rows, line, f, y}) => {
  const items = rows.map((r) => ({...r, a: wordAt(line, r.on, r.off || 0)}));
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: y || 90}}>
      {items.map((r, i) => {
        const k = clamp((f - r.a) / 7), e = 1 - Math.pow(1 - k, 3), gone = r.until != null && f >= wordAt(line, r.until);
        if (gone) return null;
        return <div key={i} style={{opacity: k, transform: `translateY(${(1 - e) * 26}px) scale(${1.05 - 0.05 * e})`, fontFamily: OSW, fontWeight: 700, fontSize: r.size || 124, lineHeight: 1.12, letterSpacing: 2,
          color: r.color || '#F7F4EA', textTransform: 'uppercase', textShadow: '0 4px 26px rgba(0,0,0,0.85)', whiteSpace: 'nowrap'}}>{r.t}</div>;
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
      <div style={{background: 'rgba(8,10,14,0.78)', padding: '10px 22px 12px'}}>
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
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {clips.map((c, i) => {
        const a = starts[i], b = i + 1 < clips.length ? starts[i + 1] : len + 16;
        // `sync` [word, seconds]: the plate reaches that second of its own time exactly on the word (a strike lands on its word)
        const syncAt = c.sync ? (c.sync[3] != null ? wordAt({...line.all[c.sync[3]], start: line.start}, c.sync[0], c.sync[2] || 0) : wordAt(line, c.sync[0], c.sync[2] || 0)) : 0;
        const from = c.sync ? Math.max(0, Math.round(c.sync[1] * 30) - (syncAt - a)) : Math.round((c.from || 0) * 30);
        return <Sequence key={i} from={a} durationInFrames={Math.max(1, b - a)} layout="none"><Clip c={{...c, _from: from}} len={b - a} /></Sequence>;
      })}
      {clips.map((c, i) => c.tag && <Plate key={i} f={f} text={c.tag} x={56} y={48} a={starts[i] + 3} b={i + 1 < clips.length ? starts[i + 1] : 1e9} size={26} />)}
      {clock != null && <div style={{position: 'absolute', right: 56, top: 44, fontFamily: OSW, fontWeight: 600, fontSize: 58, letterSpacing: 3, color: p.clk_alarm ? '#FF5A3C' : '#F7F4EA', background: 'rgba(8,10,14,0.62)', padding: '2px 22px 6px', fontVariantNumeric: 'tabular-nums'}}>{fmtT(clock)}</div>}
      {p.big && <Big rows={p.big} line={line} f={f} y={p.big_y} />}
      {(p.who || []).map((w, i) => <Who key={i} w={w} line={line} f={f} />)}
    </AbsoluteFill>
  );
};
