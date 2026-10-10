import React from 'react';
import {AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, HEAD, W, H, easeOut, clamp01, lerp} from './theme';
import {Camera, SAFE} from './Camera';
import {BACKDROPS} from './Backdrops';
import {Character, Crowd, reach} from './Character';
import {MapIntro} from './MapIntro';
import {Diagram} from './Diagram';
import {Rod, Globe, Callout} from './Extras';
import {Captions, TitleCard, EpisodeTitle, Outro} from './Overlays';
import GENERATED from './generated/index.js';

/*
 * One episode = one props file (see ../STYLE-GUIDE.md, "scene file"):
 *   audio: 'voice.wav' (in the --public-dir), words: [{w, from, to}] frames, mouth: [0|1|2] per frame,
 *   intro: {place, year}, outro: {channel, handle}, caption_chunks, outro_from,
 *   scenes: [{from, frames, backdrop, tone, camera, characters, props, callout, map, diagram, transition}]
 */
const SLOTS = {left: 330, center: 540, right: 750};
const SLOTS3 = {left: 250, center: 540, right: 830};
const TRANSITION = 9; // frames the next scene takes to arrive
const WALK = 28;      // frames a walk in or out takes
const OFF = 420;      // how far off the picture a character waits before walking in
const PACE = 70;      // frames a 'pace' action walks on the spot (the bematist's "step, step, step")

// Staging (2.29.0, the owner's "people overlap, the sizes and the perspective are wrong" after ep 22; studied on OverSimplified):
// - the cast stands ON the floor, in front of the back wall: feet at FEET[backdrop] (each backdrop's floor starts at FLOOR);
// - one scale for everybody in a scene (only a person's own `tall` differs), so nobody shrinks because his arm is out;
// - side by side with a real gap, facing each other; an arm may reach towards the other, a body never covers another body;
// - a crowd stands further back, smaller, with its heads near the cast's eye line (an eye-level camera), never in front.
const FLOOR = {court: 1130, library: 1180, street: 1150, desert: 1200, study: 1100, nile: 1240, well: 1160, well_side: 860, card: 1150};
const FEET = {court: 1430, library: 1460, street: 1440, desert: 1470, study: 1400, nile: 1480, well: 1440, well_side: 900, card: 1440};
const BASE_SCALE = [1.3, 1.3, 1.15, 0.98, 0.86]; // by the number of people on screen
const GAP = 70;       // px between two bodies
const HEIGHT = 612;   // a figure's height at scale 1 (head top), before its own `tall`
const ROD_K = 1.35;   // a rod stands about two thirds of a person's height, so its shadow reads at a glance

// half the width of a body at scale 1 (shoulders, cloak) and how far its hands and prop reach to the back and the front
const bodyOf = (who, poses, noProp) => {
  const rs = poses.map((p) => reach(who, p, noProp));
  const st = reach(who, 'stand', true);
  const half = Math.max(st.left, st.right);
  // the hand away from the other person may be cut by the frame edge (as in any close shot), so only part of it counts
  return {half, back: Math.max(half, 0.6 * Math.max(...rs.map((q) => q.left))), front: Math.max(half, ...rs.map((q) => q.right)),
    top: Math.max(...rs.map((q) => q.top))};
};

