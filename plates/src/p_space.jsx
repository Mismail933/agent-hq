// The space and sky plates: the Earth and the orbit, the burn to the Moon, the 32 km ring round the pad, the field meters under the storm, the rule's
// cloud line at true scale, and the rocket's exhaust trail as a wire. Textures: NASA Blue Marble NG (public domain) in the app's public/a12space (scratchpad space/prep_textures.py).
import {staticFile, delayRender, continueRender, cancelRender} from 'remotion';
import * as THREE from 'three';
import {useScene, clamp, ease, lerp, flashAt, indoors} from './plates';
import {makeSaturn, makeFlame, makeBolt} from './saturn';

const QUAD_VS = `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const seeded = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rad = (d) => (d * Math.PI) / 180;
const AMBER = [1.5, 0.92, 0.3];

// textures come in after the first draw: redraw the frame, then let Remotion take the picture
const loadTextures = (e, files, done) => {
  const h = delayRender('plate textures', {timeoutInMilliseconds: 170000});
  const keys = Object.keys(files), out = {}; let n = 0;
  keys.forEach((k) => new THREE.TextureLoader().load(staticFile('a12space/' + files[k]), (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
    out[k] = t; n += 1;
    if (n === keys.length) { done(out); continueRender(h); }
  }, undefined, (err) => cancelRender(err)));
};

// a camera-facing ribbon of a fixed screen width, drawn with the scene's antialiasing
const makeRibbon = (e, maxPts, {additive = true} = {}) => {
  const pos = new Float32Array(maxPts * 18), col = new Float32Array(maxPts * 18);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
  mesh.frustumCulled = false;
  const cam = V(0, 0, 0), a = V(0, 0, 0), c = V(0, 0, 0), d = V(0, 0, 0), v = V(0, 0, 0), s = V(0, 0, 0);
  // pts: list of Vector3; widthPx(i), color(i) -> [r, g, b]
  mesh.userData.update = (pts, widthPx, color) => {
    const H = e.renderer.domElement.height, cm = e.camera; cam.setFromMatrixPosition(cm.matrixWorld);
    const kk = (2 * Math.tan(rad(cm.fov) / 2)) / H;
    let k = 0, drawn = 0;
    for (let i = 0; i + 1 < pts.length && drawn < maxPts; i++) {
      const ca = color(i), cc = color(i + 1); if (ca[0] + ca[1] + ca[2] + cc[0] + cc[1] + cc[2] <= 0.0001) continue;
      a.copy(pts[i]); c.copy(pts[i + 1]); d.copy(c).sub(a).normalize(); v.copy(a).sub(cam); const da = v.length(); v.normalize(); s.crossVectors(d, v).normalize();
      const wa = da * kk * widthPx(i) * 0.5, wc = c.distanceTo(cam) * kk * widthPx(i + 1) * 0.5;
      const q = [[a, s, wa, ca], [a, s, -wa, ca], [c, s, wc, cc], [a, s, wa, ca], [c, s, wc, cc], [c, s, -wc, cc]];
      for (const [o, sd, w, C] of q) { pos[k] = o.x + sd.x * w; pos[k + 1] = o.y + sd.y * w; pos[k + 2] = o.z + sd.z * w; col[k] = C[0]; col[k + 1] = C[1]; col[k + 2] = C[2]; k += 3; }
      drawn += 1;
    }
    geo.setDrawRange(0, k / 3); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  };
  return mesh;
};

// a soft round sprite in added light; HDR colours make the bloom
const softDot = (() => { let t = null; return () => { if (!t) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.55)'); r.addColorStop(0.5, 'rgba(255,255,255,0.1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); t = new THREE.CanvasTexture(c); } return t; }; })();
const makeGlow = (rgb) => { const m = new THREE.SpriteMaterial({map: softDot(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: new THREE.Color(...rgb)}); const s = new THREE.Sprite(m); s.frustumCulled = false; return s; };

const makeStars = (n, seed, radius) => {
  const r = seeded(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n);
  const band = V(0.45, 0.8, 0.4).normalize();                  // a faint Milky Way: more stars near one great circle
  for (let i = 0; i < n; i++) {
    let v;
    for (;;) { const z = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - z * z); v = V(q * Math.cos(a), z, q * Math.sin(a)); if (r() < 0.32 + 0.68 * Math.exp(-Math.pow(v.dot(band) / 0.26, 2))) break; }
    pos.set([v.x * radius, v.y * radius, v.z * radius], i * 3);
    const m = Math.pow(r(), 5.5), warm = r(), lum = 0.1 + m * 3.2;
    col.set([lum * (0.82 + warm * 0.26), lum * 0.92, lum * (1.14 - warm * 0.3)], i * 3);
    siz[i] = 1.5 + m * 3.4;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('siz', new THREE.BufferAttribute(siz, 1));
  const m = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {amt: {value: 1}},
    vertexShader: `in float siz; in vec3 color; out vec3 vC; void main(){ vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = siz; }`,
    fragmentShader: `precision highp float; in vec3 vC; out vec4 o; uniform float amt; void main(){ float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5)); o = vec4(vC * a * amt, 1.0); }`});
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
};

// ---- the Earth in kilometres: Blue Marble, clouds grown from the engine's noise, sun glint, the terminator, the atmosphere as a thin shell of light ----
const llp = (lon, lat) => { const a = rad(lon), b = rad(lat); return V(Math.cos(b) * Math.cos(a), Math.sin(b), -Math.cos(b) * Math.sin(a)); };
const R_E = 6371;
const EARTH_FS = `
precision highp float; precision highp sampler3D;
in vec3 vN, vL, vW; in vec2 vU; out vec4 o;
uniform sampler2D day, det; uniform sampler3D noise; uniform vec3 sun, cam, wind, front, frontAt; uniform float hasDet, ready;
float T(vec3 q){ return textureLod(noise, q, 0.0).r; }
float clouds(vec3 n){
  vec3 q = n * 1.25 + wind;
  vec3 w = vec3(T(q * 0.8), T(q * 0.8 + 0.31), T(q * 0.8 + 0.67)) - 0.55;
  vec3 r = q + w * 0.42;
  float a = T(r) * 0.52 + T(r * 3.07 + w * 0.4) * 0.25 + T(r * 8.3) * 0.13 + T(r * 23.0) * 0.07 + T(r * 59.0) * 0.03;
  float la = n.y, ab = abs(la);
  float cover = 0.565 - 0.05 * exp(-pow((la - 0.1) / 0.1, 2.0)) + 0.055 * exp(-pow((ab - 0.42) / 0.14, 2.0)) - 0.06 * exp(-pow((ab - 0.8) / 0.18, 2.0));
  float fr = exp(-pow(dot(n, front) / 0.05, 2.0)) * smoothstep(0.86, 0.97, dot(n, frontAt));       // the cold front that sat over Florida that day
  cover -= fr * 0.1;
  return smoothstep(cover, cover + 0.11, a);
}
void main(){
  vec3 N = normalize(vN), L = normalize(vL), V_ = normalize(cam - vW);
  float ndl = dot(N, sun);
  vec3 c = texture(day, vU).rgb;
  if (hasDet > 0.5) { vec2 d = vec2(vU.x * 2.0 - 0.5, (vU.y - 0.5) * 3.0);               // lon -90..90, lat 0..60
    if (d.x > 0.0 && d.x < 1.0 && d.y > 0.0 && d.y < 1.0) c = mix(c, texture(det, d).rgb, smoothstep(0.0, 0.01, d.x) * smoothstep(1.0, 0.99, d.x) * smoothstep(0.0, 0.02, d.y) * smoothstep(1.0, 0.98, d.y)); }
  float ocean = smoothstep(0.012, 0.05, c.b - max(c.r, c.g * 0.92));
  float lit = smoothstep(-0.02, 0.16, ndl) * (0.35 + 0.65 * sqrt(clamp(ndl, 0.0, 1.0)));
  float d = clouds(L), sh = clouds(normalize(L + sun * 0.012));
  vec3 sunCol = mix(vec3(1.5, 0.72, 0.42), vec3(1.0, 0.98, 0.94), smoothstep(0.0, 0.28, ndl)) * 3.1;
  vec3 ground = c * sunCol * lit * (1.0 - 0.62 * sh);
  vec3 H = normalize(sun + V_);
  float spec = pow(max(dot(N, H), 0.0), 190.0) * 7.0 + pow(max(dot(N, H), 0.0), 26.0) * 0.16;
  ground += vec3(1.0, 0.92, 0.8) * spec * ocean * (1.0 - d) * smoothstep(0.0, 0.1, ndl);
  vec3 cl = vec3(0.9, 0.92, 0.95) * sunCol * lit * (0.52 + 0.5 * smoothstep(0.1, 0.95, d)) * (1.0 - 0.3 * sh);
  vec3 col = mix(ground, cl, d * 0.96);
  float fres = pow(1.0 - clamp(dot(N, V_), 0.0, 1.0), 3.4);
  vec3 air = vec3(0.13, 0.3, 0.72);
  col = mix(col, air * 1.5 * lit + vec3(0.9, 0.34, 0.1) * 0.5 * exp(-pow((ndl - 0.015) / 0.05, 2.0)), clamp(fres * 0.8 + 0.07, 0.0, 1.0) * smoothstep(-0.1, 0.03, ndl));
  col += vec3(0.0035, 0.005, 0.011) * (0.5 + d);                                          // the night side: only the shape of it
  o = vec4(mix(vec3(0.0), col, ready), 1.0);
}`;
const ATM_FS = `
precision highp float; in vec3 vW; out vec4 o; uniform vec3 cam, sun, center; uniform float R, Hs;
void main(){
  vec3 rd = normalize(vW - cam), oc = cam - center; float tc = -dot(oc, rd); if (tc < 0.0) discard;
  vec3 c = oc + rd * tc; float h = length(c), alt = h - R; if (alt < -Hs) discard;
  float od = exp(-max(alt, 0.0) / Hs) * sqrt(6.283 * Hs * h) / (R * 0.066);
  float s = dot(c / h, sun);
  float lit = smoothstep(-0.11, 0.08, s);
  float band = exp(-pow((s + 0.03) / 0.075, 2.0));                  // sunset, all round the terminator
  vec3 col = vec3(0.1, 0.3, 1.0) * lit * od * 3.2 + vec3(1.0, 0.33, 0.07) * band * exp(-max(alt, 0.0) / (Hs * 0.7)) * od * 2.9;
  o = vec4(col, 1.0);
}`;
const makeEarth = (e, sun, {detail = false} = {}) => {
  const g = new THREE.Group(), geo = new THREE.SphereGeometry(R_E, 512, 320);
  const u = {day: {value: null}, det: {value: null}, noise: e.cloud.noise, sun: {value: sun}, cam: e.common.cam, wind: {value: V(0.13, 0.27, 0.41)}, hasDet: {value: 0}, ready: {value: 0},
    front: {value: llp(-72, 27).cross(llp(-60, 37)).normalize()}, frontAt: {value: llp(-70, 29)}};
  const mat = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, uniforms: u, fragmentShader: EARTH_FS,
    vertexShader: `out vec3 vN, vL, vW; out vec2 vU; void main(){ vU = uv; vL = normal; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`});
  const ball = new THREE.Mesh(geo, mat); ball.frustumCulled = false; g.add(ball);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R_E + 170, 256, 160), new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    uniforms: {cam: e.common.cam, sun: {value: sun}, center: {value: V(0, 0, 0)}, R: {value: R_E}, Hs: {value: 13}}, fragmentShader: ATM_FS,
    vertexShader: `out vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`}));
  atm.frustumCulled = false; e.scene.add(atm);
  e.scene.add(g);
  g.userData.setTex = (t) => { u.day.value = t.earth; if (detail && t.det) { u.det.value = t.det; u.hasDet.value = 1; } else u.det.value = t.earth; u.ready.value = 1; };
  g.userData.u = u;
  return g;
};

// the third stage and the Apollo spacecraft on it, as they were in the parking orbit; y along the flight, in real metres
const makeStack = () => {
  const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({color: 0xe8e7e0, roughness: 0.45, metalness: 0.1}), dark = new THREE.MeshStandardMaterial({color: 0x1b1c20, roughness: 0.5}), metal = new THREE.MeshStandardMaterial({color: 0xb9bcc2, roughness: 0.28, metalness: 0.95});
  const lathe = (pts, m) => { const x = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 32), m); g.add(x); };
  lathe([[3.3, 0], [3.3, 4]], dark); lathe([[3.3, 4], [3.3, 17.8], [3.3, 18.7]], white); lathe([[3.3, 18.7], [1.96, 27.2]], white);
  lathe([[1.96, 27.2], [1.96, 34.7]], metal); lathe([[1.96, 34.7], [0.2, 38.1]], metal);
  const bell = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.6, 18, 1, true), dark); bell.position.y = -1; g.add(bell);
  return g;
};

// ---- EarthOrbit: chase behind the stack over the Atlantic, out of sunlight into the night; the real geometry of that hour ----
export const EarthOrbit = () => useScene((e) => {
  indoors(e); e.final.grain.value = 0.012; e.final.bloom.value = 0.6;
  const {camera, scene} = e; camera.near = 20; camera.far = 2000000; camera.fov = 38;
  const sun = llp(-62, -18);                                         // the Sun's place at 16:40 UT, 14 Nov 1969
  const earth = makeEarth(e, sun, {detail: true});
  const stars = makeStars(5200, 4111, 900000); scene.add(stars);
  const light = new THREE.DirectionalLight(0xfff4e6, 3.4); light.position.copy(sun).multiplyScalar(1000); scene.add(light);
  const shine = new THREE.HemisphereLight(0x070a12, 0x3a5a8a, 0.0); scene.add(shine);
  const stack = makeStack(); stack.scale.setScalar(0.74); scene.add(stack);
  const dot = makeGlow([1.7, 1.25, 0.72]); scene.add(dot);
  const rb = makeRibbon(e, 900); scene.add(rb);
  const P0 = llp(-80.6, 28.6), N0 = V(0, 1, 0).sub(P0.clone().multiplyScalar(P0.y)).normalize(), E0 = N0.clone().cross(P0).normalize(), Hd = E0.clone().multiplyScalar(Math.sin(rad(72))).add(N0.clone().multiplyScalar(Math.cos(rad(72)))).normalize();
  const RO = R_E + 190;
  const at = (deg) => P0.clone().multiplyScalar(Math.cos(rad(deg))).add(Hd.clone().multiplyScalar(Math.sin(rad(deg))));
  let cross = 90; for (let d = 20; d < 170; d += 0.1) if (at(d).dot(sun) < -0.0) { cross = d; break; }
  const FC = 205, RATE = 0.165, ring = []; for (let i = 0; i <= 720; i++) ring.push(at(i * 0.5).multiplyScalar(RO));
  const q = new THREE.Quaternion(); let lastF = 0;
  const draw = (f) => {
    lastF = f;
    const th = cross + (f - FC) * RATE, U = at(th), Tn = at(th + 90), S = Tn.clone().cross(U).normalize(), P = U.clone().multiplyScalar(RO);
    const k = ease(f / 299);
    const back = lerp(960, 760, k), up = lerp(560, 440, k), side = lerp(-190, 150, k);
    camera.position.copy(P).addScaledVector(Tn, -back).addScaledVector(U, up).addScaledVector(S, side);
    camera.up.copy(U).addScaledVector(S, lerp(-0.05, 0.05, k)).normalize();
    camera.lookAt(P.clone().addScaledVector(Tn, 1500).addScaledVector(U, 200));
    camera.updateMatrixWorld();
    e.common.cam.value.copy(camera.position);
    stars.position.copy(camera.position);
    // into the Earth's shadow
    const along = P.dot(sun), perp = P.clone().addScaledVector(sun, -along).length(), shade = along > 0 ? 1 : clamp((perp - R_E) / 60 + 0.5);
    light.intensity = 3.4 * shade;
    shine.intensity = lerp(0.14, 0.9, shade);
    stack.position.copy(P); stack.quaternion.setFromUnitVectors(V(0, 1, 0), Tn.clone().normalize());
    const dist = camera.position.distanceTo(P);
    dot.position.copy(P).addScaledVector(Tn, 14); dot.scale.setScalar(dist * 0.058);
    dot.material.color.setRGB(1.5 * shade + 0.34, 1.15 * shade + 0.2, 0.72 * shade + 0.1);
    stars.material.uniforms.amt.value = lerp(0.42, 1, ease((f - 120) / 100));
    const i0 = th * 2, pts = ring, cFn = (i) => { const d = (i - i0) * 0.5;          // the track behind it in amber, ahead of it thin and pale
      if (d <= 0) { const a = clamp(1 + d / 48); return [AMBER[0] * a, AMBER[1] * a, AMBER[2] * a]; }
      const a = clamp(1 - d / 64) * 0.5; return [0.8 * a, 0.86 * a, 0.95 * a]; };
    rb.userData.update(pts, (i) => ((i - i0) <= 0 ? 2.6 : 1.5), cFn);
  };
  loadTextures(e, {earth: 'earth.jpg', det: 'nh60.jpg'}, (t) => { earth.userData.setTex(t); draw(lastF); e.render(lastF); });
  return {draw};
});

// a real-looking Moon painted from where the near side's maria and bright craters really are
const moonTexture = () => {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = seeded(9091), X = (lon) => ((lon + 180) / 360) * W, Y = (lat) => ((90 - lat) / 180) * H, PX = W / 360;
  g.fillStyle = '#9b9690'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const v = 118 + Math.floor(r() * 60); g.fillStyle = `rgba(${v},${v - 3},${v - 7},0.14)`; g.beginPath(); g.ellipse(r() * W, r() * H, 6 + r() * 34, 4 + r() * 22, r() * 3, 0, 7); g.fill(); }
  const MARIA = [[-16, 33, 19, 16], [18, 27, 10, 9], [31, 8, 13, 10], [59, 17, 8, 6], [51, -4, 10, 9], [35, -15, 5.5, 5], [-55, 16, 19, 27], [-17, -21, 12, 9], [-39, -24, 6, 6], [0, 56, 32, 4], [4, 13, 5, 4], [-23, -10, 9, 7], [-30, 6, 11, 7]];
  for (const [lo, la, rx, ry] of MARIA) for (let i = 0; i < 90; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()), x = X(lo + Math.cos(a) * d * rx), y = Y(la + Math.sin(a) * d * ry), s = (3 + r() * 6) * PX * (rx + ry) * 0.05;
    const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(58,56,56,0.5)'); gr.addColorStop(1, 'rgba(58,56,56,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  for (let i = 0; i < 1500; i++) { const x = r() * W, y = r() * H, s = 0.8 + Math.pow(r(), 3.2) * 9; g.strokeStyle = 'rgba(30,30,30,0.3)'; g.lineWidth = 0.7; g.beginPath(); g.arc(x, y, s, 0.5, 3.6); g.stroke(); g.strokeStyle = 'rgba(232,230,224,0.3)'; g.beginPath(); g.arc(x, y, s, 3.6, 6.8); g.stroke(); }
  for (const [lo, la, n, L] of [[-11, -43, 44, 34], [-20, 10, 26, 13], [-38, 8, 18, 8], [-44, 23, 16, 8]]) { const x = X(lo), y = Y(la); g.fillStyle = 'rgba(245,244,238,0.85)'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
    for (let i = 0; i < n; i++) { const a = r() * 6.283, d = L * (0.4 + r() * 0.8) * PX; g.strokeStyle = `rgba(238,236,230,${0.05 + r() * 0.11})`; g.lineWidth = 0.8 + r() * 1.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};

// ---- TLIArc: the loop round the Earth, the burn, and one long pull back as the arc draws itself out to the Moon. The distance is compressed so both fit. ----
export const TLIArc = () => useScene((e) => {
  indoors(e); e.final.grain.value = 0.012; e.final.bloom.value = 0.65;
  const {camera, scene} = e; camera.near = 60; camera.far = 3000000;
  const sun = V(-0.62, 0.34, 0.71).normalize();
  const earth = makeEarth(e, sun);
  // the Pacific towards us, north up and leaning with the orbit
  const a = llp(-150, 12), n = V(0, 1, 0).sub(a.clone().multiplyScalar(a.y)).normalize(), b0 = new THREE.Matrix4().makeBasis(a, n, a.clone().cross(n));
  const fa = V(0.1, 0.5, 0.86).normalize(), fn = V(0.28, 1, -0.1).sub(fa.clone().multiplyScalar(fa.dot(V(0.28, 1, -0.1)))).normalize(), b1 = new THREE.Matrix4().makeBasis(fa, fn, fa.clone().cross(fn));
  earth.quaternion.setFromRotationMatrix(b1.multiply(b0.invert()));
  const stars = makeStars(6200, 7741, 1600000); scene.add(stars);
  const light = new THREE.DirectionalLight(0xfff6ea, 3.3); light.position.copy(sun).multiplyScalar(1000); scene.add(light);
  // everything flies in one plane
  const E1 = V(1, 0, 0), E2 = V(0, 0.16, -1).normalize(), plane = (u, v) => E1.clone().multiplyScalar(u).addScaledVector(E2, v);
  const A0 = R_E * 1.17, D = R_E * 13.4, NUM = rad(166), TH0 = rad(-142);        // burn point, how far round the Moon sits; TH0 = the burn's direction
  const ecc = (D - A0) / (A0 - D * Math.cos(NUM)), pp = A0 * (1 + ecc);
  const arcAt = (nu) => { const r = pp / (1 + ecc * Math.cos(nu)), th = TH0 + nu; return plane(r * Math.cos(th), r * Math.sin(th)); };
  const loopAt = (nu) => { const th = TH0 + nu; return plane(A0 * Math.cos(th), A0 * Math.sin(th)); };
  const moonPos = arcAt(NUM);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R_E * 0.36, 128, 96), new THREE.MeshStandardMaterial({map: moonTexture(), roughness: 1, metalness: 0})); moon.position.copy(moonPos);
  moon.rotation.y = Math.atan2(moonPos.z, -moonPos.x) + 0.5; scene.add(moon);
  const loop = []; for (let i = 0; i <= 360; i++) loop.push(loopAt(rad(i - 360)));
  const arc = []; for (let i = 0; i <= 700; i++) arc.push(arcAt((i / 700) * NUM));
  const rLoop = makeRibbon(e, 400), rArc = makeRibbon(e, 760); scene.add(rLoop, rArc);
  const craft = makeGlow([2.4, 2.1, 1.7]); scene.add(craft);
  const flare = makeGlow([5, 3.4, 1.7]), flare2 = makeGlow([3, 1.5, 0.45]); scene.add(flare, flare2);
  const plume = makeRibbon(e, 8); scene.add(plume);
  const F_BURN = 96, F_END = 138, F_ARRIVE = 330;
  // the arc's progress in true-anomaly: quick out of the burn, then slower and slower as it climbs away from the Earth
  const nuOf = (f) => { if (f < F_END) return rad(lerp(-5, 26, ease((f - F_BURN) / (F_END - F_BURN)) * 0.5 + clamp((f - F_BURN) / (F_END - F_BURN)) * 0.5)); const x = clamp((f - F_END) / (F_ARRIVE - F_END)); return lerp(rad(26), NUM - 0.012, 1 - Math.pow(1 - x, 1.55)); };
  const look = V(0, 0, 0), mid = moonPos.clone().multiplyScalar(0.5); let lastF = 0;
  const draw = (f) => {
    lastF = f;
    const pull = ease((f - 120) / 196), near = ease(f / 110);
    const dist = lerp(lerp(R_E * 3.7, R_E * 3.25, near), R_E * 15.2, pull);
    look.set(0, 0, 0).lerp(mid, pull); look.y += lerp(R_E * 0.05, -R_E * 0.25, pull);
    const az = lerp(0.42, -0.04, pull), el = lerp(0.42, 0.4, pull);
    camera.position.set(look.x + Math.sin(az) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(az) * Math.cos(el) * dist);
    camera.up.set(lerp(0, -0.33, pull), 1, 0).normalize();
    camera.fov = lerp(36, 40, pull);
    camera.lookAt(look); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    e.common.cam.value.copy(camera.position); stars.position.copy(camera.position);
    // on the loop before the burn, on the arc after it
    const onLoop = f < F_BURN, nu = onLoop ? rad(lerp(-210, -5, f / F_BURN)) : nuOf(f);
    const head = onLoop ? loopAt(nu) : arcAt(nu);
    const loopFade = 1 - ease((f - 130) / 80);
    const lh = ((nu + rad(360)) / rad(1));
    rLoop.userData.update(loop, () => 2.1, (i) => { const onit = onLoop ? (i <= lh ? 1 : 0.3) : 1; const c = onit * loopFade; return [0.86 * c, 0.86 * c, 0.84 * c]; });
    const headI = onLoop ? -1 : (nu / NUM) * 700;
    rArc.userData.update(arc, () => lerp(2.6, 3.4, pull), (i) => { if (i > headI) return [0, 0, 0]; const k = clamp((headI - i) / 30); const w = 1 - k; return [AMBER[0] + w * 0.8, AMBER[1] + w * 1, AMBER[2] + w * 1.4]; });
    const dc = camera.position.distanceTo(head);
    craft.position.copy(head); craft.scale.setScalar(dc * 0.05);
    const bp = f < F_BURN - 2 ? 0 : (f < F_BURN + 6 ? (f - F_BURN + 2) / 8 : (f < F_END - 6 ? 1 : clamp((F_END + 4 - f) / 10)));
    const pulse = 1 + 0.1 * Math.sin(f * 2.1) * Math.sin(f * 0.77);
    flare.visible = flare2.visible = bp > 0.001;
    flare.position.copy(head); flare.scale.setScalar(dc * 0.3 * bp * pulse); flare.material.color.setRGB(5.2 * bp, 3.4 * bp, 1.7 * bp);
    flare2.position.copy(head); flare2.scale.setScalar(dc * 0.72 * bp * pulse); flare2.material.opacity = 0.7 * bp;
    const back = onLoop ? V(1, 0, 0) : arcAt(nu - 0.05).sub(head).normalize();
    const tail = [head.clone(), head.clone().addScaledVector(back, dc * 0.075 * bp), head.clone().addScaledVector(back, dc * 0.2 * bp)];
    plume.visible = bp > 0.001;
    if (plume.visible) plume.userData.update(tail, (i) => [11 * bp, 6 * bp, 1][i], (i) => [[6 * bp, 4 * bp, 2.2 * bp], [2.4 * bp, 1.1 * bp, 0.3 * bp], [0, 0, 0]][i]);
    stars.material.uniforms.amt.value = lerp(0.45, 1, pull);
    e.final.white.value = 0;
  };
  loadTextures(e, {earth: 'earth.jpg'}, (t) => { earth.userData.setTex(t); draw(lastF); e.render(lastF); });
  return {draw};
});

// ---- my own cloud pass: a half-size march through a box of cloud, stopped at the scene's depth, laid over the scene before the engine's composite. ----
// Its steps cover the box and not a fixed distance, so it works from 30 km away. Things that must sit IN the cloud are drawn in the scene and get covered by what is in front of them.
const VOL_FS = `
precision highp float; precision highp sampler3D;
in vec2 vUv; out vec4 o;
uniform sampler3D noise; uniform sampler2D depth;
uniform mat4 invVP; uniform vec3 cam, bmin, bmax, wind, sunDir, sunCol, ambHi, ambLo, boltA, boltB, flameA, flameB, chargeCol, hazeCol;
uniform float scale, cover, gain, ext, flash, flame, flameK, frame, towers, lightStep, stretch, edgeB, hazeK, tMin;
uniform vec4 pockets[8];
float sat(float x){ return clamp(x, 0.0, 1.0); }
float dens(vec3 p, float fine){
  float h0 = (p.y - bmin.y) / (bmax.y - bmin.y);
  if (h0 < 0.0 || h0 > 1.0) return 0.0;
  vec3 q = vec3(p.x, p.y * stretch, p.z) * scale + wind;
  float tt = textureLod(noise, vec3(q.x * 0.41, 0.37, q.z * 0.41), 0.0).r;
  float topHere = mix(1.0 - towers, 1.0, smoothstep(0.34, 0.68, tt));
  float h = h0 / topHere;
  if (h > 1.0) return 0.0;
  float s = textureLod(noise, q, 0.0).r * 0.66;
  s += fine > 0.5 ? textureLod(noise, q * 3.3 + wind * 0.4, 0.0).r * 0.23 + textureLod(noise, q * 9.1 + wind * 1.3, 0.0).r * 0.08 + textureLod(noise, q * 23.0, 0.0).r * 0.03 : 0.19;
  float g = smoothstep(0.0, edgeB, h) * smoothstep(1.0, 0.6, h);
  return sat((s - cover - (1.0 - g) * 0.45) * gain);
}
float segD(vec3 p, vec3 a, vec3 b){ vec3 ab = b - a; float t = sat(dot(p - a, ab) / max(dot(ab, ab), 1.0)); return length(p - a - ab * t); }
void main(){
  vec4 w = invVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 rd = normalize(w.xyz / w.w - cam);
  float zd = texture(depth, vUv).r;
  vec4 w2 = invVP * vec4(vUv * 2.0 - 1.0, zd * 2.0 - 1.0, 1.0); float tScene = zd >= 0.99999 ? 1e12 : length(w2.xyz / w2.w - cam);
  vec3 i1 = (bmin - cam) / rd, i2 = (bmax - cam) / rd, a1 = min(i1, i2), a2 = max(i1, i2);
  float t0 = max(max(a1.x, max(a1.y, a1.z)), tMin), t1 = min(min(a2.x, min(a2.y, a2.z)), tScene);
  if (t1 <= t0) { o = vec4(0.0); return; }
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy + mod(frame, 32.0) * 5.3, vec2(0.06711056, 0.00583715))));
  const int N = 44; float T = 1.0; vec3 col = vec3(0.0);
  float ratio = pow(t1 / t0, 1.0 / float(N)), t = t0 * pow(ratio, ign);
  for (int i = 0; i < N; i++) {
    float dt = t * (ratio - 1.0);
    if (T < 0.015 || t >= t1) break;
    vec3 p = cam + rd * (t + dt * 0.5);
    float d = dens(p, 1.0);
    if (d > 0.004) {
      float h = sat((p.y - bmin.y) / (bmax.y - bmin.y));
      float od = 0.0, ls = lightStep;
      for (int j = 0; j < 3; j++) { od += dens(p + sunDir * ls, 0.0) * ls; ls *= 2.6; }
      vec3 lit = mix(ambLo, ambHi, h) * mix(1.0, 0.32, sat(dens(p + vec3(0.0, lightStep * 2.0, 0.0), 0.0) * 1.2)) + sunCol * exp(-od * ext * 0.62) * (0.65 + 0.35 * d);
      lit += vec3(0.72, 0.8, 1.0) * flash * (2.3 / (1.0 + pow(segD(p, boltA, boltB), 2.0) * 0.000018));
      lit += vec3(1.0, 0.42, 0.11) * flame * (1.3 / (1.0 + pow(segD(p, flameA, flameB), 2.0) * flameK));
      for (int k = 0; k < 8; k++) { vec3 dv = p - pockets[k].xyz; lit += chargeCol * pockets[k].w * exp(-dot(dv, dv) / 170000.0); }
      lit = mix(hazeCol, lit, exp(-t * hazeK));
      float a = 1.0 - exp(-d * dt * ext);
      col += T * a * lit; T *= 1.0 - a;
    }
    t *= ratio;
  }
  o = vec4(col, 1.0 - T);
}`;
const makeVolume = (e, o) => {
  const {renderer, scene, camera} = e, W = renderer.domElement.width >> 1, H = renderer.domElement.height >> 1;
  const depthTexture = new THREE.DepthTexture(W, H); depthTexture.type = THREE.UnsignedIntType;
  const depthRT = new THREE.WebGLRenderTarget(W, H, {depthTexture, depthBuffer: true});
  const volRT = new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false});
  const u = {noise: e.cloud.noise, depth: {value: depthTexture}, invVP: {value: new THREE.Matrix4()}, cam: {value: V(0, 0, 0)}, frame: {value: 0},
    bmin: {value: o.bmin}, bmax: {value: o.bmax}, wind: {value: V(0.1, 0.2, 0.3)}, sunDir: {value: o.sunDir || V(0, 1, 0)}, sunCol: {value: o.sunCol || V(0, 0, 0)},
    ambHi: {value: o.ambHi || V(0.2, 0.22, 0.26)}, ambLo: {value: o.ambLo || V(0.03, 0.035, 0.045)}, boltA: {value: V(0, 0, 0)}, boltB: {value: V(0, 1, 0)}, flameA: {value: V(0, 0, 0)}, flameB: {value: V(0, 1, 0)}, chargeCol: {value: o.chargeCol || V(0.3, 0.42, 1.0)}, hazeCol: {value: o.hazeCol || V(0, 0, 0)},
    scale: {value: o.scale}, cover: {value: o.cover}, gain: {value: o.gain ?? 7}, ext: {value: o.ext}, flash: {value: 0}, flame: {value: 0}, flameK: {value: o.flameK ?? 0.00006}, towers: {value: o.towers ?? 0}, lightStep: {value: o.lightStep}, stretch: {value: o.stretch ?? 1}, edgeB: {value: o.edgeB ?? 0.12}, hazeK: {value: o.hazeK ?? 0}, tMin: {value: o.tMin ?? 5},
    pockets: {value: Array.from({length: 8}, () => new THREE.Vector4(0, -1e7, 0, 0))}};
  const m = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, uniforms: u, vertexShader: QUAD_VS, fragmentShader: VOL_FS, depthTest: false, depthWrite: false});
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false; qs.add(q);
  const over = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: {t: {value: volRT.texture}}, vertexShader: QUAD_VS,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; void main(){ vec2 px = 1.4 / vec2(textureSize(t, 0)); o = (texture(t, vUv) * 2.0 + texture(t, vUv + px * vec2(1.0, 0.6)) + texture(t, vUv + px * vec2(-1.0, -0.6)) + texture(t, vUv + px * vec2(-0.6, 1.0)) + texture(t, vUv + px * vec2(0.6, -1.0))) / 6.0; }`}));
  over.frustumCulled = false; over.renderOrder = 1000; scene.add(over);
  e.cloud.far_.value = 0;
  const vp = new THREE.Matrix4();
  const run = (frame, {hide = [], show = []} = {}) => {
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    over.visible = false; hide.forEach((x) => { x.visible_ = x.visible; x.visible = false; }); show.forEach((x) => { x.visible = true; });
    renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera);
    over.visible = true; hide.forEach((x) => { x.visible = x.visible_; }); show.forEach((x) => { x.visible = false; });
    u.invVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert(); u.cam.value.setFromMatrixPosition(camera.matrixWorld); u.frame.value = frame;
    renderer.setRenderTarget(volRT); renderer.clear(); renderer.render(qs, qc); renderer.setRenderTarget(null);
  };
  return {u, run};
};

