import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Character, Head, POSES, MOUTHS, EXPRESSIONS, CAST_INFO, Crowd} from './Character';
import {C, HEAD, BODY} from './theme';

const MOUTH_NOTE = {A: 'closed (P B M)', B: 'teeth (K S T)', C: 'open (EH)', D: 'wide (AA)', E: 'round (AO)', F: 'pucker (OO W)', G: 'lip+teeth (F V)', H: 'tongue (L)', X: 'rest'};

/** One character's reference sheet: the master every later frame is checked against. who="crowd" shows the townspeople. */
export const CharacterSheet = ({who = 'scholar'}) => {
  if (who === 'crowd') {
    return (
      <AbsoluteFill style={{background: C.parchment}}>
        <svg width="1920" height="1080" viewBox="0 0 1920 1080">
          <text x="48" y="78" fontFamily={HEAD} fontSize="64" fill={C.ink}>THE CROWD</text>
          <text x="48" y="118" fontFamily={BODY} fontSize="26" fill={C.teal}>Townspeople for crowd scenes: every one has its own colours and hair, and they react together.</text>
          {['idle', 'cheer', 'gasp', 'laugh'].map((r, i) => (
            <g key={r}>
              <Crowd size={5} reaction={r} frame={60} y={450} seed={i + 1} scale={0.36} from={40 + i * 470} to={460 + i * 470} />
              <text x={250 + i * 470} y={510} textAnchor="middle" fontFamily={BODY} fontSize="26" fill={C.ink}>{r}</text>
            </g>
          ))}
          {['murmur', 'angry', 'scared'].map((r, i) => (
            <g key={r}>
              <Crowd size={6} reaction={r} frame={60} y={960} seed={i + 9} scale={0.4} from={60 + i * 620} to={580 + i * 620} />
              <text x={320 + i * 620} y={1020} textAnchor="middle" fontFamily={BODY} fontSize="26" fill={C.ink}>{r}</text>
            </g>
          ))}
        </svg>
      </AbsoluteFill>
    );
  }
  const poses = Object.keys(POSES);
  const info = CAST_INFO[who] || {};
  return (
    <AbsoluteFill style={{background: C.parchment}}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        <text x="48" y="78" fontFamily={HEAD} fontSize="64" fill={C.ink}>{(info.name || who).toUpperCase()}</text>
        <text x="48" y="118" fontFamily={BODY} fontSize="24" fill={C.teal}>{info.role || ''}  ·  held: {info.prop || 'nothing'}  ·  id: {who}</text>
        <Character who={who} pose="stand" mouth="X" x={300} y={1000} scale={1.05} frame={90} enterAt={0} seed={1} />
        <text x="300" y="1060" textAnchor="middle" fontFamily={BODY} fontSize="22" fill={C.ink}>front, standing</text>
        {poses.map((pose, i) => (
          <g key={pose}>
            <Character who={who} pose={pose} mouth="X" x={700 + i * 135} y={400} scale={0.36} frame={90} seed={1} />
            <text x={700 + i * 135} y={428} textAnchor="middle" fontFamily={BODY} fontSize="19" fill={C.ink}>{pose}</text>
          </g>
        ))}
        <text x="640" y="470" fontFamily={BODY} fontSize="22" fill={C.teal}>MOUTHS (Rhubarb Lip Sync shapes)</text>
        {MOUTHS.map((m, i) => (
          <g key={m} transform={`translate(${700 + i * 135} 560) scale(0.46)`}>
            <Head who={who} mouth={m} />
            <text x="0" y="300" textAnchor="middle" fontFamily={BODY} fontSize="40" fill={C.ink}>{m}</text>
            <text x="0" y="340" textAnchor="middle" fontFamily={BODY} fontSize="30" fill={C.teal}>{MOUTH_NOTE[m]}</text>
          </g>
        ))}
        <text x="640" y="760" fontFamily={BODY} fontSize="22" fill={C.teal}>EXPRESSIONS (eyes, lids, brows, rest mouth)</text>
        {EXPRESSIONS.map((ex, i) => (
          <g key={ex} transform={`translate(${690 + i * 122} 850) scale(0.42)`}>
            <Head who={who} expression={ex} />
            <text x="0" y="310" textAnchor="middle" fontFamily={BODY} fontSize="40" fill={C.ink}>{ex}</text>
          </g>
        ))}
        <text x="640" y="1060" fontFamily={BODY} fontSize="20" fill={C.ink} opacity="0.7">Moves: idle (breathing, sway), blink, talking head-nod, gestures (poses blend), point with a finger, wave, shrug, cheer.</text>
      </svg>
    </AbsoluteFill>
  );
};
