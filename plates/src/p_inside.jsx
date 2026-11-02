// The "inside" plates for the full Apollo 12 video. Rebuilt, not filmed. Real shadows and reflections, so they sit next to Ball, Panel and StrikeSpike.
// Panel 3's layout and labels are traced from the Apollo 12 Flight Journal's scan of the Main Display Console (apollojournals.org/afj/ap12fj/pics/panel-03.png).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {useScene, indoors, clamp, ease, lerp} from './plates';
import {makeSaturn} from './saturn';

const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const texOf = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t; };
const std = (color, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({color, roughness, metalness, ...extra});
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mat4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V3(sx, sy, sz));
const stamp = (parent, geo, mat, list, cast = true) => { const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((q, i) => m.setMatrixAt(i, q)); m.instanceMatrix.needsUpdate = true; m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; parent.add(m); return m; };
const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
const shadows = (e) => { e.renderer.shadowMap.enabled = true; e.renderer.shadowMap.type = THREE.PCFSoftShadowMap; };
const spot = (parent, color, intensity, pos, target, angle, penumbra, decay, dist, shadow = 0, near = 0.2, far = 30, bias = -0.0004, nb = 0.006) => {
  const l = new THREE.SpotLight(color, intensity, dist, angle, penumbra, decay); l.position.copy(pos); l.target.position.copy(target); parent.add(l, l.target);
  if (shadow) { l.castShadow = true; l.shadow.mapSize.set(shadow, shadow); l.shadow.camera.near = near; l.shadow.camera.far = far; l.shadow.bias = bias; l.shadow.normalBias = nb; l.shadow.radius = 3; }
  return l;
};
// what the metal reflects: a dark cabin with a few soft bright shapes, so chrome and glass read as chrome and glass
const envOf = (e, shapes, bg = 0x020304) => {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  for (const [col, gain, x, y, z, w, h] of shapes) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(gain), side: THREE.DoubleSide})); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); }
  const pm = new THREE.PMREMGenerator(e.renderer), rt = pm.fromScene(s, 0.035, 0.1, 100); pm.dispose();
  return rt.texture;
};
const noiseCanvas = (w, h, base, seed, n = 2400, a = 0.05) => { const [c, g] = canvasOf(w, h), r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const b = r() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${b},${b},${b},${r() * a})`; const s = 1 + r() * 6; g.fillRect(r() * w, r() * h, s * (1 + r() * 8), s); } return [c, g]; };

// a toggle switch: nut, collar and bat lever; the lever stands on its pivot, a = the tilt towards +y in radians
const LEVER = () => new THREE.LatheGeometry([[0, 0], [0.028, 0], [0.027, 0.04], [0.021, 0.12], [0.025, 0.19], [0.036, 0.255], [0.037, 0.285], [0.022, 0.302], [0, 0.308]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
const leverQ = (x, y, z, a) => mat4(x, y, z, Math.PI / 2 - a, 0, 0);

// ---------------------------------------------------------------- PanelThree
// From the right-hand seat, looking up at the bottom of Panel 3. A slow push in to the POWER SCE switch; at frame THROW (6.5 s) it goes from NORM, through OFF, to AUX.
const TOGGLE_ROWS = [
  // [strip x0, x1, y, cells]  in the scan's pixels
  [155, 290, 1293, [180, 222, 264]], [395, 690, 1293, [416, 458, 499, 541, 583, 625, 664]], [722, 895, 1293, [746, 788, 830, 872]],
  [155, 240, 1195, [180, 218]], [395, 620, 1195, [417, 465, 514, 555, 597]], [722, 895, 1195, [746, 788, 830, 872]],
  [155, 290, 1100, [180, 220, 262]], [300, 635, 1100, [322, 363, 405, 455, 497, 552, 607]], [722, 890, 1100, [747, 807, 868]],
  [155, 295, 1005, [180, 220, 262]], [318, 695, 1005, [338, 380, 423, 464, 507, 545, 590, 635, 668]],
  [375, 690, 870, [398, 438, 478, 520, 568, 618, 667]], [375, 505, 755, [400, 440, 482]], [375, 505, 665, [400, 440, 482]],
];
const LABELS = [
  // bottom row
  [180, 1239, 'FC REACS'], [180, 1250, 'VALVES'], [180, 1261, 'NORM'], [222, 1250, 'H2 PURGE'], [222, 1261, 'LINE HTR'], [180, 1327, 'LATCH'], [222, 1327, 'OFF'],
  [325, 1250, 'SQUELCH B'], [418, 1261, 'PCM/ANLG'], [458, 1261, 'RECORD'], [500, 1261, 'FWD'], [415, 1327, 'LM PCM'], [458, 1327, 'PLAY'], [500, 1327, 'REWIND'],
  [541, 1251, 'SCE'], [586, 1251, 'PMP'], [562, 1262, 'NORM'], [562, 1327, 'AUX'], [625, 1235, 'PCM'], [625, 1245, 'BIT RATE'], [625, 1256, 'HIGH'], [627, 1327, 'LOW'],
  [788, 1278, 'AC BUS 2'], [746, 1262, '1'], [788, 1262, '2'], [830, 1262, '3'], [790, 1327, '-OFF-'], [873, 1272, 'RESET'], [873, 1327, 'ON'],
  // the row above
  [200, 1146, 'S BAND ANTENNA'], [180, 1164, 'OMNI A'], [218, 1164, 'OMNI'], [180, 1228, 'C'], [220, 1228, 'HI GAIN'], [325, 1154, 'SQUELCH A'],
  [418, 1157, 'A'], [465, 1157, 'B'], [441, 1167, 'DUPLEX'], [515, 1157, 'RCV ONLY'], [515, 1168, 'B DATA'], [557, 1157, 'VHF BCN'], [557, 1168, 'ON'], [597, 1157, 'VHF'], [597, 1168, 'RANGING'],
  [441, 1228, 'SIMPLEX'], [515, 1228, 'A'], [558, 1228, 'OFF'], [598, 1228, 'OFF'], [788, 1156, 'AC BUS 1'], [746, 1168, '1'], [788, 1168, '2'], [830, 1168, '3'], [790, 1232, '-OFF-'], [877, 1166, 'RESET'], [873, 1232, 'OFF'],
  // S band row
  [180, 1057, 'XPNDR'], [180, 1067, 'PRIM'], [220, 1067, 'PRIM'], [262, 1067, 'HIGH'], [180, 1133, 'SEC'], [222, 1133, 'SEC'], [262, 1133, 'LOW'], [322, 1067, 'VOICE'], [364, 1067, 'PCM'], [407, 1067, 'RANGING'],
  [322, 1133, 'RELAY'], [365, 1133, 'KEY'], [407, 1133, 'OFF'], [456, 1067, 'TAPE'], [505, 1067, 'TV'], [456, 1133, 'DN VOICE BU'], [507, 1133, 'SCI'], [552, 1067, 'DATA'], [552, 1133, 'UP VOICE BU'], [608, 1058, 'CMD'], [608, 1067, 'RESET'], [608, 1133, 'OFF'],
  [684, 1066, 'PWR AMPL'], [684, 1116, 'TAPE MOTION'], [747, 1067, 'MN A'], [807, 1067, 'MN B'], [868, 1067, 'MN A'], [747, 1133, 'OFF'], [807, 1133, 'OFF'], [868, 1133, 'MN B'], [905, 1100, 'OFF'],
  [946, 1218, 'AC VOLTS'], [975, 1215, 'AC INDICATOR'], [775, 912, 'DC INDICATORS'], [925, 912, 'BATTERY CHARGE'],
  // the rows above that
  [180, 974, 'AUTO'], [262, 974, 'A/B'], [180, 1037, 'ON'], [262, 1037, 'A'], [338, 974, 'He'], [380, 974, '1'], [423, 974, '2'], [464, 974, '3'], [545, 974, '1'], [590, 974, '2'], [635, 974, '3'], [668, 974, 'RESET'], [338, 1037, 'N2 B'], [423, 1037, '-OFF-'], [590, 1037, '-OFF-'], [668, 1037, 'OFF'],
  [438, 920, 'FUEL CELL REACTANTS'], [570, 920, 'MAIN BUS B'], [438, 838, 'H2'], [478, 838, 'O2'], [568, 838, '2'], [618, 838, '3'], [667, 838, 'RESET'], [440, 722, 'NORMAL'], [440, 790, 'OFF'], [440, 690, 'EMER BYPASS'], [440, 702, 'FUEL CELL HEATERS'], [440, 636, 'FUEL CELL RADIATORS'], [628, 642, 'FUEL CELL INDICATOR'],
];
const BRACKETS = [[395, 495, 1250, 'TAPE RECORDER'], [530, 600, 1241, 'POWER'], [340, 515, 1147, 'VHF AM'], [158, 420, 1048, 'S BAND NORMAL'], [205, 275, 1057, 'PWR AMPL'], [322, 407, 1057, 'MODE'], [440, 515, 1048, 'S BAND AUX'], [538, 620, 1048, 'UP TLM'], [722, 890, 1048, 'AC INVERTER']];
const P3 = {x: (x) => (x - 600) / 100, y: (y) => (1250 - y) / 100};

export const PanelThree = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e, THROW = 195;
  camera.near = 0.04; camera.far = 200;
  e.final.bloom.value = 0.3; e.final.exposure.value = 1.35; e.final.vign.value = 0.95; e.final.grain.value = 0.016;
  scene.environment = envOf(e, [[0xffb878, 3.2, -6, 1, 4, 5, 6], [0xc4d4f4, 2.4, 3, 6, 5, 7, 3], [0xc4c8d0, 1.1, 2, -6, 6, 9, 3]], 0x0a0b0d); scene.environmentIntensity = 1.25;
  // the paint: scan coordinates, 4.5 texels per scan pixel; the labels near the switch go on a sharper layer of their own
  const X0 = 130, Y0 = 620, W = 910, H = 760, S = 4096 / W, TW = 4096, TH = Math.round(H * S);
  const [pc, pg] = noiseCanvas(TW, TH, '#3f4246', 77, 5000, 0.03), [bc, bg] = canvasOf(2048, Math.round(TH / 2));
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, 2048, bc.height);
  const pX = (x) => (x - X0) * S, pY = (y) => (y - Y0) * S;
  const outline = (x0, y0, x1, y1, r = 18) => { for (const [g, k] of [[pg, 1], [bg, 0.5]]) { g.beginPath(); g.roundRect(pX(x0) * k, pY(y0) * k, (x1 - x0) * S * k, (y1 - y0) * S * k, r * S * k); } pg.strokeStyle = 'rgba(8,8,9,0.85)'; pg.lineWidth = 7; pg.stroke(); pg.strokeStyle = 'rgba(255,255,255,0.05)'; pg.lineWidth = 3; pg.stroke(); bg.strokeStyle = '#333'; bg.lineWidth = 5; bg.stroke(); };
  [[145, 885, 1012, 1352, 22], [145, 625, 685, 880, 22], [375, 640, 515, 770, 12], [180, 660, 360, 880, 12]].forEach(([a, b, c, d, r]) => outline(a, b, c, d, r));
  const [lc, lg] = canvasOf(4080, 2460), LX0 = 380, LX1 = 720, LY0 = 1140, LY1 = 1345, LS = 12;
  const inHi = (x, y) => x > LX0 + 22 && x < LX1 - 22 && y > LY0 + 6 && y < LY1 - 6;
  const write = (g, x, y, t, k, size = 9.4) => { g.font = `700 ${size * k}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = `${0.35 * k}px`; g.fillStyle = 'rgba(232,231,222,0.93)'; g.fillText(t, x, y); };
  for (const [x, y, t] of LABELS) { if (inHi(x, y)) write(lg, (x - LX0) * LS, (y - LY0) * LS, t, LS); else write(pg, pX(x), pY(y), t, S); }
  for (const [x0, x1, y, t] of BRACKETS) {
    const hi = inHi((x0 + x1) / 2, y) && x0 > LX0 && x1 < LX1, g = hi ? lg : pg, k = hi ? LS : S, fx = (x) => (hi ? (x - LX0) * LS : pX(x)), fy = (v) => (hi ? (v - LY0) * LS : pY(v));
    g.font = `700 ${9.4 * k}px Arial, sans-serif`; const tw = g.measureText(t).width / k / 2 + 3, mid = (x0 + x1) / 2;
    g.strokeStyle = 'rgba(232,231,222,0.9)'; g.lineWidth = 0.8 * k; g.beginPath(); g.moveTo(fx(x0), fy(y + 5)); g.lineTo(fx(x0), fy(y)); g.lineTo(fx(mid - tw), fy(y)); g.moveTo(fx(mid + tw), fy(y)); g.lineTo(fx(x1), fy(y)); g.lineTo(fx(x1), fy(y + 5)); g.stroke();
    write(g, fx(mid), fy(y), t, k);
  }
  const skin = texOf(pc), panelW = W / 100, panelH = H / 100, cx = P3.x(X0 + W / 2), cy = P3.y(Y0 + H / 2);
  add(scene, new THREE.PlaneGeometry(panelW, panelH), std(0xffffff, 0.62, 0.25, {map: skin, bumpMap: texOf(bc, false), bumpScale: 0.6}), cx, cy, 0, 0, 0, 0, false);
  const labels = new THREE.Mesh(new THREE.PlaneGeometry((LX1 - LX0) / 100, (LY1 - LY0) / 100), new THREE.MeshStandardMaterial({map: texOf(lc), transparent: true, roughness: 0.7, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2}));
  labels.position.set(P3.x((LX0 + LX1) / 2), P3.y((LY0 + LY1) / 2), 0.0015); labels.renderOrder = 2; labels.receiveShadow = true; scene.add(labels);
  add(scene, new THREE.BoxGeometry(panelW + 8, 4, 2.4), std(0x0c0d0e, 0.8, 0.2), cx, P3.y(1380) - 2, -1.2, 0, 0, 0, false);       // what the panel is mounted in

  // the switch rows: strips, guards, wells, nuts, collars, levers
  const strips = [], wells = [], nuts = [], collars = [], levers = [], guards = [], r = rng(5);
  const stripG = new Map();
  let sceRow = null;
  for (const [x0, x1, y, cells] of TOGGLE_ROWS) {
    const w = (x1 - x0) / 100, key = w.toFixed(2);
    if (!stripG.has(key)) stripG.set(key, new RoundedBoxGeometry(w, 0.52, 0.035, 3, 0.014));
    strips.push([stripG.get(key), P3.x((x0 + x1) / 2), P3.y(y)]);
    const edges = [x0 + 3, ...cells.slice(1).map((c, i) => (c + cells[i]) / 2), x1 - 3];
    edges.forEach((g) => guards.push(mat4(P3.x(g), P3.y(y), 0.1)));
    cells.forEach((c) => {
      const X = P3.x(c), Y = P3.y(y);
      wells.push(mat4(X, Y, 0.036, Math.PI / 2)); nuts.push(mat4(X, Y, 0.055, Math.PI / 2)); collars.push(mat4(X, Y, 0.088, Math.PI / 2));
      if (c === 541 && y === 1293) { sceRow = {X, Y}; return; }
      const pick = r(), a = pick > 0.3 ? 0.5 : pick > 0.1 ? -0.5 : 0;
      levers.push(leverQ(X, Y, 0.1, (c === 583 && y === 1293) ? 0.5 : a));
    });
  }
  const paint = std(0x1d1e21, 0.5, 0.45), black = std(0x0d0d0e, 0.4, 0.4), steel = std(0xc8c8c2, 0.34, 0.95), dull = std(0x8d8e8c, 0.42, 0.95), chrome = std(0xdcdcd6, 0.25, 0.95);
  for (const [g, x, y] of strips) add(scene, g, paint, x, y, 0.016);
  stamp(scene, new THREE.CylinderGeometry(0.15, 0.15, 0.008, 40), black, wells, false);
  stamp(scene, new THREE.CylinderGeometry(0.098, 0.098, 0.035, 6), dull, nuts);
  stamp(scene, new THREE.CylinderGeometry(0.058, 0.076, 0.045, 28), steel, collars);
  stamp(scene, new RoundedBoxGeometry(0.046, 0.5, 0.15, 3, 0.02), paint, guards);
  const leverG = LEVER(); stamp(scene, leverG, chrome, levers);
  const sce = add(scene, leverG, chrome, sceRow.X, sceRow.Y, 0.1);
  // the panel's screws, each in its ring
  const screwXY = [[125, 1362], [315, 1362], [448, 1362], [598, 1362], [700, 1362], [960, 1362], [180, 1042], [262, 1042], [400, 1228], [240, 1228], [600, 1335], [490, 1345], [410, 1345], [660, 1345], [285, 1298], [395, 1172], [506, 1140], [395, 1245], [150, 1040], [720, 1140], [700, 1250], [300, 1150], [145, 900], [685, 890], [630, 1140], [1000, 1040], [895, 1140]];
  const screws = screwXY.map(([x, y]) => mat4(P3.x(x), P3.y(y), 0.008, Math.PI / 2));
  stamp(scene, new THREE.TorusGeometry(0.075, 0.012, 8, 30), dull, screwXY.map(([x, y]) => mat4(P3.x(x), P3.y(y), 0.01)), false);
  stamp(scene, new THREE.CylinderGeometry(0.052, 0.058, 0.02, 24), dull, screws);
  stamp(scene, new THREE.BoxGeometry(0.075, 0.012, 0.01), black, screwXY.map(([x, y], i) => mat4(P3.x(x), P3.y(y), 0.019, 0, 0, i * 1.3)), false);
  // squelch thumbwheels
  for (const y of [1193, 1293]) {
    add(scene, new RoundedBoxGeometry(0.72, 0.92, 0.05, 3, 0.05), paint, P3.x(320), P3.y(y), 0.024);
    const [dc, dg] = canvasOf(128, 384); dg.fillStyle = '#0a0a0a'; dg.fillRect(0, 0, 128, 384); dg.fillStyle = '#e8e8de'; dg.font = '700 72px Arial'; dg.textAlign = 'center'; dg.textBaseline = 'middle'; ['1', '2', '3'].forEach((t, i) => dg.fillText(t, 64, 72 + i * 120));
    add(scene, new THREE.PlaneGeometry(0.2, 0.62), std(0xffffff, 0.45, 0.2, {map: texOf(dc)}), P3.x(320), P3.y(y), 0.052);
    add(scene, new RoundedBoxGeometry(0.28, 0.7, 0.03, 3, 0.012), new THREE.MeshPhysicalMaterial({color: 0x050505, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.25, depthWrite: false}), P3.x(320), P3.y(y), 0.06, 0, 0, 0, false);
  }
  // talkback windows (the striped barber poles)
  const [tc, tg] = canvasOf(128, 128); tg.fillStyle = '#c8c8be'; tg.fillRect(0, 0, 128, 128); tg.strokeStyle = '#141414'; tg.lineWidth = 16; for (let i = -128; i < 256; i += 44) { tg.beginPath(); tg.moveTo(i, 128); tg.lineTo(i + 128, 0); tg.stroke(); }
  const pole = std(0xffffff, 0.55, 0.1, {map: texOf(tc)});
  for (const [x, y] of [[684, 1090], [684, 1138], [400, 945], [438, 945], [478, 945], [520, 945], [568, 945], [606, 945], [520, 808], [568, 808], [606, 808], [182, 945], [222, 945], [400, 655], [440, 655], [482, 655]]) {
    add(scene, new RoundedBoxGeometry(0.34, 0.34, 0.03, 2, 0.012), black, P3.x(x), P3.y(y), 0.014, 0, 0, 0, false);
    add(scene, new THREE.PlaneGeometry(0.22, 0.2), pole, P3.x(x), P3.y(y), 0.031, 0, 0, 0, false);
  }
  // rotary selectors and meters, up the panel
  const knobShape = new THREE.Shape(); knobShape.moveTo(0, 0.42); knobShape.lineTo(0.17, 0.05); knobShape.lineTo(0.2, -0.28); knobShape.lineTo(-0.2, -0.28); knobShape.lineTo(-0.17, 0.05); knobShape.closePath();
  const knobG = new THREE.ExtrudeGeometry(knobShape, {depth: 0.2, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3});
  for (const [x, y, a] of [[975, 1290, 0.3], [775, 985, -0.5], [925, 985, 1.0], [628, 700, 0.45]]) {
    add(scene, new THREE.CylinderGeometry(0.42, 0.45, 0.03, 48), paint, P3.x(x), P3.y(y), 0.016, Math.PI / 2);
    add(scene, knobG, black, P3.x(x), P3.y(y), 0.03, 0, 0, -a);
    add(scene, new THREE.BoxGeometry(0.018, 0.46, 0.01), std(0xeeeee6, 0.5, 0), P3.x(x), P3.y(y), 0.262, 0, 0, -a, false);
  }
  const meter = (x, y, rad, label, lo, hi, val) => {
    const [mc, mg] = canvasOf(512, 512); mg.fillStyle = '#0c0c0d'; mg.beginPath(); mg.arc(256, 256, 254, 0, 7); mg.fill(); mg.strokeStyle = '#ebebe2'; mg.fillStyle = '#ebebe2'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.font = '700 36px Arial';
    for (let i = 0; i <= 20; i++) { const b = i % 5 === 0, t = -2.2 + (i / 20) * 4.4, sx = Math.sin(t), sy = -Math.cos(t); mg.lineWidth = b ? 6 : 3; mg.beginPath(); mg.moveTo(256 + sx * (b ? 188 : 204), 256 + sy * (b ? 188 : 204)); mg.lineTo(256 + sx * 228, 256 + sy * 228); mg.stroke(); if (b) mg.fillText(String(Math.round(lo + (i / 20) * (hi - lo))), 256 + sx * 150, 256 + sy * 150); }
    mg.font = '700 30px Arial'; label.split(' ').forEach((l, i) => mg.fillText(l, 256, 340 + i * 36));
    add(scene, new THREE.CircleGeometry(rad, 48), std(0xffffff, 0.5, 0.1, {map: texOf(mc)}), P3.x(x), P3.y(y), 0.012, 0, 0, 0, false);
    add(scene, new THREE.TorusGeometry(rad + 0.012, 0.03, 12, 56), paint, P3.x(x), P3.y(y), 0.03);
    const n = new THREE.Group(); n.position.set(P3.x(x), P3.y(y), 0.03); n.rotation.z = -val; add(n, new THREE.BoxGeometry(0.014, rad * 0.86, 0.006), std(0xffffff, 0.4, 0, {emissive: 0x222222}), 0, rad * 0.4, 0, 0, 0, 0, true); scene.add(n);
    add(scene, new THREE.CircleGeometry(rad, 48), new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.07, depthWrite: false}), P3.x(x), P3.y(y), 0.05, 0, 0, 0, false);
  };
  meter(948, 1165, 0.42, 'AC VOLTS', 90, 130, 0.25); meter(755, 850, 0.48, 'DC VOLTS', 20, 45, 0.65); meter(740, 745, 0.48, 'DC AMPS', 0, 100, -0.5);

  // the light: the caution panel burning off to the left, raking across; a cool sliver from the window above; a soft fill from below
  const amber = spot(scene, 0xffb26a, 60, V3(-7.8, 0.3, 2.9), V3(-0.6, -0.2, 0), 0.62, 0.9, 1.4, 22, 2048, 1, 18, -0.0003, 0.004);
  spot(scene, 0xb8ccff, 3.2, V3(2.4, 3.6, 3.4), V3(-0.4, -0.3, 0), 0.5, 1, 1.5, 12);
  scene.add(new THREE.AmbientLight(0x74787f, 0.62));
  add(scene, new THREE.PlaneGeometry(60, 40), std(0x17181a, 0.8, 0.2), cx, cy, -0.02, 0, 0, 0, false);       // the console round the panel
  return {draw: (f) => {
    const d = f - THROW, a = d < 0 ? 0.5 : d <= 2 ? lerp(0.5, 0, ease(d / 2)) : d <= 4 ? 0 : d <= 6 ? lerp(0, -0.56, ease((d - 4) / 2)) : d <= 8 ? lerp(-0.56, -0.5, (d - 6) / 2) : -0.5;
    sce.rotation.set(Math.PI / 2 - a, 0, 0);
    const k = ease(f / 215), kick = d >= 4 ? 0.011 * Math.exp(-(d - 4) * 0.32) : 0, sh = 0.0024 + kick;
    const sx = Math.sin(f * 2.17) * Math.cos(f * 0.73) * sh, sy = Math.cos(f * 1.83) * Math.sin(f * 1.19) * sh;
    camera.position.set(lerp(0.15, -0.34, k) + sx, lerp(-4.3, -1.3, k) + sy, lerp(3.7, 2.12, k));
    camera.lookAt(lerp(-0.25, -0.5, k) + sx * 0.4, lerp(0.42, -0.36, k) + sy * 0.4, 0.04);
    camera.fov = lerp(38, 29, k); camera.up.set(lerp(0.06, -0.035, k), 1, 0);
    amber.intensity = 60 * (0.93 + 0.07 * Math.sin(f * 0.37) * Math.sin(f * 0.11));
  }};
});

