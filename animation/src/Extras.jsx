import React from 'react';
import {spring, useVideoConfig} from 'remotion';
import {C, HEAD, LINE, W, H, easeOut, clamp01, lerp} from './theme';

const o = {stroke: C.ink, strokeWidth: LINE, strokeLinejoin: 'round', strokeLinecap: 'round'};

/**
 * A rod standing in the ground with its shadow (sun on the right). shadow: 0 = none, 1 = long. Drawn at the cast's `scale`
 * (2.29.0): the shadow is the point of the scene, so it is dark and its end is marked with a tick.
 */
export const Rod = ({x = 300, y = 1250, shadow = 0.5, frame, scale = 1}) => {
  const len = 360 * shadow;
  const grow = easeOut(clamp01(frame / 30));
  const tip = -len * grow - 46;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={`M -14 2 L ${tip} 16 L ${tip + 6} 44 L 14 30 Z`} fill={C.ink} opacity="0.55" />
      {grow > 0.95 && <path d={`M ${tip + 3} 0 L ${tip + 3} 60`} stroke={C.ink} strokeWidth="6" strokeLinecap="round" />}
      {/* the sunbeam that makes the shadow: from the shadow's tip past the top of the rod, and the angle it makes with the
          rod (2.29.1, Israa on ep 23: "picture a line from the top of the stick to the tip of its shadow" must be on screen) */}
      {shadow > 0 && (() => {
        const b = clamp01((frame - 34) / 18);
        if (b <= 0) return null;
        const dx = -tip;   // the beam runs from the shadow tip (tip, 0) up through the rod top (0, -306)
        const len = Math.hypot(dx, 306);
        const ux = dx / len;
        const uy = -306 / len;
        const ext = (len + 90) * easeOut(b);
        const r = 90;
        const a1 = [-r * ux * 0, -306 + r];            // down the rod from its top
        const a2 = [-r * ux, -306 - r * uy];           // back down the beam from the rod top
        return (
          <g opacity={b}>
            <line x1={tip} y1="0" x2={tip + ux * ext} y2={uy * ext} stroke={C.gold} strokeWidth="12" strokeLinecap="round" strokeDasharray="34 18" />
            <path d={`M ${a1[0]} ${a1[1]} A ${r} ${r} 0 0 1 ${a2[0]} ${a2[1]}`} fill="none" stroke={C.parchment} strokeWidth="8" strokeLinecap="round" />
          </g>
        );
      })()}
      <rect x="-12" y="-300" width="24" height="300" fill="#8A5A3A" {...o} strokeWidth={6} />
      <circle cx="0" cy="-306" r="16" fill={C.gold} {...o} strokeWidth={6} />
      <ellipse cx="0" cy="8" rx="46" ry="16" fill="#BDA06A" {...o} strokeWidth={6} />
    </g>
  );
};

/** A spinning clay globe. */
export const Globe = ({x = 540, y = 1000, r = 150, frame}) => {
  const off = (frame * 2.4) % 520;
  const blob = (i, dx) => (
    <path key={i} d="M -70 -40 Q -20 -110 60 -70 Q 120 -30 70 20 Q 20 70 -40 40 Q -110 30 -70 -40 Z" transform={`translate(${dx} ${i * 40 - 30}) scale(${0.9 + i * 0.1})`} fill="#6FA37D" stroke={C.ink} strokeWidth="5" />
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M ${-r * 0.6} ${r * 1.3} L ${r * 0.6} ${r * 1.3} L ${r * 0.3} ${r * 1.05} L ${-r * 0.3} ${r * 1.05} Z`} fill={C.gold} {...o} strokeWidth={6} />
      <clipPath id="globe-clip">
        <circle r={r} />
      </clipPath>
      <circle r={r} fill={C.sky} {...o} />
      <g clipPath="url(#globe-clip)">
        {[0, 1].map((k) => (
          <g key={k} transform={`translate(${-off + k * 520} 0)`}>
            {blob(0, 100)}
            {blob(1, 300)}
            {blob(2, 440)}
          </g>
        ))}
        <circle r={r} fill="none" stroke={C.ink} strokeWidth="3" opacity="0" />
        <ellipse cx={-r * 0.35} cy={-r * 0.4} rx={r * 0.28} ry={r * 0.18} fill={C.white} opacity="0.35" transform="rotate(-30)" />
      </g>
      <circle r={r} fill="none" {...o} />
    </g>
  );
};

/** Big on-screen text that pops in with a spring: numbers, names, the line to remember. */
export const Callout = ({text, frame, y = 470, delay = 6}) => {
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - delay, fps, config: {damping: 8, stiffness: 150, mass: 0.7}});
  const size = text.length > 22 ? 70 : text.length > 14 ? 88 : 112;
  const wob = Math.sin(frame / 14) * 1.2;
  const w = Math.min(W - 120, text.length * size * 0.56 + 90);
  return (
    <g transform={`translate(${W / 2} ${y}) rotate(${-3 + wob}) scale(${Math.max(0.01, pop)})`} opacity={clamp01(pop * 3)}>
      <rect x={-w / 2} y={-size * 0.8} width={w} height={size * 1.5} rx="26" fill={C.gold} stroke={C.ink} strokeWidth="10" />
      <rect x={-w / 2 + 12} y={-size * 0.8 + 12} width={w - 24} height={size * 1.5 - 24} rx="18" fill="none" stroke={C.parchment} strokeWidth="4" opacity="0.8" />
      <text textAnchor="middle" y={size * 0.28} fontFamily={HEAD} fontSize={size} fill={C.ink}>{text}</text>
    </g>
  );
};
