// Scene templates (2.48.0). A shot = {kind, ...spec, start, end} from the shot plan (story.py); each template draws one kind.
// `f` is the frame inside the shot. People are specs {who, pose, face, x, flip, talk_at:[s,e]...}; the plan fills them.
import React from 'react';
import {interpolate} from 'remotion';
import {C, W, H, GROUND, T, Person, Sub, Icon, Backdrop, Card, Banner, Tag, Bubble, col, pop, lin, clamp, wrap, fmt, rng, ease} from './kit';

const talking = (p, f) => Array.isArray(p.talk) ? p.talk.some(([a, b]) => f >= a && f < b) : !!p.talk;

export function People({people = [], f, s = 1}) {
  return people.map((p, i) => {
    const n = people.length;
    const x = p.x != null ? p.x : interpolate(i, [0, Math.max(1, n - 1)], [n === 1 ? W / 2 : 420, n === 1 ? W / 2 : W - 420]);
    const walkIn = p.enter === 'walk' ? lin(f, 0, 50, p.flip ? W + 200 : -200, x, ease) : x;
    const pose = p.enter === 'walk' && f < 50 ? 'walk' : p.pose || 'stand';
    const sc0 = p.s || (n === 1 ? 1.9 : n === 2 ? 1.7 : 1.4);   // people fill a 16:9 frame like the Fable POC, not a Short
    const y = p.y != null ? p.y : GROUND - 146 * sc0;
    const delay = p.at || 0;
    const sc = p.enter === 'pop' ? clamp(pop(f, delay, 140, 11), 0, 1.1) : 1;
    return (
      <g key={i}>
        <Person who={p.who} pose={pose} face={p.face || 'neutral'} f={f} talk={talking(p, f)} seed={i + 1} flip={!!p.flip} x={walkIn} y={y} s={sc0 * s * sc} />
        {p.say && f >= (p.say_at || 0) && <Bubble text={p.say} x={walkIn + (p.flip ? -40 : 40)} y={y - 150 * sc0} f={f} at={p.say_at || 0} />}
      </g>
    );
  });
}

// a scene with a backdrop, people, an optional card / banner / tags / icons
export function Stage({shot, f}) {
  const cam = shot.camera || 'push';
  const z = cam === 'push' ? lin(f, 0, shot.frames || 300, 1, 1.08, (t) => t) : cam === 'pull' ? lin(f, 0, shot.frames || 300, 1.1, 1, (t) => t) : 1;
  const shake = cam === 'shake' ? Math.sin(f * 2.3) * 6 * Math.max(0, 1 - f / 30) : 0;
  return (
    <g transform={`translate(${W / 2 + shake} ${H / 2}) scale(${z}) translate(${-W / 2} ${-H / 2})`}>
      <Backdrop bg={shot.bg} f={f} depth={shot.depth} color={shot.color} />
      {(shot.icons || []).map((ic, i) => <g key={i} opacity={clamp(pop(f, ic.at || 0, 150, 12), 0, 1)}><Icon name={ic.name} x={ic.x} y={ic.y} s={(ic.s || 1.6) * clamp(pop(f, ic.at || 0, 150, 12), 0, 1.15)} /></g>)}
      <People people={shot.people} f={f} />
      {shot.sub_at && <Sub f={f} x={shot.sub_at.x} y={shot.sub_at.y} s={0.9} beam={(shot.depth || 0) > 0.5 ? 1 : 0} face="worried" />}
      {(shot.tags || []).map((t, i) => <Tag key={i} text={t.text} x={t.x} y={t.y} f={f} at={t.at || 0} color={t.color} leader={t.leader} />)}
      {shot.card && <Card {...shot.card} f={f} at={shot.card.at || 8} />}
      {shot.banner && <Banner {...shot.banner} f={f} at={shot.banner.at || 8} />}
    </g>
  );
}

