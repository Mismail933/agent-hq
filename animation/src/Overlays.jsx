import React from 'react';
import {AbsoluteFill, spring, useVideoConfig} from 'remotion';
import {C, HEAD, BODY, W, H, clamp01, easeOut} from './theme';

const STROKE = (px) => ({WebkitTextStroke: `${px}px ${C.ink}`, paintOrder: 'stroke fill', textShadow: `0 8px 0 ${C.ink}`});

/**
 * Big readable captions, 2-3 words at a time, the spoken word highlighted. Sits above YouTube's bottom UI.
 * chunks: [{from, to, words: [{w, from, to}]}] in frames.
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
          columnGap: 44, // a real gap between words, whatever colour or size a word has
        }}
      >
        {chunk.words.map((w, i) => {
          const active = frame >= w.from && frame < w.to;
          const done = frame >= w.to;
          return (
            <span key={i} style={{display: 'inline-block', margin: 0, color: active ? C.gold : C.white, transform: active ? 'scale(1.1) rotate(-2deg)' : 'none', opacity: done || active ? 1 : 0.92, ...STROKE(16)}}>
              {w.w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** The opening stamp: POV, then place and year. Plays over the hook line. */
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
      <g transform={`rotate(-4) scale(${Math.max(0.01, pop)})`}>
        <rect x="-250" y="-130" width="500" height="210" rx="34" fill={C.terracotta} stroke={C.ink} strokeWidth="12" />
        <rect x="-232" y="-112" width="464" height="174" rx="24" fill="none" stroke={C.parchment} strokeWidth="5" />
        <text textAnchor="middle" y="40" fontFamily={HEAD} fontSize="190" fill={C.parchment} stroke={C.ink} strokeWidth="9" paintOrder="stroke">POV</text>
      </g>
      <g transform={`translate(${(1 - ribbon) * 900} 128) rotate(2)`}>
        <rect x={-ribbonW / 2} y="-52" width={ribbonW} height="104" rx="22" fill={C.parchment} stroke={C.ink} strokeWidth="10" />
        <text textAnchor="middle" y={fs * 0.33} fontFamily={HEAD} fontSize={fs} fill={C.ink}>{shown.toUpperCase()}</text>
      </g>
    </g>
  );
};

/** The last second and a half: follow card. */
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