// ---------------------------------------------------------------- CoverWindow
// Outside the very top of the Saturn in rain and cloud, the boost protective cover and its one small window; a push into the hole (black at frame CUT, 5.83 s), a hard cut, then the same hole from inside: grey.
export const CoverWindow = () => useScene((e) => {
  shadows(e);
  const {scene, glow, camera, cloud} = e, CUT = 175, ALT = 1900;
  camera.near = 0.03; camera.far = 9000;
  cloud.far_.value = 2600; cloud.cover.value = 0.44; cloud.near_.value = 0;
  e.final.bloom.value = 0.42; e.final.grain.value = 0.02; e.final.vign.value = 0.75;
  e.skyHi.set(0.46, 0.5, 0.56); e.skyLo.set(0.2, 0.22, 0.25);
  scene.environment = envOf(e, [[0xbcc8d6, 1.6, 0, 8, 0, 18, 18], [0x8e98a6, 0.7, -8, 3, 4, 8, 8], [0x8e98a6, 0.5, 8, 2, 5, 8, 8], [0x2a2c30, 1, 0, -8, 0, 18, 18]], 0x2a2e34); scene.environmentIntensity = 0.75;
  const root = new THREE.Group(); root.position.y = ALT - 100; scene.add(root);
  const saturn = makeSaturn(); saturn.children[0].visible = false; root.add(saturn);
  const R = (y) => 1.97 + ((y - 101.1) * (0.37 - 1.97)) / 3.6;
  const C = V3(0, 102.42, R(102.42)), n = V3(0, 1.6 / 3.6, 1).normalize(), right = V3(1, 0, 0), up = new THREE.Vector3().crossVectors(n, right).normalize();
  const HOLE = 0.1, WIN = 0.128, GAP = 0.15;
  // the cover: hard shell low down, cloth above, the seam between, rivets, grime and water
  const [bc, bg] = noiseCanvas(4096, 2048, '#cfcfca', 11, 9000, 0.035), [hc, hg] = canvasOf(2048, 1024), r = rng(41);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, 2048, 1024);
  const vY = (y) => 2048 * (1 - (y - 101.1) / 3.6), SEAM = 103.3;
  for (let i = 0; i < 520; i++) { bg.fillStyle = `rgba(40,42,46,${0.012 + r() * 0.05})`; const x = r() * 4096, y = r() * 2048; bg.fillRect(x, y, 1.5 + r() * 7, 40 + r() * 620); }
  bg.fillStyle = 'rgba(30,30,30,0.5)'; bg.fillRect(0, vY(SEAM) - 3, 4096, 8);
  for (let i = 0; i < 16; i++) { const x = (i / 16) * 4096; bg.strokeStyle = 'rgba(30,30,32,0.45)'; bg.lineWidth = 4; bg.beginPath(); bg.moveTo(x, vY(SEAM)); bg.lineTo(x, vY(101.1)); bg.stroke(); hg.strokeStyle = '#444'; hg.lineWidth = 3; hg.beginPath(); hg.moveTo(x / 2, vY(SEAM) / 2); hg.lineTo(x / 2, 1024); hg.stroke(); for (let m = 101.2; m < SEAM; m += 0.13) { bg.fillStyle = 'rgba(70,70,70,0.75)'; bg.beginPath(); bg.arc(x + 12, vY(m), 3.2, 0, 7); bg.fill(); hg.fillStyle = '#b8b8b8'; hg.beginPath(); hg.arc((x + 12) / 2, vY(m) / 2, 2, 0, 7); hg.fill(); } }
  for (const m of [101.75, 102.75]) { bg.fillStyle = 'rgba(30,30,32,0.4)'; bg.fillRect(0, vY(m), 4096, 3); hg.fillStyle = '#505050'; hg.fillRect(0, vY(m) / 2, 2048, 2); }
  for (let i = 0; i < 90; i++) { const x = (i / 90) * 2048; hg.fillStyle = '#6e6e6e'; hg.fillRect(x, 0, 6, vY(SEAM) / 2); }      // the cloth's ribs above the seam
  const holeU = {uC: {value: C.clone()}, uR: {value: HOLE}};
  const cutHole = (m, u) => { m.onBeforeCompile = (s) => { s.uniforms.uC = u.uC; s.uniforms.uR = u.uR;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc; uniform vec3 uC; uniform float uR;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (length(vLoc - uC) < uR) discard;'); }; return m; };
  const lathe = (rad, y0, y1, seg = 180) => { const pts = []; for (let i = 0; i <= 40; i++) { const y = lerp(y0, y1, i / 40); pts.push(new THREE.Vector2(rad(y), y)); } const g = new THREE.LatheGeometry(pts, seg, Math.PI, Math.PI * 2), uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setY(i, (p.getY(i) - 101.1) / 3.6); return g; };
  const bpc = cutHole(new THREE.MeshStandardMaterial({map: texOf(bc), bumpMap: texOf(hc, false), bumpScale: 1.4, roughness: 0.42, metalness: 0.03, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide}), holeU);
  const shell = new THREE.Mesh(lathe(R, 101.1, 104.72), bpc); shell.castShadow = shell.receiveShadow = true; root.add(shell);
  // running water: a film over the cover whose streaks crawl up and back in the wind of the climb
  const [wc, wg] = canvasOf(2048, 1024), r2 = rng(93); wg.fillStyle = '#000'; wg.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 620; i++) { const x = r2() * 2048, y = r2() * 1024, L = 40 + r2() * 300, w = 1 + r2() * 3.2, a = 0.25 + r2() * 0.75, gr = wg.createLinearGradient(x, y, x, y + L); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, `rgba(255,255,255,${a})`); gr.addColorStop(1, `rgba(255,255,255,${a})`); wg.fillStyle = gr; wg.fillRect(x, y, w, L); }
  const wt = texOf(wc, false); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(3, 1.3);
  const film = cutHole(new THREE.MeshStandardMaterial({color: 0xffffff, alphaMap: wt, transparent: true, depthWrite: false, roughness: 0.08, metalness: 0.5, envMapIntensity: 1.25}), holeU);
  root.add(new THREE.Mesh(lathe((y) => R(y) + 0.004, 101.1, 104.7), film));
  // below it, the service module and the taper to the third stage
  const lower = new THREE.LatheGeometry([[3.3, 88], [3.3, 89.5], [1.96, 98], [1.96, 101.12]].map(([a, b]) => new THREE.Vector2(a, b)), 96);
  add(root, lower, std(0xcfcfca, 0.5, 0.05), 0, 0, 0);
  add(root, new THREE.TorusGeometry(1.965, 0.02, 10, 160), std(0x505256, 0.5, 0.5), 0, 101.11, 0, Math.PI / 2);
  // the hole: a bolted ring in the cover, a short sleeve through it
  const hole = new THREE.Group(); hole.position.copy(C); hole.quaternion.setFromUnitVectors(V3(0, 0, 1), n); root.add(hole);
  const ringM = std(0x6a6c70, 0.38, 0.8);
  const flange = new THREE.Mesh(new THREE.TorusGeometry(HOLE + 0.024, 0.024, 16, 96), ringM); flange.scale.z = 0.6; flange.position.z = 0.005; flange.castShadow = true; hole.add(flange);
  stamp(hole, new THREE.CylinderGeometry(0.008, 0.008, 0.008, 12), std(0x2a2c2e, 0.4, 0.9), Array.from({length: 18}, (_, i) => { const t = (i / 18) * Math.PI * 2; return mat4(Math.cos(t) * (HOLE + 0.025), Math.sin(t) * (HOLE + 0.025), 0.022, Math.PI / 2); }));
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(HOLE, HOLE, GAP, 64, 1, true), new THREE.MeshStandardMaterial({color: 0x17181a, roughness: 0.55, metalness: 0.5, side: THREE.BackSide})); sleeve.rotation.x = Math.PI / 2; sleeve.position.z = -GAP / 2; hole.add(sleeve);
  // the capsule under the cover: foil skin, the hatch window; seen from outside the window is a dark mirror
  const skinU = {uC: {value: C.clone().addScaledVector(n, -GAP)}, uR: {value: WIN}};
  const under = new THREE.Mesh(lathe((y) => R(y) - GAP * 1.09, 101.3, 104.3), cutHole(std(0x8e9094, 0.32, 0.9, {side: THREE.DoubleSide}), skinU)); root.add(under);
  const win = new THREE.Group(); win.position.copy(C).addScaledVector(n, -GAP); win.quaternion.copy(hole.quaternion); root.add(win);
  const paneOut = new THREE.Mesh(new THREE.CircleGeometry(HOLE + 0.02, 64), new THREE.MeshPhysicalMaterial({color: 0x050608, roughness: 0.03, metalness: 0.2, envMapIntensity: 1.4})); paneOut.position.z = -0.002; win.add(paneOut);
  // inside: the window's tapered frame in the hatch, a wall round it, a strut across the near corner
  const inside = new THREE.Group(); win.add(inside);
  const wall = std(0x34373b, 0.75, 0.25);
  const frameLathe = new THREE.LatheGeometry([[WIN, 0.03], [WIN, -0.05], [WIN + 0.018, -0.06], [WIN + 0.028, -0.09], [WIN + 0.09, -0.17], [WIN + 0.11, -0.2]].map(([a, b]) => new THREE.Vector2(a, b)), 96);
  const frame = new THREE.Mesh(frameLathe, new THREE.MeshStandardMaterial({color: 0x2a2c30, roughness: 0.62, metalness: 0.35, side: THREE.DoubleSide})); frame.rotation.x = Math.PI / 2; frame.castShadow = frame.receiveShadow = true; inside.add(frame);
  const wallS = new THREE.Shape(); wallS.moveTo(-4, -4); wallS.lineTo(4, -4); wallS.lineTo(4, 4); wallS.lineTo(-4, 4); wallS.closePath(); const wh = new THREE.Path(); wh.absarc(0, 0, WIN + 0.105, 0, Math.PI * 2, true); wallS.holes.push(wh);
  const wallM = new THREE.Mesh(new THREE.ShapeGeometry(wallS, 96), wall); wallM.position.z = -0.2; wallM.receiveShadow = true; inside.add(wallM);
  stamp(inside, new THREE.CylinderGeometry(0.009, 0.011, 0.012, 16), std(0x6a6c70, 0.32, 0.9), Array.from({length: 24}, (_, i) => { const t = (i / 24) * Math.PI * 2; return mat4(Math.cos(t) * (WIN + 0.15), Math.sin(t) * (WIN + 0.15), -0.21, Math.PI / 2); }), false);
  for (const [x, y, w, h] of [[-0.62, -0.42, 0.34, 0.2], [0.58, -0.5, 0.26, 0.3], [0.64, 0.44, 0.3, 0.16]]) add(inside, new RoundedBoxGeometry(w, h, 0.05, 3, 0.012), std(0x1c1d20, 0.5, 0.5), x, y, -0.2, 0, 0, 0, false);
  add(inside, new THREE.CylinderGeometry(0.03, 0.03, 2.2, 20), std(0x101113, 0.5, 0.6), -0.52, 0.28, -0.46, 0, 0, 0.72, false);
  const glowI = spot(inside, 0xffa050, 0.0, V3(0.35, -0.75, -0.65), V3(0, 0, -0.15), 1.1, 1, 1.5, 3);
  // the daylight through the hole, on the frame's bevel
  const daylight = spot(inside, 0xc4d0dc, 0, V3(0, 0, 0.14), V3(0, 0, -0.4), 0.9, 0.8, 1.2, 2.4);
  // the drops on the pane: drawn in front of the sky and clouds, seen from inside only
  const [dc, dg] = canvasOf(1024, 2048), r3 = rng(301); dg.clearRect(0, 0, 1024, 2048);
  const drop = (x, y, s) => { const g = dg.createRadialGradient(x - s * 0.22, y - s * 0.32, s * 0.08, x, y, s); g.addColorStop(0, 'rgba(245,248,252,0.55)'); g.addColorStop(0.5, 'rgba(120,128,138,0.2)'); g.addColorStop(0.84, 'rgba(10,12,15,0.85)'); g.addColorStop(1, 'rgba(10,12,14,0)'); dg.fillStyle = g; dg.beginPath(); dg.ellipse(x, y, s, s * 1.3, 0, 0, 7); dg.fill(); };
  for (let i = 0; i < 300; i++) { const x = r3() * 1024, y = r3() * 2048, s = 4 + r3() * r3() * 30; drop(x, y, s); if (s > 13) { dg.strokeStyle = 'rgba(18,20,24,0.5)'; dg.lineWidth = s * 0.5; dg.lineCap = 'round'; dg.beginPath(); dg.moveTo(x, y - s); dg.quadraticCurveTo(x + (r3() - 0.5) * 16, y - 60, x + (r3() - 0.5) * 22, y - 100 - r3() * 240); dg.stroke(); } }
  const dt = texOf(dc); dt.wrapS = dt.wrapT = THREE.RepeatWrapping;
  const drops = new THREE.Mesh(new THREE.CircleGeometry(WIN, 64), new THREE.MeshBasicMaterial({map: dt, transparent: true, depthWrite: false, depthTest: false, toneMapped: false})); glow.add(drops);
  drops.position.copy(C).addScaledVector(n, -GAP - 0.01); drops.position.y += root.position.y; drops.quaternion.copy(hole.quaternion);
  // rain: thin bright strokes around the camera; the wind of the climb lays them over and they fall a long way each frame
  const N = 1100, rain = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshBasicMaterial({color: new THREE.Color(0.1, 0.11, 0.125), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending}), N); rain.frustumCulled = false; glow.add(rain);
  const r4 = rng(733), seeds = Array.from({length: N}, () => [r4(), r4(), r4(), 0.7 + r4() * 0.9]);
  const dummy = new THREE.Object3D(), RAINBOX = 22, fall = V3(0.12, -1, -0.24).normalize();
  // the light of a grey day from above; cold
  scene.add(new THREE.HemisphereLight(0x9aa6b4, 0x1f1d1b, 0.5));
  const key = new THREE.DirectionalLight(0xc2cdda, 0.85); key.position.set(-4, ALT + 12, 7); key.target.position.set(0, ALT + 2, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, {left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40}); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.01; scene.add(key, key.target);
  const tmp = V3(0, 0, 0), look = V3(0, 0, 0);
  return {draw: (f) => {
    const out = f < CUT;
    wt.offset.set(0.02, -f * 0.011); dt.offset.set(0.0, f * 0.0009);
    cloud.wind.value.set(f * 0.0007, -f * 0.0016 + 0.31, f * 0.0003);
    paneOut.visible = out; rain.visible = out; inside.visible = !out; drops.visible = !out; key.visible = out; glowI.intensity = out ? 0 : 1.5 * (0.86 + 0.14 * Math.sin(f * 0.21)); daylight.intensity = out ? 0 : 0.16;
    const wp = (v) => tmp.copy(v).add(root.position);
    if (out) {
      const k = ease(f / (CUT - 2)), kk = k * k * (3 - 2 * k), dist = lerp(5.6, 0.2, Math.pow(kk, 0.8)), side = lerp(-3.1, 0, Math.pow(kk, 0.55)), rise = lerp(-0.9, 0, Math.pow(kk, 0.6));
      const p = wp(C).clone().addScaledVector(n, dist).addScaledVector(right, side).addScaledVector(up, rise);
      p.x += Math.sin(f * 1.9) * Math.cos(f * 0.7) * 0.004 * (0.3 + dist); p.y += Math.cos(f * 1.5) * Math.sin(f * 1.1) * 0.004 * (0.3 + dist);
      camera.position.copy(p);
      look.copy(wp(C)); look.y += lerp(1.0, 0, Math.pow(kk, 0.7)); look.x += lerp(0.3, 0, Math.pow(kk, 0.7));
      camera.up.set(lerp(-0.04, 0, k), 1, 0); camera.lookAt(look); camera.fov = lerp(40, 36, k);
      e.final.exposure.value = 0.92; e.skyHi.set(0.46, 0.5, 0.56); e.skyLo.set(0.2, 0.22, 0.25); cloud.far_.value = 2600; scene.environmentIntensity = 0.6;
      for (let i = 0; i < N; i++) {
        const [a, b, c, l] = seeds[i], t = ((c + f * 0.12 * l) % 1 + 1) % 1;
        const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, H = RAINBOX;
        dummy.position.set(cx + (a - 0.5) * H - fall.x * (t - 0.5) * H * 1.1, cy + (0.5 - t) * H * 1.1, cz + (b - 0.5) * H - fall.z * (t - 0.5) * H * 1.1);
        const dc = dummy.position.distanceTo(camera.position), w = Math.max(0.0035, dc * 0.00085); dummy.scale.set(dc < 2.2 ? 0 : w, 1.2 * l, dc < 2.2 ? 0 : w); dummy.quaternion.setFromUnitVectors(V3(0, 1, 0), fall); dummy.updateMatrix(); rain.setMatrixAt(i, dummy.matrix);
      }
      rain.instanceMatrix.needsUpdate = true;
    } else {
      const k = ease((f - CUT) / 150), d = lerp(1.0, 0.56, k);
      const p = wp(C).clone().addScaledVector(n, -GAP - d).addScaledVector(right, lerp(0.14, 0.05, k)).addScaledVector(up, lerp(-0.1, -0.04, k));
      p.x += Math.sin(f * 1.3) * Math.cos(f * 0.53) * 0.0024; p.y += Math.cos(f * 1.1) * Math.sin(f * 0.71) * 0.0024;
      camera.position.copy(p); camera.up.copy(up); look.copy(wp(C)).addScaledVector(right, lerp(0.14, 0.05, k)).addScaledVector(up, lerp(-0.02, 0, k)); camera.lookAt(look); camera.fov = 34;
      e.final.exposure.value = 1.05; e.skyHi.set(0.56, 0.6, 0.64); e.skyLo.set(0.3, 0.32, 0.35); cloud.far_.value = 2200; scene.environmentIntensity = 0.08;
    }
    e.final.white.value = 0;
  }};
});

