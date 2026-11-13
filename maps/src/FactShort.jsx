// Bassel's fact Shorts, remade (11-13; his 11-11 notes: "videos are very bad ... more movement, add real videos or create your own ...
// a bit more fun ... dont use the same style"). Vertical 1080x1920, NOT the map look: every shot is moving video (real footage, or a
// labelled AI clip), full screen, cut on the narrator's words with a short punch-in; big numbers and words pop on their word;
// captions a few words at a time, the spoken word in yellow. Every frame is a pure function of the frame number.
//   props: {seconds, shots: [{src, a, b, from, rate, zoom: [z0, z1], fx (focus x %), fy, ai, tag, kind: 'video'|'photo'}],
//           pops: [{text, sub, a, b, y, color, size}], words: [[word, a, b]], hook: {text, b}, credit}
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {FONT_CSS} from './fonts';

const W = 1080, H = 1920;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const YELLOW = '#FFD23F';
const XF = 5;   // frames of crossfade at a cut (a hard cut with a quick punch-in reads as energetic, a few frames hide codec seams)

function Shot({s, fps}) {
  const f = useCurrentFrame();   // local to the Sequence
  const n = Math.round((s.b - s.a) * fps);
  const p = interpolate(f, [0, n], [0, 1], clamp);
  const [z0, z1] = s.zoom || [1.06, 1.16];
  // a punch on the cut: starts 6% tighter and settles in 10 frames, then the slow push carries on
  const punch = interpolate(f, [0, 10], [0.06, 0], {...clamp, easing: Easing.out(Easing.cubic)});
  const z = z0 + (z1 - z0) * p + punch;
  const fx = s.fx ?? 50, fy = s.fy ?? 50;
  const fade = interpolate(f, [0, XF], [0, 1], clamp);
  const style = {position: 'absolute', width: W, height: H, objectFit: 'cover', objectPosition: `${fx}% ${fy}%`,
                 transform: `scale(${z})`, transformOrigin: `${fx}% ${fy}%`};
  return (
    <AbsoluteFill style={{opacity: fade, background: '#000'}}>
      {s.kind === 'photo'
        ? <Img src={staticFile(s.src)} style={style} />
        : <OffthreadVideo src={staticFile(s.src)} muted startFrom={Math.round((s.from || 0) * fps)} playbackRate={s.rate || 1} style={style} />}
      {/* a soft dark band top and bottom so the words always read */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'}} />
      {s.ai || s.tag ? (
        <div style={{position: 'absolute', left: 44, top: 150, padding: '8px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.55)',
                     fontFamily: 'Montserrat', fontWeight: 700, fontSize: 26, color: '#F2F2F2', letterSpacing: 1,
                     opacity: interpolate(f, [4, 12], [0, 1], clamp)}}>{s.tag || 'AI recreation'}</div>
      ) : null}
    </AbsoluteFill>
  );
}

function Pop({p, fps}) {
  const f = useCurrentFrame();
  const n = Math.round((p.b - p.a) * fps);
  const k = spring({frame: f, fps, config: {damping: 9, stiffness: 160, mass: 0.6}});
  const out = interpolate(f, [n - 6, n], [1, 0], clamp);
  const wob = Math.sin(f / 9) * 1.2;   // a slight living tilt
  return (
    <div style={{position: 'absolute', left: 50, right: 50, top: p.y ?? 330, textAlign: 'center', opacity: out,
                 transform: `scale(${0.3 + 0.7 * k}) rotate(${(p.tilt ?? -3) * (1 - k) + wob * 0.4}deg)`}}>
      <div style={{fontFamily: 'Archivo Black', fontSize: p.size || 150, lineHeight: 1.0, color: p.color || YELLOW,
                   WebkitTextStroke: '14px #111', paintOrder: 'stroke', textShadow: '0 10px 30px rgba(0,0,0,0.6)'}}>{p.text}</div>
      {p.sub ? <div style={{marginTop: 14, fontFamily: 'Montserrat', fontWeight: 800, fontSize: 52, color: '#fff', textTransform: 'uppercase',
                            WebkitTextStroke: '9px #111', paintOrder: 'stroke', opacity: interpolate(f, [5, 12], [0, 1], clamp)}}>{p.sub}</div> : null}
    </div>
  );
}

function Captions({words, fps}) {
  const f = useCurrentFrame();
  const t = f / fps;
  // chunks of up to 3 words, broken after punctuation; a chunk shows from its first word to the next chunk
  const chunks = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const end = /[.,!?;:]$/.test(w[0]) || cur.length >= 3 || i === words.length - 1 || (words[i + 1] && words[i + 1][1] - w[2] > 0.35);
    if (end) { chunks.push(cur); cur = []; }
  });
  const c = chunks.find((ch, i) => t >= ch[0][1] - 0.05 && t < (chunks[i + 1] ? Math.min(chunks[i + 1][0][1] - 0.05, ch[ch.length - 1][2] + 0.6) : ch[ch.length - 1][2] + 0.6));
  if (!c) return null;
  const a = c[0][1];
  const k = spring({frame: Math.round((t - a) * fps), fps, config: {damping: 12, stiffness: 220}});
  return (
    <div style={{position: 'absolute', left: 60, right: 60, top: 1260, textAlign: 'center', transform: `scale(${0.85 + 0.15 * k})`}}>
      {c.map((w, i) => {
        const on = t >= w[1] - 0.03 && t < (c[i + 1] ? c[i + 1][1] : w[2] + 0.6);
        return (
          <span key={i} style={{display: 'inline-block', margin: '0 20px', fontFamily: 'Montserrat', fontWeight: 900, fontSize: 82,
                                textTransform: 'uppercase', color: on ? YELLOW : '#FFFFFF', WebkitTextStroke: '12px #000', paintOrder: 'stroke',
                                transform: on ? 'scale(1.08)' : 'none'}}>{w[0].replace(/[,;:]$/, '')}</span>
        );
      })}
    </div>
  );
}