// ---- CapeMap: Florida from the east at a low angle, 500 m NASA imagery; the plane flies the 32 km circle round Pad 39A and draws it ----
const GROUND_FS = `
precision highp float; precision highp sampler3D;
in vec2 vU; in vec3 vW; out vec4 o;
uniform sampler2D map; uniform sampler3D noise; uniform vec3 cam, sunDir, hazeCol, wind; uniform float ready, cScale, cloudY, cover, hazeK; uniform vec2 size;
vec4 bicubic(vec2 uv){
  vec2 st = uv * size - 0.5, i = floor(st), f = st - i;
  vec4 w0, w1; vec2 f2 = f * f, f3 = f2 * f;
  vec2 a = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0, b = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, c = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, d = f3 / 6.0;
  vec2 g0 = a + b, g1 = c + d, h0 = (b / g0 - 0.5 + i) / size + 0.0, h1 = (d / g1 + 1.5 + i) / size + 0.0;
  h0 += 0.5 / size * 0.0 ; h1 += 0.0 * h1;
  vec2 p0 = (i - 0.5 + b / g0 + 0.5) / size, p1 = (i + 1.5 + d / g1 + 0.5) / size;
  return (texture(map, vec2(p0.x, p0.y)) * g0.x + texture(map, vec2(p1.x, p0.y)) * g1.x) * g0.y + (texture(map, vec2(p0.x, p1.y)) * g0.x + texture(map, vec2(p1.x, p1.y)) * g1.x) * g1.y;
}
void main(){
  vec3 c = bicubic(vU).rgb, c0 = texture(map, vU).rgb;
  c = c + (c - bicubic(vU + vec2(1.6) / size) * 0.5 - bicubic(vU - vec2(1.6) / size) * 0.5).rgb * 0.45;         // a touch of unsharp
  float ocean = smoothstep(0.01, 0.05, c0.b - max(c0.r, c0.g * 0.95));
  float n = textureLod(noise, vec3(vW.xz * 0.00022, 0.3), 0.0).r, n2 = textureLod(noise, vec3(vW.xz * 0.00091, 0.6), 0.0).r;
  c *= 1.0 + (1.0 - ocean) * ((n - 0.55) * 0.75 + (n2 - 0.55) * 0.42);
  // what the clouds above do to the ground
  vec3 sp = vW + sunDir * ((cloudY - vW.y) / sunDir.y);
  vec3 q = vec3(sp.x, cloudY, sp.z) * cScale + wind;
  float s = textureLod(noise, q, 0.0).r * 0.66 + textureLod(noise, q * 3.3 + wind * 0.4, 0.0).r * 0.23 + 0.11 * 0.6;
  float shadow = smoothstep(cover - 0.04, cover + 0.12, s);
  vec3 col = max(c, vec3(0.0)) * 2.15 * (1.0 - 0.58 * shadow);
  vec3 v = normalize(cam - vW), h = normalize(sunDir + v);
  col += ocean * vec3(0.24, 0.26, 0.28) * pow(max(h.y, 0.0), 90.0) * (1.0 - 0.8 * shadow);
  float dist = length(cam - vW);
  col = mix(hazeCol, col, exp(-dist * hazeK));
  o = vec4(col * ready, 1.0);
}`;
export const CapeMap = () => useScene((e) => {
  const {camera, scene} = e; camera.near = 200; camera.far = 2500000; camera.fov = 34;
  e.skyHi.set(0.26, 0.31, 0.4); e.skyLo.set(0.3, 0.33, 0.37); e.final.grain.value = 0.012; e.final.vign.value = 0.42;
  const lat0 = 28.6083, lon0 = -80.6041, kx = Math.cos(rad(lat0)) * 111320, kz = 110574, X = (lo) => (lo - lon0) * kx, Z = (la) => -(la - lat0) * kz;
  const sunDir = V(0.28, 0.66, 0.7).normalize(), hazeCol = V(0.24, 0.27, 0.32);
  const VS = {scale: 1 / 26000, cover: 0.53};
  const vol = makeVolume(e, {bmin: V(-260000, 850, -260000), bmax: V(260000, 2500, 260000), scale: VS.scale, cover: VS.cover, gain: 7, ext: 0.0028, lightStep: 130, stretch: 2.2, sunDir, sunCol: V(1.5, 1.45, 1.38), ambHi: V(0.42, 0.45, 0.5), ambLo: V(0.18, 0.2, 0.24), hazeCol, hazeK: 0.0000055, tMin: 50});
  const uG = {map: {value: null}, noise: e.cloud.noise, cam: {value: V(0, 0, 0)}, sunDir: {value: sunDir}, hazeCol: {value: hazeCol}, wind: {value: V(0, 0, 0)}, ready: {value: 0}, cScale: {value: VS.scale}, cloudY: {value: 1600}, cover: {value: VS.cover}, hazeK: {value: 0.0000055}, size: {value: new THREE.Vector2(3360, 2640)}};
  const x0 = X(-87), x1 = X(-73), z0 = Z(34), z1 = Z(23);
  const gg = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1); gg.rotateX(-Math.PI / 2); gg.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const ground = new THREE.Mesh(gg, new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, uniforms: uG, fragmentShader: GROUND_FS, vertexShader: `out vec2 vU; out vec3 vW; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`}));
  ground.frustumCulled = false; scene.add(ground);
  scene.add(new THREE.DirectionalLight(0xfff3e4, 3).translateOnAxis(sunDir, 1000)); scene.add(new THREE.HemisphereLight(0xb4c0d0, 0x38424c, 0.9));
  const RING = 32000, ring = []; for (let i = 0; i <= 720; i++) { const a = rad(i * 0.5 - 62); ring.push(V(Math.cos(a) * RING, 60, Math.sin(a) * RING)); }
  const rb = makeRibbon(e, 760); scene.add(rb);
  // a small straight-wing plane; its size is enlarged about 40 times so it can be seen at all
  const plane = new THREE.Group(), pm = new THREE.MeshStandardMaterial({color: 0xe6e5de, roughness: 0.4, metalness: 0.2}), S = 1500;
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.86, 6, 14), pm); fus.rotation.z = Math.PI / 2; plane.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.016, 1.15), pm); wing.position.x = 0.05; plane.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.42), pm); tail.position.x = -0.42; plane.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.012), pm); fin.position.set(-0.42, 0.08, 0); plane.add(fin);
  plane.scale.setScalar(S); scene.add(plane);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(S * 0.95, S * 1.0), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.0, depthWrite: false})); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const beacon = makeGlow([3.2, 2.6, 1.7]); scene.add(beacon);
  const pad = makeGlow([1.9, 1.5, 1.05]); pad.position.set(0, 90, 0); scene.add(pad);
  let lastF = 0;
  const draw = (f) => {
    lastF = f;
    const k = f / 299, ek = ease(k), az = lerp(1.23, 1.05, ek), dist = lerp(103000, 88000, ek), el = 0.46;
    camera.position.set(Math.sin(az) * Math.cos(el) * dist + 2000, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
    camera.up.set(0, 1, 0); camera.lookAt(-3500, 0, -1500);
    uG.cam.value.copy(camera.position);
    const wind = V(f * 0.00012, 0.21, f * 0.00005); vol.u.wind.value.copy(wind); uG.wind.value.copy(wind);
    const a = ease(clamp((f - 8) / 280)) * 0.35 + clamp((f - 8) / 280) * 0.65, i0 = a * 720;
    const dist2 = camera.position.length();
    rb.userData.update(ring, (i) => (i <= i0 ? 3.1 : 1.3), (i) => { if (i <= i0) { const w = clamp(1 - (i0 - i) / 16); return [AMBER[0] + w * 1.2, AMBER[1] + w * 1.2, AMBER[2] + w * 1.2]; } return [0.2, 0.17, 0.11]; });
    const ang = rad(a * 360 - 62), px = Math.cos(ang) * RING, pz = Math.sin(ang) * RING;
    plane.position.set(px, 380, pz); plane.rotation.set(0, -ang - Math.PI / 2, 0); plane.rotateX(0.14);
    shadow.visible = false;
    beacon.position.copy(plane.position); beacon.scale.setScalar(dist2 * 0.024 * (0.86 + 0.14 * Math.sin(f * 0.21)));
    pad.scale.setScalar(dist2 * 0.03 * (0.92 + 0.08 * Math.sin(f * 0.13)));
    vol.run(f, {hide: [rb, beacon, pad]});
  };
  loadTextures(e, {cape: 'cape.jpg'}, (t) => { uG.map.value = t.cape; uG.ready.value = 1; draw(lastF); e.render(lastF); });
  return {draw};
});

