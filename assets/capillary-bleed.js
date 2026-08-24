/**
 * TANTU KINETIC ENGINE — T2: MORDANT CAPILLARY BLEED
 *
 * A WebGL fragment-shader dye simulator. Each pointer contact injects a
 * mordant droplet that spreads outward along the warp/weft axes of the
 * substrate with an organic, fibre-torn edge produced by domain-warped
 * value noise (an FBM stand-in for SVG turbulence displacement).
 *
 * No geometric easing: growth follows a capillary saturation curve
 * r(t) = R * (1 - e^(-k t)), the same asymptotic uptake a dye front shows
 * climbing untreated cotton.
 *
 * CONTEXT POOLING — Safari (WebKit) hard-caps live WebGL contexts per page
 * (historically 16) and silently drops the oldest once the cap is passed,
 * which blanks bleed surfaces mid-page. Tantu therefore never gives a
 * surface its own context: ONE shared offscreen WebGL drawing frame renders
 * every surface in turn, and each surface blits the result onto its own
 * cheap 2D canvas. Page-wide context count is exactly one, regardless of how
 * many cards, buttons or fields are woven into the loom.
 */
export const TANTU_MAX_BLEEDS = 6;
const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
const FRAGMENT_SHADER = `
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec4  u_bleeds[${TANTU_MAX_BLEEDS}]; // xy = origin px, z = start ms, w = seed
uniform vec3  u_dye;
uniform float u_duration;
uniform float u_maxRadius;
uniform float u_fray;
uniform float u_saturation;
uniform float u_dpr;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Value noise sampled on an orthogonal lattice — the substrate weave.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * noise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// Anisotropy: dye climbs the warp (y) and weft (x) faster than the bias.
vec2 threadWarp(vec2 d, float seed) {
  float weft = fbm(vec2(d.y * 0.09 + seed, seed * 3.1)) - 0.5;
  float warp = fbm(vec2(seed * 7.7, d.x * 0.09 + seed)) - 0.5;
  return d + vec2(weft, warp) * u_fray * 26.0;
}

void main() {
  vec2 p = gl_FragCoord.xy / u_dpr;
  p.y = (u_res.y / u_dpr) - p.y; // match DOM coordinate origin

  float ink = 0.0;

  for (int i = 0; i < ${TANTU_MAX_BLEEDS}; i++) {
    vec4 b = u_bleeds[i];
    if (b.z <= 0.0) continue;

    float age = u_time - b.z;
    if (age < 0.0 || age > u_duration) continue;

    float t = age / u_duration;

    // Capillary uptake: fast wick, asymptotic settle. Never a bezier.
    float growth = 1.0 - exp(-3.4 * t);
    float radius = u_maxRadius * growth;

    vec2 d = threadWarp(p - b.xy, b.w);

    // Slight orthogonal stretch — the lattice conducts, the bias resists.
    d.x /= 1.0 + 0.18 * growth;

    float dist = length(d);

    // Fibre-torn front: high-frequency noise chews the wet edge.
    float tear = (fbm(p * 0.11 + b.w * 13.0) - 0.5) * u_fray * radius * 0.55;
    float front = radius + tear;

    float feather = 2.0 + radius * 0.22;
    float wet = 1.0 - smoothstep(front - feather, front + feather, dist);

    // Fixative settlement: the core stays, the halo evaporates.
    float settle = mix(1.0, 0.62, smoothstep(0.35, 1.0, t));
    float fade = 1.0 - smoothstep(0.7, 1.0, t);

    // Mordant pooling: denser at the contact point than at the front.
    float pool = mix(1.0, 0.55, clamp(dist / max(front, 1.0), 0.0, 1.0));

    ink += wet * settle * fade * pool;
  }

  if (ink <= 0.001) discard;

  // Substrate grain — the dye can only sit where fibre exists.
  float grain = 0.86 + 0.14 * fbm(p * 0.9);
  float alpha = clamp(ink, 0.0, 1.0) * u_saturation * grain;

  gl_FragColor = vec4(u_dye * (0.92 + 0.08 * grain), alpha);
}
`;
function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader)
        return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
function hexToRgb(hex) {
    const clean = hex.replace("#", "").trim();
    const full = clean.length === 3
        ? clean
            .split("")
            .map((c) => c + c)
            .join("")
        : clean;
    const int = Number.parseInt(full, 16);
    if (!Number.isFinite(int))
        return [0.51, 0.14, 0.11];
    return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}
