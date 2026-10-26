import React from 'react';
import {Composition, getInputProps} from 'remotion';
import {MapSample, FPS, W, H, FRAMES} from './MapSample';
import {MapShort} from './MapShort';
import {MapStory} from './MapStory';
import {WarTable} from './WarTable';

export const Root = () => {
  const props = {look: 'midnight', ...getInputProps()};
  const secs = Number(props.seconds) || 35;
  return (
    <>
      <Composition id="MapSample" component={MapSample} durationInFrames={FRAMES} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="MapShort" component={MapShort} durationInFrames={Math.round(secs * FPS)} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="WarTable" component={WarTable} durationInFrames={Math.round(Number(props.frames) || 480)} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="MapStory" component={MapStory} durationInFrames={Math.round(secs * FPS)} fps={FPS} width={W} height={H} defaultProps={props} />
    </>
  );
};
