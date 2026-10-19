// What the 2.55.0 setup adds, shown on its own for the owner: people moving from motion capture (MotionTest, a short video) and the
// ready-made props (EmojiSheet, a still).
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {W, H, INK, OSWALD} from './tis';
import {Mover, motionSpeed} from './motion';
import {Emoji} from './emoji';
import {FONT_CSS} from './fonts';
import {SHOTS} from './Opening';

const T = ({x, y, children, size = 40, anchor = 'middle'}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={OSWALD} fontWeight={700} fontSize={size} fill="#fff" stroke={INK} strokeWidth={size * 0.14} paintOrder="stroke">{children}</text>
);

const CELLS = [
  ['juliane', 'walk', 1, 'calm', 'WALK'], ['father', 'walk_sad', 1, 'sad', 'SAD WALK'], ['mother', 'walk_tired', 1, 'worried', 'EXHAUSTED'],
  ['juliane', 'limp', 1, 'worried', 'LIMP (HURT LEG)'], ['worker1', 'run', 1, 'scared', 'RUN'], ['chapman', 'swim', 1, 'determined', 'SWIM (TURNED TO LIE IN THE WATER)'],
  ['mallinson', 'ladder', 1, 'determined', 'CLIMB A LADDER'], ['worker2', 'wave', 0, 'smile', 'WAVE (FROM THE FRONT)'],
  ['juliane', 'cry', 0, 'sad', 'CRY'], ['father', 'cold', 0, 'worried', 'COLD'], ['pilot', 'phone', 1, 'calm', 'PHONE'], ['mother', 'fall', 1, 'shock', 'FALL'],
];

export const MotionTest = ({cells = CELLS}) => {
  const f = useCurrentFrame();
  const cols = 6, cw = W / cols, ch = H / 2;
  return (
    <AbsoluteFill style={{backgroundColor: '#9ED0F0'}}>
      <style>{FONT_CSS}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {cells.map(([who, motion, dir, expr, label], i) => {
          const cx = cw * (i % cols) + cw / 2, top = ch * Math.floor(i / cols);
          const sp = motionSpeed(motion);
          return (
            <g key={i}>
              <rect x={cw * (i % cols) + 6} y={top + 6} width={cw - 12} height={ch - 12} rx={18} fill={i % 2 ? '#BFE3F7' : '#AED9F4'} />
              <rect x={cw * (i % cols) + 6} y={top + ch - 92} width={cw - 12} height={86} fill="#7BB661" />
              {/* the ground slides under a walker at the recording's own speed, so the feet stay planted */}
              {dir !== 0 && sp > 1 && [...Array(6)].map((_, k) => { const x = ((k * 70 - f * sp * 0.2) % 420 + 420) % 420; return <rect key={k} x={cw * (i % cols) + 6 + x * (cw - 12) / 420} y={top + ch - 70} width={18} height={8} fill="#5E9A47" />; })}
              {motion === 'swim' && <rect x={cw * (i % cols) + 6} y={top + ch * 0.55} width={cw - 12} height={ch * 0.45 - 6} fill="#2B7BB9" opacity={0.85} />}
              <g transform={`translate(${cx} ${top + ch - 74}) scale(0.2) translate(0 -1090)` + (motion === 'swim' ? ' translate(-150 -330) rotate(48 0 600)' : '')}>
                <Mover who={who} motion={motion} t={f} dir={dir} expr={expr} f={f} seed={i} shadow={motion !== 'swim'} />
              </g>
              {motion === 'swim' && <rect x={cw * (i % cols) + 6} y={top + ch * 0.62} width={cw - 12} height={ch * 0.38 - 6} fill="#2B7BB9" opacity={0.55} />}
              <T x={cx} y={top + 52} size={30}>{label}</T>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

const PROPS = ['fishing pole', 'canoe', 'sailboat', 'motor boat', 'compass', 'fish', 'shark', 'turtle', 'bird', 'water wave', 'sun', 'cloud with rain',
  'cloud with lightning', 'droplet', 'potable water', 'fire', 'telephone receiver', 'radio', 'battery', 'flashlight', 'mantelpiece clock', 'stopwatch', 'calendar',
  'world map', 'anchor', 'helicopter', 'airplane', 'ship', 'rescue workers helmet', 'ambulance', 'hospital', 'pill', 'adhesive bandage', 'bone',
  'kitchen knife', 'knot', 'oil drum', 'fuel pump', 'skull', 'warning', 'magnifying glass tilted left', 'newspaper', 'money bag', 'military medal', 'globe showing americas'];

export const EmojiSheet = ({names = PROPS}) => (
  <AbsoluteFill style={{backgroundColor: '#0B1F3A'}}>
    <style>{FONT_CSS}</style>
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
      <T x={60} y={70} size={46} anchor="start">READY-MADE PROPS (FLUENT EMOJI, OUTLINED IN OUR STYLE)</T>
      {names.map((n, i) => (
        <g key={n} transform={`translate(${110 + (i % 9) * 212} ${180 + Math.floor(i / 9) * 186})`}>
          <Emoji name={n} size={118} />
          <T x={0} y={86} size={20}>{n.toUpperCase()}</T>
        </g>
      ))}
    </svg>
  </AbsoluteFill>
);

// a contact sheet of story shots (2.59.0): many lines' scenes on one still, each at its own frame, so a whole video's drawings can be
// checked in a few renders before any voice exists. props: cells [{line, f, len}], cols.
export const ShotGrid = ({cells: all = [], cols = 4, per = 16}) => {
  const page = useCurrentFrame();
  const cells = all.slice(page * per, page * per + per);
  const rows = Math.ceil(cells.length / cols) || 1, cw = W / cols, ch = cw * H / W;
  return (
    <AbsoluteFill style={{backgroundColor: '#111'}}>
      <style>{FONT_CSS}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${Math.max(H, ch * rows)}`}>
        {cells.map((c, i) => { const S = SHOTS[c.line.shot]; if (!S) return null;
          return (<svg key={i} x={cw * (i % cols)} y={ch * Math.floor(i / cols)} width={cw - 4} height={ch - 4} viewBox={`0 0 ${W} ${H}`}>
            <S f={c.f} len={c.len} line={c.line} />
            <text x={20} y={H - 30} fontFamily={OSWALD} fontWeight={700} fontSize={70} fill="#fff" stroke={INK} strokeWidth={10} paintOrder="stroke">{c.label || ''}</text>
          </svg>); })}
      </svg>
    </AbsoluteFill>
  );
};
