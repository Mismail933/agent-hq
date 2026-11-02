// Inside: the Command Module's main panel, its warning lights, the attitude ball, and a Houston telemetry screen. Rebuilt, not filmed: the videos say so.
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// the caution and warning lights of the Block II Command Module, Panel 2 (labels from the Apollo Operations Handbook)
const CW = [
  ['SM RCS A', 'CRYO PRESS', 'CM RCS 1', 'SPS PRESS', 'FC BUS DISCONNECT', 'MN BUS A UNDERVOLT', 'AC BUS 1 OVERLOAD', 'CMC', 'BMAG 1 TEMP', 'O2 FLOW HI', 'PITCH GMBL 1', 'FUEL CELL 1'],
  ['SM RCS B', 'GLYCOL TEMP LOW', 'CM RCS 2', 'SPS ROUGH ECO', 'AC BUS 1', 'MN BUS B UNDERVOLT', 'AC BUS 2 OVERLOAD', 'ISS', 'BMAG 2 TEMP', 'SUIT COMP', 'PITCH GMBL 2', 'FUEL CELL 2'],
  ['SM RCS C', 'H2 FLOW HI', 'C/W', 'CREW ALERT', 'AC BUS 2', 'CWS POWER', 'PYRO BUS', 'HGA', 'CO2 PP HI', 'YAW GMBL 1', 'YAW GMBL 2', 'FUEL CELL 3'],
];
// the order they lit, as Conrad read them out at T+1:12: three fuel cells, an AC bus, fuel cell disconnect, overloads, main buses
const WAVE = ['FUEL CELL 1', 'FUEL CELL 2', 'FUEL CELL 3', 'FC BUS DISCONNECT', 'AC BUS 1', 'AC BUS 2', 'AC BUS 1 OVERLOAD', 'AC BUS 2 OVERLOAD', 'MN BUS A UNDERVOLT', 'MN BUS B UNDERVOLT', 'C/W', 'SUIT COMP', 'CMC'];

const lamp = (label) => {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#17150f'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = label.split(' '), rows = [];
  let row = ''; for (const w of words) { if ((row + ' ' + w).trim().length > 10) { rows.push(row); row = w; } else row = (row + ' ' + w).trim(); } rows.push(row);
  g.font = '700 40px Arial, sans-serif';
  rows.forEach((r, i) => g.fillText(r, 128, 64 + (i - (rows.length - 1) / 2) * 44));
  return tex(c);
};

const panelSkin = () => {
  const [c, g] = canvas(4096, 2048), r = rng(77);
  g.fillStyle = '#3e4145'; g.fillRect(0, 0, 4096, 2048);
  for (let i = 0; i < 90; i++) { const a = 0.015 + r() * 0.03; g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(r() * 4096, r() * 2048, 300 + r() * 900, 2 + r() * 60); }       // wear
  g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 5;
  for (const [x, y, w, h] of [[80, 70, 1180, 1900], [1320, 70, 1220, 880], [1320, 1010, 1220, 960], [2600, 70, 1420, 1900]]) {
    g.strokeRect(x, y, w, h); g.fillStyle = '#35383b'; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    for (const [sx, sy] of [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 22], [x + w - 22, y + h - 22]]) { g.fillStyle = '#1d1e20'; g.beginPath(); g.arc(sx, sy, 9, 0, 7); g.fill(); g.strokeStyle = '#6a6c70'; g.lineWidth = 2; g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 5; }
  }
  // small stencilled labels: real ones sit by every switch
  g.fillStyle = 'rgba(232,232,224,0.8)'; g.textAlign = 'center'; g.font = '700 15px Arial, sans-serif';
  const LBL = ['SPS HE VLV', 'MN BUS TIE', 'BAT A', 'BAT B', 'FC 1', 'FC 2', 'FC 3', 'AC INV', 'PRPLNT', 'SECS ARM', 'ELS', 'CSM/LV SEP', 'CM/SM SEP', 'EDS AUTO', 'RCS CMD', 'SCS', 'CMC MODE', 'BMAG', 'FDAI', 'EVENT TIMER', 'SIG COND', 'S BAND', 'TAPE', 'CABIN FAN'];
  for (let k = 0; k < 150; k++) { const x = 170 + (k % 10) * 108 + (k % 3) * 2, y = 170 + Math.floor(k / 10) * 122; g.fillText(LBL[(k * 7) % LBL.length].slice(0, 9), x, y); }
  for (let k = 0; k < 70; k++) { const x = 2700 + (k % 10) * 130, y = 170 + Math.floor(k / 10) * 250; g.fillText(LBL[(k * 5) % LBL.length].slice(0, 10), x, y); }
  const t = tex(c); return t;
};