// ---- ChargedClouds: wet ground under the storm, no lightning anywhere; the field meters on their poles, their needles pushing up, faint charge in the cloud above ----
const skyEnv = (e, hi, lo) => {
  const s = new THREE.Scene(), m = new THREE.ShaderMaterial({side: THREE.BackSide, uniforms: {hi: {value: new THREE.Color(...hi)}, lo: {value: new THREE.Color(...lo)}}, vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `uniform vec3 hi, lo; varying vec3 vP; void main(){ float y = normalize(vP).y; gl_FragColor = vec4(mix(lo, hi, smoothstep(-0.12, 0.5, y)), 1.0); }`});
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 16), m));
  const p = new THREE.PMREMGenerator(e.renderer), t = p.fromScene(s, 0.02).texture; p.dispose(); return t;
};
const dialFace = () => {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'); const cx = 512, cy = 690, R = 470;
  g.fillStyle = '#d8c79f'; g.fillRect(0, 0, 1024, 1024);
  const A = (v) => rad(-55 + (v / 10) * 110);                       // 0..10 across the scale; 0 = straight up in the middle would be 5
  g.strokeStyle = '#1a1712'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2 + A(0), -Math.PI / 2 + A(10)); g.stroke();
  g.strokeStyle = '#a81f14'; g.lineWidth = 22; g.beginPath(); g.arc(cx, cy, R - 20, -Math.PI / 2 + A(7), -Math.PI / 2 + A(10)); g.stroke();
  for (let v = 0; v <= 50; v++) { const a = A(v / 5), big = v % 5 === 0, r0 = R, r1 = R - (big ? 58 : 28); g.strokeStyle = '#1a1712'; g.lineWidth = big ? 8 : 3.5; g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.stroke(); }
  g.fillStyle = '#1a1712'; g.font = '700 62px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const v of [0, 2, 4, 6, 8, 10]) { const a = A(v); g.fillText(String(v), cx + Math.sin(a) * (R - 106), cy - Math.cos(a) * (R - 106)); }
  g.font = '700 50px Arial, sans-serif'; g.fillText('KV / M', cx, cy - 165);
  g.font = '400 30px Arial, sans-serif'; g.fillText('ELECTRIC FIELD', cx, cy + 80);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};
