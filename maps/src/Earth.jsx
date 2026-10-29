// The real Earth under Bassel's globe (the owner 2026-10-29, "a huge level up": the big map channels animate over real imagery, not flat
// shapes). NASA's Blue Marble Next Generation with topography and bathymetry (public domain, NASA Earth Observatory), reprojected onto
// the same orthographic globe as the vector layers every frame: each pixel of a half-size canvas is turned back into a longitude and
// latitude (the orthographic inverse, written out: d3's invert per pixel is slow) and takes that point's colour from the texture
// (bilinear, so a close view is soft, not blocky). The countries are then drawn over it as see-through colour.
import React, {useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

let TEX = null;   // {w, h, data}: loaded once per browser tab
let LOADING = null;
function loadTexture() {
  if (TEX) return Promise.resolve(TEX);
  if (!LOADING) {
    LOADING = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        TEX = {w: img.width, h: img.height, data: g.getImageData(0, 0, img.width, img.height).data};
        resolve(TEX);
      };
      img.onerror = reject;
      img.src = staticFile('earth.jpg');
    });
  }
  return LOADING;
}

const RAD = Math.PI / 180;
// cam = [lon, lat, scale] as MapStory's camera; cx, cy = the globe's centre on screen; dim = brightness; sat = colour (1 = as NASA's)
export const Earth = ({cam, cx, cy, W, H, k = 0.5, dim = 0.8, sat = 0.85, tint = [8, 22, 44], tintA = 0.18}) => {
  const ref = useRef(null);
  const [handle] = useState(() => delayRender('earth texture'));
  const [ready, setReady] = useState(!!TEX);
  useLayoutEffect(() => {
    if (TEX) { setReady(true); continueRender(handle); return; }
    loadTexture().then(() => { setReady(true); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    const cw = Math.round(W * k), ch = Math.round(H * k);
    const g = ref.current.getContext('2d');
    const out = g.createImageData(cw, ch);
    const o = out.data, t = TEX.data, tw = TEX.w, th = TEX.h, inv = 1 / k;
    const l0 = cam[0], p0 = cam[1] * RAD, s = cam[2], sp = Math.sin(p0), cp = Math.cos(p0);
    const r0 = tint[0] * tintA, g0 = tint[1] * tintA, b0 = tint[2] * tintA, keep = 1 - tintA;
    for (let y = 0; y < ch; y++) {
      const yy = (cy - (y + 0.5) * inv) / s;
      for (let x = 0; x < cw; x++) {
        const xx = ((x + 0.5) * inv - cx) / s;
        const rr = xx * xx + yy * yy;
        const j = (y * cw + x) * 4;
        if (rr >= 1) { o[j + 3] = 0; continue; }
        const cc = Math.sqrt(1 - rr);
        const lat = Math.asin(Math.max(-1, Math.min(1, cc * sp + yy * cp))) / RAD;
        let lon = l0 + Math.atan2(xx, cc * cp - yy * sp) / RAD;
        lon = ((lon + 540) % 360) - 180;
        const u = ((lon + 180) / 360) * tw - 0.5, v = ((90 - lat) / 180) * th - 0.5;
        let u0 = Math.floor(u), v0 = Math.floor(v);
        const fu = u - u0, fv = v - v0;
        const u1 = (u0 + 1 + tw) % tw; u0 = (u0 + tw) % tw;
        const v1 = Math.min(th - 1, v0 + 1); v0 = Math.max(0, v0);
        const a = (v0 * tw + u0) * 4, b = (v0 * tw + u1) * 4, c = (v1 * tw + u0) * 4, d = (v1 * tw + u1) * 4;
        const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
        let R = t[a] * w00 + t[b] * w10 + t[c] * w01 + t[d] * w11;
        let G = t[a + 1] * w00 + t[b + 1] * w10 + t[c + 1] * w01 + t[d + 1] * w11;
        let B = t[a + 2] * w00 + t[b + 2] * w10 + t[c + 2] * w01 + t[d + 2] * w11;
        const L = 0.3 * R + 0.59 * G + 0.11 * B;
        R = L + (R - L) * sat; G = L + (G - L) * sat; B = L + (B - L) * sat;
        // light from the upper left falling off to the limb: the globe reads as a ball
        const shade = dim * (0.62 + 0.38 * cc) * (1 + 0.12 * (-xx * 0.6 + yy * 0.8));
        o[j] = R * shade * keep + r0; o[j + 1] = G * shade * keep + g0; o[j + 2] = B * shade * keep + b0; o[j + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
  });
  return <canvas ref={ref} width={Math.round(W * k)} height={Math.round(H * k)}
                 style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};