// ---------------------------------------------------------------- AbortHandle
// The commander's T-handle on the arm of the left couch, in the dark cabin. A slow move round it. It does not turn.
export const AbortHandle = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e;
  camera.near = 0.05; camera.far = 200;
  e.final.bloom.value = 0.7; e.final.exposure.value = 1.1; e.final.vign.value = 1.15; e.final.grain.value = 0.018;
  scene.environment = envOf(e, [[0xffb066, 3, -5, 6, 3, 7, 4], [0xc8d6f0, 4, 6, 3, 3, 3, 6], [0xffffff, 0.5, 0, -7, 3, 8, 3]], 0x08090b); scene.environmentIntensity = 1.2;
  const blackGrip = (() => { const [c, g] = canvasOf(512, 512); g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#303030'; g.lineWidth = 3; for (let i = -512; i < 1024; i += 18) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 512, 512); g.moveTo(i + 512, 0); g.lineTo(i, 512); g.stroke(); } const t = texOf(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 2); return t; })();
  const rubber = std(0x18181a, 0.66, 0.05), gripM = std(0x222224, 0.46, 0.25, {bumpMap: blackGrip, bumpScale: 0.7}), steel = std(0xbfc0bc, 0.24, 1), anod = std(0x44474c, 0.46, 0.72), anodDk = std(0x2a2c30, 0.5, 0.6), silver = std(0x8a8c8c, 0.4, 0.95);
  // the arm of the couch: a long box beam, a side plate, rivets
  add(scene, new RoundedBoxGeometry(1.5, 0.62, 13, 4, 0.06), anod, 0, -1.0, -3.2);
  add(scene, new RoundedBoxGeometry(2.6, 0.14, 3.2, 4, 0.05), anodDk, 0, -0.62, 0);
  stamp(scene, new THREE.CylinderGeometry(0.05, 0.055, 0.03, 20), silver, [[-1.1, -1.3], [1.1, -1.3], [-1.1, 1.3], [1.1, 1.3], [-1.1, 0], [1.1, 0]].map(([x, z]) => mat4(x, -0.54, z)));
  const rv = []; for (let z = -9; z < 3; z += 0.42) { rv.push(mat4(0.76, -1.0, z, 0, 0, Math.PI / 2)); rv.push(mat4(-0.76, -1.0, z, 0, 0, Math.PI / 2)); }
  stamp(scene, new THREE.SphereGeometry(0.03, 12, 8), silver, rv, false);
  // the housing and its rubber boot
  add(scene, new THREE.CylinderGeometry(0.78, 0.9, 0.9, 64), anod, 0, -0.12, 0);
  add(scene, new THREE.TorusGeometry(0.76, 0.035, 12, 64), steel, 0, 0.33, 0, Math.PI / 2);
  const hs = []; for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2 + 0.2; hs.push(mat4(Math.cos(t) * 0.66, 0.34, Math.sin(t) * 0.66)); }
  stamp(scene, new THREE.CylinderGeometry(0.038, 0.044, 0.026, 6), silver, hs);
  const bootPts = []; for (let i = 0; i <= 56; i++) { const v = i / 56; bootPts.push(new THREE.Vector2(lerp(0.62, 0.24, v) + 0.045 * Math.sin(v * Math.PI * 12) * (1 - v * 0.4), 0.34 + v * 0.96)); }
  add(scene, new THREE.LatheGeometry(bootPts, 64), rubber);
  // the shaft and the T
  add(scene, new THREE.CylinderGeometry(0.18, 0.2, 1.2, 40), steel, 0, 1.75, 0);
  add(scene, new THREE.CylinderGeometry(0.235, 0.235, 0.09, 40), silver, 0, 1.3, 0);
  add(scene, new THREE.CylinderGeometry(0.235, 0.235, 0.05, 40), silver, 0, 2.22, 0);
  const tee = new THREE.Group(); tee.position.y = 2.72; tee.rotation.y = 0.5; scene.add(tee);
  add(tee, new THREE.CylinderGeometry(0.27, 0.26, 0.5, 48), gripM, 0, -0.24, 0);
  const barPts = []; for (let i = 0; i <= 40; i++) { const v = i / 40, x = -1.55 + v * 3.1; barPts.push(new THREE.Vector2(0.27 + 0.05 * Math.pow(Math.abs(x) / 1.55, 2.2) - 0.018 * Math.cos(x * 7.5) * (Math.abs(x) > 0.42 ? 1 : 0), x)); }
  barPts.unshift(new THREE.Vector2(0, -1.59), new THREE.Vector2(0.22, -1.585)); barPts.push(new THREE.Vector2(0.22, 1.585), new THREE.Vector2(0, 1.59));
  add(tee, new THREE.LatheGeometry(barPts, 48), gripM, 0, 0.16, 0, 0, 0, Math.PI / 2);
  stamp(tee, new THREE.CylinderGeometry(0.228, 0.228, 0.05, 32), steel, [mat4(-0.42, 0.16, 0, 0, 0, Math.PI / 2), mat4(0.42, 0.16, 0, 0, 0, Math.PI / 2)]);
  // the cable out of the housing, along the beam
  const curve = new THREE.CatmullRomCurve3([V3(0.72, -0.2, -0.3), V3(1.12, -0.42, -0.9), V3(1.0, -0.86, -2.6), V3(1.08, -0.9, -6), V3(1.7, -0.6, -11)]);
  add(scene, new THREE.TubeGeometry(curve, 90, 0.085, 12), std(0x1b1b1d, 0.68, 0.08));
  for (const t of [0.26, 0.5, 0.74]) { const q = curve.getPoint(t); add(scene, new THREE.TorusGeometry(0.11, 0.024, 8, 24), silver, q.x, q.y, q.z, 0, 0, 0); }
  // the couch's cloth beside it and its frame, falling away into the dark
  const [cc, cg] = noiseCanvas(1024, 1024, '#a39f93', 21, 2600, 0.04); cg.strokeStyle = 'rgba(40,38,34,0.5)'; cg.lineWidth = 4; for (const y of [200, 512, 824]) { cg.beginPath(); cg.moveTo(0, y); cg.lineTo(1024, y + 8); cg.stroke(); }
  const weave = (() => { const [c, g] = canvasOf(256, 256); for (let y = 0; y < 256; y += 4) for (let x = 0; x < 256; x += 4) { g.fillStyle = (x + y) % 8 === 0 ? '#9a9a9a' : '#5e5e5e'; g.fillRect(x, y, 4, 4); } const t = texOf(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 40); return t; })();
  const pad = new THREE.PlaneGeometry(40, 40, 60, 60); { const p = pad.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, 0.55 * Math.exp(-Math.pow((x + 0.5) / 3.4, 4)) * (0.9 + 0.1 * Math.sin(y * 0.8)) + 0.05 * Math.sin(y * 1.6)); } pad.computeVertexNormals(); }
  add(scene, pad, std(0x77746c, 0.92, 0, {map: texOf(cc), bumpMap: weave, bumpScale: 0.25}), 0, -2.6, -6, -Math.PI / 2 + 0.06, 0, 0);
  add(scene, new THREE.CylinderGeometry(0.16, 0.16, 16, 24), silver, 3.2, -2.6, -3, Math.PI / 2 - 0.04);
  add(scene, new THREE.BoxGeometry(60, 0.2, 60), std(0x08090a, 0.8, 0.2), 0, -5.4, 0, 0, 0, 0, false);
  // the wall of lights, far above and behind: out of focus, as a lens would see them
  const [bc, bg] = canvasOf(256, 256), grad = bg.createRadialGradient(128, 128, 96, 128, 128, 128); grad.addColorStop(0, 'rgba(255,255,255,0.55)'); grad.addColorStop(0.6, 'rgba(255,255,255,0.7)'); grad.addColorStop(0.86, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); bg.fillStyle = grad; bg.fillRect(0, 0, 256, 256);
  const bok = texOf(bc), r = rng(55), bokehs = [];
  for (let i = 0; i < 46; i++) { const c = new THREE.Color(r() > 0.12 ? 0xffa23c : 0xff3a22).multiplyScalar(0.03 + r() * 0.13), s = new THREE.Sprite(new THREE.SpriteMaterial({map: bok, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 1})); s.position.set(-26 + r() * 52, 6.5 + r() * 12, -26 - r() * 18); const k = 0.9 + r() * 0.8; s.scale.set(k, k, 1); scene.add(s); bokehs.push({s, p: r() * 6, q: r()}); }
  // the light: a blade of cool daylight from the window, amber from the panel
  spot(scene, 0xcdd8ee, 170, V3(5.2, 7, 3.4), V3(0, 1.6, 0), 0.4, 0.75, 1.3, 26, 2048, 2, 22, -0.0005, 0.012);
  const amber = spot(scene, 0xff9a44, 90, V3(-6.5, 6, -5), V3(0, 1.2, 0), 0.8, 1, 1.4, 26, 1024, 2, 26, -0.0006, 0.015);
  scene.add(new THREE.AmbientLight(0x5a5e66, 0.42));
  return {draw: (f) => {
    const k = ease(f / 299), t = lerp(-0.72, 0.58, k), rad = lerp(10.5, 7.2, k), sh = 0.006;
    camera.position.set(Math.sin(t) * rad + Math.sin(f * 1.7) * Math.cos(f * 0.61) * sh, lerp(3.1, 2.75, k) + Math.cos(f * 1.3) * Math.sin(f * 0.83) * sh, Math.cos(t) * rad);
    camera.lookAt(lerp(0.15, 0, k), lerp(1.2, 2.12, k), 0); camera.fov = lerp(30, 27, k); camera.up.set(0, 1, 0);
    amber.intensity = 90 * (0.82 + 0.18 * Math.sin(f * 0.29));
    bokehs.forEach(({s, p, q}) => { s.material.opacity = q > 0.8 ? (Math.floor((f + p * 9) / 15) % 2 ? 1 : 0.25) : 0.85 + 0.15 * Math.sin(f * 0.1 + p); });
  }};
});