const dial = (label, seed) => {
  const [c, g] = canvas(256, 256), r = rng(seed);
  g.fillStyle = '#0d0d0e'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.strokeStyle = '#e8e8e0'; g.lineWidth = 3; g.fillStyle = '#e8e8e0'; g.font = '700 19px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.8 + i * 0.14), x = Math.cos(a), y = Math.sin(a); g.beginPath(); g.moveTo(128 + x * 92, 128 + y * 92); g.lineTo(128 + x * 112, 128 + y * 112); g.stroke(); if (i % 2 === 0) g.fillText(String(i * 10), 128 + x * 76, 128 + y * 76); }
  g.fillText(label, 128, 186);
  return tex(c);
};

export const makePanel = (e) => {
  const {scene, camera} = e, W = 8.2, H = 4.1;
  e.final.bloom.value = 0.75; e.final.exposure.value = 1.15;
  const skin = panelSkin();
  const body = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({map: skin, roughness: 0.72, metalness: 0.3}));
  scene.add(body);
  const flood = new THREE.PointLight(0xffe0bc, 8, 12, 1.4); flood.position.set(-0.6, 1.5, 2.6); scene.add(flood);
  const low = new THREE.AmbientLight(0x5a6068, 1.0); scene.add(low);
  const white = new THREE.DirectionalLight(0xe6eeff, 0); white.position.set(-5, 3, 3); scene.add(white);

  // toggle switches: real geometry so their shadows and highlights move with the camera
  const metal = new THREE.MeshStandardMaterial({color: 0xc8c8c4, roughness: 0.28, metalness: 0.95}), base = new THREE.MeshStandardMaterial({color: 0x1b1c1e, roughness: 0.5, metalness: 0.7});
  const baseG = new THREE.CylinderGeometry(0.05, 0.06, 0.04, 16), batG = new THREE.CapsuleGeometry(0.021, 0.12, 4, 10);
  const toggle = (x, y, down) => { const g = new THREE.Group(); const b = new THREE.Mesh(baseG, base); b.rotation.x = Math.PI / 2; g.add(b); const t = new THREE.Mesh(batG, metal); t.position.set(0, down ? -0.045 : 0.045, 0.085); t.rotation.x = down ? -0.5 : 0.5; g.add(t); g.position.set(x, y, 0.01); scene.add(g); };
  const px = (x) => (x / 4096 - 0.5) * W, py = (y) => (0.5 - y / 2048) * H;
  const r = rng(5);
  for (let k = 0; k < 150; k++) toggle(px(170 + (k % 10) * 108), py(220 + Math.floor(k / 10) * 122), r() > 0.55);
  for (let k = 0; k < 60; k++) toggle(px(2700 + (k % 10) * 130), py(1000 + Math.floor(k / 10) * 150), r() > 0.5);
  for (let k = 0; k < 96; k++) if (k < 8 || k > 23) toggle(px(1400 + (k % 12) * 92), py(1060 + Math.floor(k / 12) * 118), r() > 0.5);
  // gauges
  const bez = new THREE.TorusGeometry(0.2, 0.022, 10, 40), glassM = new THREE.MeshStandardMaterial({color: 0x0a0a0a, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.25});
  const needles = [];
  ['BAT VOLTS', 'DC VOLTS', 'DC AMPS', 'AC VOLTS', 'FC 1 AMPS', 'FC 2 AMPS', 'FC 3 AMPS', 'O2 PRESS'].forEach((l, i) => {
    const x = px(2800 + (i % 4) * 340), y = py(240 + Math.floor(i / 4) * 330), g = new THREE.Group(); g.position.set(x, y, 0.012);
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshStandardMaterial({map: dial(l, i + 9), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.05, emissiveMap: null})); g.add(d);
    g.add(new THREE.Mesh(bez, base));
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.16, 0.004), new THREE.MeshBasicMaterial({color: 0xffffff})); n.position.z = 0.015; const pivot = new THREE.Group(); n.position.y = 0.08; pivot.add(n); pivot.position.z = 0.012; g.add(pivot); needles.push({pivot, i});
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), glassM); glass.position.z = 0.02; g.add(glass);
    scene.add(g);
  });

  ['SPS PC', 'SM RCS', 'CM RCS', 'CRYO O2', 'CRYO H2', 'ECS', 'S BAND', 'PWR'].forEach((l, i) => {
    const x = px(2010 + (i % 2) * 300), y = py(230 + Math.floor(i / 2) * 200), g = new THREE.Group(); g.position.set(x, y, 0.012);
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.17, 36), new THREE.MeshStandardMaterial({map: dial(l, i + 31), roughness: 0.5})); g.add(d);
    const bz = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 36), base); g.add(bz);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.13, 0.004), new THREE.MeshBasicMaterial({color: 0xffffff})); n.position.set(0, 0.065, 0.012); const pv = new THREE.Group(); pv.add(n); pv.position.z = 0.012; pv.rotation.z = 0.2 - i * 0.26; g.add(pv); scene.add(g);
  });
  // the lights: dark glass with its label, burning amber when lit
  const lamps = {}, cellW = 0.232, cellH = 0.128, ox = px(1330), oy = py(120);
  CW.forEach((col, ci) => col.forEach((label, ri) => {
    const t = lamp(label);
    const m = new THREE.MeshStandardMaterial({color: 0x0c0b09, roughness: 0.75, metalness: 0, emissive: 0xff9a1c, emissiveMap: t, emissiveIntensity: 0.02});
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cellW * 0.93, cellH * 0.9), m);
    mesh.position.set(ox + ci * cellW * 1.05 + cellW / 2, oy - ri * cellH * 1.05 - cellH / 2, 0.006); scene.add(mesh); lamps[label] = m;
  }));
  // master alarm
  const alarmT = lamp('MASTER ALARM');
  const alarm = new THREE.MeshStandardMaterial({color: 0x100404, roughness: 0.25, emissive: 0xff1208, emissiveMap: alarmT, emissiveIntensity: 0.02});
  [[px(1560), py(1010)], [px(2290), py(1010)]].forEach(([x, y]) => { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.2), alarm); a.position.set(x, y, 0.008); scene.add(a); });

  const F0 = 38;                  // the white light
  const flashOf = (f) => { const d = f - F0; if (d < 0) return 0; return Math.max(d <= 2 ? 1 : 0, d >= 4 && d <= 6 ? 0.6 : 0, d > 6 ? 0.6 * Math.exp(-(d - 6) * 0.5) : 0); };
  return {draw: (f) => {
    const fl = flashOf(f), shake = 0.006 + (f >= F0 ? 0.016 * Math.exp(-(f - F0) * 0.03) : 0);
    const sx = Math.sin(f * 2.13) * Math.cos(f * 0.77) * shake, sy = Math.cos(f * 1.71) * Math.sin(f * 1.17) * shake;
    const k = ease((f - 42) / 150);
    camera.position.set(lerp(-2.1, -0.45, k) + sx, lerp(0.55, 0.85, k) + sy, lerp(3.2, 1.95, k));
    camera.lookAt(lerp(-1.35, -0.98, k) + sx * 0.5, lerp(0.6, 0.98, k) + sy * 0.5, 0);
    camera.fov = 44; camera.up.set(lerp(0.05, -0.06, k), 1, 0);
    white.intensity = fl * 7; flood.intensity = f < F0 ? 8 : 8 * (0.72 + 0.28 * Math.abs(Math.sin(f * 0.6)));
    WAVE.forEach((n, i) => { const on = F0 + 4 + i * 3.4, m = lamps[n], a = clamp((f - on) / 2); if (m) m.emissiveIntensity = 0.02 + a * (5.6 + Math.sin(f * 0.9 + i) * 0.3); });
    alarm.emissiveIntensity = f >= F0 + 3 ? (Math.floor((f - F0) / 9) % 2 === 0 ? 7 : 0.6) : 0.02;
    needles.forEach(({pivot, i}) => { const a = f < F0 ? 0.5 : 0.5 + (i < 3 ? -1.2 : -1.8) * ease((f - F0) / 4) + Math.sin(f * 1.3 + i) * 0.03 + (i < 3 ? 0.5 * ease((f - F0 - 6) / 6) : 0); pivot.rotation.z = a; });
    e.final.white.value = fl > 0.95 ? 0.22 : 0;
  }};
};

