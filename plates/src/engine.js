// The plate renderer: a three.js scene drawn into HDR, volumetric clouds marched through a noise volume and stopped at the scene's depth,
// then bloom, filmic tone mapping and a little grain. Everything is a pure function of the frame, so any frame renders on its own.
import * as THREE from 'three';

const QUAD_VS = `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const pass = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({glslVersion: THREE.GLSL3, vertexShader: QUAD_VS, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...extra});

// tileable noise: Worley (puffs) eroded by value noise (detail), 96^3, seeded so every run is the same
const noiseVolume = () => {
  const N = 96, data = new Uint8Array(N * N * N);
  let seed = 12345;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const worleyGrid = (cells) => { const g = new Float32Array(cells * cells * cells * 3); for (let i = 0; i < g.length; i++) g[i] = rnd(); return {cells, g}; };
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
  const w1 = worleyGrid(5), w2 = worleyGrid(11), w3 = worleyGrid(23);
  for (let z = 0, i = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++, i++) {
    const u = x / N, v = y / N, t = z / N;
    const n = 1 - (worley(w1, u, v, t) * 0.62 + worley(w2, u, v, t) * 0.27 + worley(w3, u, v, t) * 0.11);
    data[i] = Math.max(0, Math.min(255, n * 255));
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RedFormat; tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
};

const CLOUD_FS = `
precision highp float; precision highp sampler3D;
in vec2 vUv; out vec4 o;
uniform sampler3D noise; uniform sampler2D depth;
uniform mat4 invVP; uniform vec3 cam;
uniform float base, top, cover, thick, scale, far_, fine, near_;
uniform vec3 wind, boltA, boltB, flameA, flameB, skyHi, skyLo;
uniform float flash, flame, frame;
float sat(float x){ return clamp(x, 0.0, 1.0); }
float dens(vec3 p){
  float h = (p.y - base) / (top - base);
  if (h < 0.0 || h > 1.0) return 0.0;
  vec3 q = p * scale + wind;
  float n = texture(noise, q).r;
  float m = texture(noise, q * 3.3 + wind * 0.4).r;
  float f = texture(noise, q * fine + wind * 1.3).r;
  float shape = n * 0.72 + m * 0.2 + f * 0.08;
  float g = smoothstep(0.0, 0.06, h) * smoothstep(1.0, 0.82, h);
  return sat((shape - cover) * 11.0) * g * thick;
}
float segD(vec3 p, vec3 a, vec3 b){ vec3 ab = b - a; float t = sat(dot(p - a, ab) / dot(ab, ab)); return length(p - a - ab * t); }
void main(){
  vec4 w = invVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 rd = normalize(w.xyz / w.w - cam);
  float zd = texture(depth, vUv).r;
  vec4 w2 = invVP * vec4(vUv * 2.0 - 1.0, zd * 2.0 - 1.0, 1.0); float tScene = zd >= 0.9999 ? 1e9 : length(w2.xyz / w2.w - cam);
  // exponential steps: fine wisps by the camera, the far overcast in a few big ones
  float ign = fract(sin(dot(gl_FragCoord.xy + mod(frame, 64.0) * 3.7, vec2(12.9898, 78.233))) * 43758.5453);
  float t = near_ + 6.0 + ign * 3.0, T = 1.0; vec3 col = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    float dt = 5.0 + t * 0.07;
    if (t > far_ || t > tScene || T < 0.012) break;
    vec3 p = cam + rd * (t + (ign - 0.5) * dt * 0.8);
    float d = dens(p);
    if (d > 0.001) {
      float h = sat((p.y - base) / (top - base));
      float up = dens(p + vec3(0.0, 40.0, 0.0)) + dens(p + vec3(0.0, 120.0, 0.0)) * 0.7;   // how much cloud sits above this point
      vec3 amb = mix(skyLo, skyHi, h) * mix(1.0, 0.16, sat(up * 1.1));
      float db = segD(p, boltA, boltB), df = segD(p, flameA, flameB);
      vec3 lit = amb + vec3(0.72, 0.8, 1.0) * flash * (2.1 / (1.0 + db * db * 0.00006)) * (0.35 + 0.65 * d)
                     + vec3(1.0, 0.42, 0.11) * flame * (1.1 / (1.0 + df * df * 0.0016));
      float a = 1.0 - exp(-d * dt * 0.022);
      col += T * a * lit; T *= 1.0 - a;
    }
    t += dt;
  }
  o = vec4(col, 1.0 - T);
}`;

const COMP_FS = `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D scene, clouds; uniform mat4 invVP; uniform vec3 cam, skyHi, skyLo; uniform float flash;
void main(){
  vec4 w = invVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 rd = normalize(w.xyz / w.w - cam);
  vec3 sky = mix(skyLo, skyHi, clamp(rd.y * 1.3 + 0.35, 0.0, 1.0)) + vec3(0.7, 0.8, 1.0) * flash * 0.22;
  vec4 s = texture(scene, vUv); vec2 px = 1.5 / vec2(textureSize(clouds, 0));
  vec4 c = (texture(clouds, vUv) * 2.0 + texture(clouds, vUv + px * vec2(1.0, 0.6)) + texture(clouds, vUv + px * vec2(-1.0, -0.6)) + texture(clouds, vUv + px * vec2(-0.6, 1.0)) + texture(clouds, vUv + px * vec2(0.6, -1.0))) / 6.0;
  vec3 col = sky * (1.0 - s.a) + s.rgb;
  o = vec4(col * (1.0 - c.a) + c.rgb, 1.0);
}`;

const BRIGHT_FS = `
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float knee;
void main(){ vec3 c = texture(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); o = vec4(c * smoothstep(knee, knee * 2.5, l), 1.0); }`;

const BLUR_FS = `
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform vec2 dir;
void main(){ vec3 c = texture(t, vUv).rgb * 0.227;
  c += (texture(t, vUv + dir * 1.385).rgb + texture(t, vUv - dir * 1.385).rgb) * 0.316;
  c += (texture(t, vUv + dir * 3.231).rgb + texture(t, vUv - dir * 3.231).rgb) * 0.0703;
  o = vec4(c, 1.0); }`;

const FINAL_FS = `
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D t, b1, b2; uniform float bloom, exposure, grain, frame, vign, white;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + frame * 1.37) * 43758.5453); }
void main(){
  vec3 c = texture(t, vUv).rgb + (texture(b1, vUv).rgb * 0.6 + texture(b2, vUv).rgb) * bloom;
  c *= exposure;
  vec2 q = vUv - 0.5; c *= 1.0 - vign * dot(q, q) * 1.6;
  c = aces(c) + white;
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
  c += (hash(gl_FragCoord.xy) - 0.5) * grain;
  o = vec4(c, 1.0);
}`;

export const makeEngine = (canvas, W, H) => {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0); renderer.autoClear = true;
  const hdr = {type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter};
  const depthTexture = new THREE.DepthTexture(W, H); depthTexture.type = THREE.UnsignedIntType;
  const sceneRT = new THREE.WebGLRenderTarget(W, H, {...hdr, depthTexture, depthBuffer: true, samples: 4});
  const cW = Math.round(W / 2), cH = Math.round(H / 2);
  const cloudRT = new THREE.WebGLRenderTarget(cW, cH, {...hdr, depthBuffer: false});
  const compRT = new THREE.WebGLRenderTarget(W, H, {...hdr, depthBuffer: false});
  const bW = Math.round(W / 4), bH = Math.round(H / 4);
  const brightRT = new THREE.WebGLRenderTarget(bW, bH, {...hdr, depthBuffer: false});
  const b1a = new THREE.WebGLRenderTarget(bW, bH, {...hdr, depthBuffer: false}), b1b = b1a.clone();
  const b2a = new THREE.WebGLRenderTarget(bW >> 2, bH >> 2, {...hdr, depthBuffer: false}), b2b = b2a.clone();

  const skyHi = new THREE.Vector3(0.115, 0.135, 0.175), skyLo = new THREE.Vector3(0.022, 0.026, 0.034);
  const common = {invVP: {value: new THREE.Matrix4()}, cam: {value: new THREE.Vector3()}, skyHi: {value: skyHi}, skyLo: {value: skyLo}, flash: {value: 0}, frame: {value: 0}};
  const cloudM = pass(CLOUD_FS, {...common, noise: {value: noiseVolume()}, depth: {value: depthTexture},
    base: {value: 250}, top: {value: 6500}, cover: {value: 0.5}, thick: {value: 1.0}, scale: {value: 0.0009}, far_: {value: 3000}, fine: {value: 9}, near_: {value: 0},
    wind: {value: new THREE.Vector3()}, boltA: {value: new THREE.Vector3()}, boltB: {value: new THREE.Vector3()}, flameA: {value: new THREE.Vector3()}, flameB: {value: new THREE.Vector3()}, flame: {value: 1}});
  const compM = pass(COMP_FS, {...common, scene: {value: sceneRT.texture}, clouds: {value: cloudRT.texture}});
  const brightM = pass(BRIGHT_FS, {t: {value: compRT.texture}, knee: {value: 1.1}});
  const blurM = pass(BLUR_FS, {t: {value: null}, dir: {value: new THREE.Vector2()}});
  const finalM = pass(FINAL_FS, {t: {value: compRT.texture}, b1: {value: b1b.texture}, b2: {value: b2b.texture}, bloom: {value: 0.5}, exposure: {value: 1}, grain: {value: 0.018}, frame: {value: 0}, vign: {value: 0.55}, white: {value: 0}});
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compM); quad.frustumCulled = false; quadScene.add(quad);
  const run = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };
  const blur = (src, dstA, dstB) => {
    blurM.uniforms.t.value = src; blurM.uniforms.dir.value.set(1 / dstA.width, 0); run(blurM, dstA);
    blurM.uniforms.t.value = dstA.texture; blurM.uniforms.dir.value.set(0, 1 / dstA.height); run(blurM, dstB);
  };

  const scene = new THREE.Scene(), glow = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 1, 60000);
  const vp = new THREE.Matrix4();
  const render = (frame) => {
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    common.invVP.value.copy(vp); common.cam.value.setFromMatrixPosition(camera.matrixWorld); common.frame.value = frame;
    finalM.uniforms.frame.value = frame;
    renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
    run(cloudM, cloudRT); run(compM, compRT);
    renderer.setRenderTarget(compRT); renderer.autoClear = false; renderer.render(glow, camera); renderer.autoClear = true;
    run(brightM, brightRT);
    blur(brightRT.texture, b1a, b1b); blur(b1b.texture, b2a, b2b);
    run(finalM, null);
    renderer.getContext().finish();
  };
  return {renderer, scene, glow, camera, render, cloud: cloudM.uniforms, final: finalM.uniforms, skyHi, skyLo, common};
};

export const glInfo = (renderer) => {
  const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
};
