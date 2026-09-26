"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { audioLevels } from "@/lib/audio-levels";
import type { OrbState } from "@/components/veronique-orb";

interface FluidOrbProps {
  state: OrbState;
  size?: number;
  className?: string;
}

const STATE_NUMERIC: Record<OrbState, number> = {
  idle: 0,
  listening: 1,
  thinking: 2,
  speaking: 3,
};

/* ----------------------------- GLSL shaders ----------------------------- */

// Simplex 3D noise (Ashima / Stefan Gustavson). Public-domain.
const SIMPLEX_NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float v=0.0; float a=0.5;
  for(int i=0;i<4;i++){ v+=a*snoise(p); p*=2.02; a*=0.5; }
  return v;
}
`;

const VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uAudio;       // audio reactivity 0..1
uniform float uState;       // 0 idle, 1 listening, 2 thinking, 3 speaking
uniform float uSpeed;       // animation speed for current state

varying vec3 vNormal;       // SMOOTH recomputed normal (follows the displaced surface)
varying vec3 vViewDir;
varying float vDisplacement;
varying vec3 vPos;
varying vec3 vWorldPos;

${SIMPLEX_NOISE}

// Height-field displacement along the sphere normal. Extracted as a function
// so we can sample it at neighbouring points and reconstruct a smooth normal
// via finite differences (this is what removes the "broken polygon / right
// angle" look: lighting now follows the bumps instead of using the raw sphere
// normal).
float displacement(vec3 p, float t, float audio, float st){
  float n1 = snoise(p * 1.15 + vec3(0.0, t * 0.55, t * 0.22));
  float n2 = snoise(p * 2.4 + vec3(t * 0.85, -t * 0.4, t * 0.3));
  float n3 = fbm(p * 1.6 + vec3(t * 0.35));
  float disp = n1 * (0.16 + audio * 0.42) + n2 * 0.07 + n3 * 0.06;
  float isThink = step(1.5, st) * step(st, 2.5);
  disp += isThink * sin(t * 3.4 + p.y * 7.0 + p.x * 4.0) * 0.055;
  float isSpeak = step(2.5, st);
  disp += isSpeak * snoise(p * 5.5 + t * 2.2) * audio * 0.18;
  return disp;
}

void main(){
  vec3 p = position;
  vec3 n = normalize(normal); // unit-sphere normal == radial direction
  float t = uTime * uSpeed;
  float audio = uAudio;

  float d = displacement(p, t, audio, uState);

  // --- Smooth normal via finite differences of the displacement field ---
  // For radial displacement S(p)=p+n*d(p), the surface normal is:
  //   N = normalize(n - grad_tangent(d))
  // where grad_tangent = grad(d) - (grad(d)·n) n  (the surface-tangent part).
  float eps = 0.02;
  float dpx = displacement(p + vec3(eps,0.0,0.0), t, audio, uState);
  float dpy = displacement(p + vec3(0.0,eps,0.0), t, audio, uState);
  float dpz = displacement(p + vec3(0.0,0.0,eps), t, audio, uState);
  vec3 grad = vec3((dpx-d)/eps, (dpy-d)/eps, (dpz-d)/eps);
  vec3 gradT = grad - n * dot(grad, n);     // tangent gradient
  vec3 smoothN = normalize(n - gradT * 1.4);

  vec3 displaced = p + n * d;
  vDisplacement = d;
  vPos = displaced;
  vNormal = normalize(normalMatrix * smoothN);

  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vViewDir = normalize(-mv.xyz);
  vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;

  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAudio;
uniform float uState;
uniform vec3 uColorViolet;  // #8A2BE2
uniform vec3 uColorPink;    // #FF1493
uniform vec3 uColorBlue;    // #00FFFF

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisplacement;
varying vec3 vPos;
varying vec3 vWorldPos;

// sparkle hash
float hash(vec3 p){
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);

  // fresnel rim — softer, wider falloff for an immersive neon bloom
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);

  // neon gradient based on displacement + position
  float g = clamp(0.5 + vDisplacement * 2.6 + vPos.y * 0.25, 0.0, 1.0);
  vec3 base = mix(uColorViolet, uColorPink, smoothstep(0.0, 0.55, g));
  base = mix(base, uColorBlue, smoothstep(0.55, 1.0, g) * 0.55);

  // processing: dynamic color swirl
  float isThink = step(1.5, uState) * step(uState, 2.5);
  float swirl = 0.5 + 0.5 * sin(uTime * 0.9 + vDisplacement * 5.0 + vPos.x * 3.0);
  base = mix(base, base.zyx, isThink * 0.35 * swirl);

  // specular highlight (key light upper-left)
  vec3 L = normalize(vec3(-0.45, 0.85, 0.55));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 60.0);
  // secondary glittery specular
  vec3 L2 = normalize(vec3(0.6, -0.3, 0.7));
  vec3 H2 = normalize(L2 + V);
  float spec2 = pow(max(dot(N, H2), 0.0), 24.0) * 0.5;

  // subsurface scattering warmth at the rim
  vec3 sss = vec3(1.0, 0.42, 0.62) * pow(fres, 1.4) * 0.65;

  // sparkles / glitter on the surface
  float sp = hash(floor(vWorldPos * 80.0 + uTime * 1.8));
  float sparkle = smoothstep(0.984, 1.0, sp) * (0.35 + uAudio * 1.1);

  // integrated neon rim glow (soft bloom baked into the surface)
  vec3 rim = mix(uColorPink, uColorBlue, fres) * fres * 2.4;
  // extra outer bloom that fades with fresnel → reads as a luminous aura
  vec3 bloom = mix(uColorViolet, uColorPink, fres) * pow(fres, 1.5) * 1.2;

  vec3 color = base * 0.62;
  color += rim;
  color += bloom;
  color += vec3(1.0) * (spec * 1.05 + spec2);
  color += sss;
  color += vec3(1.0, 0.92, 1.0) * sparkle * 1.7;

  // global brightness lifts with audio
  color *= 1.0 + uAudio * 0.45;

  // subtle gamma
  color = pow(color, vec3(0.92));

  gl_FragColor = vec4(color, 1.0);
}
`;

