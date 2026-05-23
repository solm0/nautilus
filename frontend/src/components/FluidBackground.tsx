import { useEffect, useRef } from "react";

/**
 * ─────────────────────────────────────────────
 *  Adjustable constants
 * ─────────────────────────────────────────────
 */
const COLORS = {
  primary:   [0.18, 0.23, 1.0],   // #2e3aff  — deep blue
  secondary: [0.79, 0.93, 0.73],  // #c9eebb  — soft mint
  accent:    [0.27, 0.73, 0.74],  // #45bbbc  — teal
  highlight: [0.95, 0.96, 0.94],  // #f2f4f0  — near-white
  warm:      [0.95, 0.60, 0.40],  // #f29966  — warm coral
  deep:      [0.10, 0.08, 0.35],  // #1a1459  — deep navy
} as const;

const BLOOM_SCALE = 1.6; // 1.1 ~ 1.6 추천

/**
 * Each color point: [x, y, r, g, b, baseRadius, radiusAmp, orbitRx, orbitRy]
 *
 * baseRadius  — 기본 블롭 반경  (RBF falloff)
 * radiusAmp   — 반경 진동 진폭 (블롭 크기가 이만큼 숨쉬듯 변함)
 * orbitRx/Ry  — 리사주 궤도 반경 (블롭이 이 범위 안에서 표류)
 */
const COLOR_POINTS = [
  //  x      y      r                   g                   b           base  amp   rx    ry
  [  0.0,   0.4,  ...COLORS.primary,    1.10,  0.40,  0.55, 0.38 ],  // blue    — 크고 천천히 숨쉼
  [ -0.7,  -0.3,  ...COLORS.secondary,  0.60,  0.25,  0.70, 0.50 ],  // mint    — 중간, 넓게 표류
  [  0.7,  -0.2,  ...COLORS.accent,     0.75,  0.30,  0.45, 0.60 ],  // teal    — 중간
  [  0.5,   0.6,  ...COLORS.highlight,  0.45,  0.20,  0.60, 0.40 ],  // white   — 작고 예민
  [ -0.4,   0.5,  ...COLORS.warm,       0.55,  0.35,  0.80, 0.55 ],  // coral   — 중간, 많이 흔들림
  [  0.0,  -0.7,  ...COLORS.deep,       0.90,  0.45,  0.50, 0.70 ],  // navy    — 제일 크고 느림
  [  0.0,   0.4,  ...COLORS.primary,    1.10,  0.40,  0.55, 0.38 ],  // blue    — 크고 천천히 숨쉼
  [ -0.7,  -0.3,  ...COLORS.secondary,  0.60,  0.25,  0.70, 0.50 ],  // mint    — 중간, 넓게 표류
  [  0.7,  -0.2,  ...COLORS.accent,     0.75,  0.30,  0.45, 0.60 ],  // teal    — 중간
  [  0.5,   0.6,  ...COLORS.highlight,  0.45,  0.20,  0.60, 0.40 ],  // white   — 작고 예민
  [ -0.4,   0.5,  ...COLORS.warm,       0.55,  0.35,  0.80, 0.55 ],  // coral   — 중간, 많이 흔들림
  [  0.0,  -0.7,  ...COLORS.deep,       0.90,  0.45,  0.50, 0.70 ],  // navy    — 제일 크고 느림
] as const;

const CONFIG = {
  pixelRatioCap:  1.75,
  animationSpeed: 0.0002,  // 전체 속도 — 느린 표류
  mobileBreakpoint: 768,
  mobilePixelRatioCap: 2,
  minViewportScale: 0.74,
  orbitScaleWeight: 0.45,
} as const;

const N = COLOR_POINTS.length;

// ─────────────────────────────────────────────
//  Vertex shader
// ─────────────────────────────────────────────
const vertexShaderSource = /* glsl */`
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ─────────────────────────────────────────────
//  Fragment shader
//  각 블롭:
//   • 독립적인 기본 반경 + 진폭으로 크기가 숨쉬듯 변함
//   • 궤도 반경(rx, ry)이 서로 달라 이동 범위가 다름
//   • 위상(phase)이 달라 서로 비동기로 움직임
//   • 황금비 위상 오프셋으로 패턴이 거의 반복되지 않음
// ─────────────────────────────────────────────
const fragmentShaderSource = /* glsl */`
precision highp float;

uniform float u_time;
uniform vec2  u_resolution;

// per-point static data
uniform vec2  u_pos[${N}];
uniform vec3  u_col[${N}];
uniform float u_baseRadius[${N}];   // 기본 블롭 반경
uniform float u_radiusAmp[${N}];    // 반경 진동 진폭
uniform float u_orbitRx[${N}];      // 리사주 궤도 x반경
uniform float u_orbitRy[${N}];      // 리사주 궤도 y반경

varying vec2 v_uv;

