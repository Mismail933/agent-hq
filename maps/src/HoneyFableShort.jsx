// The owner's own honey Short (2026-11-14: "use fable ... more alive ... animate something to explain the composition"):
// HoneyFable.jsx is written by Fable (claude-fable-5-1) from ~/fable-honey/BRIEF.md; this wrapper adds the voice-synced captions.
import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {FONT_CSS} from './fonts';
import {Captions} from './FactShort';
import {HoneyFable} from './HoneyFable';

export const HoneyFableShort = ({lines = [], words = [], seconds = 60}) => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: '#1A0F05'}}>
      <style>{FONT_CSS}</style>
      <HoneyFable lines={lines} words={words} seconds={seconds} />
      <Captions words={words} fps={fps} />
    </AbsoluteFill>
  );
};
