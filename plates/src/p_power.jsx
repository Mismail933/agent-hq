// The electrical story. Fuel cells dying, the batteries taking the load, the voltmeter, the reset, what a short would do; the two brains of the stack; what an abort would be.
// Every frame is a pure function of the frame number. Rebuilt, not filmed.
import * as THREE from 'three';
import {useScene, indoors, stormRocket, clamp, ease, lerp, flashAt} from './plates';
import {makeSaturn, makeXray} from './saturn';

const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, roughness, metalness, more = {}) => new THREE.MeshStandardMaterial({color, roughness, metalness, ...more});

// reflections: a dark room with a few soft light sources, so metal and glass have something to show
const studio = (e, panels, intensity = 1) => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x010101);
  panels.forEach(([x, y, z, w, h, r, g, b]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(r, g, b), side: THREE.DoubleSide})); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); });
  const pm = new THREE.PMREMGenerator(e.renderer), rt = pm.fromScene(s, 0.02, 0.1, 200);
  e.scene.environment = rt.texture; e.scene.environmentIntensity = intensity; pm.dispose();
};

const shadows = (e) => { e.renderer.shadowMap.enabled = true; e.renderer.shadowMap.type = THREE.PCFSoftShadowMap; };
const shadowed = (o, cast = true, recv = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };

// a real lens: the frame drawn several times from points across the aperture, all converging on the focus. What's off the focus plane really blurs, highlights and all.
const withLens = (e, n, lensOf) => {
  const {renderer, camera} = e, W = renderer.domElement.width, H = renderer.domElement.height;
  const grab = new THREE.FramebufferTexture(W, H);
  const opt = {type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter};
  let A = new THREE.WebGLRenderTarget(W, H, opt), B = new THREE.WebGLRenderTarget(W, H, opt);
  const mat = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, uniforms: {a: {value: null}, b: {value: grab}, w: {value: 1}},
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D a, b; uniform float w; void main(){ vec3 c = mix(texture(a, vUv).rgb, pow(texture(b, vUv).rgb, vec3(2.2)), w); o = vec4(c, 1.0); }`});
  const show = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, uniforms: {a: {value: null}},
    vertexShader: mat.vertexShader, fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D a; void main(){ o = vec4(pow(texture(a, vUv).rgb, vec3(1.0 / 2.2)), 1.0); }`});
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); q.frustumCulled = false; qs.add(q);
  const orig = e.render, right = V(0, 0, 0), up = V(0, 0, 0), fwd = V(0, 0, 0);
  e.render = (frame) => {
    const {aperture, focus, aim} = lensOf(frame), p0 = camera.position.clone(), target = aim || focus;
    const kA = 1 - p0.distanceTo(target) / p0.distanceTo(focus), off = V(0, 0, 0), look = V(0, 0, 0);
    camera.lookAt(target); camera.updateMatrixWorld(); camera.matrixWorld.extractBasis(right, up, fwd);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt((i + 0.5) / n) * aperture, a = i * 2.39996;
      off.set(0, 0, 0).addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
      camera.position.copy(p0).add(off); look.copy(target).addScaledVector(off, kA);
      camera.lookAt(look);
      if (e.renderer.shadowMap.enabled) { e.renderer.shadowMap.autoUpdate = false; e.renderer.shadowMap.needsUpdate = i === 0; }
      orig(frame);
      renderer.setRenderTarget(null); renderer.copyFramebufferToTexture(grab);
      q.material = mat; mat.uniforms.a.value = A.texture; mat.uniforms.w.value = 1 / (i + 1);
      renderer.setRenderTarget(B); renderer.render(qs, qc);
      const t = A; A = B; B = t;
    }
    camera.position.copy(p0); camera.lookAt(target);
    q.material = show; show.uniforms.a.value = A.texture; renderer.setRenderTarget(null); renderer.render(qs, qc); renderer.getContext().finish();
  };
};

// camera-facing strips of very bright light: arcs and flying sparks
const ribbons = (max) => {
  const pos = new Float32Array(max * 18), col = new Float32Array(max * 18), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
  mesh.frustumCulled = false;
  let k = 0; const d = V(0, 0, 0), v = V(0, 0, 0), s = V(0, 0, 0), A1 = V(0, 0, 0), A2 = V(0, 0, 0), C1 = V(0, 0, 0), C2 = V(0, 0, 0);
  mesh.userData = {
    begin: () => { k = 0; },
    seg: (a, b, w, r, g, bl, cam) => {
      if (k >= max * 18) return;
      d.copy(b).sub(a); if (d.lengthSq() < 1e-10) d.set(0, 1e-4, 0); d.normalize(); v.copy(a).sub(cam).normalize(); s.crossVectors(d, v).normalize();
      A1.copy(a).addScaledVector(s, w); A2.copy(a).addScaledVector(s, -w); C1.copy(b).addScaledVector(s, w); C2.copy(b).addScaledVector(s, -w);
      for (const q of [A1, A2, C1, A1, C1, C2]) { pos[k] = q.x; pos[k + 1] = q.y; pos[k + 2] = q.z; col[k] = r; col[k + 1] = g; col[k + 2] = bl; k += 3; }
    },
    end: () => { geo.setDrawRange(0, k / 3); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; },
  };
  return mesh;
};

// crumpled foil: flat facets of random height, so it catches light in pieces
const foilBump = (seed) => {
  const [c, g] = canvas(1024, 1024), r = rng(seed); g.fillStyle = '#808080'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i++) { const x = r() * 1024, y = r() * 1024, s = 18 + r() * 70, v = Math.floor(70 + r() * 120); g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * s, y + s * r()); g.lineTo(x + s * r(), y + (r() - 0.5) * s); g.closePath(); g.fill(); }
  const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};

// a hull as a shell of light: bright only where you look along it, with its seams
const glassShell = (profile, seg = 96, sectors = 6) => {
  const m = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {amt: {value: 1}, col: {value: new THREE.Color(0.5, 0.72, 1)}, flash: {value: 0}, sectors: {value: sectors}},
    vertexShader: `out vec3 vN; out vec3 vV; out vec3 vP; void main(){ vP = position; vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); gl_Position = projectionMatrix * m; }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vV; in vec3 vP; out vec4 o; uniform float amt, flash, sectors; uniform vec3 col;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float ang = atan(vP.z, vP.x) * sectors / 6.2832; float seam = smoothstep(0.012, 0.0, abs(fract(ang) - 0.5)) * 0.6;
        float row = smoothstep(0.012, 0.0, abs(fract(vP.y) - 0.5)) * 0.25;
        float f2 = f * f; float a = 0.0025 + 0.5 * f2 * f2 * f2 + (seam + row) * 0.012;
        o = vec4(col * amt * a * (1.0 + flash * 3.0), 1.0); }`});
  return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), m);
};

// current in a wire: dashes that run along it
const flowWire = (points, radius, color) => {
  const m = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {time: {value: 0}, amt: {value: 1}, flow: {value: 1}, col: {value: new THREE.Color(...color)}},
    vertexShader: `out vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; in vec2 vU; out vec4 o; uniform float time, amt, flow; uniform vec3 col; void main(){ float d = smoothstep(0.55, 0.95, sin(vU.x * 90.0 - time * 7.0) * 0.5 + 0.5); o = vec4(col * amt * (0.18 + flow * 2.4 * d), 1.0); }`});
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, radius, 8), m);
};

// ------------------------------------------------------------------ the service module, opened by x-ray
const SM_PROFILE = [[1.956, -0.02], [1.956, 3.9], [1.956, 3.96], [1.88, 4.2], [0.3, 7.25], [0.0, 7.3]];
const FC0 = 120, BAT0 = 150;

const fuelCell = (e, core) => {
  const g = new THREE.Group(), fin = std(0x6e6f6b, 0.36, 0.92), dark = std(0x1f2023, 0.5, 0.75), brass = std(0xa78a4c, 0.36, 0.95);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.78, 28), core); stack.position.y = 0.43; g.add(stack);
  const ringG = new THREE.CylinderGeometry(0.255, 0.255, 0.044, 44);
  for (let i = 0; i < 13; i++) { const r = new THREE.Mesh(ringG, fin); r.position.y = 0.06 + i * 0.062; g.add(r); }
  [0, 1, 2, 3, 4, 5].forEach((i) => { const a = (i * Math.PI) / 3 + 0.3, b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.86, 8), dark); b.position.set(Math.cos(a) * 0.262, 0.42, Math.sin(a) * 0.262); g.add(b); });
  const top = new THREE.Mesh(new THREE.LatheGeometry([[0.26, 0], [0.26, 0.05], [0.2, 0.12], [0.1, 0.17], [0, 0.18]].map(([r, y]) => new THREE.Vector2(r, y)), 36), std(0x5b5c59, 0.42, 0.9)); top.position.y = 0.84; g.add(top);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.04, 36), dark); foot.position.y = 0.02; g.add(foot);
  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 16), dark); pump.position.set(0.1, 1.04, 0.03); g.add(pump);
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.1, 1.1, 0.03), V(0.16, 1.14, 0.12), V(0.27, 0.92, 0.12), V(0.28, 0.5, 0.1), V(0.28, 0.1, 0.1)]), 40, 0.01, 8), brass); g.add(pipe);
  return g;
};

// the face of a silver-zinc battery: its case, its stencil, and in the emissive map its twenty cells
const batteryFace = (name) => {
  const [c, g] = canvas(768, 544), [ec, eg] = canvas(768, 544);
  g.fillStyle = '#35363a'; g.fillRect(0, 0, 768, 544); eg.fillStyle = '#000'; eg.fillRect(0, 0, 768, 544);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(24, 110, 720, 410);
  g.fillStyle = '#e4e2d8'; g.font = '700 58px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 384, 60);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 10; k++) {
    const x = 36 + k * 70, y = 124 + r * 196;
    g.fillStyle = '#0f1012'; g.fillRect(x, y, 62, 186);
    const hot = 0.45 + 0.55 * Math.abs(Math.sin(k * 2.7 + r * 1.9 + (name.length + name.charCodeAt(8)) * 0.8));
    const a = eg.createLinearGradient(x, y, x, y + 186); a.addColorStop(0, `rgba(255,255,255,${0.16 * hot})`); a.addColorStop(0.55, `rgba(255,255,255,${hot})`); a.addColorStop(1, `rgba(255,255,255,${0.3 * hot})`);
    eg.fillStyle = a; eg.fillRect(x + 8, y + 8, 46, 170);
  }
  return [tex(c), tex(ec)];
};

