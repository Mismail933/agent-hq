// The Saturn V in true metres, base of the S-IC at y 0. The paint follows NASA's film of this very rocket (SA-507): checked against the launch rolls.
import * as THREE from 'three';

// [radius, height] outer line, bottom to top
const PROFILE = [
  [5.03, 0], [5.03, 42], [5.03, 67.2],               // S-IC, S-IC/S-II interstage, S-II
  [3.3, 73.2],                                       // S-II/S-IVB taper
  [3.3, 88.6], [3.3, 89.5],                          // S-IVB, Instrument Unit
  [1.96, 98],                                        // spacecraft adapter
  [1.96, 101.1],                                     // service module
  [1.96, 101.3], [0.36, 104.7],                      // the boost protective cover over the command module
];
const HT = 111;

const paint = () => {
  const c = document.createElement('canvas'); c.width = 4096; c.height = 4096;
  const g = c.getContext('2d');
  const Y = (m) => 4096 - (m / HT) * 4096;                 // metres to canvas y
  const band = (a, b, col) => { g.fillStyle = col; g.fillRect(0, Y(b), 4096, Y(a) - Y(b)); };
  const quarters = (a, b, odd) => { g.fillStyle = '#16171a'; for (let q = 0; q < 4; q++) if ((q % 2 === 0) === odd) g.fillRect(q * 1024, Y(b), 1024, Y(a) - Y(b)); };
  band(0, HT, '#e9e8e2');
  quarters(0, 8.6, true);                                  // thrust structure: the roll pattern
  quarters(19.6, 24.2, false);                             // intertank
  band(39.2, 39.6, '#222');
  quarters(73.4, 80.6, true);                              // S-IVB aft
  g.fillStyle = '#26272a'; g.fillRect(0, Y(101.15), 4096, 6);
  // seams and panel lines
  g.strokeStyle = 'rgba(60,60,60,0.35)'; g.lineWidth = 2;
  for (const m of [8.6, 19.6, 24.2, 39.2, 42, 47.6, 67.2, 73.2, 88.6, 89.5, 98]) { g.beginPath(); g.moveTo(0, Y(m)); g.lineTo(4096, Y(m)); g.stroke(); }
  // USA down the first stage, on two sides
  g.fillStyle = '#b3122a'; g.font = '900 150px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const u of [512, 2560]) ['U', 'S', 'A'].forEach((l, i) => g.fillText(l, u, Y(33.5 - i * 5)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
};

// stringers on the bare structures: they catch a raking light, the flash above all
const bump = () => {
  const c = document.createElement('canvas'); c.width = 4096; c.height = 2048;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 4096, 2048);
  const Y = (m) => 2048 - (m / HT) * 2048;
  const ribs = (a, b, n) => { for (let i = 0; i < n; i++) { const x = (i / n) * 4096; g.fillStyle = i % 2 ? '#5a5a5a' : '#a8a8a8'; g.fillRect(x, Y(b), 4096 / n, Y(a) - Y(b)); } };
  ribs(0, 8.6, 216); ribs(19.6, 24.2, 216); ribs(42, 47.6, 216); ribs(64.5, 67.2, 216); ribs(73.2, 76, 144); ribs(88.6, 89.5, 96);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
};

export const makeSaturn = () => {
  const root = new THREE.Group();
  const line = PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  const hull = new THREE.LatheGeometry(line, 128);
  const uv = hull.attributes.uv, pos = hull.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / HT);
  const mat = new THREE.MeshStandardMaterial({map: paint(), bumpMap: bump(), bumpScale: 2.2, roughness: 0.62, metalness: 0.08});
  root.add(new THREE.Mesh(hull, mat));

  const metal = new THREE.MeshStandardMaterial({color: 0x34363a, roughness: 0.42, metalness: 0.85});
  const white = new THREE.MeshStandardMaterial({color: 0xdddcd5, roughness: 0.6, metalness: 0.1});
  const black = new THREE.MeshStandardMaterial({color: 0x1a1b1e, roughness: 0.55, metalness: 0.2});

  // four engine fairings and fins, at the outer engines
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, s = new THREE.Group(); s.rotation.y = a;
    const fair = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 2.05, 7.4, 28, 1), white); fair.position.set(0, 2.2, 5.45); s.add(fair);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(3.6, 0.3); shape.lineTo(3.6, 2.2); shape.lineTo(0, 4.4); shape.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: 0.24, bevelEnabled: false}), black);
    fin.rotation.y = -Math.PI / 2; fin.position.set(-0.12, -0.6, 6); s.add(fin);
    root.add(s);
  }
  // five F-1 bells
  const bellLine = []; for (let k = 0; k <= 16; k++) { const v = k / 16; bellLine.push(new THREE.Vector2(0.55 + 1.3 * Math.pow(v, 0.62), -v * 5.6)); }
  const bellG = new THREE.LatheGeometry(bellLine, 40);
  const bellM = new THREE.MeshStandardMaterial({color: 0x2c2b29, roughness: 0.5, metalness: 0.75, side: THREE.DoubleSide, emissive: 0x552010, emissiveIntensity: 1.2});
  for (const [x, z] of [[0, 0], [3.1, 3.1], [-3.1, 3.1], [3.1, -3.1], [-3.1, -3.1]]) { const b = new THREE.Mesh(bellG, bellM); b.position.set(x, -0.1, z); root.add(b); }

  // the escape tower: a lattice, the motor and its nose
  const tower = new THREE.Group(); tower.position.y = 104.6;
  const strut = (a, b, r = 0.035) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), metal); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); tower.add(m); };
  const R = 0.34, H = 3.0, ring = (y, off = 0) => [0, 1, 2, 3].map((i) => new THREE.Vector3(Math.cos(off + (i * Math.PI) / 2) * R, y, Math.sin(off + (i * Math.PI) / 2) * R));
  [0, 1, 2].forEach((lv) => { const a = ring((lv * H) / 3), b = ring(((lv + 1) * H) / 3); a.forEach((p, i) => { strut(p, b[i]); strut(p, b[(i + 1) % 4], 0.022); strut(b[i], b[(i + 1) % 4]); }); });
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 3.3, 24), white); motor.position.y = H + 1.65; tower.add(motor);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.33, 1.1, 24), new THREE.MeshStandardMaterial({color: 0xa62a22, roughness: 0.55})); nose.position.y = H + 3.85; tower.add(nose);
  root.add(tower);
  return root;
};

