import React from 'react';
import {rnd, W, H} from './theme';
import {Layer} from './Camera';

/*
 * Backdrops are layered vector scenes, 1080x1920 with room on both sides for the camera (x from -300 to 1380).
 * Every one has ambient movement (sun, sea, flames, dust, palms) on top of the camera move, and depth layers for parallax.
 * Since 2.22.1 they are drawn like the cast (kit v3): thin warm dark-brown lines, a muted sepia palette, flat soft shading.
 */
const INK = '#4A2C20';
const L = 3.6;
const o = {stroke: INK, strokeWidth: L, strokeLinejoin: 'round', strokeLinecap: 'round'};
// The cast's muted palette, for the world around them
const K = {
  gold: '#D6A85C',
  teal: '#5E8A86',
  sky: '#BCD6D2',
  parchment: '#F1E4C8',
  terracotta: '#B8664A',
  white: '#FBF6EE',
  stone: '#E6D6B8',
  stoneDark: '#CDB892',
  sand: '#E2C48C',
  wood: '#8A6248',
  leaf: '#7E8A5A',
};

const SKY = {
  noon: ['#BCD6D2', '#F1E4C8'],
  sunset: ['#C98A62', '#E6C18A'],
  night: ['#2E3F44', '#4F6A68'],
};

// At night the sky gets a crescent moon, never a sun with rays (2.29.0: ep 22 had a sun in a night sky).
const Moon = ({x, y, r}) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r * 1.6} fill={K.parchment} opacity="0.08" />
    <path d={`M ${r * 0.2} ${-r} A ${r} ${r} 0 1 0 ${r * 0.2} ${r} A ${r * 0.78} ${r * 0.78} 0 1 1 ${r * 0.2} ${-r} Z`} fill={K.parchment} {...o} />
  </g>
);

const Sun = ({x, y, r, frame, color = K.gold, night = false}) => night ? <Moon x={x} y={y - 120} r={r * 0.7} /> : (
  <g transform={`translate(${x} ${y})`}>
    <g transform={`rotate(${frame * 0.35})`} opacity="0.55">
      {Array.from({length: 14}).map((_, i) => (
        <path key={i} d={`M ${-r * 0.16} ${-r * 1.15} L 0 ${-r * 1.6} L ${r * 0.16} ${-r * 1.15} Z`} fill={color} transform={`rotate(${(360 / 14) * i})`} />
      ))}
    </g>
    <circle r={r} fill={color} {...o} />
    <circle r={r * 0.72} fill="#F3D79A" opacity="0.6" />
  </g>
);

const Palm = ({x, y, h = 520, frame, flip = 1, seed = 0}) => {
  const sway = Math.sin(frame / 20 + seed) * 5;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <path d={`M -16 0 Q ${-40 + sway} ${-h * 0.5} ${sway * 2} ${-h} L ${22 + sway * 2} ${-h} Q ${-8 + sway} ${-h * 0.5} 22 0 Z`} fill={K.wood} {...o} />
      {[0.2, 0.4, 0.6, 0.8].map((k) => (
        <path key={k} d={`M ${-12 + sway * k * 2} ${-h * k} q 14 6 28 0`} fill="none" stroke={INK} strokeWidth={L * 0.5} opacity="0.5" />
      ))}
      <g transform={`translate(${sway * 2 + 10} ${-h})`}>
        {[-150, -110, -70, -30, 20, 60, 100, 140].map((a, i) => (
          <g key={i} transform={`rotate(${a + Math.sin(frame / 16 + i + seed) * 4})`}>
            <path d="M 0 0 Q 70 -110 20 -190 Q 130 -120 0 0 Z" fill={i % 2 ? K.leaf : '#6C7A4E'} {...o} strokeWidth={L * 0.8} transform="scale(1.1)" />
          </g>
        ))}
        <circle r="14" fill={K.wood} {...o} strokeWidth={L * 0.8} />
      </g>
    </g>
  );
};

