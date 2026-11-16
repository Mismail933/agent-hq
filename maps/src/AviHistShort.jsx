// Bassel's long History of Aviation (2026-11-16, "Go for both"): chapters in 16:9. AviHistory<N>.jsx are written by Fable
// (claude-fable-5-1) from ~/fable-avh<N>/BRIEF.md; this wrapper adds the voice-synced captions along the bottom. Prop `chapter`.
import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {FONT_CSS} from './fonts';
import {Captions} from './FactShort';
import {AviHistory1} from './AviHistory1';

const CHAPTERS = {1: AviHistory1};

export const AviHistShort = ({chapter = 1, lines = [], words = [], seconds = 360}) => {
  const {fps} = useVideoConfig();
  const Ch = CHAPTERS[chapter] || AviHistory1;
  return (
    <AbsoluteFill style={{background: '#0B1B33'}}>
      <style>{FONT_CSS}</style>
      <Ch lines={lines} words={words} seconds={seconds} />
      <Captions words={words} fps={fps} top={935} size={46} />
    </AbsoluteFill>
  );
};
