import React from 'react';
import {Composition} from 'remotion';
import {StrikeSpike, Current, Strike2, Panel, Ball, Screen} from './plates';

const P = (id, C, frames) => <Composition key={id} id={id} component={C} durationInFrames={frames} fps={30} width={1920} height={1080}
  calculateMetadata={({props}) => ({width: props.w || 1920, height: props.h || 1080})} defaultProps={{w: 1920, h: 1080}} />;
export const Root = () => <>{P('StrikeSpike', StrikeSpike, 135)}{P('Current', Current, 120)}{P('Strike2', Strike2, 75)}{P('Panel', Panel, 210)}{P('Ball', Ball, 165)}{P('Screen', Screen, 165)}</>;
