import React, { useEffect, useRef } from 'react';
import type { AssistantState, TaskState } from '../types';
import { RODEX_APPROVED_PORTRAIT } from './approvedAvatar';

/**
 * Actual GPU-rendered, depth-tested articulated RODEX bust.
 * The approved portrait is UV-mapped onto a convex tessellated head and neck;
 * skull, lips, jaw and neck mechanism are separate 3D geometry; the eyelids are shader-deformed on the mapped face.
 * This is an authored procedural WebGL rig, not a still image with CSS tilt.
 * Precise phoneme visemes require a dedicated facial scan/rig and timed phonemes.
 */
export type PresenceSignal = {
  state: AssistantState;
  taskState?: TaskState;
  audioLevel: number;
};
type Vec3 = [number, number, number];
type Mesh = { vertices: Float32Array; indices: Uint16Array; vb: WebGLBuffer; ib: WebGLBuffer };
type RawMesh = { vertices: number[]; indices: number[] };
type GL = WebGL2RenderingContext;
const CLAMP = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const MIX = (a: number, b: number, t: number) => a + (b - a) * t;
const IVORY: Vec3 = [.87, .80, .78];
const PEARL: Vec3 = [.88, .87, .87];
const SILVER: Vec3 = [.66, .70, .73];
const GRAPHITE: Vec3 = [.13, .16, .19];
const DARK: Vec3 = [.042, .036, .042];

function sphere(rows = 22, cols = 30): RawMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const v = i / rows;
    const phi = v * Math.PI;
    for (let j = 0; j <= cols; j++) {
      const u = j / cols;
      const theta = u * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      vertices.push(x, y, z, x, y, z, u, 1 - v);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const k = i * (cols + 1) + j;
      indices.push(k, k + cols + 1, k + 1, k + 1, k + cols + 1, k + cols + 2);
    }
  }
  return { vertices, indices };
}

function ring(rows = 12, cols = 42): RawMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const p = i / rows * 2 * Math.PI;
    for (let j = 0; j <= cols; j++) {
      const q = j / cols * 2 * Math.PI;
      const r = .80 + .13 * Math.cos(p);
      const x = r * Math.cos(q);
      const y = r * Math.sin(q);
      const z = .13 * Math.sin(p);
      const nx = Math.cos(p) * Math.cos(q);
      const ny = Math.cos(p) * Math.sin(q);
      const nz = Math.sin(p);
      vertices.push(x, y, z, nx, ny, nz, j / cols, i / rows);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const k = i * (cols + 1) + j;
      indices.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1);
    }
  }
  return { vertices, indices };
}

// The front image is bent into a continuous 3D convex facial surface.
// Alpha outside the approved portrait silhouettes the visible contour.
function portraitShell(vStart: number, vEnd: number, rows = 54, cols = 42): RawMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const v = MIX(vStart, vEnd, i / rows);
    const y = (v - .5) * 3.85;
    const face = CLAMP((v - .23) / .77, 0, 1);
    for (let j = 0; j <= cols; j++) {
      const u = j / cols;
      const lateral = u * 2 - 1;
      const width = MIX(.92, 1.12, face);
      const x = lateral * width * 1.13;
      const relief = (cx: number, cy: number, width: number, height: number) =>
        Math.exp(-Math.pow((lateral - cx) / width, 2) -
          Math.pow((v - cy) / height, 2));
      const profile = .18 + .51 * Math.sqrt(Math.max(0, 1 - lateral * lateral)) *
        (face > 0 ? (.74 + .26 * Math.sin(face * Math.PI)) : .45);
      // Geometry for nose bridge, cheeks, brow and inset eye sockets gives
      // visible facial volume in profile, without replacing identity texture.
      const faceRelief = .19 * relief(0, .48, .19, .12) +
        .09 * relief(-.40, .49, .27, .14) +
        .09 * relief(.40, .49, .27, .14) -
        .050 * relief(-.35, .60, .22, .055) -
        .050 * relief(.35, .60, .22, .055) +
        .07 * relief(0, .29, .30, .085);
      const z = profile + faceRelief * face;
      const slope = lateral / Math.sqrt(Math.max(.04, 1 - lateral * lateral));
      const normal = 1 / Math.sqrt(1 + slope * slope * .35);
      vertices.push(x, y, z, -slope * .6 * normal, 0, normal, u, v);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const k = i * (cols + 1) + j;
      indices.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1);
    }
  }
  return { vertices, indices };
}

