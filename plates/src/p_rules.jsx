// The "rules" group of the Apollo 12 film: the replenish pump, the rule book, Atlas-Centaur 67, the landing beside Surveyor III, the storm behind the cards, the clock, the empty tower.
// Every frame is a pure function of the frame number. No text but what is really on the object.
import * as THREE from 'three';
import {useScene, indoors, clamp, ease, lerp, flashAt} from './plates';
import {makeSaturn, makeFlame, makeBolt} from './saturn';

const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, srgb = true, rep = null) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

// a soft reflection world: a graphite dome and a few bright boxes, so metal has something to reflect
const envFrom = (e, top, bottom, boxes) => {
  const s = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({side: THREE.BackSide, uniforms: {a: {value: new THREE.Color(...top)}, b: {value: new THREE.Color(...bottom)}},
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 p; uniform vec3 a, b; void main(){ gl_FragColor = vec4(mix(b, a, smoothstep(-0.2, 0.7, normalize(p).y)), 1.0); }'}));
  s.add(dome);
  boxes.forEach(([x, y, z, w, h, col]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(...col), side: THREE.DoubleSide})); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); });
  const pm = new THREE.PMREMGenerator(e.renderer), rt = pm.fromScene(s, 0.02);
  e.scene.environment = rt.texture;
  return rt;
};
const shadows = (e) => { e.renderer.shadowMap.enabled = true; e.renderer.shadowMap.type = THREE.PCFSoftShadowMap; };
const range = (cam, n, fr) => { cam.near = n; cam.far = fr; };

// fractal noise painted into a canvas: layers of random blotches, tileable enough for walls and ground
const blotches = (g, w, h, seed, n, rMin, rMax, col, aMax) => {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, R = rMin + r() * r() * (rMax - rMin), a = r() * aMax;
    const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
  }
};
const speckle = (g, w, h, seed, n, cols, s0 = 1, s1 = 2.5) => { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; const s = s0 + r() * (s1 - s0); g.fillRect(r() * w, r() * h, s, s); } };

// a soft, ragged puff for steam, vapour and smoke
const puffTexture = (seed) => {
  const [c, g] = canvas(256, 256), r = rng(seed);
  for (let i = 0; i < 70; i++) {
    const a = r() * 6.283, d = Math.pow(r(), 0.7) * 76, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, R = 16 + r() * 42;
    const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(255,255,255,${0.1 + r() * 0.16})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
  }
  return tex(c);
};
// sprites whose state comes from a function of (seed values, frame)
const makePuffs = (group, n, seed, additive = false) => {
  const maps = [puffTexture(11 + seed), puffTexture(23 + seed), puffTexture(37 + seed)], r = rng(seed * 97 + 5), items = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({map: maps[i % 3], transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0});
    const s = new THREE.Sprite(m); group.add(s); items.push({s, m, a: r(), b: r(), c: r(), d: r()});
  }
  return items;
};

// rain: streaks in a box that follows the camera; each drop's place is a function of the frame
const makeRain = (scene, n, seed, box = [60, 40, 60], len = 0.9, col = [0.55, 0.62, 0.72], op = 0.5) => {
  const r = rng(seed), P = new Float32Array(n * 6), seeds = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seeds[i] = r();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({color: new THREE.Color(...col), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending}));
  m.frustumCulled = false; scene.add(m);
  return (f, cx, cy, cz, wind = 0.25) => {
    for (let i = 0; i < n; i++) {
      const a = seeds[i * 4], b = seeds[i * 4 + 1], c = seeds[i * 4 + 2], sp = 0.26 + seeds[i * 4 + 3] * 0.16;   // 8-12 m/s
      const h = box[1], y = h - (((c * h + f * sp) % h + h) % h), dx = wind * (h - y) * 0.16;
      const x = ((a * box[0] + dx) % box[0]) - box[0] / 2, z = ((b * box[2]) % box[2]) - box[2] / 2;
      const L = len * (sp / 0.3);
      P[i * 6] = cx + x; P[i * 6 + 1] = cy + y - h / 2; P[i * 6 + 2] = cz + z;
      P[i * 6 + 3] = cx + x - wind * L * 0.16; P[i * 6 + 4] = cy + y - h / 2 + L; P[i * 6 + 5] = cz + z;
    }
    geo.attributes.position.needsUpdate = true;
  };
};

// a softer cloud volume for long lenses and slow looks: same shape of numbers as the engine's, no detail down at the size of one texel
const softNoise = () => {
  const N = 96, data = new Uint8Array(N * N * N), r = rng(90125);
  const grid = (cells) => { const g = new Float32Array(cells * cells * cells * 3); for (let i = 0; i < g.length; i++) g[i] = r(); return {cells, g}; };
  const worley = ({cells, g}, x, y, z) => {
    const fx = x * cells, fy = y * cells, fz = z * cells, ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    let best = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cx = (ix + a + cells) % cells, cy = (iy + b + cells) % cells, cz = (iz + c + cells) % cells, k = (cx + cy * cells + cz * cells * cells) * 3;
      const dx = ix + a + g[k] - fx, dy = iy + b + g[k + 1] - fy, dz = iz + c + g[k + 2] - fz, d = dx * dx + dy * dy + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
  const w1 = grid(4), w2 = grid(8), w3 = grid(15);
  for (let z = 0, i = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++, i++) {
    const u = x / N, v = y / N, t = z / N, n = 1 - (worley(w1, u, v, t) * 0.62 + worley(w2, u, v, t) * 0.27 + worley(w3, u, v, t) * 0.11);
    data[i] = Math.max(0, Math.min(255, n * 255));
  }
  const tx = new THREE.Data3DTexture(data, N, N, N);
  tx.format = THREE.RedFormat; tx.type = THREE.UnsignedByteType; tx.minFilter = tx.magFilter = THREE.LinearFilter; tx.wrapS = tx.wrapT = tx.wrapR = THREE.RepeatWrapping; tx.needsUpdate = true;
  return tx;
};

// ---------------------------------------------------------------------------------------------------------------------
// CLOCKSTOP: the mission timer on its panel: electroluminescent segments behind glass, in a recess. It runs, then stops at 244:36:25.
// ---------------------------------------------------------------------------------------------------------------------
const SEG = {0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg'};
const segShape = (x0, y0, x1, y1, t) => {
  // a long hexagon from (x0,y0) to (x1,y1), t thick
  const s = new THREE.Shape(), dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy * t / 2, ny = ux * t / 2, tip = t / 2;
  s.moveTo(x0, y0); s.lineTo(x0 + ux * tip + nx, y0 + uy * tip + ny); s.lineTo(x1 - ux * tip + nx, y1 - uy * tip + ny); s.lineTo(x1, y1); s.lineTo(x1 - ux * tip - nx, y1 - uy * tip - ny); s.lineTo(x0 + ux * tip - nx, y0 + uy * tip - ny); s.closePath();
  return new THREE.ShapeGeometry(s);
};
const SEGG = (() => { const W = 0.56, H = 1, gap = 0.018, t = 0.105, m = H / 2; return {
  a: [gap, H, W - gap, H], d: [gap, 0, W - gap, 0], g: [gap, m, W - gap, m],
  f: [0, m + gap, 0, H - gap], e: [0, gap, 0, m - gap], b: [W, m + gap, W, H - gap], c: [W, gap, W, m - gap], t};})();

const timerSkin = () => {
  const [c, g] = canvas(4096, 2048), r = rng(41);
  g.fillStyle = '#34363a'; g.fillRect(0, 0, 4096, 2048);
  blotches(g, 4096, 2048, 7, 260, 40, 340, '0,0,0', 0.09);
  blotches(g, 4096, 2048, 8, 120, 30, 240, '140,136,126', 0.035);
  for (let i = 0; i < 700; i++) { g.strokeStyle = `rgba(200,200,195,${0.012 + r() * 0.05})`; g.lineWidth = 0.5 + r() * 1.2; const x = r() * 4096, y = r() * 2048, a = r() * 6.28, L = 12 + r() * r() * 170; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  speckle(g, 4096, 2048, 9, 9000, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.05)']);
  // stencils that really sit around the timer
  g.fillStyle = 'rgba(226,226,216,0.86)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 36px Arial, sans-serif';
  g.fillText('MISSION TIMER', 2048, 1024 - 1.92 * 170.67);
  const X = (u) => 2048 + u * (4096 / 24), Y = (v) => 1024 - v * (2048 / 12);
  g.font = '700 30px Arial, sans-serif';
  [['HR', -3.55, -0.97], ['MIN', 0.03, 1.69], ['SEC', 2.11, 3.77]].forEach(([s, a, b]) => {
    g.fillText(s, X((a + b) / 2), Y(1.42));
    g.strokeStyle = 'rgba(226,226,216,0.5)'; g.lineWidth = 3; const m = X((a + b) / 2);
    g.beginPath(); g.moveTo(X(a), Y(1.42)); g.lineTo(m - 42, Y(1.42)); g.moveTo(m + 42, Y(1.42)); g.lineTo(X(b), Y(1.42)); g.stroke();
  });
  g.font = '700 22px Arial, sans-serif';
  [['START', -3], ['STOP', 0], ['RESET', 3]].forEach(([s, u]) => g.fillText(s, X(u), Y(-2.72)));
  ['BAT A', 'BAT B', 'MN BUS TIE', 'FDAI', 'EVENT TIMER', 'ELS', 'CMC MODE', 'SPS', 'RCS CMD', 'TAPE'].forEach((s, i) => g.fillText(s, X(-9 + i * 2), Y(-4.3)));
  return tex(c);
};
const timerBump = () => { const [c, g] = canvas(2048, 1024); g.fillStyle = '#808080'; g.fillRect(0, 0, 2048, 1024); speckle(g, 2048, 1024, 13, 60000, ['#7a7a7a', '#868686', '#747474'], 1, 2.2); return tex(c, false); };

export const ClockStop = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e; range(camera, 0.05, 80);
  e.final.bloom.value = 0.95; e.final.exposure.value = 1.0; e.final.vign.value = 0.8; e.final.grain.value = 0.016;
  envFrom(e, [0.05, 0.05, 0.055], [0.006, 0.006, 0.007], [[-16, 22, 26, 34, 10, [3.2, 2.4, 1.6]], [24, 6, 24, 5, 22, [0.8, 0.9, 1.0]]]);
  // the panel: a plate with a window cut out
  const PW = 24, PH = 12, wx0 = -4.15, wx1 = 4.15, wy0 = -1.05, wy1 = 1.05;
  const out = new THREE.Shape(); out.moveTo(-PW / 2, -PH / 2); out.lineTo(PW / 2, -PH / 2); out.lineTo(PW / 2, PH / 2); out.lineTo(-PW / 2, PH / 2); out.closePath();
  const hole = new THREE.Path(); hole.moveTo(wx0, wy0); hole.lineTo(wx0, wy1); hole.lineTo(wx1, wy1); hole.lineTo(wx1, wy0); hole.closePath(); out.holes.push(hole);
  const plateG = new THREE.ExtrudeGeometry(out, {depth: 0.12, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 4});
  const uv = plateG.attributes.uv, pos = plateG.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + PW / 2) / PW, (pos.getY(i) + PH / 2) / PH);
  const skin = timerSkin(), bm = timerBump();
  const plate = new THREE.Mesh(plateG, new THREE.MeshStandardMaterial({map: skin, bumpMap: bm, bumpScale: 0.6, roughness: 0.52, metalness: 0.55})); plate.position.z = -0.12; plate.receiveShadow = plate.castShadow = true; scene.add(plate);
  // the bezel round the window
  const black = new THREE.MeshStandardMaterial({color: 0x121316, roughness: 0.32, metalness: 0.75});
  const bar = (x, y, w, h, d = 0.14, z = 0.06) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), black); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); };
  const b = 0.1; bar(0, wy1 + b / 2, wx1 - wx0 + b * 2, b); bar(0, wy0 - b / 2, wx1 - wx0 + b * 2, b); bar(wx0 - b / 2, 0, b, wy1 - wy0); bar(wx1 + b / 2, 0, b, wy1 - wy0);
  // the well behind the window
  const well = new THREE.MeshStandardMaterial({color: 0x08090a, roughness: 0.6, metalness: 0.5});
  const back = new THREE.Mesh(new THREE.PlaneGeometry(wx1 - wx0 + 0.3, wy1 - wy0 + 0.3), well); back.position.z = -0.72; back.receiveShadow = true; scene.add(back);
  [[0, wy1 + 0.0, wx1 - wx0, 0.6, Math.PI / 2, 0], [0, wy0, wx1 - wx0, 0.6, -Math.PI / 2, 0]].forEach(([x, y, w, h, rx]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), well); m.position.set(x, y, -0.42); m.rotation.x = rx; scene.add(m); });
  [[wx0, Math.PI / 2], [wx1, -Math.PI / 2]].forEach(([x, ry]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, wy1 - wy0), well); m.position.set(x, 0, -0.42); m.rotation.y = ry; scene.add(m); });

  // seven digits: real segments on dark tiles, in the well
  const H = 1.32, step = 0.92, xs = [], gapMid = 0.42;
  let x = -3.55; for (let d = 0; d < 7; d++) { xs.push(x); x += step; if (d === 2 || d === 4) x += gapMid; }
  const segsOf = [], lit = new THREE.Color(0.05, 1.75, 0.36);
  xs.forEach((dx, di) => {
    const g = new THREE.Group(); g.position.set(dx, -H / 2, -0.52); g.scale.set(H, H, 1); scene.add(g);
    const map = {};
    for (const k of 'abcdefg') { const [a, bb, c, d] = SEGG[k]; const m = new THREE.MeshBasicMaterial({color: 0x000000}); const mesh = new THREE.Mesh(segShape(a, bb, c, d, SEGG.t), m); g.add(mesh); map[k] = m; }
    segsOf.push(map);
  });
  // the colons
  const dot = new THREE.MeshBasicMaterial({color: lit.clone().multiplyScalar(0.8)});
  [[(xs[2] + 0.74 + xs[3]) / 2, 0], [(xs[4] + 0.74 + xs[5]) / 2, 0]].forEach(([cx]) => { [0.26, -0.26].forEach((cy) => { const c = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), dot); c.position.set(cx, cy, -0.52); scene.add(c); }); });
  // the glow the digits throw on the walls of the well
  const glow = new THREE.PointLight(0x46ff9a, 2.2, 7, 1.6); glow.position.set(0, 0, -0.1); scene.add(glow);
  // the cover glass
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(wx1 - wx0, wy1 - wy0), new THREE.MeshStandardMaterial({color: 0x050606, roughness: 0.04, metalness: 0.95, transparent: true, opacity: 0.16, depthWrite: false})); glass.position.z = -0.03; scene.add(glass);
  // screws and three toggles
  const steel = new THREE.MeshStandardMaterial({color: 0xb0b0ac, roughness: 0.3, metalness: 0.95});
  const screwG = new THREE.CylinderGeometry(0.075, 0.08, 0.04, 20), slotG = new THREE.BoxGeometry(0.14, 0.02, 0.02), slotM = new THREE.MeshStandardMaterial({color: 0x050505});
  const r = rng(61);
  [[-5.7, 2.7], [5.7, 2.7], [-5.7, -2.7], [5.7, -2.7], [-4.5, 1.5], [4.5, 1.5], [-4.5, -1.5], [4.5, -1.5], [-11, 5.3], [11, 5.3], [-11, -5.3], [11, -5.3]].forEach(([sx, sy]) => { const g = new THREE.Group(); g.position.set(sx, sy, 0.02); const s = new THREE.Mesh(screwG, steel); s.rotation.x = Math.PI / 2; s.castShadow = true; g.add(s); const sl = new THREE.Mesh(slotG, slotM); sl.position.z = 0.02; sl.rotation.z = r() * 3; g.add(sl); scene.add(g); });
  const baseG = new THREE.CylinderGeometry(0.17, 0.2, 0.09, 24), batG = new THREE.CapsuleGeometry(0.055, 0.34, 6, 14);
  [[-3, -2.05], [0, -2.05], [3, -2.05], ...[-9, -7, -5, -3, -1, 1, 3, 5, 7, 9].map((u) => [u, -3.7])].forEach(([tx, ty], i) => { const g = new THREE.Group(); g.position.set(tx, ty, 0.02); const b0 = new THREE.Mesh(baseG, black); b0.rotation.x = Math.PI / 2; b0.castShadow = true; g.add(b0); const bt = new THREE.Mesh(batG, steel); const up = i !== 1 && (i < 3 || r() > 0.4); bt.position.set(0, up ? 0.12 : -0.12, 0.26); bt.rotation.x = up ? 0.55 : -0.55; bt.castShadow = true; g.add(bt); scene.add(g); });

  // light: one tungsten flood from above left, raking across the plate
  const flood = new THREE.SpotLight(0xffc98a, 420, 60, 0.42, 0.85, 1.6); flood.position.set(-7.5, 6.5, 9); flood.target.position.set(0.5, -0.3, 0); scene.add(flood, flood.target);
  flood.castShadow = true; flood.shadow.mapSize.set(2048, 2048); flood.shadow.camera.near = 2; flood.shadow.camera.far = 30; flood.shadow.bias = -0.0006; flood.shadow.radius = 5;
  scene.add(new THREE.AmbientLight(0x4a5058, 0.14));
  const STOP = 180;                                     // frame the seconds reach :25 and never change again
  return {draw: (f) => {
    const tick = Math.min(f, STOP), secs = 19 + Math.floor(tick / 30), since = tick % 30;
    const shown = `24436${String(secs).padStart(2, '0')}`;
    const prev = `24436${String(secs - 1).padStart(2, '0')}`;
    shown.split('').forEach((ch, i) => {
      const on = SEG[ch], was = SEG[prev[i]], map = segsOf[i];
      for (const k of 'abcdefg') {
        // EL segments come on over a couple of frames; the ones going off fade over one
        let a = on.includes(k) ? 1 : 0;
        if (f <= STOP && since < 2 && secs > 19) { const w = was.includes(k) ? 1 : 0; if (a && !w) a = 0.35 + since * 0.4; if (!a && w) a = since === 0 ? 0.3 : 0; }
        const dim = 0.97 + 0.03 * Math.sin(f * 0.37 + i * 2.1);
        map[k].color.setRGB(0.012 + (lit.r - 0.012) * a * dim, 0.024 + (lit.g - 0.024) * a * dim, 0.018 + (lit.b - 0.018) * a * dim);
      }
    });
    const k = ease(f / 290), s = 1 - ease((f - STOP) / 40) * 0.08;
    camera.position.set(lerp(-5.1, -1.5, k) , lerp(1.5, 0.34, k), lerp(9.7, 7.15, k));
    camera.lookAt(lerp(-0.3, 0.05, k), lerp(0.0, -0.12, k), -0.3);
    camera.fov = 40; camera.up.set(lerp(-0.035, 0.012, k), 1, 0);
    flood.intensity = 420 * s;
  }};
});