// ---------------------------------------------------------------- ParachuteBay
// A see-through capsule: three main chutes and two drogues packed round the tunnel in the forward bay, soft light, no people. One slow move: the whole capsule, then in and up to the bay.
export const ParachuteBay = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e;
  camera.near = 0.05; camera.far = 200;
  e.final.bloom.value = 0.5; e.final.exposure.value = 1.15; e.final.vign.value = 1.05; e.final.grain.value = 0.016;
  e.skyHi.set(0.024, 0.027, 0.034); e.skyLo.set(0.006, 0.0065, 0.008);
  scene.environment = envOf(e, [[0xfff0dc, 2.2, -4, 7, 4, 7, 5], [0xb6c6e0, 1, 6, 1, 4, 3, 6], [0xffffff, 0.3, 0, -7, 3, 8, 3]]); scene.environmentIntensity = 0.6;
  const OUT = (y) => (y < 0.06 ? 1.96 : y > 3.08 ? 0.4 : 1.96 + ((y - 0.06) * (0.42 - 1.96)) / 3.02);
  // the outer heat shield as a shell of light, its seams and windows drawn on it
  const prof = [[0, -0.42], [0.72, -0.38], [1.32, -0.25], [1.76, -0.08], [1.92, 0], [1.96, 0.05], [1.95, 0.1], [0.44, 3.06], [0.41, 3.14], [0.28, 3.2], [0, 3.22]].map(([a, b]) => new THREE.Vector2(a, b));
  const shellM = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {col: {value: new THREE.Color(0.58, 0.68, 0.82)}},
    vertexShader: 'out vec3 vN; out vec3 vV; out vec3 vP; void main(){ vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); vP = position; gl_Position = projectionMatrix * m; }',
    fragmentShader: 'precision highp float; in vec3 vN; in vec3 vV; in vec3 vP; out vec4 o; uniform vec3 col; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float rim = 0.018 + 0.52 * pow(f, 3.2); float band = 0.5 + 0.5 * smoothstep(0.0, 3.2, vP.y); o = vec4(col * rim * band, 1.0); }'});
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 160), shellM); shell.renderOrder = 5; scene.add(shell);
  const seamM = new THREE.LineBasicMaterial({color: new THREE.Color(0.42, 0.5, 0.62), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false});
  const ring = (y, rad = OUT(y)) => { const pts = []; for (let i = 0; i <= 160; i++) { const t = (i / 160) * Math.PI * 2; pts.push(V3(Math.sin(t) * rad, y, Math.cos(t) * rad)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), seamM)); };
  [0.34, 1.0, 1.72, 2.2, 2.62].forEach((y) => ring(y));
  const onCone = (az, y, rx, ry) => { const pts = []; for (let i = 0; i <= 56; i++) { const t = (i / 56) * Math.PI * 2, yy = y + Math.sin(t) * ry, a = az + (Math.cos(t) * rx) / OUT(yy), rd = OUT(yy) + 0.002; pts.push(V3(Math.sin(a) * rd, yy, Math.cos(a) * rd)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), seamM)); };
  onCone(0, 1.42, 0.13, 0.13); onCone(1.15, 1.08, 0.14, 0.14); onCone(-1.15, 1.08, 0.14, 0.14); onCone(0.5, 1.72, 0.1, 0.09); onCone(-0.5, 1.72, 0.1, 0.09);
  // the crew compartment: the pressure vessel below the bay, dim, empty
  const vesselM = std(0x54565a, 0.58, 0.6);
  const vp = [[0, -0.24], [1.0, -0.18], [1.6, -0.02], [1.72, 0.14], [1.68, 0.34], [0.96, 1.72], [0.86, 1.82], [0.44, 1.92]].map(([a, b]) => new THREE.Vector2(a, b));
  add(scene, new THREE.LatheGeometry(vp, 128), vesselM);
  stamp(scene, new THREE.TorusGeometry(1, 0.006, 8, 96), std(0x4c4e50, 0.5, 0.8), [0.4, 0.62, 0.84, 1.06, 1.28, 1.5].map((y) => { const rr = 1.68 + ((y - 0.34) * (0.96 - 1.68)) / 1.38; return mat4(0, y, 0, Math.PI / 2, 0, 0, rr + 0.002, rr + 0.002, 1); }), false);
  // the forward bulkhead and the docking tunnel up the middle
  add(scene, new THREE.CylinderGeometry(0.405, 0.42, 1.22, 64, 1), std(0x9c9d9c, 0.38, 0.85), 0, 2.5, 0);
  add(scene, new THREE.TorusGeometry(0.42, 0.02, 10, 64), std(0x5c5e60, 0.4, 0.8), 0, 1.98, 0, Math.PI / 2);
  add(scene, new THREE.TorusGeometry(0.405, 0.02, 10, 64), std(0x5c5e60, 0.4, 0.8), 0, 3.08, 0, Math.PI / 2);
  // the bag's cloth: webbing straps and their stitches, creases from the packing
  const STRAP_T = [0.3, 0.5, 0.7], STRAP_U = [0.19, 0.31];          // polar share and longitude share of the straps; the outward face is at u = 0.25
  const bagPaint = (seed, base, bump) => { const [c, g] = noiseCanvas(2048, 1024, base, seed, 1800, 0.04); const r = rng(seed + 3);
    if (bump) { g.fillStyle = '#808080'; g.fillRect(0, 0, 2048, 1024); }
    for (let i = 0; i < 46; i++) { g.strokeStyle = bump ? `rgba(40,40,40,${0.1 + r() * 0.25})` : `rgba(60,52,42,${0.03 + r() * 0.07})`; g.lineWidth = 3 + r() * 16; const x = r() * 2048, y = r() * 1024; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + r() * 240 - 120, y + r() * 120 - 60, x + r() * 380 - 190, y + r() * 180 - 90, x + r() * 500 - 250, y + r() * 240 - 120); g.stroke(); }
    const web = bump ? '#c8c8c8' : '#a5885a', st = bump ? '#909090' : '#ece4cf';
    for (const t of STRAP_T) { const y = t * 1024; g.fillStyle = web; g.fillRect(0, y - 15, 2048, 30); g.fillStyle = st; for (let x = 0; x < 2048; x += 14) { g.fillRect(x, y - 11, 8, 2.5); g.fillRect(x, y + 9, 8, 2.5); } }
    for (const u of STRAP_U) { const x = u * 2048; g.fillStyle = web; g.fillRect(x - 15, 0, 30, 1024); g.fillStyle = st; for (let y = 0; y < 1024; y += 14) { g.fillRect(x - 11, y, 2.5, 8); g.fillRect(x + 9, y, 2.5, 8); } }
    return texOf(c, !bump); };
  // a packed parachute: a bag pressed into its wedge between the tunnel, the bulkhead and the cone. Built in the wedge's own coordinates so it fills it, and it bulges between its straps.
  const BAGW = 0.88, Y0 = 1.965, Y1 = 2.72;
  const wedge = (az, seed) => {
    const geo = new THREE.SphereGeometry(1, 128, 96), p = geo.attributes.position, uv = geo.attributes.uv, r = rng(seed), bumps = Array.from({length: 22}, () => [r(), r(), 0.05 + r() * 0.1, (r() - 0.5) * 0.09]);
    const sup = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
    for (let i = 0; i < p.count; i++) {
      const qx = p.getX(i), qy = p.getY(i), qz = p.getZ(i), u = uv.getX(i), t = 1 - uv.getY(i);
      let pil = 1; for (const k of STRAP_T) pil -= 0.05 * Math.exp(-Math.pow((t - k) / 0.03, 2)); for (const k of STRAP_U) pil -= 0.05 * Math.exp(-Math.pow((u - k) / 0.016, 2));
      for (const [bu, bt, bs, ba] of bumps) { const du = Math.min(Math.abs(u - bu), 1 - Math.abs(u - bu)); pil += ba * Math.exp(-(du * du + (t - bt) * (t - bt)) / (bs * bs)); }
      const yy = lerp(Y0, Y1, 0.5 + 0.5 * sup(qy, 0.62)), ang = az + sup(qx, 0.72) * BAGW * (0.92 + 0.08 * pil);
      const rmin = 0.425, rmax = Math.max(rmin + 0.05, OUT(yy) - 0.04), v = 0.5 + 0.5 * sup(qz, 0.62) * pil, rad = lerp(rmin, rmax, clamp(v, 0, 1));
      p.setXYZ(i, Math.sin(ang) * rad, yy, Math.cos(ang) * rad);
    }
    geo.computeVertexNormals(); return geo;
  };
  const bags = [[0.45, 11, '#d6cfbc'], [0.45 + (Math.PI * 2) / 3, 23, '#d2cbb8'], [0.45 + (Math.PI * 4) / 3, 37, '#d8d0be']];
  for (const [az, seed, col] of bags) add(scene, wedge(az, seed), std(0xffffff, 0.86, 0, {map: bagPaint(seed, col), bumpMap: bagPaint(seed, col, true), bumpScale: 0.9}));
  // the mortars: two drogue mortars standing in the gaps between the bags, three small pilot mortars high up by the tunnel; a cap and a bolted foot each
  const mortar = (az, rad, y, r0, h, cap) => {
    const m = new THREE.Group(); m.position.set(Math.sin(az) * rad, y, Math.cos(az) * rad); scene.add(m);
    add(m, new THREE.CylinderGeometry(r0, r0, h, 32), std(0xa2a4a5, 0.34, 0.9));
    add(m, new THREE.CylinderGeometry(r0 + 0.014, r0 + 0.014, 0.03, 32), std(0x55575a, 0.4, 0.85), 0, -h / 2 + 0.02, 0);
    add(m, new THREE.SphereGeometry(r0 * 0.98, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(cap, 0.82, 0), 0, h / 2, 0);
  };
  mortar(0.45 + Math.PI / 3, 0.62, 2.16, 0.088, 0.42, 0xb65a2c); mortar(0.45 + Math.PI, 0.62, 2.16, 0.088, 0.42, 0xb65a2c);
  mortar(0.45 + (Math.PI * 5) / 3, 0.6, 2.1, 0.045, 0.26, 0xbcae8c); mortar(0.45 + (Math.PI * 5) / 3 + 0.14, 0.72, 2.08, 0.045, 0.26, 0xbcae8c); mortar(0.45 + (Math.PI * 5) / 3 - 0.14, 0.72, 2.08, 0.045, 0.26, 0xbcae8c);
  // risers: steel cables looped from the bags to the tunnel's foot
  const steelC = std(0xc0c0ba, 0.32, 0.95);
  for (let i = 0; i < 3; i++) { const az = 0.45 + (i * Math.PI * 2) / 3 + Math.PI / 3, pts = [V3(Math.sin(az) * 0.46, 2.03, Math.cos(az) * 0.46), V3(Math.sin(az + 0.3) * 0.74, 2.08, Math.cos(az + 0.3) * 0.74), V3(Math.sin(az + 0.1) * 0.86, 2.0, Math.cos(az + 0.1) * 0.86), V3(Math.sin(az - 0.2) * 0.72, 1.98, Math.cos(az - 0.2) * 0.72), V3(Math.sin(az - 0.5) * 0.5, 2.0, Math.cos(az - 0.5) * 0.5)]; add(scene, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.011, 8), steelC); }
  // the soft key from above the bay and a cold rim from behind
  spot(scene, 0xfff0dd, 46, V3(-2.2, 7.4, 3.8), V3(0, 2.35, 0), 0.2, 1, 1.3, 18, 2048, 2, 14, -0.0005, 0.008);
  spot(scene, 0xa8bedd, 10, V3(3.4, 4.6, -4.2), V3(0, 2.0, 0), 0.5, 1, 1.3, 14);
  spot(scene, 0xb8c4d8, 4.2, V3(-3.6, -1.6, 5.5), V3(0, 0.8, 0), 0.5, 1, 1.3, 14);
  scene.add(new THREE.AmbientLight(0x454850, 0.18));
  return {draw: (f) => {
    const k = ease(f / 299), t = lerp(-0.86, -0.04, k), rad = lerp(9.6, 3.5, k), h = lerp(2.9, 4.9, k);
    camera.position.set(Math.sin(t) * rad, h, Math.cos(t) * rad);
    camera.lookAt(0, lerp(1.32, 2.36, k), 0); camera.fov = lerp(30, 27, k); camera.up.set(0, 1, 0);
  }};
});

