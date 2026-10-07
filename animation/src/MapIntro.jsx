import React from 'react';
import {spring, useVideoConfig} from 'remotion';
import {C, HEAD, W, H, easeInOut, lerp, clamp01} from './theme';
import {LAND, RIVERS, K} from './mapdata';

const ArrowHead = ({x, y, angle, color}) => (
  <g transform={`translate(${x} ${y}) rotate(${(angle * 180) / Math.PI})`}>
    <path d="M 34 0 L -18 -30 L -8 0 L -18 30 Z" fill={color} stroke={C.ink} strokeWidth="7" strokeLinejoin="round" />
  </g>
);

/*
 * Animated map (also the intro). The camera flies from a world view down to the place, pins drop in, and an optional
 * route draws between pins. Real geography (Natural Earth, public domain): x = lon, y = lat, so a pin is just lat/lon.
 *
 * map: { focus: [lat, lon], zoom: pixels per degree at the end (e.g. 60 = a region), from_zoom: start (default 3.4),
 *        pins: [{label, lat, lon}], route: [pinIndexA, pinIndexB], route_label: "about 5,000 stadia",
 *        arrows: [{from: pinIndex, to: pinIndex, label, color: terracotta|gold|teal, bend}] (2.22.1: drawn on one after another) }
 */