// the 8-ball: black below, white above, the marks of a real attitude indicator; steady, then the second strike and it goes
const ballSkin = () => {
  const [c, g] = canvas(4096, 2048);
  g.fillStyle = '#c9c7bd'; g.fillRect(0, 0, 4096, 1024); g.fillStyle = '#17181a'; g.fillRect(0, 1024, 4096, 1024);
  for (let lat = -80; lat <= 80; lat += 10) { const y = 1024 - (lat / 90) * 1024; g.strokeStyle = lat < 0 ? 'rgba(235,235,225,0.75)' : 'rgba(10,10,10,0.8)'; g.lineWidth = lat % 30 === 0 ? 7 : 3; g.beginPath(); g.moveTo(0, y); g.lineTo(4096, y); g.stroke(); }
  for (let lon = 0; lon < 360; lon += 10) { const x = (lon / 360) * 4096; for (const up of [0, 1]) { g.strokeStyle = up ? 'rgba(10,10,10,0.8)' : 'rgba(235,235,225,0.75)'; g.lineWidth = lon % 30 === 0 ? 7 : 3; g.beginPath(); g.moveTo(x, up ? 90 : 1024); g.lineTo(x, up ? 1024 : 1958); g.stroke(); } }
  g.fillStyle = '#d94a1e'; g.fillRect(0, 1016, 4096, 16);
  g.font = '700 74px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let lon = 0; lon < 360; lon += 30) { const x = (lon / 360) * 4096, lab = String(lon === 0 ? 0 : lon).padStart(3, '0'); g.fillStyle = '#0b0b0b'; g.fillText(lab, x + 46, 960); g.fillText(lab, x + 46, 520); g.fillStyle = '#eee'; g.fillText(lab, x + 46, 1090); g.fillText(lab, x + 46, 1530); }
  return tex(c);
};

