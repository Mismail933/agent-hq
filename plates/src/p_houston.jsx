// Houston: the rooms, tubes, dials and paper of the ground side, in real metres, real light and a real lens. Rebuilt, not filmed: the editor's tags say so.
// A "lens" pass (thin-lens depth of field read from the engine's own depth, then grain) is laid over the engine by redirecting its last draw.
// Every frame is a pure function of the frame number. No text except what is printed on the object.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {useScene, indoors, clamp, ease, lerp} from './plates';

const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
const noiseV = (f, a) => Math.sin(f * a) * Math.cos(f * a * 0.617 + 1.3);
const QUAD_VS = `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ---------- the lens ----------
const LENS_FS = `
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D t, depth; uniform vec2 px; uniform float focus, ap, maxB, nearP, farP, grain, frame;
float lin(float z){ float n = z * 2.0 - 1.0; return 2.0 * nearP * farP / (farP + nearP - n * (farP - nearP)); }
float cocOf(float d){ return clamp(abs(d - focus) / d * ap, 0.0, maxB); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + frame * 1.37) * 43758.5453); }
void main(){
  const int N = 96;
  float cd = lin(textureLod(depth, vUv, 0.0).r), cs = cocOf(cd);
  vec3 c0 = textureLod(t, vUv, 0.0).rgb; vec3 col = c0 * c0; float tot = 1.0;
  float rot = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5, r = maxB * sqrt(fi / float(N)), a = fi * 2.39996 + rot;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * px;
    float sd = lin(textureLod(depth, uv, 0.0).r), ss = cocOf(sd);
    if (sd > cd) ss = clamp(ss, 0.0, cs * 2.0);
    float m = smoothstep(r - 0.75, r + 0.75, ss);
    vec3 sc = textureLod(t, uv, 0.0).rgb;
    col += mix(col / tot, sc * sc, m); tot += 1.0;
  }
  vec3 c = sqrt(col / tot);
  c += (hash(gl_FragCoord.xy) - 0.5) * grain;
  o = vec4(c, 1.0);
}`;

const lens = (e, {focus = 2, ap = 8, maxB = 20, grain = 0.016} = {}) => {
  const {renderer, camera} = e, sz = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(sz.x, sz.y, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false});
  const set = renderer.setRenderTarget.bind(renderer);
  let capture = true, first = true;
  renderer.setRenderTarget = (t, a, b) => set(t === null && capture ? rt : t, a, b);
  e.final.grain.value = 0;
  const u = {t: {value: rt.texture}, depth: {value: e.cloud.depth.value}, px: {value: new THREE.Vector2(1 / sz.x, 1 / sz.y)}, focus: {value: focus}, ap: {value: ap}, maxB: {value: maxB}, nearP: {value: 1}, farP: {value: 100}, grain: {value: grain}, frame: {value: 0}};
  const mat = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, vertexShader: QUAD_VS, fragmentShader: LENS_FS, uniforms: u, depthTest: false, depthWrite: false});
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); q.frustumCulled = false; qs.add(q);
  const render0 = e.render;
  e.render = (frame) => {
    if (first) { renderer.shadowMap.needsUpdate = true; first = false; }
    capture = true; render0(frame); capture = false;
    u.nearP.value = camera.near; u.farP.value = camera.far; u.frame.value = frame;
    set(null); renderer.render(qs, qc); renderer.getContext().finish(); capture = true;
  };
  return {set: (fo, a) => { u.focus.value = fo; if (a !== undefined) u.ap.value = a; }};
};

// ---------- light and materials ----------
const room = (e, near = 0.03, far = 300, liveShadows = false) => {
  indoors(e); const {renderer, camera} = e;
  camera.near = near; camera.far = far;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = liveShadows;
};
// what shiny things see: a few soft boxes in the dark
const envOf = (e, boxes, back = 0x000000, k = 1) => {
  const s = new THREE.Scene(); s.background = new THREE.Color(back);
  boxes.forEach(([x, y, z, w, h, col, v]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(v), side: THREE.DoubleSide})); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); });
  const pm = new THREE.PMREMGenerator(e.renderer), rt = pm.fromScene(s, 0.02, 0.1, 100);
  e.scene.environment = rt.texture; e.scene.environmentIntensity = k; pm.dispose();
};
const spot = (e, col, v, [x, y, z], [tx, ty, tz], angle = 0.5, pen = 0.7, decay = 1.8, shadow = 1024, sNear = 0.1, sFar = 30) => {
  const l = new THREE.SpotLight(col, v, 0, angle, pen, decay); l.position.set(x, y, z); l.target.position.set(tx, ty, tz); e.scene.add(l, l.target);
  if (shadow) { l.castShadow = true; l.shadow.mapSize.set(shadow, shadow); l.shadow.camera.near = sNear; l.shadow.camera.far = sFar; l.shadow.bias = -0.0004; l.shadow.normalBias = 0.002; l.shadow.radius = 3; }
  return l;
};
let MOTTLE = null;
const mottle = () => {
  if (MOTTLE) return MOTTLE;
  const [c, g] = canvas(1024, 1024), r = rng(4242);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 300; i++) { const x = r() * 1024, y = r() * 1024, R = 30 + r() * 170, c = r() < 0.5 ? '0,0,0' : '255,255,255', a = 0.012 + r() * 0.03, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); }
  for (let i = 0; i < 9000; i++) { const v = r() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${r() * 0.05})`; g.fillRect(r() * 1024, r() * 1024, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(0,0,0,${0.015 + r() * 0.05})`; g.lineWidth = 0.5 + r() * 0.5; const x = r() * 1024, y = r() * 1024, a = r() * 7, n = 5 + r() * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * n, y + Math.sin(a) * n); g.stroke(); }
  MOTTLE = tex(c); MOTTLE.wrapS = MOTTLE.wrapT = THREE.RepeatWrapping; return MOTTLE;
};
const M = (c, r = 0.6, m = 0.1, ex = {}) => new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: m, ...ex});
const worn = (c, r = 0.58, m = 0.12, ex = {}) => M(c, r, m, {map: mottle(), roughnessMap: mottle(), ...ex});
const shade = (m, cast = true, rec = true) => { m.castShadow = cast; m.receiveShadow = rec; return m; };
const B = (w, h, d, mat, x = 0, y = 0, z = 0, r = 0.005) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), mat); m.position.set(x, y, z); return shade(m); };
const C = (r1, r2, h, mat, x = 0, y = 0, z = 0, seg = 32) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.position.set(x, y, z); return shade(m); };
// glass that only adds what it reflects: a few soft shapes of the room by direction, with real Fresnel falloff. Direct lights never reach it, so no hot blob on a tube.
const glassM = (boxes = [[[0, 0.8, 0.6], 0.5, 0xd8e0e0, 0.5]], base = 0.012) => {
  const dirs = [], cols = [], rads = [];
  for (let i = 0; i < 4; i++) { const b = boxes[i]; dirs.push(b ? new THREE.Vector3(...b[0]).normalize() : new THREE.Vector3(0, 1, 0)); rads.push(b ? b[1] : 0.001); cols.push(b ? new THREE.Color(b[2]).multiplyScalar(b[3]) : new THREE.Color(0)); }
  return new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: {D: {value: dirs}, C: {value: cols}, Rd: {value: rads}, base: {value: base}},
    vertexShader: `out vec3 wp; out vec3 wn; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; wn = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `precision highp float; in vec3 wp; in vec3 wn; out vec4 o; uniform vec3 D[4]; uniform vec3 C[4]; uniform float Rd[4]; uniform float base;
      void main(){ vec3 v = normalize(wp - cameraPosition), n = normalize(wn); float nv = abs(dot(n, v)); vec3 r = reflect(v, n);
        float F = 0.04 + 0.96 * pow(1.0 - nv, 5.0); vec3 c = vec3(base);
        for (int i = 0; i < 4; i++) { float d = acos(clamp(dot(r, D[i]), -1.0, 1.0)); c += C[i] * (1.0 - smoothstep(Rd[i] * 0.55, Rd[i], d)); }
        o = vec4(c * F, 1.0); }`});
};
const label = (txt, w, h, font, fg = '#e6e6da', bg = '#141516', ls = 0) => { const [c, g] = canvas(w, h); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; if (ls) g.letterSpacing = `${ls}px`; g.fillText(txt, w / 2, h / 2 + 2); return tex(c); };
const rrect = (P, x, y, w, h, r) => { P.moveTo(x + r, y); P.lineTo(x + w - r, y); P.quadraticCurveTo(x + w, y, x + w, y + r); P.lineTo(x + w, y + h - r); P.quadraticCurveTo(x + w, y + h, x + w - r, y + h); P.lineTo(x + r, y + h); P.quadraticCurveTo(x, y + h, x, y + h - r); P.lineTo(x, y + r); P.quadraticCurveTo(x, y, x + r, y); return P; };
// floating dust caught in the light: closed form, so any frame stands alone
const dust = (e, n, [x0, x1], [y0, y1], [z0, z1], col, size = 1.2, seed = 11, op = 0.3) => {
  const r = rng(seed), p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = lerp(x0, x1, r()); p[i * 3 + 1] = lerp(y0, y1, r()); p[i * 3 + 2] = lerp(z0, z1, r()); s[i] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {f: {value: 0}, col: {value: new THREE.Color(col)}, size: {value: size}, op: {value: op}},
    vertexShader: `in float seed; uniform float f, size; out float vs; void main(){ vs = seed; vec3 q = position + vec3(sin(f * 0.006 + seed * 40.0), sin(f * 0.004 + seed * 90.0) * 1.2, cos(f * 0.005 + seed * 70.0)) * 0.07; vec4 mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * 1080.0 * (1.5 + seed * 2.0) / -mv.z, 1.0, 14.0); }`,
    fragmentShader: `precision highp float; in float vs; out vec4 o; uniform vec3 col; uniform float op, f; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float tw = sin(f * 0.02 + vs * 50.0); o = vec4(col, (1.0 - smoothstep(0.2, 1.0, d)) * op * (0.4 + 0.6 * tw * tw)); }`});
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; e.scene.add(pts);
  return m.uniforms.f;
};

// ---------- the telemetry table (a copy of cabin.js's screen, with more moods) ----------
const NAMES = ['FC1 AMPS', 'FC2 AMPS', 'FC3 AMPS', 'MN BUS A V', 'MN BUS B V', 'AC BUS 1 V', 'AC BUS 2 V', 'BAT A AMPS', 'BAT B AMPS', 'O2 TK1 PSI', 'H2 TK1 PSI', 'FC1 TEMP', 'FC2 TEMP', 'CAB PRESS', 'SUIT PRESS', 'GLY TEMP'];
const SQUIRRELLY = [6.7, 12.3, 3.1, 19.4, 0.9, 7.7, 14.2, 2.6, 11.8, 31.5, 4.4, 8.2, 16.9, 1.3, 22.1, 9.6];
// after SCE to AUX: the truth at last. The fuel cells are off line and the batteries carry the ship (lines 102, 106). Illustrative values.
const REAL_DATA = [0.0, 0.0, 0.0, 25.8, 25.9, 112.4, 112.1, 35.1, 34.6, 901, 239, 159, 161, 10.1, 10.0, 45.2];
const hms = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, Math.floor(s) % 60].map((x) => String(x).padStart(2, '0')).join(':');

