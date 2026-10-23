// Real borders for Rana (Atlas's OCEAN request 2026-10-23: "scientifically correct borders"): one map view, projected with d3-geo
// from Natural Earth (public domain), written as a plain 1920x1080 SVG with an id on every shape so she can restyle it and copy the
// path data verbatim. Usage: node region.mjs <geo.json> <view.json> <out.svg>
import fs from 'fs';
import {geoOrthographic, geoPath, geoGraticule10} from 'd3-geo';

const [geoFile, viewFile, out] = process.argv.slice(2);
const geo = JSON.parse(fs.readFileSync(geoFile, 'utf8'));
const v = JSON.parse(fs.readFileSync(viewFile, 'utf8'));
const W = v.width || 1920, H = v.height || 1080;
const proj = geoOrthographic().rotate([-v.center[0], -v.center[1]]).scale(v.scale).translate(v.translate || [W / 2, H / 2])
  .clipExtent([[-10, -10], [W + 10, H + 10]]).precision(0.3);
// a drawing context that drops points closer than `tol` px to the last one kept (keeps files small at globe scale)
function ctx(tol, n) {
  let s = '', lx = 0, ly = 0, pend = null;
  const f = (x) => (+x.toFixed(n)).toString();
  return {
    moveTo(x, y) { if (pend) { s += pend; pend = null; } s += `M${f(x)},${f(y)}`; lx = x; ly = y; },
    lineTo(x, y) { if (Math.hypot(x - lx, y - ly) < tol) { pend = `L${f(x)},${f(y)}`; return; } pend = null; s += `L${f(x)},${f(y)}`; lx = x; ly = y; },
    closePath() { pend = null; s += 'Z'; },
    arc() {},
    result() { if (pend) s += pend; const r = s; s = ''; pend = null; return r; },
  };
}
const P = (f, n) => { if (v.scale < 2000) n = 0; const c = ctx(n === 0 ? 1.5 : 0.7, n); geoPath(proj, c)(f); return c.result(); };
const detail = new Set(geo.detail.features.map((f) => f.properties.a3));
const parts = [];
parts.push(`<path id="sea" d="${P({type: 'Sphere'}, 1)}"/>`);
if (v.graticule !== false) parts.push(`<path id="graticule" d="${P(geoGraticule10(), 0)}"/>`);
parts.push('<g id="world">');
for (const f of geo.world.features) {
  const a3 = f.properties.a3;
  if (detail.has(a3) || a3 === 'FRA') continue;
  const d = P(f, 0);
  if (d && d.length > 12) parts.push(`<path id="w-${a3}" d="${d}"/>`);
}
parts.push('</g>', '<g id="countries">');
for (const f of geo.detail.features) {
  const d = P(f, 1);
  if (d && d.length > 12) parts.push(`<path id="c-${f.properties.a3}" d="${d}"/>`);
}
parts.push('</g>', '<g id="borders">');
for (const [k, f] of Object.entries(geo.borders)) {
  const d = P(f, 1);
  if (d && d.length > 12) parts.push(`<path id="b-fra-${k}" data-drawn-km="${f.properties.km_drawn}" d="${d}"/>`);
}
parts.push('</g>', '<g id="places">');
for (const [name, ll] of Object.entries(geo.places)) {
  const p = proj(ll);
  if (p && p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H) parts.push(`<circle id="p-${name}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5"/>`);
}
parts.push('</g>');
const labels = Object.fromEntries(Object.entries(v.labels || {}).map(([k, ll]) => [k, (proj(ll) || []).map((x) => +x.toFixed(1))]));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<!-- ${v.name}: REAL geography (Natural Earth 10m, public domain), orthographic, centre ${v.center}, scale ${v.scale}.
Ids: sea, graticule, w-<ISO3> (rest of the world), c-<ISO3> (countries; c-FRA = metropolitan France, c-GUF = French Guiana),
b-fra-deu / b-fra-esp / b-fra-bra / b-fra-sur (France's land borders), p-<place>. Label anchors (x, y): ${JSON.stringify(labels)} -->
<style>#sea{fill:#C3D1DB}#graticule{fill:none;stroke:#fff;stroke-opacity:.5}#world path{fill:#F2EEE6;stroke:#AEB6BC;stroke-width:.8}
#countries path{fill:#FBF7EF;stroke:#98A2AA}#c-FRA,#c-GUF{fill:#F6C9A8}#borders path{fill:none;stroke:#E4572E;stroke-width:4}#places circle{fill:#1D2730}</style>
${parts.join('\n')}
</svg>
`;
fs.writeFileSync(out, svg);
console.log(out, svg.length);
