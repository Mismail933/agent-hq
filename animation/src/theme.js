// The style kit's tokens. The same values are written out in ../STYLE-GUIDE.md: change both together.
import {loadFont as loadHead} from '@remotion/google-fonts/LilitaOne';
import {loadFont as loadBody} from '@remotion/google-fonts/Nunito';
import {continueRender, delayRender} from 'remotion';
import {LOCAL_FONTS} from './fonts';

// The fonts come from the bundle (animate.py writes fonts.js) so a render needs no network; Google Fonts only if that failed.
const localFont = (family, url, weight) => {
  const handle = delayRender(`Loading the ${family} font`);
  const face = new FontFace(family, `url("${url}")`, {weight});
  face.load().then(() => document.fonts.add(face)).catch(() => {}).finally(() => continueRender(handle));
  return family;
};

export const HEAD = LOCAL_FONTS ? localFont('Lilita One', LOCAL_FONTS.head, '400') : loadHead().fontFamily; // headlines, captions, callouts
export const BODY = LOCAL_FONTS ? localFont('Nunito', LOCAL_FONTS.body, '200 1000') : loadBody('normal', {weights: ['800']}).fontFamily; // small labels

export const W = 1080;
export const H = 1920;
export const FPS = 30;

// Six world colours (+ white for captions) and three skin tones.
export const C = {
  ink: '#2A1B14',
  parchment: '#F5E6C4',
  gold: '#E8A93A',
  terracotta: '#C8573A',
  teal: '#1F6670',
  sky: '#9ACFD6',
  white: '#FFFFFF',
};
export const SKIN = {light: '#F0C9A0', mid: '#D9A06F', dark: '#9C6240'};
export const LINE = 8; // outline thickness at 1080 px wide

// Deterministic "random" so every render of a frame looks the same.
export const rnd = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOut = (t) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const lerp = (a, b, t) => a + (b - a) * t;

// Shared outline style for shapes.
export const ink = {stroke: C.ink, strokeWidth: LINE, strokeLinejoin: 'round', strokeLinecap: 'round'};
