// Each plate is one composition. A plate renders once to video and goes into the story as footage.
import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig, AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {makeEngine, glInfo} from './engine';
import {makeSaturn, makeFlame, makeBolt, makeXray} from './saturn';
import {makePanel, makeBall, makeScreen} from './cabin';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// the flash over time: a first stroke and its return strokes, then the afterglow
export const flashAt = (f, f0) => {
  const d = f - f0; if (d < 0) return 0;
  return Math.max(d <= 2 ? 1 : 0, d >= 3 && d <= 4 ? 0.45 : 0, d >= 5 && d <= 7 ? 0.8 : 0, d >= 8 ? 0.8 * Math.exp(-(d - 7) * 0.45) : 0);
};

const useScene = (build) => {
  const ref = useRef(null), st = useRef(null), frame = useCurrentFrame(), {width, height} = useVideoConfig();
  useLayoutEffect(() => {
    if (!st.current) {
      const e = makeEngine(ref.current, width, height);
      st.current = {e, ...build(e)};
      console.log('[plate] GL renderer: ' + glInfo(e.renderer));
    }
    st.current.draw(frame);
    st.current.e.render(frame);
  }, [frame]);
  return <AbsoluteFill style={{background: '#000'}}><canvas ref={ref} width={width} height={height} style={{width, height}} /></AbsoluteFill>;
};

// T+33 to T+37.5: under and behind the climbing rocket, in the cloud; it goes dark, the world flickers, and it hits
export const StrikeSpike = () => useScene((e) => {
  const {scene, camera, cloud} = e;
  const rocket = new THREE.Group(), saturn = makeSaturn(), flame = makeFlame();
  rocket.add(saturn); scene.add(rocket); e.glow.add(flame);
  scene.add(new THREE.HemisphereLight(0x8fa0b4, 0x201a16, 0.28));
  const key = new THREE.DirectionalLight(0xb0c0d4, 2.2); key.position.set(-200, 60, -30); scene.add(key);
  const fire = new THREE.PointLight(0xff7a2a, 26000, 300, 1.8); scene.add(fire);
  const strike = new THREE.DirectionalLight(0xdfe8ff, 0); scene.add(strike);
  const F0 = 92, ALT = 1500;
  const boltPts = [new THREE.Vector3(-500, ALT + 1500, -700), new THREE.Vector3(-90, ALT + 480, -160), new THREE.Vector3(0, ALT + 118, 0), new THREE.Vector3(0, ALT + 112, 0)];
  const lower = [new THREE.Vector3(0, ALT - 6, 0), new THREE.Vector3(6, ALT - 170, 8), new THREE.Vector3(70, ALT - 800, -100), new THREE.Vector3(120, 0, -300)];
  const bolt = makeBolt(boltPts, 7), bolt2 = makeBolt(lower, 23); e.glow.add(bolt, bolt2);
  return {draw: (f) => {
    const t = f / 30, climb = f * 7.2;                  // about 215 m/s at this point, and the camera is flying with it
    rocket.position.y = ALT + climb - 92 * 7.2;
    bolt.position.y = bolt2.position.y = rocket.position.y - ALT;
    flame.userData.tick(t); flame.position.y = rocket.position.y; flame.rotation.z = -0.05;
    const fl = flashAt(f, F0), pre = f >= F0 - 26 && f < F0 ? 0.16 * Math.max(0, Math.sin(f * 2.3) * Math.sin(f * 0.71)) : 0;
    const shake = fl * 1.6, sx = Math.sin(f * 17.3) * shake, sy = Math.cos(f * 13.1) * shake;
    const k = ease((f - 0) / 110), dip = f >= F0 - 3 && f < F0 ? 1.6 : 0;
    camera.position.set(lerp(-58, -46, k) + sx, rocket.position.y + lerp(-4, 8, k) + sy - dip, lerp(86, 74, k));
    camera.lookAt(-8, rocket.position.y + lerp(26, 42, k), 0);
    camera.fov = lerp(62, 58, k);
    camera.up.set(Math.sin(-0.07), Math.cos(0.07), 0);
    rocket.rotation.z = -0.05;
    fire.position.set(0, rocket.position.y - 12, 0);
    strike.intensity = fl * 7; strike.position.set(-300, rocket.position.y + 300, -180);
    const pw = fl > 0 ? (fl > 0.6 ? fl : fl * 0.35) : 0;
    bolt.userData.update(camera, pw); bolt2.userData.update(camera, pw);
    cloud.flash.value = Math.max(fl, pre);
    cloud.boltA.value.set(-90, rocket.position.y + 480, -160); cloud.boltB.value.set(70, rocket.position.y - 800, -100);
    cloud.flameA.value.set(0, rocket.position.y - 8, 0); cloud.flameB.value.set(0, rocket.position.y - 170, 0);
    cloud.wind.value.set(f * 0.0009, -f * 0.0011 + 0.31, f * 0.0004);
    e.common.flash.value = Math.max(fl, pre);
    e.final.white.value = f === F0 ? 0.12 : 0;
  }};
});

