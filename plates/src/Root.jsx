import React from 'react';
import {Composition} from 'remotion';
import {PLATES as inside} from './p_inside';
import {PLATES as power} from './p_power';
import {PLATES as houston} from './p_houston';
import {PLATES as space} from './p_space';
import {PLATES as rules} from './p_rules';
import {StrikeSpike, Current, Strike2, Panel, Ball, Screen} from './plates';

const P = (id, C, frames) => <Composition key={id} id={id} component={C} durationInFrames={frames} fps={30} width={1920} height={1080}
  calculateMetadata={({props}) => ({width: props.w || 1920, height: props.h || 1080})} defaultProps={{w: 1920, h: 1080}} />;
const EXTRA = {...inside, ...power, ...houston, ...space, ...rules};
export const Root = () => <>{P('StrikeSpike', StrikeSpike, 135)}{P('Current', Current, 120)}{P('Strike2', Strike2, 130)}{P('Panel', Panel, 360)}{P('Ball', Ball, 720)}{P('Screen', Screen, 330)}{Object.entries(EXTRA).map(([id, [C, n]]) => P(id, C, n))}</>;