export const makeBall = (e) => {
  const {scene, camera} = e;
  e.final.bloom.value = 0.5; e.final.exposure.value = 1.2; e.final.vign.value = 1.1;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshStandardMaterial({map: ballSkin(), roughness: 0.34, metalness: 0.05})); scene.add(ball);
  const dark = new THREE.MeshStandardMaterial({color: 0x17181a, roughness: 0.55, metalness: 0.6});
  // the housing: a deep ring and a square face plate with the opening cut out
  const face = new THREE.Shape(); face.moveTo(-3, -3); face.lineTo(3, -3); face.lineTo(3, 3); face.lineTo(-3, 3); face.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.92, 0, Math.PI * 2, true); face.holes.push(hole);
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(face, {depth: 0.05, bevelEnabled: false, curveSegments: 96}), dark); plate.position.z = 0.98; scene.add(plate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.04, 16, 128), new THREE.MeshStandardMaterial({color: 0x5a5c60, roughness: 0.3, metalness: 0.95})); ring.position.z = 1.04; scene.add(ring);
  // the roll marks round the opening, and the yellow error needles and aircraft symbol in front of the ball
  for (let a = 0; a < 360; a += 10) { const big = a % 30 === 0, m = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.022 : 0.011, big ? 0.085 : 0.05, 0.01), new THREE.MeshBasicMaterial({color: 0xe6e6da})); const R = 1.02; m.position.set(Math.sin((a * Math.PI) / 180) * R, Math.cos((a * Math.PI) / 180) * R, 1.04); m.rotation.z = (-a * Math.PI) / 180; scene.add(m); }
  const yellow = new THREE.MeshStandardMaterial({color: 0xe8b81e, emissive: 0x6b5208, emissiveIntensity: 0.9, roughness: 0.4});
  const pitchN = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.018, 0.012), yellow), yawN = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.5, 0.012), yellow), rollN = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.012), yellow);
  pitchN.position.z = yawN.position.z = 1.02; rollN.position.set(0, 0.8, 1.02); scene.add(pitchN, yawN, rollN);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.026, 0.012), new THREE.MeshBasicMaterial({color: 0xff6a18})); wing.position.z = 1.03; scene.add(wing);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.95, 96), new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.09, envMapIntensity: 1})); glass.position.z = 1.05; scene.add(glass);
  scene.add(new THREE.AmbientLight(0x5a5f68, 0.45));
  const key = new THREE.SpotLight(0xffe6c8, 16, 12, 0.6, 0.6, 1.4); key.position.set(-1.6, 2.2, 4.2); key.target.position.set(0, 0, 0.8); scene.add(key, key.target);
  const alarm = new THREE.PointLight(0xff8a20, 0, 6, 1.5); alarm.position.set(1.8, -1.4, 2.2); scene.add(alarm);
  const white = new THREE.DirectionalLight(0xe6eeff, 0); white.position.set(-4, 2, 5); scene.add(white);
  const F0 = 30, base = new THREE.Euler(0.16, -0.35, 0.05);
  const q = new THREE.Quaternion(), qb = new THREE.Quaternion(), ax1 = new THREE.Vector3(0.4, 1, 0.2).normalize(), ax2 = new THREE.Vector3(1, -0.25, 0.5).normalize(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  return {draw: (f) => {
    const d = Math.max(0, f - F0);
    // a hard kick, a fast spin that never quite settles and wanders: closed form, so any frame stands on its own
    const a1 = d * 0.17 + 2.1 * (1 - Math.exp(-d * 0.1)), a2 = d * 0.06 + Math.sin(d * 0.045) * 1.15;
    const rock = f < F0 ? Math.sin(f * 0.11) * 0.008 : 0;
    qb.setFromEuler(new THREE.Euler(base.x + rock, base.y, base.z)); q1.setFromAxisAngle(ax1, a1); q2.setFromAxisAngle(ax2, a2);
    q.copy(qb).multiply(q1).multiply(q2); ball.quaternion.copy(q);
    const fl = d === 0 && f < F0 ? 0 : f >= F0 ? (d <= 2 ? 1 : 0.5 * Math.exp(-(d - 2) * 0.5)) : 0;
    white.intensity = fl * 6; alarm.intensity = f >= F0 ? (Math.floor(d / 9) % 2 === 0 ? 7 : 2) : 0;
    const sh = f >= F0 ? 0.03 * Math.exp(-d * 0.05) + 0.005 : 0.003;
    const push = ease(f / 165);
    camera.position.set(Math.sin(f * 2.1) * sh + lerp(0.22, 0.06, push), Math.cos(f * 1.6) * sh + 0.05, lerp(4.6, 3.5, push));
    camera.lookAt(0.02, 0.02, 0.9); camera.fov = 34; camera.up.set(0, 1, 0);
    pitchN.position.y = f >= F0 ? Math.sin(d * 0.21) * 0.5 : 0; yawN.position.x = f >= F0 ? Math.cos(d * 0.17) * 0.5 : 0;
    e.final.white.value = f === F0 ? 0.2 : 0;
  }};
};