// ---------------------------------------------------------------- GMeter
// A G dial in the dark. Under the chutes it reads a little over 1. At frame HIT (3 s) the needle swings to 15 and the whole picture is struck; the needle falls back and a thin peak pointer stays where it reached.
export const GMeter = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e, HIT = 90;
  camera.near = 0.05; camera.far = 200;
  e.final.bloom.value = 0.62; e.final.exposure.value = 1.15; e.final.vign.value = 1.2; e.final.grain.value = 0.02;
  scene.environment = envOf(e, [[0xfff2e0, 2.6, -3, 5, 4, 4, 2], [0xbcd0ff, 0.8, 5, 0, 5, 2, 5]]); scene.environmentIntensity = 0.6;
  const ANG = (g) => -2.36 + (g / 20) * 4.72;              // 0 at lower left, clockwise to 20 at lower right
  const [fc, fg] = canvasOf(2048, 2048), C = 1024;
  fg.fillStyle = '#0b0b0c'; fg.fillRect(0, 0, 2048, 2048);
  const [gc, gg] = canvasOf(2048, 2048); gg.fillStyle = '#000'; gg.fillRect(0, 0, 2048, 2048);
  for (const g of [fg, gg]) {
    g.strokeStyle = g.fillStyle = '#efeee4'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i <= 40; i++) { const v = i / 2, t = ANG(v), x = Math.sin(t), y = -Math.cos(t), big = i % 10 === 0, mid = i % 2 === 0; g.lineWidth = big ? 16 : mid ? 8 : 4; g.beginPath(); g.moveTo(C + x * (big ? 740 : mid ? 800 : 840), C + y * (big ? 740 : mid ? 800 : 840)); g.lineTo(C + x * 900, C + y * 900); g.stroke(); }
    g.font = '700 150px Arial, sans-serif'; for (let v = 0; v <= 20; v += 5) { const t = ANG(v); g.fillText(String(v), C + Math.sin(t) * 580, C - Math.cos(t) * 580); }
    g.font = '700 190px Arial, sans-serif'; g.fillText('G', C, C + 430);
  }
  // a little wear, because this has been to the Moon
  const r0 = rng(17); for (let i = 0; i < 2400; i++) { fg.fillStyle = `rgba(255,255,255,${r0() * 0.012})`; fg.fillRect(r0() * 2048, r0() * 2048, 2 + r0() * 8, 2 + r0() * 8); }
  const face = new THREE.Mesh(new THREE.CircleGeometry(1, 96), std(0xffffff, 0.62, 0.05, {map: texOf(fc), emissive: 0xffc98a, emissiveMap: texOf(gc), emissiveIntensity: 0.22})); face.position.z = 0.055; face.receiveShadow = true; scene.add(face);
  const dark = std(0x18191b, 0.52, 0.55), steel = std(0x8a8c8c, 0.46, 0.9);
  // the housing: a square plate with the round bezel in it, the panel it sits in, neighbours' edges
  const hs = new THREE.Shape(); hs.moveTo(-1.32, -1.32); hs.lineTo(1.32, -1.32); hs.lineTo(1.32, 1.32); hs.lineTo(-1.32, 1.32); hs.closePath(); const hh = new THREE.Path(); hh.absarc(0, 0, 1.03, 0, Math.PI * 2, true); hs.holes.push(hh);
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, {depth: 0.09, bevelEnabled: true, bevelSize: 0.022, bevelThickness: 0.022, bevelSegments: 3, curveSegments: 96}), dark); plate.position.z = 0.12; plate.castShadow = plate.receiveShadow = true; scene.add(plate);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.03, 1.03, 0.28, 96, 1, true), std(0x1a1b1d, 0.5, 0.6, {side: THREE.BackSide})); well.rotation.x = Math.PI / 2; well.position.z = 0.1; well.receiveShadow = true; scene.add(well);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 20, 128), std(0x54565a, 0.3, 0.95)); bezel.position.z = 0.25; bezel.castShadow = true; scene.add(bezel);
  stamp(scene, new THREE.CylinderGeometry(0.052, 0.058, 0.03, 24), steel, [[-1.17, -1.17], [1.17, -1.17], [-1.17, 1.17], [1.17, 1.17]].map(([x, y]) => mat4(x, y, 0.24, Math.PI / 2)));
  stamp(scene, new THREE.BoxGeometry(0.075, 0.012, 0.012), dark, [[-1.17, -1.17, 0.6], [1.17, -1.17, 2], [-1.17, 1.17, 1.1], [1.17, 1.17, 0.2]].map(([x, y, a]) => mat4(x, y, 0.255, 0, 0, a)), false);
  const [pc] = noiseCanvas(1024, 1024, '#35373a', 8, 2600, 0.03);
  add(scene, new THREE.PlaneGeometry(14, 10), std(0xffffff, 0.68, 0.25, {map: texOf(pc)}), 0, 0, 0.05, 0, 0, 0, false);
  // a row of switches and another gauge's rim, just catching the light at the frame's edges
  const lv = LEVER(), lvM = std(0xd8d8d2, 0.15, 1);
  stamp(scene, lv, lvM, [[-3.0, 1.1], [-3.0, 0.3], [-3.0, -0.5], [-3.0, -1.3], [3.1, 1.2], [3.1, 0.4], [3.1, -0.4], [3.1, -1.2]].map(([x, y], i) => mat4(x, y, 0.1, Math.PI / 2 - (i % 3 ? 0.5 : -0.5), 0, 0, 1.6)));
  stamp(scene, new THREE.CylinderGeometry(0.11, 0.13, 0.08, 6), steel, [[-3.0, 1.1], [-3.0, 0.3], [-3.0, -0.5], [-3.0, -1.3], [3.1, 1.2], [3.1, 0.4], [3.1, -0.4], [3.1, -1.2]].map(([x, y]) => mat4(x, y, 0.08, Math.PI / 2)));
  // the needles
  const needleShape = new THREE.Shape(); needleShape.moveTo(-0.022, -0.28); needleShape.lineTo(0.022, -0.28); needleShape.lineTo(0.013, 0.86); needleShape.lineTo(0, 0.92); needleShape.lineTo(-0.013, 0.86); needleShape.closePath();
  const needleG = new THREE.ExtrudeGeometry(needleShape, {depth: 0.01, bevelEnabled: false});
  const needleM = std(0xfbfaf2, 0.45, 0, {emissive: 0xffb873, emissiveIntensity: 0.5}), peakM = std(0xe8a53a, 0.4, 0.2, {emissive: 0xe8a53a, emissiveIntensity: 0.55});
  const nPiv = new THREE.Group(); nPiv.position.z = 0.115; const nM = new THREE.Mesh(needleG, needleM); nM.castShadow = true; nPiv.add(nM); scene.add(nPiv);
  const pPiv = new THREE.Group(); pPiv.position.z = 0.08; const pM = new THREE.Mesh(new THREE.BoxGeometry(0.014, 1.06, 0.006), peakM); pM.position.y = 0.4; pM.castShadow = true; pPiv.add(pM); scene.add(pPiv);
  add(scene, new THREE.CylinderGeometry(0.1, 0.12, 0.05, 40), std(0x101112, 0.3, 0.7), 0, 0, 0.145, Math.PI / 2);
  add(scene, new THREE.SphereGeometry(0.05, 20, 12), std(0x777a7c, 0.25, 1), 0, 0, 0.165);
  // a smear of the needle while it's moving fast: copies between last frame's angle and this one's
  const ghosts = Array.from({length: 7}, () => { const m = new THREE.Mesh(needleG, new THREE.MeshBasicMaterial({color: new THREE.Color(1.0, 0.92, 0.82), transparent: true, opacity: 0, depthWrite: false})); m.position.z = 0.11; scene.add(m); return m; });
  // the glass
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1.03, 96), new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.11, depthWrite: false, envMapIntensity: 2.2})); glass.position.z = 0.215; scene.add(glass);
  // dust in the beam; it jumps at the hit and hangs
  const N = 110, pos = new Float32Array(N * 3), rd = rng(99), seeds = Array.from({length: N}, () => [rd() * 7 - 3.5, rd() * 5 - 2.5, 0.3 + rd() * 3.2, rd(), rd()]);
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const [mc, mg] = canvasOf(64, 64), gd = mg.createRadialGradient(32, 32, 0, 32, 32, 32); gd.addColorStop(0, 'rgba(255,255,255,1)'); gd.addColorStop(1, 'rgba(255,255,255,0)'); mg.fillStyle = gd; mg.fillRect(0, 0, 64, 64);
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({map: texOf(mc), size: 0.05, color: new THREE.Color(0.5, 0.42, 0.33), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, sizeAttenuation: true})); dust.frustumCulled = false; scene.add(dust);
  // the light: a narrow flood from the upper left, so the needle throws a real shadow on the face
  const key = spot(scene, 0xffe6c8, 26, V3(-2.2, 3.0, 4.4), V3(0, 0, 0), 0.34, 0.8, 1.3, 16, 2048, 1, 12, -0.0003, 0.004);
  const amber = spot(scene, 0xff8a30, 5, V3(5, -3.2, 3), V3(0, 0, 0), 0.6, 1, 1.4, 12);
  scene.add(new THREE.AmbientLight(0x3b3e44, 0.2));
  // the reading as a pure function of the frame: a sway under the chutes, the hit, a bounce at the top, a fall with a ring
  const gOf = (f) => {
    const d = f - HIT;
    if (d < 0) return 1.12 + Math.sin(f * 0.11) * 0.09 + Math.sin(f * 0.37) * 0.02;
    if (d <= 3) return lerp(1.1, 15.4, ease(d / 3));
    if (d <= 14) return 15 + 0.42 * Math.cos((d - 3) * 1.25) * Math.exp(-(d - 3) * 0.24);
    if (d <= 42) { const v = ease((d - 14) / 28); return lerp(15, 1, v * v); }
    return 1 + 1.25 * Math.exp(-(d - 42) * 0.075) * Math.cos((d - 42) * 0.42);
  };
  return {draw: (f) => {
    const d = f - HIT, g = gOf(f), gp = gOf(f - 1);
    nPiv.rotation.z = -ANG(g); pPiv.rotation.z = -ANG(f < HIT ? 1.3 : Math.max(1.3, Math.min(15, lerp(1.3, 15, clamp(d / 3)))));
    const dv = Math.abs(ANG(g) - ANG(gp)), blur = clamp((dv - 0.1) * 2.2);
    ghosts.forEach((m, i) => { m.rotation.z = -lerp(ANG(gp), ANG(g), (i + 0.5) / 7); m.material.opacity = 0.2 * blur; m.visible = blur > 0.01; });
    // the blow: a very hard jolt that dies fast, plus a rattle
    const hit = d >= 0 ? Math.exp(-d * 0.11) : 0, jolt = d >= 0 && d <= 2 ? [0.32, -0.26, 0.18][d] : 0;
    const sx = Math.sin(f * 11.3) * Math.cos(f * 3.1) * 0.13 * hit, sy = jolt + Math.cos(f * 9.7) * Math.sin(f * 4.3) * 0.15 * hit;
    const k = ease(f / 239), sw = Math.sin(f * 0.052) * 0.05;
    camera.position.set(lerp(-1.0, 0.25, k) + sx + sw, lerp(-0.55, -0.25, k) + sy, lerp(5.6, 4.7, k));
    camera.lookAt(lerp(-0.06, 0.1, k) + sx * 0.5, lerp(0.05, 0.08, k) + sy * 0.5, 0);
    camera.fov = 30; camera.up.set(Math.sin(f * 7.1) * 0.02 * hit + 0.018 * hit * (d < 8 ? 1 : 0), 1, 0);
    const flick = d >= 0 && d < 24 ? (Math.sin(f * 2.9) > 0.15 ? 1 : 0.45) : 1, off = d >= 0 && d < 3 ? 0.5 : 1;
    key.intensity = 26 * flick * off; amber.intensity = 5 * (d >= 0 ? 1.4 : 1); face.material.emissiveIntensity = 0.22 * flick;
    for (let i = 0; i < N; i++) { const [x, y, z, a, b] = seeds[i], rise = d >= 0 ? (1 - Math.exp(-d * 0.05)) * (0.3 + a * 0.7) * 1.1 : 0; pos[i * 3] = x + Math.sin(f * 0.012 + b * 9) * 0.1 + rise * (a - 0.5) * 0.6; pos[i * 3 + 1] = y + Math.cos(f * 0.01 + a * 9) * 0.1 + rise * (b - 0.35); pos[i * 3 + 2] = z; }
    dustG.attributes.position.needsUpdate = true; dust.material.opacity = d >= 0 ? clamp(d / 4) * (0.7 - clamp((d - 60) / 160) * 0.35) : 0.1;
    e.final.white.value = 0;
  }};
});