/* --------------------- Procedural radial glow texture --------------------- */
// A soft, camera-facing Gaussian-falloff sprite used as the orb's neon bloom.
// Unlike a BackSide halo sphere (which fills in as a flat disk), a billboarded
// radial-gradient sprite always looks like a soft glow with no hard edges.
function makeGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.42, "rgba(255,255,255,0.16)");
  grad.addColorStop(0.72, "rgba(255,255,255,0.035)");
  grad.addColorStop(1.0, "rgba(255,255,255,0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ----------------------------- Component ----------------------------- */

export function FluidOrb({ state, size = 320, className }: FluidOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<OrbState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || size;
    let height = mount.clientHeight || size;
    if (width === 0) width = size;
    if (height === 0) height = size;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0); // transparent → pure-black page shows through
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    // --- Soft neon glow sprite (billboarded, replaces the flat halo disk) ---
    const glowTex = makeGlowTexture();
    const glowUniforms = {
      uTime: { value: 0 },
      uAudio: { value: 0 },
      uState: { value: 0 },
      uColorViolet: { value: new THREE.Color(0x8a2be2) },
      uColorPink: { value: new THREE.Color(0xff1493) },
      uColorBlue: { value: new THREE.Color(0x00ffff) },
      uGlowTex: { value: glowTex },
    };
    const glowMat = new THREE.ShaderMaterial({
      uniforms: glowUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          // billboard: keep the sprite facing the camera
          vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mv.xy += position.xy;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime;
        uniform float uAudio;
        uniform float uState;
        uniform vec3 uColorViolet;
        uniform vec3 uColorPink;
        uniform vec3 uColorBlue;
        uniform sampler2D uGlowTex;
        varying vec2 vUv;
        void main(){
          float r = texture2D(uGlowTex, vUv).a;
          // animated neon tint
          float mixT = 0.5 + 0.5 * sin(uTime * 0.6);
          vec3 col = mix(uColorViolet, uColorPink, mixT);
          col = mix(col, uColorBlue, 0.25 + 0.25 * sin(uTime * 0.4));
          // brightness reacts to audio
          float a = r * (0.30 + uAudio * 0.5);
          gl_FragColor = vec4(col * (1.0 + uAudio * 0.8), a);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    // a simple quad plane as the billboard surface
    const glowGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, 0, -0.2); // slightly behind the orb
    scene.add(glow);

    // --- Core blob: detail 7 = 128× edge subdivision (≈327k tris) for a
    // perfectly smooth silhouette, with flatShading off (default) and
    // finite-difference normals so lighting tracks the displaced surface. ---
    const geometry = new THREE.IcosahedronGeometry(1, 7);
    const uniforms = {
      uTime: { value: 0 },
      uAudio: { value: 0 },
      uState: { value: 0 },
      uSpeed: { value: 0.5 },
      uColorViolet: glowUniforms.uColorViolet,
      uColorPink: glowUniforms.uColorPink,
      uColorBlue: glowUniforms.uColorBlue,
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    const blob = new THREE.Mesh(geometry, material);
    scene.add(blob);

    // Background glitter — drifting points (kept; they are not a disk)
    const sparkleCount = 220;
    const sparklePositions = new Float32Array(sparkleCount * 3);
    for (let i = 0; i < sparkleCount; i++) {
      const r = 2.6 + Math.random() * 2.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      sparklePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      sparklePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      sparklePositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const sparkleGeo = new THREE.BufferGeometry();
    sparkleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(sparklePositions, 3)
    );
    const sparkleMat = new THREE.PointsMaterial({
      color: 0xffd9f0,
      size: 0.035,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
    scene.add(sparkles);

    // animation loop
    const clock = new THREE.Clock();
    let raf = 0;
    let smoothAudio = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = STATE_NUMERIC[stateRef.current];

      // pick audio source per state
      let target = 0;
      if (s === 1) target = audioLevels.micLevel;
      else if (s === 3) target = audioLevels.ttsLevel * 0.8 + audioLevels.ttsBass * 0.4;
      // smooth (attack fast, release slow) for organic motion
      const attack = s === 3 ? 0.5 : 0.35;
      const release = s === 3 ? 0.12 : 0.08;
      smoothAudio += (target - smoothAudio) * (target > smoothAudio ? attack : release);

      // per-state animation speed
      let speed = 0.5;
      if (s === 0) speed = 0.45;
      else if (s === 1) speed = 0.9 + smoothAudio * 1.6;
      else if (s === 2) speed = 1.8;
      else if (s === 3) speed = 1.1 + smoothAudio * 2.2;

      uniforms.uTime.value = t;
      uniforms.uAudio.value = smoothAudio;
      uniforms.uState.value = s;
      uniforms.uSpeed.value = speed;
      glowUniforms.uTime.value = t;
      glowUniforms.uAudio.value = smoothAudio;
      glowUniforms.uState.value = s;

      // rotation: slow idle, fast when thinking/speaking
      const rotSpeed =
        s === 0 ? 0.05 : s === 1 ? 0.18 : s === 2 ? 0.9 : 0.35 + smoothAudio * 1.5;
      blob.rotation.y += rotSpeed * 0.016;
      blob.rotation.x += rotSpeed * 0.012;

      sparkles.rotation.y += 0.0009;
      sparkles.rotation.x += 0.0004;

      // subtle bob
      blob.position.y = Math.sin(t * 0.8) * 0.04;
      glow.position.y = blob.position.y;

      renderer.render(scene, camera);
    };
    animate();

    // resize observer
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || size;
      const h = mount.clientHeight || size;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      glowTex.dispose();
      sparkleGeo.dispose();
      sparkleMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: size, height: size }}
      aria-label={`Assistant state: ${state}`}
      role="img"
    />
  );
}