const paintGarbage = (g, f, hit) => {
  const r = rng(1 + (f - (f % 2)) * 37);
  g.fillStyle = '#000'; g.fillRect(0, 0, 1536, 1152);
  g.fillStyle = '#fff'; g.textBaseline = 'top'; g.font = '700 54px "Courier New", monospace'; g.fillText('CSM  EPS / ECS', 80, 56);
  g.font = '700 42px "Courier New", monospace'; g.fillText('GET  ??:??:??', 960, 62); g.fillRect(70, 130, 1396, 5);
  g.font = '700 50px "Courier New", monospace';
  NAMES.forEach((n, i) => {
    const y = 158 + i * 58 + (r() < 0.12 ? (r() - 0.5) * 26 : 0), jit = (r() - 0.5) * 2;
    g.globalAlpha = r() < 0.05 ? 0.25 : 1;
    g.fillText(r() < 0.28 ? n.replace(/[A-Z0-9]/g, (c) => (r() < 0.5 ? '#%*/=?'[Math.floor(r() * 6)] : c)) : n, 86 + (r() - 0.5) * 8, y);
    const base = SQUIRRELLY[i] * (0.4 + r() * 1.9), v = r() < 0.12 ? '??.?' : base.toFixed(1);
    g.fillText(String(v).padStart(7, ' '), 760 + jit * 3, y);
    g.fillText((r() > 0.5 ? 'M' : 'S') + (r() > 0.6 ? '*' : ' '), 1240, y);
    g.globalAlpha = 1;
  });
  if (hit) for (let i = 0; i < 26; i++) { g.fillStyle = '#fff'; g.fillRect(0, r() * 1152, 1536, 2 + r() * 12); }
};
const paintTable = (g, values, clockLabel, secs) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 1536, 1152);
  g.fillStyle = '#fff'; g.textBaseline = 'top'; g.font = '700 54px "Courier New", monospace'; g.fillText('CSM  EPS / ECS', 80, 56);
  g.font = '700 42px "Courier New", monospace'; g.fillText(clockLabel + '  ' + hms(secs), 960, 62); g.fillRect(70, 130, 1396, 5);
  g.font = '700 50px "Courier New", monospace';
  NAMES.forEach((n, i) => { const y = 158 + i * 58; g.fillText(n, 86, y); const v = values[i] > 50 && i >= 9 && i <= 12 ? String(Math.round(values[i])) : values[i].toFixed(1); g.fillText(v.padStart(7, ' '), 760, y); });
};
// the tube: a phosphor with a little bulge. paint(g, f) draws its picture.
const makeTube = (w, h, paint, boxes) => {
  const [c, g] = canvas(1536, 1152), map = tex(c);
  const geo = new THREE.PlaneGeometry(w, h, 48, 36), ps = geo.attributes.position;
  for (let i = 0; i < ps.count; i++) { const x = ps.getX(i) / (w / 2), y = ps.getY(i) / (h / 2); ps.setZ(i, (1 - (x * x + y * y) * 0.5) * w * 0.05); }
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, uniforms: {t: {value: map}, gain: {value: 1}, frame: {value: 0}},
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float gain, frame;
      void main(){ vec2 u = vUv; float d = 1.2 / 1536.0;
        vec3 c = texture(t, u).rgb * 0.6 + texture(t, u + vec2(d, 0.0)).rgb * 0.2 + texture(t, u - vec2(d, 0.0)).rgb * 0.2;
        float line = 0.76 + 0.24 * sin(u.y * 3.14159 * 1152.0 * 0.5);
        vec3 ph = vec3(0.62, 1.0, 0.72) * c.r * line * gain * 2.6;
        vec2 q = abs(u - 0.5) * 2.0; float sq = pow(pow(q.x, 5.0) + pow(q.y, 5.0), 0.2); float edge = 1.0 - smoothstep(0.94, 1.02, sq);
        ph += vec3(0.012, 0.02, 0.016) * edge;
        float roll = 0.03 * sin(u.y * 9.0 - frame * 0.4);
        o = vec4(ph * edge * (1.0 + roll), 1.0); }`});
  const tube = new THREE.Mesh(geo, mat), glass = new THREE.Mesh(geo, glassM(boxes)); glass.position.z = 0.002; glass.renderOrder = 3;
  const grp = new THREE.Group(); grp.add(tube, glass);
  return {grp, mat, w, h, draw: (f) => { paint(g, f); map.needsUpdate = true; mat.uniforms.frame.value = f; }};
};

// ---------- the console, in metres: desk, sloped face, tube in a recess, push-button modules ----------
let CAP = null;
const capTex = () => { if (CAP) return CAP; const [c, g] = canvas(128, 96); const r = g.createRadialGradient(64, 48, 8, 64, 48, 76); r.addColorStop(0, '#ffffff'); r.addColorStop(0.55, '#c4c4c4'); r.addColorStop(1, '#3c3c3c'); g.fillStyle = r; g.fillRect(0, 0, 128, 96); g.fillStyle = 'rgba(0,0,0,0.62)'; g.font = '700 25px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SYS', 64, 34); g.fillText('ACK', 64, 62); CAP = tex(c); return CAP; };
const pbi = (rows, cols, cw, ch, seed, chance, palette = [0x47ff8a, 0xffa030, 0xe8e8d0]) => {
  const g = new THREE.Group(), r = rng(seed), W = cols * cw * 1.14, H = rows * ch * 1.18;
  g.add(B(W + 0.012, H + 0.012, 0.012, M(0x101113, 0.5, 0.5), 0, 0, -0.004, 0.003));
  const geo = new RoundedBoxGeometry(cw, ch, 0.008, 1, 0.0015), dark = M(0x24262a, 0.35, 0.1), caps = new THREE.InstancedMesh(geo, dark, rows * cols), mats = palette.map((p) => new THREE.MeshBasicMaterial({map: capTex(), color: new THREE.Color(p).multiplyScalar(0.95)}));
  const lit = palette.map((p, i) => new THREE.InstancedMesh(geo, mats[i], rows * cols)); const count = palette.map(() => 0), m4 = new THREE.Matrix4();
  let k = 0;
  for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) {
    m4.makeTranslation((b - (cols - 1) / 2) * cw * 1.14, (a - (rows - 1) / 2) * ch * 1.18, 0.004);
    if (r() < chance) { const q = Math.floor(r() * palette.length); lit[q].setMatrixAt(count[q]++, m4); } else caps.setMatrixAt(k++, m4);
  }
  caps.count = k; lit.forEach((l, i) => { l.count = count[i]; l.instanceMatrix.needsUpdate = true; l.frustumCulled = false; g.add(l); }); caps.instanceMatrix.needsUpdate = true; caps.frustumCulled = false; g.add(caps);
  return g;
};
const consoleUnit = ({tube = null, name = '', paint = null, seed = 3, chance = 0.22} = {}) => {
  const g = new THREE.Group(), P = paint || worn(0x79827e), dark = M(0x15171a, 0.5, 0.4), top = M(0x1d2023, 0.36, 0.1);
  g.add(B(0.24, 0.72, 0.72, P, -0.41, 0.36, -0.02), B(0.24, 0.72, 0.72, P, 0.41, 0.36, -0.02), B(0.62, 0.72, 0.05, dark, 0, 0.36, -0.34));
  g.add(B(1.06, 0.035, 0.86, top, 0, 0.74, 0.04, 0.012), B(1.07, 0.012, 0.87, M(0x8c8d8c, 0.25, 0.9), 0, 0.72, 0.04, 0.004));
  g.add(B(1.06, 0.68, 0.42, P, 0, 1.1, -0.47, 0.02), B(0.02, 0.68, 0.28, P, -0.525, 1.1, -0.16, 0.006), B(0.02, 0.68, 0.28, P, 0.525, 1.1, -0.16, 0.006), B(1.08, 0.05, 0.62, M(0x2b2e31, 0.42, 0.2), 0, 1.45, -0.34, 0.018));
  const face = new THREE.Group(); face.position.set(0, 1.08, -0.08); face.rotation.x = -0.13; g.add(face); g.userData.face = face;
  const s = new THREE.Shape(); rrect(s, -0.53, -0.33, 1.06, 0.66, 0.012);
  s.holes.push(rrect(new THREE.Path(), -0.272, -0.165, 0.544, 0.41, 0.03));
  face.add(shade(new THREE.Mesh(new THREE.ExtrudeGeometry(s, {depth: 0.012, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 10}), P)));
  // the recess round the tube, deep enough to catch light on its sides
  const s2 = new THREE.Shape(); rrect(s2, -0.3, -0.19, 0.6, 0.46, 0.035); s2.holes.push(rrect(new THREE.Path(), -0.268, -0.161, 0.536, 0.402, 0.03));
  const ring = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(s2, {depth: 0.07, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 10}), M(0x202326, 0.42, 0.55))); ring.position.z = -0.055; face.add(ring);
  const tubeY = 0.04;
  if (tube) { tube.grp.position.set(0, tubeY, -0.05); face.add(tube.grp); }
  else { const geo = new THREE.PlaneGeometry(0.54, 0.405, 24, 18), ps = geo.attributes.position; for (let i = 0; i < ps.count; i++) { const x = ps.getX(i) / 0.27, y = ps.getY(i) / 0.2025; ps.setZ(i, (1 - (x * x + y * y) * 0.5) * 0.027); } geo.computeVertexNormals(); const d = new THREE.Mesh(geo, M(0x0c1110, 0.09, 0.05)); d.position.set(0, tubeY, -0.05); face.add(d); }
  [[-0.405, 0.08], [0.405, 0.08]].forEach(([x, y], i) => { const m = pbi(6, 3, 0.03, 0.024, seed + i * 13, chance); m.position.set(x, y, 0.016); face.add(m); });
  const low = pbi(2, 14, 0.03, 0.02, seed + 41, chance * 0.7); low.position.set(0, -0.255, 0.016); face.add(low);
  // screws
  const sc = M(0x9a9a98, 0.3, 0.9); [[-0.51, 0.31], [0.51, 0.31], [-0.51, -0.31], [0.51, -0.31]].forEach(([x, y]) => { const q = C(0.006, 0.006, 0.003, sc, x, y, 0.015, 12); q.rotation.x = Math.PI / 2; face.add(q); });
  if (name) { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.038), new THREE.MeshStandardMaterial({map: label(name, 512, 96, '700 66px Arial, sans-serif', '#e4e4d8', '#17181a', 6), roughness: 0.4})); n.position.set(0, 0.292, 0.0145); face.add(n); }
  // the keyset and loop panel on the desk
  const key = new THREE.Group(); key.position.set(-0.17, 0.785, 0.1); key.rotation.x = -0.86; key.add(B(0.42, 0.14, 0.05, M(0x33373a, 0.5, 0.3), 0, 0, -0.03, 0.006)); const kb = pbi(4, 12, 0.026, 0.02, seed + 77, chance * 0.8); key.add(kb); g.add(key);
  const loop = new THREE.Group(); loop.position.set(0.3, 0.785, 0.1); loop.rotation.x = -0.86; loop.add(B(0.3, 0.14, 0.05, M(0x33373a, 0.5, 0.3), 0, 0, -0.03, 0.006));
  const bat = M(0xb8b8b4, 0.3, 0.9); for (let i = 0; i < 6; i++) { const q = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, 0.018, 3, 8), bat); q.position.set(-0.11 + i * 0.044, 0.025, 0.012); q.rotation.x = 0.9; loop.add(shade(q)); const j = C(0.006, 0.006, 0.004, M(0x050505, 0.4, 0.8), -0.11 + i * 0.044, -0.03, 0.002, 12); j.rotation.x = Math.PI / 2; loop.add(j); }
  g.add(loop);
  return g;
};
const tubeWorld = (unit, tube) => { unit.updateMatrixWorld(true); const q = new THREE.Quaternion(), T = new THREE.Vector3(); tube.grp.getWorldPosition(T); tube.grp.getWorldQuaternion(q); return {T, R: new THREE.Vector3(1, 0, 0).applyQuaternion(q), U: new THREE.Vector3(0, 1, 0).applyQuaternion(q), N: new THREE.Vector3(0, 0, 1).applyQuaternion(q)}; };
const camOn = (cam, {T, R, U, N}, [a, b, c], [la, lb], fov = 36, tilt = 0) => {
  cam.up.set(tilt, 1, 0);
  cam.position.copy(T).addScaledVector(R, a).addScaledVector(U, b).addScaledVector(N, c);
  cam.lookAt(T.clone().addScaledVector(R, la).addScaledVector(U, lb).addScaledVector(N, 0.02)); cam.fov = fov;
};
const floorRoom = (e, {w = 24, d = 26, h = 4.2, wall = 0x14171a, zBack = 6} = {}) => {
  const {scene} = e, rug = (() => { const [c, g] = canvas(512, 512), r = rng(991); g.fillStyle = '#6a6e70'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 16000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.1})`; g.fillRect(r() * 512, r() * 512, 2, 2); } return tex(c, true, [30, 30]); })();
  const f = shade(new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({color: 0x34393b, map: rug, roughness: 0.92})), false); f.rotation.x = -Math.PI / 2; f.position.z = zBack - d / 2; scene.add(f);
  const W = M(wall, 0.8, 0), add = (w2, h2, x, y, z, ry) => { const m = shade(new THREE.Mesh(new THREE.PlaneGeometry(w2, h2), W), false); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); };
  add(w, h, 0, h / 2, zBack, Math.PI); add(w, h, 0, h / 2, zBack - d, 0); add(d, h, -w / 2, h / 2, zBack - d / 2, Math.PI / 2); add(d, h, w / 2, h / 2, zBack - d / 2, -Math.PI / 2);
  const ceil = shade(new THREE.Mesh(new THREE.PlaneGeometry(w, d), M(0x0d0f11, 0.9, 0)), false); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, h, zBack - d / 2); scene.add(ceil);
};
const mug = () => {
  const g = new THREE.Group(), w = M(0xd8d3c6, 0.3, 0);
  const pts = [[0, 0], [0.036, 0], [0.04, 0.004], [0.041, 0.09], [0.038, 0.09], [0.037, 0.008], [0, 0.008]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(shade(new THREE.Mesh(new THREE.LatheGeometry(pts, 40), w)));
  const h = shade(new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 10, 24, Math.PI), w)); h.position.set(0.04, 0.045, 0); h.rotation.z = -Math.PI / 2; g.add(h);
  const c = new THREE.Mesh(new THREE.CircleGeometry(0.037, 32), M(0x120a05, 0.12, 0)); c.rotation.x = -Math.PI / 2; c.position.y = 0.075; g.add(c);
  return g;
};
const binder = () => { const g = new THREE.Group(), blue = worn(0x1e2c3c, 0.65, 0); g.add(B(0.24, 0.04, 0.31, blue, 0, 0.02, 0, 0.004), B(0.23, 0.032, 0.3, M(0xbdb8a8, 0.9, 0), 0.006, 0.02, 0, 0.002), B(0.012, 0.042, 0.31, M(0x141a22, 0.5, 0.1), -0.12, 0.021, 0, 0.003)); return g; };
const chair = () => {
  const g = new THREE.Group(), vin = worn(0x25282a, 0.42, 0.05), chrome = M(0xc4c4c2, 0.22, 1);
  g.add(C(0.024, 0.024, 0.34, chrome, 0, 0.27, 0, 16));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, leg = B(0.32, 0.024, 0.04, chrome, Math.cos(a) * 0.16, 0.085, Math.sin(a) * 0.16, 0.01); leg.rotation.y = -a; g.add(leg); const w = C(0.028, 0.028, 0.03, M(0x0c0c0c, 0.5, 0.2), Math.cos(a) * 0.31, 0.03, Math.sin(a) * 0.31, 14); w.rotation.z = Math.PI / 2; w.rotation.y = -a; g.add(w); }
  g.add(B(0.48, 0.09, 0.47, vin, 0, 0.47, 0, 0.04));
  const back = B(0.45, 0.46, 0.08, vin, 0, 0.82, 0.25, 0.04); back.rotation.x = 0.1; g.add(back);
  for (let i = -1; i <= 1; i++) { const st = B(0.004, 0.42, 0.004, M(0x0e0f10, 0.5, 0), i * 0.11, 0.82, 0.291, 0.001); st.rotation.x = 0.1; g.add(st); }
  const arm = B(0.02, 0.36, 0.024, chrome, 0, 0.62, 0.225, 0.008); arm.rotation.x = 0.1; g.add(arm);
  [-1, 1].forEach((s) => { g.add(B(0.05, 0.03, 0.3, M(0x101112, 0.45, 0.1), s * 0.27, 0.68, 0.02, 0.012), C(0.008, 0.008, 0.17, chrome, s * 0.27, 0.58, 0.05, 10)); });
  return g;
};

// ---------- ScreenZeros: the simulator. Every value 0.0, calm and green. Slow slide along the column of zeros. ----------
const ZEROS = NAMES.map(() => 0);
export const ScreenZeros = () => useScene((e) => {
  room(e);
  const tube = makeTube(0.54, 0.405, (g, f) => paintTable(g, ZEROS, 'GET', 96 + f / 30), [[[0, 0.85, 0.5], 0.4, 0xdfe8f0, 1.6], [[-0.7, 0.3, 0.6], 0.3, 0xbfd0d8, 0.5]]);
  e.final.bloom.value = 0.55; e.final.exposure.value = 1.05; e.final.vign.value = 0.8;
  envOf(e, [[0, 6, 2, 8, 2, 0xdfe8f0, 2.2], [-6, 2, 4, 2, 4, 0xbfd0d8, 0.7], [5, 1, 6, 3, 2, 0x6a7a70, 0.4]]);
  floorRoom(e, {wall: 0x20262a});
  const units = [-1, 0, 1].map((i) => { const u = consoleUnit(i === 0 ? {tube, seed: 3, chance: 0.3} : {seed: 40 + i * 9, chance: 0.2}); u.position.x = i * 1.08; e.scene.add(u); return u; });
  const W = tubeWorld(units[1], tube);
  spot(e, 0xcfe2e4, 9, [0.1, 3.9, 1.6], [0.1, 0.9, 0], 0.62, 0.8, 1.7, 1536, 0.5, 8);
  e.scene.add(new THREE.AmbientLight(0x56646a, 0.32));
  const glow = new THREE.PointLight(0xc4ecd0, 0.3, 3, 1.6); glow.position.copy(W.T).addScaledVector(W.N, 0.3); e.scene.add(glow);
  const L = lens(e, {focus: 0.9, ap: 18, maxB: 22, grain: 0.013});
  const fd = dust(e, 40, [-1, 1], [0.6, 2], [0.1, 1.4], 0xd0e8d8, 0.0036, 11, 0.1);
  return {draw: (f) => {
    tube.draw(f); fd.value = f;
    const k = ease(f / 300);
    camOn(e.camera, W, [lerp(-0.42, -0.02, k), lerp(-0.13, 0.0, k), lerp(0.74, 0.5, k)], [lerp(-0.02, 0.05, k), lerp(0.02, 0.02, k)], 40);
    L.set(e.camera.position.distanceTo(W.T));
  }};
});

