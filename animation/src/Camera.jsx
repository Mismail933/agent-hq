import React, {createContext, useContext} from 'react';
import {W, H, easeInOut, easeOut, clamp01, lerp} from './theme';

export const CamCtx = createContext({dx: 0, dy: 0, s: 1});

// Every scene has a camera move; nothing sits still.
export const MOVES = ['push_in', 'pull_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down', 'drift'];
// Camera hits (2.22.1) on top of the move, at a frame of the scene: punch_in (a quick zoom on a speaker, or on the group),
// release (back out), whip (a fast blurred pan into the shot), shake (a jolt), hold (the move stops: a deadpan pause).
export const HITS = ['punch_in', 'release', 'whip', 'shake', 'hold'];

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
    case 'ending':   // the last scene: one slow push-in towards the end card (2.30.0)
      return {s: lerp(1.0, 1.34, easeInOut(p)), dx: 0, dy: lerp(0, -40, easeInOut(p))};
    case 'push_in':
    default:   // a slow drift in; the framing changes come as cuts (2.30.0: was 1.0 -> 1.26)
      return {s: lerp(1.0, 1.1, e), dx: 0, dy: lerp(0, -14, e)};
  }
};

/**
 * Where the hits leave the camera at this frame: z (0 = the scene's framing, 1 = punched in on the subject), the subject,
 * frames the base move has been held (it resumes where it stopped), and the whip / shake offsets.
 */
const hitsAt = (hits, frame) => {
  let seg = null;   // {at, from, to, len, subject}
  const val = (s, f) => (s ? lerp(s.from, s.to, easeOut((f - s.at) / s.len)) : 0);
  let held = 0;
  let whip = null;
  let shake = null;
  hits.forEach((h, i) => {
    if (h.at > frame) return;
    if (h.cam === 'hold') {
      const end = i + 1 < hits.length ? hits[i + 1].at : Infinity;
      held += Math.max(0, Math.min(frame, end) - h.at);
    }
    if (h.cam === 'whip') whip = h;
    if (h.cam === 'shake') shake = h;
    const cur = val(seg, h.at);
    // OverSimplified changes the framing with a CUT, never a zoom you can watch (2.30.0, the owner: "it zooms in a weird way"):
    // punch_in = cut to a single of the subject (or a tighter group shot), release = cut back to the wide shot.
    if (h.cam === 'punch_in') seg = {at: h.at, from: 1, to: 1, len: 1, subject: h.subject || null};
    else if (h.cam === 'release' || h.cam === 'whip') seg = {at: h.at, from: 0, to: 0, len: 1, subject: seg ? seg.subject : null};
  });
  const wAge = whip ? frame - whip.at : 99;
  const sAge = shake ? frame - shake.at : 99;
  const decay = Math.max(0, 1 - sAge / 14);
  return {
    z: val(seg, frame),
    subject: seg ? seg.subject : null,
    held,
    whipDx: wAge < 8 ? (1 - easeOut(wAge / 8)) * W * 0.9 * (whip.dir || 1) : 0,
    blur: wAge < 6,
    shakeDx: Math.sin(sAge * 2.1) * 16 * decay,
    shakeDy: Math.cos(sAge * 2.7) * 10 * decay,
  };
};

// SAFE: nothing the story needs may touch the outer 60 px. The scene tells the camera how wide its content is (spread, in
// px either side of the focus); the camera never zooms or pans far enough to push that content past the margin. A punch-in on
// one speaker frames that speaker the same way (so it can zoom further, never cropping him).
export const SAFE = 60;
export const Camera = ({move, frame, frames, focus = [W / 2, H / 2], spread = 0, topY = null, topLimit = SAFE, hits = [], children}) => {
  const hs = hitsAt(hits, frame);
  const f = frame - hs.held;
  let cam = cameraAt(move, f / Math.max(1, frames), f);
  const sub = hs.subject;
  const z = hs.z;
  const fc = sub ? [lerp(focus[0], sub.focus, z), focus[1]] : focus;
  const sp = sub ? lerp(spread, sub.spread, z) : spread;
  const ty = sub && topY !== null ? lerp(topY, sub.topY, z) : topY;
  cam = {...cam, s: cam.s * (1 + (sub ? 0.5 : 0.22) * z)};
  if (sp > 0) {
    const room = W / 2 - SAFE;
    let s = Math.max(1, Math.min(cam.s, room / sp));
    if (ty !== null) s = Math.max(1, Math.min(s, (H / 2 - topLimit) / Math.max(1, H / 2 - ty))); // the top of the tallest thing too
    const slack = Math.max(0, room - sp * s);
    cam = {s, dx: Math.max(-slack, Math.min(slack, cam.dx)), dy: Math.max(0, cam.dy)};
  }
  cam = {...cam, dx: cam.dx + hs.whipDx + hs.shakeDx, dy: cam.dy + hs.shakeDy};
  const [fx, fy] = fc;
  const t = `translate(${W / 2 + cam.dx} ${H / 2 + cam.dy}) scale(${cam.s}) translate(${-fx} ${-fy})`;
  return (
    <CamCtx.Provider value={cam}>
      {hs.blur && (
        <defs>
          <filter id="whip-blur" x="-20%" y="0" width="140%" height="100%"><feGaussianBlur stdDeviation="26 0" /></filter>
        </defs>
      )}
      <g transform={t} filter={hs.blur ? 'url(#whip-blur)' : undefined}>{children}</g>
    </CamCtx.Provider>
  );
};

// A depth layer: far layers (depth near 0) move less than the camera, near ones (1) move with it.
export const Layer = ({depth = 0.5, children}) => {
  const cam = useContext(CamCtx);
  return <g transform={`translate(${-cam.dx * (1 - depth)} ${-cam.dy * (1 - depth) * 0.6})`}>{children}</g>;
};