// a Houston telemetry screen: a phosphor tube with a little bulge, scan lines, the numbers redrawn each frame
const NAMES = ['FC1 AMPS', 'FC2 AMPS', 'FC3 AMPS', 'MN BUS A V', 'MN BUS B V', 'AC BUS 1 V', 'AC BUS 2 V', 'BAT A AMPS', 'BAT B AMPS', 'O2 TK1 PSI', 'H2 TK1 PSI', 'FC1 TEMP', 'FC2 TEMP', 'CAB PRESS', 'SUIT PRESS', 'GLY TEMP'];
const GOOD = [24.6, 25.1, 24.8, 28.4, 28.3, 115.2, 115.0, 0.0, 0.0, 901, 239, 159, 161, 14.7, 14.6, 45.2];
const SQUIRRELLY = [6.7, 12.3, 3.1, 19.4, 0.9, 7.7, 14.2, 2.6, 11.8, 31.5, 4.4, 8.2, 16.9, 1.3, 22.1, 9.6];

export const makeScreen = (e) => {
  const {scene, camera} = e, [c, g] = canvas(1536, 1152), map = tex(c), F0 = 42;
  e.final.bloom.value = 0.9; e.final.exposure.value = 1.0; e.final.vign.value = 0.9;
  const paint = (f) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 1536, 1152);
    const r = rng(1 + (f - (f % 3)) * 37), bad = f >= F0, hit = f >= F0 && f < F0 + 8;
    g.fillStyle = '#fff'; g.textBaseline = 'top'; g.font = '700 54px "Courier New", monospace';
    g.fillText('CSM  EPS / ECS', 80, 56); g.font = '700 42px "Courier New", monospace';
    g.fillText('GET  ' + (bad ? '??:??:??' : '00:00:' + String(Math.floor(30 + f / 30)).padStart(2, '0')), 960, 62);
    g.fillRect(70, 130, 1396, 5);
    g.font = '700 50px "Courier New", monospace';
    NAMES.forEach((n, i) => {
      const y = 158 + i * 58, jit = bad ? (r() - 0.5) * 2 : 0;
      g.globalAlpha = bad && r() < 0.05 ? 0.25 : 1;
      g.fillText(n, 86, y);
      let v;
      if (!bad) v = (GOOD[i] + Math.sin(f * 0.3 + i) * 0.04).toFixed(i >= 9 && i <= 12 ? 0 : 1);
      else if (i === 0) v = '6.7'; else if (i === 1) v = '12.3';
      else { const base = SQUIRRELLY[i] * (1 + Math.floor(f / 11 + i) % 3 * 0.37 * (i % 2 ? 1 : -0.5)); v = base.toFixed(1); }
      g.fillText(String(v).padStart(7, ' '), 760 + jit * 3, y);
      if (bad) g.fillText((r() > 0.5 ? 'M' : 'S') + (r() > 0.6 ? '*' : ' '), 1240, y);
      g.globalAlpha = 1;
    });
    if (hit) for (let i = 0; i < 16; i++) { g.fillStyle = '#fff'; g.fillRect(0, r() * 1152, 1536, 2 + r() * 6); }
    map.needsUpdate = true;
  };
  const tube = new THREE.PlaneGeometry(3.24, 2.4, 48, 36); { const ps = tube.attributes.position; for (let i = 0; i < ps.count; i++) { const x = ps.getX(i), y = ps.getY(i); ps.setZ(i, 0.2 - (x * x + y * y) * 0.05); } tube.computeVertexNormals(); }
  // a phosphor: the picture, lines across it, faint glass
  const mat = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, uniforms: {t: {value: map}, gain: {value: 1}, frame: {value: 0}},
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float gain, frame;
      void main(){ vec2 u = vUv; float d = 1.2 / 1536.0;
        vec3 c = texture(t, u).rgb * 0.6 + texture(t, u + vec2(d, 0.0)).rgb * 0.2 + texture(t, u - vec2(d, 0.0)).rgb * 0.2;
        float line = 0.76 + 0.24 * sin(u.y * 3.14159 * 1152.0 * 0.5);
        vec3 ph = vec3(0.62, 1.0, 0.72) * c.r * line * gain * 2.6;
        vec2 q = abs(u - 0.5) * 2.0; float sq = pow(pow(q.x, 5.0) + pow(q.y, 5.0), 0.2); float edge = smoothstep(1.02, 0.94, sq);
        ph += vec3(0.012, 0.02, 0.016) * edge;
        float roll = 0.03 * sin(u.y * 9.0 - frame * 0.4);
        o = vec4(ph * edge * (1.0 + roll), 1.0); }`});
  const m = new THREE.Mesh(tube, mat); m.position.z = -0.12; scene.add(m);
  // the console round the tube
  const shape = new THREE.Shape(); shape.moveTo(-6, -5); shape.lineTo(6, -5); shape.lineTo(6, 5); shape.lineTo(-6, 5); shape.closePath();
  const hole = new THREE.Path(); hole.moveTo(-1.58, -1.17); hole.lineTo(1.58, -1.17); hole.lineTo(1.58, 1.17); hole.lineTo(-1.58, 1.17); hole.closePath(); shape.holes.push(hole);
  const face = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: 0.05, bevelEnabled: false}), new THREE.MeshStandardMaterial({color: 0x4a4e52, roughness: 0.62, metalness: 0.3})); face.position.z = 0.02; scene.add(face);
  const lit = new THREE.PointLight(0x9fd8b0, 1.2, 7, 1.5); lit.position.set(0, 0, 1.4); scene.add(lit);
  scene.add(new THREE.AmbientLight(0x34383c, 0.5));
  return {draw: (f) => {
    paint(f); mat.uniforms.frame.value = f;
    mat.uniforms.gain.value = f >= F0 && f < F0 + 6 ? 1.8 : f >= F0 ? 0.92 + 0.08 * Math.sin(f * 1.7) : 1;
    const k = ease(f / 165);
    camera.position.set(lerp(-0.42, 0.28, k), lerp(0.1, -0.05, k), lerp(4.6, 3.1, k)); camera.lookAt(lerp(-0.15, 0.2, k), 0, 0); camera.fov = 36; camera.up.set(0, 1, 0);
  }};
};
