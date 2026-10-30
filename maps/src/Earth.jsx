// The real Earth under Bassel's globe (the owner 2026-10-29, "a huge level up": the big map channels animate over real imagery, not flat
// shapes). NASA's Blue Marble Next Generation with topography and bathymetry (public domain, NASA Earth Observatory), reprojected onto
// the same orthographic globe as the vector layers every frame: each pixel of a half-size canvas is turned back into a longitude and
// latitude (the orthographic inverse, written out: d3's invert per pixel is slow) and takes that point's colour from the texture
// (bilinear, so a close view is soft, not blocky). The countries are then drawn over it as see-through colour.
import React, {useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

let TEX = null;   // {w, h, data}: loaded once per browser tab
let LOADING = null;
// close views: NASA's 500 m tiles cropped to the story's places (240 px a degree), used where the view falls inside them
export const REGIONS = {carib: [-76, -58, 10, 23], nfrance: [-80, -52, 41, 53], louis: [-98, -84, 24, 38], france: [-8, 12, 40, 52], guiana: [-60, -48, 0, 9], reunion: [50, 60, -24, -16]};
const REG = {};
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      resolve({w: img.width, h: img.height, data: g.getImageData(0, 0, img.width, img.height).data});
    };
    img.onerror = reject;
    img.src = src;
  });
}
function loadRegions() {
  return Promise.all(Object.keys(REGIONS).map((n) => (REG[n] ? REG[n] : loadImage(staticFile(`earth/${n}.jpg`)).then((t) => { REG[n] = t; }).catch(() => null))));
}
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
export const Earth = ({cam, cx, cy, W, H, k: k0, dim = 0.92, sat = 1.0, tint = [8, 22, 44], tintA = 0.08}) => {
  const k = k0 || (cam[2] >= 1800 ? 0.75 : 0.5);   // sharper when close
  const ref = useRef(null);
  const [handle] = useState(() => delayRender('earth texture'));
  const [ready, setReady] = useState(!!TEX);
  useLayoutEffect(() => {
    if (TEX && Object.keys(REG).length) { setReady(true); continueRender(handle); return; }
    Promise.all([loadTexture(), loadRegions()]).then(() => { setReady(true); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);
  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    const cw = Math.round(W * k), ch = Math.round(H * k);
    const g = ref.current.getContext('2d');
    const out = g.createImageData(cw, ch);
    const o = out.data, t = TEX.data, tw = TEX.w, th = TEX.h, inv = 1 / k;
    const l0 = cam[0], p0 = cam[1] * RAD, s = cam[2], sp = Math.sin(p0), cp = Math.cos(p0);
    // the fine crops this view can use
    const halfDeg = (Math.max(W, H) / 2 / s) * (180 / Math.PI) * 1.3;
    const fine = s >= 1500 ? Object.entries(REGIONS).filter(([n, b]) => REG[n] && l0 + halfDeg > b[0] && l0 - halfDeg < b[1] && cam[1] + halfDeg > b[2] && cam[1] - halfDeg < b[3]).map(([n, b]) => [REG[n], b]) : [];
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
        let t2 = t, w2 = tw, h2 = th, u = ((lon + 180) / 360) * tw - 0.5, v = ((90 - lat) / 180) * th - 0.5;
        for (let q = 0; q < fine.length; q++) {
          const b = fine[q][1];
          if (lon > b[0] && lon < b[1] && lat > b[2] && lat < b[3]) {
            const R = fine[q][0];
            t2 = R.data; w2 = R.w; h2 = R.h;
            u = ((lon - b[0]) / (b[1] - b[0])) * w2 - 0.5; v = ((b[3] - lat) / (b[3] - b[2])) * h2 - 0.5;
            break;
          }
        }
        let u0 = Math.floor(u), v0 = Math.floor(v);
        const fu = u - u0, fv = v - v0;
        const u1 = t2 === t ? (u0 + 1 + w2) % w2 : Math.min(w2 - 1, u0 + 1); u0 = t2 === t ? (u0 + w2) % w2 : Math.max(0, u0);
        const v1 = Math.min(h2 - 1, v0 + 1); v0 = Math.max(0, v0);
        const a = (v0 * w2 + u0) * 4, b = (v0 * w2 + u1) * 4, c = (v1 * w2 + u0) * 4, d = (v1 * w2 + u1) * 4;
        const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
        let R = t2[a] * w00 + t2[b] * w10 + t2[c] * w01 + t2[d] * w11;
        let G = t2[a + 1] * w00 + t2[b + 1] * w10 + t2[c + 1] * w01 + t2[d + 1] * w11;
        let B = t2[a + 2] * w00 + t2[b + 2] * w10 + t2[c + 2] * w01 + t2[d + 2] * w11;
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