export const ChargedClouds = () => useScene((e) => {
  const {camera, scene} = e; camera.near = 0.08; camera.far = 60000;
  e.skyHi.set(0.16, 0.18, 0.21); e.skyLo.set(0.075, 0.085, 0.1); e.final.grain.value = 0.016; e.final.bloom.value = 0.45;
  const hz = V(0.11, 0.122, 0.142);
  scene.fog = new THREE.FogExp2(new THREE.Color(hz.x, hz.y, hz.z).getHex(THREE.LinearSRGBColorSpace), 0.00042);
  scene.environment = skyEnv(e, [0.34, 0.37, 0.42], [0.03, 0.035, 0.03]); scene.environmentIntensity = 1.0;
  const vol = makeVolume(e, {bmin: V(-26000, 620, -26000), bmax: V(26000, 3400, 26000), scale: 1 / 4200, cover: 0.42, gain: 5, ext: 0.0042, lightStep: 150, stretch: 1.7, edgeB: 0.1, ambHi: V(0.36, 0.38, 0.43), ambLo: V(0.03, 0.034, 0.042), hazeCol: hz, hazeK: 0.00011, tMin: 40, chargeCol: V(0.2, 0.32, 1.0)});
  // pockets of charge along the row, deep in the cloud
  const r0 = seeded(5237), pk = []; for (let i = 0; i < 8; i++) pk.push({x: -700 + r0() * 900 - i * 60, z: -220 - i * 470 - r0() * 200, y: 760 + r0() * 340, a: r0() * 6.28, b: 0.03 + r0() * 0.035});
  // wet ground
  const gc = document.createElement('canvas'); gc.width = gc.height = 1024; { const g = gc.getContext('2d'), r = seeded(771); g.fillStyle = '#2a2a22'; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 26000; i++) { const v = 26 + r() * 42; g.fillStyle = `rgba(${v + 8},${v + 6},${v - 4},0.5)`; g.fillRect(r() * 1024, r() * 1024, 1 + r() * 5, 1 + r() * 5); } }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(1600, 1600); gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 8;
  const rc = document.createElement('canvas'); rc.width = rc.height = 1024; { const g = rc.getContext('2d'), r = seeded(991); g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 120; i++) { const x = r() * 1024, y = r() * 1024, s = 40 + r() * 120, gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(10,10,10,0.95)'); gr.addColorStop(0.55, 'rgba(10,10,10,0.7)'); gr.addColorStop(1, 'rgba(10,10,10,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2); } }
  const rt = new THREE.CanvasTexture(rc); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(160, 160);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(50000, 50000), new THREE.MeshStandardMaterial({map: gt, roughnessMap: rt, roughness: 1, metalness: 0.0, envMapIntensity: 1.5})); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // grass and scrub: Merritt Island in the rain
  const blade = new THREE.ConeGeometry(0.035, 0.6, 3); blade.translate(0, 0.3, 0);
  const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.55, metalness: 0}), 26000), gm = new THREE.Object3D(), rg = seeded(1337), gcol = new THREE.Color();
  for (let i = 0; i < 26000; i++) { const far = rg(), L = far < 0.6 ? 26 : 130, x = (rg() - 0.5) * L * 2 + (far < 0.6 ? 0 : -10), z = (rg() - 0.8) * L * 2; const nearPole = Math.hypot(x, z) < 1.3; gm.position.set(x, 0, z); gm.rotation.set((rg() - 0.5) * 0.7, rg() * 6, (rg() - 0.5) * 0.7); const s = (nearPole ? 0.3 : 0.55 + rg() * 1.1) * (far < 0.6 ? 1 : 2.1); gm.scale.set(s, s, s); gm.updateMatrix(); grass.setMatrixAt(i, gm.matrix); gcol.setRGB(0.05 + rg() * 0.05, 0.075 + rg() * 0.06, 0.028 + rg() * 0.02); grass.setColorAt(i, gcol); }
  grass.frustumCulled = false; scene.add(grass);
  scene.add(new THREE.HemisphereLight(0x8c98a8, 0x20241c, 0.9));
  const dl = new THREE.DirectionalLight(0xb4c0d0, 0.7); dl.position.set(-30, 60, 40); scene.add(dl);
  // the meters: a steel pole, the field mill on top looking at the sky, a lit dial in its box, a needle
  const steel = new THREE.MeshStandardMaterial({color: 0x6a6e72, roughness: 0.34, metalness: 0.92}), paint = new THREE.MeshStandardMaterial({color: 0x39423c, roughness: 0.38, metalness: 0.35}), black = new THREE.MeshStandardMaterial({color: 0x101112, roughness: 0.35, metalness: 0.6});
  const concrete = new THREE.MeshStandardMaterial({color: 0x56544e, roughness: 0.82});
  const face = dialFace(), faceM = new THREE.MeshBasicMaterial({map: face, color: new THREE.Color(1.02, 0.84, 0.58), toneMapped: false, fog: false});
  const glass = new THREE.MeshPhysicalMaterial({color: 0xffffff, transparent: true, opacity: 0.11, roughness: 0.04, metalness: 0, envMapIntensity: 1.6, depthWrite: false});
  const needleM = new THREE.MeshBasicMaterial({color: new THREE.Color(0.012, 0.01, 0.008)});
  const makeMeter = () => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 3.1, 18), steel); pole.position.y = 1.55; g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.2, 24), concrete); base.position.y = 0.06; g.add(base);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.2), paint); box.position.set(0, 1.92, 0.12); g.add(box);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.34), paint); hood.position.set(0, 2.26, 0.19); hood.rotation.x = 0.1; g.add(hood);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.019, 14, 64), black); bez.position.set(0, 1.92, 0.225); g.add(bez);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.27, 64), faceM); dial.position.set(0, 1.92, 0.222); g.add(dial);
    const needleP = new THREE.Group(); needleP.position.set(0, 1.92 - 0.27 * (690 - 512) / 512 * 1.0, 0.232);
    const nd = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.232, 0.002), needleM); nd.position.y = 0.116; needleP.add(nd);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 18), black); hub.rotation.x = Math.PI / 2; needleP.add(hub);
    g.add(needleP);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(0.27, 64), glass); gl.position.set(0, 1.92, 0.24); g.add(gl);
    // the field mill: a sensor on the pole's head, its rotor spinning under a shield, facing the sky
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.18, 20), steel); collar.position.y = 3.17; g.add(collar);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.024, 36), steel); plate.position.y = 3.28; g.add(plate);
    const rotor = new THREE.Group(); rotor.position.y = 3.31;
    const sh = new THREE.Shape(); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; sh.moveTo(0, 0); sh.absarc(0, 0, 0.185, a, a + Math.PI / 4, false); sh.lineTo(0, 0); }
    const vane = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: 0.006, bevelEnabled: false}), black); vane.rotation.x = -Math.PI / 2; rotor.add(vane); g.add(rotor);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.06, 1.6, 0.05), V(0.09, 1.0, 0.06), V(0.08, 0.3, 0.05), V(0.14, 0.02, 0.1)]), 20, 0.009, 6), black); g.add(cable);
    return {g, needleP, rotor};
  };
  const hero = makeMeter(); hero.g.rotation.y = 0.22; scene.add(hero.g);
  const row = [hero]; const rp = seeded(4401);
  for (let i = 1; i < 11; i++) { const m = makeMeter(); m.g.position.set(-2.6 * i - 6 * Math.pow(i, 1.28) + (rp() - 0.5) * 6, 0, -19 * i - 4 * Math.pow(i, 1.5)); m.g.rotation.y = 0.5 + (rp() - 0.5) * 0.18; scene.add(m.g); row.push(m); }
  const pts = row.slice(1).map((m) => { const s = makeGlow([1.15, 0.72, 0.28]); s.position.copy(m.g.position); s.position.y = 1.95; s.position.z += 0.3; scene.add(s); return s; });
  // the rocket waiting on the horizon, far away in the rain
  const sat = makeSaturn(); sat.position.set(-1500, 6, -4600); sat.scale.setScalar(1.0); scene.add(sat);
  const towerM = new THREE.MeshStandardMaterial({color: 0x2c2e31, roughness: 0.7}), tw = new THREE.Mesh(new THREE.BoxGeometry(14, 136, 14), towerM); tw.position.set(-1500 + 24, 68, -4600); scene.add(tw);
  const padM = new THREE.Mesh(new THREE.BoxGeometry(50, 12, 50), towerM); padM.position.set(-1500, 2, -4600); scene.add(padM);
  // rain: every drop's place is a function of the frame
  const N = 2600, rr = seeded(8123), seedsR = []; for (let i = 0; i < N; i++) seedsR.push([rr(), rr(), rr(), 0.6 + rr() * 0.5]);
  const rPos = new Float32Array(N * 6), rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({color: new THREE.Color(0.11, 0.125, 0.145), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false})); rain.frustumCulled = false; scene.add(rain);
  const camA = V(0.62, 1.98, 1.28), camB = V(5.8, 0.95, 8.8), lookA = V(-0.1, 1.97, 0), lookB = V(-5.5, 7.9, -24), cp = V(0, 0, 0), lp = V(0, 0, 0);
  const needleAt = (f, i) => { const start = 22 + i * 7, up = ease((f - start) / 88), rest = rad(-52), top = rad(lerp(26, 41, ((i * 37) % 11) / 10)); return lerp(rest, top, up) + Math.sin(f * 0.31 + i * 1.7) * 0.012 * (0.4 + up) + Math.sin(f * 1.27 + i) * 0.006 * up; };
  return {draw: (f) => {
    const mv = ease((f - 104) / 180);
    cp.lerpVectors(camA, camB, mv); lp.lerpVectors(lookA, lookB, mv);
    cp.x += Math.sin(f * 0.019) * 0.012; cp.y += Math.sin(f * 0.027 + 1) * 0.01;
    camera.position.copy(cp); camera.up.set(0, 1, 0); camera.lookAt(lp); camera.fov = lerp(40, 58, mv);
    row.forEach((m, i) => { m.needleP.rotation.z = -needleAt(f, i); m.rotor.rotation.y = f * 0.62 + i; });
    const glowF = ease((f - 30) / 120);
    pk.forEach((p, i) => { const w = glowF * (0.16 + 0.1 * Math.sin(f * p.b + p.a) + 0.05 * Math.sin(f * p.b * 2.7 + p.a * 2)); vol.u.pockets.value[i].set(p.x, p.y, p.z, Math.max(0, w)); });
    pts.forEach((s, i) => { s.scale.setScalar(cp.distanceTo(s.position) * 0.022); });
    vol.u.wind.value.set(f * 0.00018, -f * 0.00011 + 0.17, f * 0.00009);
    for (let i = 0; i < N; i++) { const [a, b, c, sp] = seedsR[i], L = 0.42 * sp; const H = 22, y = ((c * H - f * 0.72 * sp) % H + H) % H, x = cp.x + (a - 0.5) * 34 - (y * 0.12) - 8, z = cp.z + (b - 0.92) * 34; rPos.set([x, y, z, x + 0.05, y + L, z], i * 6); }
    rGeo.attributes.position.needsUpdate = true;
    vol.run(f, {hide: [rain, ...pts]});
  }};
});