export const FactShort = ({shots = [], pops = [], words = [], hook = null, credit = ''}) => {
  const {fps} = useVideoConfig();
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <style>{FONT_CSS}</style>
      {shots.map((s, i) => {
        const a = Math.round(s.a * fps), n = Math.max(1, Math.round((s.b - s.a) * fps) + XF);
        return <Sequence key={`s${i}`} from={a} durationInFrames={n}><Shot s={s} fps={fps} /></Sequence>;
      })}
      {pops.map((p, i) => (
        <Sequence key={`p${i}`} from={Math.round(p.a * fps)} durationInFrames={Math.max(1, Math.round((p.b - p.a) * fps))}><Pop p={p} fps={fps} /></Sequence>
      ))}
      {hook ? (
        <div style={{position: 'absolute', left: 50, right: 50, top: 300, textAlign: 'center', fontFamily: 'Archivo Black', fontSize: 92, lineHeight: 1.05,
                     color: '#fff', WebkitTextStroke: '13px #111', paintOrder: 'stroke',
                     opacity: interpolate(f, [hook.b * fps - 8, hook.b * fps], [1, 0], clamp),
                     transform: `scale(${0.6 + 0.4 * spring({frame: f, fps, config: {damping: 10, stiffness: 170}})})`}}>
          {hook.text.split('|').map((x, i) => <div key={i} style={{color: i % 2 ? YELLOW : '#fff'}}>{x}</div>)}
        </div>
      ) : null}
      <Captions words={words} fps={fps} />
      {credit ? <div style={{position: 'absolute', left: 40, right: 140, bottom: 70, fontFamily: 'Montserrat', fontSize: 18, color: 'rgba(255,255,255,0.55)'}}>{credit}</div> : null}
    </AbsoluteFill>
  );
};