// ---------- ScreenNight: the same table with 6.7 and 12.3 and other odd values, steady. A dark room, the tube the only real light. ----------
export const ScreenNight = () => useScene((e) => {
  room(e);
  const tube = makeTube(0.54, 0.405, (g, f) => paintTable(g, SQUIRRELLY, 'GMT', 8 * 3600 + 41 * 60 + 12 + f / 30), [[[-0.5, 0.55, 0.65], 0.34, 0xe8a53a, 0.5], [[0.5, 0.2, 0.8], 0.5, 0x9fb0a8, 0.28]]);
  e.final.bloom.value = 0.6; e.final.exposure.value = 1.1; e.final.vign.value = 1.25;
  envOf(e, [[2, 1, 7, 4, 2, 0x8f9f96, 0.5], [-8, 2.5, -2, 1.5, 3, 0xe8a53a, 0.3]]);
  floorRoom(e, {wall: 0x0d0f11});
  const units = [-1, 0, 1, 2].map((i) => { const u = consoleUnit(i === 0 ? {tube, name: 'EECOM', seed: 3, chance: 0.1} : {seed: 40 + i * 9, chance: 0.015}); u.position.x = i * 1.08; e.scene.add(u); return u; });
  const W = tubeWorld(units[1], tube);
  const m = mug(); m.position.set(0.38, 0.757, 0.3); m.rotation.y = 2.2; e.scene.add(m);
  const b = binder(); b.position.set(-0.28, 0.757, 0.3); b.rotation.y = 0.14; e.scene.add(b);
  spot(e, 0xc4ecd0, 2.0, [W.T.x, W.T.y, W.T.z + 0.14], [W.T.x, 0.74, 1.0], 1.2, 0.9, 1.7, 1024, 0.05, 6);
  const fill = new THREE.PointLight(0xc4ecd0, 0.34, 2.5, 1.6); fill.position.copy(W.T).addScaledVector(W.N, 0.22); e.scene.add(fill);
  spot(e, 0xe8a53a, 3.4, [-6.5, 3.6, 3], [-0.6, 0.9, 0], 0.3, 0.9, 1.5, 0);
  e.scene.add(new THREE.AmbientLight(0x30343a, 0.16));
  const L = lens(e, {focus: 1, ap: 24, maxB: 22, grain: 0.02});
  const fd = dust(e, 40, [-0.8, 0.8], [0.8, 1.7], [0.1, 1.4], 0xd0e8d8, 0.0036, 19, 0.12);
  return {draw: (f) => {
    tube.draw(f); fd.value = f;
    const k = ease(f / 360);
    // slowly in, from over the desk, onto the first two rows
    camOn(e.camera, W, [lerp(-0.34, -0.06, k), lerp(-0.16, 0.1, k), lerp(1.16, 0.5, k)], [lerp(-0.04, -0.045, k), lerp(-0.06, 0.09, k)], lerp(38, 36, k), lerp(0.015, 0, k));
    L.set(e.camera.position.distanceTo(W.T));
  }};
});

// ---------- ScreenClean: garbage, then at 5.0 s (frame 150) it snaps to clean, readable numbers. ----------
const CLEAN_F = 150;
export const ScreenClean = () => useScene((e) => {
  room(e);
  const tube = makeTube(0.54, 0.405, (g, f) => {
    if (f < CLEAN_F) { paintGarbage(g, f, f >= CLEAN_F - 3); return; }
    // telemetry refreshes about once a second: the values breathe in the last digit, the fuel cells stay at zero
    const tick = Math.floor((f - CLEAN_F) / 30), r = rng(9 + tick * 53);
    const vals = REAL_DATA.map((v, i) => { const d = i < 3 || (i >= 9 && i <= 12) ? 0 : (r() - 0.5) * 0.3; return v + (tick > 0 ? d : 0); });
    paintTable(g, vals, 'GET', 112 + (f - CLEAN_F) / 30);
  }, [[[0.1, 0.85, 0.5], 0.35, 0xd8d0c0, 0.8], [[-0.65, 0.35, 0.6], 0.3, 0xe8a53a, 0.35]]);
  e.final.bloom.value = 0.6; e.final.exposure.value = 1.05; e.final.vign.value = 0.95;
  envOf(e, [[0, 6, 3, 6, 2, 0xd8d0c0, 1.0], [-7, 2, 3, 2, 3, 0xe8a53a, 0.35]]);
  floorRoom(e, {wall: 0x101316});
  const units = [-1, 0, 1].map((i) => { const u = consoleUnit(i === 0 ? {tube, seed: 3, chance: 0.28} : {seed: 40 + i * 9, chance: 0.18}); u.position.x = i * 1.08; e.scene.add(u); return u; });
  const W = tubeWorld(units[1], tube);
  const fill = new THREE.PointLight(0xc4ecd0, 0.28, 2.5, 1.6); fill.position.copy(W.T).addScaledVector(W.N, 0.24); e.scene.add(fill);
  spot(e, 0xd8cfc0, 3, [0.6, 3.8, 1.8], [0, 1, 0], 0.5, 0.85, 1.7, 1024, 0.5, 8);
  e.scene.add(new THREE.AmbientLight(0x3a4246, 0.2));
  const L = lens(e, {focus: 0.6, ap: 22, maxB: 22, grain: 0.015});
  return {draw: (f) => {
    tube.draw(f);
    const d = f - CLEAN_F;
    tube.mat.uniforms.gain.value = f < CLEAN_F ? 0.92 + 0.08 * Math.sin(f * 1.7) : d < 2 ? 1.9 : 1 + 0.6 * Math.exp(-d * 0.35);
    const k = ease(f / 300), jolt = d >= 0 && d < 8 ? 0.0012 * Math.exp(-d * 0.5) * Math.sin(d * 3.1) : 0;
    camOn(e.camera, W, [lerp(-0.2, 0.05, k) + jolt, lerp(-0.08, -0.01, k), lerp(0.56, 0.44, k)], [lerp(-0.03, 0.04, k), 0], 40, lerp(-0.012, 0, k));
    L.set(e.camera.position.distanceTo(W.T));
  }};
});

// ---------- EngineDials: five round chamber-pressure gauges in an F-1 pattern, all needles steady on the mark. ----------
const MARK = 0.817; // the mark: about 980 psi on a 0-1200 scale
const gaugeFace = (n) => {
  const [c, g] = canvas(1024, 1024);
  g.fillStyle = '#08090a'; g.fillRect(0, 0, 1024, 1024);
  const [cx, cy] = [512, 512], a0 = Math.PI * 0.75, sw = Math.PI * 1.5, A = (s) => a0 + s * sw;
  g.lineCap = 'butt';
  // the green band round the mark
  g.strokeStyle = '#3fb86a'; g.lineWidth = 26; g.beginPath(); g.arc(cx, cy, 418, A(MARK - 0.05), A(MARK + 0.05)); g.stroke();
  g.strokeStyle = '#ece8d8'; g.fillStyle = '#ece8d8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i <= 60; i++) { const s = i / 60, a = A(s), big = i % 10 === 0, mid = i % 5 === 0, R0 = big ? 372 : mid ? 388 : 398; g.lineWidth = big ? 10 : mid ? 6 : 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); g.lineTo(cx + Math.cos(a) * 432, cy + Math.sin(a) * 432); g.stroke(); if (big) { g.font = '700 66px Arial, sans-serif'; g.fillText(String((i / 10) * 2), cx + Math.cos(a) * 306, cy + Math.sin(a) * 306); } }
  // the mark
  { const a = A(MARK); g.fillStyle = '#e8a53a'; g.beginPath(); g.moveTo(cx + Math.cos(a) * 442, cy + Math.sin(a) * 442); g.lineTo(cx + Math.cos(a + 0.05) * 490, cy + Math.sin(a + 0.05) * 490); g.lineTo(cx + Math.cos(a - 0.05) * 490, cy + Math.sin(a - 0.05) * 490); g.closePath(); g.fill(); }
  g.fillStyle = '#ece8d8'; g.font = '700 40px Arial, sans-serif'; g.fillText('CHAMBER PRESS', cx, cy + 130); g.font = '700 34px Arial, sans-serif'; g.fillText('PSI x 100', cx, cy + 182);
  g.font = '700 88px Arial, sans-serif'; g.fillText('F-1  ' + n, cx, cy - 170);
  return tex(c);
};
const makeGauge = (n, R = 0.07) => {
  const g = new THREE.Group(), chrome = M(0xcfcfca, 0.2, 1), black = M(0x101112, 0.45, 0.6);
  const t = gaugeFace(n);
  g.add(shade(new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({map: t, roughness: 0.55, emissive: 0xffc070, emissiveMap: t, emissiveIntensity: 0.34})), false));
  const prof = [[R * 0.99, -0.003], [R * 1.01, 0.0], [R * 1.02, 0.012], [R * 1.01, 0.016], [R * 1.09, 0.02], [R * 1.17, 0.018], [R * 1.2, 0.006], [R * 1.22, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const bez = shade(new THREE.Mesh(new THREE.LatheGeometry(prof, 72), chrome)); bez.rotation.x = Math.PI / 2; g.add(bez);
  g.add(shade(new THREE.Mesh(new THREE.RingGeometry(R * 1.2, R * 1.38, 72), black)));
  // the needle: a tapered blade on a hub, real geometry so it throws a shadow on the face
  const pivot = new THREE.Group(); pivot.position.z = 0.008; g.add(pivot);
  const s = new THREE.Shape(); s.moveTo(-R * 0.03, -R * 0.2); s.lineTo(R * 0.03, -R * 0.2); s.lineTo(R * 0.006, R * 0.84); s.lineTo(-R * 0.006, R * 0.84); s.closePath();
  pivot.add(shade(new THREE.Mesh(new THREE.ExtrudeGeometry(s, {depth: 0.0012, bevelEnabled: false}), new THREE.MeshStandardMaterial({color: 0xfff4dc, roughness: 0.4, emissive: 0xffd8a0, emissiveIntensity: 0.9}))));
  const hub = C(R * 0.08, R * 0.1, 0.006, M(0x1a1a1b, 0.3, 0.8), 0, 0, 0.003, 24); hub.rotation.x = Math.PI / 2; pivot.add(hub);
  const glassGeo = new THREE.SphereGeometry(R * 3.4, 48, 16, 0, Math.PI * 2, 0, Math.asin(1 / 3.4)); glassGeo.rotateX(Math.PI / 2);
  const glass = new THREE.Mesh(glassGeo, glassM([[[-0.35, 0.8, 0.5], 0.3, 0xfff0d8, 3.2], [[0.7, 0.25, 0.65], 0.22, 0xe8a53a, 1.0]])); glass.position.z = 0.018 - R * 3.4 * Math.cos(Math.asin(1 / 3.4)); glass.renderOrder = 3; g.add(glass);
  // the scale sweeps from 7:30 to 4:30, clockwise on the dial
  g.userData.setNeedle = (v) => { pivot.rotation.z = -(v - 0.5) * Math.PI * 1.5; };
  return g;
};
const consoleBack = () => { const g = new THREE.Group(), P = worn(0x3c4042, 0.6, 0.2); g.add(B(1.4, 1.5, 0.3, P, 0, 0.75, -0.4, 0.02), B(0.3, 0.62, 0.7, P, -0.5, 0.31, 0.25, 0.01), B(0.3, 0.62, 0.7, P, 0.5, 0.31, 0.25, 0.01)); return g; };
export const EngineDials = () => useScene((e) => {
  room(e, 0.02, 60);
  e.final.bloom.value = 0.7; e.final.exposure.value = 1.15; e.final.vign.value = 1.0;
  envOf(e, [[-3, 5, 3, 5, 1.2, 0xf0e4d0, 3.2], [5, 1, 4, 1, 4, 0xe8a53a, 1.4], [0, -2, 6, 8, 1, 0x304038, 0.6], [-1, 2, 7, 5, 2, 0xe8dcc8, 1.3]]);
  floorRoom(e, {wall: 0x101214});
  // the console: a sloped sheet of worn grey metal in a heavier frame
  const pn = new THREE.Group(); pn.position.set(0, 1.02, 0); pn.rotation.x = -0.26; e.scene.add(pn);
  const metal = worn(0x555a5b, 0.62, 0.25), rail = M(0x24272a, 0.45, 0.5);
  pn.add(B(0.94, 0.72, 0.03, metal, 0, 0, -0.018, 0.006));
  pn.add(B(0.98, 0.03, 0.05, rail, 0, 0.375, -0.012, 0.01), B(0.98, 0.03, 0.05, rail, 0, -0.375, -0.012, 0.01), B(0.03, 0.78, 0.05, rail, -0.485, 0, -0.012, 0.01), B(0.03, 0.78, 0.05, rail, 0.485, 0, -0.012, 0.01));
  e.scene.add(B(1.3, 0.05, 0.6, M(0x181a1c, 0.4, 0.1), 0, 0.62, 0.36, 0.012));
  e.scene.add(consoleBack());
  // five dials: four round one, the way the five F-1s sit under the first stage; number 5 is the centre engine
  const D = 0.205, spots = [[1, D, D], [2, -D, D], [3, -D, -D], [4, D, -D], [5, 0, 0]], gs = spots.map(([n, x, y]) => { const g = makeGauge(n); g.position.set(x, y, 0); pn.add(g); return {g, n, x, y}; });
  // screws, and buttons down the sides
  const sc = M(0x98989a, 0.3, 0.9);
  spots.forEach(([, x, y]) => { for (const [a, b] of [[-0.082, 0.082], [0.082, 0.082], [-0.082, -0.082], [0.082, -0.082]]) { const q = C(0.0045, 0.0045, 0.003, sc, x + a, y + b, 0.001, 10); q.rotation.x = Math.PI / 2; pn.add(q); } });
  for (let i = 0; i < 44; i++) { const x = -0.44 + (i % 22) * 0.042, y = i < 22 ? 0.35 : -0.35, q = C(0.004, 0.004, 0.003, sc, x, y, 0.001, 8); q.rotation.x = Math.PI / 2; pn.add(q); }
  [[-0.38, 0.05], [0.38, 0.05]].forEach(([x, y], i) => { const m = pbi(9, 2, 0.028, 0.022, 90 + i * 7, 0.14, [0xffa030, 0x47ff8a]); m.position.set(x, y, 0.004); pn.add(m); });
  const fk = pbi(3, 18, 0.03, 0.022, 121, 0.3, [0xffa030, 0x47ff8a, 0xe8e8d0]); fk.position.set(0, 0.665, 0.56); fk.rotation.x = -Math.PI / 2 + 0.2; e.scene.add(fk);
  pn.updateMatrixWorld(true);
  const centre = new THREE.Vector3(); pn.getWorldPosition(centre);
  const key = spot(e, 0xffe6c8, 4.6, [-0.9, 2.4, 1.5], [0.05, 0.98, 0], 0.46, 0.95, 1.7, 2048, 0.5, 5);
  key.shadow.bias = -0.00015; key.shadow.normalBias = 0.0008;
  const amber = new THREE.PointLight(0xe8a53a, 0.3, 1.5, 1.5); amber.position.set(0.5, 1.1, 0.5); e.scene.add(amber);
  e.scene.add(new THREE.AmbientLight(0x4a4c50, 0.2));
  const L = lens(e, {focus: 0.4, ap: 20, maxB: 22, grain: 0.015});
  const fd = dust(e, 30, [-0.7, 0.7], [0.7, 1.7], [0.2, 1.2], 0xffe2bc, 0.0016, 21, 0.1);
  const inv = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0).applyQuaternion(pn.quaternion), nn = new THREE.Vector3(0, 0, 1).applyQuaternion(pn.quaternion);
  const WP = (a, b, c) => centre.clone().addScaledVector(inv, a).addScaledVector(up, b).addScaledVector(nn, c);
  return {draw: (f) => {
    fd.value = f;
    // each needle on the mark, with only the tremble of a real instrument
    gs.forEach(({g, n}) => g.userData.setNeedle(MARK + noiseV(f + n * 37, 0.47) * 0.0022 + noiseV(f + n * 11, 1.31) * 0.0011));
    // starts low and tight on engine 5's needle, climbs back until all five are in, and keeps drifting
    const k = ease((f - 20) / 200), k2 = ease(f / 300);
    const pos = WP(lerp(-0.16, 0.36, k) + (k2 - k) * 0.03, lerp(-0.1, -0.2, k), lerp(0.2, 0.84, k) + k2 * 0.03);
    e.camera.up.set(lerp(-0.035, 0.008, k), 1, 0);
    e.camera.position.copy(pos);
    e.camera.lookAt(WP(lerp(0.015, 0.0, k), lerp(0.02, -0.005, k), 0));
    e.camera.fov = lerp(44, 38, k);
    L.set(pos.distanceTo(WP(0, 0, 0)), lerp(24, 3.2, ease((f - 90) / 130)));
  }};
});