// ---------------------------------------------------------------------------------------------------------------------
// CARDSTORM: nothing happens, slowly. The underside of the storm, for big words on top.
// ---------------------------------------------------------------------------------------------------------------------
export const CardStorm = () => useScene((e) => {
  const {scene, glow, camera, cloud} = e; range(camera, 1, 60000);
  cloud.noise.value = softNoise();
  cloud.base.value = 340; cloud.top.value = 2600; cloud.cover.value = 0.415; cloud.thick.value = 0.32; cloud.scale.value = 0.00052; cloud.far_.value = 7000; cloud.fine.value = 2.7;
  e.skyHi.set(0.3, 0.335, 0.4); e.skyLo.set(0.05, 0.057, 0.072);
  e.final.exposure.value = 1.0; e.final.vign.value = 0.85; e.final.bloom.value = 0.3; e.final.grain.value = 0.02;
  cloud.flash.value = 0; cloud.flame.value = 0; e.common.flash.value = 0;
  // the flat land under it, a black line of scrub, and the last light low on the horizon
  scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.05, 0.05, 0.055), 0.00016);
  // rain far off, darkening what is left of the sky under the deck
  const curtain = new THREE.Mesh(new THREE.CylinderGeometry(9000, 9000, 900, 64, 1, true), new THREE.MeshBasicMaterial({color: new THREE.Color().setRGB(0.012, 0.013, 0.016), transparent: true, opacity: 0.8, side: THREE.BackSide, fog: false, depthWrite: false})); curtain.position.y = 450; scene.add(curtain);
  const land = new THREE.Mesh(new THREE.PlaneGeometry(50000, 50000), new THREE.MeshBasicMaterial({color: new THREE.Color().setRGB(0.008, 0.009, 0.01)})); land.rotation.x = -Math.PI / 2; scene.add(land);
  const scrub = (() => { const [c, g] = canvas(4096, 128), r = rng(551); g.fillStyle = '#050606'; for (let x = 0; x < 4096; x += 5) { const h = 34 + r() * 40 + Math.sin(x * 0.007) * 16; g.fillRect(x, 128 - h, 6, h); } return tex(c); })();
  scrub.wrapS = THREE.RepeatWrapping; scrub.repeat.set(5, 1);
  const trees = new THREE.Mesh(new THREE.CylinderGeometry(4200, 4200, 60, 96, 1, true), new THREE.MeshBasicMaterial({map: scrub, transparent: true, side: THREE.BackSide})); trees.position.y = 30; scene.add(trees);
  const band = new THREE.Mesh(new THREE.SphereGeometry(40000, 48, 24), new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: 'out vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; in vec3 vD; out vec4 o;
      void main(){ vec3 d = normalize(vD); float az = atan(d.x, d.z);
        float g = smoothstep(0.0012, 0.006, d.y) * exp(-d.y * 26.0) * (0.72 + 0.28 * sin(az * 3.0 + 1.0));
        o = vec4(vec3(0.17, 0.115, 0.07) * g, 1.0); }`}));
  glow.add(band);
  return {draw: (f) => {
    const x = f * 0.26, z = -f * 0.09;
    camera.position.set(x, 34, z);
    camera.up.set(0.006, 1, 0);
    camera.lookAt(x + 1000 + f * 0.04, 34 + 300, z - 560);
    camera.fov = 40;
    cloud.wind.value.set(f * 0.00005 + 0.13, 0.42 - f * 0.00002, f * 0.000036 + 0.27);
  }};
});

// ---------------------------------------------------------------------------------------------------------------------
// RULEBOOK: the page from the Mission Report, on a desk, under a lamp. Rule b goes amber.
// ---------------------------------------------------------------------------------------------------------------------
// Mission Report p. 14-7, line by line as it sits on the page, the scanner's errors put right
const PAGE = [
  ['14-7', 'right'],
  '',
  'Loss of inertial platform reference. - A loss in reference for the',
  'inertial platform at the second discharge was most likely caused by the',
  'setting of high-order bits in the coupling display unit by the discharge',
  'transients introduced between signal ground and structural ground. If',
  'this condition occurs and causes the Z-axis (yaw) coupling display unit',
  '(middle gimbal) readout to exceed 85 degrees, the computer will down-mode',
  'the platform to coarse align. When the coupling display unit is driving',
  'at high speed to null the noise-induced error and the coarse-align loop is',
  'energized, the servo loop from the coupling display unit to the platform',
  'becomes unstable and drives the platform in the manner observed. A change',
  'to the computer programing to inhibit the computer mode-switching logic',
  'during the launch phase has been implemented for Apollo 13.',
  '',
  'Complete protection of the spacecraft from the effects of lightning',
  'is not considered practical at this stage of the program. The inherent',
  'temporary effects associated with solid state circuitry and the reason-',
  'able degree of safety in other circuits warrants the low risk of trigger-',
  'ing lightning if potentially hazardous electric fields are avoided.',
  '',
  'The following launch restrictions have been imposed for future mis-',
  'sions to greatly minimize the possibility of triggering lightning.',
  '',
  'a. No launch when flight will go through cumulonimbus (thunder-',
  'storm) cloud formation. In addition, no launch if flight will be within',
  '5 miles of thunderstorm clouds or within 3 miles of an associated anvil.',
  '',
  'b. Do not launch through cold-front or squall-line clouds which',
  'extend above 10 000 feet.',
  '',
  'c. Do not launch through middle cloud layers 6000 feet or greater',
  'in depth where the freeze level is in the clouds.',
  '',
  'd. Do not launch through cumulus clouds with tops at 10 000 feet',
  'or higher.',
  '',
  'This report reflects the combined efforts of the investigating teams',
  'at the Manned Spacecraft Center, the Kennedy Spacecraft Center, and the',
  'Marshall Space Flight Center.',
  '',
  'This anomaly is closed.',
];
const PW_M = 0.2032, PH_M = 0.2667;                       // the report's page: 8 x 10.5 in
const pageTexture = () => {
  const W = 3072, Hh = Math.round((W * PH_M) / PW_M), [c, g] = canvas(W, Hh), r = rng(1969);
  g.fillStyle = '#e6dcc4'; g.fillRect(0, 0, W, Hh);
  blotches(g, W, Hh, 3, 170, 120, 900, '176,150,104', 0.045);
  blotches(g, W, Hh, 4, 90, 80, 520, '250,244,226', 0.08);
  // edges gone darker with age
  const ed = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(140,108,62,0.34)'); gr.addColorStop(1, 'rgba(140,108,62,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh); };
  ed(0, 0, 150, 0); ed(W, 0, W - 150, 0); ed(0, 0, 0, 170); ed(0, Hh, 0, Hh - 170);
  speckle(g, W, Hh, 5, 16000, ['rgba(90,70,40,0.1)', 'rgba(60,50,30,0.06)', 'rgba(255,255,240,0.1)'], 1, 3);
  // fibres
  for (let i = 0; i < 2600; i++) { g.strokeStyle = `rgba(110,90,60,${0.02 + r() * 0.05})`; g.lineWidth = 1; const x = r() * W, y = r() * Hh, a = r() * 6.28, L = 6 + r() * 26; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.6 + 3, y + Math.sin(a) * L * 0.6, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  // the type: every letter struck on its own, a touch uneven, as a typewriter does it
  const fs = 54, cw = 32.4, lh = 86, x0 = 352, y0 = 300;
  g.textBaseline = 'alphabetic'; g.font = `700 ${fs}px "Courier New", Courier, monospace`;
  const rows = {};
  PAGE.forEach((row, i) => {
    const txt = Array.isArray(row) ? row[0] : row, y = y0 + i * lh; rows[i] = {y, txt};
    let x = Array.isArray(row) ? W - 360 - txt.length * cw : x0;
    // rules a to d: the first line of each sits indented, like the report
    const indent = /^[abcd]\. /.test(txt) ? cw * 2.6 : 0; x += indent;
    if (/^(Complete|The following|This report|Loss of)/.test(txt)) x += cw * 2.6;
    for (let j = 0; j < txt.length; j++) {
      const ch = txt[j], a = 0.72 + r() * 0.26;
      g.fillStyle = `rgba(26,22,20,${a})`;
      g.fillText(ch, x + (r() - 0.5) * 1.4, y + (r() - 0.5) * 1.4);
      if (r() < 0.25) { g.fillStyle = `rgba(26,22,20,${a * 0.25})`; g.fillText(ch, x + 1.5, y + 0.8); }   // ink spread
      x += cw;
    }
  });
  // three punched holes down the left
  [0.16, 0.5, 0.84].forEach((v) => { g.fillStyle = '#08070a'; g.beginPath(); g.arc(120, Hh * v, 48, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,96,60,0.5)'; g.lineWidth = 3; g.stroke(); });
  const iB = PAGE.findIndex((s) => typeof s === 'string' && s.startsWith('b. '));
  const rowUV = (i, n, ind) => ({v: 1 - (y0 + i * lh - fs * 0.3) / Hh, h: (lh * 0.58) / Hh, u0: (x0 + ind - cw * 0.4) / W, u1: (x0 + ind + n * cw + cw * 0.4) / W});
  return {t: tex(c), W, Hh, b1: rowUV(iB, PAGE[iB].length, cw * 2.6), b2: rowUV(iB + 1, PAGE[iB + 1].length, 0)};
};
const woodTexture = () => {
  const [c, g] = canvas(4096, 4096), r = rng(88);
  g.fillStyle = '#2a170c'; g.fillRect(0, 0, 4096, 4096);
  for (let i = 0; i < 900; i++) { const y = r() * 4096, a = 0.02 + r() * 0.09, wob = 8 + r() * 40, ph = r() * 6; g.strokeStyle = r() > 0.45 ? `rgba(10,5,2,${a * 2})` : `rgba(120,70,34,${a})`; g.lineWidth = 1 + r() * r() * 12; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 4096; x += 90) g.lineTo(x, y + Math.sin(x * 0.0016 + ph) * wob + Math.sin(x * 0.006 + ph * 2) * wob * 0.15); g.stroke(); }
  speckle(g, 4096, 4096, 21, 26000, ['rgba(0,0,0,0.2)', 'rgba(130,86,46,0.07)'], 1, 4);
  blotches(g, 4096, 4096, 22, 80, 200, 900, '0,0,0', 0.1);
  return tex(c);
};
export const RuleBook = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e; range(camera, 0.02, 30);
  e.final.bloom.value = 0.22; e.final.exposure.value = 1.0; e.final.vign.value = 1.15; e.final.grain.value = 0.016;
  e.renderer.toneMappingExposure = 1;
  envFrom(e, [0.018, 0.016, 0.014], [0.004, 0.003, 0.003], [[-6, 40, 6, 22, 22, [9, 6.4, 3.6]]]);
  const wood = woodTexture(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(1.6, 1.6);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshStandardMaterial({map: wood, bumpMap: wood, bumpScale: 0.5, roughness: 0.34, metalness: 0.05})); desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);
  // the report underneath: a board cover, a stack of sheets, then the open page, slightly bowed, its corner lifting
  const ROT = -0.09, book = new THREE.Group(); book.rotation.y = ROT; scene.add(book);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(PW_M + 0.012, 0.003, PH_M + 0.012), new THREE.MeshStandardMaterial({color: 0x20262e, roughness: 0.7, metalness: 0.05})); cover.position.y = 0.0015; cover.castShadow = cover.receiveShadow = true; book.add(cover);
  const stackM = new THREE.MeshStandardMaterial({color: 0xcbbfa5, roughness: 0.92});
  const stack = new THREE.Mesh(new THREE.BoxGeometry(PW_M, 0.012, PH_M), stackM); stack.position.y = 0.009; stack.castShadow = stack.receiveShadow = true; book.add(stack);
  const pg = pageTexture();
  const geo = new THREE.PlaneGeometry(PW_M, PH_M, 90, 120); geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) / (PW_M / 2), z = P.getZ(i) / (PH_M / 2);
    const bow = 0.0022 * (1 - x * x) * (1 - 0.5 * z * z);
    const cx = Math.max(0, (x + z * -1 + 0.2 - 1.15)) , curl = 0.016 * cx * cx;                 // the top-right corner lifts a little
    const ed = 0.0008 * Math.sin(x * 5 + 1) * Math.sin(z * 4);
    P.setY(i, 0.0155 + bow + curl + ed);
  }
  geo.computeVertexNormals();
  const uni = {sweep1: {value: 0}, sweep2: {value: 0}, b1: {value: new THREE.Vector4(pg.b1.u0, pg.b1.u1, pg.b1.v, pg.b1.h)}, b2: {value: new THREE.Vector4(pg.b2.u0, pg.b2.u1, pg.b2.v, pg.b2.h)}};
  const pm = new THREE.MeshStandardMaterial({map: pg.t, roughness: 0.82, metalness: 0, side: THREE.DoubleSide});
  pm.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni);
    s.fragmentShader = 'uniform float sweep1, sweep2; uniform vec4 b1, b2;\n' + s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec2 uv = vMapUv;
        float wob = sin(uv.x * 340.0) * 0.00035 + sin(uv.x * 91.0 + 1.0) * 0.0006;
        float row = 0.0;
        for (int i = 0; i < 2; i++) {
          vec4 b = i == 0 ? b1 : b2; float sw = i == 0 ? sweep1 : sweep2;
          float e = lerp_dummy;
          float xs = (uv.x - b.x) / (b.y - b.x);
          float m = smoothstep(0.0, 0.004, xs) * (1.0 - smoothstep(sw - 0.006, sw + 0.001, xs)) * step(0.0005, sw);
          float yd = abs(uv.y - b.z + wob) / (b.w * 0.5);
          m *= 1.0 - smoothstep(0.86, 1.0, yd);
          row = max(row, m);
        }
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.0, 0.56, 0.1), row * 0.94);
      }`.replace('float e = lerp_dummy;', ''));
  };
  const page = new THREE.Mesh(geo, pm); page.castShadow = page.receiveShadow = true; book.add(page);
  // the things on the desk: a pencil beside the page and a steel rule off to the side
  const pencil = new THREE.Group(); pencil.position.set(0.158, 0.0042, -0.012); pencil.rotation.y = 0.2; scene.add(pencil);
  const yl = new THREE.MeshStandardMaterial({color: 0xb8821e, roughness: 0.34, metalness: 0.05});
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.15, 6), yl); shaft.rotation.x = Math.PI / 2; shaft.castShadow = true; pencil.add(shaft);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.0038, 0.016, 12), new THREE.MeshStandardMaterial({color: 0xc9a06c, roughness: 0.8})); cone.rotation.x = -Math.PI / 2; cone.position.z = -0.083; cone.castShadow = true; pencil.add(cone);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0011, 0.0045, 10), new THREE.MeshStandardMaterial({color: 0x1a1a1c, roughness: 0.4, metalness: 0.4})); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.0893; pencil.add(tip);
  const fer = new THREE.Mesh(new THREE.CylinderGeometry(0.0041, 0.0041, 0.012, 16), new THREE.MeshStandardMaterial({color: 0xa8a49a, roughness: 0.28, metalness: 0.95})); fer.rotation.x = Math.PI / 2; fer.position.z = 0.081; fer.castShadow = true; pencil.add(fer);
  const era = new THREE.Mesh(new THREE.CylinderGeometry(0.0037, 0.0037, 0.009, 16), new THREE.MeshStandardMaterial({color: 0x8a3f33, roughness: 0.8})); era.rotation.x = Math.PI / 2; era.position.z = 0.091; era.castShadow = true; pencil.add(era);
  // the lamp: one small bulb in a shade, up and to the left, a hard edge to its pool
  const lamp = new THREE.SpotLight(0xffd09a, 1.15, 3, 0.44, 0.72, 1.7); lamp.position.set(-0.27, 0.56, -0.2); lamp.target.position.set(0.012, 0, 0.01); scene.add(lamp, lamp.target);
  lamp.castShadow = true; lamp.shadow.mapSize.set(4096, 4096); lamp.shadow.camera.near = 0.2; lamp.shadow.camera.far = 1.5; lamp.shadow.bias = -0.00004; lamp.shadow.normalBias = 0.0002; lamp.shadow.radius = 4;
  scene.add(new THREE.AmbientLight(0x3a3c44, 0.1));

  // where things are on the desk
  const place = (u, v) => { const x = (u - 0.5) * PW_M, z = (0.5 - v) * PH_M; return new THREE.Vector3(x * Math.cos(ROT) + z * Math.sin(ROT), 0.016, -x * Math.sin(ROT) + z * Math.cos(ROT)); };
  const rulesC = place(0.5, pg.b1.v + 0.012), bC = place((pg.b1.u0 + pg.b1.u1) / 2, (pg.b1.v + pg.b2.v) / 2);
  const whole = place(0.5, 0.5);
  return {draw: (f) => {
    const A = ease(f / 150), B = ease((f - 150) / 96), ab = (x, y, z) => x + (y - x) * A + (z - y) * B;          // whole page -> the four rules -> rule b
    const look = new THREE.Vector3(ab(whole.x, rulesC.x, bC.x), 0.016, ab(whole.z + 0.012, rulesC.z, bC.z));
    camera.position.set(ab(-0.02, -0.006, -0.003) + look.x, ab(0.335, 0.215, 0.13), ab(0.12, 0.07, 0.048) + look.z);
    camera.up.set(0.016, 1, 0);
    camera.lookAt(look); camera.fov = 40;
    uni.sweep1.value = clamp((f - 258) / 62) * 1.02;
    uni.sweep2.value = clamp((f - 322) / 22) * 1.02;
  }};
});