// a big number that counts up on its word
export function BigNumber({shot, f}) {
  const at = shot.at || 10;
  const s = clamp(pop(f, at, 110, 12), 0, 1);
  const n = Number(String(shot.value).replace(/[^0-9.]/g, '')) || 0;
  const dec = (String(shot.value).split('.')[1] || '').length;
  const shown = lin(f, at, at + 40, 0, n, ease);
  const prefix = (String(shot.value).match(/^[^0-9]*/) || [''])[0];
  const suffix = (String(shot.value).match(/[^0-9.,]*$/) || [''])[0];
  const text = prefix + fmt(shown, dec) + suffix;
  const size = text.length > 9 ? 150 : 210;
  return (
    <g>
      <Backdrop bg={shot.bg || 'dark'} f={f} />
      {shot.icon && <g transform={`translate(${W / 2 - 520} ${H / 2 - 40})`} opacity={s}><Icon name={shot.icon} s={3.4 * s} /></g>}
      <g transform={`translate(${W / 2 + (shot.icon ? 150 : 0)} ${H / 2}) scale(${s})`}>
        <T x={0} y={40} size={size} fill={['navy', 'grey', 'purple'].includes(shot.color) || !shot.color ? C.yellow : col(shot.color, C.yellow)} stroke={C.navy} sw={16} anchor="middle" ls={-4}>{text}</T>
        {wrap(shot.label, 40).map((l, i) => <T key={i} x={0} y={140 + i * 54} size={46} weight={800} fill="#fff" anchor="middle">{l}</T>)}
      </g>
      {shot.compare && <g opacity={clamp(pop(f, at + 50, 120, 12), 0, 1)}><T x={W / 2 + (shot.icon ? 150 : 0)} y={H / 2 + 270} size={44} weight={800} fill="#9BE1FF" anchor="middle">{shot.compare}</T></g>}
    </g>
  );
}

// a clock / countdown marker filling the frame for a beat, then shrinking to the corner
export function Marker({shot, f}) {
  const t = clamp(f / 24, 0, 1);
  const big = lin(f, 0, 28, 1, 0.32, ease);
  const x = lin(f, 0, 28, W / 2, 230, ease), y = lin(f, 0, 28, H / 2, 110, ease);
  return (
    <g>
      <rect width={W} height={H} fill="#000" opacity={lin(f, 0, 28, 0.92, 0, ease)} />
      <g transform={`translate(${x} ${y}) scale(${big})`}>
        <T x={0} y={60} size={220} fill={C.red} stroke="#fff" sw={10} anchor="middle" ls={-6}>{shot.text}</T>
        {shot.sub && f < 26 && <T x={0} y={150} size={60} weight={800} fill="#fff" anchor="middle" op={1 - t}>{shot.sub}</T>}
      </g>
    </g>
  );
}

// the persistent marker in the corner (drawn by Story over any shot while a marker is active)
export const CornerMarker = ({text, f}) => (
  <g transform="translate(60 60)" opacity={clamp(pop(f, 0, 140, 13), 0, 1)}>
    <rect x={-10} y={-10} width={String(text).length * 40 + 60} height={90} rx={22} fill="#000" opacity={0.55} />
    <T x={20} y={56} size={60} fill={C.red} stroke="#fff" sw={4}>{text}</T>
  </g>
);

// a map: dots on a world outline with a pin and a label (simple, stylised; no real geography needed for most stories)
export function MapShot({shot, f}) {
  const pins = shot.pins || [];
  return (
    <g>
      <rect width={W} height={H} fill="#0B2A4A" />
      <g opacity={0.9}>
        {WORLD.map((p, i) => <path key={i} d={p} fill="#1E5A8A" stroke="#4FA3DA" strokeWidth={3} />)}
      </g>
      {pins.map((p, i) => {
        const s = clamp(pop(f, (p.at || 0) + 6, 140, 12), 0, 1.2);
        return (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            <circle r={30 * s + Math.sin(f * 0.2) * 6} fill={C.red} opacity={0.3} />
            <g transform={`scale(${s})`}><Icon name="pin" s={1.4} y={-40} /></g>
            <Tag text={p.label} x={30} y={-150} f={f} at={(p.at || 0) + 10} />
          </g>
        );
      })}
      {shot.route && pins.length > 1 && (() => { const a = pins[shot.route[0]], b = pins[shot.route[1]]; const len = Math.hypot(b.x - a.x, b.y - a.y); const d = lin(f, shot.route_at || 30, (shot.route_at || 30) + 60, 0, len, ease);
        return <path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} stroke={C.yellow} strokeWidth={8} strokeDasharray={`${d} ${len}`} strokeLinecap="round" />; })()}
      {shot.banner && <Banner {...shot.banner} f={f} at={shot.banner.at || 8} />}
    </g>
  );
}
// very rough continents, as screen-space blobs (drawn for the flat look, not for navigation)
const WORLD = [
  'M 120 220 L 300 150 L 520 170 L 600 260 L 560 380 L 470 440 L 420 520 L 350 560 L 300 480 L 230 420 L 150 330 Z',
  'M 420 560 L 520 560 L 600 640 L 580 760 L 520 880 L 470 940 L 440 860 L 430 720 Z',
  'M 820 180 L 1000 150 L 1120 200 L 1080 300 L 980 340 L 900 420 L 820 360 L 800 260 Z',
  'M 860 420 L 1000 400 L 1100 470 L 1100 600 L 1040 740 L 960 800 L 900 700 L 860 560 Z',
  'M 1120 180 L 1400 120 L 1700 160 L 1800 260 L 1700 400 L 1560 460 L 1420 440 L 1300 500 L 1180 420 L 1120 300 Z',
  'M 1460 640 L 1620 620 L 1700 700 L 1660 800 L 1520 820 L 1440 740 Z',
];

