// A contact sheet of the kit for the owner: every person, pose, face, icon and backdrop (one still each).
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, W, H, T, Person, Sub, Icon, Backdrop, PEOPLE, POSE_NAMES, FACES, ICONS, BACKDROPS} from './kit';
import {FONT_CSS} from './fonts';

export const Sheet = ({what = 'people', f = 20}) => {
  let body = null;
  if (what === 'people') body = PEOPLE.map((p, i) => <g key={p} transform={`translate(${150 + (i % 8) * 220} ${260 + Math.floor(i / 8) * 330}) scale(0.95)`}><Person who={p} f={f} seed={i} /><T x={0} y={200} size={28} anchor="middle" fill="#fff">{p}</T></g>);
  if (what === 'poses') body = POSE_NAMES.map((p, i) => <g key={p} transform={`translate(${150 + (i % 8) * 220} ${260 + Math.floor(i / 8) * 330}) scale(0.95)`}><Person who="pip" pose={p} f={f} seed={i} /><T x={0} y={200} size={28} anchor="middle" fill="#fff">{p}</T></g>);
  if (what === 'faces') body = FACES.map((p, i) => <g key={p} transform={`translate(${200 + (i % 5) * 340} ${330 + Math.floor(i / 5) * 420}) scale(1.6)`}><Person who="pip" face={p} f={f} seed={i} /><T x={0} y={190} size={22} anchor="middle" fill="#fff">{p}</T></g>);
  if (what === 'icons') body = ICONS.map((p, i) => <g key={p} transform={`translate(${120 + (i % 12) * 150} ${140 + Math.floor(i / 12) * 170})`}><Icon name={p} s={0.9} /><T x={0} y={80} size={20} anchor="middle" fill="#fff">{p}</T></g>);
  if (what === 'backdrops') body = BACKDROPS.map((p, i) => <g key={p} transform={`translate(${(i % 6) * 320} ${Math.floor(i / 6) * 270}) scale(0.1667)`}><Backdrop bg={p} f={f} /><T x={60} y={1020} size={110} fill="#fff" stroke="#000" sw={14}>{p}</T></g>);
  if (what === 'sub') body = <g transform="translate(960 600)"><Backdrop bg="underwater" f={f} depth={0.5} /><Sub f={f} s={1.6} beam={1} /></g>;
  return (
    <AbsoluteFill style={{backgroundColor: '#0B1F3A'}}>
      <style>{FONT_CSS}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {what !== 'backdrops' && what !== 'sub' && <T x={60} y={80} size={54} fill="#fff">{what.toUpperCase()}</T>}
        {body}
      </svg>
    </AbsoluteFill>
  );
};
