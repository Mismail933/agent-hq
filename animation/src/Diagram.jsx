import React from 'react';
import {spring, useVideoConfig} from 'remotion';
import {C, HEAD, W, H, easeOut, clamp01, lerp} from './theme';

/*
 * The explainer diagram: a cross-section of the Earth, parallel sunbeams, two rods and the angle between them.
 * It builds itself step by step ON THE WORDS that explain it (2.30.0, `diagram.at` = frames from animate.diagram_steps): the beams on
 * "rays/parallel", the two sticks (and Alexandria's shadow) on "stick", the sticks pushed down to the centre on "centre", the
 * slice and the matching angles on "angle", the 1/50 label on "fifty". Without `at` it keeps the old even spacing.
 * diagram: { angle_label: "7.2°", fraction: "1/50", a_label: "Alexandria", b_label: "Syene", gap: 22 (drawn angle, not to scale) }
 */
const CX = 450;
const CY = 800;   // high enough that the fraction label clears the captions (they start at 1310)
const R = 350;   // 2.31.0: bigger (Israa: 'the diagram is small'); its label still clears the captions

export const Diagram = ({diagram, frame, frames}) => {
  const {fps} = useVideoConfig();
  const at = diagram.at || null;
  // a step the voice never names stays hidden (null); without `at` (old scene files) the old even spacing
  const T = (k, frac) => (at ? (at[k] == null ? 1e9 : at[k]) : frames * frac);
  const gap = diagram.gap || 24;
  const a = (gap * Math.PI) / 180;
  const earth = spring({frame, fps, config: {damping: 12, stiffness: 120}});
  const beams = easeOut(clamp01((frame - T('beams', 0.08)) / 24));
  const rods = spring({frame: frame - T('rods', 0.3), fps, config: {damping: 10, stiffness: 140}});
  const centre = easeOut(clamp01((frame - T('centre', 0.45)) / 26));
  const wedge = easeOut(clamp01((frame - T('wedge', 0.6)) / 22));
  const label = spring({frame: frame - T('label', 0.75), fps, config: {damping: 9, stiffness: 130}});
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
          <line x1={tipX} y1={tipY} x2={tipX - 210 * rods} y2={tipY} stroke={C.ink} strokeWidth="12" strokeLinecap="round" strokeDasharray="2 18" opacity="0.7" />
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
      {/* "push both sticks down until they meet at the centre": each stick grows inward to the middle of the Earth */}
      {centre > 0 && [pts.a, pts.b].map((pt, i) => (
        <g key={i}>
          <line x1={pt[0]} y1={pt[1]} x2={lerp(pt[0], CX, centre)} y2={lerp(pt[1], CY, centre)} stroke={C.ink} strokeWidth="16" strokeLinecap="round" />
          <line x1={pt[0]} y1={pt[1]} x2={lerp(pt[0], CX, centre)} y2={lerp(pt[1], CY, centre)} stroke={C.gold} strokeWidth="7" strokeLinecap="round" strokeDasharray="22 14" />
        </g>
      ))}
      <Rod pt={pts.b} shadowLen={0} name="b" />
      <Rod pt={pts.a} shadowLen={1} name="a" />
      {/* Alexandria's stick gets its own sunbeam through its top (2.36.1). 2.36.3 (Israa 4.5 on ep 28: the two "7.2°" labels sat on
          top of each other at the centre): its angle is no longer drawn on the small globe; the close-up above shows it */}
      {wedge > 0 && (() => {
        const [nx, ny] = n(pts.a);
        const tip = [pts.a[0] + nx * 170, pts.a[1] + ny * 170];
        return (
          <g opacity={wedge}>
            <line x1={W + 40} y1={tip[1]} x2={tip[0]} y2={tip[1]} stroke={C.ink} strokeWidth="17" strokeLinecap="round" />
            <line x1={W + 40} y1={tip[1]} x2={tip[0]} y2={tip[1]} stroke={C.gold} strokeWidth="9" strokeLinecap="round" />
          </g>
        );
      })()}
      <CloseUp diagram={diagram} frame={frame} a={a} rodsAt={closeUpFrom(diagram, frames)} wedgeAt={T('wedge', 0.6)} beamsAt={T('beams', 0.08)} />
      {/* angle arc at the centre */}
      <path d={`M ${CX + 120} ${CY} A 120 120 0 0 0 ${CX + 120 * Math.cos(a * wedge)} ${CY - 120 * Math.sin(a * wedge)}`} fill="none" stroke={C.terracotta} strokeWidth="11" strokeLinecap="round" />
      <g transform={`translate(${CX + 190} ${CY - 70}) scale(${Math.max(0.01, wedge)})`} opacity={clamp01(wedge * 3)}>
        <text textAnchor="middle" fontFamily={HEAD} fontSize="96" fill={C.parchment} stroke={C.ink} strokeWidth="9" paintOrder="stroke">{diagram.angle_label}</text>
      </g>
      <g transform={`translate(${CX} ${CY + R + 100}) scale(${Math.max(0.01, label)})`} opacity={clamp01(label * 3)}>
        <rect x="-300" y="-70" width="600" height="120" rx="26" fill={C.gold} stroke={C.ink} strokeWidth="9" />
        <text textAnchor="middle" y="24" fontFamily={HEAD} fontSize="72" fill={C.ink}>{diagram.fraction} of a circle</text>
      </g>
      {[['a', diagram.a_label, diagram.a_note || 'SHADOW'], ['b', diagram.b_label, diagram.b_note || 'NO SHADOW']].map(([k, name, note]) => {
        const pt = pts[k];
        const [nx, ny] = n(pt);
        return (
          <g key={k} transform={`translate(${pt[0] + nx * 40 + (k === 'a' ? 20 : 0)} ${pt[1] + ny * 40 + (k === 'a' ? -175 : 90)}) scale(${Math.max(0.01, rods)})`} opacity={clamp01(rods * 3)}>
            <text textAnchor="middle" fontFamily={HEAD} fontSize="54" fill={C.parchment} stroke={C.ink} strokeWidth="8" paintOrder="stroke">{name}</text>
            <text textAnchor="middle" y="58" fontFamily={HEAD} fontSize="44" fill={C.gold} stroke={C.ink} strokeWidth="7" paintOrder="stroke">{note}</text>
          </g>
        );
      })}
      {closeUpFrom(diagram, frames) >= 1e9 && (
        <text x={W / 2} y={CY - R - 50} textAnchor="middle" fontFamily={HEAD} fontSize="44" fill={C.parchment} opacity="0.85">(angle drawn bigger than real)</text>
      )}
    </g>
  );
};

