// Thumbnails (2.49.0) at The Infographics Show's level: a close-up character drawn with dark outlines and two-tone shading,
// an exaggerated face, and the title in heavy condensed text on yellow and red boxes. One component per story, picked by `id`.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {W, H, rng} from './kit';
import {FONT_CSS} from './fonts';
import {MegArt} from './meg';
import {PiscesArt} from './ocean';
import {YamArt} from './yam';

const INK = '#141414';
const OSWALD = "'Oswald', 'Impact', sans-serif";

// a TIS title box: a filled box, heavy condensed caps fitted to its width (textLength), a dark outline
export const Box = ({x, y, w, h, text, fill = '#FFE11A', color = INK, outline = false, rot = 0}) => (
  <g transform={`rotate(${rot} ${x} ${y})`}>
    <rect x={x + 8} y={y + 10} width={w} height={h} fill="#000" opacity={0.35} />
    <rect x={x} y={y} width={w} height={h} fill={fill} stroke={INK} strokeWidth={7} />
    <text x={x + w / 2} y={y + h * 0.83} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={h * 0.93} fill={color}
      textLength={w - 44} lengthAdjust="spacingAndGlyphs" stroke={outline ? INK : 'none'} strokeWidth={outline ? 10 : 0} paintOrder="stroke"
      strokeLinejoin="round">{text}</text>
  </g>
);

const Cloud = ({x, y, s = 1, op = 1}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
    <g fill="#6E7FB5"><ellipse cx={0} cy={0} rx={170} ry={60} /><ellipse cx={-120} cy={16} rx={110} ry={46} /><ellipse cx={130} cy={18} rx={120} ry={48} /><ellipse cx={20} cy={-40} rx={100} ry={56} /></g>
    <g fill="#8C9BCB"><ellipse cx={-10} cy={-14} rx={140} ry={40} /><ellipse cx={20} cy={-46} rx={80} ry={36} /></g>
  </g>
);

