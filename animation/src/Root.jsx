import React from 'react';
import {Composition, Still} from 'remotion';
import {Short} from './Short';
import {Sheet} from './Sheet';
import {FPS, W, H} from './theme';
import sample from './sample-props.json';

export const Root = () => (
  <>
    <Composition
      id="Short"
      component={Short}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={sample.durationInFrames}
      defaultProps={sample}
      calculateMetadata={({props}) => ({durationInFrames: props.durationInFrames || sample.durationInFrames})}
    />
    <Still id="Sheet" component={Sheet} width={1920} height={1080} />
  </>
);
