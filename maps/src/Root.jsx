import React from 'react';
import {Composition, getInputProps} from 'remotion';
import {MapSample, FPS, W, H, FRAMES} from './MapSample';

export const Root = () => {
  const props = {look: 'midnight', ...getInputProps()};
  return <Composition id="MapSample" component={MapSample} durationInFrames={FRAMES} fps={FPS} width={W} height={H} defaultProps={props} />;
};