// ---------------------------------------------------------------- BreakerPull
// A row of circuit breakers on Panel 5. IMU MN A pulls out at frame 42, MN B at 68 (1.4 s, 2.27 s). A hard cut at frame SPLIT (4 s) to the guidance unit, see-through: gyros running down while a counter runs three minutes fast (03:00 at frame 330, 11 s).
export const BreakerPull = () => useScene((e) => {
  indoors(e); shadows(e);
  const {scene, camera} = e, SPLIT = 120, CB1 = 42, CB2 = 68, C0 = 138, C1 = 330;
  camera.near = 0.04; camera.far = 200;
  e.final.grain.value = 0.018;
  scene.environment = envOf(e, [[0xffb066, 2.2, -6, 3, 4, 4, 3], [0xc2d4f4, 1.8, 5, 5, 4, 5, 2], [0xffffff, 0.3, 0, -7, 3, 8, 3]]); scene.environmentIntensity = 0.7;
  // ---- part one: the breakers
  const A = new THREE.Group(); scene.add(A);
  const COLS = 16, ROWS = 3, PX = 0.62, PY = 1.32, x0 = -((COLS - 1) * PX) / 2, IMU_COL = 8;
  const [pc, pg] = noiseCanvas(4096, 2048, '#3f4246', 13, 4200, 0.03);
  const W = 16, H = 8, tx = (x) => ((x + W / 2) / W) * 4096, ty = (y) => ((H / 2 - y) / H) * 2048;
  pg.fillStyle = 'rgba(232,231,222,0.93)'; pg.textAlign = 'center'; pg.textBaseline = 'middle';
  const put = (x, y, t, s = 30) => { pg.fillStyle = 'rgba(232,231,222,0.93)'; pg.font = `700 ${s}px Arial, sans-serif`; pg.letterSpacing = '2px'; pg.fillText(t, tx(x), ty(y)); };
  const bra = (a, b, y, t) => { const m = (a + b) / 2; pg.font = '700 30px Arial, sans-serif'; const hw = t ? (pg.measureText(t).width / 4096) * W / 2 + 0.05 : 0; pg.strokeStyle = 'rgba(232,231,222,0.9)'; pg.lineWidth = 3; pg.beginPath(); pg.moveTo(tx(a), ty(y - 0.08)); pg.lineTo(tx(a), ty(y)); pg.lineTo(tx(m - hw), ty(y)); if (hw) pg.moveTo(tx(m + hw), ty(y)); pg.lineTo(tx(b), ty(y)); pg.lineTo(tx(b), ty(y - 0.08)); pg.stroke(); if (t) put(m, y, t); };
  const colX = (c) => x0 + c * PX, rowY = (r) => (ROWS - 1 - r) * PY - PY * 0.65;
  const ROW1 = rowY(1);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 1; c += 2) { const name = r !== 1 ? '' : c === IMU_COL ? 'IMU' : c === IMU_COL + 2 ? 'OPTICS' : c === IMU_COL - 2 ? 'COMPUTER' : ''; bra(colX(c) - 0.1, colX(c + 1) + 0.1, rowY(r) + 0.62, name); put(colX(c), rowY(r) + 0.42, 'MN A'); put(colX(c + 1), rowY(r) + 0.42, 'MN B'); }
  add(A, new THREE.PlaneGeometry(W, H), std(0xffffff, 0.62, 0.25, {map: texOf(pc)}), 0, 0, 0, 0, 0, 0, false);
  // a breaker: a threaded collar and nut on the panel; a push-pull button; white band on the stem shows when it's out
  const rate = (n) => { const [c, g] = canvasOf(256, 256); g.fillStyle = '#0d0d0e'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#e9e8de'; g.font = '700 130px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 128, 138); return texOf(c); };
  const rates = {5: rate('5'), 10: rate('10'), 7.5: rate('7.5'), 15: rate('15')};
  const btnPts = [[0, 0], [0.135, 0], [0.145, 0.02], [0.145, 0.19], [0.13, 0.225], [0.09, 0.238], [0, 0.238]].map(([a, b]) => new THREE.Vector2(a, b));
  const btnG = new THREE.LatheGeometry(btnPts, 40), capM = {}, btnM = std(0x0d0d0e, 0.34, 0.15);
  const nutM = std(0x96989a, 0.3, 1), stemM = std(0xc4c4c0, 0.3, 0.9), bandM = std(0xf6f5ec, 0.5, 0, {emissive: 0xffffff, emissiveIntensity: 0.1});
  const nuts = [], rings = []; const moving = {};
  const rr = rng(7);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = colX(c), y = rowY(r), v = [5, 10, 5, 7.5, 15, 5][Math.floor(rr() * 6)], val = r === 1 && (c === IMU_COL || c === IMU_COL + 1) ? 5 : v;
    nuts.push(mat4(x, y, 0.03, Math.PI / 2)); rings.push(mat4(x, y, 0.07, Math.PI / 2));
    const b = new THREE.Group(); b.position.set(x, y, 0); A.add(b);
    const shaft = add(b, new THREE.CylinderGeometry(0.075, 0.075, 0.4, 24), stemM, 0, 0, 0.05, Math.PI / 2);
    const band = add(b, new THREE.CylinderGeometry(0.0785, 0.0785, 0.24, 24), bandM, 0, 0, 0.21, Math.PI / 2);
    const btn = add(b, btnG, btnM, 0, 0, 0.1, Math.PI / 2);
    if (!capM[val]) capM[val] = new THREE.MeshStandardMaterial({map: rates[val], roughness: 0.5});
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.09, 32), capM[val]); top.position.set(0, 0, 0.339); b.add(top);
    if (r === 1 && c === IMU_COL) moving.a = [btn, top]; if (r === 1 && c === IMU_COL + 1) moving.b = [btn, top];
  }
  stamp(A, new THREE.CylinderGeometry(0.17, 0.17, 0.05, 6), nutM, nuts); stamp(A, new THREE.CylinderGeometry(0.105, 0.125, 0.045, 32), nutM, rings);
  const setOut = (parts, z) => { parts.forEach((p, i) => { p.position.z = ([0.1, 0.339])[i] + z; }); };
  spot(A, 0xffb878, 46, V3(-9.5, 1.2, 4.4), V3(0.5, -0.4, 0), 0.5, 0.9, 1.4, 24, 2048, 1, 22, -0.0003, 0.004);
  spot(A, 0xc4d4f4, 16, V3(5, 6, 7), V3(0.4, -0.4, 0), 0.5, 1, 1.4, 18);
  A.add(new THREE.AmbientLight(0x74787f, 0.55));

  // ---- part two: the guidance unit
  const B = new THREE.Group(); scene.add(B);
  const brushed = (() => { const [c, g] = canvasOf(512, 64), rb = rng(3); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 64); for (let i = 0; i < 900; i++) { const v = 90 + rb() * 80; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rb() * 512, rb() * 64, 30 + rb() * 120, 1); } const t = texOf(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const alu = std(0xb9bbbb, 0.3, 1, {roughnessMap: brushed}), gold = std(0xb5935a, 0.34, 1), dkm = std(0x24262a, 0.42, 0.75), coil = std(0x7a4a22, 0.45, 0.8);
  const gimbal = (Rr, w, t) => { const pts = [[Rr - t, -w / 2 + 0.012], [Rr - t + 0.012, -w / 2], [Rr - 0.012, -w / 2], [Rr, -w / 2 + 0.012], [Rr, w / 2 - 0.012], [Rr - 0.012, w / 2], [Rr - t + 0.012, w / 2], [Rr - t, w / 2 - 0.012], [Rr - t, -w / 2 + 0.012]].map(([a, b]) => new THREE.Vector2(a, b)); return new THREE.LatheGeometry(pts, 128); };
  const axle = (parent, Rr, dirX, motor = true) => { for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(dirX ? s * Rr : 0, dirX ? 0 : s * Rr, 0); if (dirX) g.rotation.z = Math.PI / 2; parent.add(g); add(g, new THREE.CylinderGeometry(0.1, 0.12, 0.3, 28), s > 0 && motor ? gold : alu); add(g, new THREE.CylinderGeometry(0.135, 0.135, 0.05, 28), dkm); } };
  // outer gimbal (turns about Y), middle (about X inside it), inner (about Y inside that), the stable member in the middle
  const OUTER = new THREE.Group(), MID = new THREE.Group(), IN = new THREE.Group(), STABLE = new THREE.Group();
  B.add(OUTER); OUTER.add(MID); MID.add(IN); IN.add(STABLE);
  add(OUTER, gimbal(2.3, 0.2, 0.09), alu, 0, 0, 0, Math.PI / 2, 0, 0); axle(OUTER, 2.34, false);
  add(MID, gimbal(1.98, 0.18, 0.085), alu, 0, 0, 0, 0, 0, 0); axle(MID, 2.2, true);
  add(IN, gimbal(1.68, 0.16, 0.08), alu, 0, 0, 0, Math.PI / 2, 0, 0); axle(IN, 1.86, false);
  axle(IN, 1.5, true);
  OUTER.rotation.y = 0.5; MID.rotation.x = 0.42; IN.rotation.y = -0.55; STABLE.rotation.set(0.25, 0.3, 0.12);
  // the stable member and three gyros, cut away so the wheels show; each wheel carries bright marks so its speed reads
  add(STABLE, new RoundedBoxGeometry(1.12, 1.12, 1.12, 5, 0.1), std(0x6d7073, 0.42, 0.9));
  const wheelTex = (() => { const [c, g] = canvasOf(1024, 1024); g.fillStyle = '#2a2b2e'; g.beginPath(); g.arc(512, 512, 510, 0, 7); g.fill(); g.fillStyle = '#d8d8d2'; g.beginPath(); g.arc(512, 512, 500, 0, 7); g.fill(); g.fillStyle = '#17181a'; g.beginPath(); g.arc(512, 512, 430, 0, 7); g.fill(); for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; g.fillStyle = i % 3 === 0 ? '#e8a53a' : '#cfcfc8'; g.save(); g.translate(512, 512); g.rotate(t); g.fillRect(-26, 140, 52, 270); g.restore(); } g.fillStyle = '#9fa0a0'; g.beginPath(); g.arc(512, 512, 120, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(512, 512, 34, 0, 7); g.fill(); return texOf(c); })();
  const blurTex = (() => { const [c, g] = canvasOf(1024, 1024); g.fillStyle = '#2a2b2e'; g.beginPath(); g.arc(512, 512, 510, 0, 7); g.fill(); g.fillStyle = '#d8d8d2'; g.beginPath(); g.arc(512, 512, 500, 0, 7); g.fill(); const gr = g.createRadialGradient(512, 512, 120, 512, 512, 430); gr.addColorStop(0, '#6b6a66'); gr.addColorStop(0.3, '#57564f'); gr.addColorStop(0.94, '#4e4c44'); gr.addColorStop(1, '#17181a'); g.fillStyle = gr; g.beginPath(); g.arc(512, 512, 430, 0, 7); g.fill(); g.fillStyle = '#9fa0a0'; g.beginPath(); g.arc(512, 512, 120, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(512, 512, 34, 0, 7); g.fill(); return texOf(c); })();
  const wheels = [];
  const glassM = new THREE.MeshPhysicalMaterial({color: 0xcfe0ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6});
  const gyro = (rx, ry, rz, phase) => {
    const g = new THREE.Group(); g.rotation.set(rx, ry, rz); STABLE.add(g);          // the group's +z is the gyro's outward axis
    add(g, new THREE.CylinderGeometry(0.62, 0.62, 0.14, 64), dkm, 0, 0, 0.62, Math.PI / 2);
    add(g, new THREE.TorusGeometry(0.62, 0.018, 12, 80), gold, 0, 0, 0.72);
    add(g, new THREE.TorusGeometry(0.62, 0.018, 12, 80), gold, 0, 0, 1.02);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 64, 1, true), glassM); can.rotation.x = Math.PI / 2; can.position.z = 0.87; g.add(can);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.62, 64), glassM); cap.position.z = 1.02; g.add(cap);
    for (const [a, b] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), gold, a * 0.72, b * 0.72, 0.87, Math.PI / 2);
    const w = new THREE.Group(); w.position.z = 0.87; g.add(w);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.54, 96), new THREE.MeshStandardMaterial({map: wheelTex, roughness: 0.32, metalness: 0.75})); disc.castShadow = true; w.add(disc);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.09, 96, 1, true), std(0x9fa1a2, 0.28, 1)); rim.rotation.x = Math.PI / 2; rim.position.z = -0.045; w.add(rim);
    const blur = new THREE.Mesh(new THREE.CircleGeometry(0.542, 96), new THREE.MeshStandardMaterial({map: blurTex, roughness: 0.42, metalness: 0.6, transparent: true, opacity: 1, depthWrite: false})); blur.position.set(0, 0, 0.875); g.add(blur);
    wheels.push({w, blur, phase});
  };
  gyro(0, 0, 0, 0.3); gyro(-Math.PI / 2, 0, 0, 1.7); gyro(0, Math.PI / 2, 0, 4.1);
  add(STABLE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0.5, 0.56, 0.3), V3(0.9, 0.9, 0.4), V3(1.4, 0.3, 0.4), V3(1.6, 0, 0)]), 40, 0.02, 8), coil);
  add(STABLE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-0.5, -0.56, 0.3), V3(-0.9, -0.9, 0.2), V3(-1.4, -0.3, 0.4), V3(-1.6, 0, 0)]), 40, 0.02, 8), coil);
  // the case: a ball of light round it all, a mount below
  const caseM = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: {},
    vertexShader: 'out vec3 vN; out vec3 vV; void main(){ vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-m.xyz); gl_Position = projectionMatrix * m; }',
    fragmentShader: 'precision highp float; in vec3 vN; in vec3 vV; out vec4 o; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); o = vec4(vec3(0.5, 0.62, 0.78) * (0.008 + 0.34 * pow(f, 3.8)), 1.0); }'});
  const ball = new THREE.Mesh(new THREE.SphereGeometry(2.72, 96, 64), caseM); ball.renderOrder = 4; B.add(ball);
  add(B, new THREE.CylinderGeometry(1.5, 1.95, 0.36, 72), std(0x24262a, 0.5, 0.7), 0, -2.74, 0);
  add(B, new THREE.CylinderGeometry(3.6, 3.6, 0.12, 96), std(0x141517, 0.62, 0.45), 0, -2.98, 0);
  const bs = []; for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; bs.push(mat4(Math.cos(t) * 1.74, -2.76, Math.sin(t) * 1.74)); }
  stamp(B, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6), std(0x8a8c8c, 0.3, 1), bs, false);
  // the counter: four real drums behind four windows in a face plate, MIN and SEC cut into it
  const CT = new THREE.Group(); CT.position.set(-3.1, -1.62, 3.0); CT.rotation.y = 0.32; CT.scale.setScalar(1.08); B.add(CT);
  const [fcc, fgg] = noiseCanvas(1600, 800, '#25272a', 6, 1400, 0.03); fgg.fillStyle = '#ecebe2'; fgg.textAlign = 'center'; fgg.textBaseline = 'middle'; fgg.font = '700 74px Arial, sans-serif'; fgg.letterSpacing = '6px'; fgg.fillText('MIN', 433, 92); fgg.fillText('SEC', 1058, 92);
  fgg.strokeStyle = '#ecebe2'; fgg.lineWidth = 6; fgg.beginPath(); fgg.moveTo(210, 92); fgg.lineTo(340, 92); fgg.moveTo(526, 92); fgg.lineTo(655, 92); fgg.moveTo(835, 92); fgg.lineTo(965, 92); fgg.moveTo(1151, 92); fgg.lineTo(1280, 92); fgg.moveTo(210, 92); fgg.lineTo(210, 130); fgg.moveTo(655, 92); fgg.lineTo(655, 130); fgg.moveTo(835, 92); fgg.lineTo(835, 130); fgg.moveTo(1280, 92); fgg.lineTo(1280, 130); fgg.stroke();
  const faceS = new THREE.Shape(), HW = 1.4, HH = 0.62; faceS.moveTo(-HW, -HH); faceS.lineTo(HW, -HH); faceS.lineTo(HW, HH); faceS.lineTo(-HW, HH); faceS.closePath();
  const winR = [[-0.92, -0.42, 0.2, 0.48], [-0.46, -0.42, 0.2, 0.48], [0.12, -0.42, 0.2, 0.48], [0.58, -0.42, 0.2, 0.48]]; // x-centre, y-bottom, half-width, height
  for (const [cxx, by, hw, h] of winR) { const hh = new THREE.Path(); hh.moveTo(cxx - hw, by); hh.lineTo(cxx - hw, by + h); hh.lineTo(cxx + hw, by + h); hh.lineTo(cxx + hw, by); hh.closePath(); faceS.holes.push(hh); }
  const faceG = new THREE.ShapeGeometry(faceS); { const uv = faceG.attributes.uv, p = faceG.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + HW) / (2 * HW), (p.getY(i) + HH) / (2 * HH)); }
  const faceM = new THREE.Mesh(faceG, new THREE.MeshStandardMaterial({map: texOf(fcc), roughness: 0.48, metalness: 0.35})); faceM.position.z = 0.34; faceM.receiveShadow = true; CT.add(faceM);
  add(CT, new THREE.BoxGeometry(2.86, 1.3, 0.04), std(0x0c0c0d, 0.8, 0.3), 0, 0, -0.34);       // the back of the box
  const digitTex = (n) => { const [c, g] = canvasOf(256, 1024); g.fillStyle = '#e9e8de'; g.fillRect(0, 0, 256, 1024); g.fillStyle = '#121213'; g.font = `700 ${Math.round((1024 / n) * 0.8)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let i = 0; i < n; i++) g.fillText(String(i), 128, 1024 - (i + 0.5) * (1024 / n) + 4); const t = texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const drum = (x, n) => { const r2 = (0.48 * n) / (2 * Math.PI) * 1.02, arc = 2 * Math.asin(Math.min(0.9, 0.3 / r2)), g = new THREE.CylinderGeometry(r2, r2, 0.38, 48, 1, true, -arc / 2, arc); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const th = -arc / 2 + uv.getX(i) * arc; uv.setXY(i, uv.getY(i), -th / (Math.PI * 2)); } const map = digitTex(n), m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({map, roughness: 0.55, metalness: 0.05})); m.rotation.z = -Math.PI / 2; m.position.set(x, -0.18, 0.31 - r2); CT.add(m); return {map, n}; };
  const drums = [drum(-0.92, 10), drum(-0.46, 10), drum(0.12, 6), drum(0.58, 10)];
  add(CT, new RoundedBoxGeometry(0.1, 0.1, 0.03, 2, 0.01), std(0xe9e8de, 0.5, 0), -0.17, -0.06, 0.345, 0, 0, 0, false);
  add(CT, new RoundedBoxGeometry(0.1, 0.1, 0.03, 2, 0.01), std(0xe9e8de, 0.5, 0), -0.17, -0.3, 0.345, 0, 0, 0, false);
  const ctM = std(0x54565a, 0.4, 0.8);
  add(CT, new THREE.BoxGeometry(2.88, 0.04, 0.72), ctM, 0, -0.64, -0.02); add(CT, new THREE.BoxGeometry(2.88, 0.04, 0.72), ctM, 0, 0.64, -0.02); add(CT, new THREE.BoxGeometry(0.04, 1.3, 0.72), ctM, -1.42, 0, -0.02); add(CT, new THREE.BoxGeometry(0.04, 1.3, 0.72), ctM, 1.42, 0, -0.02);
  stamp(CT, new THREE.CylinderGeometry(0.034, 0.034, 0.02, 20), std(0x9a9c9c, 0.3, 1), [[-1.3, -0.52], [1.3, -0.52], [-1.3, 0.52], [1.3, 0.52]].map(([x, y]) => mat4(x, y, 0.35, Math.PI / 2)), false);
  add(B, new THREE.CylinderGeometry(0.1, 0.14, 1.3, 24), std(0x24262a, 0.5, 0.7), -3.1, -2.5, 3.0);
  spot(B, 0xfff0dd, 170, V3(-5.4, 8.5, 6.4), V3(0, -0.2, 0.4), 0.46, 0.9, 1.3, 26, 2048, 2, 22, -0.0005, 0.012);
  spot(B, 0xa8bedd, 44, V3(7, 3.4, -7), V3(0, 0, 0), 0.5, 1, 1.3, 24);
  spot(B, 0xffd8a8, 26, V3(-5.6, 0.5, 9.8), V3(-3.1, -1.6, 3.0), 0.3, 1, 1.3, 18);
  B.add(new THREE.AmbientLight(0x3f434a, 0.32));
  // the counter's seconds as a pure function of the frame; the wheels' angle follows from it in closed form
  const clockAt = (f) => { const x = clamp((f - C0) / (C1 - C0)); return 180 * (1 - Math.pow(1 - x, 1.8)); };
  const speedAt = (c) => Math.pow(1 - c / 180, 1.6);        // of the full speed; down to nothing at 3:00
  return {draw: (f) => {
    const first = f < SPLIT; A.visible = first; B.visible = !first;
    if (first) {
      e.final.bloom.value = 0.42; e.final.exposure.value = 1.25; e.final.vign.value = 1.05; scene.environmentIntensity = 1.0; e.skyHi.set(0, 0, 0); e.skyLo.set(0, 0, 0);
      const out = (f0) => { const d = f - f0; return d < 0 ? 0 : d <= 3 ? lerp(0, 0.235, ease(d / 3)) : d <= 5 ? lerp(0.235, 0.21, (d - 3) / 2) : 0.21; };
      setOut(moving.a, out(CB1)); setOut(moving.b, out(CB2));
      const k = ease(f / 119), kick = (f >= CB1 ? 0.005 * Math.exp(-(f - CB1) * 0.3) : 0) + (f >= CB2 ? 0.005 * Math.exp(-(f - CB2) * 0.3) : 0), sh = 0.0028 + kick;
      const X = colX(IMU_COL) + PX / 2, Y = ROW1;
      camera.position.set(lerp(X + 3.0, X + 1.35, k) + Math.sin(f * 2.1) * Math.cos(f * 0.8) * sh, lerp(Y - 1.1, Y - 0.62, k) + Math.cos(f * 1.7) * Math.sin(f * 1.2) * sh, lerp(4.0, 3.15, k));
      camera.lookAt(lerp(X + 0.3, X, k), lerp(Y + 0.02, Y + 0.12, k), 0.1); camera.fov = lerp(32, 29, k); camera.up.set(lerp(0.035, 0.015, k), 1, 0);
    } else {
      e.final.bloom.value = 0.45; e.final.exposure.value = 1.2; e.final.vign.value = 1.05; scene.environmentIntensity = 1.5; e.skyHi.set(0.03, 0.034, 0.043); e.skyLo.set(0.006, 0.007, 0.009);
      const c = clockAt(f), s = speedAt(c);
      // the full speed reads as a blur; below about a turn per second the marks come through and slow to a stop
      const blurOp = clamp((s * 26 - 1.1) / 1.4);
      wheels.forEach(({w, blur, phase}) => { w.rotation.z = phase + 340 * (1 - Math.pow(1 - c / 180, 2.6)); blur.material.opacity = blurOp; blur.visible = blurOp > 0.005; });
      const m = c / 60, sec = c % 60;
      const ones = sec % 10, carry1 = clamp(ones - 9), tens = Math.floor(sec / 10) + carry1, carry2 = sec >= 59 ? clamp(sec - 59) : 0, minOnes = Math.floor(m) + carry2;
      const set = (d, v) => { d.map.offset.y = (v + 0.5) / d.n; };
      set(drums[0], 0); set(drums[1], c >= 180 ? 3 : minOnes); set(drums[2], c >= 180 ? 0 : tens); set(drums[3], c >= 180 ? 0 : ones);
      const k = ease((f - SPLIT) / 239), t = lerp(-0.3, 0.06, k), rad = lerp(14.4, 13.1, k);
      camera.position.set(Math.sin(t) * rad - 0.8, lerp(2.5, 1.5, k), Math.cos(t) * rad);
      camera.lookAt(lerp(-1.05, -1.0, k), lerp(-0.48, -0.5, k), 0.6); camera.fov = 29; camera.up.set(0, 1, 0);
    }
    e.final.white.value = 0;
  }};
});

// ---------------------------------------------------------------- StarSight
// Through the sextant: stars drifting, the reticle; a bright star slides onto the crosshair and stops (on it from 5.5 s). A hard cut at frame SPLIT (7 s) to the computer's display: it works, then reads +00001 (from 8.5 s), VERB 06 NOUN 05 flashing: a star angle difference of one hundredth of a degree. Conrad's 'four balls 1'.
export const StarSight = () => useScene((e) => {
  indoors(e);
  const {scene, camera} = e, SPLIT = 210, READ = 255;
  camera.near = 0.02; camera.far = 4000;
  // ---- part one: the eyepiece
  const A = new THREE.Group(); scene.add(A);
  const N = 460, r = rng(4242), pos = new Float32Array(N * 3), mag = new Float32Array(N), tint = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const a = r() * 6.2832, d = Math.sqrt(r()) * 60; pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = Math.sin(a) * d; pos[i * 3 + 2] = -300; const u = r(); mag[i] = 0.1 + Math.pow(u, 11) * 0.9; const w = r(); tint[i * 3] = w > 0.8 ? 1 : w > 0.5 ? 0.92 : 0.8; tint[i * 3 + 1] = w > 0.8 ? 0.85 : 0.94; tint[i * 3 + 2] = w > 0.8 ? 0.68 : w > 0.5 ? 0.98 : 1; }
  const STAR0 = [14, 7.5], tgt = N - 1; pos[tgt * 3] = STAR0[0]; pos[tgt * 3 + 1] = STAR0[1]; mag[tgt] = 1.7; tint[tgt * 3] = 0.86; tint[tgt * 3 + 1] = 0.93; tint[tgt * 3 + 2] = 1;
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('mag', new THREE.BufferAttribute(mag, 1)); sg.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  const starM = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {scale: {value: 1}},
    vertexShader: 'in float mag; in vec3 tint; out float vM; out vec3 vT; uniform float scale; void main(){ vM = mag; vT = tint; vec4 m = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * m; gl_PointSize = (3.2 + mag * 15.0) * scale; }',
    fragmentShader: 'precision highp float; in float vM; in vec3 vT; out vec4 o; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0; float core = exp(-d * d * 18.0); float halo = exp(-d * d * 4.0) * 0.06; float a = (core + halo) * smoothstep(1.0, 0.7, d); o = vec4(vT * a * (0.5 + vM * 2.2), 1.0); }'});
  const starGroup = new THREE.Group(); const stars = new THREE.Points(sg, starM); stars.frustumCulled = false; starGroup.add(stars); A.add(starGroup);
  // the eyepiece's barrel: real rings, so a push in has depth; the field stop at its far end
  const metal = new THREE.MeshStandardMaterial({color: 0x202124, roughness: 0.46, metalness: 0.6, side: THREE.DoubleSide});
  const barrel = []; const RAD = 1.0;
  for (const [z, rr] of [[6.6, 2.05], [6.3, 1.9], [6.3, 1.72], [5.6, 1.66], [5.45, 1.5], [5.3, 1.5], [4.6, 1.44], [4.45, 1.28], [4.3, 1.28], [3.5, 1.2], [3.36, 1.1], [3.2, 1.1], [2.5, 1.08], [2.36, RAD], [0, RAD]]) barrel.push(new THREE.Vector2(rr, -z));
  const tube = new THREE.Mesh(new THREE.LatheGeometry(barrel, 128), metal); tube.rotation.x = -Math.PI / 2; A.add(tube);
  const cup = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.32, 24, 128), new THREE.MeshStandardMaterial({color: 0x060607, roughness: 0.58, metalness: 0.05})); cup.position.z = 6.8; A.add(cup);
  const ms = new THREE.Shape(); ms.moveTo(-40, -40); ms.lineTo(40, -40); ms.lineTo(40, 40); ms.lineTo(-40, 40); ms.closePath(); const mh = new THREE.Path(); mh.absarc(0, 0, 2.15, 0, Math.PI * 2, true); ms.holes.push(mh);
  const around = new THREE.Mesh(new THREE.ShapeGeometry(ms, 96), new THREE.MeshStandardMaterial({color: 0x121316, roughness: 0.72, metalness: 0.3})); around.position.z = 6.6; A.add(around);
  // the soft edge of the field stop
  const [ec, eg] = canvasOf(1024, 1024), er = eg.createRadialGradient(512, 512, 395, 512, 512, 500); er.addColorStop(0, 'rgba(0,0,0,0)'); er.addColorStop(0.72, 'rgba(0,0,0,0.25)'); er.addColorStop(1, 'rgba(0,0,0,1)'); eg.fillStyle = er; eg.fillRect(0, 0, 1024, 1024);
  const stopMask = new THREE.Mesh(new THREE.CircleGeometry(RAD, 96), new THREE.MeshBasicMaterial({map: texOf(ec), transparent: true, depthWrite: false})); stopMask.position.z = 0.012; stopMask.renderOrder = 4; A.add(stopMask);
  // a faint sky in the optics: not quite black, a touch of light scatter from the cabin's side
  const [sc, sgc] = canvasOf(512, 512), sr = sgc.createRadialGradient(330, 200, 10, 256, 256, 330); sr.addColorStop(0, '#0d141d'); sr.addColorStop(0.7, '#05080c'); sr.addColorStop(1, '#010203'); sgc.fillStyle = sr; sgc.fillRect(0, 0, 512, 512);
  const skyDisc = new THREE.Mesh(new THREE.CircleGeometry(RAD, 96), new THREE.MeshBasicMaterial({map: texOf(sc), depthWrite: false})); skyDisc.position.z = -0.002; skyDisc.renderOrder = -2; A.add(skyDisc);
  // the reticle: etched and faintly lit, double crosshair with a scale, no words
  const [rc, rg] = canvasOf(2048, 2048); rg.clearRect(0, 0, 2048, 2048); rg.strokeStyle = '#fff'; rg.fillStyle = '#fff'; const RC = 1024;
  const line = (x0, y0, x1, y1, w) => { rg.lineWidth = w; rg.beginPath(); rg.moveTo(x0, y0); rg.lineTo(x1, y1); rg.stroke(); };
  for (const s of [-1, 1]) { line(RC + s * 15, 90, RC + s * 15, RC - 110, 2.2); line(RC + s * 15, RC + 110, RC + s * 15, 1958, 2.2); line(90, RC + s * 15, RC - 110, RC + s * 15, 2.2); line(RC + 110, RC + s * 15, 1958, RC + s * 15, 2.2); }
  line(RC - 62, RC, RC - 10, RC, 2.4); line(RC + 10, RC, RC + 62, RC, 2.4); line(RC, RC - 62, RC, RC - 10, 2.4); line(RC, RC + 10, RC, RC + 62, 2.4);
  for (let i = 1; i <= 8; i++) for (const s of [-1, 1]) { const d = i * 100 + 40, big = i % 2 === 0 ? 34 : 22; if (d < 880) { line(RC + s * d, RC - big, RC + s * d, RC + big, 2); line(RC - big, RC + s * d, RC + big, RC + s * d, 2); } }
    const reticleM = new THREE.MeshBasicMaterial({map: texOf(rc), color: new THREE.Color(0.8, 0.42, 0.13), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending});
  const reticle = new THREE.Mesh(new THREE.CircleGeometry(RAD * 0.995, 96), reticleM); reticle.position.z = 0.006; reticle.renderOrder = 3;
  A.add(reticle);
  // dust on the optics
  const [dc, dg] = canvasOf(1024, 1024), rd = rng(90); dg.clearRect(0, 0, 1024, 1024); for (let i = 0; i < 60; i++) { dg.fillStyle = `rgba(190,200,215,${0.015 + rd() * 0.05})`; dg.beginPath(); dg.arc(rd() * 1024, rd() * 1024, 1 + rd() * rd() * 7, 0, 7); dg.fill(); }
  const motes = new THREE.Mesh(new THREE.CircleGeometry(RAD, 64), new THREE.MeshBasicMaterial({map: texOf(dc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); motes.position.z = 0.008; A.add(motes);
  spot(A, 0xffa358, 12, V3(-3.6, 2.4, 11), V3(0, 0, 4.4), 0.42, 0.9, 1.4, 22);
  spot(A, 0x9fb6de, 3, V3(4.4, 4, 10), V3(0, 0, 5), 0.5, 1, 1.4, 20);
  A.add(new THREE.AmbientLight(0x2f3338, 0.2));

  // ---- part two: the computer's display and keyboard
  const B = new THREE.Group(); scene.add(B);
  const envB = envOf(e, [[0xffb066, 2, -6, 3, 4, 4, 3], [0xc2d4f4, 1.4, 5, 5, 4, 5, 2]]);
  const paintGrey = std(0x6f7276, 0.55, 0.45, {envMap: envB, envMapIntensity: 0.6}), dk = std(0x151618, 0.45, 0.6, {envMap: envB, envMapIntensity: 0.6});
  add(B, new RoundedBoxGeometry(8, 8, 0.5, 4, 0.08), paintGrey, 0, 0, -0.25, 0, 0, 0, false);
  add(B, new THREE.PlaneGeometry(40, 30), std(0x101113, 0.8, 0.25), 0, 0, -0.55, 0, 0, 0, false);
  // the electroluminescent panel: redrawn when it changes; lit segments are real emitters so the bloom catches them
  const ELW = 1024, ELH = 1360, [elc, elg] = canvasOf(ELW, ELH), elT = texOf(elc);
  const SEG = {0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd'};
  const seg = (x, y, w, h, s, on) => {
    const t = w * 0.15, gp = t * 0.22, P = {a: [[x + gp, y], [x + w - gp, y], [x + w - t - gp, y + t], [x + t + gp, y + t]], d: [[x + t + gp, y + h - t], [x + w - t - gp, y + h - t], [x + w - gp, y + h], [x + gp, y + h]], f: [[x, y + gp], [x + t, y + t + gp], [x + t, y + h / 2 - t / 2 - gp], [x, y + h / 2 - gp]], b: [[x + w - t, y + t + gp], [x + w, y + gp], [x + w, y + h / 2 - gp], [x + w - t, y + h / 2 - t / 2 - gp]], e: [[x, y + h / 2 + gp], [x + t, y + h / 2 + t / 2 + gp], [x + t, y + h - t - gp], [x, y + h - gp]], c: [[x + w - t, y + h / 2 + t / 2 + gp], [x + w, y + h / 2 + gp], [x + w, y + h - gp], [x + w - t, y + h - t - gp]], g: [[x + t * 0.8 + gp, y + h / 2 - t / 2], [x + w - t * 0.8 - gp, y + h / 2 - t / 2], [x + w - gp, y + h / 2], [x + w - t * 0.8 - gp, y + h / 2 + t / 2], [x + t * 0.8 + gp, y + h / 2 + t / 2], [x + gp, y + h / 2]]}[s];
    elg.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.011)'; elg.beginPath(); P.forEach(([a, b], i) => (i ? elg.lineTo(a, b) : elg.moveTo(a, b))); elg.closePath(); elg.fill();
  };
  const digit = (x, y, w, h, ch) => { const on = ch == null || ch === ' ' ? '' : SEG[ch] || ''; for (const s of 'abcdefg') seg(x, y, w, h, s, on.includes(s)); };
  const sign = (x, y, w, h, c) => { const t = w * 0.17, mid = y + h / 2; elg.fillStyle = c ? '#fff' : 'rgba(255,255,255,0.011)'; elg.fillRect(x, mid - t / 2, w, t); elg.fillStyle = c === '+' ? '#fff' : 'rgba(255,255,255,0.011)'; elg.fillRect(x + w / 2 - t / 2, mid - w / 2, t, w); };
  const reg = (y, s, val) => { const dw = 124, dh = 170, xs = 150; sign(40, y, 84, dh, s); for (let i = 0; i < 5; i++) digit(xs + i * (dw + 28), y, dw, dh, val ? val[i] : ' '); };
  const paintEL = (f) => {
    elg.fillStyle = '#000'; elg.fillRect(0, 0, ELW, ELH);
    const reading = f >= READ, working = f >= SPLIT + 14 && f < READ, comp = working ? (Math.floor(f / 3) % 3 !== 0) : (f >= READ && f < READ + 6);
    // COMP ACTY square, PROG
    elg.fillStyle = comp ? '#fff' : 'rgba(255,255,255,0.011)'; elg.fillRect(60, 40, 300, 170);
    elg.fillStyle = comp ? '#000' : 'rgba(255,255,255,0.06)'; elg.font = '700 52px Arial, sans-serif'; elg.textAlign = 'center'; elg.textBaseline = 'middle'; elg.fillText('COMP', 210, 92); elg.fillText('ACTY', 210, 158);
    const label = (x, y, w, t) => { elg.fillStyle = '#fff'; elg.fillRect(x, y, w, 58); elg.fillStyle = '#000'; elg.font = '700 42px Arial, sans-serif'; elg.fillText(t, x + w / 2, y + 30); };
    label(620, 40, 300, 'PROG'); digit(640, 112, 118, 150, '5'); digit(782, 112, 118, 150, '2');
    const show = reading ? Math.floor((f - READ) / 12) % 2 === 0 : false;
    label(60, 276, 300, 'VERB'); label(620, 276, 300, 'NOUN');
    digit(80, 348, 118, 150, show ? '0' : ' '); digit(222, 348, 118, 150, show ? '6' : ' ');
    digit(640, 348, 118, 150, show ? '0' : ' '); digit(782, 348, 118, 150, show ? '5' : ' ');
    for (const y of [536, 800, 1064]) { elg.fillStyle = 'rgba(255,255,255,0.3)'; elg.fillRect(40, y, 944, 6); }
    reg(590, reading ? '+' : '', reading ? '00001' : null); reg(854, '', null); reg(1118, '', null);
    elT.needsUpdate = true;
  };
  const elM = new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, uniforms: {t: {value: elT}, gain: {value: 1}},
    vertexShader: 'out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float gain; void main(){ vec3 c = texture(t, vUv).rgb; float a = c.r; vec3 glow = vec3(0.2, 1.0, 0.42) * a * 1.5 * gain; o = vec4(glow + vec3(0.004, 0.009, 0.006), 1.0); }'});
  const elP = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.3 * (ELH / ELW)), elM); elP.position.set(1.95, 1.72, 0.012); B.add(elP);
  // window glass and the frame round the display, stepped in
  const frameS = new THREE.Shape(); frameS.moveTo(-1.9, -2.48); frameS.lineTo(1.9, -2.48); frameS.lineTo(1.9, 2.48); frameS.lineTo(-1.9, 2.48); frameS.closePath(); const fh = new THREE.Path(); fh.moveTo(-1.65, -2.22); fh.lineTo(-1.65, 2.22); fh.lineTo(1.65, 2.22); fh.lineTo(1.65, -2.22); fh.closePath(); frameS.holes.push(fh);
  const fm = new THREE.Mesh(new THREE.ExtrudeGeometry(frameS, {depth: 0.09, bevelEnabled: true, bevelSize: 0.022, bevelThickness: 0.022, bevelSegments: 2}), dk); fm.position.set(1.95, 1.72, 0.012); B.add(fm);
  const glassEL = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 4.44), new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.03, depthWrite: false, envMap: envB, envMapIntensity: 1.4})); glassEL.position.set(1.95, 1.72, 0.09); glassEL.renderOrder = 3; B.add(glassEL);
  // status lamps: grey plates with their words, dark
  const LAMPS = [['UPLINK ACTY', 'TEMP'], ['NO ATT', 'GIMBAL LOCK'], ['STBY', 'PROG'], ['KEY REL', 'RESTART'], ['OPR ERR', 'TRACKER'], ['', 'ALT'], ['', 'VEL']];
  const lampTex = (t) => { const [c, g] = canvasOf(320, 128); g.fillStyle = '#7f8185'; g.fillRect(0, 0, 320, 128); g.fillStyle = '#16161a'; g.font = '700 38px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = t.split(' '); w.forEach((l, i) => g.fillText(l, 160, 64 + (i - (w.length - 1) / 2) * 42)); return texOf(c); };
  LAMPS.forEach((row, ry) => row.forEach((t, cx) => { add(B, new RoundedBoxGeometry(1.18, 0.5, 0.05, 2, 0.015), std(0x7f8185, 0.5, 0.2, {envMap: envB, envMapIntensity: 0.4}), -3.1 + cx * 1.32, 3.74 - ry * 0.62, 0.014, 0, 0, 0, false); if (t) { const lb = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.48), std(0xffffff, 0.5, 0.15, {map: lampTex(t), envMap: envB, envMapIntensity: 0.4})); lb.position.set(-3.1 + cx * 1.32, 3.74 - ry * 0.62, 0.042); B.add(lb); } }));
  add(B, new THREE.BoxGeometry(2.92, 4.46, 0.02), dk, -2.42, 1.9, 0.002, 0, 0, 0, false);
  // the keyboard: raised keys with their legends
  const keyTex = (t) => { const [c, g] = canvasOf(256, 256); g.fillStyle = '#c8c8c0'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#121212'; g.textAlign = 'center'; g.textBaseline = 'middle'; const p = t.split(' '); g.font = `700 ${t.length > 2 ? 62 : 120}px Arial, sans-serif`; p.forEach((l, i) => g.fillText(l, 128, 136 + (i - (p.length - 1) / 2) * 68)); return texOf(c); };
  const keyAt = (t, x, y) => { add(B, new RoundedBoxGeometry(0.92, 0.82, 0.2, 3, 0.05), std(0xc8c8c0, 0.42, 0.1, {envMap: envB, envMapIntensity: 0.3}), x, y, 0.1); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.76), new THREE.MeshStandardMaterial({map: keyTex(t), roughness: 0.42, envMap: envB, envMapIntensity: 0.3})); f.position.set(x, y, 0.203); B.add(f); };
  const KY0 = -1.58, KDX = 1.14, KDY = 0.98;
  [['+', '7', '8', '9', 'CLR'], ['-', '4', '5', '6', 'PRO'], ['0', '1', '2', '3', 'KEY REL']].forEach((row, j) => row.forEach((t, i) => keyAt(t, -2.28 + i * KDX, KY0 + KDY * (0.5 - j))));
  keyAt('VERB', -3.42, KY0 + KDY * 0.1); keyAt('NOUN', -3.42, KY0 - KDY * 0.9); keyAt('ENTR', 3.42, KY0 + KDY * 0.1); keyAt('RSET', 3.42, KY0 - KDY * 0.9);
  stamp(B, new THREE.CylinderGeometry(0.05, 0.055, 0.03, 20), std(0x9a9c9c, 0.3, 1, {envMap: envB}), [[-3.85, 3.85], [3.85, 3.85], [-3.85, -3.85], [3.85, -3.85], [-3.85, 0], [3.85, 0]].map(([x, y]) => mat4(x, y, 0.015, Math.PI / 2)), false);
  spot(B, 0xffb878, 14, V3(-8, 4, 6), V3(0, 0, 0), 0.5, 1, 1.4, 22);
  spot(B, 0xb8ccf4, 3.5, V3(4.4, 7, 7), V3(1, 1, 0), 0.5, 1, 1.4, 18);
  const elLight = new THREE.PointLight(0x4cff88, 0, 4, 1.8); elLight.position.set(1.95, 2.0, 0.9); B.add(elLight);
  B.add(new THREE.AmbientLight(0x3f434a, 0.2));
  // a star's place at frame f: a slow drift across, slowing as Gordon nudges it in, a tremble, then held; the whole field goes with it. On the crosshair from frame ON (5.5 s).
  const ON = 165;
  return {draw: (f) => {
    const first = f < SPLIT; A.visible = first; B.visible = !first;
    if (first) {
      e.final.bloom.value = 0.3; e.final.exposure.value = 1.1; e.final.vign.value = 0.35; e.final.grain.value = 0.024;
      const k = ease(f / 60), z = lerp(14.2, 4.3, k), wob = (1 - k) * 0.01 + 0.0035;
      camera.position.set(Math.sin(f * 0.71) * wob, Math.cos(f * 0.53) * wob, z); camera.lookAt(0, 0, 0); camera.fov = 26; camera.up.set(0, 1, 0);
      starM.uniforms.scale.value = lerp(0.55, 1, k);
      // the star's offset from the crosshair, in the field's units
      const x = clamp(f / ON), pull = 1 - Math.pow(1 - x, 2.4), tremble = f < ON ? (1 - x) * 0.45 : 0;
      const ox = lerp(0, -STAR0[0], pull) + Math.sin(f * 0.43) * tremble * 0.45 + (f >= ON ? Math.sin(f * 0.9) * 0.012 : 0);
      const oy = lerp(0, -STAR0[1], pull) + Math.cos(f * 0.31) * tremble * 0.36 + (f >= ON ? Math.cos(f * 0.7) * 0.012 : 0);
      starGroup.position.set(ox, oy, 0);
    } else {
      e.final.bloom.value = 0.34; e.final.exposure.value = 1.1; e.final.vign.value = 0.95; e.final.grain.value = 0.016;
      paintEL(f);
      const k = ease((f - SPLIT) / 148), sh = 0.0035;
      camera.position.set(lerp(-3.6, 0.2, k) + Math.sin(f * 1.3) * Math.cos(f * 0.57) * sh, lerp(0.1, 0.9, k) + Math.cos(f * 1.1) * Math.sin(f * 0.73) * sh, lerp(13.2, 9.5, k));
      camera.lookAt(lerp(0.2, 1.05, k), lerp(0.75, 1.5, k), 0); camera.fov = lerp(30, 28, k); camera.up.set(lerp(-0.03, 0.012, k), 1, 0);
      elLight.intensity = f >= READ ? 2.1 : 1.1;
    }
    e.final.white.value = 0;
  }};
});

export const PLATES = {
  PanelThree: [PanelThree, 300],
  CoverWindow: [CoverWindow, 330],
  AbortHandle: [AbortHandle, 300],
  ParachuteBay: [ParachuteBay, 300],
  GMeter: [GMeter, 240],
  BreakerPull: [BreakerPull, 360],
  StarSight: [StarSight, 360],
};