export const MapIntro = ({map, frame, frames}) => {
  const {fps} = useVideoConfig();
  const [flat, flon] = map.focus;
  const p = easeInOut(clamp01(frame / Math.max(1, frames * 0.72)));
  const z0 = map.from_zoom || 3.4;
  const z1 = map.zoom || 40;
  const ppd = Math.exp(lerp(Math.log(z0), Math.log(z1), p));
  // The view glides from the middle of the old world to the focus point.
  const cLat = lerp(25, flat, p);
  const cLon = lerp(20, flon, p);
  const sx = (lon) => W / 2 + (lon - cLon) * ppd;
  const sy = (lat) => H / 2 - (lat - cLat) * ppd;
  const sc = ppd / K;
  const pins = map.pins || [];
  const grid = [];
  for (let lon = -180; lon <= 180; lon += 10) grid.push(<line key={'x' + lon} x1={lon * K} y1={0} x2={lon * K} y2={180 * K} />);
  for (let lat = -90; lat <= 90; lat += 10) grid.push(<line key={'y' + lat} x1={0} y1={lat * K} x2={360 * K} y2={lat * K} />);
  // lon/lat -> map units: x=(lon+180)K, y=(90-lat)K
  const gx = (lon) => (lon + 180) * K;
  const gy = (lat) => (90 - lat) * K;
  const routeProgress = clamp01((frame - frames * 0.55) / (frames * 0.3));
  const r = map.route && pins[map.route[0]] && pins[map.route[1]] ? [pins[map.route[0]], pins[map.route[1]]] : null;
  return (
    <g>
      <rect x="-400" y="-200" width="1880" height="2300" fill={C.teal} />
      <g transform={`translate(${W / 2} ${H / 2}) scale(${sc}) translate(${-gx(cLon)} ${-gy(cLat)})`}>
        <g stroke={C.sky} strokeWidth="1.2" opacity="0.28" vectorEffect="non-scaling-stroke">
          {grid}
        </g>
        <path d={LAND} fill={C.parchment} stroke={C.ink} strokeWidth="4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={RIVERS} fill="none" stroke={C.sky} strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </g>
      {/* wash of gold over the land edge for an old-map feel */}
      <rect x="-400" y="-200" width="1880" height="2300" fill={C.gold} opacity="0.08" />
      {r && (
        <g>
          <line
            x1={sx(r[0].lon)}
            y1={sy(r[0].lat)}
            x2={lerp(sx(r[0].lon), sx(r[1].lon), routeProgress)}
            y2={lerp(sy(r[0].lat), sy(r[1].lat), routeProgress)}
            stroke={C.ink}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="4 26"
          />
          <line
            x1={sx(r[0].lon)}
            y1={sy(r[0].lat)}
            x2={lerp(sx(r[0].lon), sx(r[1].lon), routeProgress)}
            y2={lerp(sy(r[0].lat), sy(r[1].lat), routeProgress)}
            stroke={C.terracotta}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="4 26"
          />
          {map.route_label && routeProgress > 0.6 && (
            <g transform={`translate(${(sx(r[0].lon) + sx(r[1].lon)) / 2 - 260} ${(sy(r[0].lat) + sy(r[1].lat)) / 2 + 40})`} opacity={clamp01((routeProgress - 0.6) * 4)}>
              <rect x="-170" y="-40" width="340" height="80" rx="18" fill={C.parchment} stroke={C.ink} strokeWidth="7" />
              <text textAnchor="middle" y="14" fontFamily={HEAD} fontSize="44" fill={C.ink}>{map.route_label}</text>
            </g>
          )}
        </g>
      )}
      {r && routeProgress > 0.02 && routeProgress < 1.01 && (() => {   // an arrowhead on the route's moving tip
        const x0 = sx(r[0].lon);
        const y0 = sy(r[0].lat);
        const x1 = lerp(x0, sx(r[1].lon), routeProgress);
        const y1 = lerp(y0, sy(r[1].lat), routeProgress);
        return <ArrowHead x={x1} y={y1} angle={Math.atan2(y1 - y0, x1 - x0)} color={C.terracotta} />;
      })()}
      {(map.arrows || []).map((a, i, all) => {
        // OverSimplified-style arrows: thick, curved, drawn on one after another, each with its head and an optional label
        const A = pins[a.from];
        const B = pins[a.to];
        if (!A || !B) return null;
        const n = all.length;
        const p = easeInOut(clamp01((frame - frames * (0.5 + (0.42 * i) / n)) / Math.max(6, (frames * 0.34) / n)));
        if (p <= 0) return null;
        const [ax, ay, bx, by] = [sx(A.lon), sy(A.lat), sx(B.lon), sy(B.lat)];
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const bend = (a.bend ?? 0.22) * len;
        const cx = (ax + bx) / 2 + ((by - ay) / len) * bend;
        const cy = (ay + by) / 2 - ((bx - ax) / len) * bend;
        const q = (t, u, v, w) => (1 - t) * (1 - t) * u + 2 * (1 - t) * t * v + t * t * w;
        const tx = q(p, ax, cx, bx);
        const ty = q(p, ay, cy, by);
        const dx = 2 * (1 - p) * (cx - ax) + 2 * p * (bx - cx);
        const dy = 2 * (1 - p) * (cy - ay) + 2 * p * (by - cy);
        const col = a.color === 'gold' ? C.gold : a.color === 'teal' ? C.teal : C.terracotta;
        const d = `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
        return (
          <g key={`a${i}`}>
            <path d={d} pathLength="1" fill="none" stroke={C.ink} strokeWidth="30" strokeLinecap="round" strokeDasharray="1 2" strokeDashoffset={1 - p} />
            <path d={d} pathLength="1" fill="none" stroke={col} strokeWidth="18" strokeLinecap="round" strokeDasharray="1 2" strokeDashoffset={1 - p} />
            <ArrowHead x={tx} y={ty} angle={Math.atan2(dy, dx)} color={col} />
            {a.label && p > 0.7 && (
              <g transform={`translate(${cx} ${cy - 30})`} opacity={clamp01((p - 0.7) * 4)}>
                <rect x={-a.label.length * 13 - 22} y="-36" width={a.label.length * 26 + 44} height="72" rx="16" fill={C.parchment} stroke={C.ink} strokeWidth="6" />
                <text textAnchor="middle" y="14" fontFamily={HEAD} fontSize="40" fill={C.ink}>{a.label}</text>
              </g>
            )}
          </g>
        );
      })}
      {pins.map((pin, i) => {
        const drop = spring({frame: frame - frames * 0.5 - i * 7, fps, config: {damping: 9, stiffness: 140, mass: 0.6}});
        const pop = spring({frame: frame - frames * 0.5 - i * 7 - 4, fps, config: {damping: 6, stiffness: 220, mass: 0.5}});   // the city's name pops with a bounce
        const x = sx(pin.lon);
        const y = sy(pin.lat);
        return (
          <g key={i} transform={`translate(${x} ${y - (1 - drop) * 220})`} opacity={clamp01(drop * 3)}>
            <ellipse cx="0" cy={(1 - drop) * 220} rx="22" ry="8" fill={C.ink} opacity="0.3" />
            <path d="M 0 0 C -38 -46 -38 -98 0 -98 C 38 -98 38 -46 0 0 Z" fill={C.terracotta} stroke={C.ink} strokeWidth="7" strokeLinejoin="round" />
            <circle cx="0" cy="-66" r="13" fill={C.parchment} stroke={C.ink} strokeWidth="5" />
            <g transform={`translate(0 ${-150}) scale(${Math.max(0.01, pop)})`}>
              <rect x={-pin.label.length * 14 - 24} y="-42" width={pin.label.length * 28 + 48} height="84" rx="18" fill={C.parchment} stroke={C.ink} strokeWidth="7" />
              <text textAnchor="middle" y="16" fontFamily={HEAD} fontSize="48" fill={C.ink}>{pin.label}</text>
            </g>
          </g>
        );
      })}
      {/* frame and compass */}
      <rect x="22" y="22" width={W - 44} height={H - 44} fill="none" stroke={C.ink} strokeWidth="16" rx="6" />
      <rect x="22" y="22" width={W - 44} height={H - 44} fill="none" stroke={C.gold} strokeWidth="5" rx="6" />
      <g transform={`translate(${W - 150} ${H - 300}) rotate(${Math.sin(frame / 30) * 6})`}>
        <circle r="62" fill={C.parchment} stroke={C.ink} strokeWidth="7" />
        <path d="M 0 -56 L 14 0 L 0 56 L -14 0 Z" fill={C.terracotta} stroke={C.ink} strokeWidth="5" strokeLinejoin="round" />
        <path d="M -56 0 L 0 -14 L 56 0 L 0 14 Z" fill={C.gold} stroke={C.ink} strokeWidth="5" strokeLinejoin="round" />
      </g>
    </g>
  );
};
