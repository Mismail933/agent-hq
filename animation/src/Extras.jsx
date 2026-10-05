import React from 'react';
import {spring, useVideoConfig} from 'remotion';
import {C, HEAD, LINE, W, H, easeOut, clamp01, lerp} from './theme';

const o = {stroke: C.ink, strokeWidth: LINE, strokeLinejoin: 'round', strokeLinecap: 'round'};

/** A rod standing in the ground with its shadow (sun on the right). shadow: 0 = none, 1 = long. */
export const Rod = ({x = 300, y = 1250, shadow = 0.5, frame}) => {
  const len = 360 * shadow;
  const grow = easeOut(frame / 30);
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M -22 4 L ${-len * grow - 50} 22 L ${-len * grow - 40} 56 L 22 40 Z`} fill={C.ink} opacity="0.35" />
      <rect x="-12" y="-290" width="24" height="290" fill="#8A5A3A" {...o} strokeWidth={6} />
      <circle cx="0" cy="-296" r="16" fill={C.gold} {...o} strokeWidth={6} />
      <ellipse cx="0" cy="8" rx="52" ry="18" fill="#BDA06A" {...o} strokeWidth={6} />
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