// ---------- PlotBoard: the big screen. Altitude against range, the planned line and the real line right on it. ----------
// a first-stage ascent profile, nautical miles (rough fit to a Saturn V ascent; the shape is the point, the editor tags it a reconstruction)
const KNOTS = [[0, 0, 0], [30, 0, 1.1], [60, 0.8, 3.9], [78, 2.7, 7.2], [100, 8.6, 13], [120, 18.9, 20], [135, 30.2, 25.2], [162, 50.2, 36.2], [190, 75, 47.5]];
const profile = (t) => { for (let i = 1; i < KNOTS.length; i++) { const [a, r0, h0] = KNOTS[i - 1], [b, r1, h1] = KNOTS[i]; if (t <= b) { const s = (t - a) / (b - a); return [lerp(r0, r1, s), lerp(h0, h1, s)]; } } return [KNOTS[8][1], KNOTS[8][2]]; };
export const PlotBoard = () => useScene((e) => {
  room(e, 0.05, 200);
  e.final.bloom.value = 0.85; e.final.exposure.value = 1.05; e.final.vign.value = 1.0;
  RectAreaLightUniformsLib.init();
  envOf(e, [[0, 2, -8, 8, 4, 0x9fc8b8, 1.2]]);
  floorRoom(e, {w: 22, d: 30, h: 8, wall: 0x232a2e, zBack: 8});
  const [c, g] = canvas(2048, 1024), map = tex(c), SW = 9.6, SH = 4.8;
  const X0 = 190, Y0 = 900, X1 = 1960, Y1 = 90, RX = (r) => X0 + (r / 50) * (X1 - X0), HY = (h) => Y0 - (h / 40) * (Y0 - Y1);
  const base = (() => { const [b, q] = canvas(2048, 1024);
    q.fillStyle = '#02050a'; q.fillRect(0, 0, 2048, 1024);
    const rad = q.createRadialGradient(1024, 480, 80, 1024, 512, 1200); rad.addColorStop(0, 'rgba(46,74,70,0.55)'); rad.addColorStop(1, 'rgba(10,18,20,0)'); q.fillStyle = rad; q.fillRect(0, 0, 2048, 1024);
    q.strokeStyle = 'rgba(165,205,190,0.25)'; q.lineWidth = 1.5;
    for (let r = 0; r <= 50; r += 2.5) { q.beginPath(); q.moveTo(RX(r), Y1); q.lineTo(RX(r), Y0); q.stroke(); }
    for (let h = 0; h <= 40; h += 2.5) { q.beginPath(); q.moveTo(X0, HY(h)); q.lineTo(X1, HY(h)); q.stroke(); }
    q.strokeStyle = 'rgba(190,230,212,0.6)'; q.lineWidth = 3;
    for (let r = 0; r <= 50; r += 10) { q.beginPath(); q.moveTo(RX(r), Y1); q.lineTo(RX(r), Y0); q.stroke(); }
    for (let h = 0; h <= 40; h += 10) { q.beginPath(); q.moveTo(X0, HY(h)); q.lineTo(X1, HY(h)); q.stroke(); }
    q.strokeStyle = 'rgba(214,240,226,0.95)'; q.lineWidth = 5; q.strokeRect(X0, Y1, X1 - X0, Y0 - Y1);
    q.fillStyle = 'rgba(214,240,226,0.95)'; q.font = '700 40px "Courier New", monospace'; q.textAlign = 'center'; q.textBaseline = 'top';
    for (let r = 0; r <= 50; r += 10) q.fillText(String(r), RX(r), Y0 + 14);
    q.textAlign = 'right'; q.textBaseline = 'middle'; for (let h = 0; h <= 40; h += 10) q.fillText(String(h), X0 - 18, HY(h));
    q.textAlign = 'center'; q.textBaseline = 'alphabetic'; q.font = '700 42px "Courier New", monospace'; q.fillText('RANGE  N MI', (X0 + X1) / 2, 1012);
    q.save(); q.translate(70, (Y0 + Y1) / 2); q.rotate(-Math.PI / 2); q.fillText('ALTITUDE  N MI', 0, 0); q.restore();
    // the planned line, drawn before the flight
    q.strokeStyle = '#c8f5d8'; q.lineWidth = 6; q.lineJoin = 'round'; q.save(); q.beginPath(); q.rect(X0, Y1, X1 - X0, Y0 - Y1); q.clip(); q.beginPath();
    for (let t = 0; t <= 190; t += 1) { const [r, h] = profile(t); const x = RX(r), y = HY(h); if (t === 0) q.moveTo(x, y); else q.lineTo(x, y); } q.stroke(); q.restore();
    return b; })();
  const paint = (f) => {
    g.drawImage(base, 0, 0);
    const end = lerp(62, 118, ease(f / 300));
    g.save(); g.beginPath(); g.rect(X0, Y1, X1 - X0, Y0 - Y1); g.clip();
    g.lineJoin = 'round'; g.lineCap = 'round';
    const tr = () => { g.beginPath(); for (let t = 0; t <= end; t += 0.5) { const [r, h] = profile(t), x = RX(r), y = HY(h); if (t === 0) g.moveTo(x, y); else g.lineTo(x, y); } };
    g.strokeStyle = 'rgba(255,170,50,0.5)'; g.lineWidth = 15; tr(); g.stroke();
    g.strokeStyle = '#ffc25a'; g.lineWidth = 7; tr(); g.stroke();
    const [r, h] = profile(end), x = RX(r), y = HY(h);
    g.strokeStyle = '#fff2d0'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x + 22, y); g.moveTo(x, y - 22); g.lineTo(x, y + 22); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
    g.restore(); map.needsUpdate = true;
  };
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({map, color: new THREE.Color(1.5, 1.5, 1.5)})); scr.position.set(0, 3.75, -16); e.scene.add(scr);
  // the frame and the wall round the big screen, the two dim side screens
  const wallM = worn(0x1a1e20, 0.72, 0.15);
  [[0, 3.75 + SH / 2 + 0.12, SW + 0.5, 0.24], [0, 3.75 - SH / 2 - 0.12, SW + 0.5, 0.24]].forEach(([x, y, w, h]) => e.scene.add(B(w, h, 0.2, wallM, x, y, -15.95, 0.02)));
  [-SW / 2 - 0.12, SW / 2 + 0.12].forEach((x) => e.scene.add(B(0.24, SH + 0.5, 0.2, wallM, x, 3.75, -15.95, 0.02)));
  const side = (() => { const [b, q] = canvas(512, 512); q.fillStyle = '#02060a'; q.fillRect(0, 0, 512, 512); q.strokeStyle = 'rgba(130,180,165,0.3)'; q.lineWidth = 2; for (let i = 1; i < 10; i++) { q.beginPath(); q.moveTo(i * 51, 10); q.lineTo(i * 51, 502); q.stroke(); q.beginPath(); q.moveTo(10, i * 51); q.lineTo(502, i * 51); q.stroke(); } q.strokeStyle = 'rgba(180,235,205,0.75)'; q.lineWidth = 4; q.beginPath(); for (let x = 0; x <= 512; x += 8) { const y = 260 + Math.sin(x * 0.014) * 120; if (x === 0) q.moveTo(x, y); else q.lineTo(x, y); } q.stroke(); return tex(b); })();
  [-7.2, 7.2].forEach((x) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), new THREE.MeshBasicMaterial({map: side, color: new THREE.Color(0.4, 0.4, 0.4)})); m.position.set(x, 3.75, -15.9); m.rotation.y = x < 0 ? 0.16 : -0.16; e.scene.add(m); });
  // light off the screen onto the room: soft from the area light, and a spot for the long shadows of the console rows
  const rect = new THREE.RectAreaLight(0xc8f0e0, 7, SW, SH); rect.position.set(0, 3.75, -15.8); rect.lookAt(0, 1, 0); e.scene.add(rect);
  spot(e, 0xc8f0e0, 90, [0, 4.2, -15.5], [0, 0.6, 2], 0.55, 0.9, 1.7, 2048, 2, 30);
  e.scene.add(new THREE.AmbientLight(0x263036, 0.2));
  // rows of consoles, stepping up towards the camera; their tubes on, dim
  const dimT = makeTube(0.54, 0.405, (q) => { const r = rng(101); q.fillStyle = '#000'; q.fillRect(0, 0, 1536, 1152); q.fillStyle = '#fff'; q.font = '700 52px "Courier New", monospace'; q.textBaseline = 'top'; for (let i = 0; i < 16; i++) { q.fillText(NAMES[Math.floor(r() * 16)], 80, 120 + i * 60); q.fillText((r() * 200).toFixed(1).padStart(7, ' '), 800, 120 + i * 60); } });
  dimT.draw(0); dimT.mat.uniforms.gain.value = 0.28;
  [[-9.5, 0], [-5.8, 0.34], [-2.1, 0.68]].forEach(([z, y], ri) => {
    const floor = shade(new THREE.Mesh(new THREE.BoxGeometry(22, y + 0.001, 3.7), M(0x2a2e30, 0.9, 0)), false); floor.position.set(0, y / 2, z + 1.1); e.scene.add(floor);
    for (let i = -4; i <= 4; i++) { const u = consoleUnit({tube: {grp: dimT.grp.clone(true)}, seed: 30 + i + ri * 9, chance: 0.22}); u.position.set(i * 1.08 + (ri % 2) * 0.3, y, z); e.scene.add(u); }
  });
  const L = lens(e, {focus: 14, ap: 1.6, maxB: 22, grain: 0.016});
  const fd = {value: 0};
  return {draw: (f) => {
    paint(f); fd.value = f;
    const k = ease(f / 330);
    e.camera.up.set(0, 1, 0);
    e.camera.position.set(lerp(-1.3, -0.5, k), lerp(2.95, 2.62, k), lerp(0.4, -0.9, k));
    e.camera.lookAt(lerp(-0.2, -0.75, k), lerp(2.92, 3.42, k), -16);
    e.camera.fov = lerp(46, 31, k);
    L.set(e.camera.position.distanceTo(scr.position));
  }};
});

// ---------- NightConsole: an empty console row at night, from behind a chair, one screen lit, no person. ----------
export const NightConsole = () => useScene((e) => {
  room(e, 0.05, 80);
  const tube = makeTube(0.54, 0.405, (g, f) => paintTable(g, SQUIRRELLY, 'GMT', 8 * 3600 + 41 * 60 + 12 + f / 30), [[[-0.5, 0.55, 0.65], 0.34, 0xe8a53a, 0.4]]);
  e.final.bloom.value = 0.7; e.final.exposure.value = 1.18; e.final.vign.value = 1.3;
  envOf(e, [[0.5, 1.5, -5, 2, 1.5, 0x8fd8a8, 1.4], [-10, 3, -8, 3, 2, 0xe8a53a, 0.22]]);
  floorRoom(e, {w: 22, d: 24, h: 4.6, wall: 0x0b0d0f, zBack: 7});
  const units = [];
  for (let i = -3; i <= 3; i++) { const u = consoleUnit(i === 0 ? {tube, name: 'EECOM', seed: 3, chance: 0.12} : {seed: 60 + i * 7, chance: 0.012}); u.position.x = i * 1.08; e.scene.add(u); units.push(u); }
  // the row in front, its back to us, and a shape of the dark wall screens beyond
  for (let i = -4; i <= 4; i++) { const u = consoleUnit({seed: 90 + i * 3, chance: 0}); u.position.set(i * 1.08 + 0.4, 0, -3.6); e.scene.add(u); }
  const W = tubeWorld(units[3], tube);
  const ch = chair(); ch.position.set(0.62, 0, 1.55); ch.rotation.y = 0.32; e.scene.add(ch);
  const m = mug(); m.position.set(0.4, 0.757, 0.3); e.scene.add(m);
  const b = binder(); b.position.set(-0.3, 0.757, 0.28); b.rotation.y = 0.12; e.scene.add(b);
  spot(e, 0xc4ecd0, 3.2, [W.T.x, W.T.y, W.T.z + 0.12], [0.05, 0.3, 3], 1.15, 0.9, 1.5, 2048, 0.05, 12);
  const fill = new THREE.PointLight(0xc4ecd0, 0.5, 4, 1.5); fill.position.copy(W.T).addScaledVector(W.N, 0.26); e.scene.add(fill);
  // the only other light: a low tungsten wash far off down the room, for the row's edge
  spot(e, 0xe8a53a, 7, [-9, 4, 1], [-2.6, 0.9, -0.3], 0.34, 0.9, 1.4, 0);
  spot(e, 0xe8a53a, 9, [-9, 4.2, -4], [-1.5, 1.2, -3.8], 0.36, 0.9, 1.4, 0);
  spot(e, 0xc89860, 2.2, [2.6, 3.4, 5.4], [0.62, 0.85, 1.75], 0.3, 0.9, 1.5, 0);
  e.scene.add(new THREE.AmbientLight(0x2a3438, 0.1));
  // far wall screens, off but catching a little
  [-5.4, 0, 5.4].forEach((x) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(x === 0 ? 7 : 3.4, 3), new THREE.MeshBasicMaterial({color: new THREE.Color(0.018, 0.024, 0.026)})); s.position.set(x, 2.8, -16.9); e.scene.add(s); });
  const L = lens(e, {focus: 2, ap: 22, maxB: 24, grain: 0.022});
  const fd = dust(e, 30, [-1.2, 1.2], [0.8, 1.7], [0.3, 1.6], 0xd0e8d8, 0.0035, 44, 0.1);
  return {draw: (f) => {
    tube.draw(f); fd.value = f;
    const k = ease(f / 300);
    e.camera.up.set(lerp(0.01, -0.006, k), 1, 0);
    e.camera.position.set(lerp(1.18, 0.62, k), lerp(1.68, 1.5, k), lerp(3.6, 2.85, k));
    e.camera.lookAt(lerp(-0.1, 0.0, k), lerp(1.02, 1.12, k), 0);
    e.camera.fov = lerp(40, 33, k);
    L.set(e.camera.position.distanceTo(W.T));
  }};
});