// Lays the scene's people (and a rod, which is staged like a person) out in a row: returns [{x, facing}] and the shared scale.
const stage = (items, feet, topLimit) => {
  if (!items.length) return {scale: 1, placed: []};
  const n = items.filter((it) => !it.prop).length;
  let s = BASE_SCALE[Math.min(n, BASE_SCALE.length - 1)];
  s = Math.min(s, ...items.filter((it) => !it.prop).map((it) => (feet - topLimit) / it.b.top));
  // facing: the left half looks right, the right half looks left (towards each other); a lone person faces his `facing` or right
  const order = items.map((it, i) => ({...it, i})).sort((a, b) => a.want - b.want);
  const m = order.length;
  order.forEach((it, k) => {
    it.facing = it.facing0 || (m === 1 ? 1 : k < m / 2 ? 1 : -1);
    if (m > 1 && m % 2 === 1 && k === (m - 1) / 2 && !it.facing0) it.facing = it.want < W / 2 ? 1 : -1;
  });
  const span = (sc) => {
    // left and right extents of each item at this scale (front = the side it faces)
    const ext = order.map((it) => (it.facing > 0 ? [it.b.back, it.b.front] : [it.b.front, it.b.back]).map((v) => v * sc));
    const xs = [Math.max(order[0].want, SAFE + ext[0][0])];
    for (let k = 1; k < order.length; k += 1) {
      const a = order[k - 1];
      const b = order[k];
      // bodies apart by GAP; a hand reaching towards the other stops short of the other's middle
      const bodies = (a.b.half + b.b.half) * sc + GAP;
      const reachA = a.facing > 0 ? a.b.front * sc + b.b.half * sc * 0.35 : 0;
      const reachB = b.facing < 0 ? b.b.front * sc + a.b.half * sc * 0.35 : 0;
      xs.push(Math.max(b.want, xs[k - 1] + Math.max(bodies, reachA, reachB)));
    }
    const left = xs[0] - ext[0][0];
    const right = xs[xs.length - 1] + ext[ext.length - 1][1];
    return {xs, left, right};
  };
  let lay = span(s);
  for (let k = 0; k < 12 && lay.right - lay.left > W - 2 * SAFE; k += 1) {
    s *= 0.93;
    lay = span(s);
  }
  // centre the group where it wanted to be, inside the safe area
  const wantMid = order.reduce((a, it) => a + it.want, 0) / Math.max(1, order.length);
  let shift = wantMid - (lay.left + lay.right) / 2;
  shift = Math.max(SAFE - lay.left, Math.min(W - SAFE - lay.right, shift * 0.5 + (W / 2 - (lay.left + lay.right) / 2) * 0.5));
  const out = [];
  order.forEach((it, k) => { out[it.i] = {x: lay.xs[k] + shift, facing: it.facing}; });
  return {scale: s, placed: out};
};

// Who is doing what at this frame of the scene: a character's pose and face change on its own lines (beats), blending in over 8
// frames; actions (2.22.1) say how long ago the last one began, how often he has turned, and where a walk in or out has got to.
const stateAt = (c, beats, frame) => {
  let pose = c.pose || 'stand';
  let prev = pose;
  let since = null;
  let expression = c.expression || 'neutral';
  let action = null;
  let actionAt = 0;
  let turns = 0;
  let walkIn = null;
  let walkOut = null;
  for (const b of beats) {
    if (b.who !== c.who) continue;
    if (b.action === 'walk_in') walkIn = b.at;   // known from the start: he waits off the picture until then
    if (b.at > frame) continue;
    if (b.pose && b.pose !== pose) {
      prev = pose;
      pose = b.pose;
      since = frame - b.at;
    }
    if (b.expression) expression = b.expression;
    if (b.action) {
      action = b.action;
      actionAt = b.at;
      if (b.action === 'turn') turns += 1;
      if (b.action === 'walk_out') walkOut = b.at;
    }
  }
  return {pose: prev, poseTo: pose, blend: since === null ? 1 : easeOut(clamp01(since / 8)), expression, action,
    actionAge: action ? frame - actionAt : null, turns, walkIn, walkOut};
};

// Where a walking character is: [x, walking, direction]. side: -1 = he comes from / leaves by the left.
const walkPos = (x, st, frame) => {
  const side = x < W / 2 ? -1 : 1;
  const off = side < 0 ? -OFF : W + OFF;
  if (st.walkOut !== null && frame >= st.walkOut) {
    const p = clamp01((frame - st.walkOut) / WALK);
    return [lerp(x, off, p), p < 1, side];
  }
  if (st.walkIn !== null) {
    if (frame < st.walkIn) return [off, false, -side];
    const p = clamp01((frame - st.walkIn) / WALK);
    return [lerp(off, x, p), p < 1, -side];
  }
  return [x, false, 0];
};

