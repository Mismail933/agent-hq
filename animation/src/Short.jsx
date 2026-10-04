import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {C, W, H, easeOut, clamp01} from './theme';
import {Camera} from './Camera';
import {BACKDROPS} from './Backdrops';
import {Character} from './Character';
import {MapIntro} from './MapIntro';
import {Diagram} from './Diagram';
import {Rod, Globe, Callout} from './Extras';
import {Captions, TitleCard, Outro} from './Overlays';

/*
 * One episode = one props file (see ../STYLE-GUIDE.md, "scene file"):
 *   audio: 'voice.wav' (in the --public-dir), words: [{w, from, to}] frames, mouth: [0|1|2] per frame,
 *   intro: {place, year}, outro: {channel, handle}, caption_chunks, outro_from,
 *   scenes: [{from, frames, backdrop, tone, camera, characters, props, callout, map, diagram, transition}]
 */
const SLOTS = {left: 300, center: 540, right: 790};
const TRANSITION = 9; // frames the next scene takes to arrive

const Scene = ({scene, mouth, index}) => {
  const frame = useCurrentFrame();
  const g = frame + scene.from; // frame on the whole timeline
  const chars = scene.characters || [];
  const two = chars.length > 1;
  const Back = BACKDROPS[scene.backdrop];
  const t = easeOut(clamp01(frame / TRANSITION));
  const kind = scene.transition || ['slide_left', 'iris', 'slide_up', 'iris'][index % 4];
  let wrap = {};
  let clip = null;
  if (index > 0 && frame < TRANSITION + 1) {
    if (kind === 'slide_left') wrap = {transform: `translate(${(1 - t) * W} 0)`};
    else if (kind === 'slide_up') wrap = {transform: `translate(0 ${(1 - t) * H})`};
    else if (kind === 'iris') clip = (1 - t) * 0 + t * 1500;
  }
  const isMap = scene.backdrop === 'map';
  const isDiagram = scene.backdrop === 'diagram';
  const body = (
    <>
      {isMap && <MapIntro map={scene.map || {focus: [30, 30], zoom: 20}} frame={frame} frames={scene.frames} />}
      {isDiagram && <Diagram diagram={scene.diagram || {}} frame={frame} frames={scene.frames} />}
      {!isMap && !isDiagram && (
        <Camera move={scene.camera || 'push_in'} frame={frame} frames={scene.frames}>
          {Back && <Back frame={frame} tone={scene.tone} />}
          {(scene.props || []).map((p, i) => {
            if (p.type === 'rod') return <Rod key={i} frame={frame} x={p.x ?? 300} y={p.y ?? 1250} shadow={p.shadow ?? 0.5} />;
            if (p.type === 'globe') return <Globe key={i} frame={frame} x={p.x ?? 540} y={p.y ?? 1000} r={p.r ?? 150} />;
            return null;
          })}
          {chars.map((c, i) => (
            <Character
              key={i}
              who={c.who}
              pose={c.pose}
              x={c.x ?? SLOTS[c.at || 'center']}
              y={c.y ?? (two ? 1190 : 1210)}
              scale={c.scale ?? (two ? 1.05 : 1.3)}
              mouth={(c.speaks ?? c.who === 'narrator') ? mouth[Math.min(g, mouth.length - 1)] || 0 : 0}
              frame={frame}
              enterAt={4 + i * 6}
              seed={i + index}
            />
          ))}
        </Camera>
      )}
      {isDiagram && chars.length > 0 && (
        <g>
          {chars.map((c, i) => (
            <Character key={i} who={c.who} pose={c.pose} x={c.x ?? 190} y={c.y ?? 1500} scale={c.scale ?? 0.8} mouth={(c.speaks ?? c.who === 'narrator') ? mouth[Math.min(g, mouth.length - 1)] || 0 : 0} frame={frame} enterAt={10} seed={i + index} />
          ))}
        </g>
      )}
      {scene.callout && <Callout text={scene.callout} frame={frame} y={scene.callout_y ?? 520} />}
    </>
  );
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, ...wrap}}>
      {clip !== null && (
        <defs>
          <clipPath id={`iris-${index}`}>
            <circle cx={W / 2} cy={H * 0.55} r={clip} />
          </clipPath>
        </defs>
      )}
      <g clipPath={clip !== null ? `url(#iris-${index})` : undefined}>{body}</g>
    </svg>
  );
};

export const Short = (props) => {
  const frame = useCurrentFrame();
  const {scenes, mouth = [], intro, outro, caption_chunks: chunks = [], outro_from: outroFrom, audio} = props;
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      {audio && <Audio src={staticFile(audio)} />}
      {scenes.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.frames + (i < scenes.length - 1 ? TRANSITION + 2 : 0)}>
          <Scene scene={s} mouth={mouth} index={i} />
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
