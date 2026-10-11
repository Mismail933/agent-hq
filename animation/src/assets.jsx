import React from 'react';
import GEN from './generated_assets.js';

/*
 * A story's own art (2.36.0, assets.py): the backdrops and props Rana drew ONCE for this story's world, so every shot (and every
 * bespoke scene) shows the same Han palace and the same jar. Costumes are not here: they live in the wardrobe's Character.jsx.
 */
export const ASSETS = {backdrops: GEN.backdrops || {}, props: GEN.props || {}};

/** A drawn place, full frame: <Backdrop id="han_palace" frame={frame} tone="noon" /> */
export const Backdrop = ({id, ...rest}) => {
  const B = ASSETS.backdrops[id];
  return B ? <B {...rest} /> : null;
};

/** A drawn prop standing on (x, y), about 400 units tall at scale 1; its animation starts at frame `at` (null = at rest). */
export const Asset = ({id, x = 540, y = 1430, scale = 1, frame = 0, at = null, flip = false}) => {
  const P = ASSETS.props[id];
  if (!P) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <P frame={frame} at={at} />
    </g>
  );
};
