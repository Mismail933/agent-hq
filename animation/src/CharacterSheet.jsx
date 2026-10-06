import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Character, Head, POSES, MOUTHS, EXPRESSIONS, CAST_IDS, CAST_INFO} from './Character';
import {C, HEAD, BODY} from './theme';

const MOUTH_NOTE = {A: 'closed (P B M)', B: 'teeth (K S T)', C: 'open (EH)', D: 'wide (AA)', E: 'round (AO)', F: 'pucker (OO W)', G: 'lip+teeth (F V)', H: 'tongue (L)', X: 'rest'};

/** One character's reference sheet: the master every later frame is checked against. */
export const CharacterSheet = ({who = 'narrator'}) => {
  const poses = Object.keys(POSES);
  const info = CAST_INFO[who] || {};
  return (
    <AbsoluteFill style={{background: C.parchment}}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        <text x="48" y="78" fontFamily={HEAD} fontSize="64" fill={C.ink}>{(info.name || who).toUpperCase()}</text>
        <text x="48" y="118" fontFamily={BODY} fontSize="26" fill={C.teal}>{info.role || ''}  ·  held: {info.prop || 'nothing'}  ·  id: {who}</text>
        <Character who={who} pose="stand" mouth="X" x={360} y={1010} scale={0.66} frame={90} enterAt={0} seed={1} />
        <text x="300" y="1064" textAnchor="middle" fontFamily={BODY} fontSize="22" fill={C.ink}>front, standing</text>
        {poses.map((pose, i) => (
          <g key={pose}>
            <Character who={who} pose={pose} mouth="X" x={700 + i * 170} y={430} scale={0.3} frame={90} seed={1} />
            <text x={700 + i * 170} y={452} textAnchor="middle" fontFamily={BODY} fontSize="19" fill={C.ink}>{pose}</text>
          </g>
        ))}
        {MOUTHS.map((m, i) => (
          <g key={m} transform={`translate(${745 + i * 128} 590) scale(0.52)`}>
            <Head who={who} mouth={m} />
            <text x="0" y="150" textAnchor="middle" fontFamily={BODY} fontSize="38" fill={C.ink}>{m}</text>
            <text x="0" y="186" textAnchor="middle" fontFamily={BODY} fontSize="28" fill={C.teal}>{MOUTH_NOTE[m]}</text>
          </g>
        ))}
        {EXPRESSIONS.map((ex, i) => (
          <g key={ex} transform={`translate(${770 + i * 190} 860) scale(0.62)`}>
            <Head who={who} expression={ex} />
            <text x="0" y="150" textAnchor="middle" fontFamily={BODY} fontSize="34" fill={C.ink}>{ex}</text>
          </g>
        ))}
        <text x="700" y="508" fontFamily={BODY} fontSize="22" fill={C.teal}>MOUTHS (Rhubarb Lip Sync shapes)</text>
        <text x="700" y="776" fontFamily={BODY} fontSize="22" fill={C.teal}>EXPRESSIONS (eyes, brows, rest mouth)</text>
        <text x="700" y="1060" fontFamily={BODY} fontSize="20" fill={C.ink} opacity="0.7">Moves: idle (breathing, sway), blink, gestures (poses blend), point, wave, think, walk loop, eyes look around.</text>
      </svg>
    </AbsoluteFill>
  );
};