export function JulianeArt({boxes = true}) {
  const R = rng(17);
  const skin = '#F2C29B', skinShade = '#D99C72', hair = '#5B3317', hairLight = '#7E4A26', dress = '#D62828', dressShade = '#A11D1D';
  const canopy = [];
  for (let i = 0; i < 340; i++) {
    const x = R() * W, y = 800 + R() * 300, r = 14 + R() * 26 * ((y - 780) / 300 + 0.4);
    canopy.push(<circle key={i} cx={x} cy={y} r={r} fill={['#14532D', '#166534', '#15803D', '#1E8A4C'][i % 4]} />);
  }
  const wind = [...Array(14)].map((_, i) => {
    const x = 1080 + R() * 820, y = 120 + R() * 820, len = 120 + R() * 160;
    return <path key={i} d={`M ${x} ${y} L ${x - 30} ${y - len}`} stroke="#fff" strokeWidth={6} opacity={0.35} strokeLinecap="round" />;
  });
  const stroke = {stroke: INK, strokeWidth: 7, strokeLinejoin: 'round', strokeLinecap: 'round'};
  return (
    <g>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B2A6B" /><stop offset="0.55" stopColor="#3D57A8" /><stop offset="0.75" stopColor="#7C93D1" /><stop offset="1" stopColor="#A9C3E8" /></linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      {/* far below: the jungle and its river */}
      <path d="M -20 790 C 300 770 700 800 1100 780 C 1500 770 1800 790 1940 784 L 1940 1100 L -20 1100 Z" fill="#14532D" />
      {canopy}
      <path d="M 120 1100 C 220 1000 420 990 380 930 C 350 880 520 860 620 830 C 700 806 820 812 900 796" stroke="#7DD3FC" strokeWidth={18} fill="none" strokeLinecap="round" opacity={0.85} />
      <rect y={760} width={W} height={70} fill="#A9C3E8" opacity={0.35} />
      <Cloud x={180} y={730} s={0.9} op={0.85} /><Cloud x={980} y={560} s={0.6} op={0.7} />
      {/* the plane breaking apart in the open sky, hit by lightning, smoke trailing */}
      <path d="M 260 470 C 360 520 420 560 520 600" stroke="#4B5563" strokeWidth={60} fill="none" strokeLinecap="round" opacity={0.45} />
      <path d="M 120 420 C 200 450 260 470 330 500" stroke="#4B5563" strokeWidth={40} fill="none" strokeLinecap="round" opacity={0.3} />
      
      <g transform="translate(700 650) rotate(22) scale(0.95)">
        <path d="M -30 -38 L -230 -34 Q -290 -28 -310 0 Q -290 28 -230 34 L -30 38 L -52 16 L -24 0 L -54 -18 Z" fill="#F1F5F9" {...stroke} />
        <rect x={-250} y={-8} width={200} height={12} fill="#2563EB" />
        {[0, 1, 2, 3].map((k) => <rect key={k} x={-232 + k * 42} y={-25} width={18} height={13} rx={4} fill="#93C5FD" stroke={INK} strokeWidth={3} />)}
        <path d="M -160 -34 L -120 -112 L -86 -112 L -104 -34 Z" fill="#CBD5E1" {...stroke} />
        <path d="M -150 34 L -116 100 L -86 100 L -100 34 Z" fill="#CBD5E1" {...stroke} />
        <g transform="translate(70 40) rotate(34)">
          <path d="M 0 -38 L 160 -36 L 222 -96 L 246 -90 L 206 -28 L 226 28 L 0 38 L 22 16 L -6 0 L 24 -18 Z" fill="#E2E8F0" {...stroke} />
          <rect x={10} y={-8} width={170} height={12} fill="#2563EB" />
        </g>
        <circle cx={14} cy={6} r={56} fill="#F97316" filter="url(#glow)" /><circle cx={20} cy={0} r={30} fill="#FDE047" />
        {[[40, 90, 20], [-40, 110, -40], [120, 130, 60], [-120, 80, 10]].map(([x, y, a], k) => <rect key={k} x={x} y={y} width={30} height={14} rx={3} fill="#CBD5E1" stroke={INK} strokeWidth={3} transform={`rotate(${a} ${x} ${y})`} />)}
      </g>
      <path d="M 900 470 L 850 520 L 896 530 L 830 590 L 878 600 L 770 650" fill="none" stroke="#FEF9C3" strokeWidth={12} strokeLinejoin="round" filter="url(#glow)" />
      {wind}
      {/* Juliane, close up, strapped into her seat, falling */}
      <g transform="translate(1440 470) rotate(-8) scale(1.42)">
        {/* seat back */}
        <path d="M -250 -170 Q -250 -260 -160 -260 L 160 -260 Q 250 -260 250 -170 L 262 760 L -262 760 Z" fill="#1E40AF" {...stroke} />
        <path d="M 120 -250 Q 240 -250 240 -170 L 252 760 L 170 760 Z" fill="#1A3592" />
        {/* hair streaming up behind the head */}
        <path d="M -124 -50 C -176 -150 -196 -290 -164 -420 C -142 -350 -122 -300 -98 -262 C -112 -350 -80 -440 -24 -520 C -16 -430 -4 -350 12 -296 C 34 -380 90 -452 160 -500 C 136 -410 116 -340 104 -276 C 150 -340 214 -380 282 -404 C 240 -310 196 -224 124 -110 C 110 -150 60 -176 0 -178 C -70 -176 -112 -130 -124 -50 Z" fill={hair} {...stroke} />
        <g stroke={hairLight} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.9}>
          <path d="M -130 -170 C -148 -250 -152 -330 -146 -380" /><path d="M -60 -220 C -66 -300 -50 -390 -28 -460" /><path d="M 30 -240 C 50 -320 90 -400 136 -450" /><path d="M 120 -190 C 160 -250 210 -300 256 -340" />
        </g>
        {/* neck and the red dress */}
        <path d="M -48 120 L -52 236 L 52 236 L 48 120 Z" fill={skinShade} {...stroke} />
        <path d="M -70 214 C -160 230 -214 262 -226 350 L -246 780 L 246 780 L 226 350 C 214 262 160 230 70 214 C 40 262 -40 262 -70 214 Z" fill={dress} {...stroke} />
        <path d="M 120 236 C 190 262 214 300 220 360 L 238 780 L 150 780 Z" fill={dressShade} />
        <path d="M -70 214 C -40 262 40 262 70 214" fill="none" {...stroke} />
        {/* both arms flung up, fingers spread */}
        <path d="M -196 292 C -236 200 -250 90 -246 -20 L -186 -24 C -190 80 -176 180 -144 262 Z" fill={skin} {...stroke} />
        <g transform="translate(-222 -66) rotate(-10) scale(-1 1)">
          <path d="M -44 30 C -54 -10 -40 -44 -10 -50 C 24 -56 52 -30 48 8 C 46 34 20 50 -6 50 C -28 50 -40 44 -44 30 Z" fill={skin} {...stroke} />
          {[[-40, -30], [-16, -10], [10, 8], [34, 26]].map(([fx, a], k) => <rect key={k} x={fx - 10} y={-112} width={20} height={72} rx={10} fill={skin} {...stroke} transform={`rotate(${a} ${fx} -44)`} />)}
          <rect x={-96} y={-56} width={22} height={54} rx={11} fill={skin} {...stroke} transform="rotate(-48 -84 -30)" />
        </g>
        <path d="M 196 290 C 270 220 320 110 336 -20 L 276 -36 C 262 80 220 180 150 250 Z" fill={skin} {...stroke} />
        <g transform="translate(312 -66) rotate(18)">
          <path d="M -44 30 C -54 -10 -40 -44 -10 -50 C 24 -56 52 -30 48 8 C 46 34 20 50 -6 50 C -28 50 -40 44 -44 30 Z" fill={skin} {...stroke} />
          {[[-40, -30], [-16, -10], [10, 8], [34, 26]].map(([fx, a], k) => <rect key={k} x={fx - 10} y={-112} width={20} height={72} rx={10} fill={skin} {...stroke} transform={`rotate(${a} ${fx} -44)`} />)}
          <rect x={-96} y={-56} width={22} height={54} rx={11} fill={skin} {...stroke} transform="rotate(-48 -84 -30)" />
        </g>
        <g stroke="#fff" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.9}>
          <path d="M -300 -150 q -20 10 -16 34" /><path d="M -170 -190 q 18 -4 26 16" /><path d="M 380 -150 q 22 10 18 34" /><path d="M 250 -200 q -18 -4 -26 16" />
        </g>
        {/* seatbelt across her lap */}
        <rect x={-250} y={700} width={500} height={56} fill="#94A3B8" {...stroke} />
        <rect x={-48} y={690} width={96} height={76} rx={10} fill="#E2E8F0" {...stroke} />
        {/* the face */}
        <path d="M -124 -40 C -128 -126 -70 -176 0 -176 C 70 -176 128 -126 124 -40 C 122 40 98 120 54 160 C 30 182 -30 182 -54 160 C -98 120 -122 40 -124 -40 Z" fill={skin} {...stroke} />
        <path d="M 60 -150 C 110 -120 128 -60 120 0 C 114 70 90 130 50 164 C 80 110 96 50 92 -20 C 88 -80 76 -120 60 -150 Z" fill={skinShade} />
        <ellipse cx={-128} cy={-6} rx={18} ry={32} fill={skin} {...stroke} />
        <ellipse cx={128} cy={-6} rx={18} ry={32} fill={skinShade} {...stroke} />
        {/* hair over the forehead, blown back */}
        <path d="M -126 -44 C -136 -150 -64 -194 0 -192 C 72 -194 140 -146 126 -44 C 112 -110 70 -140 30 -128 C 6 -156 -54 -148 -82 -112 C -100 -96 -116 -72 -126 -44 Z" fill={hair} {...stroke} />
        {/* eyes: wide, tiny pupils */}
        {[-50, 50].map((ex) => (
          <g key={ex}>
            <ellipse cx={ex} cy={-26} rx={40} ry={38} fill="#fff" {...stroke} />
            <circle cx={ex + (ex < 0 ? 6 : -6)} cy={-22} r={7} fill={INK} />
            <path d={`M ${ex - 30} ${-2} Q ${ex} ${12} ${ex + 30} ${-2}`} stroke={INK} strokeWidth={4} fill="none" opacity={0.6} />
          </g>
        ))}
        {/* brows raised high */}
        <path d="M -98 -80 C -72 -92 -42 -106 -18 -128" stroke="#3B1E0C" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d="M 98 -80 C 72 -92 42 -106 18 -128" stroke="#3B1E0C" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d="M -12 -112 L -4 -96 M 12 -112 L 4 -96" stroke="#7A4A2E" strokeWidth={4} strokeLinecap="round" />
        {/* nose */}
        <path d="M -4 0 C -14 30 -22 46 -8 54 C 2 58 14 56 18 50" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        {/* screaming mouth */}
        <path d="M -34 84 C -30 66 30 66 34 84 C 44 124 30 172 0 174 C -30 172 -44 124 -34 84 Z" fill="#4A0F0F" {...stroke} />
        <path d="M -28 80 C -18 72 18 72 28 80 L 27 92 C 12 86 -12 86 -27 92 Z" fill="#fff" />
        <path d="M -20 160 C -10 150 10 150 20 160 C 10 168 -10 168 -20 160 Z" fill="#fff" />
        <path d="M -20 142 C -10 132 10 132 20 142 C 12 150 -12 150 -20 142 Z" fill="#E36B6B" />
        <ellipse cx={-80} cy={40} rx={22} ry={12} fill="#E8846A" opacity={0.55} />
        <ellipse cx={80} cy={40} rx={22} ry={12} fill="#E8846A" opacity={0.45} />
        {/* sweat */}
        <path d="M 108 -100 C 100 -84 100 -70 110 -66 C 120 -70 120 -84 108 -100 Z" fill="#BFE6FF" {...stroke} strokeWidth={4} />
        <path d="M -120 -110 C -128 -94 -128 -80 -118 -76 C -108 -80 -108 -94 -120 -110 Z" fill="#BFE6FF" {...stroke} strokeWidth={4} />
        <path d="M 140 -160 C 132 -144 132 -130 142 -126 C 152 -130 152 -144 140 -160 Z" fill="#BFE6FF" {...stroke} strokeWidth={4} />
      </g>
      {/* the title, TIS boxes */}
      {boxes && <Box x={50} y={70} w={900} h={170} text="SHE SURVIVED" rot={-3} />}
      {boxes && <Box x={50} y={262} w={980} h={210} text="A 3 KM FALL" fill="#E3232C" color="#fff" outline rot={-3} />}
    </g>
  );
}

const YamThumb = () => <YamArt top="HE SURVIVED BOTH" bottom="ATOMIC BOMBS" bottom_w={900} face="shock" big />;   // Storygraphics #4
const STORIES = {juliane: JulianeArt, pisces: PiscesArt, meg: MegArt, yam: YamThumb};

export const Thumb = ({id = 'juliane'}) => {
  const S = STORIES[id] || JulianeArt;
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <style>{FONT_CSS}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}><S /></svg>
    </AbsoluteFill>
  );
};
