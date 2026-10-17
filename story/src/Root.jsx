import React from 'react';
import {Composition, getInputProps} from 'remotion';
import {Story, StoryStill} from './Story';
import {Sheet} from './Sheet';
import {FPS, W, H} from './kit';

export const RemotionRoot = () => {
  const props = getInputProps();
  const frames = Math.max(30, Number(props.frames) || 30 * 60);
  return (
    <>
      <Composition id="Story" component={Story} durationInFrames={frames} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="Still" component={StoryStill} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="Sheet" component={Sheet} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={props} />
    </>
  );
};