// a comparison: two bars / two icons, the second grows on its word
export function Compare({shot, f}) {
  const a = shot.a || {}, b = shot.b || {};
  const va = Number(a.value) || 1, vb = Number(b.value) || 1;
  const max = Math.max(va, vb);
  const hA = lin(f, 10, 50, 0, 560 * va / max, ease), hB = lin(f, shot.at || 40, (shot.at || 40) + 50, 0, 560 * vb / max, ease);
  const bar = (x, h, color, label, value, icon) => (
    <g transform={`translate(${x} ${GROUND - 40})`}>
      <rect x={-140} y={-h} width={280} height={h} rx={24} fill={col(color)} />
      {icon && <g transform={`translate(0 ${-h - 90})`}><Icon name={icon} s={1.4} /></g>}
      <T x={0} y={-h - 30 - (icon ? 110 : 0)} size={54} fill="#fff" anchor="middle">{value}</T>
      {wrap(label, 18).map((l, i) => <T key={i} x={0} y={60 + i * 40} size={34} weight={800} fill="#fff" anchor="middle">{l}</T>)}
    </g>
  );
  return (
    <g>
      <Backdrop bg={shot.bg || 'dark'} f={f} />
      {bar(W / 2 - 320, hA, a.color || 'blue', a.label, a.text || fmt(va), a.icon)}
      {bar(W / 2 + 320, hB, b.color || 'red', b.label, b.text || fmt(vb), b.icon)}
      {shot.title && <Banner title={shot.title} sub={shot.sub} f={f} at={6} color={shot.color || 'yellow'} />}
    </g>
  );
}

// a list that builds line by line (each line on its word)
export function ListShot({shot, f}) {
  const items = shot.items || [];
  return (
    <g>
      <Backdrop bg={shot.bg || 'dark'} f={f} />
      {shot.title && <Banner title={shot.title} f={f} at={4} color={shot.color || 'yellow'} />}
      {items.map((it, i) => {
        const s = clamp(pop(f, it.at || i * 20, 140, 12), 0, 1.1);
        const y = 330 + i * Math.min(120, 640 / Math.max(1, items.length));
        return (
          <g key={i} transform={`translate(${lin(s, 0, 1, -600, 140, (t) => t)} ${y})`} opacity={clamp(s, 0, 1)}>
            <g transform="translate(50 0)"><Icon name={it.icon || 'check'} s={0.9} /></g>
            <T x={130} y={16} size={48} weight={800} fill="#fff">{it.text}</T>
          </g>
        );
      })}
    </g>
  );
}

// the title card (cold open's end / the title question)
export function Title({shot, f}) {
  const lines = wrap(shot.text, 18);
  const out = lin(f, (shot.frames || 90) - 20, shot.frames || 90, 1, 0, ease);
  return (
    <g>
      <Backdrop bg={shot.bg || 'sky'} f={f} />
      {shot.sub && <g transform={`translate(${W / 2} ${H - 180})`}><Sub f={f} s={0.9} face="happy" /></g>}
      {lines.map((l, i) => {
        const s = clamp(pop(f, 6 + i * 8, 140, 11), 0, 1.1) * out;
        return <T key={i} x={W / 2} y={300 + i * 150} size={140} fill={i % 2 ? C.yellow : '#fff'} stroke={C.navy} sw={18} anchor="middle" ls={-3} op={s}>
          <tspan transform={`scale(${s})`}>{l.toUpperCase()}</tspan></T>;
      })}
    </g>
  );
}

