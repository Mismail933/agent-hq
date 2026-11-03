// A starting point for the next Short: three placeholder shots that show the patterns. REPLACE THEM with the story's own scenes.
// Rules: every shot is a pure function of f (frames since the line's cut); pictures arrive ON their word (cue); something new every 2-4 s;
// the camera always drifts; centred on x 540; a new place = a new colour; nothing important below y 1536 or right of x 950 between y 860 and y 1630.
// Registered as composition "NextShort" in Root.jsx by install_pack.py. Read spy.jsx for the full set of scenes (door, stamps, maps, boards, wall of faces).
import React from 'react';
import {Person, Room, Cam, Stamp, Tag, tagIn, cue, makeShort, spr, lin, eas, clamp, SW, SH, st, OSW, INK} from './shortkit';

// a costume without touching FITS (same keys: coat, coatD, legs, hair, cap, band, tie, bow, belt, moustache)
const HERO = {coat: '#2F6B5E', coatD: '#245447', legs: '#2C313C', hair: '#3A2A20', tie: '#D8A32B'};

// 1. Frame one is already the hook: the person, the place, the headline tag up at once
function ShotOpen({f, line, T}) {
  const named = cue(line, 'name', 'man', 0.3), z = eas(f, 0, named + 30, 1.0, 1.12);
  return (
    <g>
      <Cam x={540} y={900} z={z}><Room wall="#27477F" wallD="#1E3966" floor="#8A5A34" floorD="#6F4728" />
        <Person x={540} y={1340} s={1} fit={HERO} T={T} seed={3} expr={f >= named ? 'smug' : 'calm'} look={0.4} /></Cam>
      <Tag x={540} y={170} text="THE HEADLINE" size={66} fill="#FDE047" k={tagIn(f, 0)} />
    </g>
  );
}
// 2. Two people walk in on their words and face each other, balanced round x 540
function ShotTwo({f, line, T}) {
  const a = cue(line, 'a', 'one', 0.2), b = cue(line, 'b', 'other', 0.6), inA = spr((f - a + 6) / 26, 13, 0.75), inB = spr((f - b + 6) / 26, 13, 0.75);
  return (
    <Cam x={540} y={880} z={eas(f, 0, 90, 1.02, 1.1)}><Room wall="#6E2620" wallD="#57201C" floor="#3C2A22" floorD="#2B1E18" fy={1120} />
      {f >= a - 6 && <Person x={250 - (1 - inA) * 520} y={1340} s={1} fit={HERO} T={T} seed={3} expr="hopeful" look={1} walk={1 - inA} />}
      {f >= b - 6 && <Person x={830 + (1 - inB) * 520} y={1340} s={1} flip fit="handler" T={T} seed={7} expr="stare" look={1} walk={1 - inB} />}
    </Cam>
  );
}
// 3. A prop that explains, the result stamped on its word. p.photo on a line shows a real picture over this (see shortkit's PrintLayer).
function ShotProp({f, line}) {
  const hit = cue(line, 'hit', 'stamp', 0.7);
  return (
    <g><rect x={-60} y={-60} width={SW + 120} height={SH + 120} fill="#6B4227" />
      <g transform={`rotate(-3 540 760) scale(${eas(f, 0, 90, 1, 1.05)})`}><rect x={130} y={230} width={820} height={900} rx={8} fill="#F3EBD6" {...st(8)} />
        <text x={540} y={340} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={58} letterSpacing={3} fill={INK}>A DOCUMENT</text>
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M 210 ${440 + i * 70} L ${lin(f, i * 8, i * 8 + 16, 210, 870)} ${440 + i * 70}`} stroke="#B9AE93" strokeWidth={6} />)}</g>
      <Stamp text="DONE" f={f} a={hit} x={540} y={860} rot={-10} k0={0.3} plate />
    </g>
  );
}
export const NextShort = makeShort({k_open: ShotOpen, k_two: ShotTwo, k_prop: ShotProp});
