import React from 'react';
import {C, LINE, rnd, W, H} from './theme';
import {Layer} from './Camera';

/*
 * Backdrops are layered vector scenes, 1080x1920 with room on both sides for the camera (x from -300 to 1380).
 * Every one has ambient movement (sun, sea, flames, dust, palms) on top of the camera move.
 */
const L = LINE;
const o = {stroke: C.ink, strokeWidth: L, strokeLinejoin: 'round', strokeLinecap: 'round'};

const SKY = {
  noon: ['#9ACFD6', '#F5E6C4'],
  sunset: ['#C8573A', '#E8A93A'],
  night: ['#16323A', '#1F6670'],
};

const Sun = ({x, y, r, frame, color = C.gold}) => (
  <g transform={`translate(${x} ${y})`}>
    <g transform={`rotate(${frame * 0.35})`}>
      {Array.from({length: 14}).map((_, i) => (
        <path key={i} d={`M ${-r * 0.22} ${-r * 1.15} L 0 ${-r * 1.75} L ${r * 0.22} ${-r * 1.15} Z`} fill={color} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" transform={`rotate(${(360 / 14) * i})`} />
      ))}
    </g>
    <circle r={r} fill={color} {...o} />
    <circle r={r * 0.72} fill="#F7C96B" opacity="0.7" />
  </g>
);

const Palm = ({x, y, h = 520, frame, flip = 1, seed = 0}) => {
  const sway = Math.sin(frame / 20 + seed) * 5;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <path d={`M -16 0 Q ${-40 + sway} ${-h * 0.5} ${sway * 2} ${-h} L ${22 + sway * 2} ${-h} Q ${-8 + sway} ${-h * 0.5} 22 0 Z`} fill="#8A5A3A" {...o} />
      <g transform={`translate(${sway * 2 + 10} ${-h})`}>
        {[-150, -110, -70, -30, 20, 60, 100, 140].map((a, i) => (
          <g key={i} transform={`rotate(${a + Math.sin(frame / 16 + i + seed) * 4})`}>
            <path d="M 0 0 Q 70 -110 20 -190 Q 130 -120 0 0 Z" fill={i % 2 ? C.teal : '#2D7F72'} {...o} strokeWidth={6} transform="scale(1.1)" />
          </g>
        ))}
        <circle r="14" fill="#8A5A3A" {...o} strokeWidth={5} />
      </g>
    </g>
  );
};

const Column = ({x, y, h, w = 80}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-w / 2 - 14} y={-h} width={w + 28} height="34" rx="6" fill={C.gold} {...o} strokeWidth={6} />
    <rect x={-w / 2} y={-h + 34} width={w} height={h - 60} fill={C.parchment} {...o} strokeWidth={6} />
    {[-18, 0, 18].map((d) => (
      <line key={d} x1={d} y1={-h + 46} x2={d} y2={-26} stroke={C.ink} strokeWidth="3" opacity="0.3" />
    ))}
    <rect x={-w / 2 - 14} y="-26" width={w + 28} height="26" rx="6" fill={C.gold} {...o} strokeWidth={6} />
  </g>
);

const Pharos = ({x, y, frame}) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M -70 0 L -56 -150 L 56 -150 L 70 0 Z" fill={C.parchment} {...o} strokeWidth={6} />
    <path d="M -50 -150 L -38 -270 L 38 -270 L 50 -150 Z" fill="#EAD7A6" {...o} strokeWidth={6} />
    <path d="M -34 -270 L -26 -350 L 26 -350 L 34 -270 Z" fill={C.parchment} {...o} strokeWidth={6} />
    <rect x="-22" y="-392" width="44" height="42" fill={C.sky} {...o} strokeWidth={6} />
    <path d={`M 0 ${-440 + Math.sin(frame / 3) * 3} Q 22 -410 0 -396 Q -22 -410 0 ${-440 + Math.sin(frame / 3) * 3} Z`} fill={C.gold} stroke={C.ink} strokeWidth="4" />
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
  <g opacity="0.9">
    {[0, 1, 2].map((i) => {
      const x = ((frame * (0.4 + i * 0.15) + i * 520) % 1900) - 450;
      return (
        <g key={i} transform={`translate(${x} ${y + i * 140})`}>
          <ellipse cx="0" cy="0" rx="120" ry="38" fill={C.white} stroke={C.ink} strokeWidth="5" />
          <ellipse cx="-40" cy="-26" rx="54" ry="34" fill={C.white} stroke={C.ink} strokeWidth="5" />
          <ellipse cx="34" cy="-20" rx="44" ry="28" fill={C.white} stroke={C.ink} strokeWidth="5" />
          <ellipse cx="0" cy="2" rx="118" ry="30" fill={C.white} />
        </g>
      );
    })}
  </g>
);