// ---------- DriveHome: the hood and windscreen of a late-sixties sedan on a dark, flat road: headlights, a white centre line, no rain, no driver in frame. ----------
export const DriveHome = () => useScene((e) => {
  const {renderer, scene, camera} = e;
  indoors(e); camera.near = 0.05; camera.far = 4200; renderer.shadowMap.enabled = false;
  e.skyHi.set(0.0035, 0.0055, 0.012); e.skyLo.set(0.03, 0.021, 0.018);
  e.final.bloom.value = 0.85; e.final.exposure.value = 1.15; e.final.vign.value = 1.1;
  envOf(e, [[0, 9, -2, 18, 10, 0x1a2436, 0.5], [0, 1.2, -12, 24, 2.0, 0x8a8078, 0.42], [0, 2, 8, 4, 2, 0x0a0a0a, 0.2]], 0x000000, 1);
  const V = 0.62; // metres a frame: about 42 mph
  // the road: tar, seams, patches; scrolled by moving the texture
  const roadT = (() => { const [c, g] = canvas(1024, 1024), r = rng(1234); g.fillStyle = '#4c4b49'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 26000; i++) { const v = 40 + r() * 60; g.fillStyle = `rgba(${v},${v},${v * 0.97},${0.2 + r() * 0.3})`; g.fillRect(r() * 1024, r() * 1024, 1 + r() * 2.5, 1 + r() * 2.5); }
    for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(14,14,14,${0.12 + r() * 0.2})`; g.fillRect(r() * 1024, r() * 1024, 60 + r() * 200, 60 + r() * 300); }
    g.strokeStyle = 'rgba(8,8,8,0.34)'; for (let i = 0; i < 7; i++) { g.lineWidth = 0.8 + r() * 1.2; let x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 16; k++) { x += (r() - 0.5) * 40; y += 12 + r() * 40; g.lineTo(x, y); } g.stroke(); }
    return tex(c, true, [1, 3]); })();
  const RW = 7.4, RC = -1.75, RL = 900;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(RW, RL), new THREE.MeshStandardMaterial({map: roadT, roughness: 0.82, metalness: 0})); road.rotation.x = -Math.PI / 2; road.position.set(RC, 0, -RL / 2 + 30); scene.add(road);
  roadT.repeat.set(1, RL / 18);
  const grassT = (() => { const [c, g] = canvas(1024, 1024), r = rng(77); g.fillStyle = '#3a3a24'; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 30000; i++) { const v = r(); g.strokeStyle = v < 0.5 ? `rgba(120,118,70,${r() * 0.5})` : `rgba(18,20,10,${r() * 0.6})`; g.lineWidth = 1 + r(); const x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 8, y - 8 - r() * 22); g.stroke(); } return tex(c, true, [1, 1]); })();
  grassT.repeat.set(4, RL / 12);
  [RC - RW / 2 - 15, RC + RW / 2 + 15].forEach((x) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(30, RL), new THREE.MeshStandardMaterial({map: grassT, roughness: 1})); m.rotation.x = -Math.PI / 2; m.position.set(x, -0.02, -RL / 2 + 30); scene.add(m); });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshBasicMaterial({color: 0x010101})); far.rotation.x = -Math.PI / 2; far.position.y = -0.2; scene.add(far);
  // the edges of the tar are rough, a broken dark strip
  [RC - RW / 2, RC + RW / 2].forEach((x) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, RL), new THREE.MeshStandardMaterial({map: grassT, color: 0x77664c, roughness: 1})); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.002, -RL / 2 + 30); scene.add(m); });
  // the broken white centre line
  const DASH = 4.6, GAP = 7.6, P = DASH + GAP, dashN = 74, dashG = new THREE.PlaneGeometry(0.11, DASH); dashG.rotateX(-Math.PI / 2);
  const dashT = (() => { const [c, g] = canvas(64, 256), r = rng(9); g.fillStyle = '#c9c6ba'; g.fillRect(0, 0, 64, 256); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(40,40,40,${r() * 0.6})`; g.fillRect(r() * 64, r() * 256, 1 + r() * 4, 1 + r() * 6); } return tex(c); })();
  const dashes = new THREE.InstancedMesh(dashG, new THREE.MeshStandardMaterial({map: dashT, roughness: 0.7}), dashN); dashes.frustumCulled = false; scene.add(dashes);
  // tufts by the road, for the speed; and fence posts, telephone poles and their wires
  const tuftG = (() => { const r = rng(3131), pos = [], nor = []; for (let i = 0; i < 26; i++) { const a = r() * 6.283, d = r() * 0.28, x = Math.cos(a) * d, z = Math.sin(a) * d, w = 0.012 + r() * 0.012, h = 0.3 + r() * 0.42, lx = (r() - 0.5) * 0.3, lz = (r() - 0.5) * 0.3, sx = Math.cos(a * 3) * w, sz = Math.sin(a * 3) * w; pos.push(x - sx, 0, z - sz, x + sx, 0, z + sz, x + lx, h, z + lz); nor.push(0, 0.7, 0.7, 0, 0.7, 0.7, 0, 0.7, 0.7); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g; })();
  const TN = 900, tufts = new THREE.InstancedMesh(tuftG, new THREE.MeshStandardMaterial({color: 0x6a6840, roughness: 1, side: THREE.DoubleSide}), TN); tufts.frustumCulled = false; scene.add(tufts);
  const tr = rng(555), tuftP = []; for (let i = 0; i < TN; i++) { const s = tr() < 0.5 ? -1 : 1; tuftP.push([s < 0 ? RC - RW / 2 - 0.2 - tr() * tr() * 11 : RC + RW / 2 + 0.2 + tr() * tr() * 11, tr() * 240, 0.6 + tr() * 1.1, tr() * 6]); }
  const postG = new THREE.CylinderGeometry(0.05, 0.06, 1.25, 6), PN = 56, posts = new THREE.InstancedMesh(postG, new THREE.MeshStandardMaterial({color: 0x5a5242, roughness: 0.95}), PN); posts.frustumCulled = false; scene.add(posts);
  const woodM = new THREE.MeshStandardMaterial({color: 0x3a3028, roughness: 0.95}), wireM = new THREE.MeshStandardMaterial({color: 0x121212, roughness: 0.6});
  const SPAN = 58, spans = [];
  for (let i = 0; i < 10; i++) { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 9, 8), woodM); p.position.y = 4.5; g.add(p); const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), woodM); arm.position.y = 8.3; g.add(arm);
    [-0.9, 0, 0.9].forEach((x) => { const pts = []; for (let k = 0; k <= 10; k++) { const s = k / 10; pts.push(new THREE.Vector3(x, 8.4 - 4 * s * (1 - s) * 0.9, -s * SPAN)); } g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 4), wireM)); });
    scene.add(g); spans.push(g); }
  // the far line of trees and the flat sky, a low glow from town, a few lights on the horizon, stars
  const hor = (() => { const [c, g] = canvas(4096, 256), r = rng(2020); g.clearRect(0, 0, 4096, 256); g.fillStyle = '#020303'; g.beginPath(); g.moveTo(0, 256); let y = 200; for (let x = 0; x <= 4096; x += 6) { y += (r() - 0.5) * 7; y = Math.max(160, Math.min(226, y)); const b = r() < 0.08 ? r() * 16 : 0; g.lineTo(x, y - b); } g.lineTo(4096, 256); g.closePath(); g.fill(); for (let i = 0; i < 14; i++) { g.fillStyle = r() < 0.5 ? '#ffc070' : '#fff0d8'; g.fillRect(r() * 4096, 214 + r() * 14, 3, 3); } const t = tex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1800, 1800, 110, 96, 1, true), new THREE.MeshBasicMaterial({map: hor, side: THREE.BackSide, transparent: true, depthWrite: false, color: new THREE.Color(2.2, 2.2, 2.2)})); band.position.y = 40; band.renderOrder = -1; scene.add(band);
  const sr = rng(808), starN = 2600, sp = new Float32Array(starN * 3), sc = new Float32Array(starN);
  for (let i = 0; i < starN; i++) { const a = sr() * Math.PI * 2, b = 0.03 + Math.pow(sr(), 1.1) * 1.3; const d = 3000; sp[i * 3] = Math.cos(a) * Math.cos(b) * d; sp[i * 3 + 1] = Math.sin(b) * d; sp[i * 3 + 2] = Math.sin(a) * Math.cos(b) * d; sc[i] = Math.pow(sr(), 5); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('mag', new THREE.BufferAttribute(sc, 1));
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: `in float mag; out float m; void main(){ m = mag; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 1.6 + mag * 1.8; }`, fragmentShader: `precision highp float; in float m; out vec4 o; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; o = vec4(vec3(0.85, 0.9, 1.0) * (0.05 + m * 1.0), 1.0 - smoothstep(0.3, 1.0, d)); }`})); stars.frustumCulled = false; scene.add(stars);

  // headlights
  [-0.64, 0.64].forEach((x) => { const l = new THREE.SpotLight(0xffdca6, 620, 0, 0.3, 0.75, 1.5); l.position.set(x, 0.72, -2.9); l.target.position.set(x * 0.6 - 0.1, 0, -40); scene.add(l, l.target); const w = new THREE.SpotLight(0xffd8a0, 26, 0, 0.75, 0.9, 1.6); w.position.set(x, 0.72, -2.9); w.target.position.set(x * 1.8, 0, -14); scene.add(w, w.target); });
  // the car, seen from the driver's eye: a long hood falling away, its crease lines, the ornament; the dash low
  const paint = new THREE.MeshStandardMaterial({color: 0x101820, roughness: 0.17, metalness: 0.7});
  const hoodG = new THREE.PlaneGeometry(1.74, 1.72, 48, 36); hoodG.rotateX(-Math.PI / 2);
  { const ps = hoodG.attributes.position; for (let i = 0; i < ps.count; i++) { const x = ps.getX(i), z = ps.getZ(i), s0 = (z + 0.86) / 1.72; /* s0: 0 far, 1 near */ const ax = Math.abs(x); const crown = -Math.pow(ax / 0.87, 2.6) * 0.1 - Math.pow(1 - s0, 2.0) * 0.17 + (0.018 * Math.exp(-Math.pow((ax - 0.43) * 22, 2))) - (0.008 * Math.exp(-Math.pow((ax - 0.47) * 40, 2))); ps.setY(i, crown); } hoodG.computeVertexNormals(); }
  const hood = new THREE.Mesh(hoodG, paint); hood.position.set(0, 0.885, -1.68); scene.add(hood);
  const chromeM = M(0xd4d4d4, 0.14, 1);
  const stripG = new THREE.BufferGeometry(); { const pos = [], idx = []; for (let i = 0; i <= 30; i++) { const s0 = i / 30, y = -Math.pow(1 - s0, 2.0) * 0.17 + 0.002, z = -0.86 + s0 * 1.72; pos.push(-0.006, y, z, 0.006, y, z); if (i < 30) { const a0 = i * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); } } stripG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); stripG.setIndex(idx); stripG.computeVertexNormals(); }
  const strip = new THREE.Mesh(stripG, chromeM); strip.position.copy(hood.position); scene.add(strip);
  const orn = new THREE.Group(); orn.add(B(0.022, 0.03, 0.09, chromeM, 0, 0, 0, 0.01)); const fin = B(0.007, 0.04, 0.08, chromeM, 0, 0.025, 0.012, 0.003); fin.rotation.x = -0.6; orn.add(fin); orn.position.set(0, 0.73, -2.46); scene.add(orn);
  scene.add(B(1.8, 0.02, 0.1, M(0x06080a, 0.45, 0.3), 0, 0.885, -0.8, 0.008));
  const padM = M(0x0e0e0f, 0.66, 0.02);
  scene.add(B(1.9, 0.14, 0.48, padM, 0, 0.85, -0.5, 0.05));
  // the road's light comes back up onto the front of the hood; the instruments, out of frame, light the dash a little
  const bounce = new THREE.PointLight(0xffdca6, 1.5, 3.2, 1.6); bounce.position.set(0, 0.34, -3.3); scene.add(bounce);
  const dashGlow = new THREE.PointLight(0xffa850, 0.05, 0.8, 1.4); dashGlow.position.set(-0.38, 0.97, -0.2); scene.add(dashGlow);
  // pillars, header, mirror, windscreen
  const bar = (a, b, w, d, mat) => { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), m = new THREE.Mesh(new RoundedBoxGeometry(w, d, A.distanceTo(Bv), 2, Math.min(w, d) * 0.4), mat); m.position.copy(A).add(Bv).multiplyScalar(0.5); m.lookAt(Bv); scene.add(m); return m; };
  const trim = M(0x09090a, 0.5, 0.2);
  bar([-0.92, 0.9, -0.76], [-0.75, 1.5, -0.02], 0.075, 0.05, trim); bar([0.92, 0.9, -0.76], [0.75, 1.5, -0.02], 0.075, 0.05, trim);
  scene.add(B(1.7, 0.06, 0.12, trim, 0, 1.51, -0.02, 0.02));
  const mir = B(0.24, 0.065, 0.012, M(0x0a0b0c, 0.12, 0.95), -0.12, 1.42, -0.1, 0.012); mir.rotation.x = 0.08; scene.add(mir);
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.0), glassM([[[-0.25, 0.72, 0.65], 0.14, 0xffa850, 0.22], [[0, 1, 0.1], 0.5, 0x1a2436, 0.1]])); ws.position.set(0, 1.2, -0.39); ws.rotation.x = -0.68; ws.renderOrder = 4; scene.add(ws);
  // the oncoming car: two sealed beams that grow out of the dark, and go by at 10 s
  const PASS = 300, oncoming = new THREE.Group(), lampM = new THREE.MeshBasicMaterial({color: new THREE.Color(7, 6, 4.4)});
  const glareT = (() => { const [c, g] = canvas(256, 256), r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,235,205,1)'); r.addColorStop(0.08, 'rgba(255,225,180,0.5)'); r.addColorStop(0.3, 'rgba(255,205,150,0.08)'); r.addColorStop(1, 'rgba(255,190,130,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); return tex(c); })();
  const glareM = new THREE.MeshBasicMaterial({map: glareT, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, color: new THREE.Color(1.4, 1.3, 1.15)});
  [-0.66, 0.66].forEach((x) => { const s0 = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), lampM); s0.position.x = x; oncoming.add(s0); const gl = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), glareM); gl.position.set(x, 0, 0.05); gl.renderOrder = 5; oncoming.add(gl); });
  oncoming.position.set(RC - RW / 4, 0.72, -1000); scene.add(oncoming);
  const oLight = new THREE.PointLight(0xffe2b4, 0, 0, 1.6); scene.add(oLight);
  const L = lens(e, {focus: 30, ap: 0.5, maxB: 20, grain: 0.024});
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  return {draw: (f) => {
    const dist = f * V;
    roadT.offset.y = (dist / 18) % 1; grassT.offset.y = (dist / 12) % 1;
    for (let i = 0; i < dashN; i++) { const z = -((((i * P - dist) % (dashN * P)) + dashN * P) % (dashN * P)); m4.makeTranslation(RC, 0.004, z + 12); dashes.setMatrixAt(i, m4); } dashes.instanceMatrix.needsUpdate = true;
    tuftP.forEach(([x, zz, sc2, rot], i) => { const z = 16 - (((zz - dist) % 240) + 240) % 240; q.setFromEuler(new THREE.Euler(0, rot, 0)); s3.set(1, sc2, 1); p3.set(x, 0, z); m4.compose(p3, q, s3); tufts.setMatrixAt(i, m4); }); tufts.instanceMatrix.needsUpdate = true;
    q.identity(); s3.set(1, 1, 1);
    for (let i = 0; i < PN; i++) { const z = 16 - (((i * 4.6 - dist) % (PN * 4.6)) + PN * 4.6) % (PN * 4.6); p3.set(RC + RW / 2 + 7.5, 0.62, z); m4.compose(p3, q, s3); posts.setMatrixAt(i, m4); } posts.instanceMatrix.needsUpdate = true;
    spans.forEach((g, i) => { const z = 40 - (((i * SPAN - dist) % (10 * SPAN)) + 10 * SPAN) % (10 * SPAN); g.position.set(RC - RW / 2 - 8, 0, z); });
    const oz = -(PASS - f) * (V + 0.68); oncoming.position.z = oz;
    oLight.position.set(RC - RW / 4, 0.9, oz + 2.5); oLight.intensity = oz < 2 ? clamp(1 - Math.abs(oz) / 180) ** 2 * 22 : 0;
    oncoming.visible = oz < 4;
    const by = noiseV(f, 0.19) * 0.004 + noiseV(f, 0.73) * 0.0016, sw = noiseV(f, 0.031) * 0.0035;
    camera.up.set(0, 1, 0);
    camera.position.set(-0.36, 1.3 + by, 0.45); camera.fov = 40;
    camera.lookAt(-0.3 + sw * 90, -1.45 + by * 0.5, -40);
    L.set(32);
  }};
});