export const PowerDrop = () => useScene((e) => {
  const {scene, camera, cloud} = e, world = new THREE.Group(); scene.add(world);
  shadows(e); camera.near = 0.08; camera.far = 6000;
  cloud.near_.value = 26; cloud.far_.value = 1500; cloud.cover.value = 0.5;
  e.final.bloom.value = 0.42; e.final.exposure.value = 1.1; e.final.vign.value = 0.95;
  studio(e, [[-8, 9, 6, 14, 10, 0.42, 0.52, 0.72], [9, -2, 8, 5, 12, 0.07, 0.09, 0.12], [0, 12, -4, 10, 6, 0.22, 0.26, 0.34]], 0.5);

  const beam = std(0x4c4e52, 0.5, 0.82), deck = std(0x303236, 0.58, 0.72), tankM = std(0x85878a, 0.48, 1), steel = std(0xb0b2b2, 0.3, 1);
  const fb = foilBump(11), foil = std(0xb88c42, 0.32, 1, {bumpMap: fb, bumpScale: 1.2}), silver = std(0xa8aba9, 0.32, 1, {bumpMap: fb, bumpScale: 0.8});
  const disc = (y, r0, r1, m = deck, h = 0.06) => { const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); s.holes.push(hole); const o = new THREE.Mesh(new THREE.ExtrudeGeometry(s, {depth: h, bevelEnabled: false, curveSegments: 64}), m); o.rotation.x = -Math.PI / 2; o.position.y = y; world.add(o); return o; };
  disc(0, 0.2, 1.9); disc(3.84, 0.3, 1.9);
  // six beams, with their lightening holes, that divide it into its sectors
  [-35, 35, 95, 155, 215, 275].forEach((deg) => {
    const a = (deg * Math.PI) / 180, s = new THREE.Shape(); s.moveTo(0.56, 0); s.lineTo(1.9, 0); s.lineTo(1.9, 3.84); s.lineTo(0.56, 3.84); s.closePath();
    for (let k = 0; k < 4; k++) { const h = new THREE.Path(); h.absarc(1.23, 0.55 + k * 0.92, 0.3, 0, Math.PI * 2, true); s.holes.push(h); }
    const b = new THREE.Mesh(new THREE.ExtrudeGeometry(s, {depth: 0.022, bevelEnabled: false, curveSegments: 24}), beam);
    b.rotation.y = a - Math.PI / 2; world.add(b);
    // flanges and a cable run along the beam's edge
    [[1.9, 0], [0.56, 0]].forEach(([rad]) => { const fl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.84, 0.1), beam); fl.position.set(Math.sin(a) * rad, 1.92, Math.cos(a) * rad); fl.rotation.y = a; world.add(fl); });
    for (let w = 0; w < 5; w++) { const rad = 1.74 - w * 0.03, side = 0.03 + (w % 2) * 0.022, x = Math.sin(a) * rad + Math.cos(a) * side, z = Math.cos(a) * rad - Math.sin(a) * side, cab = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 3.7, 6), std(0xcfc9b6, 0.6, 0.02)); cab.position.set(x, 1.92, z); world.add(cab); }
  });
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 3.84, 48, 1, true), std(0x3b3d41, 0.5, 0.8, {side: THREE.DoubleSide})); centre.position.y = 1.92; world.add(centre);
  [65, 125, 245, 300].forEach((deg) => { const a = (deg * Math.PI) / 180, t = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 2.5, 12, 32), tankM); t.position.set(Math.sin(a) * 1.2, 1.92, Math.cos(a) * 1.2); world.add(t); });
  // sector IV, facing us: the cryogenic tanks in foil below, the shelf, three fuel cells on it
  const cryo = [[-0.62, 0.72, 1.18, 0.4, silver], [0.62, 0.72, 1.18, 0.4, silver], [-0.62, 1.72, 1.2, 0.44, foil], [0.62, 1.72, 1.2, 0.44, foil]];
  cryo.forEach(([x, y, z, r, m]) => { const t = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), m); t.position.set(x, y, z); world.add(t); });
  const shelf = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.05, 64, 1, false, -0.61, 1.22), deck); shelf.position.y = 2.5; world.add(shelf);
  // the feed lines, from each tank up through the shelf; valve blocks on the way
  const tubeW = (pts, r, m) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 8), m); world.add(o); return o; };
  cryo.forEach(([x, y, z, r], i) => { tubeW([V(x, y + r - 0.02, z), V(x * 0.8, y + r + 0.14, z + 0.1), V(x * 0.55 + (i - 1.5) * 0.06, 2.3, 1.44), V(x * 0.5 + (i - 1.5) * 0.06, 2.55, 1.42)], 0.011, steel); });
  [[-0.32, 2.36, 1.5], [0.05, 2.33, 1.52], [0.34, 2.37, 1.5]].forEach(([x, y, z]) => { const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.12), std(0x2a2b2e, 0.45, 0.8)); v.position.set(x, y, z); world.add(v); });

  const coreM = new THREE.MeshBasicMaterial({color: new THREE.Color(0.25, 3.2, 1.6)});
  const cellAt = [[-0.58, 1.32], [0, 1.45], [0.58, 1.32]], cellLights = [];
  cellAt.forEach(([x, z]) => {
    const c = fuelCell(e, coreM); c.position.set(x, 2.53, z); world.add(c);
    const l = new THREE.PointLight(0x38ff9a, 1.5, 7, 1.8); l.position.set(x, 2.95, z); world.add(l); cellLights.push(l);
  });
  // reaction control quads on the outside of the hull: solid metal, so the glass has something to hold
  [[62], [-62], [152], [-152]].forEach(([deg]) => { const a = (deg * Math.PI) / 180, g = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.2), std(0x3a3b3d, 0.55, 0.85)); g.add(box); [[0, 0.5, 0], [0, -0.5, Math.PI], [0.42, 0, -Math.PI / 2], [-0.42, 0, Math.PI / 2]].forEach(([nx, ny, rz]) => { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 0.2, 16, 1, true), std(0x3a3b3d, 0.45, 0.85, {side: THREE.DoubleSide})); n.position.set(nx, ny, 0); n.rotation.z = rz; g.add(n); }); g.position.set(Math.sin(a) * 2.03, 2.72, Math.cos(a) * 2.03); g.rotation.y = a; world.add(g); });

  // above: the heat shield, then the capsule's lower equipment bay: a rack of boxes, cable runs, and two small batteries
  const heat = new THREE.Mesh(new THREE.SphereGeometry(4.6, 64, 16, 0, Math.PI * 2, Math.PI - 0.44, 0.44), std(0x4a3a2c, 0.8, 0.2, {side: THREE.DoubleSide})); heat.position.y = 8.55; world.add(heat);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 3.4), std(0x202125, 0.86, 0.25)); floor.position.set(0, 4.26, 1.3); floor.visible = false; world.add(floor);
  const wallM = std(0x2b2c30, 0.6, 0.55), back = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 0.05), wallM); back.position.set(0, 5.4, 0.38); back.visible = false; world.add(back);
    const rk = rng(4021), boxM = [std(0x17181a, 0.45, 0.6), std(0x232427, 0.5, 0.65), std(0x3a3b3e, 0.5, 0.7)];
  for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) {
    const w = 0.22 + rk() * 0.12, h = 0.2 + rk() * 0.1, d = 0.12 + rk() * 0.12, x = -1.08 + k * 0.36 + (rk() - 0.5) * 0.02, y = 4.56 + row * 0.33;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxM[Math.floor(rk() * 3)]); b.position.set(x, y, 0.41 + d / 2); world.add(b);
    const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 14), std(0x6b6c6a, 0.55, 0.8)); cn.rotation.x = Math.PI / 2; cn.position.set(x + (rk() - 0.5) * w * 0.5, y - h * 0.18, 0.41 + d + 0.018); world.add(cn);
    if (rk() > 0.45) { const q = rk() * 0.08, pts = [cn.position.clone(), cn.position.clone().add(V(0.02, -0.06, 0.05)), V(x + 0.05, 4.46, 0.72 + q), V(x + 0.14, 4.31, 0.78 + q), V(x * 0.7, 4.295, 0.82 + q), V(x * 0.25, 4.295, 0.84 + q)]; tubeW(pts, 0.006, std(0x9d9888, 0.62, 0.02)); }
  }
  const batFace = [batteryFace('BATTERY A'), batteryFace('BATTERY B')];
  const batM = batFace.map(([m, em]) => new THREE.MeshStandardMaterial({map: m, roughness: 0.44, metalness: 0.45, emissive: 0xff7a14, emissiveMap: em, emissiveIntensity: 0}));
  const caseM = std(0x3c3d41, 0.44, 0.72);
  const batLight = [0, 1].map((i) => { const l = new THREE.PointLight(0xff9a2a, 0, 5, 1.8); l.position.set(i ? 0.3 : -0.3, 4.48, 1.42); world.add(l); return l; });
  const rackL = new THREE.PointLight(0xff9a3a, 0, 4, 1.7); rackL.position.set(0, 4.85, 1.0); world.add(rackL);
  const copper = new THREE.MeshStandardMaterial({color: 0xb5693a, roughness: 0.34, metalness: 1, emissive: 0xb0340c, emissiveIntensity: 0});
  [-0.25, 0.25].forEach((x, i) => {
    const g = new THREE.Group(); g.position.set(x, 4.28, 1.02); world.add(g);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.27, 0.27), [caseM, caseM, caseM, caseM, batM[i], caseM]); box.position.y = 0.135; g.add(box);
    [[-0.205, 0.135, 0.14], [0.205, 0.135, 0.14]].forEach(([fx, fy, fz]) => { const fl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.29, 0.02), std(0x232427, 0.4, 0.85)); fl.position.set(fx, fy, fz); g.add(fl); });
    [-0.1, 0.1].forEach((tx, ti) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.05, 12), std(ti ? 0x7c3a22 : 0x2a2a2a, 0.4, 0.8)); t.position.set(tx, 0.295, 0.05); g.add(t); });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.016, 0.29), std(0x26272a, 0.5, 0.75)); lid.position.y = 0.272; g.add(lid);
  });
  const relay = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.17, 0.16), std(0x1f2023, 0.45, 0.7)); relay.position.set(0, 4.72, 0.72); world.add(relay);
  // the straps, thick copper, from the batteries' posts to the relay box: they heat up
  [[-0.35, -0.08], [-0.15, -0.03], [0.15, 0.03], [0.35, 0.08]].forEach(([x0, x1]) => tubeW([V(x0, 4.6, 1.07), V(x0, 4.72, 1.04), V((x0 + x1) / 2, 4.79, 0.92), V(x1, 4.75, 0.8)], 0.0075, copper));

  // the wiring: the cells' bus up through the bulkhead; the current in it stops when they die
  const bus = cellAt.map(([x, z]) => flowWire([V(x, 3.65, z), V(x * 0.8, 3.76, z - 0.08), V(x * 0.4, 3.88, 0.98), V(x * 0.18, 4.3, 0.84), V(x * 0.1, 4.68, 0.8)], 0.007, [0.25, 1.1, 0.65]));
  bus.forEach((b) => e.glow.add(b));

  // the hull: it reads as glass; only its edges catch the storm's light
  const shell = glassShell(SM_PROFILE); e.glow.add(shell);
  const sla = glassShell([[3.3, -9], [1.96, -0.02]], 64, 4); sla.material.uniforms.amt.value = 0.45; e.glow.add(sla);
  const key = new THREE.DirectionalLight(0xa8bcd8, 0.55); key.position.set(-9, 12, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, {left: -5, right: 5, top: 6, bottom: -4, near: 1, far: 40}); key.shadow.bias = -0.0006; world.add(key, key.target); key.target.position.set(0, 3, 0);
  const strike = new THREE.DirectionalLight(0xdfe8ff, 0); strike.position.set(6, 8, 10); world.add(strike);
  world.add(new THREE.AmbientLight(0x4a5364, 0.24));
  shadowed(world);
  const riseOf = (f) => ease((f - BAT0 + 24) / 74);
  withLens(e, 8, (f) => { const up = riseOf(f), y0 = 1800 + f * 7.2; return {aperture: lerp(0.012, 0.012, up), focus: V(0, y0 + lerp(2.9, 4.45, up), lerp(1.42, 1.16, up)), aim: V(0, y0 + lerp(2.72, 4.6, up), lerp(1.1, 0.9, up))}; });

  return {draw: (f) => {
    const t = f / 30, y0 = 1800 + f * 7.2; world.position.y = y0; [shell, sla, ...bus].forEach((o) => { o.position.y = y0; });
    const fl = flashAt(f, FC0), d = f - FC0;
    // the cells: green and steady; a surge; then dark red, and only a fading ember
    const surge = d >= 0 && d < 3 ? 1 : 0, dead = d >= 3 ? 1 : 0;
    const r = dead ? 0.8 * (0.72 + 0.28 * Math.sin(f * 0.9) * Math.sin(f * 0.37)) * (0.55 + 0.45 * Math.exp(-(d - 3) * 0.02)) : 0;
    const hum = 1 + Math.sin(f * 0.21) * 0.03;
    coreM.color.setRGB(surge ? 18 : dead ? r * 1.2 : 0.25 * hum, surge ? 24 : dead ? r * 0.07 : 3.2 * hum, surge ? 32 : dead ? r * 0.04 : 1.6 * hum);
    cellLights.forEach((l) => { if (dead) { l.color.setRGB(1, 0.07, 0.04); l.intensity = r * 0.6; } else if (surge) { l.color.setRGB(0.85, 0.92, 1); l.intensity = 22; } else { l.color.setRGB(0.22, 1, 0.6); l.intensity = 1.5 * hum; } });
    bus.forEach((b) => { b.material.uniforms.time.value = t; b.material.uniforms.amt.value = dead ? 0.03 : surge ? 6 : 0.8; b.material.uniforms.flow.value = dead ? 0 : 0.6; });
    // the batteries come in: amber, unsteady, working far past their ease
    const b = ease((f - BAT0) / 3), strain = (s) => b * (1.1 + 0.42 * Math.sin(f * 2.3 + s) * Math.sin(f * 0.61 + s * 2) + 0.2 * Math.sin(f * 5.1 + s * 3));
    batM.forEach((m, i) => { const v = strain(i * 1.7); m.emissiveIntensity = v * 1.5; batLight[i].intensity = v * 1.1; });
    copper.emissiveIntensity = b * clamp((f - BAT0) / 70) * (0.2 + 0.04 * Math.sin(f * 1.3)); rackL.intensity = b * 0.9 * (0.85 + 0.15 * Math.sin(f * 2.3));
    // one move: from the cells, up past the bulkhead, through the heat shield and into the bay
    const k = ease(f / 120), up = riseOf(f);
    const sh = fl * 0.018, sx = Math.sin(f * 17.3) * sh, sy = Math.cos(f * 13.1) * sh;
    camera.position.set(lerp(lerp(-2.5, -1.9, k), 0.46, up) + sx, y0 + lerp(lerp(2.0, 2.3, k), 4.86, up) + sy, lerp(lerp(7.4, 5.9, k), 2.62, up));
    camera.fov = lerp(36, 40, up); camera.up.set(lerp(0.03, -0.015, up), 1, 0);
    const pw = fl > 0.6 ? fl : fl * 0.35, fade = 1 - ease((up - 0.5) / 0.32);
    shell.material.uniforms.amt.value = fade; sla.material.uniforms.amt.value = 0.45 * fade; shell.visible = fade > 0; sla.visible = fade > 0;
    strike.intensity = pw * 4 * fade; shell.material.uniforms.flash.value = pw; sla.material.uniforms.flash.value = pw;
    cloud.far_.value = up > 0.9 ? 0 : 1500; floor.visible = back.visible = up > 0.6; bus.forEach((b) => { b.visible = up < 0.6; });
    cloud.flash.value = fl * 0.85; e.common.flash.value = fl * 0.7;
    cloud.boltA.value.set(-700, y0 + 500, -900); cloud.boltB.value.set(500, y0 - 500, -700);
    cloud.flameA.value.set(0, y0 - 300, 0); cloud.flameB.value.set(0, y0 - 500, 0);
    cloud.wind.value.set(f * 0.0009, -f * 0.0011 + 0.6, f * 0.0004);
    e.final.white.value = d === 0 ? 0.14 : 0;
  }};
});

