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
    // 2.31.0: gentle drifts only; a change of framing is a cut (Israa: framing changing inside dialogue read as zooms)
    case 'still':
      return {s: 1.0, dx: 0, dy: 0};
    case 'pull_out':
      return {s: lerp(1.1, 1.0, e), dx: 0, dy: lerp(-14, 0, e)};
    case 'pan_left': // camera travels left, the world slides right
      return {s: 1.08, dx: lerp(-60, 60, e), dy: 0};
    case 'pan_right':
      return {s: 1.08, dx: lerp(60, -60, e), dy: 0};
    case 'pan_up':
      return {s: 1.08, dx: 0, dy: lerp(-60, 40, e)};
    case 'pan_down':
      return {s: 1.08, dx: 0, dy: lerp(40, -60, e)};
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

/**
 * Where the camera is at this frame: {s, dx, dy, fx, fy, blur}. A world point x is on screen at W/2 + dx + s * (x - fx).
 * 2.35.0 (Israa on ep 28: speakers cut off or tiny in wide shots), worked out here so the scene can use the same framing:
 * - margin: the safe margin (live rule video.frame_margin_px);
 * - keep: whoever is speaking ({left, right, topY, h} in the world): if the shot shows him smaller than minH of the picture's height
 *   (rule video.speaker_min_height) it cuts in on him, and he is always kept fully inside the margin (moved, or the shot widened);
 * - hold: the last `hold` frames of the move stand still (the ending pushes in by the last word, then holds).
 * - cy, vh (2.50.0, rule video.shape): the middle and the height of the part of the stage the picture shows (a wide video shows a
 *   16:9 band, BAND_H tall, around the people); topLimit is then measured on the stage too. Vertical = the whole canvas.
 */
export const cameraFrame = ({move, frame, frames, focus = [W / 2, H / 2], spread = 0, topY = null, topLimit = SAFE, hits = [],
  margin = SAFE, keep = null, minH = 0, hold = 0, cy = H / 2, vh = H}) => {
  const top0 = cy - vh / 2;   // the top edge of what the picture shows
  const hs = hitsAt(hits, frame);
  const f = frame - hs.held;
  const base = cameraAt(move, Math.min(1, f / Math.max(1, frames - hold)), f);
  const fit = (sub, z) => {
    const fc = sub ? [lerp(focus[0], sub.focus, z), focus[1]] : focus;
    const sp = sub ? lerp(spread, sub.spread, z) : spread;
    // 2.53.0 (Israa on ep 31: Musa's head cut by the frame's edge): a cut-in on one person still keeps the tallest head in the shot
    const ty = sub && topY !== null ? Math.min(topY, lerp(topY, sub.topY, z)) : topY;
    let cam = {...base, s: base.s * (1 + (sub ? 0.5 : 0.22) * z)};
    if (sub && sub.minS) cam.s = Math.max(cam.s, sub.minS);
    if (sp > 0) {
      const room = W / 2 - margin;
      let s = Math.max(1, Math.min(cam.s, room / sp));
      if (ty !== null) s = Math.max(1, Math.min(s, (cy - topLimit) / Math.max(1, cy - ty))); // the top of the tallest thing too
      const slack = Math.max(0, room - sp * s);
      cam = {s, dx: Math.max(-slack, Math.min(slack, cam.dx)), dy: Math.max(0, cam.dy)};
    }
    return {...cam, fx: fc[0], fy: fc[1]};
  };
  let cam = fit(hs.subject, hs.z);
  if (keep && minH > 0 && cam.s * keep.h < minH * vh) {
    // too small to read while he talks: a single of him, big enough (as far as the margin and the top band allow)
    const w = (keep.right - keep.left) / 2;
    cam = fit({focus: (keep.left + keep.right) / 2, spread: w, topY: keep.topY, minS: (minH * vh) / Math.max(1, keep.h)}, 1);
  }
  if (keep) {
    // the speaker stays fully inside the margin: move the camera if that is enough, else widen the shot
    const lo = margin - W / 2 - cam.s * (keep.left - cam.fx);
    const hi = W / 2 - margin - cam.s * (keep.right - cam.fx);
    if (lo <= hi) cam.dx = Math.max(lo, Math.min(hi, cam.dx));
    else {
      cam.s = Math.max(0.85, (W - 2 * margin) / Math.max(1, keep.right - keep.left));
      cam.dx = -cam.s * ((keep.left + keep.right) / 2 - cam.fx);
    }
    const top = cy + cam.dy + cam.s * (keep.topY - cam.fy);
    if (top < top0 + margin && keep.topY < cam.fy) cam.s = Math.max(0.85, Math.min(cam.s, (cy + cam.dy - top0 - margin) / (cam.fy - keep.topY)));
  }
  return {...cam, dx0: cam.dx, dx: cam.dx + hs.whipDx + hs.shakeDx, dy: cam.dy + hs.shakeDy, blur: hs.blur, cy};
};

export const Camera = ({move, frame, frames, focus = [W / 2, H / 2], spread = 0, topY = null, topLimit = SAFE, hits = [], view = null, children}) => {
  const v = view || cameraFrame({move, frame, frames, focus, spread, topY, topLimit, hits});
  const cam = {s: v.s, dx: v.dx, dy: v.dy};
  const hs = {blur: v.blur};
  const fx = v.fx;
  const fy = v.fy;
  const t = `translate(${W / 2 + cam.dx} ${(v.cy ?? H / 2) + cam.dy}) scale(${cam.s}) translate(${-fx} ${-fy})`;
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