/** The frame (in the diagram's own count) from which the close-up of Alexandria's stick is up: with the sticks, else the angle.
 * Short.jsx hides a diagram scene's callout from then on (the close-up uses the top of the picture). */
export const closeUpFrom = (diagram, frames) => {
  const at = diagram.at || null;
  const T = (k, frac) => (at ? (at[k] == null ? 1e9 : at[k]) : frames * frac);
  return Math.min(T('rods', 0.3), T('wedge', 0.6));
};

/*
 * 2.36.3 (Israa 4.5 on ep 28; Atlas: "draw the Alexandria stick big on the surface with its shadow and a 7.2° arc between the stick
 * and the sun ray, the centre 7.2° arc separately, and a SAME ANGLE link between the two"). A panel across the top of the picture:
 * flat ground, the stick standing up, slanting parallel sunbeams, the stick's shadow on the ground; on the angle step the arc
 * between the stick and the ray through its top with the angle label, and an arrow down to the centre's angle saying SAME ANGLE.
 * The shadow is drawn long enough to read even when the real angle is small (the diagram is not to scale).
 */
const PX = 70;   // the panel: x 70..1010, y 70..385 (the Alexandria name on the globe starts at about y 425)
const PY = 70;
const PW = W - 140;
const PH = 315;
const GROUND = PY + PH - 40;
const STICK_X = 560;
const STICK_H = 210;