// ------------------------------------------------------------------ the DC voltmeter, close enough to see its needle's shadow
const VOLT_THETA = (v) => ((v / 40 - 0.5) * 100 * Math.PI) / 180;
const VOLT_F = 90;                               // 3.0 s: the fall
const needleV = (f) => {
  if (f < VOLT_F) return 28 + Math.sin(f * 0.37) * 0.04 + Math.sin(f * 0.91) * 0.025;
  const d = f - VOLT_F;
  const fall = 28 - 9.5 * (1 - Math.exp(-d * 0.62) * Math.cos(d * 0.75));       // a slam, a small swing back
  if (d < 45) return fall + Math.sin(f * 2.1) * 0.05 + Math.sin(f * 3.7) * 0.05;
  const u = d - 45;                              // 4.5 s: it climbs back, overshoots a little
  const rise = 18.5 + 5.1 * (1 - Math.exp(-u * 0.16) * Math.cos(u * 0.2));
  const tremble = (Math.sin(f * 1.31) * 0.11 + Math.sin(f * 2.93 + 1) * 0.1 + Math.sin(f * 4.7) * 0.06 + Math.sin(f * 0.23) * 0.14) * clamp(u / 30);
  return rise + tremble;
};

export const VoltGauge = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e;
  e.final.bloom.value = 0.55; e.final.exposure.value = 1.15; e.final.vign.value = 1.0; e.final.grain.value = 0.016;
  studio(e, [[-5, 7, 7, 7, 3, 2.2, 1.9, 1.5], [6, -3, 6, 3, 8, 0.14, 0.14, 0.17], [1, 9, 3, 2, 1, 1.2, 1.1, 0.9], [2.5, 3.2, 8, 3, 3, 0.85, 0.76, 0.62]], 0.75);
  const PX = 0, PY = -0.62, H = 0.05;            // the pivot, the needle's height above the dial
  const S = 3.6, CY = 0.1, D = (x, y) => [(x / S + 0.5) * 4096, (0.5 - (y - CY) / S) * 4096];
  const [c, g] = canvas(4096, 4096), wear = rng(41);
  g.fillStyle = '#0e0e0f'; g.fillRect(0, 0, 4096, 4096);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${0.004 + wear() * 0.012})`; g.fillRect(wear() * 4096, wear() * 4096, 1 + wear() * 5, 1 + wear() * 3); }
  const polar = (r, th) => [PX + Math.sin(th) * r, PY + Math.cos(th) * r];
  g.strokeStyle = '#ece9de'; g.fillStyle = '#ece9de'; g.lineCap = 'butt';
  for (let v = 0; v <= 40; v++) {
    const th = VOLT_THETA(v), major = v % 5 === 0, r0 = 1.215, r1 = major ? 1.335 : 1.28;
    const [ax, ay] = D(...polar(r0, th)), [bx, by] = D(...polar(r1, th));
    g.lineWidth = major ? 11 : 5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    if (major) { g.font = '700 118px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const [tx, ty] = D(...polar(1.47, th)); g.fillText(String(v), tx, ty); }
  }
  g.lineWidth = 6; g.beginPath(); { const steps = 80; for (let i = 0; i <= steps; i++) { const [x, y] = D(...polar(1.215, VOLT_THETA((i / steps) * 40))); if (i) g.lineTo(x, y); else g.moveTo(x, y); } } g.stroke();
  g.font = '700 132px Arial, sans-serif'; g.textAlign = 'center';
  { const [x, y] = D(0, 0.02); g.fillText('DC VOLTS', x, y); }
  const dialT = tex(c); dialT.repeat.set(1 / S, 1 / S); dialT.offset.set(0.5, 0.5 - CY / S); dialT.wrapS = dialT.wrapT = THREE.ClampToEdgeWrapping;
  // the dial, with a slot cut for the mirror arc
  const arc = (r, a, b, rev) => { const pts = []; const n = 64; for (let i = 0; i <= n; i++) { const th = lerp(a, b, i / n); pts.push(new THREE.Vector2(...polar(r, th))); } return rev ? pts.reverse() : pts; };
  const dialShape = new THREE.Shape(); dialShape.moveTo(-S / 2, CY - S / 2); dialShape.lineTo(S / 2, CY - S / 2); dialShape.lineTo(S / 2, CY + S / 2); dialShape.lineTo(-S / 2, CY + S / 2); dialShape.closePath();
  const A0 = VOLT_THETA(-0.6), A1 = VOLT_THETA(40.6), slot = new THREE.Path([...arc(1.2, A0, A1), ...arc(1.135, A0, A1, true)]); dialShape.holes.push(slot);
  const dial = new THREE.Mesh(new THREE.ShapeGeometry(dialShape, 48), std(0xffffff, 0.62, 0.05, {map: dialT})); dial.receiveShadow = true; scene.add(dial);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(S, S), std(0x050505, 0.5, 0.2)); under.position.set(0, CY, -H * 3); scene.add(under);
  const mirrorShape = new THREE.Shape([...arc(1.205, A0, A1), ...arc(1.13, A0, A1, true)]);
  const mirror = new THREE.Mesh(new THREE.ShapeGeometry(mirrorShape, 48), new THREE.MeshStandardMaterial({color: 0xdfe3e6, roughness: 0.05, metalness: 1, transparent: true, opacity: 0.55})); mirror.position.z = 0.001; scene.add(mirror);
  // the needle: a blade on its pivot, with its balance; and its image, under the mirror
  const paint = new THREE.MeshStandardMaterial({color: 0xf2efe6, roughness: 0.42, metalness: 0.1, emissive: 0xf2efe6, emissiveIntensity: 0.04});
  const blade = new THREE.Shape(); blade.moveTo(-0.017, 0.2); blade.lineTo(0.017, 0.2); blade.lineTo(0.0022, 1.345); blade.lineTo(-0.0022, 1.345); blade.closePath();
  const bladeG = new THREE.ExtrudeGeometry(blade, {depth: 0.006, bevelEnabled: false});
  const mkNeedle = (z) => { const n = new THREE.Group(); n.add(new THREE.Mesh(bladeG, paint)); const bal = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.008), std(0x8b8b86, 0.3, 0.9)); bal.position.y = 0.02; n.add(bal); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.24, 0.008), std(0x8b8b86, 0.3, 0.9)); tail.position.y = 0.1; n.add(tail); [-0.12, 0.12].forEach((x) => { const w = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), std(0xb3996a, 0.3, 0.9)); w.position.set(x, 0.02, 0); n.add(w); }); n.position.set(PX, PY, z); scene.add(n); return n; };
  const needle = mkNeedle(H), image = mkNeedle(-H); shadowed(needle, true, false); image.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  // hub, hairspring
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.05, 28), std(0x17181a, 0.4, 0.8)); hub.rotation.x = Math.PI / 2; hub.position.set(PX, PY, 0.025); scene.add(hub);
  const hairPts = []; for (let i = 0; i <= 180; i++) { const a = (i / 180) * Math.PI * 7, r = 0.05 + (i / 180) * 0.09; hairPts.push(V(PX + Math.cos(a) * r, PY + Math.sin(a) * r, 0.03)); }
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hairPts), 400, 0.0025, 5), std(0xc98a54, 0.3, 1)));
  // the case: a raised frame with a window in it, screws, the panel beyond
  const skinC = (() => { const [pc, pg] = canvas(2048, 2048), r = rng(9); pg.fillStyle = '#34363a'; pg.fillRect(0, 0, 2048, 2048); for (let i = 0; i < 2600; i++) { pg.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.012})`; pg.fillRect(r() * 2048, r() * 2048, 200 + r() * 700, 1 + r() * 3); } return tex(pc); })();
  skinC.wrapS = skinC.wrapT = THREE.RepeatWrapping; skinC.repeat.set(0.12, 0.12);
  const front = new THREE.Shape(); front.moveTo(-9, -7); front.lineTo(9, -7); front.lineTo(9, 7); front.lineTo(-9, 7); front.closePath();
  const rr = (x0, y0, x1, y1, r) => { const p = new THREE.Path(); p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false); p.lineTo(x1, y1 - r); p.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false); p.lineTo(x0 + r, y1); p.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false); p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false); return p; };
  front.holes.push(rr(-1.55, -0.85, 1.55, 1.02, 0.14));
  const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(front, {depth: 0.34, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, curveSegments: 16}), std(0x34363a, 0.58, 0.45, {map: skinC})); shadowed(panel); scene.add(panel);
  const frameShape = new THREE.Shape(rr(-1.86, -1.16, 1.86, 1.33, 0.2).getPoints(16)); frameShape.holes.push(rr(-1.55, -0.85, 1.55, 1.02, 0.14));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, {depth: 0.09, bevelEnabled: true, bevelSize: 0.022, bevelThickness: 0.022, bevelSegments: 3, curveSegments: 16}), std(0x17181a, 0.34, 0.85)); frame.position.z = 0.36; shadowed(frame); scene.add(frame);
  [[-1.7, -1.0], [1.7, -1.0], [-1.7, 1.17], [1.7, 1.17]].forEach(([x, y], i) => { const s = new THREE.Group(); const head = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.03, 20), std(0x8d8e8c, 0.3, 0.95)); head.rotation.x = Math.PI / 2; s.add(head); const slotM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), std(0x050505, 0.8, 0)); slotM.position.z = 0.014; slotM.rotation.z = 0.5 + i * 1.1; s.add(slotM); s.position.set(x, y, 0.49); scene.add(s); });
  // the bus-undervolt lamp next door
  const [lc, lg] = canvas(512, 256); lg.fillStyle = '#17150f'; lg.fillRect(0, 0, 512, 256); lg.fillStyle = '#fff'; lg.textAlign = 'center'; lg.textBaseline = 'middle'; lg.font = '700 74px Arial, sans-serif'; lg.fillText('MN BUS A', 256, 86); lg.fillText('UNDERVOLT', 256, 174);
  const lampM = new THREE.MeshStandardMaterial({color: 0x0c0b09, roughness: 0.45, emissive: 0xff9a1c, emissiveMap: tex(lc), emissiveIntensity: 0.02});
  const lampMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), lampM); lampMesh.position.set(2.62, 0.75, 0.37); scene.add(lampMesh);
  const lampL = new THREE.PointLight(0xff9a2a, 0, 8, 1.6); lampL.position.set(2.5, 0.75, 1.2); scene.add(lampL);
  // the glass: a soft window shape and fine dust, added light, moving against the dial as we move
  const [gc, gg] = canvas(1024, 1024), gr = rng(73);
  gg.fillStyle = '#000'; gg.fillRect(0, 0, 1024, 1024);
  const grd = gg.createLinearGradient(100, 80, 620, 560); grd.addColorStop(0, 'rgba(255,240,220,0.5)'); grd.addColorStop(0.45, 'rgba(255,240,220,0.12)'); grd.addColorStop(1, 'rgba(255,240,220,0)');
  gg.filter = 'blur(38px)'; gg.fillStyle = grd; gg.beginPath(); gg.moveTo(90, 40); gg.lineTo(420, 40); gg.lineTo(170, 900); gg.lineTo(-100, 900); gg.closePath(); gg.fill(); gg.filter = 'none';
  for (let i = 0; i < 900; i++) { gg.fillStyle = `rgba(255,255,255,${0.02 + gr() * 0.1})`; const s = 1 + gr() * 2.6; gg.fillRect(gr() * 1024, gr() * 1024, s, s); }
  const glassM = new THREE.MeshBasicMaterial({map: tex(gc), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: new THREE.Color(0.1, 0.1, 0.1)});
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.14, 1.9), glassM); glass.position.set(0, 0.085, 0.28); scene.add(glass);

  const key = new THREE.SpotLight(0xffdcb4, 36, 14, 0.55, 0.7, 1.5); key.position.set(-1.5, 1.35, 4.2); key.target.position.set(0, 0.25, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 2.5; key.shadow.camera.near = 1; key.shadow.camera.far = 9; scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x8094b4, 0.1); fill.position.set(3, -2, 4); scene.add(fill);
  const white = new THREE.DirectionalLight(0xe6eeff, 0); white.position.set(-4, 3, 4); scene.add(white);
  scene.add(new THREE.AmbientLight(0x50545c, 0.12));
  withLens(e, 10, (f) => ({aperture: 0.04, focus: V(lerp(0.12, 0.18, ease(f / 330)), lerp(0.52, 0.55, ease(f / 330)), H)}));
  return {draw: (f) => {
    const v = needleV(f), th = VOLT_THETA(v); needle.rotation.z = -th; image.rotation.z = -th;
    const d = f - VOLT_F, fl = d >= 0 ? (d <= 1 ? 1 : d <= 3 ? 0.35 : d <= 5 ? 0.55 : 0.55 * Math.exp(-(d - 5) * 0.5)) : 0;
    // the floods run off the same bus: down with the volts, unsteady ever after
    const volts = clamp((v - 8) / 20), flood = Math.pow(volts, 1.6) * (d > 0 ? 1 + Math.sin(f * 1.9) * 0.05 + Math.sin(f * 0.53) * 0.04 : 1);
    key.intensity = 36 * flood; glassM.color.setRGB(0.1 * flood + fl * 1.1, 0.1 * flood + fl * 1.15, 0.1 * flood + fl * 1.3); white.intensity = fl * 3.2;
    const lampOn = d >= 3 ? 1 : 0; lampM.emissiveIntensity = 0.02 + lampOn * (6 + Math.sin(f * 0.9) * 0.3); lampL.intensity = lampOn * 4.2;
    const push = ease(f / 340), sh = 0.0035 + (d >= 0 ? 0.016 * Math.exp(-d * 0.07) : 0), sx = Math.sin(f * 2.13) * Math.cos(f * 0.77) * sh, sy = Math.cos(f * 1.71) * Math.sin(f * 1.17) * sh;
    camera.position.set(lerp(-1.25, -0.72, push) + sx, lerp(-0.55, -0.32, push) + sy, lerp(3.25, 2.72, push));
    camera.fov = 31; camera.up.set(lerp(-0.03, 0.02, push), 1, 0);
    e.final.white.value = d === 0 ? 0.12 : 0;
  }};
});