function upload(gl: GL, raw: RawMesh): Mesh {
  const vb = gl.createBuffer();
  const ib = gl.createBuffer();
  if (!vb || !ib) throw new Error('Unable to allocate humanoid GPU geometry');
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(raw.vertices), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(raw.indices), gl.STATIC_DRAW);
  return { vertices: new Float32Array(raw.vertices), indices: new Uint16Array(raw.indices), vb, ib };
}

const VERTEX = [
  '#version 300 es',
  'precision highp float;',
  'in vec3 aPosition; in vec3 aNormal; in vec2 aUV;',
  'uniform mat4 uModel;',
  'uniform float uCamera; uniform float uFocal; uniform float uAspect; uniform float uCenter;',
  'out vec2 vUV; out vec3 vNormal;',
  'void main() {',
  '  vec3 p = (uModel * vec4(aPosition, 1.0)).xyz;',
  '  float d = max(0.3, uCamera - p.z);',
  '  float n = .1; float f = 40.0;',
  '  gl_Position = vec4(p.x * uFocal / uAspect, (p.y - uCenter) * uFocal, d * (f+n)/(f-n) - 2.0*f*n/(f-n), d);',
  '  vNormal = normalize(mat3(uModel) * aNormal); vUV = aUV;',
  '}',
].join('\n');
const FRAGMENT = [
  '#version 300 es',
  'precision highp float;',
  'in vec2 vUV; in vec3 vNormal; out vec4 frag;',
  'uniform sampler2D uPortrait; uniform float uTextured;',
  'uniform vec3 uColor; uniform vec2 uEyeGaze; uniform float uBlink;',
  'void main() {',
  '  vec2 uv = vUV;',
  '  // Localized eye-texture displacement, feathered at each socket boundary.',
  '  // The rest of the approved face remains unchanged.',
  '  for(int i=0; i<2; i++) {',
  '    vec2 eye = vec2(i==0 ? .347 : .653, .60);',
  '    vec2 diff = (vUV - eye) / vec2(.070, .032);',
  '    float mask = 1.0 - smoothstep(.35, 1.0, length(diff));',
  '    uv -= uEyeGaze * mask * vec2(.009, .006);',
  '  }',
  '  vec4 base = uTextured > .5 ? texture(uPortrait, uv) : vec4(uColor, 1.0);',
  '  if(uTextured > .5 && uBlink > .0) {',
  '    for(int i=0; i<2; i++) {',
  '      vec2 eye = vec2(i==0 ? .347 : .653, .60);',
  '      vec2 ellipse = (vUV - eye) / vec2(.068, .031);',
  '      float lidMask = 1.0 - smoothstep(.52, 1.0, length(ellipse));',
  '      vec4 eyelidSkin = texture(uPortrait, vec2(vUV.x, eye.y + .060));',
  '      base.rgb = mix(base.rgb, eyelidSkin.rgb, clamp(uBlink * lidMask, 0.0, 1.0));',
  '    }',
  '  }',
  '  if(base.a < .09) discard;',
  '  float lit = .74 + .27 * max(dot(normalize(vNormal), normalize(vec3(-.55, 1.0, 1.9))), 0.0);',
  '  vec3 rgb = base.rgb * mix(lit, .94 + .06 * lit, uTextured);',
  '  frag = vec4(rgb, base.a);',
  '}',
].join('\n');
function shader(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const why = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('RODEX 3D shader: ' + why);
  }
  return s;
}
function program(gl: GL): WebGLProgram {
  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const p = gl.createProgram();
  if (!p) throw new Error('Unable to create WebGL program');
  gl.attachShader(p, vertex); gl.attachShader(p, fragment);
  gl.linkProgram(p);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const why = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error('RODEX 3D program: ' + why);
  }
  return p;
}
function transform(pos: Vec3, size: Vec3, pitch = 0, yaw = 0): Float32Array {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  return new Float32Array([
    cy * size[0], 0, -sy * size[0], 0,
    sy * sx * size[1], cx * size[1], cy * sx * size[1], 0,
    sy * cx * size[2], -sx * size[2], cy * cx * size[2], 0,
    pos[0], pos[1], pos[2], 1,
  ]);
}
type RigControls = { yaw: number; pitch: number; blink: number; mouth: number; breath: number; gaze: number; attentive: boolean; concerned: boolean };