// ── C2-smooth compact RBF (Wendland-like) ─────
float rbf(float dist, float r) {
  float t = clamp(1.0 - dist / r, 0.0, 1.0);
  return t * t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 p = (v_uv * 2.0 - 1.0) * aspect;

  float totalW = 0.0;
  vec3  totalC = vec3(0.0);

  for (int i = 0; i < ${N}; i++) {
    float fi    = float(i);

    // 황금비 위상 — 각 블롭마다 고유한 오프셋
    float phase = fi * 1.6180339887;

    // ── 리사주 표류 궤도 ──────────────────────
    // 각 블롭마다 주파수 비율이 미묘하게 달라
    // 절대 같은 패턴이 반복되지 않음
    float freqX = 0.41 + fi * 0.031;
    float freqY = 0.37 + fi * 0.027;
    float speed = u_time * (0.65 + fi * 0.11);

    vec2 orbit = vec2(
      sin(speed * freqX + phase)           * u_orbitRx[i],
      cos(speed * freqY + phase * 1.31)    * u_orbitRy[i]
    );

    // 이차 잔떨림 — 미세한 불규칙 흔들림 추가
    float jitterFreq = 1.7 + fi * 0.19;
    orbit += vec2(
      sin(speed * jitterFreq * 1.13 + phase * 2.3) * 0.06,
      cos(speed * jitterFreq * 0.97 + phase * 1.7) * 0.06
    );

    // ── 블롭 반경 애니메이션 ─────────────────
    // 기본 반경 + 진폭 * sin(독립 주파수)
    // → 블롭이 숨쉬듯 팽창/수축
    float breathFreq = 0.29 + fi * 0.073;
    float r = u_baseRadius[i]
            + u_radiusAmp[i] * sin(speed * breathFreq + phase * 3.1);

    // aspect 보정 후 블롭 중심 위치
    vec2 pos = (u_pos[i] + orbit) * aspect;

    float dist = length(p - pos);
    float w    = rbf(dist, max(r, 0.05)); // 최소 반경 보호

    totalW += w;
    totalC += w * u_col[i];
  }

  vec3 bg = vec3(0.05, 0.01, 0.74);
  vec3 color = totalW > 0.001
    ? mix(bg, totalC / totalW, clamp(totalW, 0.0, 1.0))
    : bg;

  // 유기적 그레인
  float grain = fract(sin(dot(v_uv, vec2(127.1, 311.7))) * 43758.5) * 0.018 - 0.009;
  color = clamp(color + grain, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

// ─────────────────────────────────────────────
//  WebGL helpers
// ─────────────────────────────────────────────
function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(err ?? "Shader compile error");
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader
): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error("Failed to create WebGL program");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const err = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(err ?? "Program link error");
  }
  return prog;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getViewportTuning(width: number) {
  if (width >= CONFIG.mobileBreakpoint) {
    return {
      pixelRatioCap: CONFIG.pixelRatioCap,
      radiusScale: 1,
      orbitScale: 1,
    };
  }

  const normalizedWidth = clamp(
    width / CONFIG.mobileBreakpoint,
    CONFIG.minViewportScale,
    1
  );

  return {
    pixelRatioCap: CONFIG.mobilePixelRatioCap,
    radiusScale: normalizedWidth,
    orbitScale:
      1 - (1 - normalizedWidth) * CONFIG.orbitScaleWeight,
  };
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) { console.error("WebGL not supported"); return; }

    // ── Build program ──────────────────────────
    const vs  = createShader(gl, gl.VERTEX_SHADER,   vertexShaderSource);
    const fs  = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vs, fs);
    gl.useProgram(program);

    // ── Fullscreen quad ────────────────────────
    const vertices = new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Failed to create buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // ── Uniform locations ──────────────────────
    const uTime       = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");

    const uPos        = Array.from({ length: N }, (_, i) =>
      gl.getUniformLocation(program, `u_pos[${i}]`)
    );
    const uCol        = Array.from({ length: N }, (_, i) =>
      gl.getUniformLocation(program, `u_col[${i}]`)
    );
    const uBaseRadius = Array.from({ length: N }, (_, i) =>
      gl.getUniformLocation(program, `u_baseRadius[${i}]`)
    );
    const uRadiusAmp  = Array.from({ length: N }, (_, i) =>
      gl.getUniformLocation(program, `u_radiusAmp[${i}]`)
    );
    const uOrbitRx    = Array.from({ length: N }, (_, i) =>
      gl.getUniformLocation(program, `u_orbitRx[${i}]`)
    );
    const uOrbitRy    = Array.from({ length: N }, (_, i) =>
      gl.getUniformLocation(program, `u_orbitRy[${i}]`)
    );

    const uploadPointUniforms = (viewportWidth: number) => {
      const tuning = getViewportTuning(viewportWidth);

      for (let i = 0; i < N; i++) {
        const pt = COLOR_POINTS[i];
        // layout: [x, y, r, g, b, baseRadius, radiusAmp, orbitRx, orbitRy]
        gl.uniform2f(uPos[i],        pt[0], pt[1]);
        gl.uniform3f(uCol[i],        pt[2], pt[3], pt[4]);
        gl.uniform1f(
          uBaseRadius[i],
          pt[5] * BLOOM_SCALE * tuning.radiusScale
        );
        gl.uniform1f(
          uRadiusAmp[i],
          pt[6] * BLOOM_SCALE * tuning.radiusScale
        );
        gl.uniform1f(uOrbitRx[i], pt[7] * tuning.orbitScale);
        gl.uniform1f(uOrbitRy[i], pt[8] * tuning.orbitScale);
      }

      return tuning;
    };

    // ── Resize handler ─────────────────────────
    const resize = () => {
      const tuning = uploadPointUniforms(canvas.clientWidth);
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        tuning.pixelRatioCap
      );
      const w   = Math.floor(canvas.clientWidth  * dpr);
      const h   = Math.floor(canvas.clientHeight * dpr);
      canvas.width  = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uResolution, w, h);
    };
    window.addEventListener("resize", resize);
    resize();

    // ── Render loop ────────────────────────────
    let raf = 0;
    const render = (time: number) => {
      gl.uniform1f(uTime, time * CONFIG.animationSpeed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