const NOOP_HANDLE = {
    bleed: () => { },
    resize: () => { },
    dispose: () => { },
    supported: false,
};
/** Safari refuses to keep many live contexts; we only ever ask for one. */
let vat = null;
let vatFailed = false;
function getDyeVat() {
    if (vat)
        return vat;
    if (vatFailed || typeof document === "undefined")
        return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        preserveDrawingBuffer: true, // WebKit needs the buffer intact for drawImage
        powerPreference: "low-power",
    }) ??
        canvas.getContext("experimental-webgl");
    if (!gl) {
        vatFailed = true;
        return null;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = vs && fs ? gl.createProgram() : null;
    if (!vs || !fs || !program) {
        vatFailed = true;
        return null;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        vatFailed = true;
        return null;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const u = {
        res: gl.getUniformLocation(program, "u_res"),
        time: gl.getUniformLocation(program, "u_time"),
        bleeds: gl.getUniformLocation(program, "u_bleeds"),
        dye: gl.getUniformLocation(program, "u_dye"),
        duration: gl.getUniformLocation(program, "u_duration"),
        maxRadius: gl.getUniformLocation(program, "u_maxRadius"),
        fray: gl.getUniformLocation(program, "u_fray"),
        saturation: gl.getUniformLocation(program, "u_saturation"),
        dpr: gl.getUniformLocation(program, "u_dpr"),
    };
    // The shared frame never shrinks — resizing a WebGL drawing buffer is the
    // expensive part, so we grow to the largest surface and viewport within it.
    function fit(w, h) {
        if (canvas.width < w || canvas.height < h) {
            canvas.width = Math.max(canvas.width, w);
            canvas.height = Math.max(canvas.height, h);
        }
    }
    vat = {
        canvas,
        draw(pass) {
            if (gl.isContextLost())
                return null;
            fit(pass.width, pass.height);
            // Render the surface into the bottom-left corner of the shared frame.
            gl.viewport(0, 0, pass.width, pass.height);
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(0, 0, pass.width, pass.height);
            gl.uniform2f(u.res, pass.width, pass.height);
            gl.uniform1f(u.dpr, pass.dpr);
            gl.uniform3fv(u.dye, pass.dye);
            gl.uniform1f(u.duration, pass.duration);
            gl.uniform1f(u.maxRadius, pass.maxRadius);
            gl.uniform1f(u.fray, pass.fray);
            gl.uniform1f(u.saturation, pass.saturation);
            gl.uniform1f(u.time, pass.time);
            gl.uniform4fv(u.bleeds, pass.bleeds);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.disable(gl.SCISSOR_TEST);
            return canvas;
        },
    };
    canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        vat = null;
        vatFailed = false;
    });
    return vat;
}
const wet = new Set();
let loomFrame = 0;
function loomTick() {
    const now = performance.now();
    for (const surface of Array.from(wet)) {
        if (!surface.tick(now))
            wet.delete(surface);
    }
    loomFrame = wet.size ? requestAnimationFrame(loomTick) : 0;
}
function enlist(surface) {
    wet.add(surface);
    if (!loomFrame)
        loomFrame = requestAnimationFrame(loomTick);
}
/* ------------------------------------------------------------------ */
export function createCapillaryBleed(canvas, options = {}) {
    const dye = hexToRgb(options.dye ?? "#82231D");
    const duration = options.duration ?? 1400;
    const maxRadius = options.maxRadius ?? 220;
    const fray = options.fray ?? 0.65;
    const saturation = options.saturation ?? 0.85;
    // A 2D context is cheap and uncapped — Safari only rations WebGL.
    const ctx = canvas.getContext("2d");
    if (!ctx || !getDyeVat())
        return NOOP_HANDLE;
    const bleeds = new Float32Array(TANTU_MAX_BLEEDS * 4);
    let cursor = 0;
    let disposed = false;
    let dpr = 1;
    const start = performance.now();
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
    }
    function active(now) {
        for (let i = 0; i < TANTU_MAX_BLEEDS; i++) {
            const startedAt = bleeds[i * 4 + 2];
            if (startedAt > 0 && now - startedAt <= duration)
                return true;
        }
        return false;
    }
    const surface = {
        tick(wallClock) {
            if (disposed)
                return false;
            const now = wallClock - start;
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            const frame = getDyeVat()?.draw({
                width: w,
                height: h,
                dpr,
                dye,
                duration,
                maxRadius,
                fray,
                saturation,
                time: now,
                bleeds,
            });
            if (frame) {
                // The shared frame renders into its bottom-left corner; sample that
                // region back out at 1:1.
                ctx.drawImage(frame, 0, frame.height - h, w, h, 0, 0, w, h);
            }
            if (active(now))
                return true;
            ctx.clearRect(0, 0, w, h);
            return false;
        },
    };
    resize();
    return {
        supported: true,
        bleed(x, y) {
            if (disposed)
                return;
            resize();
            const i = cursor % TANTU_MAX_BLEEDS;
            cursor += 1;
            bleeds[i * 4 + 0] = x;
            bleeds[i * 4 + 1] = y;
            bleeds[i * 4 + 2] = performance.now() - start;
            bleeds[i * 4 + 3] = Math.random() * 10 + 0.1;
            enlist(surface);
        },
        resize,
        dispose() {
            disposed = true;
            wet.delete(surface);
        },
    };
}
