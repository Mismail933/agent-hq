import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, W, H} from './theme';
import {Character} from './Character';
import {ASSETS, Asset} from './assets';

/** One piece of a story's own art for Israa's check (animate.py asset-still): a backdrop with a person standing in it for scale, or a
 * prop beside a person (rendered at rest and after its animation). */
export const AssetStill = ({kind = 'backdrop', id = '', tone = 'noon', at = 15, who = 'citizen'}) => {
  const frame = useCurrentFrame();
  const B = ASSETS.backdrops[id];
  return (
    <AbsoluteFill style={{background: C.parchment}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {kind === 'backdrop' && B && <B frame={frame} tone={tone} />}
        {kind === 'prop' && <rect x="0" y="1430" width={W} height={H - 1430} fill="#D9C29A" />}
        <Character who={who} pose="stand" mouth="X" x={kind === 'prop' ? 300 : W / 2} y={1430} scale={1.1} frame={90} enterAt={0} seed={1} />
        {kind === 'prop' && <Asset id={id} x={720} y={1430} scale={1.1} frame={frame} at={at} />}
      </svg>
    </AbsoluteFill>
  );
};