// ---- CloudTops: a side view of the cloud stack at true scale, ground to tops; the rule's line at 10,000 ft, the tops at 23,000 ft, the Saturn climbing through ----
// Camera level and held at one height, so these lines stay at fixed screen heights all the way: y 605 for 10,000 ft and y 228 for 23,000 ft in a 1080 picture (see CLOUD_* below).
const FT = 0.3048, Y10K = 10000 * FT, Y23K = 23000 * FT;
const SKY_LO = 0.022;
export const CloudTops = () => useScene((e) => {
  const {camera, scene} = e; camera.near = 50; camera.far = 800000; camera.fov = 27;
  e.skyHi.set(0.22, 0.31, 0.46); e.skyLo.set(0.13, 0.17, 0.24); e.final.grain.value = 0.014; e.final.bloom.value = 0.42; e.final.vign.value = 0.4;
  const sunDir = V(-0.62, 0.62, 0.48).normalize();
  const vol = makeVolume(e, {bmin: V(-34000, 620, -9000), bmax: V(34000, Y23K, 1400), scale: 1 / 15500, cover: 0.34, gain: 5.5, ext: 0.0021, lightStep: 240, stretch: 0.8, towers: 0.34, edgeB: 0.05, sunDir, sunCol: V(1.75, 1.66, 1.52), ambHi: V(0.33, 0.36, 0.42), ambLo: V(0.028, 0.032, 0.04), flameK: 0.0000024, hazeK: 0, tMin: 200});
  const groundM = new THREE.MeshStandardMaterial({color: 0x171c16, roughness: 0.9}); const ground = new THREE.Mesh(new THREE.PlaneGeometry(400000, 400000), groundM); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0x8c98a8, 0x20241c, 0.5));
  const key = new THREE.DirectionalLight(0xfff0dc, 3.0); key.position.copy(sunDir).multiplyScalar(1000); scene.add(key);
  const rocket = makeSaturn(); scene.add(rocket);
  const flame = makeFlame(); scene.add(flame);
  const core = makeGlow([3.4, 1.7, 0.6]); scene.add(core);
  // the exhaust trail, as long as the climb
  const tu = {head: {value: 1000}, sunDir: {value: sunDir}, cam: e.common.cam};
  const tgeo = new THREE.CylinderGeometry(1, 1, 1, 20, 240, true); tgeo.translate(0, 0.5, 0);
  const trail = new THREE.Mesh(tgeo, new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: tu,
    vertexShader: `out vec3 vN; out vec3 vW; out float vY; uniform float head; void main(){ float y = position.y * head, age = head - y; float r = 12.0 + age * 0.03; vec3 c = vec3(y * 0.03 + sin(y * 0.0041) * age * 0.018, y, sin(y * 0.0029 + 1.0) * age * 0.012); vec3 w = c + normal * r; vN = normal; vW = w; vY = y; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vW; in float vY; out vec4 o; uniform vec3 cam, sunDir; uniform float head; void main(){ vec3 v = normalize(cam - vW); float edge = pow(abs(dot(normalize(vN), v)), 1.1); float age = clamp((head - vY) / 3000.0, 0.0, 1.0); float a = edge * mix(0.95, 0.5, age) * smoothstep(0.0, 25.0, head - vY) ; vec3 c = mix(vec3(1.1, 1.02, 0.94), vec3(0.42, 0.42, 0.44), age) * (0.4 + 0.75 * max(dot(normalize(vN), sunDir), 0.0)); o = vec4(c * a, a); }`}));
  trail.frustumCulled = false; trail.material.blending = THREE.CustomBlending; trail.material.blendSrc = THREE.OneFactor; trail.material.blendDst = THREE.OneMinusSrcAlphaFactor; scene.add(trail);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 1, 8), new THREE.MeshBasicMaterial({colorWrite: false})); proxy.visible = false; scene.add(proxy);
  // the two lines. Added light, drawn after the clouds, always in front of them
  const lineA = makeRibbon(e, 40), lineB = makeRibbon(e, 40); e.glow.add(lineA, lineB);
  const lp = (y) => { const out = []; for (let i = 0; i <= 30; i++) out.push(V(-30000 + i * 2000, y, 1500)); return out; };
  const LA = lp(Y10K), LB = lp(Y23K);
  // T+10 to about T+72 over 12 s; altitude from the mission's own numbers: 1,920 m at T+36.5, 4,400 m at T+52
  const altAt = (t) => 1920 * Math.pow(t / 36.5, 2.34), tOf = (f) => 10 + (f / 30) * 5.2;
  return {draw: (f) => {
    const t = tOf(f), y = altAt(t), x = y * 0.03;
    camera.position.set(lerp(-700, 700, f / 359), 3840, 24000); camera.up.set(0, 1, 0); camera.rotation.set(0, 0, 0);
    e.common.cam.value.copy(camera.position);
    rocket.position.set(x, y, 0); rocket.rotation.z = -0.03; flame.position.set(x, y, 0); flame.rotation.z = -0.03; flame.userData.tick(f / 30);
    core.position.set(x, y - 30, 0); core.scale.setScalar(760);
    tu.head.value = y - 8;
    proxy.position.set(x * 0.5, y * 0.5, 0); proxy.scale.y = y; proxy.rotation.z = -0.03;
    const inCloud = 1 - clamp((y - Y23K) / 300);
    vol.u.flame.value = 1.5 * inCloud; vol.u.flameA.value.set(x, y - 6, 0); vol.u.flameB.value.set(x, y - 340, 0);
    vol.u.wind.value.set(f * 0.00026, f * 0.00008 + 0.33, f * 0.00012);
    const dr = ease(f / 42);
    lineA.userData.update(LA, () => 3, (i) => (i / 30 <= dr ? [AMBER[0], AMBER[1], AMBER[2]] : [0, 0, 0]));
    const drB = ease((f - 14) / 42);
    lineB.userData.update(LB, () => 1.6, (i) => (i / 30 <= drB ? [0.72, 0.74, 0.8] : [0, 0, 0]));
    vol.run(f, {hide: [flame, core, trail], show: [proxy]});
  }};
});