// ------------------------------------------------------------------ the three fuel-cell lights, going out one at a time
const OUT = [90, 195, 300];        // 3.0 s, 6.5 s, 10.0 s

const lampFace = (rows, lit) => {
  const [c, g] = canvas(512, 284);
  g.fillStyle = lit ? '#000' : '#191712'; g.fillRect(0, 0, 512, 284);
  if (lit) { const a = g.createRadialGradient(256, 142, 10, 256, 142, 320); a.addColorStop(0, 'rgba(255,255,255,0.26)'); a.addColorStop(1, 'rgba(255,255,255,0.05)'); g.fillStyle = a; g.fillRect(0, 0, 512, 284); }
  g.fillStyle = lit ? '#fff' : '#494540'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 82px Arial, sans-serif';
  rows.forEach((r, i) => g.fillText(r, 256, 142 + (i - (rows.length - 1) / 2) * 92));
  return tex(c);
};

export const FuelReset = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e, LW = 1.06, LH = 0.6, PXs = 1.2, PYs = 0.74;
  e.final.bloom.value = 0.72; e.final.exposure.value = 1.15; e.final.vign.value = 1.05; e.final.grain.value = 0.016;
  studio(e, [[-6, 7, 6, 8, 3, 0.9, 0.82, 0.72], [7, -2, 6, 3, 8, 0.08, 0.08, 0.1]], 0.6);
  const rows = [[['O2 FLOW', 'HI'], ['SUIT', 'COMP'], ['YAW', 'GMBL 1']], [['PITCH', 'GMBL 1'], ['PITCH', 'GMBL 2'], ['YAW', 'GMBL 2']], [['FUEL', 'CELL 1'], ['FUEL', 'CELL 2'], ['FUEL', 'CELL 3']]];
  const lamps = [];
  rows.forEach((row, ri) => row.forEach((lb, ci) => {
    const x = (ci - 1) * PXs, y = (2 - ri) * PYs, isFC = ri === 2;
    const m = new THREE.MeshStandardMaterial({map: lampFace(lb, false), roughness: 0.48, metalness: 0, emissive: 0xff9416, emissiveMap: lampFace(lb, true), emissiveIntensity: 0});
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), m); lens.position.set(x, y, -0.055); lens.receiveShadow = true; scene.add(lens);
    if (isFC) { const l = new THREE.PointLight(0xff9a2a, 0, 6, 1.8); l.position.set(x, y, 0.42); scene.add(l); lamps.push({m, l, i: ci}); }
  }));
  // the egg-crate that holds the lamps
  const grid = new THREE.Shape(); grid.moveTo(-8, -6); grid.lineTo(8, -6); grid.lineTo(8, 6); grid.lineTo(-8, 6); grid.closePath();
  rows.forEach((row, ri) => row.forEach((_, ci) => { const x = (ci - 1) * PXs, y = (2 - ri) * PYs, r = 0.03, w = LW / 2, h = LH / 2, p = new THREE.Path(); p.moveTo(x - w + r, y - h); p.lineTo(x + w - r, y - h); p.absarc(x + w - r, y - h + r, r, -Math.PI / 2, 0, false); p.lineTo(x + w, y + h - r); p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false); p.lineTo(x - w + r, y + h); p.absarc(x - w + r, y + h - r, r, Math.PI / 2, Math.PI, false); p.lineTo(x - w, y - h + r); p.absarc(x - w + r, y - h + r, r, Math.PI, Math.PI * 1.5, false); grid.holes.push(p); }));
  const [skin, sg] = canvas(2048, 2048), wr = rng(19); sg.fillStyle = '#3c3e42'; sg.fillRect(0, 0, 2048, 2048); for (let i = 0; i < 2400; i++) { sg.fillStyle = `rgba(${wr() < 0.6 ? '0,0,0' : '255,255,255'},${wr() * 0.014})`; sg.fillRect(wr() * 2048, wr() * 2048, 150 + wr() * 800, 1 + wr() * 3); }
  const skinT = tex(skin); skinT.wrapS = skinT.wrapT = THREE.RepeatWrapping; skinT.repeat.set(0.1, 0.1);
  const crate = new THREE.Mesh(new THREE.ExtrudeGeometry(grid, {depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 6}), std(0x35373b, 0.5, 0.55, {map: skinT})); crate.castShadow = crate.receiveShadow = true; scene.add(crate);
  // below the lights: a row of toggles, out of focus at the bottom of the frame
  const metal = std(0xc8c8c4, 0.26, 0.95), collar = std(0x18191b, 0.46, 0.75);
  [-1.5, -0.5, 0.5, 1.5].forEach((x, i) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 20), collar); b.rotation.x = Math.PI / 2; g.add(b); const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.24, 6, 14), metal); t.position.set(0, i % 2 ? 0.09 : -0.09, 0.17); t.rotation.x = i % 2 ? 0.55 : -0.55; g.add(t); g.position.set(x, -0.82, 0.07); shadowed(g); scene.add(g); });
  [-2.15, 2.15].forEach((x) => [1.58, -0.46].forEach((y) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.025, 18), std(0x8c8d8b, 0.3, 0.95)); s.rotation.x = Math.PI / 2; s.position.set(x, y, 0.07); scene.add(s); }));
  const flood = new THREE.SpotLight(0xffd9b0, 17, 14, 0.8, 0.9, 1.5); flood.position.set(-2.6, 3.6, 3.4); flood.target.position.set(0, 0.5, 0); flood.castShadow = true; flood.shadow.mapSize.set(2048, 2048); flood.shadow.bias = -0.0004; flood.shadow.radius = 3; scene.add(flood, flood.target);
  scene.add(new THREE.AmbientLight(0x505662, 0.16));
  const focusX = (f) => { const b = ease((f - 175) / 26), c = ease((f - 280) / 26); return lerp(lerp(-PXs, 0, b), PXs, c); };
  withLens(e, 14, (f) => { const k = ease(f / 360); return {aperture: 0.034, focus: V(focusX(f), 0.02, 0), aim: V(lerp(-0.1, 0.1, k), lerp(0.28, 0.22, k), 0)}; });
  return {draw: (f) => {
    lamps.forEach(({m, l, i}) => {
      const d = f - OUT[i], live = 1 + Math.sin(f * 0.8 + i * 2) * 0.03;
      const v = d < 0 ? live : Math.exp(-d * 0.42);                 // the filament doesn't stop at once
      m.emissiveIntensity = v * 5.2; l.intensity = v * 1.9;
    });
    const k = ease(f / 360), sh = 0.0034, sx = Math.sin(f * 2.13) * Math.cos(f * 0.77) * sh, sy = Math.cos(f * 1.71) * Math.sin(f * 1.17) * sh;
    camera.position.set(lerp(-2.05, -0.75, k) + sx, lerp(-0.62, -0.5, k) + sy, lerp(4.5, 4.0, k));
    camera.fov = 33; camera.up.set(lerp(0.05, -0.03, k), 1, 0);
  }};
});