const CloseUp = ({diagram, frame, a, rodsAt, wedgeAt, beamsAt}) => {
  const {fps} = useVideoConfig();
  if (rodsAt >= 1e9) return null;
  const pop = spring({frame: frame - rodsAt, fps, config: {damping: 12, stiffness: 140}});
  if (pop <= 0.001) return null;
  const rays = easeOut(clamp01((frame - Math.min(beamsAt, rodsAt)) / 20));
  const shadow = easeOut(clamp01((frame - rodsAt - 8) / 22));
  const arc = easeOut(clamp01((frame - wedgeAt) / 22));
  const link = easeOut(clamp01((frame - wedgeAt - 18) / 18));
  const top = [STICK_X, GROUND - STICK_H];
  const shown = Math.max(a, (16 * Math.PI) / 180);   // never a hair-thin shadow
  const len = STICK_H * Math.tan(shown);
  const dir = [-Math.sin(shown), Math.cos(shown)];   // the sunbeams come down from the upper right
  const ray = (x0) => {   // a beam through (x0, top) from the panel's top edge down to the ground
    const t0 = -(top[1] - (PY + 14)) / dir[1];
    const t1 = (GROUND - top[1]) / dir[1];
    return [x0 + dir[0] * t0, top[1] + dir[1] * t0, x0 + dir[0] * t1, GROUND];
  };
  const r = 78;
  const label = diagram.angle_label || '';
  return (
    <g opacity={clamp01(pop * 2)}>
      <g transform={`translate(${W / 2} ${PY + PH / 2}) scale(${Math.max(0.01, pop)}) translate(${-W / 2} ${-(PY + PH / 2)})`}>
        <rect x={PX} y={PY} width={PW} height={PH} rx="26" fill="#244E58" stroke={C.ink} strokeWidth="9" />
        <rect x={PX + 4} y={GROUND} width={PW - 8} height={PY + PH - GROUND - 4} fill="#BDA06A" />
        <line x1={PX + 4} y1={GROUND} x2={PX + PW - 4} y2={GROUND} stroke={C.ink} strokeWidth="7" />
        <text x={PX + 30} y={PY + 56} fontFamily={HEAD} fontSize="40" fill={C.parchment} stroke={C.ink} strokeWidth="6" paintOrder="stroke">{(diagram.a_label || 'Alexandria').toUpperCase()} UP CLOSE</text>
        <text x={PX + PW - 26} y={GROUND + 28} textAnchor="end" fontFamily={HEAD} fontSize="24" fill={C.ink} opacity="0.8">(angle drawn bigger)</text>
        {[STICK_X + 250, STICK_X + 390, STICK_X].map((x0, i) => {
          const [x1, y1, x2, y2] = ray(x0);
          return <line key={i} x1={x1} y1={y1} x2={lerp(x1, x2, rays)} y2={lerp(y1, y2, rays)} stroke={C.gold} strokeWidth={i === 2 ? 10 : 7} strokeLinecap="round" strokeDasharray="30 18" opacity={i === 2 ? 1 : 0.6} />;
        })}
        {/* the shadow: dark, on the ground, from the foot of the stick to where the beam over its top lands */}
        <line x1={STICK_X} y1={GROUND + 2} x2={STICK_X - len * shadow} y2={GROUND + 2} stroke={C.ink} strokeWidth="18" strokeLinecap="round" opacity="0.85" />
        {shadow > 0.9 && (
          <text x={STICK_X - len / 2} y={GROUND + 34} textAnchor="middle" fontFamily={HEAD} fontSize="26" fill={C.ink}>SHADOW</text>
        )}
        <line x1={STICK_X} y1={GROUND} x2={top[0]} y2={top[1]} stroke={C.ink} strokeWidth="20" strokeLinecap="round" />
        <line x1={STICK_X} y1={GROUND} x2={top[0]} y2={top[1]} stroke="#8A5A3A" strokeWidth="10" strokeLinecap="round" />
        {/* the angle at the top, between the stick (straight down) and the sunbeam going on past it */}
        {arc > 0 && (
          <g>
            <path d={`M ${top[0]} ${top[1] + r} A ${r} ${r} 0 0 1 ${top[0] + r * dir[0]} ${top[1] + r * dir[1]}`} fill="none" stroke={C.terracotta} strokeWidth="11" strokeLinecap="round" opacity={arc} />
            <text x={top[0] - 75} y={top[1] + 120} textAnchor="end" fontFamily={HEAD} fontSize="66" fill={C.parchment} stroke={C.ink} strokeWidth="8" paintOrder="stroke" opacity={arc}>{label}</text>
          </g>
        )}
      </g>
      {/* SAME ANGLE: an arrow from the close-up down to the angle at the centre of the Earth */}
      {link > 0 && (
        <g opacity={link}>
          <line x1={CX + 190} y1={PY + PH + 6} x2={CX + 190} y2={lerp(PY + PH + 6, CY - 170, link)} stroke={C.parchment} strokeWidth="8" strokeLinecap="round" strokeDasharray="22 14" />
          {link > 0.95 && <path d={`M ${CX + 166} ${CY - 186} L ${CX + 190} ${CY - 150} L ${CX + 214} ${CY - 186} Z`} fill={C.parchment} stroke={C.ink} strokeWidth="5" strokeLinejoin="round" />}
          <g transform={`translate(${CX + 30} ${PY + PH + 92}) rotate(-3)`}>
            <rect x="-150" y="-44" width="300" height="72" rx="18" fill={C.gold} stroke={C.ink} strokeWidth="7" />
            <text textAnchor="middle" y="12" fontFamily={HEAD} fontSize="42" fill={C.ink}>SAME ANGLE</text>
          </g>
        </g>
      )}
    </g>
  );
};