// The freeze-frame label (OverSimplified's "Eratosthenes, overachiever"): the picture stops, tints, a ribbon slides in.
const FreezeLabel = ({text, age, frames, pointX}) => {
  const {fps} = useVideoConfig();
  const pop = spring({frame: age - 2, fps, config: {damping: 12, stiffness: 170, mass: 0.6}});
  const out = 1 - easeOut(clamp01((age - frames + 6) / 6));
  const fs = Math.max(44, Math.min(76, 900 / Math.max(1, text.length * 0.56)));
  const w = Math.min(W - 160, text.length * fs * 0.56 + 100);
  const px = Math.max(W / 2 - w / 2 + 60, Math.min(W / 2 + w / 2 - 60, pointX ?? W / 2));
  return (
    <g opacity={out}>
      <rect x="-400" y="-200" width="1880" height="2300" fill="#8A6A45" opacity="0.32" style={{mixBlendMode: 'multiply'}} />
      {age < 3 && <rect x="-400" y="-200" width="1880" height="2300" fill={C.white} opacity={0.7 * (1 - age / 3)} />}
      <g transform={`translate(${W / 2 + (1 - pop) * -W} 560) rotate(-2)`}>
        <path d={`M ${px - W / 2 - 24} 52 L ${px - W / 2} 96 L ${px - W / 2 + 24} 52 Z`} fill={C.parchment} stroke={C.ink} strokeWidth="8" strokeLinejoin="round" />
        <rect x={-w / 2} y="-60" width={w} height="116" rx="20" fill={C.parchment} stroke={C.ink} strokeWidth="9" />
        <text textAnchor="middle" y={fs * 0.34} fontFamily={HEAD} fontSize={fs} fill={C.ink}>{text}</text>
      </g>
    </g>
  );
};

// A cutaway's tag in the corner ("MEANWHILE...") for its first second and a half.
const CutawayTag = ({text, frame}) => {
  const {fps} = useVideoConfig();
  if (frame > 50) return null;
  const pop = spring({frame: frame - 3, fps, config: {damping: 11, stiffness: 160}});
  const out = 1 - easeOut(clamp01((frame - 42) / 8));
  const fs = 52;
  const w = Math.min(W - 160, text.length * fs * 0.56 + 70);
  return (
    <g opacity={out} transform={`translate(${SAFE + 20 + w / 2} 420) rotate(-4) scale(${Math.max(0.01, pop)})`}>
      <rect x={-w / 2} y="-46" width={w} height="88" rx="16" fill={C.terracotta} stroke={C.ink} strokeWidth="8" />
      <text textAnchor="middle" y="18" fontFamily={HEAD} fontSize={fs} fill={C.parchment}>{text}</text>
    </g>
  );
};

