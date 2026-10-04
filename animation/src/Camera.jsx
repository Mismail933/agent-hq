import React, {createContext, useContext} from 'react';
import {W, H, easeInOut, lerp} from './theme';

export const CamCtx = createContext({dx: 0, dy: 0, s: 1});

// Every scene has a camera move; nothing sits still.
export const MOVES = ['push_in', 'pull_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'drift'];

export const cameraAt = (move, p, frame) => {
  const e = easeInOut(p);
  switch (move) {
    case 'pull_out':
      return {s: lerp(1.28, 1.0, e), dx: 0, dy: lerp(-40, 0, e)};
    case 'pan_left': // camera travels left, the world slides right
      return {s: 1.16, dx: lerp(-150, 150, e), dy: 0};
    case 'pan_right':
      return {s: 1.16, dx: lerp(150, -150, e), dy: 0};
    case 'pan_up':
      return {s: 1.16, dx: 0, dy: lerp(-170, 120, e)};
    case 'pan_down':
      return {s: 1.16, dx: 0, dy: lerp(120, -170, e)};
    case 'drift':
      return {s: 1.1, dx: Math.sin(frame / 38) * 60, dy: Math.cos(frame / 51) * 30};
    case 'push_in':
    default:
      return {s: lerp(1.0, 1.26, e), dx: 0, dy: lerp(0, -30, e)};
  }
};

export const Camera = ({move, frame, frames, focus = [W / 2, H / 2], children}) => {
  const cam = cameraAt(move, frame / Math.max(1, frames), frame);
  const [fx, fy] = focus;
  const t = `translate(${W / 2 + cam.dx} ${H / 2 + cam.dy}) scale(${cam.s}) translate(${-fx} ${-fy})`;
  return (
    <CamCtx.Provider value={cam}>
      <g transform={t}>{children}</g>
    </CamCtx.Provider>
  );
};

// A depth layer: far layers (depth near 0) move less than the camera, near ones (1) move with it.
export const Layer = ({depth = 0.5, children}) => {
  const cam = useContext(CamCtx);
  return <g transform={`translate(${-cam.dx * (1 - depth)} ${-cam.dy * (1 - depth) * 0.6})`}>{children}</g>;
};