// ---- RocketWire: the rocket and its trail reaching up through charged cloud like a wire. It pulls back along the whole length, the charge gathers at the nose, and the discharge runs down the trail to the ground. ----
export const RocketWire = () => useScene((e) => {
  const {camera, scene} = e; camera.near = 3; camera.far = 200000;
  e.skyHi.set(0.1, 0.115, 0.14); e.skyLo.set(0.03, 0.034, 0.042); e.final.bloom.value = 0.55; e.final.grain.value = 0.016;
  const vol = makeVolume(e, {bmin: V(-11000, 640, -9000), bmax: V(11000, 5200, 240), scale: 1 / 4300, cover: 0.37, gain: 5.5, ext: 0.0038, lightStep: 170, stretch: 1.25, edgeB: 0.04, ambHi: V(0.27, 0.29, 0.34), ambLo: V(0.02, 0.023, 0.03), chargeCol: V(0.22, 0.34, 1.0), flameK: 0.000012, tMin: 40});
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000), new THREE.MeshStandardMaterial({color: 0x10130f, roughness: 0.42, metalness: 0})); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0x8fa0b4, 0x201a16, 0.3));
  const key = new THREE.DirectionalLight(0xb0c0d4, 2.2); key.position.set(-200, 60, 90); scene.add(key);
  const strike = new THREE.DirectionalLight(0xdfe8ff, 0); scene.add(strike);
  const fire = new THREE.PointLight(0xff7a2a, 26000, 300, 1.8); scene.add(fire);
  const rocket = makeSaturn(); scene.add(rocket);
  const flame = makeFlame(); scene.add(flame);
  const core = makeGlow([3.0, 1.45, 0.5]); scene.add(core);
  const towerM = new THREE.MeshStandardMaterial({color: 0x24262a, roughness: 0.7}), tw = new THREE.Mesh(new THREE.BoxGeometry(14, 136, 14), towerM); tw.position.set(30, 68, 0); scene.add(tw);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(60, 12, 60), towerM); pad.position.y = 2; scene.add(pad);
  const tPath = (y, head) => { const age = head - y; return V(y * 0.05 + Math.sin(y * 0.0041) * age * 0.02, y, Math.sin(y * 0.0029 + 1) * age * 0.014); };
  const tu = {head: {value: 1000}, cam: e.common.cam, ion: {value: 0}, run: {value: -1}, time: {value: 0}, runAmt: {value: 0}};
  const VSH = (grow) => `out vec3 vN; out vec3 vW; out float vY; uniform float head; void main(){ float y = position.y * head, age = head - y; float r = (6.0 + age * 0.03) * ${grow}; vec3 c = vec3(y * 0.05 + sin(y * 0.0041) * age * 0.02, y, sin(y * 0.0029 + 1.0) * age * 0.014); vec3 w = c + normal * r; vN = normal; vW = w; vY = y; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
  const tgeo = new THREE.CylinderGeometry(1, 1, 1, 24, 320, true); tgeo.translate(0, 0.5, 0);
  const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); vec2 w = vec2(1.0, 0.0); return mix(mix(h(i), h(i + w), f.x), mix(h(i + w.yx), h(i + 1.0), f.x), f.y); } float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }`;
  const smoke = new THREE.Mesh(tgeo, new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: tu, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, vertexShader: VSH('1.0'),
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vW; in float vY; out vec4 o; uniform vec3 cam; uniform float head, time; ${NOISE} void main(){ vec3 N = normalize(vN), v = normalize(cam - vW); float edge = pow(abs(dot(N, v)), 1.15); float ang = atan(N.z, N.x); float t = fbm(vec2(ang * 2.2, vY * 0.012 - time * 0.04)); float age = clamp((head - vY) / 2400.0, 0.0, 1.0); float a = edge * (0.28 + 0.8 * t) * mix(0.95, 0.72, age) * smoothstep(0.0, 18.0, head - vY); vec3 c = mix(vec3(0.62, 0.42, 0.28), vec3(0.2, 0.21, 0.235), smoothstep(0.0, 0.16, age)) * (0.62 + 0.55 * max(N.x * -0.7 + N.y * 0.4 + N.z * 0.5, 0.0)); o = vec4(c * a, a); }`}));
  smoke.frustumCulled = false; scene.add(smoke);
  const ionM = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: tu, vertexShader: VSH('1.22'),
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vW; in float vY; out vec4 o; uniform vec3 cam; uniform float head, time, ion, run, runAmt; ${NOISE} void main(){ vec3 N = normalize(vN), v = normalize(cam - vW); float dv = abs(dot(N, v)); float rim = pow(1.0 - dv, 2.2) + 0.25 * pow(dv, 3.0); float ang = atan(N.z, N.x); float streak = fbm(vec2(ang * 3.0, vY * 0.022 - time * 2.2)); float wave = 0.65 + 0.35 * sin(vY * 0.021 - time * 3.4); float a = rim * ion * (0.25 + 1.5 * streak * streak) * wave * smoothstep(0.0, 30.0, head - vY) * 1.5; float lit = run >= 0.0 ? smoothstep(run - 90.0, run + 6.0, vY) : 0.0; o = vec4(vec3(0.3, 0.5, 1.15) * a + vec3(0.8, 0.95, 1.5) * rim * lit * runAmt * 4.0, 1.0); }`});
  const ion = new THREE.Mesh(tgeo, ionM); ion.frustumCulled = false; scene.add(ion);
  const proxy = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1, 8), new THREE.MeshBasicMaterial({colorWrite: false})); proxy.visible = false; scene.add(proxy);
  // the moving discharge: a jagged channel that hugs the trail, drawn from the cloud down to wherever its head has got to
  const D0 = 232, GROUND_F = D0 + 15, altAt = (t) => 1920 * Math.pow(t / 36.5, 2.34), tOf = (f) => 28.8 + f / 30;
  const headD = altAt(tOf(D0));
  const rj = seeded(60601), channel = [];
  const high = V(-430, headD + 1050, -520), nose = tPath(headD, headD).clone().add(V(0, 118, 0));
  const jag = (a, b, n, amp) => { const out = []; for (let i = 0; i < n; i++) { const k = i / n, p = a.clone().lerp(b, k), w = Math.sin(k * Math.PI); out.push(p.add(V((rj() - 0.5) * amp * (0.4 + w), 0, (rj() - 0.5) * amp * (0.4 + w)))); } return out; };
  channel.push(...jag(high, nose, 70, 90));
  const NOSE_I = channel.length;
  for (let i = 0; i <= 260; i++) { const y = headD + 110 - (i / 260) * (headD + 110), c = tPath(Math.min(y, headD), headD); const a = rj(), b = rj(); channel.push(c.add(V((a - 0.5) * 34 + Math.sin(i * 0.37) * 8, 0, (b - 0.5) * 34))); }
  const chan = makeRibbon(e, 400); e.glow.add(chan);
  const halo = makeRibbon(e, 400); e.glow.add(halo);
  const branches = makeBolt([high.clone().add(V(-260, 620, -200)), high, nose], 73, 0.42); e.glow.add(branches);
  const ring = makeBolt([V(tPath(30, headD).x, 44, 0), V(tPath(30, headD).x + 160, 2, 60), V(tPath(30, headD).x + 320, 0, 40)], 19, 0.4); e.glow.add(ring);
  const nimbus = makeGlow([0.5, 0.72, 1.5]); scene.add(nimbus);
  const hit = makeGlow([5, 5.6, 7]); e.glow.add(hit);
  const r1 = seeded(2711), pk = []; for (let i = 0; i < 8; i++) pk.push({x: -560 + r1() * 1100, y: 1050 + i * 270 + r1() * 150, z: -180 - r1() * 700, a: r1() * 6.28, b: 0.04 + r1() * 0.05});
  const cam = V(0, 0, 0), look = V(0, 0, 0);
  return {draw: (f) => {
    const t = tOf(f), y = altAt(t), x = y * 0.05, time = f / 30;
    rocket.position.set(x, y, 0); rocket.rotation.z = -0.05; flame.position.set(x, y, 0); flame.rotation.z = -0.05; flame.userData.tick(time);
    fire.position.set(x, y - 12, 0); core.position.set(x, y - 34, 0); core.scale.setScalar(340);
    tu.head.value = y - 6; tu.time.value = time;
    proxy.position.set(x * 0.5, y * 0.5, 0); proxy.scale.y = y; proxy.rotation.z = -0.05;
    // close on the rocket, then one long pull back and down till the whole trail is in the picture
    const k = ease((f - 6) / 180);
    cam.set(lerp(x - 245, -2650, k), lerp(y - 62, 980, k), lerp(330, 3050, k));
    look.set(lerp(x + 4, -240, k), lerp(y + 34, 1262, k), 0);
    const fl = flashAt(f, GROUND_F), lead = f >= D0 && f < GROUND_F ? 0.28 : 0;
    const sx = Math.sin(f * 17.3) * fl * 7, sy = Math.cos(f * 13.1) * fl * 7;
    camera.position.set(cam.x + sx, cam.y + sy, cam.z); camera.up.set(lerp(-0.05, 0, k), 1, 0); camera.lookAt(look); camera.fov = lerp(48, 38, k);
    camera.updateMatrixWorld(); e.common.cam.value.setFromMatrixPosition(camera.matrixWorld);
    // the charge gathers towards the nose
    const gather = ease((f - 110) / (D0 - 110));
    pk.forEach((p, i) => { const c = 0.1 + 0.08 * Math.sin(f * p.b + p.a) + 0.05 * Math.sin(f * p.b * 2.3 + p.a * 2); const pull = ease((f - 120) / 110); vol.u.pockets.value[i].set(lerp(p.x, x * 0.5 + p.x * 0.32, pull), lerp(p.y, Math.max(p.y * 0.4, y - 700 + i * 230), pull), lerp(p.z, -200, pull), Math.max(0, c) * (0.65 + gather * 1.9) * (1 - clamp((f - GROUND_F) / 12) * 0.5)); });
    tu.ion.value = f < 40 ? 0.15 + (f / 40) * 0.1 : lerp(0.25, 0.85, gather) * (f > GROUND_F ? Math.exp(-(f - GROUND_F) * 0.012) + 0.25 : 1);
    nimbus.position.set(x + Math.sin(0.05) * 113, y + 113, 0); const nm = gather * (0.75 + 0.25 * Math.sin(f * 1.7) * Math.sin(f * 0.41)) * (f >= D0 ? 0 : 1); nimbus.scale.setScalar(120 + nm * 170); nimbus.material.opacity = nm;
    // the run
    const running = f >= D0, prog = clamp((f - D0) / (GROUND_F - D0)), hi = prog * (channel.length - 1), runY = running ? lerp(headD + 200, 0, prog) : -1;
    tu.run.value = running && f < GROUND_F + 2 ? runY : (f >= GROUND_F ? 0 : -1); tu.runAmt.value = running ? (f < GROUND_F ? 0.9 : Math.max(fl * 1.1, 0)) : 0;
    const after = f >= GROUND_F ? fl : 0, pw = running ? (f < GROUND_F ? 1 : Math.max(after, 0)) : 0;
    const colF = (mul) => (i) => { if (!running || i > hi) return [0, 0, 0]; const near = clamp(1 - (hi - i) / 22); const base = f < GROUND_F ? 0.45 + near * 1.3 : 1; const c = pw * base * mul; return [c * 11, c * 13, c * 19]; };
    chan.visible = halo.visible = running && pw > 0.004;
    if (chan.visible) { chan.userData.update(channel, () => 2.6, colF(1)); halo.userData.update(channel, () => 11, colF(0.055)); }
    branches.userData.update(camera, after > 0.6 ? after : after * 0.3); ring.userData.update(camera, after > 0.5 ? after : 0);
    hit.visible = running && prog < 1 && prog > 0; hit.position.copy(channel[Math.min(channel.length - 1, Math.floor(hi))]); hit.scale.setScalar(camera.position.distanceTo(hit.position) * 0.05);
    const fv = Math.max(after * 0.85, lead);
    vol.u.flash.value = fv; vol.u.boltA.value.set(high.x, high.y, high.z); vol.u.boltB.value.copy(nose);
    e.common.flash.value = fv * 0.55;
    vol.u.flame.value = 1.3; vol.u.flameA.value.set(x, y - 8, 0); vol.u.flameB.value.set(x, y - 190, 0);
    vol.u.wind.value.set(f * 0.0007, -f * 0.0008 + 0.47, f * 0.0003);
    strike.intensity = after * 6; strike.position.set(-300, y + 300, 180);
    e.final.white.value = f === GROUND_F ? 0.2 : 0;
    vol.run(f, {hide: [flame, core, smoke, ion, nimbus], show: [proxy]});
  }};
});

// plates of this group: name -> [component, frames]
export const PLATES = {EarthOrbit: [EarthOrbit, 300], TLIArc: [TLIArc, 360], CapeMap: [CapeMap, 300], ChargedClouds: [ChargedClouds, 300], CloudTops: [CloudTops, 360], RocketWire: [RocketWire, 330]};