// ---------- Circuit: a schematic drawn on, line by line, in amber on dark paper under a lamp. Ends with one highlighted path to a box. ----------
const buildCircuit = () => {
  // the sheet: ink is what's on the paper, tA says when each pixel is drawn (0-1 of the drawing), tB when it lights as the highlighted path
  const SW = 4096, SH = 2896, K = 0.5;
  const [ic, ig] = canvas(SW, SH), [ac, ag] = canvas(SW * K, SH * K), [bc, bg] = canvas(SW * K, SH * K);
  ig.fillStyle = '#000'; ig.fillRect(0, 0, SW, SH); ag.fillStyle = '#fff'; ag.fillRect(0, 0, ac.width, ac.height); bg.fillStyle = '#fff'; bg.fillRect(0, 0, bc.width, bc.height);
  ig.strokeStyle = '#fff'; ig.fillStyle = '#fff'; ig.lineCap = 'round'; ig.lineJoin = 'round';
  ag.lineCap = bg.lineCap = 'round'; ag.globalCompositeOperation = 'darken'; bg.globalCompositeOperation = 'darken';
  const items = [];
  const wire = (pts, lw = 6) => items.push({k: 'l', pts, lw});
  const text = (t, x, y, size = 44, align = 'left') => items.push({k: 't', t, x, y, size, align});
  const circleP = (x, y, r, n = 28) => { const p = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return p; };
  const box = (x, y, w, h, name, lw = 7, size = 56) => { wire([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], lw); if (name) text(name, x + w / 2, y + h / 2, size, 'center'); };
  const res = (x, y, n = 6, s = 18, a = 16) => { const p = [[x, y]]; for (let i = 0; i < n; i++) p.push([x + s * (i + 0.5), y + (i % 2 ? a : -a)]); p.push([x + s * n, y]); wire(p, 5); return x + s * n; };
  const cb = (x, y, w = 76) => { const p = []; for (let i = 0; i <= 16; i++) { const a = Math.PI - (i / 16) * Math.PI; p.push([x + w / 2 + Math.cos(a) * w / 2, y - Math.sin(a) * w * 0.42]); } wire(p, 5); return x + w; };
  const dio = (x, y, s = 30) => { wire([[x, y - s * 0.7], [x + s, y], [x, y + s * 0.7], [x, y - s * 0.7]], 5); wire([[x + s, y - s * 0.7], [x + s, y + s * 0.7]], 5); return x + s; };
  const dot = (x, y) => items.push({k: 'd', x, y});

  // the left: three fuel cells and two batteries, into the two main buses
  const FX = 150, BUS = [860, 1060];
  [[320, 'FC 1'], [600, 'FC 2'], [880, 'FC 3']].forEach(([y, n], i) => {
    box(FX, y - 90, 300, 180, n);
    const x1 = cb(FX + 370, y); wire([[FX + 300, y], [FX + 370, y]]); wire([[x1, y], [x1 + 60, y]]); const x2 = dio(x1 + 60, y); wire([[x2, y], [BUS[i % 2], y]]); dot(BUS[i % 2], y);
    text('CB ' + (i + 1), FX + 408, y - 62, 34, 'center');
  });
  [[1270, 'BAT A', 0], [1600, 'BAT B', 1]].forEach(([y, n, i]) => {
    box(FX, y - 90, 300, 180, n);
    const x1 = res(FX + 300, y); wire([[x1, y], [x1 + 90, y]]); const x2 = cb(x1 + 90, y); wire([[x2, y], [BUS[i], y]]); dot(BUS[i], y);
  });
  wire([[BUS[0], 160], [BUS[0], 2420]], 11); wire([[BUS[1], 160], [BUS[1], 2420]], 11);
  text('MN BUS A', BUS[0], 120, 32, 'center'); text('MN BUS B', BUS[1], 120, 32, 'center');
  // the middle: inverters to the AC buses, branches of breakers going off to loads
  const AC = [1960, 2130];
  [[330, 'INV 1', 0], [640, 'INV 2', 1], [950, 'INV 3', 0]].forEach(([y, n, i]) => {
    wire([[BUS[i], y], [1240, y]]); const x1 = cb(1240, y); wire([[x1, y], [1400, y]]); box(1400, y - 80, 300, 160, n); wire([[1700, y], [1800, y]]); const x2 = res(1800, y, 3, 18, 14); wire([[x2, y], [AC[i], y]]); dot(BUS[i], y); dot(AC[i], y);
  });
  wire([[AC[0], 160], [AC[0], 1350]], 11); wire([[AC[1], 160], [AC[1], 1350]], 11);
  text('AC BUS 1', AC[0], 120, 28, 'center'); text('AC BUS 2', AC[1], 120, 28, 'center');
  ['CRYO HTR', 'SUIT FAN', 'CABIN FAN', 'GLY PUMP', 'S BAND', 'TAPE', 'BMAG', 'ISS'].forEach((n, i) => {
    const y = 1220 + i * 122, b = i % 2; wire([[BUS[b], y], [1260, y]], 5); dot(BUS[b], y); const x1 = cb(1260, y, 60); wire([[x1, y], [1420, y]], 5); const x2 = res(1420, y, 4, 16, 12); wire([[x2, y], [1590, y]], 5); box(1590, y - 40, 280, 80, n, 5, 38);
  });
  // the upper right: sensors feeding the box
  const SX = 2640, SY = 1240, SWd = 680, SHt = 500;
  for (let i = 0; i < 9; i++) { const y = 240 + i * 92; wire(circleP(2420, y, 26), 5); wire([[2446, y], [2560 + i * 8, y], [2560 + i * 8, SY - 20 - (8 - i) * 6], [SX + 40 + i * 64, SY - 20 - (8 - i) * 6], [SX + 40 + i * 64, SY]], 5); text('T' + (101 + i * 7), 2300, y, 34, 'center'); }
  wire([[AC[0], 1320], [2400, 1320], [2400, 1560], [2480, 1560]], 6); dot(AC[0], 1320);
  // to the data system, off to the right
  wire([[SX + SWd, SY + 170], [3700, SY + 170]], 6); box(3700, SY + 90, 300, 160, 'PCM', 7, 52);
  wire([[3850, SY + 250], [3850, 1960], [3500, 1960]], 6); box(3180, 1880, 320, 160, 'S BAND', 7, 50);
  wire([[3180, 1960], [2960, 1960]], 6); text('TO HOUSTON', 2780, 1960, 40, 'center');
  // the switch: NORM above, AUX below
  const swX = 2480, swN = 1560, swA = 1740;
  wire(circleP(swX, swN, 10, 14), 5); wire(circleP(swX, swA, 10, 14), 5);
  text('NORM', swX - 30, swN - 40, 40, 'right'); text('AUX', swX - 30, swA + 42, 40, 'right');
  wire(circleP(swX + 90, 1650, 10, 14), 5);
  wire([[swX, swN], [swX + 90, 1650]], 6);
  // the box itself, heavy
  box(SX, SY, SWd, SHt, '', 11); text('SCE', SX + SWd / 2, SY + SHt / 2 - 40, 150, 'center'); text('SIGNAL CONDITIONING', SX + SWd / 2, SY + SHt / 2 + 80, 40, 'center');
  wire([[swX + 100, 1650], [SX, 1650]], 6);
  // title block
  box(2900, 2330, 1060, 280, '', 6); wire([[2900, 2470], [3960, 2470]], 4); text('CSM INSTRUMENTATION POWER', 3430, 2400, 50, 'center'); text('SIMPLIFIED', 3430, 2540, 44, 'center');
  // the auxiliary supply and its way to the AUX contact: ordinary ink first, the highlight runs along it later
  const AUXY = 2300;
  wire([[BUS[0], AUXY], [1500, AUXY]], 6); box(1500, AUXY - 90, 380, 180, 'AUX SUPPLY', 7, 44); wire([[1880, AUXY], [2180, AUXY], [2180, swA], [swX - 10, swA]], 6); dot(BUS[0], AUXY);
  wire([[swX, swA], [swX + 90, 1650]], 3);
  // the highlighted path, in order: battery, bus, the auxiliary supply, the AUX contact, the switch, the box
  const path = [[450, 1270], [BUS[0], 1270], [BUS[0], AUXY], [1880, AUXY], [2180, AUXY], [2180, swA], [swX, swA], [swX + 90, 1650], [SX, 1650]];

  // when each stroke happens: left to right across the sheet in the order written
  const len = (it) => (it.k === 'l' ? it.pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - it.pts[i - 1][0], p[1] - it.pts[i - 1][1]) : 0), 0) : it.k === 't' ? 160 : 20);
  const total = items.reduce((s, it) => s + Math.max(60, len(it)), 0);
  let run = 0;
  const gray = (v) => { const c = Math.round(clamp(v) * 250); return `rgb(${c},${c},${c})`; };
  items.forEach((it) => {
    const L = Math.max(60, len(it)), t0 = (run * 0.88) / total, span = (L / total) * 3.2; run += L;
    if (it.k === 'l') {
      ig.lineWidth = it.lw; ig.beginPath(); it.pts.forEach((p, i) => (i ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1]))); ig.stroke();
      ag.lineWidth = (it.lw + 8) * K; let d = 0;
      for (let i = 1; i < it.pts.length; i++) {
        const [x0, y0] = it.pts[i - 1], [x1, y1] = it.pts[i], s = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(s / 20));
        for (let k = 0; k < n; k++) { const a = k / n, b = (k + 1) / n, tt = t0 + ((d + s * a) / Math.max(1, L)) * span; ag.strokeStyle = gray(tt); ag.beginPath(); ag.moveTo((x0 + (x1 - x0) * a) * K, (y0 + (y1 - y0) * a) * K); ag.lineTo((x0 + (x1 - x0) * b) * K, (y0 + (y1 - y0) * b) * K); ag.stroke(); }
        d += s;
      }
    } else if (it.k === 't') {
      ig.font = `700 ${it.size}px "Courier New", monospace`; ig.textAlign = it.align; ig.textBaseline = 'middle'; ig.fillText(it.t, it.x, it.y);
      const w = it.t.length * it.size * 0.62 + 20, x = it.align === 'center' ? it.x - w / 2 : it.align === 'right' ? it.x - w : it.x;
      ag.fillStyle = gray(t0 + span); ag.fillRect(x * K, (it.y - it.size * 0.7) * K, w * K, it.size * 1.4 * K);
    } else {
      ig.beginPath(); ig.arc(it.x, it.y, 13, 0, 7); ig.fill(); ag.fillStyle = gray(t0 + span * 0.5); ag.beginPath(); ag.arc(it.x * K, it.y * K, 20 * K, 0, 7); ag.fill();
    }
  });
  // the highlight mask, in tB, time along the path
  const plen = path.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);
  bg.fillStyle = gray(0); bg.fillRect(FX * K, 1180 * K, 300 * K, 180 * K);
  let d2 = 0; bg.lineWidth = 72 * K;
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1], [x1, y1] = path[i], s = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(s / 16));
    if (x0 === BUS[0] && x1 === 1880) { bg.fillStyle = gray((d2 + (1500 - BUS[0])) / plen * 0.92); bg.fillRect(1490 * K, (AUXY - 100) * K, 400 * K, 200 * K); }
    for (let k = 0; k < n; k++) { const a = k / n, b = (k + 1) / n; bg.strokeStyle = gray(((d2 + s * a) / plen) * 0.92); bg.beginPath(); bg.moveTo((x0 + (x1 - x0) * a) * K, (y0 + (y1 - y0) * a) * K); bg.lineTo((x0 + (x1 - x0) * b) * K, (y0 + (y1 - y0) * b) * K); bg.stroke(); }
    d2 += s;
  }
  // the box's outline and its name light with the end of the path
  bg.lineWidth = 30 * K; bg.strokeStyle = gray(0.94); bg.strokeRect(SX * K, SY * K, SWd * K, SHt * K); bg.fillStyle = gray(0.95); bg.fillRect((SX + 40) * K, (SY + 60) * K, (SWd - 80) * K, (SHt - 120) * K);
  const [gc, gg] = canvas(512, 362), [hc, hg] = canvas(512, 362), RB = 'blur(7px)';
  gg.fillStyle = '#000'; gg.fillRect(0, 0, 512, 362); gg.filter = RB; gg.strokeStyle = '#fff'; gg.lineWidth = 6; gg.lineCap = 'round'; gg.lineJoin = 'round'; gg.beginPath(); path.forEach((q, i) => (i ? gg.lineTo(q[0] / 8, q[1] / 8) : gg.moveTo(q[0] / 8, q[1] / 8))); gg.stroke(); gg.fillStyle = '#fff'; gg.fillRect(SX / 8, SY / 8, SWd / 8, SHt / 8); gg.fillRect(1500 / 8, (AUXY - 90) / 8, 380 / 8, 180 / 8); gg.fillRect(FX / 8, 1180 / 8, 300 / 8, 180 / 8);
  hg.filter = RB; hg.drawImage(bc, 0, 0, 512, 362);
  const t = (c, nomip) => { const x = new THREE.CanvasTexture(c); x.anisotropy = 8; if (nomip) { x.generateMipmaps = false; x.minFilter = THREE.LinearFilter; } return x; };
  return {ink: t(ic), a: t(ac, true), b: t(bc, true), glowM: t(gc, true), glowT: t(hc, true), boxAt: [(SX + SWd / 2) / SW, (SY + SHt / 2) / SH]};
};
const DRAW0 = 4, DRAW1 = 228, HL0 = 256, HL1 = 318;
export const Circuit = () => useScene((e) => {
  room(e, 0.015, 40);
  e.final.bloom.value = 0.24; e.final.exposure.value = 1.15; e.final.vign.value = 1.1;
  envOf(e, [[-2, 3, 1, 2, 1, 0xf0d8b0, 1.8], [3, 2, 3, 3, 1, 0x304050, 0.3]]);
  const PW = 1.0, PH = (PW * 2896) / 4096;
  // the desk: dark oak under the lamp
  const woodT = (() => { const [c, g] = canvas(2048, 1024), r = rng(3030); g.fillStyle = '#2a1a10'; g.fillRect(0, 0, 2048, 1024); for (let i = 0; i < 600; i++) { const y = r() * 1024; g.strokeStyle = `rgba(${r() < 0.5 ? '10,5,2' : '84,54,30'},${0.04 + r() * 0.16})`; g.lineWidth = 0.6 + r() * 2.4; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 2048; x += 64) g.lineTo(x, y + Math.sin(x * 0.004 + i) * 8 + (r() - 0.5) * 2); g.stroke(); } return tex(c, true, [1, 1]); })();
  const desk = shade(new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshStandardMaterial({map: woodT, roughness: 0.38, metalness: 0})), false); desk.rotation.x = -Math.PI / 2; e.scene.add(desk);
  // the paper: dark, with fibres and fold lines, lying not quite flat, one corner lifting
  const paperT = (() => { const [c, g] = canvas(2048, 1448), r = rng(606); g.fillStyle = '#23272e'; g.fillRect(0, 0, 2048, 1448); for (let i = 0; i < 26000; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? '255,245,225' : '0,0,0'},${r() * 0.07})`; g.lineWidth = 0.6; const x = r() * 2048, y = r() * 1448, a = r() * 7, n = 3 + r() * 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * n, y + Math.sin(a) * n); g.stroke(); } g.strokeStyle = 'rgba(255,245,225,0.16)'; g.lineWidth = 3; g.beginPath(); g.moveTo(1024, 0); g.lineTo(1024, 1448); g.moveTo(0, 724); g.lineTo(2048, 724); g.stroke(); return tex(c); })();
  const paperG = new THREE.PlaneGeometry(PW, PH, 96, 68); paperG.rotateX(-Math.PI / 2);
  { const ps = paperG.attributes.position; for (let i = 0; i < ps.count; i++) { const x = ps.getX(i) / PW + 0.5, z = ps.getZ(i) / PH + 0.5; const cr = Math.max(0, x + (1 - z) - 1.72); const fold = Math.exp(-Math.pow((x - 0.5) * 60, 2)) * 0.0012 + Math.exp(-Math.pow((z - 0.5) * 60, 2)) * 0.001; ps.setY(i, 0.0015 + cr * cr * 0.34 + fold + Math.sin(x * 9 + 1) * Math.sin(z * 7) * 0.0009); } paperG.computeVertexNormals(); }
  const paper = shade(new THREE.Mesh(paperG, new THREE.MeshStandardMaterial({map: paperT, roughness: 0.82, metalness: 0}))); paper.rotation.y = 0.05; e.scene.add(paper);
  const S = buildCircuit();
  const ink = new THREE.Mesh(paperG, new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {inkT: {value: S.ink}, tA: {value: S.a}, tB: {value: S.b}, gM: {value: S.glowM}, gT: {value: S.glowT}, drawn: {value: 0}, lit: {value: 0}, dim: {value: 1}},
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D inkT, tA, tB, gM, gT; uniform float drawn, lit, dim;
      void main(){ float k = texture(inkT, vUv).r; float ta = texture(tA, vUv).r, tb = texture(tB, vUv).r;
        float on = smoothstep(ta - 0.012, ta, drawn);
        float head = (1.0 - smoothstep(0.0, 0.03, abs(drawn - ta))) * (1.0 - step(0.99, ta));
        float hl = smoothstep(tb - 0.02, tb, lit) * (1.0 - step(0.985, tb));
        float hhead = (1.0 - smoothstep(0.0, 0.06, abs(lit - tb))) * (1.0 - step(0.985, tb)) * step(0.001, lit);
        vec3 amber = vec3(1.0, 0.56, 0.14);
        vec3 c = amber * (0.82 * dim + head * 2.2) * on * k + (vec3(1.0, 0.74, 0.36) * 1.9 * hl + vec3(1.0, 0.9, 0.7) * 2.6 * hhead) * k;
        float G = texture(gM, vUv).r, gt = (texture(gT, vUv).r - (1.0 - G)) / max(G, 0.02);
        c += vec3(1.0, 0.55, 0.16) * 0.34 * G * G * smoothstep(gt - 0.04, gt + 0.02, lit) * step(0.001, lit);
        o = vec4(c, 1.0); }`}));
  ink.rotation.y = 0.05; ink.renderOrder = 2; e.scene.add(ink);
  // what's lying on the sheet: a steel rule and a pencil; they throw real shadows
  const steel = M(0xbfc2c4, 0.24, 1);
  const rule = shade(new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.0025, 0.035, 1, 0.0008), steel)); rule.position.set(-0.2, 0.004, 0.31); rule.rotation.y = 0.11; e.scene.add(rule);
  const [tc, tg] = canvas(1536, 128); tg.fillStyle = '#b9bcbe'; tg.fillRect(0, 0, 1536, 128); tg.fillStyle = '#16181a'; for (let i = 0; i <= 180; i++) tg.fillRect(8 + i * 8.4, 0, i % 10 === 0 ? 3.4 : 1.8, i % 10 === 0 ? 56 : i % 5 === 0 ? 40 : 24); tg.font = '700 36px Arial'; for (let i = 0; i <= 18; i++) tg.fillText(String(i), 12 + i * 84, 96);
  const rt = new THREE.Mesh(new THREE.PlaneGeometry(0.455, 0.033), new THREE.MeshStandardMaterial({map: tex(tc), roughness: 0.34, metalness: 0.75})); rt.rotation.x = -Math.PI / 2; rt.position.set(0, 0.00135, 0); rule.add(rt);
  const pencil = new THREE.Group(); pencil.add(shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0039, 0.0039, 0.16, 6), M(0xc99024, 0.45, 0)))); const tip = shade(new THREE.Mesh(new THREE.ConeGeometry(0.0039, 0.018, 6), M(0xd9b98a, 0.7, 0))); tip.position.y = 0.089; pencil.add(tip); const fer = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.0041, 0.0041, 0.012, 6), M(0xbbbbbb, 0.3, 0.9))); fer.position.y = -0.086; pencil.add(fer);
  pencil.rotation.set(0, -0.5, Math.PI / 2); pencil.position.set(0.24, 0.0072, 0.27); e.scene.add(pencil);
  // the lamp is out of frame up on the left
  const lamp = spot(e, 0xffdcae, 7.5, [-0.55, 1.2, 0.34], [-0.04, 0, 0.0], 0.62, 1.0, 1.7, 2048, 0.3, 4);
  lamp.shadow.bias = -0.0001; lamp.shadow.normalBias = 0.0005;
  e.scene.add(new THREE.AmbientLight(0x2c2e34, 0.12));
  const uni = ink.material.uniforms;
  const L = lens(e, {focus: 0.5, ap: 18, maxB: 22, grain: 0.016});
  const boxW = new THREE.Vector3((S.boxAt[0] - 0.5) * PW, 0, (S.boxAt[1] - 0.5) * PH).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.05);
  // the first bit of drawing is at the sheet's left; the camera rides along it, rises to see all of it, then comes down on the box
  const path = [[0, [-0.52, 0.1, 0.1], [-0.38, 0.0, -0.22]], [120, [-0.05, 0.2, 0.4], [0.0, 0.0, -0.05]], [228, [-0.06, 0.82, 0.62], [-0.01, 0.0, 0.01]], [318, [-0.02, 0.74, 0.58], [0.03, 0.0, 0.0]], [390, [0.14, 0.27, 0.34], [boxW.x, 0.0, boxW.z]]];
  const keyed = (f, idx) => { let i = 1; while (i < path.length - 1 && f > path[i][0]) i++; const [f0, a0, b0] = path[i - 1], [f1, a1, b1] = path[i], s = ease((f - f0) / (f1 - f0)), A = idx === 1 ? a0 : b0, Bb = idx === 1 ? a1 : b1; return [lerp(A[0], Bb[0], s), lerp(A[1], Bb[1], s), lerp(A[2], Bb[2], s)]; };
  const tv = new THREE.Vector3();
  return {draw: (f) => {
    uni.drawn.value = clamp((f - DRAW0) / (DRAW1 - DRAW0)) * 1.02; uni.lit.value = clamp((f - HL0) / (HL1 - HL0)) * 1.02;
    uni.dim.value = lerp(1, 0.56, ease((f - HL0 + 10) / 40));
    const p = keyed(f, 1), t = keyed(f, 2);
    e.camera.up.set(0, 1, 0); e.camera.position.set(p[0], p[1], p[2]); e.camera.lookAt(t[0], t[1], t[2]); e.camera.fov = 40;
    L.set(e.camera.position.distanceTo(tv.set(t[0], t[1], t[2])), lerp(16, 3.5, ease((f - 130) / 90)) + 13 * ease((f - 330) / 50));
  }};
});

