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

// a camera-facing ribbon of a fixed screen width, one smooth strip with its sides shared between neighbours (no steps along a curve); the camera's matrix is brought up to date first
const makeRibbon = (e, maxPts, {additive = true} = {}) => {
  const pos = new Float32Array(maxPts * 6), col = new Float32Array(maxPts * 6), idx = new Uint32Array((maxPts - 1) * 6);
  for (let i = 0; i < maxPts - 1; i++) { const a = i * 2; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
  mesh.frustumCulled = false;
  const cam = V(0, 0, 0), t = V(0, 0, 0), v = V(0, 0, 0), s = V(0, 0, 0);
  // pts: list of Vector3; widthPx(i), color(i) -> [r, g, b]
  mesh.userData.update = (pts, widthPx, color) => {
    const cm = e.camera; cm.updateMatrixWorld(); cam.setFromMatrixPosition(cm.matrixWorld);
    const H = e.renderer.domElement.height, kk = (2 * Math.tan(rad(cm.fov) / 2)) / H, n = Math.min(pts.length, maxPts);
    for (let i = 0; i < n; i++) {
      const p = pts[i], c = color(i);
      t.copy(pts[Math.min(i + 1, n - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize(); v.copy(p).sub(cam); const d = v.length(); v.normalize(); s.crossVectors(t, v).normalize();
      const w = d * kk * widthPx(i) * 0.5, k = i * 6;
      pos[k] = p.x + s.x * w; pos[k + 1] = p.y + s.y * w; pos[k + 2] = p.z + s.z * w; pos[k + 3] = p.x - s.x * w; pos[k + 4] = p.y - s.y * w; pos[k + 5] = p.z - s.z * w;
      col[k] = col[k + 3] = c[0]; col[k + 1] = col[k + 4] = c[1]; col[k + 2] = col[k + 5] = c[2];
    }
    geo.setDrawRange(0, Math.max(0, n - 1) * 6); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
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
    const m = Math.pow(r(), 5.5), warm = r(), lum = 0.09 + m * 1.45;
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
  vec3 r = q + w * 0.2;
  float a = T(r) * 0.52 + T(r * 3.07 + w * 0.4) * 0.25 + T(r * 8.3) * 0.13 + T(r * 23.0) * 0.07 + T(r * 59.0) * 0.03;
  float la = n.y, ab = abs(la);
  float cover = 0.525 - 0.05 * exp(-pow((la - 0.1) / 0.1, 2.0)) + 0.055 * exp(-pow((ab - 0.42) / 0.14, 2.0)) - 0.06 * exp(-pow((ab - 0.8) / 0.18, 2.0));
  float fr = exp(-pow(dot(n, front) / 0.05, 2.0)) * smoothstep(0.86, 0.97, dot(n, frontAt));       // the cold front that sat over Florida that day
  cover -= fr * 0.1;
  return smoothstep(cover, cover + 0.15, a);
}
void main(){
  vec3 N = normalize(vN), L = normalize(vL), V_ = normalize(cam - vW);
  float ndl = dot(N, sun);
  vec3 c = texture(day, vU).rgb;
  if (hasDet > 0.5) { vec2 d = vec2(vU.x * 2.0 - 0.5, (vU.y - 0.5) * 3.0);               // lon -90..90, lat 0..60
    if (d.x > 0.0 && d.x < 1.0 && d.y > 0.0 && d.y < 1.0) c = mix(c, texture(det, d).rgb, smoothstep(0.0, 0.01, d.x) * smoothstep(1.0, 0.99, d.x) * smoothstep(0.0, 0.02, d.y) * smoothstep(1.0, 0.98, d.y)); }
  float ocean = smoothstep(0.012, 0.05, c.b - max(c.r, c.g * 0.92));
  float lit = smoothstep(-0.012, 0.06, ndl) * (0.3 + 0.7 * sqrt(clamp(ndl, 0.0, 1.0)));
  float d = clouds(L), sh = clouds(normalize(L + sun * 0.012));
  vec3 sunCol = mix(vec3(1.5, 0.66, 0.36), vec3(1.0, 0.98, 0.94), smoothstep(0.0, 0.07, ndl)) * 1.75;
  vec3 ground = c * sunCol * lit * (1.0 - 0.62 * sh);
  vec3 H = normalize(sun + V_);
  float spec = pow(max(dot(N, H), 0.0), 240.0) * 2.2 + pow(max(dot(N, H), 0.0), 30.0) * 0.08;
  ground += vec3(1.0, 0.92, 0.8) * spec * ocean * (1.0 - d) * smoothstep(0.0, 0.1, ndl);
  vec3 cl = vec3(0.78, 0.8, 0.83) * sunCol * lit * (0.52 + 0.5 * smoothstep(0.1, 0.95, d)) * (1.0 - 0.3 * sh);
  vec3 col = mix(ground, cl, d * 0.96);
  float fres = pow(1.0 - clamp(dot(N, V_), 0.0, 1.0), 3.4);
  vec3 air = vec3(0.13, 0.3, 0.72);
  col = mix(col, air * 1.5 * lit + vec3(0.9, 0.34, 0.1) * 0.3 * exp(-pow((ndl - 0.008) / 0.028, 2.0)), clamp(fres * 0.78 + 0.05, 0.0, 1.0) * smoothstep(-0.1, 0.03, ndl));
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
  vec3 col = vec3(0.1, 0.3, 1.0) * lit * od * 1.9 + vec3(1.0, 0.33, 0.07) * band * exp(-max(alt, 0.0) / (Hs * 0.7)) * od * 2.2;
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

// ---- EarthOrbit: the real geometry of that hour, the Sun where it was at 16:40 UT. One move: from just behind the stack over the Atlantic, up and back till the whole curve of the Earth is in the picture; the stack flies on into the night side and its sunlight goes out. ----
export const EarthOrbit = () => useScene((e) => {
  indoors(e); e.final.grain.value = 0.012; e.final.bloom.value = 0.5; e.final.vign.value = 0.4;
  const {camera, scene} = e; camera.fov = 38;
  const sun = llp(-65.5, -18);
  const earth = makeEarth(e, sun, {detail: true});
  const stars = makeStars(5200, 4111, 900000); scene.add(stars);
  const light = new THREE.DirectionalLight(0xfff4e6, 3.0); light.position.copy(sun).multiplyScalar(1000); scene.add(light);
  const shine = new THREE.HemisphereLight(0x070a12, 0x3a5a8a, 0.0); scene.add(shine);
  const stack = makeStack(); scene.add(stack);
  const dot = makeGlow([1.7, 1.25, 0.72]); scene.add(dot);
  const rb = makeRibbon(e, 900); scene.add(rb);
  const P0 = llp(-80.6, 28.6), N0 = V(0, 1, 0).sub(P0.clone().multiplyScalar(P0.y)).normalize(), E0 = N0.clone().cross(P0).normalize(), Hd = E0.clone().multiplyScalar(Math.sin(rad(72))).add(N0.clone().multiplyScalar(Math.cos(rad(72)))).normalize();
  const RO = R_E + 190;
  const at = (deg) => P0.clone().multiplyScalar(Math.cos(rad(deg))).add(Hd.clone().multiplyScalar(Math.sin(rad(deg))));
  let cross = 90; for (let d = 20; d < 170; d += 0.1) if (at(d).dot(sun) < 0) { cross = d; break; }
  const FC = 205, RATE = 0.165, ring = []; for (let i = 0; i <= 720; i++) ring.push(at(i * 0.5).multiplyScalar(RO));
  let lastF = 0;
  const draw = (f) => {
    lastF = f;
    const th = cross + (f - FC) * RATE, U = at(th), Tn = at(th + 90), S = Tn.clone().cross(U).normalize(), P = U.clone().multiplyScalar(RO);
    const pull = ease((f - 4) / 262), alt = Math.exp(lerp(Math.log(1250), Math.log(5600), pull));
    const thc = th - lerp(1, 21, ease((f - 20) / 255)), Uc = at(thc), Tc = at(thc + 90), Sc = Tc.clone().cross(Uc).normalize();
    const beta = rad(lerp(14, 25, pull)), gam = rad(lerp(47, 22, pull));
    const dir = Uc.clone().multiplyScalar(Math.cos(beta)).addScaledVector(Sc, Math.sin(beta));
    const up = Sc.clone().multiplyScalar(-Math.cos(beta)).addScaledVector(Uc, Math.sin(beta)).normalize();
    camera.position.copy(dir).multiplyScalar(R_E + alt);
    camera.up.copy(up);
    camera.lookAt(camera.position.clone().addScaledVector(dir, -Math.cos(gam)).addScaledVector(up, Math.sin(gam)));
    camera.near = alt * 0.04; camera.far = 2000000;
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    e.common.cam.value.copy(camera.position);
    stars.position.copy(camera.position);
    // into the Earth's shadow
    const along = P.dot(sun), perp = P.clone().addScaledVector(sun, -along).length(), shade = along > 0 ? 1 : clamp((perp - R_E) / 60 + 0.5);
    light.intensity = 3.0 * shade;
    shine.intensity = lerp(0.1, 0.8, shade);
    // the stack is drawn larger than life, or it would be under a pixel: 90 px on screen at the start, 13 at the end
    const dist = camera.position.distanceTo(P), px = lerp(92, 13, pull);
    stack.scale.setScalar((px * dist * 2 * Math.tan(rad(19))) / (38 * 1080));
    stack.position.copy(P); stack.quaternion.setFromUnitVectors(V(0, 1, 0), Tn.clone().normalize());
    dot.position.copy(P).addScaledVector(Tn, 14); dot.scale.setScalar(dist * lerp(0.007, 0.012, pull));
    dot.material.color.setRGB(1.3 * shade + 0.5, 1.1 * shade + 0.3, 0.8 * shade + 0.1);
    stars.material.uniforms.amt.value = lerp(0.55, 1, ease((f - 140) / 80));
    const i0 = th * 2, cFn = (i) => { const d = (i - i0) * 0.5;          // the track behind it in amber, ahead of it thin and pale
      if (d <= 0) { const a = clamp(1 + d / 60); return [AMBER[0] * a, AMBER[1] * a, AMBER[2] * a]; }
      const a = clamp(1 - d / 80) * 0.42; return [0.8 * a, 0.86 * a, 0.95 * a]; };
    rb.userData.update(ring, (i) => ((i - i0) <= 0 ? 2.4 : 1.4), cFn);
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
  const A0 = R_E * 1.17, D = R_E * 10.2, NUM = rad(166), TH0 = rad(-142);        // burn point, how far round the Moon sits; TH0 = the burn's direction
  const ecc = (D - A0) / (A0 - D * Math.cos(NUM)), pp = A0 * (1 + ecc);
  const arcAt = (nu) => { const r = pp / (1 + ecc * Math.cos(nu)), th = TH0 + nu; return plane(r * Math.cos(th), r * Math.sin(th)); };
  const loopAt = (nu) => { const th = TH0 + nu; return plane(A0 * Math.cos(th), A0 * Math.sin(th)); };
  const moonPos = arcAt(NUM);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R_E * 0.36, 128, 96), new THREE.MeshStandardMaterial({map: moonTexture(), roughness: 1, metalness: 0})); moon.position.copy(moonPos);
  moon.rotation.y = Math.atan2(moonPos.z, -moonPos.x) + 0.5; scene.add(moon);
  const loop = []; for (let i = 0; i <= 360; i++) loop.push(loopAt(rad(i - 360)));
  const arc = []; for (let i = 0; i <= 700; i++) arc.push(arcAt((i / 700) * NUM));
  const rLoop = makeRibbon(e, 400), rArc = makeRibbon(e, 760); scene.add(rLoop, rArc);
  const craft = makeGlow([2.0, 1.75, 1.4]); scene.add(craft);
  const flare = makeGlow([5, 3.4, 1.7]), flare2 = makeGlow([3, 1.5, 0.45]); scene.add(flare, flare2);
  const plume = makeRibbon(e, 8); scene.add(plume);
  const F_BURN = 96, F_END = 138, F_ARRIVE = 330;
  // the arc's progress in true-anomaly: quick out of the burn, then slower and slower as it climbs away from the Earth
  const nuOf = (f) => { if (f < F_END) return rad(lerp(-5, 26, ease((f - F_BURN) / (F_END - F_BURN)) * 0.5 + clamp((f - F_BURN) / (F_END - F_BURN)) * 0.5)); const x = clamp((f - F_END) / (F_ARRIVE - F_END)); return lerp(rad(26), NUM - 0.012, 1 - Math.pow(1 - x, 1.55)); };
  const look = V(0, 0, 0), mid = moonPos.clone().multiplyScalar(0.5); let lastF = 0;
  const draw = (f) => {
    lastF = f;
    const pull = ease((f - 120) / 196), near = ease(f / 110);
    const dist = lerp(lerp(R_E * 3.7, R_E * 3.25, near), R_E * 11.6, pull);
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
    rLoop.userData.update(loop, () => 1.7, (i) => { const onit = onLoop ? (i <= lh ? 1 : 0.3) : 1; const c = onit * loopFade; return [0.5 * c, 0.52 * c, 0.54 * c]; });
    const headI = onLoop ? -1 : (nu / NUM) * 700;
    rArc.userData.update(arc, () => lerp(2.6, 3.4, pull), (i) => { if (i > headI) return [0, 0, 0]; const k = clamp((headI - i) / 30); const w = 1 - k; return [AMBER[0] + w * 0.8, AMBER[1] + w * 1, AMBER[2] + w * 1.4]; });
    const dc = camera.position.distanceTo(head);
    craft.position.copy(head); craft.scale.setScalar(dc * 0.016);
    const bp = f < F_BURN - 2 ? 0 : (f < F_BURN + 6 ? (f - F_BURN + 2) / 8 : (f < F_END - 6 ? 1 : clamp((F_END + 4 - f) / 10)));
    const pulse = 1 + 0.1 * Math.sin(f * 2.1) * Math.sin(f * 0.77);
    flare.visible = flare2.visible = bp > 0.001;
    flare.position.copy(head); flare.scale.setScalar(dc * 0.06 * bp * pulse); flare.material.color.setRGB(5.2 * bp, 3.4 * bp, 1.7 * bp);
    flare2.position.copy(head); flare2.scale.setScalar(dc * 0.085 * bp * pulse); flare2.material.opacity = 0.42 * bp;
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

// ---- my own cloud pass: a march through a box of cloud, stopped at the scene's depth, laid over the scene before the engine's composite. ----
// Its steps cover the box and not a fixed distance, so it works from 30 km away. The rocket's exhaust is marched in the same pass (a short march across the column), so cloud and smoke cover each other properly.
const VOL_FS = `
precision highp float; precision highp sampler3D;
in vec2 vUv; out vec4 o;
uniform sampler3D noise; uniform sampler2D depth;
uniform mat4 invVP; uniform vec3 cam, bmin, bmax, wind, sunDir, sunCol, ambHi, ambLo, boltA, boltB, flameA, flameB, chargeCol, hazeCol, tSmoke;
uniform float fineFar, tFar, scale, cover, gain, ext, flash, flame, flameK, frame, towers, lightStep, stretch, edgeB, hazeK, tMin, detail, boltK, pocketR, topB;
uniform float tOn, tHead, tR0, tRk, tLean, tScale, tExt, tTime, tIon, tRun, tRunAmt;
uniform vec4 pockets[8], clearZ; uniform vec2 frontZ; uniform vec3 baseY;
float sat(float x){ return clamp(x, 0.0, 1.0); }
float mask(vec3 p){ float m = 1.0;
  if (clearZ.w > 0.0) m *= smoothstep(clearZ.z, clearZ.w, length(p.xz - clearZ.xy));
  if (frontZ.y > frontZ.x) m *= 1.0 - smoothstep(frontZ.x, frontZ.y, p.z);
  return m; }
float dens(vec3 p, float fine){                 // fine < 0: the big shapes only, for the light; 0..1: how much of the finest noise
  float h0 = (p.y - bmin.y) / (bmax.y - bmin.y);
  if (h0 < 0.0 || h0 > 1.0) return 0.0;
  float m = mask(p); if (m <= 0.0) return 0.0;
  vec3 q = vec3(p.x, p.y * stretch, p.z) * scale + wind;
  float tt = textureLod(noise, vec3(q.x * 0.41, 0.37, q.z * 0.41), 0.0).r;
  float topHere = mix(1.0 - towers, 1.0, smoothstep(0.34, 0.68, tt));
  float h = h0 / topHere;
  if (h > 1.0) return 0.0;
  float s = textureLod(noise, q, 0.0).r * 0.7 + textureLod(noise, q * 2.9 + wind * 0.4, 0.0).r * 0.3;
  float g = smoothstep(0.0, edgeB, h) * smoothstep(1.0, topB, h);
  float v = s - cover - (1.0 - g) * 0.45 - (1.0 - m) * 0.3;
  if (baseY.x > 0.0) { float b = baseY.x * (1.0 - smoothstep(baseY.y, baseY.z, -p.z)); v -= (1.0 - smoothstep(b, b + 240.0, p.y)) * 0.7; }
  if (v < -0.1) return 0.0;
  if (fine >= 0.0) { float e = textureLod(noise, q * 8.7 + wind * 1.3, 0.0).r * 0.66 + mix(0.56, textureLod(noise, q * 23.0, 0.0).r, fine) * 0.34; v -= (1.0 - e) * detail * (1.0 - sat(v * 4.0)); }
  return sat(v * gain);
}
float segD(vec3 p, vec3 a, vec3 b){ vec3 ab = b - a; float t = sat(dot(p - a, ab) / max(dot(ab, ab), 1.0)); return length(p - a - ab * t); }
vec3 tAxis(float y){ float age = tHead - y; return vec3(y * tLean + sin(y * 0.0041) * age * 0.02, y, sin(y * 0.0029 + 1.0) * age * 0.014); }
void main(){
  vec4 w = invVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 rd = normalize(w.xyz / w.w - cam);
  float zd = texture(depth, vUv).r;
  vec4 w2 = invVP * vec4(vUv * 2.0 - 1.0, zd * 2.0 - 1.0, 1.0); float tScene = zd >= 0.99999 ? 1e12 : length(w2.xyz / w2.w - cam);
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy + mod(frame, 32.0) * 5.3, vec2(0.06711056, 0.00583715))));
  // the exhaust column, if this ray meets it
  float tz = -1.0, tT = 1.0; vec3 tC = vec3(0.0);
  if (tOn > 0.5) {
    float ll = dot(rd.xz, rd.xz);
    if (ll > 1e-6) {
      float y = tHead * 0.5, tg = 0.0; vec3 a;
      for (int i = 0; i < 4; i++) { a = tAxis(clamp(y, 0.0, tHead)); tg = dot(a.xz - cam.xz, rd.xz) / ll; y = cam.y + rd.y * tg; }
      a = tAxis(clamp(y, 0.0, tHead));
      float R = (tR0 + max(tHead - y, 0.0) * tRk) * 1.5; vec2 dl = cam.xz + rd.xz * tg - a.xz; float d2 = dot(dl, dl);
      if (tg > 0.0 && d2 < R * R && y > -R && y < tHead + R * 0.5) {
        float hh = sqrt(R * R - d2) / sqrt(ll), ta = max(tg - hh, tMin), tb = min(tg + hh, tScene);
        if (tb > ta) {
          tz = tg;
          float dt = (tb - ta) / 12.0, tt = ta + dt * ign;
          for (int i = 0; i < 12; i++) {
            vec3 p = cam + rd * tt; tt += dt;
            if (p.y < 0.0 || p.y > tHead || tT < 0.01) continue;
            vec3 ax = tAxis(p.y); float Rp = tR0 + (tHead - p.y) * tRk; vec2 dr = p.xz - ax.xz; float r = length(dr) / Rp;
            if (r > 1.5) continue;
            vec3 q = p * tScale + vec3(0.17, -tTime * 0.012, 0.31);
            float n = textureLod(noise, q, 0.0).r * 0.58 + textureLod(noise, q * 2.7, 0.0).r * 0.3 + textureLod(noise, q * 7.3, 0.0).r * 0.12;
            float d = sat(((1.0 - r) + (n - 0.56) * 1.45) * 3.0) * smoothstep(0.0, 40.0, tHead - p.y);
            if (d < 0.004) continue;
            vec3 N = normalize(vec3(dr.x, 0.15 * Rp, dr.y));
            vec3 lit = tSmoke * (mix(ambLo, ambHi, 0.5 + 0.5 * N.x * sunDir.x + 0.5 * N.z * sunDir.z) * 1.1 + sunCol * sat(dot(N, sunDir) * 0.75 + 0.3));
            lit += vec3(1.0, 0.46, 0.14) * flame * (2.4 / (1.0 + pow(segD(p, flameA, flameB), 2.0) * flameK));
            lit += vec3(0.72, 0.8, 1.0) * flash * (2.6 / (1.0 + pow(segD(p, boltA, boltB), 2.0) * boltK));
            float rim = smoothstep(0.35, 1.05, r);
            lit += vec3(0.3, 0.5, 1.15) * tIon * (0.18 + rim * 1.5) * (0.5 + n);
            if (tRun >= 0.0) lit += vec3(0.8, 0.95, 1.5) * tRunAmt * smoothstep(tRun - 40.0, tRun + 6.0, p.y) * (0.5 + rim * 1.6) * 3.2;
            float al = 1.0 - exp(-d * dt * tExt / Rp);
            tC += tT * al * lit; tT *= 1.0 - al;
          }
        }
      }
    }
  }
  vec3 col = vec3(0.0); float T = 1.0; bool used = tz < 0.0;
  vec3 i1 = (bmin - cam) / rd, i2 = (bmax - cam) / rd, a1 = min(i1, i2), a2 = max(i1, i2);
  float t0 = max(max(a1.x, max(a1.y, a1.z)), tMin), t1 = min(min(min(a2.x, min(a2.y, a2.z)), tScene), tFar);
  if (frontZ.y > frontZ.x && cam.z > frontZ.y && rd.z < 0.0) t0 = max(t0, (frontZ.y - cam.z) / rd.z);
  if (t1 > t0) {
    const int N = 56;
    float ratio = pow(t1 / t0, 1.0 / float(N)), t = t0 * pow(ratio, ign);
    for (int i = 0; i < N; i++) {
      float dt = t * (ratio - 1.0);
      if (T < 0.015 || t >= t1) break;
      if (!used && t + dt * 0.5 > tz) { col += T * tC; T *= tT; used = true; }
      vec3 p = cam + rd * (t + dt * 0.5);
      float d = dens(p, 1.0 - smoothstep(fineFar * 0.4, fineFar, t));
      if (d > 0.004) {
        float h = sat((p.y - bmin.y) / (bmax.y - bmin.y));
        float od = 0.0, ls = lightStep;
        for (int j = 0; j < 3; j++) { od += dens(p + sunDir * ls, -1.0) * ls; ls *= 2.6; }
        vec3 lit = mix(ambLo, ambHi, h) * mix(1.0, 0.32, sat(dens(p + vec3(0.0, lightStep * 2.0, 0.0), -1.0) * 1.2)) + sunCol * exp(-od * ext * 0.62) * (0.65 + 0.35 * d);
        lit += vec3(0.72, 0.8, 1.0) * flash * (2.3 / (1.0 + pow(segD(p, boltA, boltB), 2.0) * boltK));
        lit += vec3(1.0, 0.42, 0.11) * flame * (1.3 / (1.0 + pow(segD(p, flameA, flameB), 2.0) * flameK));
        for (int k = 0; k < 8; k++) { vec3 dv = p - pockets[k].xyz; lit += chargeCol * pockets[k].w * exp(-dot(dv, dv) / pocketR); }
        lit = mix(hazeCol, lit, exp(-t * hazeK));
        float a = 1.0 - exp(-d * dt * ext);
        col += T * a * lit; T *= 1.0 - a;
      }
      t *= ratio;
    }
  }
  if (!used) { col += T * tC; T *= tT; }
  o = vec4(col, 1.0 - T);
}`;
const makeVolume = (e, o) => {
  const {renderer, scene, camera} = e, R = o.res ?? 0.5, W = Math.round(renderer.domElement.width * R), H = Math.round(renderer.domElement.height * R);
  const depthTexture = new THREE.DepthTexture(W, H); depthTexture.type = THREE.UnsignedIntType;
  const depthRT = new THREE.WebGLRenderTarget(W, H, {depthTexture, depthBuffer: true});
  const volRT = new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false});
  const u = {noise: e.cloud.noise, depth: {value: depthTexture}, invVP: {value: new THREE.Matrix4()}, cam: {value: V(0, 0, 0)}, frame: {value: 0},
    bmin: {value: o.bmin}, bmax: {value: o.bmax}, wind: {value: V(0.1, 0.2, 0.3)}, sunDir: {value: o.sunDir || V(0, 1, 0)}, sunCol: {value: o.sunCol || V(0, 0, 0)},
    ambHi: {value: o.ambHi || V(0.2, 0.22, 0.26)}, ambLo: {value: o.ambLo || V(0.03, 0.035, 0.045)}, boltA: {value: V(0, 0, 0)}, boltB: {value: V(0, 1, 0)}, flameA: {value: V(0, 0, 0)}, flameB: {value: V(0, 1, 0)}, chargeCol: {value: o.chargeCol || V(0.3, 0.42, 1.0)}, hazeCol: {value: o.hazeCol || V(0, 0, 0)},
    scale: {value: o.scale}, cover: {value: o.cover}, gain: {value: o.gain ?? 7}, ext: {value: o.ext}, flash: {value: 0}, flame: {value: 0}, flameK: {value: o.flameK ?? 0.00006}, boltK: {value: o.boltK ?? 0.000018}, towers: {value: o.towers ?? 0}, lightStep: {value: o.lightStep}, stretch: {value: o.stretch ?? 1}, edgeB: {value: o.edgeB ?? 0.12}, hazeK: {value: o.hazeK ?? 0}, tMin: {value: o.tMin ?? 5}, detail: {value: o.detail ?? 0.22}, pocketR: {value: o.pocketR ?? 170000}, topB: {value: o.topB ?? 0.62}, fineFar: {value: o.fineFar ?? 1e9}, tFar: {value: o.tFar ?? 1e12},
    baseY: {value: o.baseY || V(0, 0, 0)}, clearZ: {value: o.clear || new THREE.Vector4(0, 0, 0, 0)}, frontZ: {value: o.front || new THREE.Vector2(0, 0)},
    tOn: {value: o.trail ? 1 : 0}, tHead: {value: 1000}, tR0: {value: o.trail?.r0 ?? 8}, tRk: {value: o.trail?.rk ?? 0.03}, tLean: {value: o.trail?.lean ?? 0.05}, tScale: {value: o.trail?.scale ?? 0.006}, tExt: {value: o.trail?.ext ?? 3.2}, tTime: {value: 0}, tIon: {value: 0}, tRun: {value: -1}, tRunAmt: {value: 0}, tSmoke: {value: o.trail?.smoke || V(1, 1, 1.02)},
    pockets: {value: Array.from({length: 8}, () => new THREE.Vector4(0, -1e7, 0, 0))}};
  const m = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, uniforms: u, vertexShader: QUAD_VS, fragmentShader: VOL_FS, depthTest: false, depthWrite: false});
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false; qs.add(q);
  const over = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: {t: {value: volRT.texture}, spread: {value: o.spread ?? 1.4}}, vertexShader: QUAD_VS,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float spread; void main(){ vec2 px = spread / vec2(textureSize(t, 0)); o = (texture(t, vUv) * 2.0 + texture(t, vUv + px * vec2(1.0, 0.6)) + texture(t, vUv + px * vec2(-1.0, -0.6)) + texture(t, vUv + px * vec2(-0.6, 1.0)) + texture(t, vUv + px * vec2(0.6, -1.0))) / 6.0; }`}));
  over.frustumCulled = false; over.renderOrder = 1000; scene.add(over);
  e.cloud.far_.value = 0;
  const run = (frame) => {
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    over.visible = false;
    renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera);
    over.visible = true;
    u.invVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert(); u.cam.value.setFromMatrixPosition(camera.matrixWorld); u.frame.value = frame;
    renderer.setRenderTarget(volRT); renderer.clear(); renderer.render(qs, qc); renderer.setRenderTarget(null);
  };
  return {u, run};
};

// ---- the real ground: NASA's 500 m picture of Florida. A 500 m pixel is huge from here, so the coast is rebuilt sharp from the picture's own colours (water = blue over green) and only the colours stay soft. ----
const GROUND_FS = `
precision highp float; precision highp sampler3D;
in vec2 vU; in vec3 vW; out vec4 o;
uniform sampler2D map; uniform sampler3D noise; uniform vec3 cam, sunDir, hazeCol, wind, skyRef; uniform float ready, cScale, cloudY, cover, hazeK, hazeFrom, shadeK, bright; uniform vec2 size; uniform vec4 clearZ;
vec4 bicubic(vec2 uv){
  vec2 st = uv * size - 0.5, i = floor(st), f = st - i, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0, w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, p0 = (i - 0.5 + w1 / g0 + 0.5) / size, p1 = (i + 1.5 + w3 / g1 + 0.5) / size;
  return (texture(map, p0) * g0.x + texture(map, vec2(p1.x, p0.y)) * g1.x) * g0.y + (texture(map, vec2(p0.x, p1.y)) * g0.x + texture(map, p1) * g1.x) * g1.y;
}
void main(){
  vec3 c = bicubic(vU).rgb;
  float diff = c.b - max(c.r, c.g), water = smoothstep(0.004, 0.022, diff);
  vec3 v = normalize(cam - vW);
  float n = textureLod(noise, vec3(vW.xz * 0.00017, 0.3), 0.0).r, n2 = textureLod(noise, vec3(vW.xz * 0.00073, 0.6), 0.0).r, n3 = textureLod(noise, vec3(vW.xz * 0.0031, 0.1), 0.0).r;
  vec3 land = mix(c, vec3(dot(c, vec3(0.3, 0.6, 0.1))), 0.3) * (1.0 + (n - 0.55) * 0.9 + (n2 - 0.55) * 0.9 + (n3 - 0.55) * 0.5);
  vec3 sea = mix(c, vec3(0.03, 0.05, 0.07), 0.84) * (1.0 + (n2 - 0.55) * 0.14);
  float fres = 0.02 + 0.98 * pow(1.0 - clamp(v.y, 0.0, 1.0), 5.0);
  sea += skyRef * fres * (1.0 + (n3 - 0.55) * 0.5);
  float surf = exp(-pow((water - 0.42) / 0.3, 2.0)) * 0.16;
  vec3 col = mix(land * 1.9, sea + surf, water);
  // what the clouds above do to the ground
  vec3 sp = vW + sunDir * ((cloudY - vW.y) / sunDir.y), q = vec3(sp.x, cloudY, sp.z) * cScale + wind;
  float s = textureLod(noise, q, 0.0).r * 0.7 + textureLod(noise, q * 2.9 + wind * 0.4, 0.0).r * 0.3;
  float shadow = smoothstep(cover - 0.06, cover + 0.1, s);
  if (clearZ.w > 0.0) shadow *= smoothstep(clearZ.z, clearZ.w, length(sp.xz - clearZ.xy));
  col *= (1.0 - shadeK * shadow) * bright;
  float dist = length(cam - vW);
  col = mix(hazeCol, col, exp(-max(dist - hazeFrom, 0.0) * hazeK));
  o = vec4(col * ready, 1.0);
}`;
const LAT0 = 28.6083, LON0 = -80.6041, KX = Math.cos(rad(LAT0)) * 111320, KZ = 110574;
const makeCapeGround = (e, o) => {
  const X = (lo) => (lo - LON0) * KX, Z = (la) => -(la - LAT0) * KZ;
  const u = {map: {value: null}, noise: e.cloud.noise, cam: {value: V(0, 0, 0)}, sunDir: {value: o.sunDir}, hazeCol: {value: o.hazeCol}, skyRef: {value: o.skyRef || V(0.3, 0.33, 0.38)}, wind: {value: V(0, 0, 0)}, ready: {value: 0}, cScale: {value: o.cScale}, cloudY: {value: o.cloudY}, cover: {value: o.cover}, hazeK: {value: o.hazeK}, hazeFrom: {value: o.hazeFrom ?? 0}, shadeK: {value: o.shadeK ?? 0.5}, bright: {value: o.bright ?? 1}, size: {value: new THREE.Vector2(3360, 2640)}, clearZ: {value: o.clear || new THREE.Vector4(0, 0, 0, 0)}};
  const x0 = X(-87), x1 = X(-73), z0 = Z(34), z1 = Z(23);
  const gg = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1); gg.rotateX(-Math.PI / 2); gg.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const mesh = new THREE.Mesh(gg, new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, uniforms: u, fragmentShader: GROUND_FS, vertexShader: `out vec2 vU; out vec3 vW; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`}));
  mesh.frustumCulled = false; e.scene.add(mesh);
  mesh.userData.u = u;
  return mesh;
};

// ---- CapeMap: the real coast from over the Atlantic at a low angle; the plane flies the 32 km circle round Pad 39A and the circle draws itself behind it. The storm stands all round, opened over the circle so the ground can be read. ----
export const CapeMap = () => useScene((e) => {
  const {camera, scene} = e; camera.near = 500; camera.far = 2500000; camera.fov = 34;
  e.skyHi.set(0.1, 0.125, 0.17); e.skyLo.set(0.2, 0.225, 0.26); e.final.grain.value = 0.014; e.final.vign.value = 0.5; e.final.bloom.value = 0.45;
  const sunDir = V(-0.42, 0.62, 0.62).normalize(), hazeCol = V(0.145, 0.165, 0.2), clear = new THREE.Vector4(-1500, 0, 44000, 84000);
  const C = {scale: 1 / 72000, cover: 0.44};
  const vol = makeVolume(e, {bmin: V(-420000, 900, -420000), bmax: V(420000, 7000, 420000), scale: C.scale, cover: C.cover, gain: 9, ext: 0.0016, lightStep: 340, stretch: 3.2, towers: 0.42, edgeB: 0.1, detail: 0.2, clear, sunDir, sunCol: V(0.62, 0.62, 0.62), ambHi: V(0.27, 0.29, 0.34), ambLo: V(0.06, 0.068, 0.085), hazeCol, hazeK: 0.0000042, tMin: 400});
  const ground = makeCapeGround(e, {sunDir, hazeCol, cScale: C.scale, cloudY: 2000, cover: C.cover, hazeK: 0.0000065, hazeFrom: 85000, clear, skyRef: V(0.2, 0.22, 0.26), bright: 0.8, shadeK: 0.55}), uG = ground.userData.u;
  scene.add(new THREE.DirectionalLight(0xdfe6f0, 2.2).translateOnAxis(sunDir, 1000)); scene.add(new THREE.HemisphereLight(0xa8b4c4, 0x262c30, 1.0));
  const RING = 32000, ring = [], wallP = [], wallK = [], wallI = [], H = 2600; for (let i = 0; i <= 720; i++) { const a = rad(i * 0.5 - 62), x = Math.cos(a) * RING, z = Math.sin(a) * RING; ring.push(V(x, 60, z)); wallP.push(x, 60, z, x, H, z); wallK.push(i / 720, 0, i / 720, 1); if (i < 720) { const b = i * 2; wallI.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  const rb = makeRibbon(e, 760); e.glow.add(rb);
  // a low curtain of light standing on the circle, so it reads as a place in the air and not a line on a map
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wallP, 3)); wg.setAttribute('k', new THREE.Float32BufferAttribute(wallK, 2)); wg.setIndex(wallI);
  const wu = {prog: {value: 0}}, wall = new THREE.Mesh(wg, new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: wu,
    vertexShader: `in vec2 k; out vec2 vK; void main(){ vK = k; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; in vec2 vK; out vec4 o; uniform float prog; void main(){ float on = smoothstep(prog, prog - 0.004, vK.x); float a = pow(1.0 - vK.y, 2.4) * on * (0.09 + 0.09 * smoothstep(prog - 0.14, prog, vK.x)); o = vec4(vec3(1.5, 0.92, 0.3) * a, 1.0); }`}));
  wall.frustumCulled = false; e.glow.add(wall);
  // a small straight-wing plane; drawn about 100 times too big, or it could not be seen at all
  const plane = new THREE.Group(), pm = new THREE.MeshStandardMaterial({color: 0xdcdbd4, roughness: 0.42, metalness: 0.25}), S = 2500;
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.86, 8, 16), pm); fus.rotation.z = Math.PI / 2; plane.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.014, 1.2), pm); wing.position.x = 0.06; plane.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.42), pm); tail.position.x = -0.42; plane.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.17, 0.012), pm); fin.position.set(-0.42, 0.085, 0); plane.add(fin);
  for (const z of [-0.3, 0.3]) { const eng = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 6, 12), pm); eng.rotation.z = Math.PI / 2; eng.position.set(0.1, -0.02, z); plane.add(eng); }
  plane.scale.setScalar(S); scene.add(plane);
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; { const g = sc.getContext('2d'), r = g.createRadialGradient(64, 64, 8, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(S * 1.5, S * 1.5), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, color: 0xffffff})); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const beacon = makeGlow([1.6, 1.3, 0.85]); e.glow.add(beacon);
  // Pad 39A: a thin stalk of light on the exact spot
  const stalk = makeRibbon(e, 8); e.glow.add(stalk); const SP = [V(0, 0, 0), V(0, 700, 0), V(0, 2200, 0), V(0, 3600, 0)];
  const pad = makeGlow([1.9, 1.5, 1.05]); pad.position.set(0, 90, 0); e.glow.add(pad);
  let lastF = 0;
  const draw = (f) => {
    lastF = f;
    const k = f / 299, ek = ease(k), az = lerp(1.28, 1.12, ek), dist = lerp(97000, 84000, ek), el = lerp(0.36, 0.42, ek);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist + 2000, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
    camera.up.set(0, 1, 0); camera.lookAt(-2000, 0, -2500);
    camera.updateMatrixWorld();
    uG.cam.value.copy(camera.position);
    const wind = V(f * 0.00005, 0.21, f * 0.00002); vol.u.wind.value.copy(wind); uG.wind.value.copy(wind);
    const a = clamp((f - 8) / 280), i0 = a * 720, dist2 = camera.position.length();
    rb.userData.update(ring, (i) => (i <= i0 ? 3 : 1.25), (i) => { if (i <= i0) { const w = clamp(1 - (i0 - i) / 14); return [AMBER[0] + w * 1.2, AMBER[1] + w * 1.2, AMBER[2] + w * 1.2]; } return [0.26, 0.2, 0.11]; });
    wu.prog.value = a;
    const ang = rad(a * 360 - 62), px = Math.cos(ang) * RING, pz = Math.sin(ang) * RING;
    plane.position.set(px, 900, pz); plane.rotation.set(0, -ang - Math.PI / 2, 0); plane.rotateX(0.2);
    shadow.position.set(px - sunDir.x * 900 / sunDir.y, 30, pz - sunDir.z * 900 / sunDir.y);
    beacon.position.copy(plane.position); beacon.scale.setScalar(dist2 * 0.006 * (0.86 + 0.14 * Math.sin(f * 0.21)));
    pad.scale.setScalar(dist2 * 0.024 * (0.92 + 0.08 * Math.sin(f * 0.13)));
    stalk.userData.update(SP, (i) => [2.2, 1.7, 1.2, 0.9][i], (i) => { const c = [1.1, 0.7, 0.3, 0][i]; return [AMBER[0] * c, AMBER[1] * c, AMBER[2] * c]; });
    vol.run(f);
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
// the dial: old cream paper under a small lamp at the top of the case. No unit and no red zone: nobody quotes a reading from it.
const dialFace = () => {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), cx = 512, cy = 690, R = 470, r = seeded(5511);
  g.fillStyle = '#d6c49a'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i++) { const v = 120 + r() * 90; g.fillStyle = `rgba(${v},${v - 18},${v - 50},0.05)`; g.fillRect(r() * 1024, r() * 1024, 1 + r() * 14, 1 + r() * 3); }
  const A = (v) => rad(-55 + (v / 10) * 110);
  g.strokeStyle = '#17140f'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2 + A(0), -Math.PI / 2 + A(10)); g.stroke();
  for (let v = 0; v <= 50; v++) { const a = A(v / 5), big = v % 5 === 0, r0 = R, r1 = R - (big ? 58 : 28); g.strokeStyle = '#17140f'; g.lineWidth = big ? 8 : 3.5; g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.stroke(); }
  g.fillStyle = '#17140f'; g.font = '700 62px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const v of [0, 2, 4, 6, 8, 10]) { const a = A(v); g.fillText(String(v), cx + Math.sin(a) * (R - 106), cy - Math.cos(a) * (R - 106)); }
  g.font = '400 34px Arial, sans-serif'; g.fillText('ELECTRIC FIELD', cx, cy + 86);
  // the lamp's fall-off and the case's shadow round the edge
  const l = g.createRadialGradient(512, 300, 60, 512, 512, 560); l.addColorStop(0, 'rgba(255,214,140,0.05)'); l.addColorStop(0.55, 'rgba(40,24,8,0.16)'); l.addColorStop(0.86, 'rgba(14,8,2,0.62)'); l.addColorStop(1, 'rgba(6,3,1,0.92)'); g.fillStyle = l; g.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
};
// rain on the glass: beads with a bright lower edge, and a few runs
const dropsTex = () => {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), r = seeded(7719);
  for (let i = 0; i < 170; i++) { const x = r() * 1024, y = r() * 1024, s = 2 + Math.pow(r(), 3) * 13;
    const q = g.createRadialGradient(x, y + s * 0.3, 0, x, y, s); q.addColorStop(0, 'rgba(255,240,215,0.34)'); q.addColorStop(0.65, 'rgba(255,240,215,0.06)'); q.addColorStop(0.86, 'rgba(10,10,12,0.42)'); q.addColorStop(1, 'rgba(10,10,12,0)'); g.fillStyle = q; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,250,240,0.62)'; g.beginPath(); g.arc(x - s * 0.3, y - s * 0.32, Math.max(0.8, s * 0.13), 0, 7); g.fill(); }
  for (let i = 0; i < 7; i++) { let x = r() * 1024, y = r() * 500; const L = 180 + r() * 420; g.strokeStyle = 'rgba(255,245,225,0.09)'; g.lineWidth = 2 + r() * 5; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 16; k++) { y += L / 16; x += (r() - 0.5) * 7; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
export const ChargedClouds = () => useScene((e) => {
  const {camera, scene} = e; camera.near = 0.08; camera.far = 60000;
  e.skyHi.set(0.1, 0.112, 0.135); e.skyLo.set(0.06, 0.068, 0.082); e.final.grain.value = 0.018; e.final.bloom.value = 0.5; e.final.vign.value = 0.85;
  const hz = V(0.062, 0.07, 0.085);
  scene.fog = new THREE.FogExp2(new THREE.Color(hz.x, hz.y, hz.z).getHex(THREE.LinearSRGBColorSpace), 0.00062);
  scene.environment = skyEnv(e, [0.3, 0.33, 0.38], [0.012, 0.014, 0.012]); scene.environmentIntensity = 1.0;
  const vol = makeVolume(e, {spread: 1.4, bmin: V(-30000, 620, -30000), bmax: V(30000, 3600, 30000), scale: 1 / 3100, cover: 0.37, gain: 3.4, ext: 0.0048, lightStep: 170, stretch: 1.5, edgeB: 0.1, detail: 0.3, pocketR: 110000, ambHi: V(0.3, 0.32, 0.37), ambLo: V(0.05, 0.055, 0.066), hazeCol: hz, hazeK: 0.00014, tMin: 40, chargeCol: V(0.2, 0.28, 0.72)});
  // pockets of charge along the row, deep in the cloud
  const r0 = seeded(5237), pk = []; for (let i = 0; i < 8; i++) pk.push({x: -900 + r0() * 900 - i * 60, z: -260 - i * 420 - r0() * 200, y: 800 + r0() * 340, a: r0() * 6.28, b: 0.03 + r0() * 0.035});
  // wet ground
  const gc = document.createElement('canvas'); gc.width = gc.height = 1024; { const g = gc.getContext('2d'), r = seeded(771); g.fillStyle = '#1b1c15'; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 26000; i++) { const v = 14 + r() * 28; g.fillStyle = `rgba(${v + 6},${v + 5},${v - 3},0.5)`; g.fillRect(r() * 1024, r() * 1024, 1 + r() * 5, 1 + r() * 5); } }
  const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(1600, 1600); gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 8;
  const rc = document.createElement('canvas'); rc.width = rc.height = 1024; { const g = rc.getContext('2d'), r = seeded(991); g.fillStyle = '#a8a8a8'; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 150; i++) { const x = r() * 1024, y = r() * 1024, s = 40 + r() * 130, gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(8,8,8,0.97)'); gr.addColorStop(0.55, 'rgba(8,8,8,0.72)'); gr.addColorStop(1, 'rgba(8,8,8,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2); } }
  const rt = new THREE.CanvasTexture(rc); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(160, 160);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(50000, 50000), new THREE.MeshStandardMaterial({map: gt, roughnessMap: rt, roughness: 1, metalness: 0.0, envMapIntensity: 0.14})); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // marsh grass, Merritt Island in the rain: real curved blades
  const bladeG = new THREE.BufferGeometry(); { const P = [], I = [], SEG = 5; for (let s = 0; s <= SEG; s++) { const k = s / SEG, w = 0.016 * (1 - k * 0.92), y = 0.82 * k * (1 - k * 0.12), z = 0.2 * k * k; P.push(-w, y, z, w, y, z); if (s < SEG) { const a = s * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } } bladeG.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bladeG.setIndex(I); bladeG.computeVertexNormals(); }
  const NB = 42000, grass = new THREE.InstancedMesh(bladeG, new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.42, metalness: 0, side: THREE.DoubleSide}), NB), gm = new THREE.Object3D(), rg = seeded(1337), gcol = new THREE.Color();
  for (let i = 0; i < NB; i++) { const far = rg(), L = far < 0.55 ? 11 : far < 0.85 ? 34 : 120, x = (rg() - 0.5) * L * 2 - (far < 0.55 ? 0 : L * 0.3), z = (rg() - 0.85) * L * 2 + 2; const clearP = Math.hypot(x, z) < 0.62, pk_ = clamp(((x - 0.42) * 4.78 + (z - 1.5) * 6.7) / 68); if (Math.hypot(x - 0.42 - 4.78 * pk_, z - 1.5 - 6.7 * pk_) < 1.5 && !clearP) { gm.position.set(x, 0, z); gm.rotation.set((rg() - 0.5) * 0.9, rg() * 6.283, (rg() - 0.5) * 0.9); const q = 0.42 + rg() * 0.24; gm.scale.set(q * 1.8, q, q); gm.updateMatrix(); grass.setMatrixAt(i, gm.matrix); grass.setColorAt(i, gcol.setRGB(0.024 + rg() * 0.026, 0.04 + rg() * 0.03, 0.014 + rg() * 0.01)); continue; } gm.position.set(x, 0, z); gm.rotation.set((rg() - 0.5) * 0.5, rg() * 6.283, (rg() - 0.5) * 0.5); const s = (clearP ? 0.18 : 0.5 + rg() * 0.9) * (far < 0.55 ? 1 : far < 0.85 ? 1.5 : 2.6); gm.scale.set(s * (far < 0.85 ? 1 : 2), s, s); gm.updateMatrix(); grass.setMatrixAt(i, gm.matrix); gcol.setRGB(0.028 + rg() * 0.032, 0.046 + rg() * 0.038, 0.016 + rg() * 0.012); grass.setColorAt(i, gcol); }
  grass.frustumCulled = false; scene.add(grass);
  scene.add(new THREE.HemisphereLight(0x8c98a8, 0x14160f, 0.55));
  const dl = new THREE.DirectionalLight(0xaab8cc, 0.9); dl.position.set(-40, 50, -30); scene.add(dl);
  const fill = new THREE.DirectionalLight(0xb4c0d0, 0.55); fill.position.set(26, 20, 40); scene.add(fill);
  // the meters: a steel pole, the field mill on top looking at the sky, a lit dial in a cast case, a needle
  const steel = new THREE.MeshStandardMaterial({color: 0x63676b, roughness: 0.3, metalness: 0.94}), paint = new THREE.MeshStandardMaterial({color: 0x2c332c, roughness: 0.26, metalness: 0.5}), black = new THREE.MeshStandardMaterial({color: 0x0c0d0e, roughness: 0.28, metalness: 0.7}), brass = new THREE.MeshStandardMaterial({color: 0x8d6b36, roughness: 0.32, metalness: 0.95});
  const concrete = new THREE.MeshStandardMaterial({color: 0x45443f, roughness: 0.74});
  const face = dialFace(), faceM = new THREE.MeshBasicMaterial({map: face, color: new THREE.Color(1.0, 0.76, 0.46), toneMapped: false, fog: false});
  const glass = new THREE.MeshPhysicalMaterial({color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.03, metalness: 0, envMapIntensity: 2.2, depthWrite: false});
  const drops = dropsTex(), dropM = new THREE.MeshBasicMaterial({map: drops, transparent: true, depthWrite: false, opacity: 0.85, color: new THREE.Color(0.72, 0.68, 0.62), fog: false});
  const needleM = new THREE.MeshStandardMaterial({color: 0x050505, roughness: 0.35, metalness: 0.6}), shadeM = new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, fog: false});
  const rrect = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const caseShape = rrect(0.64, 0.68, 0.05); { const hole = new THREE.Path(); hole.absarc(0, 0, 0.268, 0, Math.PI * 2, true); caseShape.holes.push(hole); }
  const caseG = new THREE.ExtrudeGeometry(caseShape, {depth: 0.15, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 4, curveSegments: 48}); caseG.translate(0, 0, -0.012);
  const backG = new THREE.ExtrudeGeometry(rrect(0.6, 0.64, 0.05), {depth: 0.05, bevelEnabled: false}), wellG = new THREE.CylinderGeometry(0.272, 0.272, 0.13, 64, 1, true), bezelG = new THREE.TorusGeometry(0.275, 0.021, 18, 96), lipG = new THREE.TorusGeometry(0.256, 0.006, 10, 96), boltG = new THREE.CylinderGeometry(0.014, 0.014, 0.012, 6);
  const makeMeter = (hero) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 3.1, 24), steel); pole.position.y = 1.55; g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.22, 28), concrete); base.position.y = 0.06; g.add(base);
    const head = new THREE.Group(); head.position.set(0, 1.92, 0.11); g.add(head);
    const cs = new THREE.Mesh(caseG, paint); head.add(cs);
    const back = new THREE.Mesh(backG, paint); back.position.z = -0.06; head.add(back);
    const well = new THREE.Mesh(wellG, new THREE.MeshStandardMaterial({color: 0x3a3226, roughness: 0.6, metalness: 0.3, side: THREE.BackSide})); well.rotation.x = Math.PI / 2; well.position.z = 0.07; head.add(well);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.272, 96), faceM); dial.position.z = 0.012; head.add(dial);
    const bez = new THREE.Mesh(bezelG, black); bez.position.z = 0.15; head.add(bez);
    const lip = new THREE.Mesh(lipG, brass); lip.position.z = 0.142; head.add(lip);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.022, 0.3), paint); hood.position.set(0, 0.35, 0.1); hood.rotation.x = 0.1; head.add(hood);
    for (const [x, y] of [[-0.27, -0.29], [0.27, -0.29], [-0.27, 0.29], [0.27, 0.29]]) { const b = new THREE.Mesh(boltG, steel); b.rotation.x = Math.PI / 2; b.position.set(x, y, 0.15); head.add(b); }
    const needleP = new THREE.Group(); needleP.position.set(0, -0.27 * (690 - 512) / 512 * 1.0, 0.03);
    const shape = new THREE.Shape(); shape.moveTo(-0.0048, 0); shape.lineTo(0.0048, 0); shape.lineTo(0.0009, 0.238); shape.lineTo(-0.0009, 0.238); shape.closePath();
    const nd = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: 0.002, bevelEnabled: false}), needleM); needleP.add(nd);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.012, 24), black); hub.rotation.x = Math.PI / 2; needleP.add(hub);
    const shadeP = new THREE.Group(); shadeP.position.set(0.004, needleP.position.y - 0.009, 0.0135); shadeP.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), shadeM)); head.add(needleP, shadeP);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(0.262, 96), glass); gl.position.z = 0.14; head.add(gl);
    if (hero) { const dp = new THREE.Mesh(new THREE.CircleGeometry(0.26, 96), dropM); dp.position.z = 0.142; head.add(dp);
      const lamp = new THREE.PointLight(0xffb060, 0.1, 0.8, 1.6); lamp.position.set(0, 0.16, 0.2); head.add(lamp); }
    // the field mill: a sensor on the pole's head, its rotor spinning under a shield, facing the sky
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.18, 24), steel); collar.position.y = 3.17; g.add(collar);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.024, 40), steel); plate.position.y = 3.28; g.add(plate);
    const rotor = new THREE.Group(); rotor.position.y = 3.31;
    const sh = new THREE.Shape(); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; sh.moveTo(0, 0); sh.absarc(0, 0, 0.185, a, a + Math.PI / 4, false); sh.lineTo(0, 0); }
    const vane = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: 0.006, bevelEnabled: false}), black); vane.rotation.x = -Math.PI / 2; rotor.add(vane); g.add(rotor);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.05, 1.56, -0.02), V(0.09, 1.0, 0.03), V(0.08, 0.3, 0.05), V(0.14, 0.02, 0.1)]), 24, 0.009, 6), black); g.add(cable);
    return {g, needleP, shadeP, rotor};
  };
  const hero = makeMeter(true); hero.g.rotation.y = 0.2; scene.add(hero.g);
  const row = [hero], rp = seeded(4401);
  for (let i = 1; i < 11; i++) { const m = makeMeter(false); m.g.position.set(-9.5 * i - 1.6 * Math.pow(i, 1.3) + (rp() - 0.5) * 3, 0, -6.5 * i - 2.2 * Math.pow(i, 1.5)); m.g.rotation.y = 0.5 + (rp() - 0.5) * 0.18; scene.add(m.g); row.push(m); }
  const pts = row.slice(1).map((m) => { const s = makeGlow([1.05, 0.62, 0.22]); s.position.copy(m.g.position); s.position.y = 1.95; s.position.z += 0.3; e.glow.add(s); return s; });
  // the rocket waiting on the horizon, far away in the rain
  const sat = makeSaturn(); sat.position.set(-2100, 6, -4300); scene.add(sat);
  const towerM = new THREE.MeshStandardMaterial({color: 0x2c2e31, roughness: 0.7}), tw = new THREE.Mesh(new THREE.BoxGeometry(14, 136, 14), towerM); tw.position.set(-2100 + 24, 68, -4300); scene.add(tw);
  const padM = new THREE.Mesh(new THREE.BoxGeometry(50, 12, 50), towerM); padM.position.set(-2100, 2, -4300); scene.add(padM);
  // rain: every drop's place is a function of the frame
  const N = 2600, rr = seeded(8123), seedsR = []; for (let i = 0; i < N; i++) seedsR.push([rr(), rr(), rr(), 0.6 + rr() * 0.5]);
  const rPos = new Float32Array(N * 6), rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({color: new THREE.Color(0.07, 0.078, 0.09), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false})); rain.frustumCulled = false; e.glow.add(rain);
  const camA = V(0.42, 1.98, 1.72), camB = V(5.2, 1.0, 8.2), lookA = V(-0.34, 1.96, 0), lookB = V(-6.5, 8.6, -24), cp = V(0, 0, 0), lp = V(0, 0, 0);
  const needleAt = (f, i) => { const start = 16 + i * 7, up = ease((f - start) / 96), rest = rad(-51), top = rad(lerp(18, 34, ((i * 37) % 11) / 10)); return lerp(rest, top, up) + Math.sin(f * 0.31 + i * 1.7) * 0.012 * (0.4 + up) + Math.sin(f * 1.27 + i) * 0.006 * up; };
  return {draw: (f) => {
    const mv = ease((f - 112) / 176);
    cp.lerpVectors(camA, camB, mv); lp.lerpVectors(lookA, lookB, mv);
    cp.z -= (1 - mv) * ease(f / 112) * 0.26;                            // a slow push on the dial first
    cp.x += Math.sin(f * 0.019) * 0.008; cp.y += Math.sin(f * 0.027 + 1) * 0.007;
    camera.position.copy(cp); camera.up.set(0, 1, 0); camera.lookAt(lp); camera.fov = lerp(36, 58, mv);
    camera.updateMatrixWorld();
    row.forEach((m, i) => { const a = -needleAt(f, i); m.needleP.rotation.z = a; m.shadeP.rotation.z = a; m.rotor.rotation.y = f * 0.62 + i; });
    const glowF = ease((f - 30) / 120);
    pk.forEach((p, i) => { const w = glowF * (0.2 + 0.12 * Math.sin(f * p.b + p.a) + 0.06 * Math.sin(f * p.b * 2.7 + p.a * 2)); vol.u.pockets.value[i].set(p.x, p.y, p.z, Math.max(0, w)); });
    pts.forEach((s) => { s.scale.setScalar(cp.distanceTo(s.position) * 0.007); });
    vol.u.wind.value.set(f * 0.00016, -f * 0.0001 + 0.17, f * 0.00008);
    for (let i = 0; i < N; i++) { const [a, b, c, sp] = seedsR[i], L = 0.42 * sp, H = 22, y = ((c * H - f * 0.72 * sp) % H + H) % H, x = cp.x + (a - 0.5) * 34 - (y * 0.12) - 8, z = cp.z + (b - 0.92) * 34; rPos.set([x, y, z, x + 0.05, y + L, z], i * 6); }
    rGeo.attributes.position.needsUpdate = true;
    vol.run(f);
  }};
});

// ---- CloudTops: a side view of the cloud stack at true scale, ground to tops; the rule's line at 10,000 ft, the tops at 23,000 ft, the Saturn climbing through. ----
// Camera level and held at one height, so these lines stay at fixed screen heights all the way: y 614 for 10,000 ft and y 243 for 23,000 ft in a 1080 picture. The real Cape under it, looking north up the coast.
const FT = 0.3048, Y10K = 10000 * FT, Y23K = 23000 * FT;
export const CloudTops = () => useScene((e) => {
  const {camera, scene} = e; camera.near = 50; camera.far = 800000; camera.fov = 27;
  e.skyHi.set(0.03, 0.065, 0.15); e.skyLo.set(0.13, 0.17, 0.24); e.final.grain.value = 0.014; e.final.bloom.value = 0.42; e.final.vign.value = 0.5;
  const sunDir = V(-0.5, 0.78, -0.26).normalize(), hazeCol = V(0.075, 0.085, 0.105), sC = 1 / 15500, cov = 0.31;
  const vol = makeVolume(e, {res: 0.75, spread: 1.0, bmin: V(-42000, 640, -14000), bmax: V(42000, Y23K + 620, 2600), scale: sC, cover: cov, gain: 9, ext: 0.0026, lightStep: 540, stretch: 0.85, towers: 0.2, topB: 0.8, edgeB: 0.03, detail: 0.24, front: new THREE.Vector2(-2600, 2400), sunDir, sunCol: V(1.45, 1.38, 1.26), ambHi: V(0.2, 0.22, 0.27), ambLo: V(0.018, 0.021, 0.028), flameK: 0.0000022, boltK: 0.000002, hazeK: 0, tMin: 200, hazeCol,
    trail: {r0: 11, rk: 0.026, lean: 0.03, scale: 0.0017, ext: 3.4, smoke: V(1, 1, 1.02)}});
  const ground = makeCapeGround(e, {sunDir, hazeCol, cScale: sC, cloudY: 1500, cover: cov, hazeK: 0.000016, hazeFrom: 22000, skyRef: V(0.1, 0.11, 0.13), bright: 0.42, shadeK: 0.35}), uG = ground.userData.u;
  scene.add(new THREE.HemisphereLight(0x8c98a8, 0x20241c, 0.6));
  const key = new THREE.DirectionalLight(0xfff0dc, 3.0); key.position.copy(sunDir).multiplyScalar(1000); scene.add(key);
  const rocket = makeSaturn(); scene.add(rocket);
  const flame = makeFlame(); flame.scale.setScalar(1.5); e.glow.add(flame);
  const core = makeGlow([1.9, 0.95, 0.34]); e.glow.add(core);
  // the two lines. Added light, drawn after the clouds, always in front of them
  const lineA = makeRibbon(e, 40), lineB = makeRibbon(e, 40); e.glow.add(lineA, lineB);
  const lp = (y) => { const out = []; for (let i = 0; i <= 30; i++) out.push(V(-30000 + i * 2000, y, 0)); return out; };
  const LA = lp(Y10K), LB = lp(Y23K);
  // T+10 to about T+72 over 12 s; altitude from the mission's own numbers: 1,920 m at T+36.5, 4,400 m at T+52
  const altAt = (t) => 1920 * Math.pow(t / 36.5, 2.34), tOf = (f) => 10 + (f / 30) * 5.2;
  let lastF = 0;
  const draw = (f) => {
    lastF = f;
    const t = tOf(f), y = altAt(t), x = y * 0.03;
    camera.position.set(lerp(-500, 500, f / 359), 3840, 24000); camera.up.set(0, 1, 0); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld();
    e.common.cam.value.copy(camera.position); uG.cam.value.copy(camera.position);
    rocket.position.set(x, y, 0); rocket.rotation.z = -0.03; flame.position.set(x, y, 0); flame.rotation.z = -0.03; flame.userData.tick(f / 30);
    core.position.set(x, y - 40, 0); core.scale.setScalar(520);
    vol.u.tHead.value = y - 8; vol.u.tTime.value = f / 30;
    const inCloud = 1 - clamp((y - Y23K) / 300);
    vol.u.flame.value = 0.9 * inCloud; vol.u.flameA.value.set(x, y - 6, 0); vol.u.flameB.value.set(x, y - 340, 0);
    const wind = V(f * 0.00016 + 0.37, f * 0.00005 + 0.33, f * 0.00008); vol.u.wind.value.copy(wind); uG.wind.value.copy(wind);
    lineA.userData.update(LA, () => 2.6, (i) => (i / 30 <= ease(f / 42) ? [AMBER[0], AMBER[1], AMBER[2]] : [0, 0, 0]));
    lineB.userData.update(LB, () => 1.5, (i) => (i / 30 <= ease((f - 14) / 42) ? [0.72, 0.74, 0.8] : [0, 0, 0]));
    vol.run(f);
  };
  loadTextures(e, {cape: 'cape.jpg'}, (t) => { uG.map.value = t.cape; uG.ready.value = 1; draw(lastF); e.render(lastF); });
  return {draw};
});

// ---- RocketWire: the rocket and its trail reaching up from the pad into charged cloud like a wire. It starts close on the rocket, pulls back and down till the whole length is in the picture, the charge gathers at the nose, and at T+36.5 the discharge runs down the trail to the ground. ----
export const RocketWire = () => useScene((e) => {
  const {camera, scene} = e; camera.far = 200000;
  e.skyHi.set(0.05, 0.058, 0.075); e.skyLo.set(0.022, 0.025, 0.03);
  scene.environment = skyEnv(e, [0.1, 0.11, 0.13], [0.008, 0.009, 0.01]); scene.environmentIntensity = 0.55; e.final.bloom.value = 0.55; e.final.grain.value = 0.016; e.final.vign.value = 0.6;
  const vol = makeVolume(e, {res: 0.75, spread: 1.1, bmin: V(-24000, 0, -24000), bmax: V(24000, 6200, 2600), baseY: V(640, 9000, 22000), scale: 1 / 6500, cover: 0.36, gain: 5.5, ext: 0.003, lightStep: 300, stretch: 1.15, edgeB: 0.004, tFar: 22000, fineFar: 2600, detail: 0.16, front: new THREE.Vector2(-260, 1500), pocketR: 170000, ambHi: V(0.22, 0.24, 0.28), ambLo: V(0.05, 0.055, 0.07), chargeCol: V(0.2, 0.32, 1.0), flameK: 0.00005, boltK: 0.0000055, tMin: 120,
    trail: {r0: 7, rk: 0.032, lean: 0.05, scale: 0.003, ext: 2.6, smoke: V(0.62, 0.62, 0.66)}});
  // the real ground under it: the Cape, the sea to the right; the pad and its lights
  const ground = makeCapeGround(e, {sunDir: V(0, 1, 0), hazeCol: V(0.02, 0.023, 0.03), cScale: 1 / 6500, cloudY: 1000, cover: 0.5, hazeK: 0.00011, hazeFrom: 5000, skyRef: V(0.1, 0.11, 0.13), bright: 0.2, shadeK: 0}), uG = ground.userData.u;
  scene.add(new THREE.HemisphereLight(0x8fa0b4, 0x201a16, 0.3));
  const key = new THREE.DirectionalLight(0xb0c0d4, 2.0); key.position.set(-200, 60, 190); scene.add(key);
  const strike = new THREE.DirectionalLight(0xdfe8ff, 0); scene.add(strike);
  const fire = new THREE.PointLight(0xff7a2a, 26000, 300, 1.8); scene.add(fire);
  const flashG = new THREE.PointLight(0xcfdcff, 0, 6000, 1.6); flashG.position.set(0, 90, 0); scene.add(flashG);
  const rocket = makeSaturn(); scene.add(rocket);
  const flame = makeFlame(); e.glow.add(flame);
  const towerM = new THREE.MeshStandardMaterial({color: 0x34363a, roughness: 0.6, metalness: 0.2}), tw = new THREE.Mesh(new THREE.BoxGeometry(14, 136, 14), towerM); tw.position.set(30, 68, 0); scene.add(tw);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(60, 12, 60), towerM); pad.position.y = 2; scene.add(pad);
  const r2 = seeded(3331), lamps = []; for (let i = 0; i < 14; i++) { const s = makeGlow([1.4, 0.86, 0.34]), a = r2() * 6.283, d = i < 10 ? 60 + r2() * 90 : 300 + r2() * 1500; s.position.set(Math.cos(a) * d, i < 4 ? 40 + i * 28 : 6, Math.sin(a) * d - (i < 10 ? 0 : 400)); e.glow.add(s); lamps.push(s); }
  const tPath = (y, head) => { const age = head - y; return V(y * 0.05 + Math.sin(y * 0.0041) * age * 0.02, y, Math.sin(y * 0.0029 + 1) * age * 0.014); };
  // the moving discharge: a jagged channel that hugs the trail, drawn from the cloud down to wherever its head has got to
  const D0 = 232, GROUND_F = D0 + 15, altAt = (t) => 1920 * Math.pow(t / 36.5, 2.34), tOf = (f) => 28.8 + f / 30;
  const headD = altAt(tOf(D0)), rj = seeded(60601), channel = [];
  const high = V(-560, headD + 1150, -300), nose = tPath(headD, headD).clone().add(V(0, 118, 0));
  const jag = (a, b, n, amp) => { const out = []; let ox = 0, oz = 0; for (let i = 0; i < n; i++) { const k = i / n, p = a.clone().lerp(b, k), w = Math.sin(k * Math.PI); ox = ox * 0.72 + (rj() - 0.5) * amp; oz = oz * 0.72 + (rj() - 0.5) * amp; out.push(p.add(V(ox * (0.4 + w), (rj() - 0.5) * amp * 0.2, oz * (0.4 + w)))); } return out; };
  channel.push(...jag(high, nose, 70, 90));
  let ox = 0, oz = 0; for (let i = 0; i <= 260; i++) { const y = headD + 110 - (i / 260) * (headD + 110), c = tPath(Math.min(y, headD), headD); ox = ox * 0.78 + (rj() - 0.5) * 26; oz = oz * 0.78 + (rj() - 0.5) * 26; channel.push(c.add(V(ox, 0, oz))); }
  const chan = makeRibbon(e, 400); e.glow.add(chan);
  const halo = makeRibbon(e, 400); e.glow.add(halo);
  const branches = makeBolt([high.clone().add(V(-300, 760, -200)), high, high.clone().lerp(nose, 0.5)], 73, 0.42); e.glow.add(branches);
  const b0 = tPath(30, headD), ringB = makeBolt([V(b0.x, 44, b0.z), V(b0.x + 170, 2, b0.z + 60), V(b0.x + 340, 0, b0.z + 40)], 19, 0.4); e.glow.add(ringB);
  const nimbus = makeGlow([0.5, 0.72, 1.5]); e.glow.add(nimbus);
  const hit = makeGlow([5, 5.6, 7]); e.glow.add(hit);
  const r1 = seeded(2711), pk = []; for (let i = 0; i < 8; i++) pk.push({x: -760 + r1() * 1300, y: 1000 + i * 240 + r1() * 150, z: -180 - r1() * 500, a: r1() * 6.28, b: 0.04 + r1() * 0.05});
  const cam = V(0, 0, 0), look = V(0, 0, 0); let lastF = 0;
  const draw = (f) => {
    lastF = f;
    const t = tOf(f), y = altAt(t), x = y * 0.05, time = f / 30;
    rocket.position.set(x, y, 0); rocket.rotation.z = -0.05; flame.position.set(x, y, 0); flame.rotation.z = -0.05; flame.userData.tick(time);
    fire.position.set(x, y - 12, 0);
    vol.u.tHead.value = y - 6; vol.u.tTime.value = time;
    const k = ease((f - 4) / 175);
    cam.set(lerp(x - 400, -880, k), lerp(y + 20, 260, k), lerp(610, 3300, k));
    look.set(lerp(x + 2, -60, k), lerp(y + 40, 1030, k), 0);
    const fl = flashAt(f, GROUND_F), lead = f >= D0 && f < GROUND_F ? 0.28 : 0;
    const sx = Math.sin(f * 17.3) * fl * 5, sy = Math.cos(f * 13.1) * fl * 5;
    camera.position.set(cam.x + sx, cam.y + sy, cam.z); camera.up.set(lerp(-0.04, 0, k), 1, 0); camera.lookAt(look); camera.fov = lerp(46, 41, k); camera.near = 5;
    camera.updateMatrixWorld(); e.common.cam.value.setFromMatrixPosition(camera.matrixWorld); uG.cam.value.setFromMatrixPosition(camera.matrixWorld);
    // the charge gathers towards the nose
    const gather = ease((f - 90) / (D0 - 90));
    pk.forEach((p, i) => { const c = 0.1 + 0.07 * Math.sin(f * p.b + p.a) + 0.05 * Math.sin(f * p.b * 2.3 + p.a * 2); const pull = ease((f - 110) / 110); vol.u.pockets.value[i].set(lerp(p.x, x + (p.x + 100) * 0.3, pull), lerp(p.y, Math.max(p.y, y - 420 + i * 170), pull), lerp(p.z, -240, pull), Math.max(0, c) * (0.8 + gather * 1.25) * (1 - clamp((f - GROUND_F) / 12) * 0.6)); });
    vol.u.tIon.value = lerp(0.04, 0.42, gather) * (f > GROUND_F ? Math.exp(-(f - GROUND_F) * 0.012) + 0.3 : 1);
    nimbus.position.set(x + Math.sin(0.05) * 113, y + 113, 0); const nm = gather * (0.75 + 0.25 * Math.sin(f * 1.7) * Math.sin(f * 0.41)) * (f >= D0 ? 0 : 1); nimbus.scale.setScalar(70 + nm * 120); nimbus.material.opacity = nm * 0.8;
    // the run
    const running = f >= D0, prog = clamp((f - D0) / (GROUND_F - D0)), hi = prog * (channel.length - 1), runY = running ? lerp(headD + 200, 0, prog) : -1;
    vol.u.tRun.value = running ? (f < GROUND_F ? runY : 0) : -1; vol.u.tRunAmt.value = running ? (f < GROUND_F ? 0.9 : Math.max(fl * 1.1, 0)) : 0;
    const after = f >= GROUND_F ? fl : 0, pw = running ? (f < GROUND_F ? 1 : Math.max(after, 0)) : 0;
    const colF = (mul) => (i) => { if (!running || i > hi) return [0, 0, 0]; const near = clamp(1 - (hi - i) / 22); const base = f < GROUND_F ? 0.45 + near * 1.3 : 1; const c = pw * base * mul; return [c * 11, c * 13, c * 19]; };
    chan.visible = halo.visible = running && pw > 0.004;
    if (chan.visible) { chan.userData.update(channel, () => 2.4, colF(1)); halo.userData.update(channel, () => 10, colF(0.05)); }
    branches.userData.update(camera, after > 0.6 ? after : after * 0.3); ringB.userData.update(camera, after > 0.5 ? after : 0);
    hit.visible = running && prog < 1 && prog > 0; hit.position.copy(channel[Math.min(channel.length - 1, Math.floor(hi))]); hit.scale.setScalar(camera.position.distanceTo(hit.position) * 0.045);
    const fv = Math.max(after * 0.85, lead);
    vol.u.flash.value = fv; vol.u.boltA.value.copy(high); vol.u.boltB.value.set(0, 300, 0);
    e.common.flash.value = fv * 0.45;
    vol.u.flame.value = 1.3; vol.u.flameA.value.set(x, y - 8, 0); vol.u.flameB.value.set(x, y - 190, 0);
    vol.u.wind.value.set(f * 0.00055, -f * 0.0006 + 0.47, f * 0.00024);
    strike.intensity = after * 5; strike.position.set(-300, y + 300, 380);
    flashG.intensity = after * 9000000;
    lamps.forEach((s) => s.scale.setScalar(camera.position.distanceTo(s.position) * 0.0048));
    e.final.white.value = f === GROUND_F ? 0.2 : 0;
    uG.bright.value = 0.2 + after * 0.5;
    vol.run(f);
  };
  loadTextures(e, {cape: 'cape.jpg'}, (tx) => { uG.map.value = tx.cape; uG.ready.value = 1; draw(lastF); e.render(lastF); });
  return {draw};
});

// plates of this group: name -> [component, frames]
export const PLATES = {EarthOrbit: [EarthOrbit, 300], TLIArc: [TLIArc, 360], CapeMap: [CapeMap, 300], ChargedClouds: [ChargedClouds, 300], CloudTops: [CloudTops, 360], RocketWire: [RocketWire, 330]};
