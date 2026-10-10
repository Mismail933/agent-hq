import React from 'react';
import {AbsoluteFill, spring, useVideoConfig} from 'remotion';
import {C, HEAD, BODY, W, H, clamp01, easeOut} from './theme';

const STROKE = (px) => ({WebkitTextStroke: `${px}px ${C.ink}`, paintOrder: 'stroke fill', textShadow: `0 8px 0 ${C.ink}`});

/**
 * Big readable captions, 2-3 words at a time, the spoken word highlighted. Sits above YouTube's bottom UI.
 * chunks: [{from, to, who, words: [{w, from, to}]}] in frames. A character's own line (not the narrator's) is tinted sky blue.
 */
export const Captions = ({chunks, frame}) => {
  const chunk = chunks.find((c) => frame >= c.from && frame < c.to);
  if (!chunk) return null;
  const {fps} = useVideoConfig();
  const age = frame - chunk.from;
  const pop = spring({frame: age, fps, config: {damping: 12, stiffness: 220, mass: 0.5}});
  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center'}}>
      <div
        style={{
          position: 'absolute',
          top: 1310,
          width: W - 120,
          textAlign: 'center',
          fontFamily: HEAD,
          fontSize: 124,
          lineHeight: 1.04,
          textTransform: 'uppercase',
          transform: `scale(${0.9 + 0.1 * pop})`,
          letterSpacing: 1,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: 66, // a real gap between words: the 16 px outline and the spoken word's pop eat into it (2.30.0: 44 ran words together)
        }}
      >
        {chunk.words.map((w, i) => {
          const active = frame >= w.from && frame < w.to;
          const done = frame >= w.to;
          return (
            <span key={i} style={{display: 'inline-block', margin: 0, color: active ? C.gold : chunk.who && chunk.who !== 'narrator' ? C.sky : C.white, transform: active ? 'scale(1.05) rotate(-2deg)' : 'none', transformOrigin: '50% 60%', opacity: done || active ? 1 : 0.92, ...STROKE(16)}}>
              {w.w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** The opening stamp: place and year on a ribbon (no "POV": nobody's point of view is used, 2.29.0). Plays over the hook line. */
export const TitleCard = ({intro, frame, frames = 84}) => {
  const {fps} = useVideoConfig();
  if (frame > frames) return null;
  const pop = spring({frame, fps, config: {damping: 8, stiffness: 160, mass: 0.7}});
  const ribbon = spring({frame: frame - 8, fps, config: {damping: 12, stiffness: 130}});
  const out = 1 - easeOut(clamp01((frame - (frames - 12)) / 12));
  const text = [intro.place, intro.year].filter(Boolean).join(' · ');
  // the ribbon must fit inside the safe area whatever the place name: shrink the type, then trim
  const fs = Math.max(34, Math.min(60, 880 / (text.length * 0.6)));
  const shown = text.length * fs * 0.6 > 880 ? text.slice(0, Math.floor(880 / (fs * 0.6)) - 1).trim() + '…' : text;
  const ribbonW = Math.min(W - 140, shown.length * fs * 0.6 + 90);
  return (
    <g opacity={out} transform={`translate(${W / 2} 205) scale(${0.9 + 0.1 * out})`}>
      <g transform={`translate(${(1 - ribbon) * 900} 0) rotate(-2) scale(${0.85 + 0.15 * Math.max(0, pop)})`}>
        <rect x={-ribbonW / 2} y="-52" width={ribbonW} height="104" rx="22" fill={C.parchment} stroke={C.ink} strokeWidth="10" />
        <text textAnchor="middle" y={fs * 0.33} fontFamily={HEAD} fontSize={fs} fill={C.ink}>{shown.toUpperCase()}</text>
      </g>
    </g>
  );
};

/**
 * The title card after the cold open (2.30.0, OverSimplified's "sting into the title"): the whole picture for a couple of
 * seconds while the music carries on. Channel line, the episode's title in big type, place and year on a ribbon.
 * title: {text, place, year, frames}.
 */
export const EpisodeTitle = ({title, frame}) => {
  const {fps} = useVideoConfig();
  const n = title.frames || 78;
  const pop = spring({frame: frame - 2, fps, config: {damping: 11, stiffness: 150, mass: 0.7}});
  const rib = spring({frame: frame - 10, fps, config: {damping: 13, stiffness: 130}});
  const fade = 1 - easeOut(clamp01((frame - (n - 6)) / 6));
  const words = String(title.text || '').toUpperCase().split(/\s+/).filter(Boolean);
  // wrap the title into lines of about 16 characters, then size the type to the longest line
  const lines = [];
  words.forEach((w) => {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 16) lines[lines.length - 1] = last + ' ' + w;
    else lines.push(w);
  });
  const shown = lines.slice(0, 5);
  const fs = Math.max(70, Math.min(132, 900 / (0.58 * Math.max(...shown.map((l) => l.length), 6))));
  const place = [title.place, title.year].filter(Boolean).join(' · ');
  const top = 960 - (shown.length * fs * 1.05) / 2;
  return (
    <g opacity={fade}>
      <rect x="-200" y="-200" width={W + 400} height={H + 400} fill={C.parchment} />
      <rect x="40" y="40" width={W - 80} height={H - 80} rx="36" fill="none" stroke={C.terracotta} strokeWidth="10" />
      <text x={W / 2} y={top - 90} textAnchor="middle" fontFamily={BODY} fontWeight="800" fontSize="40" fill={C.teal} opacity={clamp01(frame / 6)}>
        A STORY THAT REALLY HAPPENED
      </text>
      <g transform={`translate(${W / 2} 0) scale(${Math.max(0.01, 0.85 + 0.15 * pop)}) translate(${-W / 2} 0)`}>
        {shown.map((l, i) => (
          <text key={i} x={W / 2} y={top + fs * (i + 0.85) * 1.05} textAnchor="middle" fontFamily={HEAD} fontSize={fs} fill={C.ink}>{l}</text>
        ))}
      </g>
      {place && (
        <g transform={`translate(${W / 2 + (1 - rib) * W} ${top + shown.length * fs * 1.05 + 110}) rotate(-2)`}>
          <rect x={-Math.min(W - 200, place.length * 30 + 90) / 2} y="-50" width={Math.min(W - 200, place.length * 30 + 90)} height="100" rx="22" fill={C.terracotta} stroke={C.ink} strokeWidth="8" />
          <text textAnchor="middle" y="18" fontFamily={HEAD} fontSize="52" fill={C.parchment}>{place.toUpperCase()}</text>
        </g>
      )}
    </g>
  );
};

/** The last seconds: follow card. */
export const Outro = ({outro, frame, frames}) => {
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 10, stiffness: 120}});
  return (
    <g>
      <rect x="-400" y="-200" width="1880" height="2300" fill={C.ink} opacity={0.55 * clamp01(frame / 8)} />
      <g transform={`translate(${W / 2} 900) scale(${Math.max(0.01, pop)})`}>
        <rect x="-420" y="-190" width="840" height="380" rx="40" fill={C.parchment} stroke={C.ink} strokeWidth="12" />
        <rect x="-398" y="-168" width="796" height="336" rx="28" fill="none" stroke={C.terracotta} strokeWidth="6" />
        <text textAnchor="middle" y="-70" fontFamily={BODY} fontSize="44" fill={C.teal} fontWeight="800">FOLLOW FOR MORE HISTORY</text>
        <text textAnchor="middle" y="30" fontFamily={HEAD} fontSize="92" fill={C.ink}>{outro.channel}</text>
        <text textAnchor="middle" y="112" fontFamily={HEAD} fontSize="58" fill={C.terracotta}>{outro.handle}</text>
      </g>
    </g>
  );
};
