import React from 'react';
import {AbsoluteFill, Img} from 'remotion';

// Rana's design options (design.py): one SVG drawn on a plain background, so animate.py `design-render` can turn it into PNGs.
// The SVG arrives as a data URL; it was checked by design.clean_svg (no scripts, links or embedded files).
export const SvgStill = ({src, bg = '#F5F5F2', pad = 0.08}) => (
  <AbsoluteFill style={{background: bg, alignItems: 'center', justifyContent: 'center'}}>
    {src ? <Img src={src} style={{width: `${100 - pad * 200}%`, height: `${100 - pad * 200}%`, objectFit: 'contain'}} /> : null}
  </AbsoluteFill>
);