const Column = ({x, y, h, w = 80}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-w / 2 - 14} y={-h} width={w + 28} height="34" rx="6" fill={K.stoneDark} {...o} />
    <rect x={-w / 2} y={-h + 34} width={w} height={h - 60} fill={K.stone} {...o} />
    <rect x={w / 2 - 18} y={-h + 34} width="18" height={h - 60} fill={K.stoneDark} opacity="0.6" />
    {[-18, 0, 18].map((d) => (
      <line key={d} x1={d} y1={-h + 46} x2={d} y2={-26} stroke={INK} strokeWidth={L * 0.5} opacity="0.3" />
    ))}
    <rect x={-w / 2 - 14} y="-26" width={w + 28} height="26" rx="6" fill={K.stoneDark} {...o} />
  </g>
);

const Pharos = ({x, y, frame}) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M -70 0 L -56 -150 L 56 -150 L 70 0 Z" fill={K.stone} {...o} />
    <path d="M -50 -150 L -38 -270 L 38 -270 L 50 -150 Z" fill="#EAD7A6" {...o} />
    <path d="M -34 -270 L -26 -350 L 26 -350 L 34 -270 Z" fill={K.stone} {...o} />
    <rect x="-22" y="-392" width="44" height="42" fill={K.sky} {...o} />
    <path d={`M 0 ${-440 + Math.sin(frame / 3) * 3} Q 22 -410 0 -396 Q -22 -410 0 ${-440 + Math.sin(frame / 3) * 3} Z`} fill={K.gold} stroke={INK} strokeWidth={L * 0.8} />
  </g>
);

const Sky = ({tone, id}) => {
  const [a, b] = SKY[tone] || SKY.noon;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect x="-400" y="-100" width="1880" height="1300" fill={`url(#${id})`} />
    </>
  );
};

const Clouds = ({frame, y = 300}) => (
  <g opacity="0.85">
    {[0, 1, 2].map((i) => {
      const x = ((frame * (0.4 + i * 0.15) + i * 520) % 1900) - 450;
      return (
        <g key={i} transform={`translate(${x} ${y + i * 140})`}>
          <ellipse cx="0" cy="0" rx="120" ry="38" fill={K.white} stroke={INK} strokeWidth={L * 0.7} />
          <ellipse cx="-40" cy="-26" rx="54" ry="34" fill={K.white} stroke={INK} strokeWidth={L * 0.7} />
          <ellipse cx="34" cy="-20" rx="44" ry="28" fill={K.white} stroke={INK} strokeWidth={L * 0.7} />
          <ellipse cx="0" cy="2" rx="118" ry="30" fill={K.white} />
        </g>
      );
    })}
  </g>
);