// ---- Alexandria courtyard (tone: noon | sunset | night) -----------------------------------------
export const Court = ({frame, tone = 'noon', rod}) => (
  <g>
    <Layer depth={0.15}>
      <Sky tone={tone} id={`sky-${tone}`} />
      <Sun x={tone === 'noon' ? 760 : 700} y={tone === 'noon' ? 300 : 640} r={tone === 'noon' ? 105 : 130} frame={frame} color={tone === 'night' ? '#F5E6C4' : C.gold} />
      {tone !== 'night' && <Clouds frame={frame} />}
    </Layer>
    <Layer depth={0.35}>
      <rect x="-400" y="800" width="1880" height="170" fill={C.teal} {...o} strokeWidth={6} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M ${-300 + i * 300 + ((frame * 1.2) % 300)} ${850 + (i % 3) * 38} q 30 -14 60 0 q 30 14 60 0`} fill="none" stroke={C.sky} strokeWidth="6" strokeLinecap="round" />
      ))}
      <Pharos x={190} y={820} frame={frame} />
    </Layer>
    <Layer depth={0.6}>
      <rect x="-400" y="940" width="1880" height="190" fill="#E3CC98" {...o} strokeWidth={6} />
      {[-120, 180, 480, 780, 1080].map((x) => (
        <Column key={x} x={x} y={1130} h={330} />
      ))}
    </Layer>
    <Layer depth={0.85}>
      <rect x="-400" y="1130" width="1880" height="800" fill="#EBD7A8" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line key={i} x1={-400 + i * 260} y1="1130" x2={540 + (i - 3.5) * 520} y2="1920" stroke={C.ink} strokeWidth="4" opacity="0.18" />
      ))}
      {[1250, 1390, 1560, 1760].map((y) => (
        <line key={y} x1="-400" y1={y} x2="1480" y2={y} stroke={C.ink} strokeWidth="4" opacity="0.18" />
      ))}
      <Palm x={-120} y={1240} frame={frame} seed={1} h={560} />
      <Palm x={1200} y={1230} frame={frame} seed={3} flip={-1} h={520} />
    </Layer>
    {tone === 'night' && <rect x="-400" y="-100" width="1880" height="2100" fill={C.ink} opacity="0.35" />}
  </g>
);

// ---- Library interior --------------------------------------------------------------------------
export const Library = ({frame}) => (
  <g>
    <Layer depth={0.3}>
      <rect x="-400" y="-100" width="1880" height="2100" fill="#17474F" />
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          <rect x="-300" y={140 + r * 250} width="1680" height="210" fill="#10363D" {...o} strokeWidth={6} />
          {Array.from({length: 14}).map((_, c) => {
            const x = -270 + c * 120;
            return (
              <g key={c}>
                <rect x={x} y={150 + r * 250} width="104" height="190" fill="#0C2B31" stroke={C.ink} strokeWidth="4" />
                {rnd(r * 20 + c) > 0.18 && (
                  <g transform={`translate(${x + 52} ${245 + r * 250})`}>
                    <rect x="-40" y="-26" width="80" height="52" rx="26" fill={C.parchment} stroke={C.ink} strokeWidth="4" />
                    <circle cx="26" cy="0" r="18" fill="#E3CC98" stroke={C.ink} strokeWidth="4" />
                    <circle cx="26" cy="0" r="7" fill="none" stroke={C.ink} strokeWidth="3" />
                  </g>
                )}
                {rnd(r * 31 + c + 7) > 0.55 && (
                  <g transform={`translate(${x + 52} ${300 + r * 250})`}>
                    <rect x="-40" y="-20" width="80" height="40" rx="20" fill={C.gold} stroke={C.ink} strokeWidth="4" />
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
        return <path key={i} d={`M ${60 + i * 330 + dx} 0 L ${200 + i * 330 + dx} 0 L ${520 + i * 330 + dx} 1500 L ${300 + i * 330 + dx} 1500 Z`} fill={C.gold} opacity="0.18" />;
      })}
      {Array.from({length: 26}).map((_, i) => (
        <circle key={i} cx={(rnd(i) * 1500 - 200 + Math.sin(frame / 30 + i) * 20)} cy={(rnd(i + 50) * 1700 + frame * (0.3 + rnd(i + 9) * 0.5)) % 1800} r={3 + rnd(i + 3) * 4} fill={C.parchment} opacity="0.7" />
      ))}
    </Layer>
    <Layer depth={0.9}>
      <rect x="-400" y="1180" width="1880" height="800" fill="#B98A57" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1="-400" y1={1180 + i * 130} x2="1480" y2={1180 + i * 130} stroke={C.ink} strokeWidth="4" opacity="0.28" />
      ))}
      <rect x="-400" y="1170" width="1880" height="22" fill={C.ink} />
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
      <path d="M -400 900 Q -100 740 200 860 Q 520 700 820 850 Q 1100 760 1480 880 L 1480 1000 L -400 1000 Z" fill={C.gold} {...o} strokeWidth={6} />
      <path d="M -400 960 Q 80 860 420 950 Q 760 860 1100 960 Q 1300 920 1480 960 L 1480 1040 L -400 1040 Z" fill="#E3A83F" {...o} strokeWidth={6} />
    </Layer>
    <Layer depth={0.6}>
      <rect x="-400" y="1000" width="1880" height="480" fill={C.teal} {...o} strokeWidth={6} />
      {Array.from({length: 18}).map((_, i) => {
        const y = 1040 + (i % 6) * 70;
        const x = ((-300 + (i * 211) + frame * (1.2 + (i % 3) * 0.5)) % 1900) - 350;
        return <path key={i} d={`M ${x} ${y} q 24 -14 48 0 q 24 14 48 0`} fill="none" stroke={C.sky} strokeWidth="6" strokeLinecap="round" />;
      })}
      {/* felucca sailing past */}
      {(() => {
        const x = ((frame * 3.2) % 2200) - 500;
        const bob = Math.sin(frame / 10) * 6;
        return (
          <g transform={`translate(${x} ${1170 + bob})`}>
            <path d="M -110 0 L 110 0 L 76 46 L -76 46 Z" fill="#8A5A3A" {...o} strokeWidth={6} />
            <line x1="0" y1="0" x2="0" y2="-250" stroke={C.ink} strokeWidth="9" />
            <path d="M 8 -244 L 8 -20 L 150 -20 Z" fill={C.parchment} {...o} strokeWidth={6} />
          </g>
        );
      })()}
    </Layer>
    <Layer depth={0.9}>
      <path d="M -400 1420 Q 300 1360 700 1430 Q 1100 1370 1480 1420 L 1480 1960 L -400 1960 Z" fill={C.gold} {...o} strokeWidth={6} />
      <Palm x={90} y={1500} frame={frame} seed={2} h={600} />
      <Palm x={960} y={1520} frame={frame} seed={5} flip={-1} h={540} />
      {[220, 640, 820].map((x, i) => (
        <path key={x} d={`M ${x - 70} 1620 q 20 -80 70 -60 q 60 -30 80 60 Z`} fill="#A98760" {...o} strokeWidth={6} />
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
        <rect x="-400" y="-100" width="1880" height="2100" fill="#E3B764" />
        {Array.from({length: 40}).map((_, i) => (
          <ellipse key={i} cx={rnd(i) * 1800 - 300} cy={rnd(i + 70) * 2000 - 50} rx={14 + rnd(i + 5) * 22} ry={6 + rnd(i + 8) * 8} fill={C.ink} opacity="0.1" />
        ))}
      </Layer>
      <Layer depth={0.75}>
        <circle cx="540" cy="900" r="470" fill="#D8C08A" {...o} />
        {Array.from({length: 18}).map((_, i) => (
          <line key={i} x1={540 + Math.cos((i / 18) * Math.PI * 2) * 330} y1={900 + Math.sin((i / 18) * Math.PI * 2) * 330} x2={540 + Math.cos((i / 18) * Math.PI * 2) * 470} y2={900 + Math.sin((i / 18) * Math.PI * 2) * 470} stroke={C.ink} strokeWidth="5" opacity="0.5" />
        ))}
        <circle cx="540" cy="900" r="330" fill="#17474F" {...o} />
        <circle cx="540" cy="900" r="250" fill="#0F3037" />
        {/* the sun shining straight down: a bright disc on the water */}
        <circle cx="540" cy="900" r={150 + Math.sin(frame / 8) * 6} fill={C.gold} opacity="0.95" />
        <circle cx="540" cy="900" r={90} fill="#FFE9A8" />
        {[0, 1].map((k) => {
          const p = (ripple + k * 0.5) % 1;
          return <circle key={k} cx="540" cy="900" r={90 + p * 200} fill="none" stroke={C.parchment} strokeWidth={6 * (1 - p)} opacity={1 - p} />;
        })}
        {Array.from({length: 12}).map((_, i) => (
          <line key={i} x1={540 + Math.cos((i / 12) * Math.PI * 2) * 170} y1={900 + Math.sin((i / 12) * Math.PI * 2) * 170} x2={540 + Math.cos((i / 12) * Math.PI * 2) * (210 + Math.sin(frame / 6 + i) * 14)} y2={900 + Math.sin((i / 12) * Math.PI * 2) * (210 + Math.sin(frame / 6 + i) * 14)} stroke="#FFE9A8" strokeWidth="8" strokeLinecap="round" />
        ))}
        {/* a jar swinging on its rope at the rim */}
        <g transform={`translate(${760} ${520}) rotate(${Math.sin(frame / 12) * 8})`}>
          <line x1="0" y1="-60" x2="0" y2="0" stroke={C.ink} strokeWidth="6" />
          <path d="M -34 0 Q -50 50 -26 86 L 26 86 Q 50 50 34 0 Z" fill={C.terracotta} {...o} strokeWidth={6} />
          <ellipse cx="0" cy="0" rx="34" ry="10" fill="#8A3F28" {...o} strokeWidth={5} />
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
        <rect x="-400" y="-100" width="1880" height="2100" fill="#1B3F47" />
        <rect x="300" y="160" width="480" height="560" rx="240" fill="#0B2228" {...o} />
        {Array.from({length: 24}).map((_, i) => (
          <circle key={i} cx={330 + rnd(i) * 420} cy={200 + rnd(i + 40) * 440} r={2 + rnd(i + 5) * 3 + Math.sin(frame / 10 + i) * 1.2} fill={C.parchment} />
        ))}
        <circle cx="650" cy="330" r="70" fill={C.parchment} {...o} strokeWidth={6} />
        <circle cx="676" cy="312" r="62" fill="#0B2228" />
      </Layer>
      <Layer depth={0.8}>
        <rect x="-400" y="1100" width="1880" height="900" fill="#8A5A3A" {...o} />
        <rect x="-400" y="1100" width="1880" height="40" fill="#A87848" />
        {/* scrolls and a wax tablet on the desk */}
        <rect x="80" y="1020" width="280" height="80" rx="14" fill={C.parchment} {...o} strokeWidth={6} />
        <circle cx="360" cy="1060" r="40" fill="#E3CC98" {...o} strokeWidth={6} />
        <rect x="700" y="1030" width="240" height="70" rx="8" fill="#6C4A2E" {...o} strokeWidth={6} />
        <rect x="716" y="1040" width="208" height="50" rx="4" fill="#4B3321" />
        {/* the lamp glow */}
        <defs>
          <radialGradient id="lampglow">
            <stop offset="0" stopColor="#FFD36B" stopOpacity="0.55" />
            <stop offset="1" stopColor="#FFD36B" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="900" cy="960" r={520 * flick} fill="url(#lampglow)" />
        <g transform="translate(900 1040)">
          <path d="M -60 60 L 60 60 L 40 0 L -40 0 Z" fill={C.gold} {...o} strokeWidth={6} />
          <path d="M -40 0 Q -50 -50 0 -64 Q 50 -50 40 0 Z" fill={C.terracotta} {...o} strokeWidth={6} />
          <path d={`M 0 ${-120 * flick} Q 28 -86 0 -64 Q -28 -86 0 ${-120 * flick} Z`} fill="#FFD36B" stroke={C.ink} strokeWidth="4" />
        </g>
      </Layer>
    </g>
  );
};

export const BACKDROPS = {court: Court, library: Library, nile: Nile, well: Well, study: Study};
export const BACKDROP_NAMES = Object.keys(BACKDROPS).concat(['map', 'diagram']);