// ------------------------------------------------------------------ inside a junction: what a short would do
export const ShortSpark = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e, ARC = V(0.1, 0.34, 0.62), ON = 24;
  e.final.bloom.value = 0.22; e.final.exposure.value = 1.15; e.final.vign.value = 1.1; e.final.grain.value = 0.02;
  studio(e, [[-6, 6, 7, 6, 2, 0.5, 0.48, 0.46], [6, -2, 5, 3, 6, 0.06, 0.06, 0.08], [2, 8, 6, 5, 2, 0.5, 0.46, 0.4]], 0.55);
  const r = rng(907);
  // the box wall, with rivets, a stringer and more wiring behind, out of focus
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), std(0x34363a, 0.62, 0.6)); wall.position.z = -1.4; wall.receiveShadow = true; scene.add(wall);
  const flange = new THREE.Mesh(new THREE.BoxGeometry(40, 0.34, 0.5), std(0x3e4044, 0.5, 0.75)); flange.position.set(0, 2.5, -1.15); shadowed(flange); scene.add(flange);
  for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), std(0x5f6066, 0.4, 0.85)); m.position.set(-15 + i * 0.5, 2.5, -0.9); m.scale.z = 0.55; scene.add(m); }
  const tube = (pts, rad, m, seg = 90, radial = 10) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, rad, radial), m); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
  const wireM = std(0xc9c4b4, 0.46, 0.02), wireDark = std(0x8a8678, 0.5, 0.02), redW = std(0x7e2a20, 0.5, 0.02);
  for (let i = 0; i < 16; i++) tube([V(-12, 1.3 + r() * 0.3, -0.95 + r() * 0.25), V(-3, 1.2 + r() * 0.3, -1 + r() * 0.25), V(4, 1.45 + r() * 0.3, -0.95 + r() * 0.25), V(12, 1.1 + r() * 0.3, -1 + r() * 0.25)], 0.038, i % 5 === 0 ? redW : wireDark, 50, 6);
  // the terminal strip: a phenolic bar, brass studs, nuts, ring lugs, its engraved numbers
  const [bc, bg] = canvas(4096, 512); bg.fillStyle = '#20150e'; bg.fillRect(0, 0, 4096, 512); for (let i = 0; i < 1600; i++) { bg.fillStyle = `rgba(255,220,180,${r() * 0.018})`; bg.fillRect(r() * 4096, r() * 512, 60 + r() * 300, 1 + r() * 2); }
  bg.fillStyle = '#b4a890'; bg.font = '700 40px Arial, sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle';
  const studs = [-3.6, -1.8, 0, 1.8, 3.6, 5.4]; studs.forEach((x, i) => { bg.fillText(`TB4-${i + 3}`, ((x + 8) / 16) * 4096 + 170, 190); });
  const barTop = std(0x20150e, 0.5, 0.1), barFace = std(0xffffff, 0.5, 0.1, {map: tex(bc)});
  const bar = new THREE.Mesh(new THREE.BoxGeometry(16, 1.44, 0.7), [barTop, barTop, barTop, barTop, barFace, barTop]); bar.position.set(0, -0.26, -0.2); shadowed(bar); scene.add(bar);
  const brass = std(0xa98747, 0.34, 1), copper = new THREE.MeshStandardMaterial({color: 0xc87b4c, roughness: 0.3, metalness: 1, emissive: 0xff5a14, emissiveIntensity: 0});
  studs.forEach((x) => {
    const g = new THREE.Group(); g.position.set(x, 0.1, 0.16); scene.add(g);
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.015, 28), std(0x8f8f8d, 0.3, 1)); washer.rotation.x = Math.PI / 2; g.add(washer);
    const lug = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 26), std(0xb49652, 0.3, 1)); lug.scale.z = 0.35; lug.position.z = 0.03; g.add(lug);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.11, 6), brass); nut.rotation.x = Math.PI / 2; nut.position.z = 0.11; g.add(nut);
    const end = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 16), brass); end.rotation.x = Math.PI / 2; end.position.z = 0.22; g.add(end);
    shadowed(g);
  });
  // a laced bundle running across the top; each wire peels off to its stud. The barrel of each lug is crimped on.
  const lace = std(0xbdb49a, 0.8, 0);
  const offs = [[0, 0], [0.11, 0.05], [-0.11, 0.06], [0.05, 0.14], [-0.06, -0.12], [0.12, -0.09], [-0.13, -0.06], [0.03, -0.02]];
  studs.forEach((x, i) => {
    const [ox, oz] = offs[i];
    const run = [V(-14, 1.62 + ox, 0.22 + oz), V(-8, 1.6 + ox, 0.25 + oz), V(x - 2.4, 1.58 + ox * 0.8, 0.3 + oz)];
    if (i === 2) { tube([...run, V(-1.1, 1.52, 0.38), V(-0.74, 1.3, 0.46)], 0.05, wireM); return; }
    tube([...run, V(x - 0.5, 1.2, 0.42), V(x - 0.06, 0.62, 0.38), V(x, 0.26, 0.24)], 0.05, wireM);
    const crimp = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.22, 14), std(0xb49652, 0.34, 1)); crimp.position.set(x - 0.01, 0.36, 0.28); crimp.rotation.x = -0.25; shadowed(crimp); scene.add(crimp);
  });
  for (let i = 0; i < 2; i++) tube([V(-14, 1.66 + i * 0.09, 0.18), V(-4, 1.68 + i * 0.09, 0.2), V(4, 1.7 + i * 0.09, 0.22), V(14, 1.72 + i * 0.09, 0.2)], 0.05, i ? wireM : redW);
  for (let i = 0; i < 12; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.014, 6, 24), lace); t.position.set(-9 + i * 1.5, 1.66, 0.24); t.rotation.y = Math.PI / 2; t.castShadow = true; scene.add(t); }
  // the bad wire: its insulation burnt back, the strands fanned out, a hair from the stud
  const burn = std(0x1d1610, 0.86, 0.05); tube([V(-0.74, 1.3, 0.46), V(-0.5, 1.04, 0.5), V(-0.26, 0.86, 0.54)], 0.054, burn, 20);
  const rs = rng(55);
  for (let i = 0; i < 13; i++) { const a = (i / 13) * 6.283, sp = 0.05 + rs() * 0.075; tube([V(-0.26, 0.86, 0.54), V(-0.1 + Math.cos(a) * sp * 0.5, 0.68 + Math.sin(a) * sp * 0.5, 0.57 + Math.sin(a * 2) * sp * 0.4), V(0.05 + Math.cos(a) * sp, 0.5 + Math.sin(a) * sp, 0.6 + Math.cos(a) * sp * 0.5)], 0.0052, copper, 12, 6); }

  // what the arc does
  const arcM = ribbons(2400); e.glow.add(arcM);
  const key = new THREE.SpotLight(0xffc896, 5.5, 30, 0.42, 0.9, 1.5); key.position.set(-3.6, 4.2, 6); key.target.position.set(0.3, 0.4, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 3; scene.add(key, key.target);
  const flare = new THREE.PointLight(0xbcd0ff, 0, 30, 1.8); flare.position.copy(ARC).add(V(0.02, 0.02, 0.1)); flare.castShadow = true; flare.shadow.mapSize.set(1024, 1024); flare.shadow.bias = -0.003; flare.shadow.camera.near = 0.05; flare.shadow.camera.far = 30; scene.add(flare);
  const heat = new THREE.PointLight(0xff5a18, 0, 4, 2); heat.position.copy(ARC).add(V(-0.04, 0.12, 0.14)); scene.add(heat);
  scene.add(new THREE.AmbientLight(0x4a4e56, 0.1));
  // sparks: thrown from the arc, each its own closed-form arc through the air, cooling as they fly
  const sparks = []; for (let i = 0; i < 80; i++) sparks.push({t0: ON + r() * 26, vx: (r() - 0.42) * 0.17, vy: 0.01 + r() * 0.11, vz: (r() - 0.5) * 0.03, life: 8 + r() * 22, w: 0.0035 + r() * 0.005});
  // a thin smoke, soft sprites that rise and thin out
  const [sc, sg] = canvas(256, 256), srg = sg.createRadialGradient(128, 128, 8, 128, 128, 126); srg.addColorStop(0, 'rgba(255,255,255,0.55)'); srg.addColorStop(0.5, 'rgba(255,255,255,0.18)'); srg.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = srg; sg.fillRect(0, 0, 256, 256);
  const smokeT = tex(sc), smoke = []; const sr = rng(311);
  for (let i = 0; i < 26; i++) { const m = new THREE.SpriteMaterial({map: smokeT, transparent: true, depthWrite: false, color: new THREE.Color(0.3, 0.29, 0.28), opacity: 0}); const s = new THREE.Sprite(m); scene.add(s); smoke.push({s, m, t0: ON + 4 + i * 2.2 + sr() * 2, dx: (sr() - 0.5) * 0.5, rot: sr() * 6}); }
  const [hc, hg] = canvas(512, 512), hr = hg.createRadialGradient(256, 256, 0, 256, 256, 256); [[0, 1], [0.06, 0.55], [0.16, 0.22], [0.32, 0.07], [0.6, 0.015], [1, 0]].forEach(([a, b]) => hr.addColorStop(a, `rgba(255,255,255,${b})`)); hg.fillStyle = '#000'; hg.fillRect(0, 0, 512, 512); hg.fillStyle = hr; hg.fillRect(0, 0, 512, 512);
  const haloT = tex(hc), halo = new THREE.Sprite(new THREE.SpriteMaterial({map: haloT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, color: new THREE.Color(0, 0, 0)})); halo.position.copy(ARC); halo.scale.set(2.6, 2.6, 1); e.glow.add(halo);
  // arc strength over time: full, gone, back, sputtering out
  const POW = {24: 1, 25: 1, 26: 0.8, 27: 1, 28: 0.9, 29: 1, 30: 0.4, 31: 0, 32: 0.85, 33: 0.7, 34: 0.9, 35: 0.4, 36: 0, 37: 0, 38: 0.8, 39: 0.6, 40: 0.2, 41: 0, 42: 0, 43: 0, 44: 0.5, 45: 0.3, 46: 0, 47: 0, 48: 0, 49: 0, 50: 0.22, 51: 0.08, 52: 0};
  const a0 = V(0.05, 0.5, 0.6), a1 = V(0.02, 0.17, 0.5), P = V(0, 0, 0), Q = V(0, 0, 0), T = V(0, 0, 0);
  withLens(e, 12, (f) => ({aperture: 0.032, focus: ARC, aim: V(lerp(0.05, 0.1, ease(f / 150)), 0.48, 0.4)}));
  return {draw: (f) => {
    const cam = camera.position, pw = POW[f] || 0, k = ease(f / 150);
    camera.position.set(lerp(-1.25, -0.95, k), lerp(0.28, 0.34, k), lerp(4.1, 3.5, k)); camera.fov = 32; camera.up.set(0.02, 1, 0);
    arcM.userData.begin();
    if (pw > 0) {
      const rr2 = rng(1 + f * 271);
      for (let n = 0; n < 4; n++) {
        const segs = 14; let prev = a0.clone();
        for (let i = 1; i <= segs; i++) { const u = i / segs; P.copy(a0).lerp(a1, u); const w = Math.sin(u * Math.PI) * (n === 0 ? 0.05 : 0.11); P.x += (rr2() - 0.5) * w; P.y += (rr2() - 0.5) * w; P.z += (rr2() - 0.5) * w; arcM.userData.seg(prev, P, n === 0 ? 0.0085 : 0.003, 7 * pw, 9 * pw, 13 * pw, cam); prev = P.clone(); }
      }
    }
    sparks.forEach((s) => { const t = f - s.t0; if (t < 0 || t > s.life) return; const u = t / s.life, g = 0.0012;
      const at = (tt) => T.set(ARC.x + s.vx * tt, ARC.y + s.vy * tt - g * tt * tt, ARC.z + s.vz * tt);
      Q.copy(at(Math.max(0, t - 0.55))); P.copy(at(t)); const heatC = 1 - u;
      arcM.userData.seg(Q.clone(), P.clone(), s.w, 4.5 * heatC + 0.7, 2.4 * heatC * heatC + 0.14, 0.7 * heatC * heatC * heatC, cam); });
    arcM.userData.end();
    flare.intensity = pw * 4.2; halo.material.color.setRGB(pw * 0.9, pw * 1.05, pw * 1.4);
    const since = f - 52, glow = f < ON ? 0 : f <= 52 ? 1 : Math.exp(-since * 0.075);
    copper.emissiveIntensity = glow * 1.5; heat.intensity = glow * 0.3;
    smoke.forEach(({s, m, t0, dx, rot}) => { const t = f - t0; if (t < 0) { m.opacity = 0; return; } const u = t / 90; s.position.set(ARC.x + dx * u * 1.2 + Math.sin(t * 0.05 + rot) * 0.08 * u, ARC.y + 0.1 + u * 1.5, ARC.z + 0.06); const sz = 0.22 + u * 0.9; s.scale.set(sz, sz, 1); m.opacity = 0.05 * clamp(t / 10) * clamp(1 - u); m.rotation = rot + u; });
    e.final.white.value = f === ON ? 0.08 : 0;
  }};
});