function createRenderer(canvas: HTMLCanvasElement, onLost: () => void) {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: true, depth: true, premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 is unavailable');
  const p = program(gl);
  const positions = {
    position: gl.getAttribLocation(p, 'aPosition'),
    normal: gl.getAttribLocation(p, 'aNormal'),
    uv: gl.getAttribLocation(p, 'aUV'),
    model: gl.getUniformLocation(p, 'uModel'),
    camera: gl.getUniformLocation(p, 'uCamera'),
    focal: gl.getUniformLocation(p, 'uFocal'),
    aspect: gl.getUniformLocation(p, 'uAspect'),
    center: gl.getUniformLocation(p, 'uCenter'),
    color: gl.getUniformLocation(p, 'uColor'),
    textured: gl.getUniformLocation(p, 'uTextured'),
    portrait: gl.getUniformLocation(p, 'uPortrait'),
    gaze: gl.getUniformLocation(p, 'uEyeGaze'),
    blink: gl.getUniformLocation(p, 'uBlink'),
  };
  const raw = { sphere: upload(gl, sphere()), ring: upload(gl, ring()),
    head: upload(gl, portraitShell(.235, 1)),
    neck: upload(gl, portraitShell(0, .235, 18, 42)) };
  const meshes = Object.values(raw);
  let texture = gl.createTexture();
  if (!texture) throw new Error('Unable to create RODEX skin texture');
  const image = new Image();
  let active = true;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([240, 229, 225, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  image.onload = () => {
    if (!active) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  };
  image.onerror = onLost;
  image.src = RODEX_APPROVED_PORTRAIT;
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  let aspect = 1, distance = 6.2;
  const focal = 1 / Math.tan(21.5 * Math.PI / 180);
  function resize(width: number, height: number, compact: boolean) {
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1.3 : 1.8);
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    gl.viewport(0, 0, w, h);
    aspect = width / height;
    // Fit the whole head and shoulders; never let the head be cropped.
    // Narrow mobile layouts naturally move the virtual camera backwards.
    const vertical = 3.83 / (2 * Math.tan(21.5 * Math.PI / 180) * .88);
    const horizontal = 2.55 / (2 * Math.tan(21.5 * Math.PI / 180) * Math.max(.1, aspect) * .88);
    distance = Math.max(vertical, horizontal) + (compact ? .25 : 0);
  }
  function draw(mesh: Mesh, color: Vec3, pos: Vec3, scale: Vec3, controls: RigControls,
    head = false, textured = false) {
    const pitch = head ? controls.pitch : 0;
    const yaw = head ? controls.yaw : 0;
    // Head rotations share one orientation: separate features never slide off face.
    const mat = transform(pos, scale, pitch, yaw);
    gl.uniformMatrix4fv(positions.model, false, mat);
    gl.uniform3fv(positions.color, color);
    gl.uniform1f(positions.textured, textured ? 1 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
    gl.vertexAttribPointer(positions.position, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(positions.normal, 3, gl.FLOAT, false, 32, 12);
    gl.vertexAttribPointer(positions.uv, 2, gl.FLOAT, false, 32, 24);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }
  function render(c: RigControls) {
    if (!active || gl.isContextLost()) return;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(p);
    gl.enableVertexAttribArray(positions.position);
    gl.enableVertexAttribArray(positions.normal);
    gl.enableVertexAttribArray(positions.uv);
    gl.uniform1f(positions.camera, distance);
    gl.uniform1f(positions.focal, focal);
    gl.uniform1f(positions.aspect, aspect);
    gl.uniform1f(positions.center, .015);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(positions.portrait, 0);
    gl.uniform2f(positions.gaze, c.gaze, c.pitch * 2.5);
    gl.uniform1f(positions.blink, c.blink);
    const bodyY = Math.sin(c.breath) * .012;
    const yaw = c.yaw, pitch = c.pitch;
    // Sculpted shoulders, chest sockets and articulated metallic neck.
    // The reference-approved character is a neck-and-head android bust:
    // retain its silhouette instead of inventing large shoulder discs.
    draw(raw.sphere, GRAPHITE, [0, -1.82 + bodyY, -.48], [.45, .15, .25], c);
    draw(raw.sphere, GRAPHITE, [0, -1.12 + bodyY, -.14], [.34, .75, .34], c);
    draw(raw.sphere, SILVER, [-.30, -1.24 + bodyY, .12], [.070, .55, .10], c);
    draw(raw.sphere, SILVER, [.30, -1.24 + bodyY, .12], [.070, .55, .10], c);
    for (let i = 0; i < 5; i++) {
      draw(raw.ring, i % 2 ? GRAPHITE : SILVER,
        [0, -1.71 + i * .20 + bodyY, .06], [.42, .20, .11], c);
    }
    draw(raw.neck, PEARL, [0, bodyY, .07], [1, 1, 1], c, false, true);
    // Convex sculpt beneath facial texture gives real parallax when head turns.
    draw(raw.sphere, GRAPHITE, [0, .37, -.19], [.89, 1.35, .49], c, true);
    draw(raw.sphere, IVORY, [0, .35, -.11], [.88, 1.30, .47], c, true);
    // Low-profile titanium articulation, not external cartoon ear handles.
    draw(raw.sphere, GRAPHITE, [-.88, .70, -.18], [.13, .23, .16], c, true);
    draw(raw.sphere, GRAPHITE, [.88, .70, -.18], [.13, .23, .16], c, true);
    draw(raw.sphere, SILVER, [-.88, .75, -.075], [.07, .17, .055], c, true);
    draw(raw.sphere, SILVER, [.88, .75, -.075], [.07, .17, .055], c, true);
    // UV projected approved identity: the image is now attached to a true 3D shell.
    draw(raw.head, PEARL, [0, 0, .08], [1, 1, 1], c, true, true);
    // Soft eyelid closure is applied inside the face texture shader, without
    // the long bright bars that separate geometry produced across the eyes.
    // Jaw geometry still articulates independently in front of the 3D skull.
    const mouth = CLAMP(c.mouth, 0, 1);
    // Jaw bone is articulated behind the approved facial surface.
    draw(raw.sphere, IVORY, [0, -.78 - mouth * .048, -.08],
      [.40, .22, .33], c, true);
    if (mouth > .025) {
      draw(raw.sphere, DARK, [0, -.51 - mouth * .025, .761],
        [.166 + mouth * .016, .008 + mouth * .095, .018], c, true);
      draw(raw.sphere, IVORY, [0, -.51 + mouth * .055, .781],
        [.174, .015, .019], c, true);
      draw(raw.sphere, IVORY, [0, -.52 - mouth * .09, .781],
        [.170, .015, .020], c, true);
    }
  }
  return {
    resize, render,
    dispose: () => {
      active = false;
      image.onload = null; image.onerror = null;
      meshes.forEach(m => { gl.deleteBuffer(m.vb); gl.deleteBuffer(m.ib); });
      gl.deleteTexture(texture);
      gl.deleteProgram(p);
    },
  };
}

export function RODEX3DScene({ signal, compact = false, onUnavailable, onInteract }: {
  signal: PresenceSignal; compact?: boolean; onUnavailable: () => void;
  onInteract: () => void | Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signalRef = useRef(signal);
  const pointerRef = useRef({ x: 0, y: 0, hovering: false });
  signalRef.current = signal;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: ReturnType<typeof createRenderer>;
    try {
      engine = createRenderer(canvas, onUnavailable);
    } catch (error) {
      console.warn('[RODEX 3D] Using accessible portrait fallback:', error);
      onUnavailable();
      return;
    }
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = preference.matches;
    const changeMotion = (ev: MediaQueryListEvent) => { reducedMotion = ev.matches; };
    preference.addEventListener('change', changeMotion);
    let alive = true;
    let raf = 0;
    let previous = performance.now();
    let blinkStart = -10000;
    let nextBlink = previous + 3600;
    const c: RigControls = {
      yaw: 0, pitch: 0, blink: 0, mouth: 0, breath: 0,
      gaze: 0, attentive: false, concerned: false,
    };
    let observedWidth = 0, observedHeight = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (Math.abs(rect.width - observedWidth) > .1 ||
          Math.abs(rect.height - observedHeight) > .1) {
        observedWidth = rect.width; observedHeight = rect.height;
        engine.resize(rect.width, rect.height, compact);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    function animate(now: number) {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      if (document.hidden || !observedWidth || !observedHeight) return;
      const dt = CLAMP((now - previous) / 1000, 0, .05);
      previous = now;
      const state = signalRef.current.state;
      const attentive = ['listening', 'wake_detected', 'input_detected', 'wake_listening'].includes(state);
      const speaking = state === 'speaking';
      const concerned = state === 'error' || state === 'warning' || signalRef.current.taskState === 'FAILED';
      const audio = CLAMP(Number.isFinite(signalRef.current.audioLevel) ? signalRef.current.audioLevel : 0, 0, 1);
      const x = pointerRef.current.hovering ? pointerRef.current.x : Math.sin(now / 4000) * .13;
      const y = pointerRef.current.hovering ? pointerRef.current.y : Math.sin(now / 5100) * .09;
      const smoothing = CLAMP(dt * (reducedMotion ? 1 : 5.8), 0, 1);
      c.yaw = MIX(c.yaw, reducedMotion ? 0 : x * .20, smoothing);
      c.pitch = MIX(c.pitch, reducedMotion ? 0 : -y * .095 + (attentive ? -.023 : 0), smoothing);
      c.gaze = MIX(c.gaze, reducedMotion ? 0 : x, smoothing);
      c.breath = reducedMotion ? 0 : now / 950;
      c.attentive = attentive;
      c.concerned = concerned;
      if (!reducedMotion && now > nextBlink) {
        blinkStart = now;
        nextBlink = now + 2900 + (1 + Math.sin(now / 740)) * 1300;
      }
      const blinkPhase = (now - blinkStart) / 230;
      c.blink = !reducedMotion && blinkPhase >= 0 && blinkPhase <= 1
        ? Math.pow(Math.sin(blinkPhase * Math.PI), 2) : 0;
      const targetMouth = speaking ? audio : 0;
      c.mouth = MIX(c.mouth, reducedMotion ? 0 : targetMouth, CLAMP(dt * 14, 0, 1));
      engine.render(c);
    }
    const restoreVisibility = () => { previous = performance.now(); };
    document.addEventListener('visibilitychange', restoreVisibility);
    const lost = (event: Event) => {
      event.preventDefault(); // Restore is possible on browsers that support it.
      alive = false;
      cancelAnimationFrame(raf);
      onUnavailable();
    };
    canvas.addEventListener('webglcontextlost', lost);
    raf = requestAnimationFrame(animate);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', restoreVisibility);
      preference.removeEventListener('change', changeMotion);
      canvas.removeEventListener('webglcontextlost', lost);
      engine.dispose();
    };
  }, [compact, onUnavailable]);

  return <div className="rodex3d-scene" onPointerMove={(event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') return;
      const bounds = event.currentTarget.getBoundingClientRect();
      pointerRef.current = {
        x: CLAMP(2 * (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 1, -1, 1),
        y: CLAMP(2 * (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 1, -1, 1),
        hovering: true,
      };
    }} onPointerLeave={() => {
      pointerRef.current = { x: 0, y: 0, hovering: false };
    }}>
      <canvas ref={canvasRef} className="rodex3d-canvas" aria-hidden="true"/>
      <button type="button" className="rodex-human-interact" onClick={onInteract}
        aria-label={compact ? "Speak with RODEX floating companion" : "Talk to RODEX"}
        title="Talk to RODEX"><span className="sr-only">Talk to RODEX</span></button>
    </div>;
}
