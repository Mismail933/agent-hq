import React from 'react';
import {AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, HEAD, W, H, easeOut, clamp01, lerp} from './theme';
import {Camera, SAFE} from './Camera';
import {BACKDROPS} from './Backdrops';
import {Character, Crowd, reach} from './Character';
import {MapIntro} from './MapIntro';
import {Diagram} from './Diagram';
import {Rod, Globe, Callout} from './Extras';
import {Captions, TitleCard, Outro} from './Overlays';
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
  // keep every character (and its prop, in every pose it takes in this scene) inside the safe area
  const chars = cast.map((c) => {
    const poses = [c.pose || 'stand', ...beats.filter((b) => b.who === c.who && b.pose).map((b) => b.pose)];
    const rs = poses.map((p) => reach(c.who, p));
    const r = {left: Math.max(...rs.map((q) => q.left)), right: Math.max(...rs.map((q) => q.right)), top: Math.max(...rs.map((q) => q.top))};
    const y = c.y ?? (n > 1 ? 1190 : 1210);
    // the top of the picture belongs to the title card (first scene) and to callouts: heads and props stay below them
    const sc = Math.min(c.scale ?? (n > 2 ? 0.74 : n > 1 ? 0.9 : 1.15), (W - 2 * SAFE) / (r.left + r.right), (y - topLimit) / r.top);
    const x0 = c.x ?? (n > 2 ? SLOTS3 : SLOTS)[c.at || 'center'];
    return {...c, scale: sc, y, r, x: Math.min(W - SAFE - r.right * sc, Math.max(SAFE + r.left * sc, x0))};
  });
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
  // the props that matter (the rod and its shadow) count too
  const rodShadow = (p) => 60 + 360 * (p.shadow ?? 0.5);
  const props = (scene.props || []).map((p) => (p.type === 'rod' ? {...p, x: Math.max(SAFE + rodShadow(p), Math.min(W - SAFE - 40, p.x ?? 300))} : p));
  const xs = [...chars.flatMap((c) => [c.x - c.r.left * c.scale, c.x + c.r.right * c.scale]), ...props.filter((p) => p.type === 'rod').flatMap((p) => [p.x - rodShadow(p), p.x + 40]),
    ...props.filter((p) => p.type === 'globe').flatMap((p) => [(p.x ?? 540) - (p.r ?? 150), (p.x ?? 540) + (p.r ?? 150)])];
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
  const hits = (scene.hits || []).map((h) => ({...h, subject: (h.who && subjects[h.who]) || null}));
  const Back = BACKDROPS[scene.backdrop];
  const t = easeOut(clamp01(frame / TRANSITION));
  const kind = scene.transition || (gag && gag.type === 'cutaway' ? 'whip' : ['slide_left', 'iris', 'slide_up', 'iris'][index % 4]);
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
  const Bespoke = scene.generated ? GENERATED[scene.generated] : null; // a scene the Animator wrote (animator.py)
  const isMap = scene.backdrop === 'map';
  const isDiagram = scene.backdrop === 'diagram';
  const body = Bespoke ? (
    <Bespoke frame={frame} frames={scene.frames} words={scene.words || []} mouth={mouth.slice(scene.from, scene.from + scene.frames)} />
  ) : (
    <>
      {isMap && <MapIntro map={scene.map || {focus: [30, 30], zoom: 20}} frame={frame} frames={scene.frames} />}
      {isDiagram && <Diagram diagram={scene.diagram || {}} frame={frame} frames={scene.frames} />}
      {!isMap && !isDiagram && (
        <Camera move={scene.camera || 'push_in'} frame={frame} frames={scene.frames} focus={focus} spread={spread} topY={topY} topLimit={topLimit} hits={hits}>
          {Back && <Back frame={frame} tone={scene.tone} />}
          {props.map((p, i) => {
            if (p.type === 'rod') return <Rod key={i} frame={frame} x={p.x ?? 300} y={p.y ?? 1250} shadow={p.shadow ?? 0.5} />;
            if (p.type === 'globe') return <Globe key={i} frame={frame} x={p.x ?? 540} y={p.y ?? 1000} r={p.r ?? 150} />;
            return null;
          })}
          {scene.crowd && (
            <Crowd size={scene.crowd.size || 5} reaction={crowdReaction} frame={frame} seed={index + 1}
              y={chars.length ? Math.min(...chars.map((c) => c.y)) - 120 : 1180} scale={chars.length ? 0.48 : 0.62} />
          )}
          {chars.map((c, i) => {
            const st = stateAt(c, beats, frame);
            const [x, walking, dir] = walkPos(c.x, st, frame);
            const facing = (dir || c.facing || 1) * (st.turns % 2 ? -1 : 1);
            return (
              <Character key={i} who={c.who} pose={st.pose} poseTo={st.poseTo} blend={st.blend} expression={st.expression} look={lookOf(c)}
                x={x} y={c.y} scale={c.scale} mouth={mouthOf(c)} frame={frame} enterAt={st.walkIn !== null ? -1000 : 4 + i * 6} seed={i + index}
                facing={facing} walking={walking} action={st.action} actionAge={st.actionAge} />
            );
          })}
        </Camera>
      )}
      {isDiagram && chars.length > 0 && (
        <g>
          {chars.map((c, i) => {
            const st = stateAt(c, beats, frame);
            return (
              <Character key={i} who={c.who} pose={st.pose} poseTo={st.poseTo} blend={st.blend} expression={st.expression} x={cast[i].x ?? 190} y={cast[i].y ?? 1500}
                scale={cast[i].scale ?? 0.7} mouth={mouthOf(c)} frame={frame} enterAt={10} seed={i + index} />
            );
          })}
        </g>
      )}
      {scene.callout && frame >= (scene.callout_from ?? 0) && (
        <Callout text={scene.callout} frame={frame - (scene.callout_from ?? 0)} y={isMap || isDiagram ? scene.callout_y ?? 520 : 215} />
      )}
      {gag && gag.type === 'cutaway' && <CutawayTag text={(gag.text || 'MEANWHILE...').toUpperCase()} frame={frame} />}
    </>
  );
  const pointAt = gag && gag.who && subjects[gag.who] ? subjects[gag.who].focus : null;
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
  const {scenes, mouth = [], speaker = null, intro, outro, caption_chunks: chunks = [], outro_from: outroFrom, audio} = props;
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      {audio && <Audio src={staticFile(audio)} />}
      {scenes.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.frames + (i < scenes.length - 1 ? TRANSITION + 2 : 0)}>
          <Scene scene={s} mouth={mouth} speaker={speaker} index={i} />
        </Sequence>
      ))}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0}}>
        {intro && <TitleCard intro={intro} frame={frame} />}
      </svg>
      <Captions chunks={chunks} frame={frame} />
      {outro && frame >= outroFrom && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0}}>
          <Outro outro={outro} frame={frame - outroFrom} />
        </svg>
      )}
    </AbsoluteFill>
  );
};