// a quote card: who said it, the words
export function Quote({shot, f}) {
  const s = clamp(pop(f, 6, 120, 12), 0, 1);
  const lines = wrap(shot.text, 44);
  const h = 200 + lines.length * 62;
  return (
    <g>
      <Backdrop bg={shot.bg || 'dark'} f={f} />
      {shot.person && <Person who={shot.person} pose="think" face={shot.face || 'neutral'} f={f} x={300} y={GROUND - 146} s={1.3} />}
      <g transform={`translate(${shot.person ? 640 : W / 2 - 600} ${H / 2 - h / 2}) scale(${s})`} opacity={s}>
        <rect width={1200} height={h} rx={34} fill="#fff" />
        <rect x={40} y={40} width={14} height={h - 80} rx={7} fill={col(shot.color, C.yellow)} />
        <T x={90} y={60} size={120} fill={col(shot.color, C.yellow)}>“</T>
        {lines.map((l, i) => <T key={i} x={90} y={150 + i * 62} size={46} weight={800}>{l}</T>)}
        {shot.who && <T x={90} y={h - 50} size={36} weight={700} fill={C.grey}>— {shot.who}</T>}
      </g>
    </g>
  );
}

// the end card
export function EndCard({shot, f}) {
  const R = rng(5);
  const s = clamp(pop(f, 8, 130, 12), 0, 1);
  return (
    <g>
      <rect width={W} height={H} fill="#0B1F3A" />
      {[...Array(50)].map((_, i) => { const x = R() * W, y = R() * H, r = 60 + R() * 220, ph = R(); const t = clamp((f - ph * 8) / 10, 0, 1); return <circle key={i} cx={x} cy={y} r={r * t * (1 - 0.35 * lin(f, 14, 34, 0, 1))} fill="#2FA7E0" opacity={0.9 - 0.9 * lin(f, 12, 34, 0, 1)} />; })}
      <g opacity={s} transform={`translate(0 ${60 - 60 * s})`}>
        <T x={820} y={430} size={44} weight={700} fill="#9BE1FF" anchor="middle">{shot.channel || ''}</T>
        <T x={820} y={540} size={84} fill="#fff" anchor="middle">{(shot.text || 'NEW VIDEO EVERY WEEK').toUpperCase()}</T>
      </g>
      <g transform={`translate(820 680) scale(${clamp(pop(f, 16, 160, 10), 0, 1.3) * (1 + Math.sin(f * 0.4) * 0.025)})`}>
        <rect x={-260} y={-60} width={520} height={120} rx={60} fill={C.red} />
        <T x={-40} y={22} size={60} fill="#fff" anchor="middle">SUBSCRIBE</T>
        <g transform={`translate(190 0) rotate(${Math.sin(f * 0.6) * 18})`}><path d="M -26 18 L 26 18 L 18 -4 L 18 -18 A 18 18 0 0 0 -18 -18 L -18 -4 Z" fill="#fff" /><circle cy={28} r={8} fill="#fff" /></g>
      </g>
      <Person who="pip" pose="wave" face="happy" f={f} x={lin(clamp(pop(f, 12, 110, 11), 0, 1), 0, 1, 1900, 1500, (t) => t)} y={560 - 146 * 2.2 + 146} s={2.2} />
    </g>
  );
}

export function Shot({shot, f}) {
  switch (shot.kind) {
    case 'number': return <BigNumber shot={shot} f={f} />;
    case 'marker': return <Marker shot={shot} f={f} />;
    case 'map': return <MapShot shot={shot} f={f} />;
    case 'compare': return <Compare shot={shot} f={f} />;
    case 'list': return <ListShot shot={shot} f={f} />;
    case 'title': return <Title shot={shot} f={f} />;
    case 'quote': return <Quote shot={shot} f={f} />;
    case 'end': return <EndCard shot={shot} f={f} />;
    default: return <Stage shot={shot} f={f} />;
  }
}