// ------------------------------------------------------------------ the two brains: the whole stack, see-through, in the storm
const stackPlate = (brainsOk) => () => useScene((e) => {
  const {camera, cloud} = e, R = stormRocket(e), xray = makeXray(); e.glow.add(xray);
  cloud.near_.value = 28; cloud.far_.value = 2400;
  e.final.bloom.value = 0.42; e.final.vign.value = 0.8;
  R.saturn.traverse((m) => { if (m.isMesh && m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.8; } });
  xray.traverse((m) => { if (m.isLineSegments) m.visible = false; });
  const axis = new THREE.Group(); e.glow.add(axis);     // what rides with the rocket inside the x-ray
  const ghost = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: `out vec3 vN; out vec3 vV; void main(){ vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); gl_Position = projectionMatrix * m; }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vV; out vec4 o; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); o = vec4(vec3(0.3, 0.42, 0.62) * (0.012 + 0.34 * f * f * f), 1.0); }`});
  [[4.6, 7.2, 12.4], [4.6, 7.8, 31], [4.6, 6, 53], [4.6, 4, 62.4], [3.0, 3.8, 79], [3.0, 3, 85.2]].forEach(([r, h, y]) => { const t = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), ghost); t.scale.set(r, h, r); t.position.y = y; axis.add(t); });
  // the Instrument Unit: a ring of black boxes on the inside of a band, in phosphor green
  const iuM = new THREE.MeshBasicMaterial({color: new THREE.Color(0.15, 1.6, 0.8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide});
  const band = new THREE.Mesh(new THREE.CylinderGeometry(3.32, 3.32, 0.92, 96, 1, true), iuM); band.position.y = 89.05; axis.add(band);
  const boxM = new THREE.MeshBasicMaterial({color: new THREE.Color(0.3, 3.6, 1.8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false});
  for (let i = 0; i < 32; i++) { const a = (i / 32) * 6.2832, b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.54, 0.3), boxM); b.position.set(Math.cos(a) * 2.98, 89.05, Math.sin(a) * 2.98); b.rotation.y = -a; axis.add(b); }
  const iuL = new THREE.PointLight(0x38ff9a, 1200, 90, 1.8); iuL.position.set(-9, 88, 14); R.rocket.add(iuL);
  // the spacecraft on top
  const pod = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {amt: {value: 0}, col: {value: new THREE.Color(1, 0.08, 0.04)}},
    vertexShader: `out vec3 vN; out vec3 vV; void main(){ vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); gl_Position = projectionMatrix * m; }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vV; out vec4 o; uniform float amt; uniform vec3 col; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); o = vec4(col * amt * (0.1 + 2.0 * f * f), 1.0); }`});
  axis.add(new THREE.Mesh(new THREE.LatheGeometry([[1.97, 98], [1.97, 101.1], [1.97, 101.3], [0.37, 104.7]].map(([r, y]) => new THREE.Vector2(r, y)), 64), pod));
  const podL = new THREE.PointLight(0xff2a14, 0, 60, 1.8); podL.position.set(-8, 100, 12); R.rocket.add(podL);
  // the flight line: straight through the storm, fixed in the world, with ticks the rocket rides past
  const lineM = new THREE.MeshBasicMaterial({color: new THREE.Color(0.16, 1.0, 0.55), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false});
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2400, 8), lineM); e.glow.add(line);
  const ticks = []; for (let i = 0; i < 44; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 28), lineM); t.rotation.x = Math.PI / 2; e.glow.add(t); ticks.push(t); }
  const F1 = 118;
  return {draw: (f) => {
    const t = f / 30, y0 = 2600 + f * 7.2; R.place(y0, t);
    let th = 0, dx = 0;
    if (!brainsOk) { const u = clamp((f - 96) / 204); th = -0.11 * u * u * (1.4 - 0.4 * u); dx = 9 * u * u * u + 2 * u * u; }
    const CG = 48, x = dx + CG * Math.sin(th), y = y0 + CG - CG * Math.cos(th);
    R.rocket.position.set(x, y, 0); R.rocket.rotation.z = th;
    R.flame.position.set(x, y, 0); R.flame.rotation.z = th * 1.15; R.fire.position.set(x + 12 * Math.sin(th), y - 12, 0);
    xray.position.copy(R.rocket.position); xray.rotation.z = th; axis.position.copy(R.rocket.position); axis.rotation.z = th;
    cloud.flameA.value.set(x, y - 8, 0); cloud.flameB.value.set(x, y - 170, 0);
    const fl = brainsOk ? flashAt(f, F1) : flashAt(f, 40), pw = fl > 0.6 ? fl : fl * 0.3;
    // spacecraft: flickering red, the fault is here (or healthy, when the fault is below)
    const flick = (0.42 + 0.32 * Math.sin(f * 1.7) * Math.sin(f * 0.43) + (Math.floor(f / 4) * 7 % 5 === 0 ? 0.34 : 0)) * (1 + pw * 2);
    if (brainsOk) { xray.userData.set(0.1, -9, true); pod.uniforms.amt.value = flick * 0.7; podL.intensity = flick * 130; iuM.color.setRGB(0.14, 1.5, 0.78); boxM.color.setRGB(0.22, 2.6, 1.3); iuL.intensity = 150; }
    else {
      xray.userData.set(0.1, -9, false); pod.uniforms.col.value.setRGB(0.08, 1, 0.5); pod.uniforms.amt.value = 0.22; podL.color.setRGB(0.2, 1, 0.6); podL.intensity = 60;
      const die = 0.012 + 0.988 * (1 - ease((f - 34) / 16)), sput = f > 34 && f < 60 ? (Math.floor(f / 3) % 2 ? 1 : 0.2) : 1;
      iuM.color.setRGB(0.14 * die * sput, 1.5 * die * sput, 0.78 * die * sput); boxM.color.setRGB(0.22 * die * sput, 2.6 * die * sput, 1.3 * die * sput); iuL.intensity = 150 * die * sput;
    }
    // the world's line, and its ticks sliding past
    line.position.set(0, y0 + 40, 0);
    ticks.forEach((tk, i) => { tk.position.set(0, Math.floor(y0 / 18) * 18 + (i - 22) * 18 + 40, 0); });
    cloud.flame.value = 0.35;
    const k = ease(f / 300), sh = fl * 1.1, sx = Math.sin(f * 17.3) * sh, sy = Math.cos(f * 13.1) * sh;
    const my = brainsOk ? 0 : 6 * ease((f - 96) / 204);
    const c = brainsOk ? ease((f - 70) / 215) : 0.14 * k;   // Brains: the whole stack, then up to the ring and what sits above it
    camera.position.set(lerp(-68, -24, c) + sx, y0 + lerp(6, 76, c) + sy, lerp(94, 32, c));
    camera.lookAt(my * 0.5 + 3, y0 + lerp(52, 92, c), 0);
    camera.fov = lerp(62, 46, c); camera.up.set(0, 1, 0); camera.rotateZ(lerp(-0.13, -0.05, c));
    R.strike.intensity = pw * 6; R.strike.position.set(-300, y0 + 300, -180);
    cloud.flash.value = fl * 0.85; e.common.flash.value = fl * 0.8;
    cloud.boltA.value.set(-500, y0 + 260, -500); cloud.boltB.value.set(400, y0 - 300, -400);
    cloud.wind.value.set(f * 0.0009, -f * 0.0011 + 0.42, f * 0.0004);
    e.final.white.value = f === (brainsOk ? F1 : 40) ? 0.1 : 0;
  }};
});
export const StackBrains = stackPlate(true);
export const StackSwap = stackPlate(false);