// ---------------------------------------------------------------------------------------------------------------------
// The launch tower in true metres: base 49 x 41 m on six pedestals, the 12.2 m square tower 116 m above the deck, swing arms folded back, the hammerhead crane.
// x = 0 at the rocket's hole; the tower stands 22 m off at +x.
// ---------------------------------------------------------------------------------------------------------------------
const towerSkin = (seed) => { const [c, g] = canvas(1024, 1024); g.fillStyle = '#6e2c1b'; g.fillRect(0, 0, 1024, 1024); blotches(g, 1024, 1024, seed, 90, 30, 200, '20,8,5', 0.2); blotches(g, 1024, 1024, seed + 1, 40, 20, 120, '160,92,60', 0.08); speckle(g, 1024, 1024, seed + 2, 5000, ['rgba(0,0,0,0.2)']); return tex(c, true, [1, 1]); };
const makeTower = () => {
  const g = new THREE.Group(), DECK = 14.3, S = 12.2, N = 19, LV = 6.1, X = 22, beams = [];
  const u = new THREE.Vector3(0, 1, 0);
  const beam = (a, b, t) => beams.push([a, b, t]);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const c4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]], hw = S / 2;
  for (let l = 0; l < N; l++) {
    const y0 = DECK + l * LV, y1 = y0 + LV;
    for (const [a, b] of [...c4, [0, -1], [0, 1], [-1, 0], [1, 0]]) beam(V(X + a * hw, y0, b * hw), V(X + a * hw, y1, b * hw), a * b !== 0 ? 0.62 : 0.34);
    for (let i = 0; i < 4; i++) {
      const [a, b] = c4[i], [c, d] = c4[(i + 1) % 4], m = [(a + c) / 2, (b + d) / 2];
      beam(V(X + a * hw, y1, b * hw), V(X + c * hw, y1, d * hw), 0.4);
      const flip = (l + i) % 2 === 0;
      beam(V(X + a * hw, flip ? y0 : y1, b * hw), V(X + m[0] * hw, flip ? y1 : y0, m[1] * hw), 0.2);
      beam(V(X + m[0] * hw, flip ? y1 : y0, m[1] * hw), V(X + c * hw, flip ? y0 : y1, d * hw), 0.2);
    }
  }
  // the folded swing arms: trusses hinged on the rocket-side face, swung back along it
  [[18, 17], [28, 18], [42, 16], [52, 19], [64, 15], [74, 19], [86, 14], [96, 14], [106, 13]].forEach(([h, L], i) => {
    const y = DECK + h, z0 = (i % 2 ? 1 : -1) * hw * 0.6, dir = i % 2 ? 1 : -1, x0 = X - hw - 0.5, w = 1.6, ht = 2.6;
    const pt = (k, a, b) => V(x0 - a * w, y + b * ht, z0 + dir * k * L);
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) beam(pt(0, a, b), pt(1, a, b), 0.2);
    for (let k = 0; k < 8; k++) { const q0 = k / 8, q1 = (k + 1) / 8; beam(pt(q0, 0, 0), pt(q1, 0, 1), 0.09); beam(pt(q0, 1, 1), pt(q1, 1, 0), 0.09); beam(pt(q0, 0, 1), pt(q0, 1, 1), 0.09); beam(pt(q0, 0, 0), pt(q0, 1, 0), 0.09); }
  });
  // the hammerhead crane on top
  const top = DECK + N * LV;
  for (const [a, b] of c4) beam(V(X + a * 2.6, top, b * 2.6), V(X + a * 1.4, top + 7, b * 1.4), 0.34);
  for (const zz of [-1, 1]) { beam(V(X - 26, top + 7, zz * 1.2), V(X + 13, top + 7, zz * 1.2), 0.32); beam(V(X - 26, top + 9.4, zz * 0.5), V(X + 13, top + 9.4, zz * 0.5), 0.2); }
  for (let k = 0; k <= 13; k++) { const x = X - 26 + k * 3; for (const zz of [-1, 1]) beam(V(x, top + 7, zz * 1.2), V(x + 1.5, top + 9.4, zz * 0.5), 0.1); }
  const mat = new THREE.MeshStandardMaterial({map: towerSkin(301), roughness: 0.6, metalness: 0.4});
  const box = new THREE.BoxGeometry(1, 1, 1);
  const im = new THREE.InstancedMesh(box, mat, beams.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  beams.forEach(([a, b, t], i) => { const d = b.clone().sub(a), L = d.length(); P.copy(a).addScaledVector(d, 0.5); Q.setFromUnitVectors(u, d.normalize()); Sc.set(t, L, t); M.compose(P, Q, Sc); im.setMatrixAt(i, M); });
  im.castShadow = true; im.frustumCulled = false; g.add(im);
  // decks, elevator shaft and the pipes up the face
  const dk = new THREE.MeshStandardMaterial({color: 0x101113, roughness: 0.96, metalness: 0});
  for (let l = 1; l <= N; l++) { const m = new THREE.Mesh(new THREE.BoxGeometry(S - 0.5, 0.25, S - 0.5), dk); m.position.set(X, DECK + l * LV, 0); g.add(m); }
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.4, N * LV, 3.4), new THREE.MeshStandardMaterial({color: 0x3a2a24, roughness: 0.8, metalness: 0.2})); shaft.position.set(X + 1, DECK + (N * LV) / 2, 1.5); g.add(shaft);
  const pipeM = new THREE.MeshStandardMaterial({color: 0x8d8a82, roughness: 0.4, metalness: 0.8});
  [-3.4, -2.5, -1.6, 2.3, 3.2].forEach((z, i) => { const R = 0.14 + (i % 2) * 0.09, m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, N * LV, 10), pipeM); m.position.set(X - hw - 0.35, DECK + (N * LV) / 2, z); g.add(m); });
  // the base: four slabs round the rocket's hole, pedestals under it, a dark deck
  const conc = (() => { const [c, cg] = canvas(2048, 2048); cg.fillStyle = '#3f4144'; cg.fillRect(0, 0, 2048, 2048); blotches(cg, 2048, 2048, 44, 240, 30, 300, '10,10,12', 0.22); blotches(cg, 2048, 2048, 45, 80, 30, 200, '120,110,96', 0.06); return tex(c); })();
  const baseM = new THREE.MeshStandardMaterial({map: conc, roughness: 0.7, metalness: 0.3});
  const slab = (x0, x1, z0, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 7.6, z1 - z0), baseM); m.position.set((x0 + x1) / 2, DECK - 3.8, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; g.add(m); };
  const H = 7;
  slab(-20, -H, -20.5, 20.5); slab(H, 30, -20.5, 20.5); slab(-H, H, -20.5, -H); slab(-H, H, H, 20.5);
  // the four hold-down arms round the empty hole
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 4.2), new THREE.MeshStandardMaterial({color: 0x26272a, roughness: 0.6, metalness: 0.7})); m.position.set(Math.cos(a) * 7.8, DECK + 1.4, Math.sin(a) * 7.8); m.rotation.y = -a + Math.PI / 2; g.add(m); }
  for (const [x, z] of [[-16, -15], [-16, 15], [6, -15], [6, 15], [26, -15], [26, 15]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(5, 6.7, 5), baseM); m.position.set(x, 3.35, z); m.castShadow = true; g.add(m); }
  g.userData.top = top; g.userData.DECK = DECK;
  return g;
};
const wetGround = (size, op, seed = 71) => {
  const [c, g] = canvas(4096, 4096);
  g.fillStyle = '#46484a'; g.fillRect(0, 0, 4096, 4096);
  blotches(g, 4096, 4096, seed, 420, 30, 420, '6,6,8', 0.28); blotches(g, 4096, 4096, seed + 1, 150, 30, 300, '150,140,120', 0.05);
  speckle(g, 4096, 4096, seed + 2, 40000, ['rgba(0,0,0,0.22)', 'rgba(255,255,255,0.05)'], 1, 3);
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 7; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 512, 0); g.lineTo(i * 512, 4096); g.moveTo(0, i * 512); g.lineTo(4096, i * 512); g.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size / 60, size / 60);
  // puddles: wet patches shine, the rest less
  const [c2, g2] = canvas(2048, 2048); g2.fillStyle = '#9a9a9a'; g2.fillRect(0, 0, 2048, 2048); blotches(g2, 2048, 2048, seed + 3, 230, 40, 330, '10,10,10', 0.4);
  const rt = tex(c2, false); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(size / 90, size / 90);
  const [c3, g3] = canvas(1024, 1024); g3.fillStyle = '#808080'; g3.fillRect(0, 0, 1024, 1024); speckle(g3, 1024, 1024, seed + 4, 60000, ['#6c6c6c', '#949494', '#7a7a7a'], 1, 3);
  const bt = tex(c3, false); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(size / 7, size / 7);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({map: t, roughnessMap: rt, roughness: 0.34, metalness: 0.1, bumpMap: bt, bumpScale: 0.25, transparent: op < 1, opacity: op}));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
};

