import React from 'react';
import {Composition, Still} from 'remotion';
import {Short} from './Short';
import {Sheet} from './Sheet';
import {CharacterSheet} from './CharacterSheet';
import {CharacterTest} from './CharacterTest';
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
    <Still id="CharacterSheet" component={CharacterSheet} width={1920} height={1080} defaultProps={{who: 'scholar'}} />
    <Composition id="CharacterTest" component={CharacterTest} width={W} height={H} fps={FPS} durationInFrames={900}
      defaultProps={{who: 'scholar', mouth: []}} calculateMetadata={({props}) => ({durationInFrames: props.durationInFrames || 900})} />
  </>
);
