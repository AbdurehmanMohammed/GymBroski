import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

import './Iridescence.css';

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;
varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;
  uv += (uMouse - vec2(0.5)) * uAmplitude;
  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Cool steel / slate blue — reads well on light iridescent base */
const DEFAULT_COLOR = [0.44, 0.54, 0.66];

export default function Iridescence({
  color,
  speed = 0.85,
  amplitude = 0.12,
  mouseReact = true,
  backdrop = false,
  ...rest
}) {
  const ctnDom = useRef(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });
  const r = color?.[0] ?? DEFAULT_COLOR[0];
  const g = color?.[1] ?? DEFAULT_COLOR[1];
  const b = color?.[2] ?? DEFAULT_COLOR[2];

  useEffect(() => {
    if (!ctnDom.current) return;
    const ctn = ctnDom.current;
    const renderer = new Renderer({ dpr: Math.min(2, window.devicePixelRatio || 1) });
    const gl = renderer.gl;
    /* Cool blue-gray base (less pink/lilac) for light mode */
    gl.clearColor(0.88, 0.91, 0.94, 1);

    let program;

    function resize() {
      const w = ctn.offsetWidth || window.innerWidth;
      const h = ctn.offsetHeight || window.innerHeight;
      renderer.setSize(w, h);
      if (program) {
        program.uniforms.uResolution.value = new Color(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / Math.max(gl.canvas.height, 1)
        );
      }
    }
    window.addEventListener('resize', resize, false);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(r, g, b) },
        uResolution: {
          value: new Color(
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / Math.max(gl.canvas.height, 1)
          ),
        },
        uMouse: { value: new Float32Array([mousePos.current.x, mousePos.current.y]) },
        uAmplitude: { value: amplitude },
        uSpeed: { value: speed },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    let animateId;

    function update(t) {
      animateId = requestAnimationFrame(update);
      program.uniforms.uTime.value = t * 0.001;
      renderer.render({ scene: mesh });
    }
    animateId = requestAnimationFrame(update);
    ctn.appendChild(gl.canvas);

    function handleMouseMove(e) {
      let x;
      let y;
      if (backdrop) {
        x = e.clientX / window.innerWidth;
        y = 1.0 - e.clientY / window.innerHeight;
      } else {
        const rect = ctn.getBoundingClientRect();
        x = (e.clientX - rect.left) / Math.max(rect.width, 1);
        y = 1.0 - (e.clientY - rect.top) / Math.max(rect.height, 1);
      }
      mousePos.current = { x, y };
      program.uniforms.uMouse.value[0] = x;
      program.uniforms.uMouse.value[1] = y;
    }

    if (mouseReact) {
      const target = backdrop ? window : ctn;
      target.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener('resize', resize);
      if (mouseReact) {
        const target = backdrop ? window : ctn;
        target.removeEventListener('mousemove', handleMouseMove);
      }
      if (gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas);
      }
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        /* ignore */
      }
    };
  }, [r, g, b, speed, amplitude, mouseReact, backdrop]);

  return <div ref={ctnDom} className="iridescence-container" {...rest} />;
}