// ---------------------------------------------------------------------------------------------------------------------
// ENDPAD: the empty tower after the launch. Rain, steam off the deck, the hole where the rocket stood. Nothing moves but the weather.
// ---------------------------------------------------------------------------------------------------------------------
export const EndPad = () => useScene((e) => {
  const {scene, camera, cloud} = e; shadows(e); range(camera, 0.5, 9000);
  e.skyHi.set(0.15, 0.165, 0.2); e.skyLo.set(0.03, 0.034, 0.042);
  cloud.noise.value = softNoise(); cloud.base.value = 132; cloud.top.value = 3200; cloud.cover.value = 0.425; cloud.thick.value = 0.34; cloud.scale.value = 0.00105; cloud.far_.value = 3800; cloud.near_.value = 40; cloud.flash.value = 0; cloud.flame.value = 0; cloud.fine.value = 2.7;
  e.final.bloom.value = 0.5; e.final.exposure.value = 1.05; e.final.vign.value = 0.8; e.final.grain.value = 0.02;
  scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.03, 0.033, 0.041), 0.00165);
  envFrom(e, [0.15, 0.165, 0.2], [0.03, 0.033, 0.04], [[-20, 7, 40, 24, 3, [1.3, 1.0, 0.66]]]);
  const T = makeTower(); scene.add(T);
  const mir = T.clone(); mir.scale.y = -1; scene.add(mir);
  const ground = wetGround(1400, 0.8); ground.material.color.setRGB(0.42, 0.42, 0.44); scene.add(ground);
  // the scrub line at the far edge of the pad's land
  const treeC = (() => { const [c, g] = canvas(4096, 128), r = rng(55); g.fillStyle = '#0a0c0c'; for (let x = 0; x < 4096; x += 3) { const h = 40 + r() * 34 + Math.sin(x * 0.01) * 12 + Math.sin(x * 0.083) * 6; g.fillRect(x, 128 - h, 4, h); } const t = tex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(7, 1); return t; })();
  const trees = new THREE.Mesh(new THREE.CylinderGeometry(1500, 1500, 34, 64, 1, true), new THREE.MeshBasicMaterial({map: treeC, transparent: true, side: THREE.BackSide, fog: true})); trees.position.y = 17; scene.add(trees);
  scene.add(new THREE.HemisphereLight(0x9caac0, 0x1a1a1a, 0.5));
  const key = new THREE.DirectionalLight(0xaab6c6, 0.75); key.position.set(-300, 300, 400); scene.add(key);
  const up1 = new THREE.SpotLight(0xffc88e, 560, 400, 0.42, 0.9, 1.7); up1.position.set(-30, 3, 70); up1.target.position.set(22, 70, 0); scene.add(up1, up1.target);
  up1.castShadow = true; up1.shadow.mapSize.set(2048, 2048); up1.shadow.camera.near = 40; up1.shadow.camera.far = 320; up1.shadow.bias = -0.0005;
  const up2 = new THREE.SpotLight(0xffc587, 420, 300, 0.6, 0.9, 1.8); up2.position.set(60, 2, 50); up2.target.position.set(10, 22, 0); scene.add(up2, up2.target);
  // work lights left burning on the tower: true points with a halo
  const haloT = (() => { const [c, g] = canvas(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c); })();
  const r = rng(113);
  for (let i = 0; i < 26; i++) { const lv = Math.floor(r() * 19), s = new THREE.Sprite(new THREE.SpriteMaterial({map: haloT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: new THREE.Color(5, 3.2, 1.6)})); const sz = 2.6 + r() * 2.6; s.scale.set(sz, sz, 1); s.position.set(22 - 6.4 + r() * 8, 14.3 + lv * 6.1 + 0.6, 6.4); scene.add(s); }
  // the ground between us and the tower: the crawlerway's two gravel lanes, lamp poles left on, the liquid oxygen sphere in the rain
  { const [c, g] = canvas(1024, 1024); g.fillStyle = '#2f3032'; g.fillRect(0, 0, 1024, 1024); speckle(g, 1024, 1024, 66, 120000, ['#55554f', '#1c1c1e', '#3e3e3c', '#6a6a62'], 1, 4); const t = tex(c, true, [4, 120]);
    const lane = new THREE.MeshStandardMaterial({map: t, bumpMap: t, bumpScale: 1.2, roughness: 0.62, color: new THREE.Color().setRGB(1.3, 1.3, 1.34)});
    for (const off of [-16, 16]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 1400), lane); m.rotation.x = -Math.PI / 2; m.rotation.z = -0.62; m.position.set(-4 - Math.sin(0.62) * 0 + off * Math.cos(0.62) - 250 * Math.sin(0.62), 0.05, off * Math.sin(0.62) + 250 * Math.cos(0.62)); m.receiveShadow = true; scene.add(m); } }
  { const pm = metalOf(0x23252a, 0.55, 0.7), halo = new THREE.SpriteMaterial({map: haloT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: new THREE.Color(4.2, 2.9, 1.7)});
    [[-92, 60], [-48, 48], [-108, -16], [28, 70], [-132, 142], [-46, 176]].forEach(([x, z]) => { const p = mesh(new THREE.CylinderGeometry(0.12, 0.18, 16, 10), pm, x, 8, z); scene.add(p); const arm = mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), pm, x + 0.6, 16, z); scene.add(arm); const s = new THREE.Sprite(halo); s.scale.set(5.4, 5.4, 1); s.position.set(x + 1.2, 15.7, z); scene.add(s); const pool = new THREE.PointLight(0xffc48a, 240, 44, 1.8); pool.position.set(x + 1.2, 15.4, z); scene.add(pool); }); }
  { const sph = new THREE.Mesh(new THREE.SphereGeometry(11.5, 36, 24), new THREE.MeshStandardMaterial({color: 0xa8a8a0, roughness: 0.48, metalness: 0.2})); sph.position.set(-178, 16, -96); scene.add(sph); [0, 1, 2, 3, 4, 5].forEach((i) => { const a = (i / 6) * 6.283; scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 16, 8), metalOf(0x34363a, 0.5, 0.7), -178 + Math.cos(a) * 9, 8, -96 + Math.sin(a) * 9)); }); }
  // steam off the deck and out of the flame trench, thinning
  const steamG = new THREE.Group(); scene.add(steamG); const steam = makePuffs(steamG, 70, 3);
  const rain = makeRain(e.glow, 7000, 909, [70, 40, 70], 0.7, [0.5, 0.55, 0.62], 0.04);
  const rainFar = makeRain(e.glow, 10000, 911, [460, 230, 460], 3.0, [0.42, 0.47, 0.55], 0.038);
  return {draw: (f) => {
    const k = f / 300;
    const cx = lerp(-262, -248, k), cy = lerp(2.2, 2.5, k), cz = lerp(306, 292, k);
    camera.position.set(cx, cy, cz);
    camera.lookAt(lerp(-46, -43, k), lerp(66, 67, k), 0); camera.fov = 27; camera.up.set(0.002, 1, 0);
    cloud.wind.value.set(f * 0.00016 + 0.2, -f * 0.00012 + 0.77, f * 0.00009);
    rain(f, cx + 16, 18 + cy, cz - 24, 0.4); rainFar(f, -60, 110, 90, 0.4);
    steam.forEach(({s, m, a, b, c, d}) => {
      const life = 150 + a * 220, t = ((f + d * 2000) % life) / life, inHole = b < 0.6;
      const x0 = inHole ? (c - 0.5) * 11 : -20 + c * 12, z0 = inHole ? (a - 0.5) * 11 : (d - 0.5) * 50;
      s.position.set(x0 + t * 26 + (a - 0.5) * 6, 12 + t * 44 * (0.6 + b * 0.5), z0 + t * 4);
      const sc = 9 + t * 34 + a * 6; s.scale.set(sc, sc, 1);
      m.rotation = a * 6 + t * (c - 0.5);
      m.opacity = Math.sin(Math.pow(t, 0.7) * Math.PI) * (0.08 + c * 0.16);
      m.color.setRGB(0.26, 0.27, 0.29);
    });
  }};
});

// ---------------------------------------------------------------------------------------------------------------------
// PUMPLINE: the liquid oxygen replenish pumps, cut open, at the foot of the rocket. The left one stops. The right one is all there is.
// ---------------------------------------------------------------------------------------------------------------------
const flowMat = () => new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
  uniforms: {pos: {value: 0}, run: {value: 1}, tile: {value: new THREE.Vector2(6, 8)}},
  vertexShader: 'out vec2 vU; out vec3 vN; out vec3 vV; void main(){ vU = uv; vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); gl_Position = projectionMatrix * m; }',
  fragmentShader: `precision highp float; in vec2 vU; in vec3 vN; in vec3 vV; out vec4 o; uniform float pos, run; uniform vec2 tile;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); vec2 w = vec2(1.0, 0.0); return mix(mix(h(i), h(i + w), f.x), mix(h(i + w.yx), h(i + 1.0), f.x), f.y); }
    float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.07 + 7.3; a *= 0.5; } return s; }
    void main(){
      vec2 p = vec2(vU.x * tile.x, vU.y * tile.y - pos);
      float s1 = fbm(p * vec2(1.0, 0.32)), s2 = fbm(p * vec2(2.6, 0.7) + 3.1);
      float streak = smoothstep(0.42, 0.78, s1) * 0.7 + smoothstep(0.52, 0.8, s2) * 0.9;
      float bub = smoothstep(0.87, 0.92, n(p * vec2(34.0, 5.0))) * 0.55 + smoothstep(0.9, 0.94, n(p * vec2(13.0, 3.0) + 9.0)) * 0.35;
      vec3 deep = vec3(0.012, 0.03, 0.06), pale = vec3(0.2, 0.3, 0.4);
      vec3 c = mix(deep, pale, streak * mix(0.2, 1.0, run)) + vec3(0.42, 0.52, 0.62) * bub * mix(0.0, 1.0, run);
      float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
      c *= 0.55 + 0.75 * mix(0.45, 1.0, run);
      c *= 0.55 + 1.5 * fr; c += vec3(0.05, 0.11, 0.2) * fr;
      o = vec4(c, 1.0);
    }`});
