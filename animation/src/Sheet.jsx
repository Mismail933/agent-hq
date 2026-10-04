import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Character, POSES, CAST_IDS} from './Character';
import {C, HEAD, BODY, SKIN} from './theme';

// The style kit at a glance: every character in every pose (mouth shape cycling closed / mid / open), and the palette.
export const Sheet = () => {
  const poses = Object.keys(POSES);
  const swatches = [...Object.entries(C).filter(([k]) => k !== 'white'), ...Object.entries(SKIN).map(([k, v]) => ['skin ' + k, v])];
  return (
    <AbsoluteFill style={{background: C.parchment}}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        <text x="48" y="74" fontFamily={HEAD} fontSize="58" fill={C.ink}>POV THEN HISTORY: STYLE KIT</text>
        <text x="1872" y="70" textAnchor="end" fontFamily={BODY} fontSize="28" fill={C.teal}>poses: {poses.join(' / ')}   mouths: closed / mid / open</text>
        {CAST_IDS.map((who, r) =>
          poses.map((pose, c) => (
            <Character
              key={who + pose}
              who={who}
              pose={pose}
              mouth={(c + r) % 3}
              x={r * 640 + 190 + (c % 2) * 290}
              y={470 + Math.floor(c / 2) * 400}
              scale={0.46}
              frame={60}
              seed={r}
            />
          )),
        )}
        {swatches.map(([name, hex], i) => (
          <g key={name} transform={`translate(${48 + i * 205} 960)`}>
            <rect width="180" height="64" rx="12" fill={hex} stroke={C.ink} strokeWidth="5" />
            <text x="90" y="98" textAnchor="middle" fontFamily={BODY} fontSize="22" fill={C.ink}>{name} {hex}</text>
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
