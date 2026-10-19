import React from 'react';
import {Composition, getInputProps} from 'remotion';
import {Story, StoryStill} from './Story';
import {Sheet} from './Sheet';
import {Thumb} from './Thumb';
import {Opening} from './Opening';
import {MotionTest, EmojiSheet, ShotGrid} from './Showcase';
import {FPS, W, H} from './kit';

export const RemotionRoot = () => {
  const props = getInputProps();
  const frames = Math.max(30, Number(props.frames) || 30 * 60);
  return (
    <>
      <Composition id="Story" component={Story} durationInFrames={frames} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="Still" component={StoryStill} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="Sheet" component={Sheet} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="Thumb" component={Thumb} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="Opening" component={Opening} durationInFrames={frames} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="MotionTest" component={MotionTest} durationInFrames={frames} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="ShotGrid" component={ShotGrid} durationInFrames={Math.max(1, Number(props.pages) || 1)} fps={FPS} width={W} height={H} defaultProps={props} />
      <Composition id="EmojiSheet" component={EmojiSheet} durationInFrames={1} fps={FPS} width={W} height={H} defaultProps={props} />
    </>
  );
};