const swirlMat = () => new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
  uniforms: {ang: {value: 0}, run: {value: 1}},
  vertexShader: 'out vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `precision highp float; in vec2 vU; out vec4 o; uniform float ang, run;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); vec2 w = vec2(1.0, 0.0); return mix(mix(h(i), h(i + w), f.x), mix(h(i + w.yx), h(i + 1.0), f.x), f.y); }
    void main(){ vec2 q = vU - 0.5; float r = length(q) * 2.0, a = atan(q.y, q.x);
      float u = (a - ang) * 3.0 + r * 5.0; float s = sin(u * 2.0) * 0.5 + 0.5;
      float nn = n(vec2(cos(a - ang) * 4.0 + 5.0, r * 7.0 - sin(a - ang) * 4.0 + 5.0));
      vec3 c = mix(vec3(0.008, 0.024, 0.05), vec3(0.17, 0.27, 0.38), (s * 0.45 + nn * 0.6) * mix(0.15, 1.0, run));
      o = vec4(c * mix(0.5, 1.0, run) * (0.5 + 0.8 * r), 1.0); }`});

const frostSkin = (seed, rep = [2, 2]) => {
  const [c, g] = canvas(1024, 1024); g.fillStyle = '#a4acb6'; g.fillRect(0, 0, 1024, 1024);
  blotches(g, 1024, 1024, seed, 300, 6, 70, '236,242,250', 0.4); blotches(g, 1024, 1024, seed + 1, 120, 10, 80, '100,106,116', 0.25);
  speckle(g, 1024, 1024, seed + 2, 60000, ['rgba(255,255,255,0.5)', 'rgba(90,100,114,0.24)'], 1, 3);
  return tex(c, true, rep);
};
const frostBump = (seed, rep) => { const [c, g] = canvas(1024, 1024); g.fillStyle = '#808080'; g.fillRect(0, 0, 1024, 1024); speckle(g, 1024, 1024, seed, 80000, ['#ffffff', '#3a3a3a', '#9a9a9a'], 1, 4); blotches(g, 1024, 1024, seed + 1, 140, 8, 60, '255,255,255', 0.4); return tex(c, false, rep); };

const metalOf = (color, rough = 0.32, metal = 0.95, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, ...extra});
const mesh = (geo, mat, x = 0, y = 0, z = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = shadow; return m; };

// a pump, motor behind it, its volute cut open to the camera
const makePump = () => {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({color: 0x2e3532, roughness: 0.42, metalness: 0.6}), steel = metalOf(0xa9abac, 0.28), dark = metalOf(0x202226, 0.5, 0.8);
  const frost = new THREE.MeshStandardMaterial({map: frostSkin(501, [3, 2]), bumpMap: frostBump(503, [3, 2]), bumpScale: 1.2, roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide});
  // the skid
  g.add(mesh(new THREE.BoxGeometry(2.6, 0.26, 4.4), dark, 0, 0.13, -0.6));
  [[-1.2, 0.98], [1.2, 0.98], [-1.2, -2.2], [1.2, -2.2]].forEach(([x, z]) => g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), steel, x, 0.3, z)));
  const CY = 1.32, CZ = 0.72, R = 0.72;
  // the motor: a finned barrel
  const barrel = mesh(new THREE.CylinderGeometry(0.56, 0.56, 1.9, 40), paint, 0, CY, -1.05); barrel.rotation.x = Math.PI / 2; g.add(barrel);
  const finN = 44, fin = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.07, 1.72), paint, finN), M = new THREE.Matrix4();
  for (let i = 0; i < finN; i++) { const a = (i / finN) * Math.PI * 2; M.makeRotationZ(a - Math.PI / 2); M.setPosition(Math.cos(a) * 0.6, CY + Math.sin(a) * 0.6, -1.05); fin.setMatrixAt(i, M); }
  fin.castShadow = true; g.add(fin);
  const endB = mesh(new THREE.SphereGeometry(0.56, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), paint, 0, CY, -2.0); endB.rotation.x = -Math.PI / 2; endB.scale.y = 0.4; g.add(endB);
  g.add(mesh(new THREE.BoxGeometry(0.52, 0.42, 0.6), paint, 0, CY + 0.72, -1.3));
  [[-0.5, -1.6], [0.5, -1.6], [-0.5, -0.5], [0.5, -0.5]].forEach(([x, z]) => g.add(mesh(new THREE.BoxGeometry(0.2, CY - 0.26 - 0.2, 0.3), dark, x, (CY + 0.06) / 2 + 0.1, z)));
  // the coupling, a steel drum
  const drum = mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.72, 32), steel, 0, CY, 0.0); drum.rotation.x = Math.PI / 2; g.add(drum);
  // the volute: back plate, a thick rim, a bolted front cover over the lower third, and the rest open
  const back = mesh(new THREE.CircleGeometry(R, 56), frost, 0, CY, CZ - 0.2); g.add(back);
  const rimOut = mesh(new THREE.CylinderGeometry(R + 0.09, R + 0.09, 0.46, 56, 1, true), frost, 0, CY, CZ); rimOut.rotation.x = Math.PI / 2; g.add(rimOut);
  const rimIn = mesh(new THREE.CylinderGeometry(R, R, 0.46, 56, 1, true), metalOf(0x6a6e72, 0.3, 1, {side: THREE.BackSide}), 0, CY, CZ); rimIn.rotation.x = Math.PI / 2; g.add(rimIn);
  const lip = mesh(new THREE.RingGeometry(R - 0.002, R + 0.13, 72), metalOf(0x8e8e88, 0.42), 0, CY, CZ + 0.232); g.add(lip);
  const coverS = new THREE.Shape(), ca = Math.PI * 1.1, cb = Math.PI * 1.9, rO = R + 0.13;
  coverS.moveTo(Math.cos(ca) * rO, Math.sin(ca) * rO); coverS.absarc(0, 0, rO, ca, cb, false); coverS.lineTo(Math.cos(ca) * rO, Math.sin(ca) * rO);
  const coverG = new THREE.ExtrudeGeometry(coverS, {depth: 0.035, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 40});
  const cover = mesh(coverG, new THREE.MeshStandardMaterial({color: 0x585c60, roughness: 0.38, metalness: 0.85, map: frostSkin(507, [1.4, 1.4]), bumpMap: frostBump(509, [1.4, 1.4]), bumpScale: 0.25}), 0, CY, CZ + 0.245); g.add(cover);
  const boltG = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6), bolt = new THREE.InstancedMesh(boltG, steel, 26), RQ = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, inC = a > Math.PI * 1.1 && a < Math.PI * 1.9, m = RQ.clone(); m.setPosition(Math.cos(a) * (R + 0.075), CY + Math.sin(a) * (R + 0.075), CZ + (inC ? 0.3 : 0.26)); bolt.setMatrixAt(i, m); }
  g.add(bolt);
  // the liquid: a swirl behind the impeller
  const swirl = swirlMat(), liq = new THREE.Mesh(new THREE.CircleGeometry(R - 0.004, 64), swirl); liq.position.set(0, CY, CZ - 0.17); g.add(liq);
  // the impeller: seven curved blades and a hub
  const imp = new THREE.Group(); imp.position.set(0, CY, CZ - 0.05); g.add(imp);
  const shiny = metalOf(0x8f918e, 0.46);
  const bladeS = new THREE.Shape(); const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12, r0 = 0.13 + t * 0.5, a = t * 1.25; pts.push([Math.cos(a) * r0, Math.sin(a) * r0]); }
  bladeS.moveTo(pts[0][0], pts[0][1]); pts.forEach(([x, y]) => bladeS.lineTo(x, y)); for (let i = 12; i >= 0; i--) { const t = i / 12, r0 = 0.13 + t * 0.5, a = t * 1.25 + 0.055 + 0.05 * (1 - t); bladeS.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); } bladeS.closePath();
  const bladeG = new THREE.ExtrudeGeometry(bladeS, {depth: 0.22, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 2}); bladeG.translate(0, 0, -0.11);
  for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(bladeG, shiny); b.rotation.z = (i / 7) * Math.PI * 2; b.castShadow = true; imp.add(b); }
  imp.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 32).rotateX(Math.PI / 2), shiny, 0, 0, 0.02));
  imp.add(mesh(new THREE.ConeGeometry(0.09, 0.09, 6).rotateX(Math.PI / 2), metalOf(0x40423f, 0.4), 0, 0, 0.2));
  // the suction spool below, the discharge riser above
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 28), frost, 0, CY - R - 0.26, CZ));
  g.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 1.04, 28), frost, 0.0, CY + R + 0.56, CZ));
  const flanged = (y) => { g.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 28), steel, 0, y, CZ)); };
  flanged(CY + R + 0.12); flanged(CY + R + 1.0); flanged(CY - R - 0.1);
  // a small valve wheel on the riser
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.022, 10, 28), metalOf(0x9c2a1c, 0.5, 0.2)); wheel.position.set(0.44, CY + R + 0.56, CZ); wheel.rotation.y = Math.PI / 2; wheel.castShadow = true; g.add(wheel);
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 10).rotateZ(Math.PI / 2), steel, 0.3, CY + R + 0.56, CZ));
  // the control post: green running, red tripped, with real glass
  g.add(mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), dark, -1.16, 1.0, 0.72));
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.17, 0.12), dark, -1.16, 1.8, 0.72));
  const lampG = new THREE.SphereGeometry(0.03, 20, 14);
  const green = new THREE.MeshBasicMaterial({color: 0x000000}), red = new THREE.MeshBasicMaterial({color: 0x000000});
  g.add(mesh(lampG, green, -1.24, 1.8, 0.78, false), mesh(lampG, red, -1.08, 1.8, 0.78, false));
  const gl = new THREE.PointLight(0x36ff7a, 0, 3.4, 1.8), rl = new THREE.PointLight(0xff2a1a, 0, 4, 1.8); gl.position.set(-1.26, 1.8, 1.05); rl.position.set(-1.06, 1.8, 1.05); g.add(gl, rl);
  g.userData = {imp, swirl, green, red, gl, rl, CY, CZ, R};
  return g;
};

export const PumpLine = () => useScene((e) => {
  const {scene, camera, cloud} = e; shadows(e); range(camera, 0.1, 6000);
  e.skyHi.set(0.085, 0.095, 0.115); e.skyLo.set(0.022, 0.025, 0.03);
  cloud.far_.value = 0;
  e.final.bloom.value = 0.42; e.final.exposure.value = 1.0; e.final.vign.value = 0.9; e.final.grain.value = 0.018;
  scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.034, 0.038, 0.046), 0.0086);
  envFrom(e, [0.1, 0.11, 0.13], [0.012, 0.012, 0.014], [[-22, 24, 12, 16, 5, [4.2, 3.0, 1.9]], [24, 6, 24, 4, 14, [0.5, 0.55, 0.65]]]);
  const gr = wetGround(900, 1, 173); gr.material.color.setRGB(0.55, 0.55, 0.56); scene.add(gr);
  const STOP = 135;
  const A = makePump(), B = makePump(); A.position.x = -2.1; B.position.x = 2.1; scene.add(A, B);
  const {CY, CZ, R} = A.userData, HY = CY + R + 1.28;       // the header's height
  // the header: jacket and inner pipe cut open along the side that faces us, the liquid in it
  const frost = new THREE.MeshStandardMaterial({map: frostSkin(601, [14, 2]), bumpMap: frostBump(603, [14, 2]), bumpScale: 1.3, roughness: 0.84, side: THREE.DoubleSide});
  const inner = metalOf(0x7c8084, 0.3, 1, {side: THREE.DoubleSide}), cut = new THREE.MeshStandardMaterial({color: 0x24262a, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide}), steel = metalOf(0xb4b5b0, 0.27);
  const WIN = 1.05;
  const addRun = (x0, x1, flow, windowed) => {
    const L = x1 - x0, xc = (x0 + x1) / 2, g = new THREE.Group(); g.position.set(xc, HY, CZ); scene.add(g);
    const tilt = 0.3;                                                   // the window looks a little upward, towards the camera
    const part = (r, mat, tS, tL, seg = 40) => { const c = new THREE.CylinderGeometry(r, r, L, seg, 1, true, tS, tL); c.rotateZ(Math.PI / 2); const m = new THREE.Mesh(c, mat); m.rotation.x = -tilt; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    if (windowed) {
      part(0.34, frost, WIN, Math.PI * 2 - WIN * 2); part(0.21, inner, WIN, Math.PI * 2 - WIN * 2);
      // the cut faces: two long strips between the inner pipe and the jacket
      for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.13), cut); st.position.z = 0.275; const piv = new THREE.Group(); piv.add(st); st.rotation.x = Math.PI / 2; piv.rotation.x = -tilt - s * WIN; g.add(piv); }
      const ring = (x) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.345, 40), cut); m.position.x = x; m.rotation.y = Math.PI / 2; g.add(m); }; ring(-L / 2); ring(L / 2);
    } else part(0.34, frost, 0, Math.PI * 2);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, L, 36, 1, true).rotateZ(Math.PI / 2), flow));
    return g;
  };
  const fA = flowMat(), fB = flowMat(), fC = flowMat();
  fA.uniforms.tile.value.set(5, 4.4); fB.uniforms.tile.value.set(5, 4.4); fC.uniforms.tile.value.set(5, 8);
  addRun(-3.0, -0.26, fA, true); addRun(0.26, 2.0, fB, true); addRun(2.2, 7.4, fC, true); addRun(-0.26, 0.26, fA, false); addRun(2.0, 2.2, fB, false); addRun(7.4, 136, fC, false);
  { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI), frost); cap.position.set(-3.0, HY, CZ); cap.rotation.y = -Math.PI / 2; cap.scale.z = 0.6; scene.add(cap); }
  // a flanged tee in the middle, an elbow at the backup's riser, a long line away to the rocket
  const jg = (x) => { const c = new THREE.CylinderGeometry(0.42, 0.42, 0.07, 32).rotateZ(Math.PI / 2); const m = new THREE.Mesh(c, steel); m.position.set(x, HY, CZ); m.castShadow = true; scene.add(m); };
  [-3.0, -0.26, 0.26, 2.0, 2.2, 7.4].forEach(jg);
  // the line runs on, on steel trestles, into the rain
  const treM = metalOf(0x2c2e32, 0.5, 0.8);
  for (let i = 0; i < 16; i++) { const x = 9 + i * 8.2; scene.add(mesh(new THREE.BoxGeometry(0.2, HY, 0.2), treM, x, HY / 2 - 0.2, CZ - 0.5), mesh(new THREE.BoxGeometry(0.2, HY, 0.2), treM, x, HY / 2 - 0.2, CZ + 0.5), mesh(new THREE.BoxGeometry(0.3, 0.16, 1.3), treM, x, HY - 0.42, CZ)); }
  // icicles under the line and the risers: the only thing here that isn't moving
  { const ri = rng(808), n = 46, ic = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({color: 0xd6e4f2, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.5}), n), Mi = new THREE.Matrix4(), Ri = new THREE.Matrix4().makeRotationX(Math.PI), Si = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const L = 0.03 + Math.pow(ri(), 3) * 0.2, W = 0.004 + L * 0.05, x = -3 + ri() * 22, z = CZ + (ri() - 0.5) * 0.36; Si.makeScale(W, L, W); Mi.copy(Ri).multiply(Si); Mi.setPosition(x, HY - 0.33 - L / 2, z); ic.setMatrixAt(i, Mi); }
    ic.castShadow = true; scene.add(ic); }
  // hoar frost: small crystals standing on the cold metal, so its edges are not smooth
  { const rf = rng(909), N = 26000, im = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshStandardMaterial({color: 0xd2deec, roughness: 0.5, metalness: 0, flatShading: true}), N), Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const u = rf(); let x, y, z;
      if (u < 0.55) { let a; do { a = rf() * 6.283 - Math.PI; } while (Math.abs(a - 0.3) < 1.12 && rf() < 0.98); const cr = 0.345 + rf() * 0.012; x = -3 + rf() * 14; y = HY + Math.sin(a) * cr; z = CZ + Math.cos(a) * cr; }
      else if (u < 0.75) { const sd = rf() < 0.5 ? -2.1 : 2.1, a = rf() * 6.283; x = sd + Math.cos(a) * 0.195; z = CZ + Math.sin(a) * 0.195; y = CY + R + 0.15 + rf() * 0.95; }
      else if (u < 0.92) { const sd = rf() < 0.5 ? -2.1 : 2.1, a = rf() * 6.283, zz = rf(); x = sd + Math.cos(a) * (R + 0.095); y = CY + Math.sin(a) * (R + 0.095); z = CZ - 0.22 + zz * 0.44; }
      else { x = -10 + rf() * 16; const a = rf() * 6.283; y = CY - R - 0.6 + Math.sin(a) * 0.275; z = CZ + Math.cos(a) * 0.275; }
      const sz = 0.0016 + Math.pow(rf(), 3) * 0.0052; E.set(rf() * 6, rf() * 6, rf() * 6); Q.setFromEuler(E); P.set(x, y, z); Sc.set(sz, sz * (1 + rf() * 1.6), sz); Mx.compose(P, Q, Sc); im.setMatrixAt(i, Mx);
    }
    im.frustumCulled = false; scene.add(im); }
  // the suction main under both pumps, in from the storage sphere off to the left
  const suct = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 40, 28, 1, true).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({map: frostSkin(621, [24, 2]), bumpMap: frostBump(623, [24, 2]), bumpScale: 1.3, roughness: 0.84})); suct.position.set(-15.2, CY - R - 0.6, CZ); suct.castShadow = true; scene.add(suct);
  // behind them, at true size in the rain: the tower and the rocket's foot
  const rocket = new THREE.Group(); rocket.position.set(152, 0, -26); scene.add(rocket);
  rocket.add(makeTower()); const sat = makeSaturn(); sat.position.y = 14.3 + 3; rocket.add(sat);
  rocket.rotation.y = 2.5;
  // xenon floods on the rocket, far off
  const xe = new THREE.SpotLight(0xcfdcf2, 1500, 260, 0.5, 0.9, 1.6); xe.position.set(96, 2, -6); xe.target.position.set(152, 44, -26); scene.add(xe, xe.target);
  // the light: tungsten over the skid, grey sky over all
  scene.add(new THREE.HemisphereLight(0x93a1b4, 0x20201e, 0.1));
  const warm = new THREE.SpotLight(0xffb468, 6, 26, 0.7, 0.9, 1.7); warm.position.set(11, 2.4, 6.5); warm.target.position.set(1, 1.2, 0.6); scene.add(warm, warm.target);
  const back = new THREE.SpotLight(0xbcd2f0, 330, 40, 0.75, 0.8, 1.6); back.position.set(3.5, 11, -9); back.target.position.set(0.5, 1.8, 0.6); scene.add(back, back.target);
  const lamp = new THREE.SpotLight(0xd7e2f2, 185, 34, 0.62, 0.8, 1.7); lamp.position.set(-7.5, 9.5, 5.4); lamp.target.position.set(0.8, 1, 0.5); scene.add(lamp, lamp.target);
  lamp.castShadow = true; lamp.shadow.mapSize.set(4096, 4096); lamp.shadow.camera.near = 2; lamp.shadow.camera.far = 30; lamp.shadow.bias = -0.0004; lamp.shadow.radius = 3;
  const blue = new THREE.PointLight(0x8fb8e8, 0.42, 1.2, 1.6), blue2 = blue.clone(); blue.position.set(-2.1, CY + 0.2, CZ + 0.16); blue2.position.set(2.1, CY + 0.2, CZ + 0.16); scene.add(blue, blue2);
  // vapour rolling off the cold metal, sinking
  const vG = new THREE.Group(); scene.add(vG);
  const vap = makePuffs(vG, 250, 7);
  const rain = makeRain(scene, 3000, 303, [26, 16, 26], 0.3, [0.55, 0.6, 0.68], 0.055);
  // the speed of a stopping pump, and how far it has turned: a closed form, so any frame stands alone
  const W0 = 0.13, TAU = 46;
  const run = (f) => (f <= STOP ? 1 : Math.exp(-(f - STOP) / TAU));
  const ang = (f) => (f <= STOP ? W0 * f : W0 * STOP + W0 * TAU * (1 - Math.exp(-(f - STOP) / TAU)));
  return {draw: (f) => {
    const ra = run(f);
    A.userData.imp.rotation.z = -ang(f); B.userData.imp.rotation.z = -W0 * f + 0.4;
    A.userData.swirl.uniforms.ang.value = -ang(f) * 0.7; A.userData.swirl.uniforms.run.value = ra;
    B.userData.swirl.uniforms.ang.value = -W0 * f * 0.7; B.userData.swirl.uniforms.run.value = 1;
    fA.uniforms.pos.value = ang(f) * 0.42; fA.uniforms.run.value = ra;
    fB.uniforms.pos.value = W0 * f * 0.42; fC.uniforms.pos.value = W0 * f * 0.72;
    blue.intensity = 0.42 * (0.2 + 0.8 * ra); blue2.intensity = 0.42;
    // lamps
    A.userData.green.color.setRGB(0.02, f < STOP ? 1.6 : 0.02, 0.05); A.userData.gl.intensity = f < STOP ? 0.05 : 0;
    const trip = f >= STOP + 3 ? (Math.floor((f - STOP) / 14) % 2 === 0 ? 1 : 0.25) : 0;
    A.userData.red.color.setRGB(0.02 + trip * 3.4, 0.01, 0.01); A.userData.rl.intensity = trip * 0.55;
    B.userData.green.color.setRGB(0.02, 1.6, 0.05); B.userData.gl.intensity = 0.05; B.userData.red.color.setRGB(0.02, 0.01, 0.01); B.userData.rl.intensity = 0;
    // one slow move: both pumps, and when the left dies, along to the one left running
    const k = ease((f - 165) / 170), dr = ease(f / 360);
    camera.position.set(lerp(-6.0, -1.0, k), lerp(1.0, 1.05, k) + 0.1 * dr, lerp(6.1, 3.5, k));
    camera.lookAt(lerp(2.2, 3.0, k), lerp(2.15, 1.85, k), lerp(0.4, 0.6, k)); camera.fov = 36; camera.up.set(0.015, 1, 0);
    rain(f, camera.position.x, 7, camera.position.z - 8, 0.3);
    vap.forEach(({s, m, a, b, c, d}, i) => {
      const life = 80 + a * 110, t = ((f * (0.7 + b * 0.5) + d * 900) % life) / life;
      let x0, y0, z0, side;
      if (i % 3 === 0) { side = c < 0.5 ? -1 : 1; x0 = side * 2.1 + (b - 0.5) * 1.9; y0 = CY - R - 0.2 + b * 0.4; z0 = CZ + (a - 0.5) * 0.7; }
      else if (i % 3 === 1) { x0 = -3.0 + c * 11.6; y0 = HY - 0.3; z0 = CZ + (d - 0.5) * 0.5 + 0.15; side = x0 < 0 ? -1 : 1; }
      else { x0 = -6 + c * 12; y0 = CY - R - 0.62; z0 = CZ + (d - 0.5) * 0.5; side = x0 < 0 ? -1 : 1; }
      const fall = i % 3 === 1 ? 2.2 : 0.55;
      s.position.set(x0 + t * 0.6 + Math.sin(t * 5 + a * 6) * 0.08, Math.max(0.12, y0 - t * fall), z0 + t * 0.35);
      const sc = 0.32 + t * 1.5 + b * 0.35; s.scale.set(sc, sc, 1); m.rotation = a * 6 + t * 1.2 * (b - 0.5);
      let op = Math.sin(Math.pow(t, 0.6) * Math.PI) * (0.08 + c * 0.15);
      if (side < 0) op *= 0.25 + 0.75 * clamp(1 - (f - STOP - 30) / 120);
      m.opacity = op; m.color.setRGB(0.4, 0.45, 0.52);
    });
  }};
});

// ---------------------------------------------------------------------------------------------------------------------
// ATLASCENTAUR: a reconstruction seen from far off, for a line about flight 67. In cloud, a flash at 5.0 s, the slew, the break-up at 8.0 s. No people, no pad.
// ---------------------------------------------------------------------------------------------------------------------
const ACPROFILE = [[2.45, 0], [2.45, 2.6], [1.525, 5.6], [1.525, 22], [1.525, 31], [1.68, 32.2], [1.68, 37.8], [1.2, 40.6], [0.5, 42.4], [0, 42.8]];
const atlasSkin = () => {
  const [c, g] = canvas(2048, 4096), Y = (m) => 4096 - (m / 43) * 4096;
  g.fillStyle = '#c9c9c2'; g.fillRect(0, 0, 2048, 4096);
  for (let i = 0; i < 28; i++) { g.fillStyle = `rgba(90,90,90,${0.1 + (i % 3) * 0.05})`; g.fillRect(0, Y(5.6 + i * 0.6), 2048, 3); }
  g.fillStyle = '#e8e7e0'; g.fillRect(0, Y(31), 2048, Y(22.2) - Y(31));             // Centaur's white panels
  g.fillStyle = '#1b1c1f'; g.fillRect(0, Y(22.4), 2048, 14); g.fillRect(0, Y(31.1), 2048, 10);
  g.fillStyle = '#efeee8'; g.fillRect(0, Y(43), 2048, Y(31.2) - Y(43));
  g.fillStyle = '#26272a'; g.fillRect(0, Y(2.6), 2048, 10);
  for (let i = 0; i < 4; i++) { g.fillStyle = '#2a2b2e'; g.fillRect(i * 512 + 40, Y(21), 18, Y(6) - Y(21)); }
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
};
const shellPiece = (y0, y1, r0, r1, tS, tL, mat) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 20, 3, true, tS, tL); const m = new THREE.Mesh(g, mat); m.position.y = (y0 + y1) / 2; const p = new THREE.Group(); p.add(m); return p; };
export const AtlasCentaur = () => useScene((e) => {
  const {scene, camera, cloud, glow} = e; range(camera, 3, 20000);
  cloud.noise.value = softNoise(); cloud.base.value = 300; cloud.top.value = 6500; cloud.cover.value = 0.445; cloud.thick.value = 0.36; cloud.scale.value = 0.00078; cloud.far_.value = 3000; cloud.near_.value = 470; cloud.flame.value = 0.35; cloud.fine.value = 2.7;
  e.skyHi.set(0.135, 0.155, 0.2); e.skyLo.set(0.03, 0.035, 0.046);
  e.final.bloom.value = 0.55; e.final.exposure.value = 1.05;
  envFrom(e, [0.26, 0.29, 0.36], [0.04, 0.045, 0.05], []);
  const skin = atlasSkin(), hullM = new THREE.MeshStandardMaterial({map: skin, roughness: 0.42, metalness: 0.35, side: THREE.DoubleSide});
  const rocket = new THREE.Group(); scene.add(rocket);
  const lat = new THREE.LatheGeometry(ACPROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 56); { const uv = lat.attributes.uv, p = lat.attributes.position; for (let i = 0; i < uv.count; i++) uv.setY(i, p.getY(i) / 43); }
  rocket.add(new THREE.Mesh(lat, hullM));
  const bell = (r, L) => { const pts = []; for (let k = 0; k <= 12; k++) { const v = k / 12; pts.push(new THREE.Vector2(0.28 + r * Math.pow(v, 0.6), -v * L)); } return new THREE.LatheGeometry(pts, 24); };
  const bellM = new THREE.MeshStandardMaterial({color: 0x2e2c2a, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide, emissive: 0x622710, emissiveIntensity: 1});
  const engines = new THREE.Group(); rocket.add(engines);
  [[1.5, 0], [-1.5, 0], [0, 0]].forEach(([x, z], i) => { const b = new THREE.Mesh(bell(i < 2 ? 0.55 : 0.42, i < 2 ? 2.4 : 2.0), bellM); b.position.set(x, 0, z); engines.add(b); });
  const flame = makeFlame(); flame.scale.set(0.2, 0.24, 0.2); glow.add(flame);
  scene.add(new THREE.HemisphereLight(0x9aa8bc, 0x1c1814, 0.5));
  const key = new THREE.DirectionalLight(0xbac8da, 3.2); key.position.set(-300, 90, 260); scene.add(key);
  const strike = new THREE.DirectionalLight(0xdfe8ff, 0); scene.add(strike);
  const fire = new THREE.PointLight(0xff7a2a, 1500, 120, 1.8); scene.add(fire);
  const F0 = 150, F1 = 240, V = 9.4, Y0 = 2600;
  // the rocket's place: a straight climb, then the false command swings it sideways
  const slew = (f) => (f < F0 + 12 ? 0 : 0.86 * ease((f - F0 - 12) / (F1 - F0 - 12)));
  const pathX = (f) => { if (f < F0 + 12) return 0; const d = Math.min(f, F1) - F0 - 12, D = F1 - F0 - 12; return 92 * Math.pow(d / D, 2.2); };
  const pathY = (f) => Y0 + Math.min(f, F1) * V - pathX(f) * 0.25;
  const by = pathY(F0);
  const top = makeBolt([new THREE.Vector3(-260, by + 1700, -220), new THREE.Vector3(-70, by + 720, -40), new THREE.Vector3(0, by + 44, 0)], 67, 0.2);
  const bot = makeBolt([new THREE.Vector3(0, by - 2, 0), new THREE.Vector3(60, by - 560, 30), new THREE.Vector3(220, by - 1500, -120)], 87, 0.19);
  glow.add(top, bot);
  // the pieces after the break: hull sections, the fairing halves, then scraps
  const rr = rng(1987), pieces = [];
  const tornC = (() => { const [c, g] = canvas(1024, 1024), q = rng(1988); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 90; i++) { g.fillStyle = '#000000'; g.beginPath(); const x = q() * 1024, y = q() * 1024, R = 18 + q() * q() * 120, n = 9; for (let k = 0; k < n; k++) { const a = (k / n) * 6.283, rr2 = R * (0.45 + q() * 0.9); g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } g.closePath(); g.fill(); } return tex(c, false); })();
  const tornM = new THREE.MeshStandardMaterial({map: skin, color: 0x77726c, alphaMap: tornC, alphaTest: 0.5, roughness: 0.58, metalness: 0.3, side: THREE.DoubleSide});
  const addP = (o, off, vx, vy, vz, wx, wy, wz) => { o.visible = false; scene.add(o); pieces.push({o, off, vx, vy, vz, wx, wy, wz}); };
  const lower = shellPiece(0, 13, 1.525, 1.525, 0, 6.283, tornM); const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.525, 2.45, 5.6, 28, 1, true), tornM); skirt.position.y = 2.8; lower.add(skirt);
  addP(lower, 0, -1.6, 4.1, 1, 0.012, 0.003, 0.038);
  addP(shellPiece(13, 22, 1.525, 1.525, 0, 5.1, tornM), 13, 0.4, 4.8, -0.9, -0.03, 0.01, -0.044);
  addP(shellPiece(22, 31, 1.525, 1.525, 0.7, 4.6, tornM), 22, 2.6, 5.4, 0.8, 0.02, 0.02, -0.07);
  addP(shellPiece(31, 38, 1.68, 1.68, 0, 3.14, tornM), 31, 4.8, 5.2, 2.2, 0.05, -0.03, -0.09);
  addP(shellPiece(31, 38, 1.68, 1.68, 3.14, 3.14, tornM), 31, 4.3, 6.0, -1.8, -0.06, 0.04, -0.1);
  const scrapM = new THREE.MeshStandardMaterial({color: 0x6c6c68, roughness: 0.62, metalness: 0.4, side: THREE.DoubleSide});
  for (let i = 0; i < 70; i++) { const w = 0.2 + rr() * rr() * 1.5, h = 0.2 + rr() * rr() * 2.1, sc = new THREE.Mesh(new THREE.PlaneGeometry(w, h), scrapM); addP(sc, rr() * 38, (rr() - 0.3) * 7.5, 2.8 + rr() * 4.2, (rr() - 0.5) * 5, (rr() - 0.5) * 0.3, (rr() - 0.5) * 0.3, (rr() - 0.5) * 0.3); }
  const fbG = new THREE.Group(); glow.add(fbG); const fball = makePuffs(fbG, 90, 19, true);
  const smG = new THREE.Group(); glow.add(smG); const smoke = makePuffs(smG, 70, 29);
  const trG = new THREE.Group(); glow.add(trG); const trails = makePuffs(trG, 180, 47);
  const posOf = (P, d, out) => { const q = (1 - Math.exp(-d * 0.028)) / 0.028, a = -slew(F1), ox = Math.sin(-a) * P.off, oy = Math.cos(a) * P.off; out.set(pathX(F1) + ox + P.vx * q, pathY(F1) + oy + V * 0.3 * q + P.vy * q - 0.0055 * d * d, P.vz * q); return out; };
  const tmpV = new THREE.Vector3();
  return {draw: (f) => {
    const px = pathX(f), py = pathY(f), broke = f >= F1, d = f - F1;
    rocket.visible = !broke;
    rocket.position.set(px, py, 0); rocket.rotation.z = -slew(f); rocket.rotation.y = f * 0.002;
    flame.visible = !broke; flame.userData.tick(f / 30);
    flame.position.set(px, py, 0); flame.rotation.z = -slew(f);
    fire.position.set(px, py - 8, 0); fire.intensity = broke ? 0 : 1500;
    const cxW = broke ? pathX(F1) + 4 * d * 0.36 : px, cyW = broke ? pathY(F1) + 5 * (1 - Math.exp(-d * 0.03)) / 0.03 - 0.0035 * d * d : py;
    // far off and long: the camera tracks it, and stops chasing when it goes
    const qC = broke ? (1 - Math.exp(-d * 0.028)) / 0.028 : 0, camY = Y0 + Math.min(f, F1) * V - 30 + (broke ? (V * 0.3 + 3.6) * qC - 0.0042 * d * d : 0);
    const fl = flashAt(f, F0), sh = fl * 3;
    camera.position.set(-360 + f * 0.1 + Math.sin(f * 17.3) * sh, camY + Math.cos(f * 13.1) * sh, 410 - f * 0.15);
    camera.lookAt(lerp(10, 44, ease((f - F0) / 90)) + (broke ? qC * 1.5 : 0), camY + 44, 0); camera.fov = 22; camera.up.set(0, 1, 0);
    top.userData.update(camera, fl > 0.6 ? fl * 0.8 : fl * 0.22); bot.userData.update(camera, fl > 0.6 ? fl * 0.8 : fl * 0.22);
    strike.intensity = fl * 5; strike.position.set(-200, py + 400, 300);
    const boom = broke ? Math.exp(-d * 0.055) : 0, boomFlash = broke && d < 4 ? 1 : 0;
    cloud.flash.value = Math.max(fl * 0.42, boomFlash * 0.08); e.common.flash.value = fl * 0.36;
    cloud.boltA.value.set(-30, by + 720, -40); cloud.boltB.value.set(170, by - 1500, -120);
    cloud.flameA.value.set(broke ? cxW : px, (broke ? cyW : py) + (broke ? 30 : -8), 0); cloud.flameB.value.set(broke ? cxW : px, (broke ? cyW : py) - (broke ? 30 : 60), 0);
    cloud.flame.value = broke ? 0.35 + boom * 1.3 : 0.35;
    cloud.wind.value.set(f * 0.0008, -f * 0.0009 + 0.4, f * 0.0003);
    e.final.white.value = f === F0 ? 0.1 : (broke && d < 2 ? 0.05 : 0);
    pieces.forEach((P) => {
      P.o.visible = broke; if (!broke) return;
      const q = (1 - Math.exp(-d * 0.028)) / 0.028;
      const a = -slew(F1), ox = Math.sin(-a) * P.off, oy = Math.cos(a) * P.off;
      P.o.position.set(pathX(F1) + ox + P.vx * q, pathY(F1) + oy + V * 0.3 * q + P.vy * q - 0.0055 * d * d, P.vz * q);
      P.o.rotation.set(P.wx * d, P.wy * d, a + P.wz * d);
    });
    trails.forEach(({s, m, a, b, c}, i) => {
      const P = pieces[i % 5], u = (Math.floor(i / 5) + a * 0.7) / 36, born = -Math.log(1 - u * (1 - Math.exp(-0.028 * 130))) / 0.028, age = d - born; if (!broke || age < 0) { m.opacity = 0; return; }
      posOf(P, born, tmpV); s.position.set(tmpV.x + (b - 0.5) * (1.5 + age * 0.12), tmpV.y + (c - 0.5) * (1.5 + age * 0.12) + age * 0.05, tmpV.z);
      const sc = 11 + age * 0.3 + a * 5; s.scale.set(sc, sc, 1); m.rotation = a * 6;
      m.opacity = Math.min(1, age / 3) * Math.exp(-age * 0.012) * 0.3; const hot = Math.exp(-age * 0.3); m.color.setRGB(0.03 + hot * 1.6, 0.028 + hot * 0.6, 0.03 + hot * 0.1);
    });
    fball.forEach(({s, m, a, b, c, d: dd}, i) => {
      const dl = i * 0.22; if (!broke || d < dl) { m.opacity = 0; return; }
      const age = d - dl, off = a * 40, q = (1 - Math.exp(-age * 0.045)) / 0.045;
      { const qp = (1 - Math.exp(-d * 0.028)) / 0.028; s.position.set(pathX(F1) + Math.sin(0.86) * off + (b - 0.5) * q * 2.6 + qp * 2.2, pathY(F1) + Math.cos(0.86) * off + (c - 0.5) * q * 2.4 + qp * (V * 0.3 + 4.6) - 0.0055 * d * d, (dd - 0.5) * q * 2); }
      const sc = 8 + q * (0.34 + a * 0.5); s.scale.set(sc, sc, 1); m.rotation = a * 6 + age * 0.008;
      const hot = Math.exp(-age * 0.07);
      m.opacity = Math.min(1, age / 2) * Math.exp(-age * 0.05) * 0.3;
      m.color.setRGB(7 * hot + 0.34, 2.7 * hot + 0.07, 0.5 * hot + 0.008);
    });
    smoke.forEach(({s, m, a, b, c, d: dd}, i) => {
      const dl = 3 + i * 0.32; if (!broke || d < dl) { m.opacity = 0; return; }
      const age = d - dl, off = a * 40, q = (1 - Math.exp(-age * 0.028)) / 0.028;
      { const qp = (1 - Math.exp(-d * 0.028)) / 0.028; s.position.set(pathX(F1) + Math.sin(0.86) * off + (b - 0.5) * q * 1.9 + qp * 1.8, pathY(F1) + Math.cos(0.86) * off + (c - 0.5) * q * 1.7 + qp * (V * 0.3 + 4.0) - 0.004 * d * d, (dd - 0.5) * q * 1.6); }
      const sc = 6 + q * 0.42; s.scale.set(sc, sc, 1); m.rotation = a * 6;
      m.opacity = Math.min(0.42, age / 26) * (0.5 + c * 0.5); m.color.setRGB(0.028, 0.027, 0.03);
    });
  }};
});

// ---------------------------------------------------------------------------------------------------------------------
// SURVEYOR535: the Ocean of Storms in true metres. Surveyor III (3 m) sits on the 12-degree inner slope of Surveyor crater (200 m across); the lunar module (7 m) stands
// on the crater's northwest rim, 163 m away, by the Mission Report's numbers; Head crater (150 m) lies to the southwest. x = east, z = south. Black sky, low sun in the east.
// The camera starts by Surveyor's side at eye height with the LM on the skyline, and rises until both are in one frame.
// ---------------------------------------------------------------------------------------------------------------------
const craterProfile = (r, D, rim, w = 0.28) => {
  if (r >= 2.6) return 0;
  const q = (r - 1.02) / w;
  return -D * Math.exp(-1.8 * r * r) + rim * Math.exp(-q * q);
};
// a young bowl: round, a clear lip, then ejecta falling away
const freshProfile = (r, D, rim) => (r >= 2.4 ? 0 : (r < 1 ? -D * (1 - r * r) + rim * r * r * r * r : rim * Math.pow(Math.max(0, 1 - (r - 1) / 1.4), 3)));
const makeMoon = () => {
  const SV = {x: 38.9, z: 38.9}, LM = {x: -76.4, z: -76.4}, C0 = {x: -19, z: -19};
  const SZ = 560, N = 1120, step = SZ / N, x0 = C0.x - SZ / 2, z0 = C0.z - SZ / 2;
  const FS = 5200, FN = 520, fstep = FS / FN, fx0 = C0.x - FS / 2, fz0 = C0.z - FS / 2;
  const H = new Float32Array((N + 1) * (N + 1)), FH = new Float32Array((FN + 1) * (FN + 1));
  const r = rng(1969);
  // value noise for long rolling ground
  const G = 256, grid = new Float32Array(G * G); for (let i = 0; i < G * G; i++) grid[i] = r();
  const vn = (x, z) => { const fx = ((x % G) + G) % G, fz = ((z % G) + G) % G, ix = Math.floor(fx), iz = Math.floor(fz), a = fx - ix, b = fz - iz, u = a * a * (3 - 2 * a), v = b * b * (3 - 2 * b); const g = (i, j) => grid[((iz + j) % G) * G + ((ix + i) % G)]; return (g(0, 0) * (1 - u) + g(1, 0) * u) * (1 - v) + (g(0, 1) * (1 - u) + g(1, 1) * u) * v; };
  const roll = (x, z) => (vn(x / 90, z / 90) - 0.5) * 2.6 + (vn(x / 31 + 40, z / 31) - 0.5) * 0.55 + (vn(x / 11, z / 11 + 70) - 0.5) * 0.14 + (vn(x / 3.7 + 9, z / 3.7) - 0.5) * 0.07 + (vn(x / 1.3, z / 1.3 + 30) - 0.5) * 0.04;
  for (let j = 0, i = 0; j <= N; j++) for (let k = 0; k <= N; k++, i++) H[i] = roll(x0 + k * step, z0 + j * step);
  for (let j = 0, i = 0; j <= FN; j++) for (let k = 0; k <= FN; k++, i++) FH[i] = roll(fx0 + k * fstep, fz0 + j * fstep);
  const stampFresh = (arr, n, st, ox, oz, cx, cz, R, D, rim, ph) => {
    const ext = R * 2.4, a0 = Math.max(0, Math.floor((cx - ext - ox) / st)), a1 = Math.min(n, Math.ceil((cx + ext - ox) / st)), b0 = Math.max(0, Math.floor((cz - ext - oz) / st)), b1 = Math.min(n, Math.ceil((cz + ext - oz) / st));
    for (let j = b0; j <= b1; j++) for (let k = a0; k <= a1; k++) { const dx = ox + k * st - cx, dz = oz + j * st - cz, th = Math.atan2(dz, dx), o = 1 + 0.018 * Math.sin(th * 3 + ph) + 0.012 * Math.sin(th * 5 + ph * 1.7); arr[j * (n + 1) + k] += freshProfile((Math.sqrt(dx * dx + dz * dz) / R) * o, D, rim); }
  };
  const stamp = (arr, n, st, ox, oz, cx, cz, R, D, rim, ph = 0, wob = 0.05, w = 0.28) => {
    const ext = R * 2.6, a0 = Math.max(0, Math.floor((cx - ext - ox) / st)), a1 = Math.min(n, Math.ceil((cx + ext - ox) / st)), b0 = Math.max(0, Math.floor((cz - ext - oz) / st)), b1 = Math.min(n, Math.ceil((cz + ext - oz) / st));
    for (let j = b0; j <= b1; j++) for (let k = a0; k <= a1; k++) { const dx = ox + k * st - cx, dz = oz + j * st - cz, th = Math.atan2(dz, dx), o = 1 + wob * Math.sin(th * 2 + ph) + wob * 0.8 * Math.sin(th * 3 + ph * 1.7) + wob * 0.45 * Math.sin(th * 7 + ph * 2.9); arr[j * (n + 1) + k] += craterProfile((Math.sqrt(dx * dx + dz * dz) / R) * o, D, rim, w); }
  };
  const near = (x, z, list, R) => list.some(([a, b, q]) => (a - x) * (a - x) + (b - z) * (b - z) < (q + R * 1.3) * (q + R * 1.3));
  const keep = [[SV.x, SV.z, 11], [LM.x, LM.z, 15], [SV.x + 12, SV.z + 12, 10]];
  const big = [[0, 0, 100, 18.5, 1.1], [-129.4, -23.4, 75, 13, 0.9]];                    // Surveyor crater and Head crater, from the Mission Report's traverse map
  // Bench crater (about 50 m) to the south, and the ray-littered plain beyond
  big.push([26, 158, 26, 6, 0.5], [-205, -150, 44, 8, 0.6], [168, -44, 58, 10, 0.7], [-60, 196, 34, 6, 0.5], [160, 150, 30, 6, 0.4], [-250, 70, 22, 4.5, 0.4], [70, -210, 40, 7, 0.5], [-140, -240, 24, 4.5, 0.4]);
  for (let i = 0; i < 90; i++) { const x = C0.x + (r() - 0.5) * FS, z = C0.z + (r() - 0.5) * FS, R = 22 + r() * r() * 190; if (Math.hypot(x - C0.x, z - C0.z) > 300) big.push([x, z, R, R * 0.17, R * 0.01]); }
  big.forEach(([x, z, R, D, rim], i) => { stamp(FH, FN, fstep, fx0, fz0, x, z, R, D, rim, i * 2.1, i < 2 ? 0.015 : 0.04); stamp(H, N, step, x0, z0, x, z, R, D, rim, i * 2.1, i < 2 ? 0.015 : 0.04); });
  // the size law of a settled surface: N(>D) falls as 1/D^2, from a metre and a half to forty metres; most are old and soft, about one in six is young
  const list = [];
  for (let i = 0; i < 2100; i++) {
    const x = C0.x + (r() - 0.5) * SZ, z = C0.z + (r() - 0.5) * SZ, Dm = Math.min(40, 1.5 / Math.sqrt(Math.max(0.0014, r()))), R = Dm / 2;
    if (near(x, z, keep, R)) continue;
    const young = r() < 0.17;
    if (young) stampFresh(H, N, step, x0, z0, x, z, R, Dm * (0.13 + r() * 0.07), Dm * (0.02 + r() * 0.018), r() * 6);
    else stamp(H, N, step, x0, z0, x, z, R, Dm * (0.04 + r() * 0.05), Dm * 0.004, r() * 6, 0.02, 0.3);
    list.push([x, z, R, young]);
  }
  const hAt = (x, z) => { const fx = (x - x0) / step, fz = (z - z0) / step; if (fx < 0 || fz < 0 || fx >= N || fz >= N) return 0; const k = Math.floor(fx), j = Math.floor(fz), a = fx - k, b = fz - j, w = N + 1; return (H[j * w + k] * (1 - a) + H[j * w + k + 1] * a) * (1 - b) + (H[(j + 1) * w + k] * (1 - a) + H[(j + 1) * w + k + 1] * a) * b; };
  return {SV, LM, C0, SZ, N, step, x0, z0, FS, FN, fstep, fx0, fz0, H, FH, hAt, rng: r, list};
};
const lunarGrid = (M, arr, n, st, ox, oz, sun, proxies, drop = 0, albedo = null, hole = null) => {
  const V = (n + 1) * (n + 1), pos = new Float32Array(V * 3), col = new Float32Array(V * 3), uv = new Float32Array(V * 2), idx = new Uint32Array(n * n * 6);
  const w = n + 1, sx = sun.x, sy = sun.y, sz = sun.z, hor = Math.hypot(sx, sz), dx = sx / hor, dz = sz / hor, slope = sy / hor;
  const sample = (x, z) => { const fx = (x - ox) / st, fz = (z - oz) / st; if (fx < 0 || fz < 0 || fx >= n || fz >= n) return -1e6; const k = Math.floor(fx), j = Math.floor(fz), a = fx - k, b = fz - j; return (arr[j * w + k] * (1 - a) + arr[j * w + k + 1] * a) * (1 - b) + (arr[(j + 1) * w + k] * (1 - a) + arr[(j + 1) * w + k + 1] * a) * b; };
  const rnd = rng(77);
  for (let j = 0, i = 0; j <= n; j++) for (let k = 0; k <= n; k++, i++) {
    const x = ox + k * st, z = oz + j * st, y = arr[i] - drop - (x * x + z * z) / (2 * 1737000);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; uv[i * 2] = x / 7; uv[i * 2 + 1] = z / 7;
    // the sun's shadow, marched over the height field: a clearance gives a soft edge the width of a grid cell
    let lit = 1, d = st * 1.5, clear = 1e6;
    for (let q = 0; q < 110 && lit > 0; q++) { const h = sample(x + dx * d, z + dz * d); if (h < -1e5) break; const c = arr[i] + d * slope - h; if (c < clear) clear = c; if (clear < 0) { lit = 0; break; } d += st * (1 + q * 0.09); }
    lit = Math.min(1, Math.max(0, clear / (st * 0.5)));
    // tall things' shadows on the ground, far from the sharper shadow map
    for (const [px, pz, R, top] of proxies) { const ax = x - px, az = z - pz, t = ax * dx + az * dz; if (t < 0) { const dist = Math.hypot(ax - dx * t, az - dz * t); const hgt = arr[i] - t * -slope * -1; if (dist < R && -t * slope < top) lit = Math.min(lit, Math.min(1, (dist / R) * 0.25)); } }
    const g = 0.84 + (albedo ? albedo(x, z) : 0);
    const v = (0.02 + lit * 0.98) * g;
    col[i * 3] = v; col[i * 3 + 1] = v * 0.995; col[i * 3 + 2] = v * 0.985;
  }
  let q = 0;
  for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    if (hole) { const cx = ox + (k + 0.5) * st, cz = oz + (j + 0.5) * st; if (cx > hole[0] && cx < hole[1] && cz > hole[2] && cz < hole[3]) continue; }
    const a = j * w + k, b = a + 1, c = a + w, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx.subarray(0, q), 1)); g.computeVertexNormals();
  return g;
};
const regolithTextures = () => {
  const [c, g] = canvas(2048, 2048); g.fillStyle = '#8b8b8a'; g.fillRect(0, 0, 2048, 2048);
  blotches(g, 2048, 2048, 201, 500, 20, 220, '58,58,58', 0.22); blotches(g, 2048, 2048, 202, 300, 12, 140, '190,190,188', 0.13);
  speckle(g, 2048, 2048, 203, 170000, ['rgba(40,38,36,0.38)', 'rgba(210,206,198,0.3)', 'rgba(110,106,100,0.3)'], 1, 3.6);
  const [b, h] = canvas(2048, 2048); h.fillStyle = '#808080'; h.fillRect(0, 0, 2048, 2048);
  const r = rng(204);
  for (let i = 0; i < 1500; i++) { const x = r() * 2048, y = r() * 2048, R = 4 + r() * r() * r() * 70; const gr = h.createRadialGradient(x, y, R * 0.25, x, y, R); gr.addColorStop(0, 'rgba(30,30,30,0.5)'); gr.addColorStop(0.72, 'rgba(70,70,70,0.25)'); gr.addColorStop(0.88, 'rgba(210,210,210,0.34)'); gr.addColorStop(1, 'rgba(128,128,128,0)'); h.fillStyle = gr; h.fillRect(x - R, y - R, R * 2, R * 2); }
  speckle(h, 2048, 2048, 205, 300000, ['#5a5a5a', '#a8a8a8', '#747474', '#909090'], 1, 3.5);
  const t = tex(c), bm = tex(b, false); t.wrapS = t.wrapT = bm.wrapS = bm.wrapT = THREE.RepeatWrapping;
  return {t, bm};
};
// the lunar module: gold foil below, faceted silver above; true sizes
const makeLM = () => {
  const g = new THREE.Group();
  const foilC = (() => { const [c, cg] = canvas(1024, 512), r = rng(12); cg.fillStyle = '#b8862e'; cg.fillRect(0, 0, 1024, 512); for (let i = 0; i < 500; i++) { cg.fillStyle = `rgba(${r() > 0.5 ? '255,214,120' : '70,40,10'},${r() * 0.34})`; const w = 20 + r() * 110, h = 10 + r() * 70; cg.save(); cg.translate(r() * 1024, r() * 512); cg.rotate((r() - 0.5) * 0.9); cg.fillRect(-w / 2, -h / 2, w, h); cg.restore(); } return tex(c); })();
  const gold = new THREE.MeshStandardMaterial({map: foilC, roughness: 0.3, metalness: 0.95, bumpMap: foilC, bumpScale: 2, flatShading: true});
  const steel = metalOf(0xbcbcb6, 0.45, 0.6), dark = metalOf(0x1b1b1d, 0.6, 0.4), silver = new THREE.MeshStandardMaterial({color: 0xa8a8a2, roughness: 0.52, metalness: 0.6, flatShading: true}), black = new THREE.MeshStandardMaterial({color: 0x1a1a1c, roughness: 0.7, metalness: 0.2, flatShading: true});
  // legs and footpads
  const strut = (a, b, R, mat) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, d.length(), 10), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; g.add(m); };
  const S = 3.3 / Math.SQRT1_2 * 0.71;                      // footpad radius ~4.7 m: 9.4 m across
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, cx = Math.cos(a), cz = Math.sin(a), foot = new THREE.Vector3(cx * 4.7, 0.12, cz * 4.7);
    strut(foot, new THREE.Vector3(cx * 2.1, 2.4, cz * 2.1), 0.1, gold);
    const nx = -cz, nz = cx; [1, -1].forEach((s) => strut(foot.clone().add(new THREE.Vector3(0, 0.4, 0)), new THREE.Vector3(cx * 2.1 + nx * s * 1.4, 1.1, cz * 2.1 + nz * s * 1.4), 0.05, steel));
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.3, 0.2, 18), steel); pad.position.copy(foot); pad.castShadow = pad.receiveShadow = true; g.add(pad);
  }
  // descent stage: an octagon in foil
  const ds = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.7, 8), gold); ds.position.y = 2.1; ds.rotation.y = Math.PI / 8; ds.castShadow = true; g.add(ds);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 1.0, 20, 1, true), dark); bell.position.y = 0.9; g.add(bell);
  // ascent stage: facets and the two tanks at its side
  const as = new THREE.Group(); as.position.y = 3.0; g.add(as);
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; as.add(m); return m; };
  add(new THREE.CylinderGeometry(1.2, 1.2, 1.9, 8), silver, 0, 1.15, 0.25, Math.PI / 8);
  add(new THREE.CylinderGeometry(1.15, 0.8, 1.2, 6), silver, 0, 1.25, 1.25, 0.4);
  add(new THREE.BoxGeometry(2.8, 1.5, 1.2), silver, 0, 0.85, -1.05);
  add(new THREE.SphereGeometry(0.62, 10, 8), black, -1.72, 1.1, -0.2); add(new THREE.SphereGeometry(0.62, 10, 8), black, 1.72, 1.1, -0.2);
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 10), silver, 0, 2.2, 0.15);
  const win = new THREE.MeshStandardMaterial({color: 0x050505, roughness: 0.1, metalness: 0.9, flatShading: true});
  [-0.42, 0.42].forEach((x) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.44, 0); s.lineTo(0.08, 0.48); s.closePath(); const w = new THREE.Mesh(new THREE.ShapeGeometry(s), win); w.position.set(x + (x > 0 ? -0.26 : -0.18), 1.3, 1.85); w.scale.x = x > 0 ? -1 : 1; if (x > 0) w.position.x += 0.44; w.material.side = THREE.DoubleSide; as.add(w); });
  // RCS quads
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => { add(new THREE.BoxGeometry(0.34, 0.34, 0.34), dark, a * 1.75, 1.1, b * 1.35); [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]].forEach(([u, v]) => add(new THREE.ConeGeometry(0.1, 0.22, 10), dark, a * 1.75 + u, 1.1 + v, b * 1.35)); });
  // rendezvous antenna and S-band dish
  const dish = add(new THREE.SphereGeometry(0.42, 16, 8, 0, 6.283, 0, 1.0), steel, -0.75, 2.8, 0.2); dish.rotation.x = 2.3;
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), steel, -0.75, 2.5, 0.2);
  add(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 5), steel, 0.9, 2.5, -0.7);
  // the ladder down the forward leg
  for (let i = 0; i < 9; i++) { const y = 0.5 + i * 0.26, m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), steel); m.position.set(0, y, 2.55 + 1.8 - y * 0.82); m.castShadow = true; g.add(m); }
  return g;
};
// Surveyor III: tripod frame, mast with panel and planar antenna, three legs with crushable pads, the TV camera with its mirror hood; true sizes, dust-tanned as Conrad found it
const makeSurveyor = () => {
  const g = new THREE.Group();
  const al = new THREE.MeshStandardMaterial({color: 0x8a847a, roughness: 0.62, metalness: 0.55}), white = new THREE.MeshStandardMaterial({color: 0x6e6a60, roughness: 0.85, metalness: 0.05}), dark = new THREE.MeshStandardMaterial({color: 0x1c2024, roughness: 0.3, metalness: 0.4}), gold = metalOf(0xa77c32, 0.42, 0.9), steel = metalOf(0xaaa79e, 0.42, 0.9);
  const tube = (a, b, R = 0.022, mat = al) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, d.length(), 8), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = m.receiveShadow = true; g.add(m); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z), BY = 0.72;
  const tri = [0, 1, 2].map((i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3; return [Math.cos(a), Math.sin(a)]; });
  const low = tri.map(([c, s]) => V(c * 0.9, BY, s * 0.9)), up = tri.map(([c, s]) => V(c * 0.42, BY + 0.72, s * 0.42));
  low.forEach((p, i) => { tube(p, low[(i + 1) % 3], 0.03); tube(p, up[i], 0.026); tube(p, up[(i + 1) % 3], 0.02); tube(up[i], up[(i + 1) % 3], 0.022); });
  // legs: a hinged strut and two braces to a pad
  tri.forEach(([c, s], i) => {
    const hinge = low[i], foot = V(c * 2.1, 0.08, s * 2.1);
    tube(hinge, foot, 0.04); tube(low[(i + 1) % 3], foot, 0.018); tube(low[(i + 2) % 3], foot, 0.018);
    tube(foot.clone().add(V(0, 0.32, 0)), hinge.clone().add(V(0, -0.2, 0)), 0.035, steel);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.095, 0.1, 20), white); pad.position.copy(foot); pad.castShadow = pad.receiveShadow = true; g.add(pad);
    // the crushable block under the frame
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.32), gold); block.position.copy(hinge).add(V(0, -0.14, 0)); block.rotation.y = -Math.atan2(s, c); block.castShadow = true; g.add(block);
  });
  // the empty retro-motor ring and three verniers
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.026, 8, 30), al); ring.rotation.x = Math.PI / 2; ring.position.y = BY - 0.02; ring.castShadow = true; g.add(ring);
  tri.forEach(([c, s]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.2, 14, 1, true), dark); b.position.set(c * 0.56, BY - 0.12, s * 0.56); b.material.side = THREE.DoubleSide; g.add(b); const t = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), steel); t.position.set(c * 0.62, BY + 0.14, s * 0.62); t.castShadow = true; g.add(t); });
  // the two thermal boxes
  [[-0.5, BY + 0.22, 0.42, 0.62, 0.32, 0.42], [0.56, BY + 0.22, 0.34, 0.5, 0.3, 0.4]].forEach(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), white); m.position.set(x, y, z); m.rotation.y = x * 0.9; m.castShadow = m.receiveShadow = true; g.add(m); const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.012, d * 0.86), dark); top.position.set(x, y + h / 2 + 0.007, z); top.rotation.y = x * 0.9; g.add(top); });
  // the mast, the solar panel, the planar antenna: about 3 m tall
  tube(V(0, BY + 0.72, 0), V(0, 3.05, 0), 0.035);
  const panelC = (() => { const [c, cg] = canvas(512, 512); cg.fillStyle = '#10161f'; cg.fillRect(0, 0, 512, 512); cg.strokeStyle = '#49535f'; cg.lineWidth = 2; for (let i = 0; i <= 16; i++) { cg.beginPath(); cg.moveTo(i * 32, 0); cg.lineTo(i * 32, 512); cg.moveTo(0, i * 32); cg.lineTo(512, i * 32); cg.stroke(); } return tex(c); })();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.018, 0.76), [al, al, new THREE.MeshStandardMaterial({map: panelC, roughness: 0.2, metalness: 0.7}), al, al, al]); panel.position.set(0.1, 3.0, -0.32); panel.rotation.set(-0.5, 0.2, 0.08); panel.castShadow = true; g.add(panel);
  const antC = (() => { const [c, cg] = canvas(512, 512), rr = rng(33); cg.fillStyle = '#5d5a52'; cg.fillRect(0, 0, 512, 512); blotches(cg, 512, 512, 34, 40, 20, 120, '30,28,24', 0.2); blotches(cg, 512, 512, 35, 30, 20, 100, '180,172,156', 0.08); cg.strokeStyle = 'rgba(30,28,24,0.6)'; cg.lineWidth = 4; cg.strokeRect(8, 8, 496, 496); for (let i = 1; i < 8; i++) { cg.strokeStyle = `rgba(40,38,32,${0.12 + rr() * 0.1})`; cg.lineWidth = 2; cg.beginPath(); cg.moveTo(i * 64, 8); cg.lineTo(i * 64, 504); cg.moveTo(8, i * 64); cg.lineTo(504, i * 64); cg.stroke(); } return tex(c); })();
  const antM = new THREE.MeshStandardMaterial({map: antC, roughness: 0.74, metalness: 0.3});
  const ant = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.03, 0.96), antM); ant.position.set(-0.1, 2.72, 0.46); ant.rotation.set(1.28, 0.16, 0.1); ant.castShadow = true; g.add(ant);
  // pipes and harness round the frame, as thick as the real thing's
  { const rw = rng(77); for (let i = 0; i < 34; i++) { const a = low[Math.floor(rw() * 3)].clone().lerp(up[Math.floor(rw() * 3)], rw()), b = low[Math.floor(rw() * 3)].clone().lerp(up[Math.floor(rw() * 3)], rw()); a.x += (rw() - 0.5) * 0.14; a.z += (rw() - 0.5) * 0.14; tube(a, b, 0.005 + rw() * 0.012, rw() > 0.5 ? al : steel); } for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1 + rw() * 0.16, 0.06 + rw() * 0.12, 0.1 + rw() * 0.14), rw() > 0.5 ? al : white), p = up[Math.floor(rw() * 3)].clone().lerp(low[Math.floor(rw() * 3)], rw()); b.position.copy(p); b.rotation.y = rw() * 3; b.castShadow = b.receiveShadow = true; g.add(b); } }
  // the TV camera, its hood and mirror
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.52, 18), white); cam.position.set(0.5, BY + 0.5, -0.5); cam.rotation.z = -0.14; cam.castShadow = true; g.add(cam);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.22, 18), steel); hood.position.set(0.54, BY + 0.84, -0.5); hood.rotation.z = -0.14; hood.castShadow = true; g.add(hood);
  // two omni antennas on booms, and the folded soil scoop
  tube(V(-0.1, BY + 0.95, 0), V(-0.95, 1.98, -0.55), 0.014); tube(V(0.1, BY + 0.95, 0), V(1.0, 1.9, 0.5), 0.014);
  tube(V(-0.82, BY + 0.04, -0.3), V(-1.42, BY + 0.26, -0.72), 0.03); tube(V(-1.42, BY + 0.26, -0.72), V(-1.72, BY - 0.12, -0.95), 0.022);
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.2), steel); scoop.position.set(-1.72, BY - 0.15, -0.95); scoop.castShadow = true; g.add(scoop);
  return g;
};
export const Surveyor535 = () => useScene((e) => {
  indoors(e); shadows(e); e.final.grain.value = 0.02;
  const {scene, camera} = e; range(camera, 0.2, 12000);
  e.final.bloom.value = 0.18; e.final.exposure.value = 1.0; e.final.vign.value = 0.55;
  const M = makeMoon(), {SV, LM, C0} = M;
  const elev = 23 * Math.PI / 180, az = (90 + 8) * Math.PI / 180;                       // low in the east, a little south
  const sunD = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
  const proxies = [[LM.x, LM.z, 3.2, 7]];
  const {t, bm} = regolithTextures();
  t.repeat.set(1, 1); bm.repeat.set(1, 1);
  const rock = new THREE.MeshStandardMaterial({map: t, bumpMap: bm, bumpScale: 2.6, roughness: 0.96, metalness: 0, vertexColors: true});
  // the same texture close up and far away, so it never tiles; the fine bumps fade with distance, where they would only shimmer
  rock.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      { float dv = length(vViewPosition), kf = smoothstep(14.0, 120.0, dv);
        vec4 ta = texture2D(map, vMapUv), tb = texture2D(map, vMapUv * 0.137 + 0.37), tc = texture2D(map, vMapUv * 0.0191 + 0.71);
        diffuseColor *= mix(ta, mix(tb, tc, 0.5), kf * 0.9); }`).replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('dHdxy_fwd()', 'dHdxy_fwd() * (1.0 - smoothstep(10.0, 60.0, length(vViewPosition)))'));
  };
  // what the ground's colour does: broad patches, a pale apron of thrown-out soil round each young crater
  const alb = (() => { const rv = rng(5151), G = 128, gr = new Float32Array(G * G); for (let i = 0; i < G * G; i++) gr[i] = rv(); const vn = (x, z) => { const fx = ((x % G) + G) % G, fz = ((z % G) + G) % G, ix = Math.floor(fx), iz = Math.floor(fz), a = fx - ix, b = fz - iz, u = a * a * (3 - 2 * a), v = b * b * (3 - 2 * b); const q = (i, j) => gr[((iz + j) % G) * G + ((ix + i) % G)]; return (q(0, 0) * (1 - u) + q(1, 0) * u) * (1 - v) + (q(0, 1) * (1 - u) + q(1, 1) * u) * v; };
    const yng = M.list.filter((c) => c[3] && c[2] > 1.2), cell = 24, buckets = new Map();
    yng.forEach((c) => { const ext = c[2] * 3.4; for (let a = Math.floor((c[0] - ext) / cell); a <= Math.floor((c[0] + ext) / cell); a++) for (let b = Math.floor((c[1] - ext) / cell); b <= Math.floor((c[1] + ext) / cell); b++) { const k = a + ':' + b; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(c); } });
    return (x, z) => { let a = (vn(x / 61, z / 61) - 0.5) * 0.3 + (vn(x / 17 + 9, z / 17) - 0.5) * 0.16 + (vn(x / 5.1, z / 5.1 + 3) - 0.5) * 0.08; const l = buckets.get(Math.floor(x / cell) + ':' + Math.floor(z / cell)); if (l) for (const c of l) { const q = Math.hypot(x - c[0], z - c[1]) / c[2]; if (q < 3.4) a += 0.34 * Math.pow(1 - q / 3.4, 2); } return a; }; })();
  const nearG = lunarGrid(M, M.H, M.N, M.step, M.x0, M.z0, sunD, proxies, 0, alb);
  const near = new THREE.Mesh(nearG, rock); near.receiveShadow = true; near.frustumCulled = false; scene.add(near);
  const farG = lunarGrid(M, M.FH, M.FN, M.fstep, M.fx0, M.fz0, sunD, [], 1.6, null, [M.x0 + 12, M.x0 + M.SZ - 12, M.z0 + 12, M.z0 + M.SZ - 12]);
  scene.add(new THREE.Mesh(farG, rock));
  // rocks: rough dark lumps the colour of the ground, mostly fist-sized clods close to the camera, a thin scatter of blocks elsewhere
  const rs = rng(4242), bM = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1, flatShading: true});
  const lump = (seed) => { const q = rng(seed), g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position; const a = q() * 9, b = q() * 9, c = q() * 9; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.26 * Math.sin(x * 2.3 + a) * Math.sin(y * 2.9 + b) + 0.18 * Math.sin(z * 4.1 + c + x * 2) + 0.1 * Math.sin(y * 7 + a + z * 5); p.setXYZ(i, x * k, y * k * 0.72, z * k); } g.computeVertexNormals(); return g; };
  const N_ROCK = [1700, 1700, 1700];
  N_ROCK.forEach((nRock, gi) => {
    const inst = new THREE.InstancedMesh(lump(4100 + gi * 7), bM, nRock), Ma = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
    for (let i = 0; i < nRock; i++) {
      let x, z, sz;
      if (i < 620) { const a = rs() * 6.283, d = 1.2 + Math.pow(rs(), 0.8) * 15; x = SV.x + 5.2 + Math.cos(a) * d; z = SV.z + 2.6 + Math.sin(a) * d; sz = 0.012 + Math.pow(rs(), 5) * 0.12; }
      else { x = C0.x + (rs() - 0.5) * M.SZ * 0.96; z = C0.z + (rs() - 0.5) * M.SZ * 0.96; sz = 0.05 + Math.pow(rs(), 7) * 0.8; }
      if (Math.hypot(x - SV.x, z - SV.z) < 2.6 || Math.hypot(x - LM.x, z - LM.z) < 6) sz *= 0.3;
      E.set(rs() * 3, rs() * 3, rs() * 3); Q.setFromEuler(E); S.set(sz * (0.7 + rs() * 0.7), sz * (0.5 + rs() * 0.5), sz * (0.7 + rs() * 0.7)); P.set(x, M.hAt(x, z) + sz * 0.12, z);
      Ma.compose(P, Q, S); inst.setMatrixAt(i, Ma);
      { const v = 0.06 + rs() * 0.05; inst.setColorAt(i, new THREE.Color().setRGB(v, v, v * 0.98)); }
    }
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst);
  });
  // the two craft on their ground
  const lm = makeLM(); lm.position.set(LM.x, M.hAt(LM.x, LM.z) - 0.02, LM.z); lm.rotation.y = 0.55; scene.add(lm);
  const sv = makeSurveyor(); sv.position.set(SV.x, M.hAt(SV.x, SV.z) - 0.02, SV.z);
  // lying on the slope: its frame tilts with the 12 degree wall
  { const dh = 2, nx = M.hAt(SV.x - dh, SV.z) - M.hAt(SV.x + dh, SV.z), nz = M.hAt(SV.x, SV.z - dh) - M.hAt(SV.x, SV.z + dh), n = new THREE.Vector3(nx, 2 * dh, nz).normalize();
    const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 2.1);
    sv.quaternion.copy(tilt).multiply(yaw); scene.add(sv); }
  // the sun; the shadow camera tightens on what the lens is near
  const sun = new THREE.DirectionalLight(0xfffaf2, 6.2); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.00016; sun.shadow.normalBias = 0.02; sun.shadow.radius = 1.2;
  // fill: light thrown back from the ground; the Earth's own is too small to matter
  const fill = new THREE.HemisphereLight(0x06060a, 0x8d8a84, 0.2); scene.add(fill);
  envFrom(e, [0.008, 0.008, 0.01], [0.3, 0.29, 0.27], []);
  // where the camera goes
  const P0 = new THREE.Vector3(SV.x + 8.4 + 3.4, M.hAt(SV.x + 8.4 + 3.4, SV.z + 8.4 - 3.4) + 1.7, SV.z + 8.4 - 3.4);
  const mid = new THREE.Vector3((SV.x + LM.x) / 2, M.hAt((SV.x + LM.x) / 2, (SV.z + LM.z) / 2), (SV.z + LM.z) / 2);
  const P1 = new THREE.Vector3(mid.x + 126, mid.y + 84, mid.z - 126);
  const L0 = new THREE.Vector3(LM.x - 25, lm.position.y - 15, LM.z + 25), L1 = new THREE.Vector3(mid.x - 1, mid.y + 28, mid.z + 3);
  return {draw: (f) => {
    const k = ease((f - 48) / 262), arc = Math.pow(k, 1.25);
    camera.position.lerpVectors(P0, P1, arc); camera.position.y += Math.sin(k * Math.PI) * 22;
    const lk = new THREE.Vector3().lerpVectors(L0, L1, ease((f - 60) / 240)); camera.lookAt(lk);
    camera.fov = lerp(36, 38, k); camera.up.set(0, 1, 0);
    // the shadow map: tight on Surveyor at the start, both craft at the end
    const sh = lerp(26, 240, ease((f - 70) / 180)), cx = lerp(SV.x, mid.x, ease((f - 70) / 180)), cz = lerp(SV.z, mid.z, ease((f - 70) / 180));
    sun.target.position.set(cx, 0, cz); sun.position.set(cx + sunD.x * 900, sunD.y * 900, cz + sunD.z * 900); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera; sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.near = 200; sc.far = 1700; sc.updateProjectionMatrix();
    sun.shadow.bias = lerp(-0.00012, -0.0004, ease((f - 70) / 180));
  }};
});

export const PLATES = {
  ClockStop: [ClockStop, 300],
  CardStorm: [CardStorm, 600],
  RuleBook: [RuleBook, 420],
  EndPad: [EndPad, 300],
  PumpLine: [PumpLine, 360],
  AtlasCentaur: [AtlasCentaur, 360],
  Surveyor535: [Surveyor535, 360],
};