// the plume: nested shells, added light, turbulence scrolling down; it starts under the bells and streams away below
export const makeFlame = () => {
  const mk = (rTop, rBot, len, col, power, speed) => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {time: {value: 0}, col: {value: new THREE.Color(...col)}, power: {value: power}, speed: {value: speed}},
    vertexShader: `out vec3 vN; out vec3 vV; out vec2 vU; void main(){ vU = uv; vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); gl_Position = projectionMatrix * m; }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vV; in vec2 vU; out vec4 o; uniform float time, power, speed; uniform vec3 col;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); vec2 w = vec2(1.0, 0.0); return mix(mix(h(i), h(i + w), f.x), mix(h(i + w.yx), h(i + 1.0), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
      void main(){ float along = 1.0 - vU.y;
        float side = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float t = fbm(vec2(vU.x * 18.0, vU.y * 7.0 + time * speed));
        float fade = smoothstep(0.0, 0.015, along) * pow(1.0 - along, 1.7);
        float a = side * fade * (0.35 + 1.3 * t);
        o = vec4(col * a * power, 1.0); }`,
  });
  const g = new THREE.Group(), mats = [];
  for (const [rt, rb, len, col, pw, sp] of [[5.6, 15, 210, [1, 0.3, 0.07], 1.5, 1.4], [4.4, 9, 130, [1, 0.5, 0.13], 2.6, 2.1], [3.3, 4.2, 56, [1, 0.8, 0.5], 5.5, 3.0]]) {
    const m = mk(rt, rb, len, col, pw, sp); mats.push(m);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, 64, 24, true), m); c.position.y = -5.6 - len / 2; c.frustumCulled = false; g.add(c);
  }
  g.userData.tick = (t) => mats.forEach((m) => { m.uniforms.time.value = t; });
  return g;
};