// one rocket in its storm, used by the outside plates
const stormRocket = (e) => {
  const {scene} = e, rocket = new THREE.Group(), saturn = makeSaturn(), flame = makeFlame();
  rocket.add(saturn); scene.add(rocket); e.glow.add(flame);
  scene.add(new THREE.HemisphereLight(0x8fa0b4, 0x201a16, 0.28));
  const key = new THREE.DirectionalLight(0xb0c0d4, 2.2); key.position.set(-200, 60, -30); scene.add(key);
  const fire = new THREE.PointLight(0xff7a2a, 26000, 300, 1.8); scene.add(fire);
  const strike = new THREE.DirectionalLight(0xdfe8ff, 0); scene.add(strike);
  return {rocket, saturn, flame, fire, strike, place: (y, t) => { rocket.position.y = y; rocket.rotation.z = -0.05; flame.position.y = y; flame.rotation.z = -0.05; flame.userData.tick(t); fire.position.set(0, y - 12, 0); e.cloud.flameA.value.set(0, y - 8, 0); e.cloud.flameB.value.set(0, y - 170, 0); }};
};

// THE SIGNATURE MOVE: one unbroken move. Close on the climbing hull in the storm's afterglow; it turns to light, and we ride a pulse up the wiring into the service module and the capsule.
export const Current = () => useScene((e) => {
  const {camera, cloud} = e, R = stormRocket(e), xray = makeXray(); e.glow.add(xray);
  const faded = [];
  R.saturn.traverse((m) => { if (m.isMesh && m.material) { m.material.transparent = true; faded.push(m.material); } });
  return {draw: (f) => {
    const t = f / 30, y0 = 1500 + f * 7.2; R.place(y0, t); xray.position.y = y0; xray.rotation.z = -0.05;
    const on = ease((f - 8) / 22), py = lerp(-2, 104, ease((f - 22) / 80)), hit = py > 96;
    xray.userData.set(on, py, hit);
    faded.forEach((m) => { m.opacity = 1 - on * 0.97; });
    const lk = clamp(py, 8, 100), k = ease((f - 14) / 86), end = ease((f - 88) / 28);
    camera.position.set(lerp(-44, -9, k) + Math.sin(f * 0.23) * 0.3, y0 + lk + lerp(-16, -3.4, k) - end * 2.2, lerp(70, 13, k) - end * 7);
    camera.up.set(lerp(-0.07, 0.12, k), 1, 0);
    camera.lookAt(0, y0 + lk + 3, 0);
    camera.fov = lerp(52, 44, k);
    const fl = 0.42 * Math.exp(-f * 0.06), burst = f >= 96 ? Math.max(0, 1 - (f - 96) / 5) : 0;
    cloud.flash.value = fl + burst * 0.5; e.common.flash.value = fl;
    cloud.boltA.value.set(-90, y0 + 480, -160); cloud.boltB.value.set(70, y0 - 800, -100);
    cloud.wind.value.set(f * 0.0009, -f * 0.0011 + 0.5, f * 0.0004);
    R.strike.intensity = fl * 7; R.strike.position.set(-300, y0 + 300, -180);
    e.final.white.value = f >= 112 ? ease((f - 112) / 8) * 0.95 : 0;
  }};
});

// the second strike, seen from far off: cloud to cloud across the sky, the rocket small against it
export const Strike2 = () => useScene((e) => {
  const {camera, cloud} = e, R = stormRocket(e), F0 = 70;
  cloud.far_.value = 3200; cloud.cover.value = 0.5; cloud.near_.value = 480;
  const a = new THREE.Vector3(-1500, 4900, -500), b = new THREE.Vector3(0, 4400, 0), c = new THREE.Vector3(1200, 3700, 500);
  const bolt = makeBolt([a, new THREE.Vector3(-650, 4620, -200), b, new THREE.Vector3(620, 4050, 240), c], 41, 0.3); e.glow.add(bolt);
  return {draw: (f) => {
    const y = 4300 + (f - F0) * 8.4; R.place(y, f / 30);
    bolt.position.y = y - 4300;
    const fl = flashAt(f, F0), shake = fl * 7;
    camera.position.set(-330 + Math.sin(f * 17.3) * shake, y - 90 + Math.cos(f * 13.1) * shake, 430);
    camera.lookAt(-30, y + 44, 0); camera.fov = 34; camera.up.set(0, 1, 0);
    bolt.userData.update(camera, fl > 0.6 ? fl : fl * 0.3);
    cloud.flash.value = fl * 0.62; e.common.flash.value = fl * 0.5;
    cloud.boltA.value.set(-1500, y + 600, -500); cloud.boltB.value.set(1200, y - 600, 500);
    cloud.wind.value.set(f * 0.0005, -f * 0.0006 + 0.9, 0.2);
    R.strike.intensity = fl * 1.2; R.strike.position.set(-300, y + 300, 400);
    e.final.white.value = f === F0 ? 0.3 : 0;
  }};
});

const indoors = (e) => { e.cloud.far_.value = 0; e.skyHi.set(0, 0, 0); e.skyLo.set(0, 0, 0); e.final.grain.value = 0.014; };

// your seat: the panel in the dark, the white light through the window, then the lights come on across it
export const Panel = () => useScene((e) => { indoors(e); const P = makePanel(e); return {draw: (f) => P.draw(f)}; });
// the ball that tells you which way is up, and then doesn't
export const Ball = () => useScene((e) => { indoors(e); const P = makeBall(e); return {draw: (f) => P.draw(f)}; });
// Houston: clean numbers, then numbers that make no sense
export const Screen = () => useScene((e) => { indoors(e); const P = makeScreen(e); return {draw: (f) => P.draw(f)}; });
