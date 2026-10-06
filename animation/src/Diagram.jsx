import React from 'react';
import {spring, useVideoConfig} from 'remotion';
import {C, HEAD, W, H, easeOut, clamp01, lerp} from './theme';

/*
 * The explainer diagram: a cross-section of the Earth, parallel sunbeams, two rods and the angle between them.
 * It builds itself over the scene: Earth pops, the beams slide in, the rods appear, the slice and its angle are drawn.
 * diagram: { angle_label: "7.2°", fraction: "1/50", a_label: "Alexandria", b_label: "Syene", gap: 22 (drawn angle, not to scale) }
 */
const CX = 440;
const CY = 1020;
const R = 300;

export const Diagram = ({diagram, frame, frames}) => {
  const {fps} = useVideoConfig();
  const p = clamp01(frame / Math.max(1, frames));
  const gap = diagram.gap || 24;
  const a = (gap * Math.PI) / 180;
  const earth = spring({frame, fps, config: {damping: 12, stiffness: 120}});
  const beams = easeOut(clamp01((p - 0.08) / 0.3));
  const rods = spring({frame: frame - frames * 0.3, fps, config: {damping: 10, stiffness: 140}});
  const wedge = easeOut(clamp01((p - 0.5) / 0.25));
  const label = spring({frame: frame - frames * 0.68, fps, config: {damping: 9, stiffness: 130}});
  const pts = {
    b: [CX + R, CY], // Syene: on the equator-side of the picture, sun straight overhead
    a: [CX + R * Math.cos(a), CY - R * Math.sin(a)], // Alexandria, further round
  };
  const n = (pt) => [(pt[0] - CX) / R, (pt[1] - CY) / R]; // outward normal
  const Rod = ({pt, shadowLen, name}) => {
    const [nx, ny] = n(pt);
    const len = 170 * rods;
    const tipX = pt[0] + nx * len;
    const tipY = pt[1] + ny * len;
    return (
      <g>
        {shadowLen > 0 && (
          <line x1={tipX} y1={tipY} x2={tipX - 210 * rods * wedge} y2={tipY} stroke={C.ink} strokeWidth="12" strokeLinecap="round" strokeDasharray="2 18" opacity="0.7" />
        )}
        <line x1={pt[0]} y1={pt[1]} x2={tipX} y2={tipY} stroke={C.ink} strokeWidth="22" strokeLinecap="round" />
        <line x1={pt[0]} y1={pt[1]} x2={tipX} y2={tipY} stroke={C.gold} strokeWidth="10" strokeLinecap="round" />
      </g>
    );
  };
  const ang = (v) => (v * 180) / Math.PI;
  return (
    <g>
      <rect x="-400" y="-200" width="1880" height="2300" fill="#1B3F47" />
      {Array.from({length: 30}).map((_, i) => (
        <circle key={i} cx={(i * 197) % 1080} cy={(i * 331) % 1900} r="3" fill={C.parchment} opacity={0.4 + 0.4 * Math.sin(frame / 12 + i)} />
      ))}
      {/* sunbeams, parallel, drifting toward the Earth */}
      {[-300, -200, -100, 0, 100, 200, 300].map((dy, i) => {
        const y = CY + dy * 0.9;
        const reach = Math.sqrt(Math.max(0, R * R - (y - CY) * (y - CY)));
        const xEnd = CX + reach;
        return (
          <line key={i} x1={xEnd + 560 - 560 * beams} y1={y} x2={xEnd + 560} y2={y} stroke={C.gold} strokeWidth="9" strokeLinecap="round" strokeDasharray="38 24" strokeDashoffset={-frame * 2.4} opacity={beams} />
        );
      })}
      <g transform={`translate(${CX} ${CY}) scale(${Math.max(0.01, earth)}) translate(${-CX} ${-CY})`}>
        <circle cx={CX} cy={CY} r={R} fill={C.teal} stroke={C.ink} strokeWidth="10" />
        <path d={`M ${CX - 200} ${CY - 80} q 60 -90 150 -40 q 60 50 -10 100 q -90 30 -140 -60 Z`} fill="#6FA37D" stroke={C.ink} strokeWidth="6" />
        <path d={`M ${CX - 40} ${CY + 130} q 70 -40 130 20 q 20 70 -60 90 q -80 -10 -70 -110 Z`} fill="#6FA37D" stroke={C.ink} strokeWidth="6" />
        {/* the slice between the two cities */}
        <path d={`M ${CX} ${CY} L ${pts.b[0]} ${pts.b[1]} A ${R} ${R} 0 0 0 ${pts.a[0]} ${pts.a[1]} Z`} fill={C.terracotta} opacity={0.88 * wedge} stroke={C.ink} strokeWidth="7" strokeLinejoin="round" />
      </g>
      <Rod pt={pts.b} shadowLen={0} name="b" />
      <Rod pt={pts.a} shadowLen={1} name="a" />
      {/* angle arc at the centre */}
      <path d={`M ${CX + 120} ${CY} A 120 120 0 0 0 ${CX + 120 * Math.cos(a * wedge)} ${CY - 120 * Math.sin(a * wedge)}`} fill="none" stroke={C.parchment} strokeWidth="9" strokeLinecap="round" />
      <g transform={`translate(${CX + 190} ${CY - 70}) scale(${Math.max(0.01, label)})`} opacity={clamp01(label * 3)}>
        <text textAnchor="middle" fontFamily={HEAD} fontSize="96" fill={C.parchment} stroke={C.ink} strokeWidth="9" paintOrder="stroke">{diagram.angle_label}</text>
      </g>
      <g transform={`translate(${CX} ${CY + R + 190}) scale(${Math.max(0.01, label)})`} opacity={clamp01(label * 3)}>
        <rect x="-300" y="-70" width="600" height="120" rx="26" fill={C.gold} stroke={C.ink} strokeWidth="9" />
        <text textAnchor="middle" y="24" fontFamily={HEAD} fontSize="72" fill={C.ink}>{diagram.fraction} of a circle</text>
      </g>
      {[['a', diagram.a_label, diagram.a_note || 'SHADOW'], ['b', diagram.b_label, diagram.b_note || 'NO SHADOW']].map(([k, name, note]) => {
        const pt = pts[k];
        const [nx, ny] = n(pt);
        return (
          <g key={k} transform={`translate(${pt[0] + nx * 40 + (k === 'a' ? 20 : 0)} ${pt[1] + ny * 40 + (k === 'a' ? -105 : 90)}) scale(${Math.max(0.01, rods)})`} opacity={clamp01(rods * 3)}>
            <text textAnchor="middle" fontFamily={HEAD} fontSize="54" fill={C.parchment} stroke={C.ink} strokeWidth="8" paintOrder="stroke">{name}</text>
            <text textAnchor="middle" y="58" fontFamily={HEAD} fontSize="44" fill={C.gold} stroke={C.ink} strokeWidth="7" paintOrder="stroke">{note}</text>
          </g>
        );
      })}
      <text x={CX} y={CY - R - 40} textAnchor="middle" fontFamily={HEAD} fontSize="30" fill={C.parchment} opacity="0.6">(angle drawn bigger than real)</text>
    </g>
  );
};
