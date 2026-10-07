import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {C, W, H, HEAD, easeInOut, clamp01} from './theme';
import {BACKDROPS} from './Backdrops';
import {Character, CAST_INFO, reach} from './Character';
import {SAFE} from './Camera';

/*
 * The character test: one character, 30 seconds, three shots, to prove the rig holds together.
 *   shot 1 (0-10 s)   a real close-up (head and shoulders: arms, feet and prop are out of frame on purpose), talking, expressions change
 *   shot 2 (10-20 s)  full body: walks in from off-screen left, waves, walks right, back left, settles
 *   shot 3 (20-30 s)  medium (waist up): present, point, think, amazed: each a clearly different pose
 * Everything that is not entering from off-screen stays inside the 60 px safe area, using each pose's real reach.
 * props: {who, mouth: [rhubarb letter per frame], audio, durationInFrames}
 */
const SHOTS = [
  {name: 'close-up', noProp: true, fit: 'head', scale: 3.0, headY: 760},   // head and shoulders: arms and feet fall outside the frame by design
  {name: 'walk', scale: 0.9, y: 1300},
  {name: 'gestures', scale: 1.3, y: 1500},   // the largest full-length framing in which hands and prop stay inside
];
// [from, to, shot, pose, expression, look, walk (x at start, x at end) or null]
const MOVES = [
  [0, 90, 0, 'stand', 'neutral', [0, 0], null],
  [90, 180, 0, 'stand', 'happy', [4, 0], null],
  [180, 240, 0, 'think', 'thinking', [-5, -5], null],
  [240, 300, 0, 'stand', 'surprised', [0, 0], null],
  [300, 390, 1, 'stand', 'neutral', [0, 0], [-420, 560]],
  [390, 450, 1, 'wave', 'happy', [0, 0], null],
  [450, 510, 1, 'stand', 'determined', [6, 0], [560, 700]],
  [510, 570, 1, 'stand', 'neutral', [-6, 0], [700, 420]],
  [570, 600, 1, 'stand', 'happy', [0, 0], [420, 560]],
  [600, 690, 2, 'present', 'happy', [0, 0], null],
  [690, 760, 2, 'point', 'determined', [6, 0], null],
  [760, 830, 2, 'think', 'thinking', [-4, -6], null],
  [830, 900, 2, 'amazed', 'surprised', [0, 0], null],
];

export const CharacterTest = ({who = 'scholar', mouth = [], audio}) => {
  const frame = useCurrentFrame();
  let mi = MOVES.findIndex((m) => frame < m[1]);
  if (mi < 0) mi = MOVES.length - 1;
  const [from, to, si, pose, expression, look, walk] = MOVES[mi];
  const prev = mi > 0 && MOVES[mi - 1][2] === si ? MOVES[mi - 1] : null;
  const shot = SHOTS[si];
  const local = frame - from;
  const blend = prev ? easeInOut(clamp01(local / 18)) : 1;
  const poseFrom = prev ? prev[3] : pose;
  // the widest reach of the poses involved, so nothing is cropped while one pose melts into the next
  const rs = [reach(who, pose, shot.noProp), reach(who, poseFrom, shot.noProp)];
  const r = shot.fit === 'head' ? {left: 130, right: 130, top: 640}
    : {left: Math.max(rs[0].left, rs[1].left), right: Math.max(rs[0].right, rs[1].right), top: Math.max(rs[0].top, rs[1].top)};
  const y = shot.headY ? shot.headY + 478 * shot.scale : shot.y;
  const scale = Math.min(shot.scale, (W - 2 * SAFE) / (r.left + r.right), (y - SAFE) / r.top);
  const lo = SAFE + r.left * scale;
  const hi = W - SAFE - r.right * scale;
  const settled = (v) => Math.min(hi, Math.max(lo, v));
  const t = clamp01(local / Math.max(1, to - from));
  const x = walk ? walk[0] + (walk[1] - walk[0]) * easeInOut(t) : settled(shot.x ?? W / 2);
  const info = CAST_INFO[who] || {};
  const Back = BACKDROPS.court;
  const m = mouth.length ? mouth[Math.min(frame, mouth.length - 1)] || 'X' : 'X';
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      {audio && <Audio src={staticFile(audio)} />}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0}}>
        {Back && <Back frame={frame} tone="noon" />}
        <Character who={who} pose={poseFrom} poseTo={prev ? pose : null} blend={blend} expression={expression} look={look} noProp={!!shot.noProp}
          mouth={m} x={x} y={y} scale={scale} frame={frame} enterAt={-40} seed={2} walking={!!walk} />
        <text x="540" y="1840" textAnchor="middle" fontFamily={HEAD} fontSize="54" fill={C.parchment} stroke={C.ink} strokeWidth="9" paintOrder="stroke">
          {(info.name || who).toUpperCase()}: {shot.name.toUpperCase()}
        </text>
      </svg>
    </AbsoluteFill>
  );
};