// ---------- SceBox: drums feed a box labelled SCE, then a dish, then a screen. At 6.0 s the switch goes NORM to AUX; the stream goes from scrambled to clean, reaching the screen at 7.0 s. ----------
const SW_F = 180, SCR_F = 210;
export const SceBox = () => useScene((e) => {
  room(e, 0.03, 90, true);
  const {scene, camera} = e;
  e.final.bloom.value = 0.8; e.final.exposure.value = 1.12; e.final.vign.value = 1.05;
  envOf(e, [[-3, 6, 3, 8, 2, 0xe8e0d0, 2.0], [7, 2, 2, 2, 4, 0x8fd8a8, 0.5], [-8, 1, -3, 2, 2, 0xe8a53a, 0.6]]);
  const world = new THREE.Group(), mirror = new THREE.Group(); scene.add(world);
  // the bench: dark and polished; what stands on it shows faintly in it
  const bench = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.MeshStandardMaterial({color: 0x0a0b0c, roughness: 0.3, metalness: 0.3, transparent: true, opacity: 0.86, map: mottle()})); bench.rotation.x = -Math.PI / 2; bench.receiveShadow = true; scene.add(bench);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 16), new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; void main(){ float d = length((vUv - vec2(0.5, 0.2)) * vec2(3.2, 3.0)); o = vec4(vec3(0.02, 0.024, 0.028) * (1.0 - smoothstep(0.0, 1.0, d)) * smoothstep(0.0, 0.12, vUv.y), 1.0); }`})); back.position.set(0, 8, -6); scene.add(back);
  // sensors: small drums with terminals, wires gathering to the box
  const steel = worn(0x9a9c9c, 0.32, 0.92), band = M(0x2a2c2e, 0.4, 0.8), wireMats = [M(0xb0301c, 0.45, 0.1), M(0x202225, 0.5, 0.1), M(0xc8bfa8, 0.5, 0.1), M(0x1e4a78, 0.5, 0.1), M(0xb08a20, 0.5, 0.1)];
  const r = rng(7171), curves = [];
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3), x = -4.2 + (i % 3) * 0.72 + (r() - 0.5) * 0.16 - row * 0.2, z = -1.25 + row * 1.2 + (r() - 0.5) * 0.24, s = 0.85 + r() * 0.35, g = new THREE.Group();
    g.add(C(0.15 * s, 0.15 * s, 0.34 * s, steel, 0, 0.17 * s, 0, 40), C(0.156 * s, 0.156 * s, 0.03 * s, band, 0, 0.05 * s, 0), C(0.156 * s, 0.156 * s, 0.03 * s, band, 0, 0.29 * s, 0), C(0.04 * s, 0.05 * s, 0.05 * s, band, 0, 0.365 * s, 0, 16));
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.11 * s, 0.055 * s), new THREE.MeshStandardMaterial({map: label('T' + (101 + i * 7), 256, 128, '700 88px Arial', '#111', '#c9c5b5'), roughness: 0.6})); tag.position.set(0, 0.17 * s, 0.1505 * s); g.add(tag);
    g.position.set(x, 0, z); world.add(g);
    const P = [new THREE.Vector3(x, 0.39 * s, z), new THREE.Vector3(x + 0.12, 0.46, z), new THREE.Vector3(x + 0.4, 0.05, z * 0.85), new THREE.Vector3(-1.5 + i * 0.03, 0.02, z * 0.45), new THREE.Vector3(-0.95, 0.09 + i * 0.03, -0.27 + (i % 3) * 0.2 + row * 0.04), new THREE.Vector3(-0.72, 0.24 + (i % 3) * 0.095, -0.2 + row * 0.15)];
    const cv = new THREE.CatmullRomCurve3(P); curves.push(cv); world.add(shade(new THREE.Mesh(new THREE.TubeGeometry(cv, 90, 0.0085, 8), wireMats[i % wireMats.length])));
  }
  // the box: wrinkle-black case, an aluminium front with its name, connectors, the switch
  const wrink = (() => { const [c, g] = canvas(512, 512), q = rng(313); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 12000; i++) { const v = Math.floor(q() * 255); g.fillStyle = `rgba(${v},${v},${v},0.3)`; g.fillRect(q() * 512, q() * 512, 2 + q() * 3, 2 + q() * 3); } return tex(c, false, [3, 3]); })();
  const blk = M(0x17181a, 0.62, 0.25, {bumpMap: wrink, bumpScale: 0.8});
  const BW = 1.44, BH = 0.82, BD = 0.82, bx = new THREE.Group(); world.add(bx);
  bx.add(B(BW, BH, BD, blk, 0, BH / 2 + 0.04, 0, 0.03));
  [[-BW / 2 + 0.1, -BD / 2 + 0.1], [BW / 2 - 0.1, -BD / 2 + 0.1], [-BW / 2 + 0.1, BD / 2 - 0.1], [BW / 2 - 0.1, BD / 2 - 0.1]].forEach(([x, z]) => bx.add(C(0.05, 0.06, 0.04, M(0x0c0c0c, 0.6, 0.1), x, 0.02, z, 16)));
  const frontT = (() => { const [c, g] = canvas(2048, 1024), q = rng(8); g.fillStyle = '#74777a'; g.fillRect(0, 0, 2048, 1024); for (let i = 0; i < 2000; i++) { g.strokeStyle = `rgba(${q() < 0.5 ? '255,255,255' : '0,0,0'},${q() * 0.06})`; g.lineWidth = 1; const y = q() * 1024, x = q() * 2048; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 120 + q() * 300, y); g.stroke(); } g.fillStyle = '#0c0d0e'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '900 300px Arial, sans-serif'; g.fillText('SCE', 90, 340); g.font = '700 58px Arial, sans-serif'; g.fillText('SIGNAL CONDITIONING', 96, 590); g.fillText('EQUIPMENT', 96, 660); g.textAlign = 'center'; g.font = '700 74px Arial, sans-serif'; g.fillText('NORM', 1540, 196); g.fillText('AUX', 1540, 838); g.lineWidth = 6; g.strokeStyle = '#0c0d0e'; g.strokeRect(1320, 110, 440, 800); return tex(c); })();
  const al = M(0x74777a, 0.4, 0.7), frontM = new THREE.MeshStandardMaterial({map: frontT, roughness: 0.42, metalness: 0.6});
  const front = shade(new THREE.Mesh(new THREE.BoxGeometry(BW - 0.1, BH - 0.1, 0.012), [al, al, al, al, frontM, al]));
  const FZ = BD / 2 + 0.007, FY = BH / 2 + 0.04; front.position.set(0, FY, FZ); bx.add(front);
  const sc = M(0xa8a8a8, 0.3, 0.95); [[-0.62, 0.32], [0.62, 0.32], [-0.62, -0.32], [0.62, -0.32]].forEach(([x, y]) => { const q = C(0.014, 0.014, 0.006, sc, x, FY + y, FZ + 0.008, 16); q.rotation.x = Math.PI / 2; bx.add(q); });
  // the switch: a real toggle with a threaded collar and a bat that moves
  const tog = new THREE.Group(), SWX = ((1540 - 1024) / 2048) * (BW - 0.1); tog.position.set(SWX, FY, FZ + 0.008); bx.add(tog);
  const collar = C(0.04, 0.046, 0.022, M(0xc8c8c8, 0.25, 1), 0, 0, 0.012, 24); collar.rotation.x = Math.PI / 2; tog.add(collar);
  const arm = new THREE.Group(); arm.position.z = 0.02; tog.add(arm);
  const bt = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.075, 6, 16), M(0xe2e2de, 0.2, 1))); bt.position.y = 0.05; arm.add(bt);
  // a small lamp by the switch: amber on the failing NORM supply, green on AUX
  const lampL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), new THREE.MeshBasicMaterial({color: 0xffffff})); lampL.position.set(SWX + 0.14, FY + 0.26, FZ + 0.012); bx.add(lampL);
  // connectors on the left where the wires land, one on the right where the cable leaves
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const q = C(0.022, 0.022, 0.03, M(0x9a9a9a, 0.3, 0.95), -BW / 2 - 0.01, 0.24 + a * 0.095, -0.2 + b * 0.15, 16); q.rotation.z = Math.PI / 2; bx.add(q); }
  const con = C(0.05, 0.05, 0.05, M(0x9a9a9a, 0.3, 0.95), BW / 2 + 0.01, FY - 0.1, 0.08, 24); con.rotation.z = Math.PI / 2; bx.add(con);
  // the dish on its yoke
  const DX = 3.1, dishGrp = new THREE.Group(); dishGrp.position.set(DX, 0, -0.35); world.add(dishGrp);
  dishGrp.add(C(0.28, 0.34, 0.08, M(0x24272a, 0.42, 0.7), 0, 0.04, 0, 32), C(0.05, 0.08, 0.7, M(0x54585c, 0.35, 0.8), 0, 0.42, 0, 20));
  const dishHead = new THREE.Group(); dishHead.position.set(0, 0.86, 0); dishHead.rotation.y = -0.305; dishGrp.add(dishHead);
  const dp = []; for (let i = 0; i <= 28; i++) { const x = (i / 28) * 0.62; dp.push(new THREE.Vector2(x, x * x * 0.62)); }
  const dish = shade(new THREE.Mesh(new THREE.LatheGeometry(dp, 72), new THREE.MeshStandardMaterial({color: 0xcfd1cd, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide}))); dish.rotation.z = -Math.PI / 2; dishHead.add(dish);
  const strut = (a, b) => { const A = new THREE.Vector3(...a), Bb = new THREE.Vector3(...b), m = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, A.distanceTo(Bb), 8), M(0x8a8c8c, 0.35, 0.9))); m.position.copy(A).add(Bb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bb.clone().sub(A).normalize()); dishHead.add(m); };
  const FO = [0.46, 0, 0]; [[0.24, 0.6, 0], [0.24, -0.6, 0], [0.24, 0, 0.6], [0.24, 0, -0.6]].forEach((p) => strut(p, FO));
  const horn = C(0.045, 0.03, 0.09, M(0x1e2022, 0.4, 0.6), FO[0], 0, 0, 16); horn.rotation.z = Math.PI / 2; dishHead.add(horn);
  // the cable from the box to the dish's foot
  const c1 = new THREE.CatmullRomCurve3([new THREE.Vector3(BW / 2 + 0.03, FY - 0.1, 0.08), new THREE.Vector3(BW / 2 + 0.3, 0.3, 0.1), new THREE.Vector3(1.4, 0.03, 0.15), new THREE.Vector3(DX - 0.8, 0.03, -0.05), new THREE.Vector3(DX - 0.35, 0.08, -0.35)]);
  world.add(shade(new THREE.Mesh(new THREE.TubeGeometry(c1, 80, 0.016, 10), M(0x121315, 0.45, 0.2))));
  // through the air from the dish to Houston's screen
  const SX = 6.3, airC = new THREE.LineCurve3(new THREE.Vector3(DX + 0.48, 0.86, -0.2), new THREE.Vector3(SX - 0.5, 0.74, 0.5));
  // the screen: a tube in a slanted case
  const tube = makeTube(1.08, 0.81, (g, f) => { if (f < SCR_F) paintGarbage(g, f, false); else paintTable(g, REAL_DATA, 'GET', 112 + (f - SCR_F) / 30); });
  const case_ = new THREE.Group(); case_.position.set(SX, 0, 0.05); case_.rotation.y = 0.75; world.add(case_);
  case_.add(B(1.34, 1.1, 0.62, worn(0x4a5052, 0.55, 0.25), 0, 0.65, -0.37, 0.03));
  const fs = new THREE.Shape(); rrect(fs, -0.67, -0.55, 1.34, 1.1, 0.03); fs.holes.push(rrect(new THREE.Path(), -0.55, -0.41, 1.1, 0.82, 0.05));
  const fp = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(fs, {depth: 0.03, bevelEnabled: false, curveSegments: 10}), M(0x3a3f42, 0.5, 0.3))); fp.position.set(0, 0.65, 0); case_.add(fp);
  tube.grp.position.set(0, 0.66, -0.03); case_.add(tube.grp);
  const scrLight = new THREE.PointLight(0x8fffb0, 1.3, 4, 1.5); scrLight.position.set(SX + 0.5, 0.7, 0.62); scene.add(scrLight);
  // the show's mirror: the same objects under the bench
  scene.add(mirror); mirror.scale.y = -1; mirror.add(world.clone(true)); mirror.traverse((m) => { m.castShadow = false; });
  // light
  spot(e, 0xd8e4f0, 26, [-4.4, 3.8, 2.6], [-3.4, 0.2, -0.1], 0.55, 0.85, 1.6, 1536, 0.5, 12);
  spot(e, 0xffe2c0, 24, [-1.2, 3.8, 3.4], [0, 0.4, 0.3], 0.42, 0.8, 1.6, 2048, 0.5, 12);
  spot(e, 0xdfe6ea, 12, [2.2, 4.4, 2.6], [DX, 0.7, -0.35], 0.4, 0.8, 1.6, 1024, 0.5, 12);
  e.scene.add(new THREE.AmbientLight(0x30343a, 0.2));
  // the data: beads on the wires. Into the box they run evenly; out of it they're scrambled until the switch, then clean.
  const beadG = new THREE.SphereGeometry(0.018, 10, 8), inN = 9 * 7, outN = 40, airN = 44;
  const inB = new THREE.InstancedMesh(beadG, new THREE.MeshBasicMaterial({color: new THREE.Color(1.5, 0.92, 0.36)}), inN); inB.frustumCulled = false; scene.add(inB);
  const outB = new THREE.InstancedMesh(beadG, new THREE.MeshBasicMaterial({color: 0xffffff}), outN + airN); outB.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((outN + airN) * 3), 3); outB.frustumCulled = false; scene.add(outB);
  const L = lens(e, {focus: 3, ap: 8, maxB: 22, grain: 0.015});
  const fd = {value: 0};
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), sc3 = new THREE.Vector3(), col = new THREE.Color();
  const CL = new THREE.Color(0.42, 1.9, 0.8), BAD = new THREE.Color(2.0, 0.8, 0.28);
  const path = [[0, [-3.55, 1.0, 3.5], [-3.4, 0.2, -0.1]], [70, [-3.25, 0.9, 3.35], [-3.2, 0.2, -0.1]], [135, [-1.0, 0.7, 2.75], [-0.35, 0.4, 0.1]], [170, [0.12, 0.62, 2.0], [0.1, 0.46, 0.42]], [198, [0.12, 0.62, 2.0], [0.1, 0.46, 0.42]], [300, [8.6, 2.8, 7.6], [2.0, 0.5, -0.1]], [390, [8.9, 2.9, 7.9], [2.1, 0.5, -0.1]]];
  const keyed = (f, idx) => { let i = 1; while (i < path.length - 1 && f > path[i][0]) i++; const [f0, a0, b0] = path[i - 1], [f1, a1, b1] = path[i], s = ease((f - f0) / (f1 - f0)), A = idx === 1 ? a0 : b0, Bb = idx === 1 ? a1 : b1; return [lerp(A[0], Bb[0], s), lerp(A[1], Bb[1], s), lerp(A[2], Bb[2], s)]; };
  const tgt = new THREE.Vector3();
  return {draw: (f) => {
    tube.draw(f); fd.value = f;
    // the toggle: over in 3 frames at 6.0 s. Up and out is NORM, down and out is AUX.
    arm.rotation.x = lerp(0.55, Math.PI - 0.55, ease(clamp((f - SW_F) / 3)));
    const onAux = f >= SW_F; lampL.material.color.setRGB(onAux ? 0.4 : 2.4, onAux ? 3 : 1.1, onAux ? 1.2 : 0.2);
    // beads along the wires
    let k = 0; const sp = 0.0052;
    curves.forEach((c, i) => { for (let b = 0; b < 7; b++) { const u = (b / 7 + f * sp + i * 0.137) % 1; c.getPointAt(u, v); m4.compose(v, q.identity(), sc3.setScalar(0.72)); inB.setMatrixAt(k++, m4); } }); inB.instanceMatrix.needsUpdate = true;
    // out of the box: the switch's change runs from the box to the dish and to the screen
    const frontP = clamp((f - SW_F) / (SCR_F - SW_F)); // 0: all scrambled, 1: all clean
    const put = (idx, u, curve, regionS, regionE, n) => {
      const pos = regionS + (regionE - regionS) * u, clean = f >= SW_F && pos < frontP;
      if (clean) { curve.getPointAt(u, v); sc3.setScalar(1.25); col.copy(CL); }
      else { const r2 = rng(1 + (Math.floor(f / 3) * 131 + idx * 977) % 1000003); r2(); const j = ((r2() - 0.5) * 0.4) / n * 2; curve.getPointAt(clamp(u + j), v); v.x += (r2() - 0.5) * 0.09; v.y += (r2() - 0.5) * 0.11; v.z += (r2() - 0.5) * 0.09; const s = r2(); sc3.setScalar(s < 0.3 ? 0.001 : 0.5 + s * 1.1); col.copy(BAD).multiplyScalar(0.3 + r2() * 1.1); }
      m4.compose(v, q.identity(), sc3); outB.setMatrixAt(idx, m4); outB.setColorAt(idx, col);
    };
    for (let b = 0; b < outN; b++) put(b, (b / outN + f * 0.0048) % 1, c1, 0, 0.5, outN);
    for (let b = 0; b < airN; b++) put(outN + b, (b / airN + f * 0.0054) % 1, airC, 0.5, 1.0, airN);
    outB.instanceMatrix.needsUpdate = true; outB.instanceColor.needsUpdate = true;
    const p = keyed(f, 1), t = keyed(f, 2);
    camera.up.set(0, 1, 0); camera.position.set(p[0], p[1], p[2]); tgt.set(t[0], t[1], t[2]); camera.lookAt(tgt); camera.fov = 38;
    L.set(camera.position.distanceTo(tgt), f < 198 ? 15 : lerp(15, 2.4, ease((f - 198) / 80)));
  }};
});

export const PLATES = {
  ScreenZeros: [ScreenZeros, 300],
  ScreenNight: [ScreenNight, 360],
  ScreenClean: [ScreenClean, 300],
  EngineDials: [EngineDials, 300],
  PlotBoard: [PlotBoard, 330],
  NightConsole: [NightConsole, 300],
  DriveHome: [DriveHome, 360],
  Circuit: [Circuit, 390],
  SceBox: [SceBox, 390],
};