// ------------------------------------------------------------------ what an abort would be: the escape tower pulls the capsule off the rocket
export const EscapeTower = () => useScene((e) => {
  const {scene, camera, cloud, renderer} = e, F0 = 30;
  renderer.localClippingEnabled = true;
  cloud.near_.value = 62; cloud.far_.value = 2400;
  e.final.bloom.value = 0.36;
  scene.add(new THREE.HemisphereLight(0x8fa0b4, 0x201a16, 0.3));
  const key = new THREE.DirectionalLight(0xb0c0d4, 1.0); key.position.set(-200, 60, -30); scene.add(key);
  const lowerPlane = new THREE.Plane(V(0, -1, 0), 0), upperPlane = new THREE.Plane(V(0, 1, 0), 0);
  const lower = makeSaturn(); scene.add(lower);
  const upper = lower.clone(true); scene.add(upper);
  lower.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.clippingPlanes = [lowerPlane]; } });
  upper.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.clippingPlanes = [upperPlane]; } });
  const CUT = 101.2;
  const smTop = new THREE.Mesh(new THREE.CircleGeometry(1.95, 48), std(0x77787a, 0.5, 0.7, {side: THREE.DoubleSide})); smTop.rotation.x = -Math.PI / 2; smTop.position.y = CUT - 0.01; lower.add(smTop);
  [[-0.6, 0.2], [0.5, -0.4], [0.1, 0.9]].forEach(([x, z]) => { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 12), std(0x2c2d30, 0.5, 0.7)); st.position.set(x, CUT + 0.07, z); lower.add(st); });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(4.6, 48, 12, 0, Math.PI * 2, Math.PI - 0.44, 0.44), std(0x7a6048, 0.82, 0.12, {side: THREE.DoubleSide})); shield.position.y = CUT + 0.42 + 4.6 * Math.cos(0.44) - 0.42; upper.add(shield);
  // the motor's four nozzles, canted out, at the top of the tower's lattice
  const NOZY = 107.65, CANT = 0.61, nozzleM = std(0x202124, 0.45, 0.85, {side: THREE.DoubleSide});
  const plumeMats = [], dirs = [];
  [0, 1, 2, 3].forEach((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2, dir = V(Math.cos(a) * Math.sin(CANT), -Math.cos(CANT), Math.sin(a) * Math.sin(CANT)); dirs.push(dir);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.42, 20, 1, true), nozzleM); n.position.set(dir.x * 0.42, NOZY + dir.y * 0.2, dir.z * 0.42); n.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().negate()); upper.add(n);
  });
  const plumeShader = (u) => new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: u,
    vertexShader: `out vec3 vN; out vec3 vV; out vec2 vU; void main(){ vU = uv; vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); gl_Position = projectionMatrix * m; }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vV; in vec2 vU; out vec4 o; uniform float time, power, speed, on; uniform vec3 col;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); vec2 w = vec2(1.0, 0.0); return mix(mix(h(i), h(i + w), f.x), mix(h(i + w.yx), h(i + 1.0), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
      void main(){ float along = 1.0 - vU.y; float side = pow(abs(dot(normalize(vN), normalize(vV))), 1.3);
        float t = fbm(vec2(vU.x * 14.0, vU.y * 6.0 + time * speed));
        float fade = smoothstep(0.0, 0.01, along) * pow(1.0 - along, 1.5);
        float soft = 1.0 - smoothstep(0.35, 1.0, along);
        o = vec4(col * side * fade * soft * (0.72 + 0.55 * t) * power * on, 1.0); }`});
  const capsuleGlow = new THREE.Group(); e.glow.add(capsuleGlow);
  dirs.forEach((dir) => {
    [[0.13, 1.5, 15, [1, 0.42, 0.13], 0.5, 3.1], [0.11, 0.75, 9, [1, 0.68, 0.3], 0.85, 4.0], [0.1, 0.32, 3.4, [1, 0.92, 0.72], 3.2, 5.0]].forEach(([rt, rb, len, col, pw, sp]) => {
      const u = {time: {value: 0}, col: {value: new THREE.Color(...col)}, power: {value: pw}, speed: {value: sp}, on: {value: 0}}; plumeMats.push(u);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, 32, 12, true), plumeShader(u)); c.frustumCulled = false; c.position.y = -len / 2;   // the narrow end at the nozzle
      const holder = new THREE.Group(); holder.position.set(dir.x * 0.66, NOZY + dir.y * 0.42, dir.z * 0.66); holder.quaternion.setFromUnitVectors(V(0, -1, 0), dir); holder.add(c); capsuleGlow.add(holder);
    });
  });
  const fire = new THREE.PointLight(0xfff0d8, 0, 240, 1.7); scene.add(fire); camera.near = 2;
    const hit = new THREE.DirectionalLight(0xfff0d8, 0); scene.add(hit, hit.target);
  // solid-rocket smoke: soft puffs left behind in the air, lit by the fire close to the motor, grey further on
  const [sc, sg] = canvas(256, 256), sr = rng(733);
  for (let i = 0; i < 110; i++) { const x = 128 + (sr() - 0.5) * 150, y = 128 + (sr() - 0.5) * 150, rad = 14 + sr() * 44, v = Math.floor(70 + sr() * 185) , gg = sg.createRadialGradient(x, y, 1, x, y, rad); gg.addColorStop(0, `rgba(${v},${v},${v},0.4)`); gg.addColorStop(1, `rgba(${v},${v},${v},0)`); sg.fillStyle = gg; sg.fillRect(0, 0, 256, 256); }
  const smokeT = tex(sc), smoke = [];
  for (let i = 0; i < 170; i++) { const m = new THREE.SpriteMaterial({map: smokeT, transparent: true, depthWrite: false, color: new THREE.Color(0.5, 0.5, 0.5), opacity: 0, rotation: sr() * 6.28}); const s = new THREE.Sprite(m); s.visible = false; s.renderOrder = -1; e.glow.add(s); smoke.push({s, m, i, a: sr() * 6.283, r: sr(), g: 0.75 + sr() * 0.6, ph: sr()}); }
  // the capsule's path: 10 g from ignition, leaning off to one side as the motor's thrust isn't quite through its centre
  const G = 98 / 900;                 // metres per frame squared
  const rise = (f) => { const t = Math.max(0, f - F0); return 0.5 * G * t * t; };
  const lean = (f) => -0.3 * ease((f - F0 - 12) / 80), side = (f) => -rise(f) * 0.1;
  const nozzleAt = (f) => { const th = lean(f); return V(side(f) + (NOZY - CUT) * Math.sin(th), 2500 + f * 7.2 + rise(f) + CUT + (NOZY - CUT) * Math.cos(th), 0); };
  return {draw: (f) => {
    const t = f / 30, y0 = 2500 + f * 7.2, h = rise(f), sx = side(f), th = lean(f), burn = clamp((f - F0) / 2);
    lower.position.y = y0; lowerPlane.constant = y0 + CUT;
    // the capsule leans about its base
    const cy = y0 + h; upper.position.set(sx - CUT * Math.sin(th), cy + CUT - CUT * Math.cos(th), 0); upper.rotation.z = -th;
    upperPlane.setFromNormalAndCoplanarPoint(V(0, 1, 0).applyAxisAngle(V(0, 0, 1), -th), V(sx, cy + CUT, 0));
    capsuleGlow.position.copy(upper.position); capsuleGlow.rotation.z = -th;
    plumeMats.forEach((u) => { u.time.value = t; u.on.value = burn * (0.92 + 0.08 * Math.sin(f * 2.9)); });
    const nozzle = nozzleAt(f);
    fire.position.copy(nozzle).add(V(0, -2, 0)); fire.intensity = burn * 140;
    hit.intensity = burn * 0.3; hit.position.copy(nozzle).add(V(-4, 2, 22)); hit.target.position.copy(nozzle).add(V(0, -6, 0));
    // the smoke stays where the air is, and we are flying: so from here it rushes down and away, a column that grows from ignition
    const SPEED = 3.4, LEN = 130, ran = (f - F0) * SPEED;
    smoke.forEach((p) => {
      const d = ((f * SPEED + p.ph * LEN + p.i * 1.1) % LEN) + 13;
      if (f < F0 || d > ran + 13) { p.s.visible = false; return; }
      const u = d / LEN, wide = 0.7 + d * 0.075, sz = (2.4 + d * 0.13) * p.g;
      p.s.visible = true; p.s.position.set(nozzle.x - d * 0.045 + Math.cos(p.a) * p.r * wide, nozzle.y - 2.5 - d, Math.sin(p.a) * p.r * wide); p.s.scale.set(sz, sz, 1);
      const near = Math.exp(-(d - 13) * 0.08), v = lerp(0.42, 1.25, near);
      p.m.color.setRGB(v, v * lerp(0.98, 0.7, near), v * lerp(0.96, 0.4, near));
      p.m.opacity = 0.62 * clamp((d - 13) / 4) * clamp((1 - u) * 2.5);
    });
    // the camera stays on the capsule, a beat behind it, as the stack drops away
    const lag = rise(f), kick = f >= F0 ? 0.55 * Math.exp(-(f - F0) * 0.05) : 0, cx = Math.sin(f * 7.3) * kick, cz = Math.cos(f * 5.1) * kick;
    const k = ease((f - F0) / 80);
    camera.position.set(lerp(-28, -24, k) + side(f) + cx, y0 + lag + lerp(92, 96, k) + cz, lerp(48, 48, k));
    camera.lookAt(side(f) * 0.98, y0 + lag + lerp(98, 100, k), 0);
    camera.fov = 30; camera.up.set(-0.04, 1, 0);
    cloud.flameA.value.copy(nozzle); cloud.flameB.value.copy(nozzle).add(V(0, -90, 0)); cloud.flame.value = f >= F0 ? 0.1 : 0.6;
    if (f < F0) { cloud.flameA.value.set(0, y0 - 8, 0); cloud.flameB.value.set(0, y0 - 170, 0); }
    cloud.flash.value = 0; e.common.flash.value = 0;
    cloud.boltA.value.copy(nozzle); cloud.boltB.value.copy(nozzle);
    cloud.wind.value.set(f * 0.0009, -f * 0.0011 + 0.75, f * 0.0004);
    e.final.white.value = f === F0 ? 0.08 : 0;
  }};
});

export const PLATES = {
  PowerDrop: [PowerDrop, 300],
  VoltGauge: [VoltGauge, 360],
  FuelReset: [FuelReset, 360],
  ShortSpark: [ShortSpark, 150],
  StackBrains: [StackBrains, 300],
  StackSwap: [StackSwap, 300],
  EscapeTower: [EscapeTower, 120],
};