const Scene = ({scene, mouth, speaker, index}) => {
  const real = useCurrentFrame();
  // a freeze-frame gag stops the picture (everything, mouths too) while the voice goes on; then it carries on from now
  const gag = scene.gag || null;
  const frozen = gag && gag.type === 'freeze_label' && real >= gag.at && real < gag.at + (gag.frames || 48);
  const frame = frozen ? gag.at : real;
  const g = frame + scene.from; // frame on the whole timeline
  const cast = scene.characters || [];
  const n = cast.length;
  const beats = scene.beats || [];
  const topLimit = index === 0 ? 410 : scene.callout && !['map', 'diagram'].includes(scene.backdrop) ? 340 : SAFE;
  // the staging (see `stage`): everyone on the floor, one scale, side by side with a gap, facing each other, inside the safe area
  const rodsIn = (scene.props || []).filter((p) => p.type === 'rod');
  // a rod's shadow lies on the ground, so a rod scene stands a little further back: the shadow stays above the captions
  const feet = rodsIn.length ? Math.min(FEET[scene.backdrop] ?? 1440, (FLOOR[scene.backdrop] ?? 1150) + 110) : FEET[scene.backdrop] ?? 1440;
  const noProp = rodsIn.length > 0;   // the scene is about the rod: nobody carries a staff that could be mistaken for it
  const items = [
    ...cast.map((c) => {
      const poses = [c.pose || 'stand', ...beats.filter((b) => b.who === c.who && b.pose).map((b) => b.pose)];
      // beside the well's mouth, never on it (well_side): people stand left or right of the shaft
      const want = scene.backdrop === 'well_side' && c.x == null ? (c.at === 'right' ? 880 : 210) : c.x ?? (n > 2 ? SLOTS3 : SLOTS)[c.at || 'center'];
      return {b: bodyOf(c.who, poses, noProp), want, facing0: c.facing || 0};
    }),
    ...rodsIn.map((p) => ({prop: true, facing0: 1, want: p.x ?? 540,
      b: {half: 30 * ROD_K, back: (60 + 360 * (p.shadow ?? 0.5)) * ROD_K, front: 120 * ROD_K, top: 320 * ROD_K}})),
  ];
  const {scale: sc, placed} = stage(items, feet, topLimit);
  if (scene.backdrop === 'well_side') items.forEach((it, i) => { if (!it.prop) placed[i].x = it.want; });   // keep them off the shaft
  const chars = cast.map((c, i) => {
    const {back, front, top} = items[i].b;
    const facing = placed[i].facing;
    // r: how far he reaches to the left and the right of x on screen (his front is the side he faces)
    return {...c, scale: sc, y: c.y ?? feet, x: placed[i].x, facing, r: facing > 0 ? {left: back, right: front, top} : {left: front, right: back, top}};
  });
  const rodX = rodsIn.map((_, k) => placed[cast.length + k].x);
  const who = speaker ? speaker[Math.min(g, speaker.length - 1)] || '' : null;
  const speakingChar = who ? chars.find((c) => c.who === who) : null;
  const mouthOf = (c) => {
    if (who === null) return (c.speaks ?? c.who === 'narrator') ? mouth[Math.min(g, mouth.length - 1)] || 0 : 0;   // old scene files
    return who === c.who ? mouth[Math.min(g, mouth.length - 1)] || 'X' : 'X';
  };
  // everyone else looks at whoever is talking
  const lookOf = (c) => (speakingChar && speakingChar !== c ? [Math.sign(speakingChar.x - c.x) * 7, 0] : [0, 0]);
  const crowdBeat = [...beats].reverse().find((b) => b.who === 'crowd' && b.at <= frame);
  const crowdReaction = (crowdBeat && crowdBeat.reaction) || (scene.crowd && scene.crowd.reaction) || 'idle';
  // the props that matter (the rod and its shadow) count too; a rod is staged in the row like a person, at the cast's scale
  const rodShadow = (p) => (60 + 360 * (p.shadow ?? 0.5)) * sc * ROD_K;
  let rk = 0;
  const props = (scene.props || []).map((p) => (p.type === 'rod' ? {...p, x: rodX[rk++], y: feet, scale: sc * ROD_K} : p));
  const xs = [...chars.flatMap((c) => [c.x - c.r.left * c.scale, c.x + c.r.right * c.scale]), ...props.filter((p) => p.type === 'rod').flatMap((p) => [p.x - rodShadow(p), p.x + 120 * sc * ROD_K]),
    ...props.filter((p) => p.type === 'globe').flatMap((p) => [(p.x ?? 540) - (p.r ?? 150), (p.x ?? 540) + (p.r ?? 150)])];
  if (scene.backdrop === 'well_side') xs.push(370, 710);   // the well itself is the subject too: keep the shaft in the shot
  const minX = xs.length ? Math.min(...xs) : W / 2;
  const maxX = xs.length ? Math.max(...xs) : W / 2;
  const focus = [(minX + maxX) / 2, H / 2];
  const spread = xs.length ? (maxX - minX) / 2 : 0;
  const topY = chars.length ? Math.min(...chars.map((c) => c.y - c.r.top * c.scale)) : null;
  // camera hits name a character: the camera frames that one person (his own width and height, inside the safe area)
  const subjects = {};
  chars.forEach((c) => {
    const l = c.x - c.r.left * c.scale;
    const r = c.x + c.r.right * c.scale;
    subjects[c.who] = {focus: (l + r) / 2, spread: (r - l) / 2, topY: c.y - c.r.top * c.scale};
  });
  const hits = scene.ending || scene.backdrop === 'card' ? [] : (scene.hits || []).map((h) => ({...h, subject: (h.who && subjects[h.who]) || null}));
  const Back = BACKDROPS[scene.backdrop];
  const t = easeOut(clamp01(frame / TRANSITION));
  // OverSimplified cuts: a plain cut between scenes (the movement is inside the shot); a whip only into a cutaway or when the
  // script asks for one. Slides and irises on every scene read as busy (2.29.0).
  const kind = gag && gag.type === 'cutaway' ? 'whip' : scene.transition === 'whip' ? 'whip' : 'cut';
  let wrap = {};
  let clip = null;
  let blur = false;
  if (index > 0 && frame < TRANSITION + 1) {
    if (kind === 'slide_left') wrap = {transform: `translate(${(1 - t) * W}px, 0px)`};
    else if (kind === 'slide_up') wrap = {transform: `translate(0px, ${(1 - t) * H}px)`};
    else if (kind === 'iris') clip = (1 - t) * 0 + t * 1500;
    else if (kind === 'whip') {
      const tw = easeOut(clamp01(frame / 6));
      wrap = {transform: `translate(${(1 - tw) * W}px, 0px)`};
      blur = tw < 1;
    }
  }
  const Bespoke = scene.generated ? GENERATED[scene.generated] : null; // a scene Rana wrote (animator.py)
  const isMap = scene.backdrop === 'map';
  const off = scene.frame_offset || 0;   // a split part of one map / diagram: carry on, don't start the drawing again
  const isDiagram = scene.backdrop === 'diagram';
  const body = Bespoke ? (
    <Bespoke frame={frame} frames={scene.frames} words={scene.words || []} mouth={mouth.slice(scene.from, scene.from + scene.frames)} />
  ) : (
    <>
      {isMap && <MapIntro map={{...(scene.map || {focus: [30, 30], zoom: 20}), ...(scene.callout ? {route_label: null} : {})}} frame={frame + off} frames={scene.frames + off} />}
      {isDiagram && <Diagram diagram={scene.diagram || {}} frame={frame + off} frames={scene.frames + off} />}
      {!isMap && !isDiagram && (
        <Camera move={scene.ending ? 'ending' : scene.backdrop === 'card' ? 'still' : scene.camera || 'push_in'} frame={frame} frames={scene.frames} focus={focus} spread={spread} topY={topY} topLimit={topLimit} hits={hits}>
          {Back && <Back frame={frame} tone={scene.tone} scene={scene} />}
          {props.map((p, i) => {
            if (p.type === 'rod') return <Rod key={i} frame={frame} x={p.x} y={p.y} shadow={p.shadow ?? 0.5} scale={p.scale} revealAt={p.reveal_at ?? 0} beamAt={p.beam_at ?? null} label={p.angle_label || null} plantAt={p.plant_at ?? null} />;
            if (p.type === 'globe') return <Globe key={i} frame={frame} x={p.x ?? 540} y={p.y ?? 1000} r={p.r ?? 150} slices={p.slices || 0} sliceAt={p.slice_at ?? null} />;
            return null;
          })}
          {scene.crowd && (() => {
            // further back, on the floor just in front of the wall; heads a little under the cast's eye line (perspective)
            const floor = FLOOR[scene.backdrop] ?? feet - 280;
            const cy = floor + 50;
            const castHead = feet - HEIGHT * sc;
            const cs = Math.max(0.35, Math.min(sc * 0.8, (cy - castHead - 40) / HEIGHT));
            return <Crowd size={scene.crowd.size || 5} reaction={crowdReaction} frame={frame} seed={index + 1} y={cy} scale={cs} from={SAFE + 40} to={W - SAFE - 40} />;
          })()}
          {chars.map((c, i) => {
            const st = stateAt(c, beats, frame);
            let [x, walking, dir] = walkPos(c.x, st, frame);
            // 'pace': walks on the spot for a moment, drifting forward a little (a surveyor counting his steps)
            if (st.action === 'pace' && st.actionAge < PACE) {
              walking = true;
              x += (c.facing || 1) * lerp(-90, 90, st.actionAge / PACE) * sc;
            }
            const facing = (dir || c.facing || 1) * (st.turns % 2 ? -1 : 1);
            return (
              <Character key={i} who={c.who} pose={st.pose} poseTo={st.poseTo} blend={st.blend} expression={st.expression} look={lookOf(c)}
                x={x} y={c.y} scale={c.scale} mouth={mouthOf(c)} frame={frame} enterAt={st.walkIn !== null ? -1000 : 4 + i * 6} seed={i + index}
                facing={facing} walking={walking} action={st.action} actionAge={st.actionAge} noProp={noProp}
                speaking={who === null ? null : who === c.who} />
            );
          })}
        </Camera>
      )}
      {isDiagram && chars.length > 0 && (
        <g>
          {/* in a diagram the people step aside: small, in the bottom corners under the captions, never over the drawing */}
          {chars.slice(0, 2).map((c, i) => {
            const st = stateAt(c, beats, frame);
            const left = chars.length === 1 ? (c.at || 'left') !== 'right' : i === 0;
            return (
              <Character key={i} who={c.who} pose={st.pose} poseTo={st.poseTo} blend={st.blend} expression={st.expression} x={left ? 170 : W - 170} y={1890}
                scale={0.46} mouth={mouthOf(c)} frame={frame} enterAt={10} seed={i + index} facing={left ? 1 : -1} noProp />
            );
          })}
        </g>
      )}
      {scene.callout && frame >= (scene.callout_from ?? 0) && (
        <Callout text={scene.callout} frame={frame - (scene.callout_from ?? 0)} y={isDiagram ? 300 : 215} />
      )}
      {gag && gag.type === 'cutaway' && <CutawayTag text={(gag.text || 'MEANWHILE...').toUpperCase()} frame={frame} />}
    </>
  );
  const pointAt = gag && gag.who && subjects[gag.who] ? W / 2 : null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, ...wrap}}>
      <defs>
        {clip !== null && (
          <clipPath id={`iris-${index}`}>
            <circle cx={W / 2} cy={H * 0.55} r={clip} />
          </clipPath>
        )}
        {blur && <filter id={`whip-in-${index}`} x="-20%" y="0" width="140%" height="100%"><feGaussianBlur stdDeviation="30 0" /></filter>}
      </defs>
      <g clipPath={clip !== null ? `url(#iris-${index})` : undefined} filter={blur ? `url(#whip-in-${index})` : undefined}>{body}</g>
      {frozen && gag.text && <FreezeLabel text={gag.text} age={real - gag.at} frames={gag.frames || 48} pointX={pointAt} />}
    </svg>
  );
};

export const Short = (props) => {
  const frame = useCurrentFrame();
  const {scenes, mouth = [], speaker = null, intro, outro, caption_chunks: chunks = [], outro_from: outroFrom, audio, title = null} = props;
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      {audio && <Audio src={staticFile(audio)} />}
      {scenes.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.frames + (i < scenes.length - 1 ? TRANSITION + 2 : 0)}>
          <Scene scene={s} mouth={mouth} speaker={speaker} index={i} />
        </Sequence>
      ))}
      {!title && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0}}>
          {intro && <TitleCard intro={intro} frame={frame} />}
        </svg>
      )}
      <Captions chunks={chunks} frame={frame} />
      {title && frame >= title.from && frame < title.from + title.frames && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0}}>
          <EpisodeTitle title={title} frame={frame - title.from} />
        </svg>
      )}
      {outro && frame >= outroFrom && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0}}>
          <Outro outro={outro} frame={frame - outroFrom} />
        </svg>
      )}
    </AbsoluteFill>
  );
};
