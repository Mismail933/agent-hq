// The story video (2.48.0): props = {shots: [{kind, start, end, ...}], words: [[w, s, e]], captions, audio, marker_by_frame?,
// channel, title}. Shots are cut back to back (a short dissolve on `transition: "fade"`); captions follow the voice.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig, staticFile, interpolate} from 'remotion';
import {Shot, CornerMarker} from './Scenes';
import {C, W, H, T, FONT, FPS, clamp} from './kit';
import {FONT_CSS} from './fonts';

const Captions = ({words, f, fps}) => {
  const t = f / fps;
  const i = words.findIndex((w) => t >= w[1] && t < w[2] + 0.25);
  if (i < 0) return null;
  // the sentence chunk around the spoken word (up to 7 words, broken at punctuation)
  let a = i, b = i;
  while (a > 0 && i - a < 3 && !/[.!?,;:]$/.test(words[a - 1][0])) a--;
  while (b < words.length - 1 && b - a < 6 && !/[.!?,;:]$/.test(words[b][0])) b++;
  const chunk = words.slice(a, b + 1);
  const text = chunk.map((w) => w[0]).join(' ');
  const size = text.length > 44 ? 40 : 48;
  const width = Math.min(W - 200, text.length * size * 0.58 + 90);
  return (
    <g transform={`translate(${W / 2} ${H - 96})`}>
      <rect x={-width / 2} y={-62} width={width} height={88} rx={22} fill="#000" opacity={0.6} />
      <text x={0} y={2} fontSize={size} fontWeight={900} textAnchor="middle" fontFamily={FONT}>
        {chunk.map((w, k) => <tspan key={k} fill={a + k === i ? C.yellow : '#fff'}>{(k ? ' ' : '') + w[0]}</tspan>)}
      </text>
    </g>
  );
};

export const Story = ({shots = [], words = [], audio, captions = true, channel = '', marker_by_frame = []}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const marker = marker_by_frame.find((m) => frame >= m[0] && frame < m[1]);
  return (
    <AbsoluteFill style={{backgroundColor: '#020A18'}}>
      <style>{FONT_CSS}</style>
      {audio && <Audio src={staticFile(audio)} />}
      {shots.map((s, i) => {
        const len = Math.max(1, s.end - s.start);
        const fade = s.transition === 'fade' ? 12 : 0;
        return (
          <Sequence key={i} from={s.start} durationInFrames={len + (fade ? 12 : 0)} layout="none">
            <ShotLayer shot={{...s, frames: len}} fade={fade} />
          </Sequence>
        );
      })}
      <AbsoluteFill>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
          {marker && <CornerMarker text={marker[2]} f={frame - marker[0]} />}
          {captions && <Captions words={words} f={frame} fps={fps} />}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const ShotLayer = ({shot, fade}) => {
  const f = useCurrentFrame();
  const op = fade ? interpolate(f, [0, fade], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  return (
    <AbsoluteFill style={{opacity: op}}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}><Shot shot={shot} f={f} /></svg>
    </AbsoluteFill>
  );
};

// one frame, for stills and checks
export const StoryStill = ({shots = [], words = [], frame = 0, marker_by_frame = []}) => {
  const i = shots.findIndex((s) => frame >= s.start && frame < s.end);
  const s = shots[i >= 0 ? i : shots.length - 1];
  const marker = marker_by_frame.find((m) => frame >= m[0] && frame < m[1]);
  return (
    <AbsoluteFill style={{backgroundColor: '#020A18'}}>
      <style>{FONT_CSS}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {s && <Shot shot={{...s, frames: s.end - s.start}} f={frame - s.start} />}
        {marker && <CornerMarker text={marker[2]} f={frame - marker[0]} />}
        <Captions words={words} f={frame} fps={FPS} />
      </svg>
    </AbsoluteFill>
  );
};