// lightning: a jagged path with branches, drawn as camera-facing ribbons in very bright light; the bloom makes the glow
export const makeBolt = (points, seed = 7, wk = 1) => {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const jag = (a, b, rough, depth) => { if (depth === 0) return [a]; const m = a.clone().lerp(b, 0.42 + rnd() * 0.16), L = a.distanceTo(b); m.x += (rnd() - 0.5) * L * rough; m.z += (rnd() - 0.5) * L * rough; m.y += (rnd() - 0.5) * L * rough * 0.3; return [...jag(a, m, rough, depth - 1), ...jag(m, b, rough, depth - 1)]; };
  const main = []; for (let i = 0; i + 1 < points.length; i++) main.push(...jag(points[i], points[i + 1], 0.2, 5 + (i === 0 ? 2 : 0))); main.push(points[points.length - 1]);
  const paths = [{p: main, w: 2.6, b: 1}];
  for (let i = 8; i < main.length - 8; i += 6 + Math.floor(rnd() * 16)) {
    const a = main[i], dir = new THREE.Vector3((rnd() - 0.5) * 2, -0.25 - rnd() * 0.7, (rnd() - 0.5) * 2).normalize(), L = 40 + rnd() * 240;
    const end = a.clone().addScaledVector(dir, L), br = [...jag(a, end, 0.34, 4), end];
    paths.push({p: br, w: 0.9, b: 0.32 + rnd() * 0.35});
    if (rnd() < 0.5) { const q = br[Math.floor(br.length / 2)], e2 = q.clone().add(new THREE.Vector3((rnd() - 0.5) * L * 0.5, -rnd() * L * 0.45, (rnd() - 0.5) * L * 0.5)); paths.push({p: [...jag(q, e2, 0.34, 3), e2], w: 0.45, b: 0.2}); }
  }
  const count = paths.reduce((n, x) => n + x.p.length - 1, 0);
  const pos = new Float32Array(count * 18), col = new Float32Array(count * 18);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false});
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const v = new THREE.Vector3(), sd = new THREE.Vector3(), dirv = new THREE.Vector3();
  mesh.userData.update = (camera, power) => {
    mesh.visible = power > 0.001; if (!mesh.visible) return;
    const cam = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    let k = 0;
    for (const {p, w, b} of paths) for (let i = 0; i + 1 < p.length; i++) {
      const a = p[i], c = p[i + 1];
      dirv.copy(c).sub(a).normalize(); v.copy(a).sub(cam).normalize(); sd.crossVectors(dirv, v).normalize();
      const pix = Math.max(0.28, a.distanceTo(cam) * 0.0011) * w * wk;       // never thinner than a line on screen
      const A1 = a.clone().addScaledVector(sd, pix), A2 = a.clone().addScaledVector(sd, -pix), C1 = c.clone().addScaledVector(sd, pix), C2 = c.clone().addScaledVector(sd, -pix);
      for (const q of [A1, A2, C1, A1, C1, C2]) { pos[k] = q.x; pos[k + 1] = q.y; pos[k + 2] = q.z; col[k] = 26 * b * power; col[k + 1] = 30 * b * power; col[k + 2] = 42 * b * power; k += 3; }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  };
  return mesh;
};

// the see-through rocket: the hull as a shell of light, tanks and wiring inside it
export const makeXray = () => {
  const g = new THREE.Group();
  const shell = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {amt: {value: 0}, col: {value: new THREE.Color(0.5, 0.72, 1)}},
    vertexShader: `out vec3 vN; out vec3 vV; void main(){ vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); gl_Position = projectionMatrix * m; }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vV; out vec4 o; uniform float amt; uniform vec3 col; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); o = vec4(col * amt * (0.05 + 1.5 * f * f * f), 1.0); }`});
  g.add(new THREE.Mesh(new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 96), shell));
  const wire = new THREE.LineBasicMaterial({color: new THREE.Color(0.28, 0.42, 0.62), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});
  const tank = (r, h, y, n = 14) => { const e = new THREE.SphereGeometry(1, n * 2, n); e.scale(r, h, r); const l = new THREE.LineSegments(new THREE.WireframeGeometry(e), wire); l.position.y = y; g.add(l); };
  tank(4.6, 7.2, 12.4); tank(4.6, 7.8, 31); tank(4.6, 6, 53); tank(4.6, 4, 62.4); tank(3.0, 3.8, 79); tank(3.0, 3, 85.2);      // the propellant tanks, stage by stage
  // three fuel cells in the service module, the capsule on top
  const cells = [0, 1, 2].map((i) => { const a = (i * Math.PI * 2) / 3, m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.4, 16), new THREE.MeshBasicMaterial({color: new THREE.Color(0.2, 2.2, 1.4), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false})); m.position.set(Math.cos(a) * 1.1, 99.6, Math.sin(a) * 1.1); g.add(m); return m; });
  // the wiring up the side, and the pulse that runs along it
  const pts = []; for (let y = -2; y <= 103; y += 0.5) { const r = y < 67.2 ? 4.7 : y < 73.2 ? 4.7 - ((y - 67.2) / 6) * 1.65 : y < 89.5 ? 3.05 : y < 98 ? 3.05 - ((y - 89.5) / 8.5) * 1.25 : 1.6; pts.push(new THREE.Vector3(Math.cos(0.9) * r, y, Math.sin(0.9) * r)); }
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 500, 0.05, 6), new THREE.MeshBasicMaterial({color: new THREE.Color(0.45, 0.65, 1.0), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false}));
  g.add(line);
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshBasicMaterial({color: new THREE.Color(30, 36, 52), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false}));
  g.add(pulse);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.02, 12, 8), new THREE.MeshBasicMaterial({color: new THREE.Color(8, 11, 18), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false}));
  g.add(tail);
  g.userData.set = (amt, y, hit) => {
    shell.uniforms.amt.value = amt; wire.opacity = amt; line.material.opacity = amt * 0.9; g.visible = amt > 0.002;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round((y + 2) / 0.5))), q = pts[i];
    pulse.position.copy(q); tail.position.copy(q); tail.position.y -= 6; pulse.visible = tail.visible = y > -2 && y < 104;
    cells.forEach((c) => { c.material.color.setRGB(hit ? 3.4 : 0.2, hit ? 0.25 : 2.2, hit ? 0.2 : 1.4); c.material.opacity = amt; });
  };
  return g;
};