// ---- Alexandria courtyard (tone: noon | sunset | night) -----------------------------------------
export const Court = ({frame, tone = 'noon'}) => (
  <g>
    <Layer depth={0.15}>
      <Sky tone={tone} id={`sky-${tone}`} />
      <Sun x={tone === 'noon' ? 760 : 700} y={tone === 'noon' ? 300 : 640} r={tone === 'noon' ? 105 : 130} frame={frame} night={tone === 'night'} />
      {tone !== 'night' && <Clouds frame={frame} />}
    </Layer>
    <Layer depth={0.35}>
      <rect x="-400" y="800" width="1880" height="170" fill={K.teal} {...o} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M ${-300 + i * 300 + ((frame * 1.2) % 300)} ${850 + (i % 3) * 38} q 30 -14 60 0 q 30 14 60 0`} fill="none" stroke={K.sky} strokeWidth="5" strokeLinecap="round" />
      ))}
      <Pharos x={190} y={820} frame={frame} />
    </Layer>
    <Layer depth={0.6}>
      <rect x="-400" y="940" width="1880" height="190" fill="#E3CC98" {...o} />
      {[-120, 180, 480, 780, 1080].map((x) => (
        <Column key={x} x={x} y={1130} h={330} />
      ))}
    </Layer>
    <Layer depth={0.85}>
      <rect x="-400" y="1130" width="1880" height="800" fill="#EBD7A8" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line key={i} x1={-400 + i * 260} y1="1130" x2={540 + (i - 3.5) * 520} y2="1920" stroke={INK} strokeWidth={L * 0.7} opacity="0.18" />
      ))}
      {[1250, 1390, 1560, 1760].map((y) => (
        <line key={y} x1="-400" y1={y} x2="1480" y2={y} stroke={INK} strokeWidth={L * 0.7} opacity="0.18" />
      ))}
      <Palm x={-120} y={1240} frame={frame} seed={1} h={560} />
      <Palm x={1200} y={1230} frame={frame} seed={3} flip={-1} h={520} />
    </Layer>
    {tone === 'night' && <rect x="-400" y="-100" width="1880" height="2100" fill={INK} opacity="0.35" />}
  </g>
);

// ---- Library interior --------------------------------------------------------------------------
export const Library = ({frame}) => (
  <g>
    <Layer depth={0.3}>
      <rect x="-400" y="-100" width="1880" height="2100" fill="#6E5440" />
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          <rect x="-300" y={140 + r * 250} width="1680" height="210" fill="#5A4232" {...o} />
          {Array.from({length: 14}).map((_, c) => {
            const x = -270 + c * 120;
            return (
              <g key={c}>
                <rect x={x} y={150 + r * 250} width="104" height="190" fill="#4A3628" stroke={INK} strokeWidth={L * 0.7} />
                {rnd(r * 20 + c) > 0.18 && (
                  <g transform={`translate(${x + 52} ${245 + r * 250})`}>
                    <rect x="-40" y="-26" width="80" height="52" rx="26" fill={K.parchment} stroke={INK} strokeWidth={L * 0.7} />
                    <circle cx="26" cy="0" r="18" fill="#E3CC98" stroke={INK} strokeWidth={L * 0.7} />
                    <circle cx="26" cy="0" r="7" fill="none" stroke={INK} strokeWidth={L * 0.5} />
                  </g>
                )}
                {rnd(r * 31 + c + 7) > 0.55 && (
                  <g transform={`translate(${x + 52} ${300 + r * 250})`}>
                    <rect x="-40" y="-20" width="80" height="40" rx="20" fill={K.gold} stroke={INK} strokeWidth={L * 0.7} />
                  </g>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </Layer>
    <Layer depth={0.7}>
      {/* sunlight shafts that slowly slide */}
      {[0, 1, 2].map((i) => {
        const dx = Math.sin(frame / 60 + i * 2) * 40;
        return <path key={i} d={`M ${60 + i * 330 + dx} 0 L ${200 + i * 330 + dx} 0 L ${520 + i * 330 + dx} 1500 L ${300 + i * 330 + dx} 1500 Z`} fill={K.gold} opacity="0.16" />;
      })}
      {Array.from({length: 26}).map((_, i) => (
        <circle key={i} cx={(rnd(i) * 1500 - 200 + Math.sin(frame / 30 + i) * 20)} cy={(rnd(i + 50) * 1700 + frame * (0.3 + rnd(i + 9) * 0.5)) % 1800} r={3 + rnd(i + 3) * 4} fill={K.parchment} opacity="0.6" />
      ))}
    </Layer>
    <Layer depth={0.9}>
      <rect x="-400" y="1180" width="1880" height="800" fill="#B98A57" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1="-400" y1={1180 + i * 130} x2="1480" y2={1180 + i * 130} stroke={INK} strokeWidth={L * 0.7} opacity="0.28" />
      ))}
      <rect x="-400" y="1170" width="1880" height="14" fill={INK} />
    </Layer>
  </g>
);

// ---- The Nile at Syene -------------------------------------------------------------------------
export const Nile = ({frame}) => (
  <g>
    <Layer depth={0.15}>
      <Sky tone="noon" id="sky-nile" />
      <Sun x={240} y={330} r={100} frame={frame} />
      <Clouds frame={frame + 200} y={420} />
    </Layer>
    <Layer depth={0.35}>
      <path d="M -400 900 Q -100 740 200 860 Q 520 700 820 850 Q 1100 760 1480 880 L 1480 1000 L -400 1000 Z" fill={K.sand} {...o} />
      <path d="M -400 960 Q 80 860 420 950 Q 760 860 1100 960 Q 1300 920 1480 960 L 1480 1040 L -400 1040 Z" fill="#D2AE72" {...o} />
    </Layer>
    <Layer depth={0.6}>
      <rect x="-400" y="1000" width="1880" height="480" fill={K.teal} {...o} />
      {Array.from({length: 18}).map((_, i) => {
        const y = 1040 + (i % 6) * 70;
        const x = ((-300 + (i * 211) + frame * (1.2 + (i % 3) * 0.5)) % 1900) - 350;
        return <path key={i} d={`M ${x} ${y} q 24 -14 48 0 q 24 14 48 0`} fill="none" stroke={K.sky} strokeWidth="5" strokeLinecap="round" />;
      })}
      {/* felucca sailing past */}
      {(() => {
        const x = ((frame * 3.2) % 2200) - 500;
        const bob = Math.sin(frame / 10) * 6;
        return (
          <g transform={`translate(${x} ${1170 + bob})`}>
            <path d="M -110 0 L 110 0 L 76 46 L -76 46 Z" fill={K.wood} {...o} />
            <line x1="0" y1="0" x2="0" y2="-250" stroke={INK} strokeWidth="7" />
            <path d="M 8 -244 L 8 -20 L 150 -20 Z" fill={K.parchment} {...o} />
          </g>
        );
      })()}
    </Layer>
    <Layer depth={0.9}>
      <path d="M -400 1420 Q 300 1360 700 1430 Q 1100 1370 1480 1420 L 1480 1960 L -400 1960 Z" fill={K.sand} {...o} />
      <Palm x={90} y={1500} frame={frame} seed={2} h={600} />
      <Palm x={960} y={1520} frame={frame} seed={5} flip={-1} h={540} />
      {[220, 640, 820].map((x) => (
        <path key={x} d={`M ${x - 70} 1620 q 20 -80 70 -60 q 60 -30 80 60 Z`} fill="#A98760" {...o} />
      ))}
    </Layer>
  </g>
);

// ---- Looking down a well -----------------------------------------------------------------------
export const Well = ({frame}) => {
  const ripple = (frame % 45) / 45;
  return (
    <g>
      <Layer depth={0.3}>
        <rect x="-400" y="-100" width="1880" height="2100" fill="#D9B77A" />
        {Array.from({length: 40}).map((_, i) => (
          <ellipse key={i} cx={rnd(i) * 1800 - 300} cy={rnd(i + 70) * 2000 - 50} rx={14 + rnd(i + 5) * 22} ry={6 + rnd(i + 8) * 8} fill={INK} opacity="0.08" />
        ))}
      </Layer>
      <Layer depth={0.75}>
        <circle cx="540" cy="900" r="470" fill="#D8C08A" {...o} />
        {Array.from({length: 18}).map((_, i) => (
          <line key={i} x1={540 + Math.cos((i / 18) * Math.PI * 2) * 330} y1={900 + Math.sin((i / 18) * Math.PI * 2) * 330} x2={540 + Math.cos((i / 18) * Math.PI * 2) * 470} y2={900 + Math.sin((i / 18) * Math.PI * 2) * 470} stroke={INK} strokeWidth={L * 0.8} opacity="0.5" />
        ))}
        <circle cx="540" cy="900" r="330" fill="#3E4E4C" {...o} />
        <circle cx="540" cy="900" r="250" fill="#2E3B3A" />
        {/* the sun shining straight down: a bright disc on the water */}
        <circle cx="540" cy="900" r={150 + Math.sin(frame / 8) * 6} fill={K.gold} opacity="0.95" />
        <circle cx="540" cy="900" r={90} fill="#F6E2AE" />
        {[0, 1].map((k) => {
          const p = (ripple + k * 0.5) % 1;
          return <circle key={k} cx="540" cy="900" r={90 + p * 200} fill="none" stroke={K.parchment} strokeWidth={6 * (1 - p)} opacity={1 - p} />;
        })}
        {Array.from({length: 12}).map((_, i) => (
          <line key={i} x1={540 + Math.cos((i / 12) * Math.PI * 2) * 170} y1={900 + Math.sin((i / 12) * Math.PI * 2) * 170} x2={540 + Math.cos((i / 12) * Math.PI * 2) * (210 + Math.sin(frame / 6 + i) * 14)} y2={900 + Math.sin((i / 12) * Math.PI * 2) * (210 + Math.sin(frame / 6 + i) * 14)} stroke="#F6E2AE" strokeWidth="7" strokeLinecap="round" />
        ))}
        {/* a jar swinging on its rope at the rim */}
        <g transform={`translate(${760} ${520}) rotate(${Math.sin(frame / 12) * 8})`}>
          <line x1="0" y1="-60" x2="0" y2="0" stroke={INK} strokeWidth="5" />
          <path d="M -34 0 Q -50 50 -26 86 L 26 86 Q 50 50 34 0 Z" fill={K.terracotta} {...o} />
          <ellipse cx="0" cy="0" rx="34" ry="10" fill="#8A3F28" {...o} />
        </g>
      </Layer>
    </g>
  );
};

// ---- Dusk study with a lamp -------------------------------------------------------------------
export const Study = ({frame}) => {
  const flick = 1 + Math.sin(frame / 3) * 0.04 + Math.sin(frame / 7.3) * 0.03;
  return (
    <g>
      <Layer depth={0.3}>
        <rect x="-400" y="-100" width="1880" height="2100" fill="#3A3A3A" />
        <rect x="-400" y="-100" width="1880" height="2100" fill="#5A4636" opacity="0.7" />
        <rect x="300" y="160" width="480" height="560" rx="240" fill="#2C3436" {...o} />
        {Array.from({length: 24}).map((_, i) => (
          <circle key={i} cx={330 + rnd(i) * 420} cy={200 + rnd(i + 40) * 440} r={2 + rnd(i + 5) * 3 + Math.sin(frame / 10 + i) * 1.2} fill={K.parchment} />
        ))}
        <circle cx="650" cy="330" r="70" fill={K.parchment} {...o} />
        <circle cx="676" cy="312" r="62" fill="#2C3436" />
      </Layer>
      <Layer depth={0.8}>
        <rect x="-400" y="1100" width="1880" height="900" fill={K.wood} {...o} />
        <rect x="-400" y="1100" width="1880" height="40" fill="#A87848" />
        {/* scrolls and a wax tablet on the desk */}
        <rect x="80" y="1020" width="280" height="80" rx="14" fill={K.parchment} {...o} />
        <circle cx="360" cy="1060" r="40" fill="#E3CC98" {...o} />
        <rect x="700" y="1030" width="240" height="70" rx="8" fill="#6C4A2E" {...o} />
        <rect x="716" y="1040" width="208" height="50" rx="4" fill="#4B3321" />
        {/* the lamp glow */}
        <defs>
          <radialGradient id="lampglow">
            <stop offset="0" stopColor="#F3C873" stopOpacity="0.5" />
            <stop offset="1" stopColor="#F3C873" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="900" cy="960" r={520 * flick} fill="url(#lampglow)" />
        <g transform="translate(900 1040)">
          <path d="M -60 60 L 60 60 L 40 0 L -40 0 Z" fill={K.gold} {...o} />
          <path d="M -40 0 Q -50 -50 0 -64 Q 50 -50 40 0 Z" fill={K.terracotta} {...o} />
          <path d={`M 0 ${-120 * flick} Q 28 -86 0 -64 Q -28 -86 0 ${-120 * flick} Z`} fill="#F3C873" stroke={INK} strokeWidth={L * 0.8} />
        </g>
      </Layer>
    </g>
  );
};

// A flat-roofed town house: whitewashed walls with a shaded side, a door, small windows, sometimes an awning.
const House = ({x, y, w, h, seed, frame}) => {
  const wall = ['#EADBC0', '#E2CCA6', '#D9BE96', '#EFE3CC'][Math.floor(rnd(seed) * 4)];
  const awning = rnd(seed + 3) > 0.5;
  const flap = Math.sin(frame / 14 + seed) * 3;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-h} width={w} height={h} fill={wall} {...o} />
      <rect x={w / 2 - w * 0.18} y={-h} width={w * 0.18} height={h} fill="#000" opacity="0.07" />
      <rect x={-w / 2 - 8} y={-h - 16} width={w + 16} height="18" fill="#CDB892" {...o} />
      <path d={`M ${-w * 0.12} 0 L ${-w * 0.12} ${-h * 0.42} Q 0 ${-h * 0.52} ${w * 0.12} ${-h * 0.42} L ${w * 0.12} 0 Z`} fill="#6C4A2E" {...o} />
      {[-0.32, 0.3].map((k) => <rect key={k} x={w * k - 16} y={-h * 0.8} width="32" height="40" rx="3" fill="#4A3628" {...o} />)}
      {awning && (
        <path d={`M ${-w * 0.42} ${-h * 0.5} L ${w * 0.42} ${-h * 0.5} L ${w * 0.46} ${-h * 0.4 + flap} L ${-w * 0.46} ${-h * 0.4 + flap} Z`}
          fill={rnd(seed + 5) > 0.5 ? K.terracotta : '#9A6B55'} {...o} />
      )}
    </g>
  );
};

// ---- An Alexandria street (tone: noon | sunset | night) -----------------------------------------
export const Street = ({frame, tone = 'noon'}) => (
  <g>
    <Layer depth={0.12}>
      <Sky tone={tone} id={`sky-street-${tone}`} />
      <Sun x={820} y={tone === 'noon' ? 260 : 620} r={90} frame={frame} night={tone === 'night'} />
      {tone !== 'night' && <Clouds frame={frame + 90} y={260} />}
    </Layer>
    <Layer depth={0.3}>
      {/* far roofs and the lighthouse at the end of the street */}
      {Array.from({length: 9}).map((_, i) => (
        <rect key={i} x={-380 + i * 210} y={860 - rnd(i + 2) * 120} width="200" height={200 + rnd(i + 2) * 120} fill="#D9C7A6" stroke={INK} strokeWidth={L * 0.6} opacity="0.85" />
      ))}
      <Pharos x={560} y={900} frame={frame} />
    </Layer>
    <Layer depth={0.6}>
      {[-260, 30, 330, 760, 1060, 1340].map((x, i) => (
        <House key={x} x={x} y={1150} w={260 + rnd(i * 3) * 60} h={380 + rnd(i * 7) * 140} seed={i + 1} frame={frame} />
      ))}
      {/* a market stall with jars and a striped cloth */}
      <g transform="translate(560 1150)">
        <rect x="-120" y="-120" width="240" height="120" fill={K.wood} {...o} />
        <path d={`M -150 -200 L 150 -200 L 160 ${-150 + Math.sin(frame / 12) * 3} L -160 ${-150 + Math.sin(frame / 12) * 3} Z`} fill={K.parchment} {...o} />
        {[-110, -50, 10, 70, 130].map((x) => <rect key={x} x={x - 14} y="-200" width="28" height="50" fill={K.terracotta} opacity="0.75" />)}
        {[-70, 0, 70].map((x, i) => <path key={x} d={`M ${x - 22} -120 Q ${x - 30} -160 ${x - 12} -176 L ${x + 12} -176 Q ${x + 30} -160 ${x + 22} -120 Z`} fill={i === 1 ? '#9A6B55' : K.terracotta} {...o} />)}
      </g>
    </Layer>
    <Layer depth={0.88}>
      <rect x="-400" y="1150" width="1880" height="800" fill="#DCC49A" />
      {Array.from({length: 7}).map((_, i) => (
        <line key={i} x1={-400 + i * 300} y1="1150" x2={540 + (i - 3) * 560} y2="1920" stroke={INK} strokeWidth={L * 0.6} opacity="0.16" />
      ))}
      {[1230, 1360, 1530, 1740].map((y) => (
        <line key={y} x1="-400" y1={y} x2="1480" y2={y} stroke={INK} strokeWidth={L * 0.6} opacity="0.16" />
      ))}
      {/* dust drifting across the street */}
      {Array.from({length: 14}).map((_, i) => (
        <circle key={i} cx={((rnd(i) * 1800 + frame * (0.8 + rnd(i + 4))) % 1900) - 400} cy={1180 + rnd(i + 9) * 600} r={2 + rnd(i + 2) * 3} fill={K.parchment} opacity="0.5" />
      ))}
    </Layer>
    {tone === 'night' && <rect x="-400" y="-100" width="1880" height="2100" fill={INK} opacity="0.35" />}
  </g>
);

// ---- The desert road (a caravan crosses far away) -----------------------------------------------
export const Desert = ({frame, tone = 'noon'}) => {
  const heat = Math.sin(frame / 9) * 2;
  return (
    <g>
      <Layer depth={0.1}>
        <Sky tone={tone} id={`sky-desert-${tone}`} />
        <Sun x={300} y={tone === 'noon' ? 300 : 700} r={110} frame={frame} night={tone === 'night'} />
      </Layer>
      <Layer depth={0.3}>
        <path d="M -400 960 Q -100 820 220 920 Q 560 800 900 930 Q 1200 840 1480 940 L 1480 1100 L -400 1100 Z" fill="#E6CB95" {...o} />
        {/* the caravan: small camels and walkers in a slow line along the dune */}
        {Array.from({length: 4}).map((_, i) => {
          const x = ((frame * 0.9 + i * 90) % 2000) - 400;
          const bob = Math.abs(Math.sin(frame / 7 + i)) * 4;
          return (
            <g key={i} transform={`translate(${x} ${905 - bob})`} opacity="0.85">
              <path d="M -26 0 L -22 -24 Q -18 -40 -4 -34 Q 4 -48 16 -34 L 26 -36 L 32 -48 L 38 -44 L 32 -28 L 22 -20 L 24 0" fill="none" stroke={INK} strokeWidth={L * 0.9} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
      </Layer>
      <Layer depth={0.6}>
        <path d="M -400 1060 Q 0 980 420 1060 Q 820 990 1480 1070 L 1480 1260 L -400 1260 Z" fill="#DDBA7E" {...o} />
        {[-120, 1180].map((x, i) => (
          <g key={x} transform={`translate(${x} 1120)`}>
            <path d="M -60 0 Q -40 -60 0 -70 Q 40 -60 60 0 Z" fill="#B49A70" {...o} />
          </g>
        ))}
      </Layer>
      <Layer depth={0.9}>
        <rect x="-400" y="1200" width="1880" height="800" fill="#E2C48C" />
        {/* the road narrowing to the horizon, with ruts and stones */}
        <path d="M 380 1200 L 700 1200 L 1280 1960 L -200 1960 Z" fill="#CDA872" stroke={INK} strokeWidth={L * 0.8} strokeLinejoin="round" />
        <path d="M 500 1200 L 260 1960 M 580 1200 L 820 1960" stroke={INK} strokeWidth={L * 0.6} opacity="0.3" />
        {Array.from({length: 10}).map((_, i) => (
          <ellipse key={i} cx={rnd(i + 30) * 1600 - 260} cy={1260 + rnd(i + 40) * 600} rx={10 + rnd(i) * 18} ry={6 + rnd(i + 1) * 6} fill="#B49A70" stroke={INK} strokeWidth={L * 0.5} />
        ))}
        {/* heat shimmer near the horizon */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${-200 + i * 520} ${1215 + i * 6} q 40 ${-6 + heat} 80 0 t 80 0 t 80 0`} fill="none" stroke={K.parchment} strokeWidth="3" opacity="0.5" />
        ))}
      </Layer>
      {tone === 'night' && <rect x="-400" y="-100" width="1880" height="2100" fill={INK} opacity="0.4" />}
    </g>
  );
};

export const BACKDROPS = {court: Court, library: Library, nile: Nile, well: Well, study: Study, street: Street, desert: Desert};
export const BACKDROP_NAMES = Object.keys(BACKDROPS).concat(['map', 'diagram']);
