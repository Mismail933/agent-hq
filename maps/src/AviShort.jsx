// Bassel's aviation samples (2026-11-16, "check these facts and show me some samples"): Aviation.jsx is written by Fable
// (claude-fable-5-1) from ~/fable-avi/BRIEF.md; this wrapper adds the voice-synced captions. Prop `which`: meals | routes | altitude.
import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {FONT_CSS} from './fonts';
import {Captions} from './FactShort';
import {AviMeals, AviRoutes, AviAltitude} from './Aviation';
import {GtaPiece} from './GtaShort';

const PIECES = {meals: AviMeals, routes: AviRoutes, altitude: AviAltitude, gta: GtaPiece};

export const AviShort = ({which = 'meals', lines = [], words = [], seconds = 40}) => {
  const {fps} = useVideoConfig();
  const Piece = PIECES[which] || AviMeals;
  return (
    <AbsoluteFill style={{background: '#0B1B33'}}>
      <style>{FONT_CSS}</style>
      <Piece lines={lines} words={words} seconds={seconds} />
      <Captions words={words} fps={fps} />
    </AbsoluteFill>
  );
};
