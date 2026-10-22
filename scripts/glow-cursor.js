document.addEventListener('DOMContentLoaded', () => {
    const VERTEX = `#version 300 es
    in vec2 aPosition;
    uniform vec2 uTexel;
    out vec2 vUv;
    out vec2 vL;
    out vec2 vR;
    out vec2 vT;
    out vec2 vB;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(uTexel.x, 0.0);
      vR = vUv + vec2(uTexel.x, 0.0);
      vT = vUv + vec2(0.0, uTexel.y);
      vB = vUv - vec2(0.0, uTexel.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;
    
    const HEADER = `#version 300 es
    precision highp float;
    precision highp sampler2D;
    in vec2 vUv;
    in vec2 vL;
    in vec2 vR;
    in vec2 vT;
    in vec2 vB;
    out vec4 outColor;
    `;
    
    const SPLAT = `${HEADER}
    uniform sampler2D uTarget;
    uniform float uAspect;
    uniform vec2 uA;
    uniform vec2 uB;
    uniform float uRadius;
    uniform float uWide;
    uniform vec3 uValue;
    uniform float uMode;
    uniform float uStrength;
    float erf(float x) {
      float x2 = x * x;
      float a = 0.147;
      return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732395 + a * x2) / (1.0 + a * x2)));
    }
    float sweep(float along, float length, float across, float radius) {
      return exp(-across * across / (radius * radius)) * 0.5 * (erf(along / radius) - erf((along - length) / radius));
    }
    void main() {
      vec2 p = vec2(vUv.x * uAspect, vUv.y);
      vec2 a = vec2(uA.x * uAspect, uA.y);
      vec2 ab = vec2(uB.x * uAspect, uB.y) - a;
      float len = length(ab);
      vec2 dir = len > 1e-6 ? ab / len : vec2(1.0, 0.0);
      vec2 ap = p - a;
      vec3 base = texture(uTarget, vUv).xyz;
      if (uMode > 1.5) {
        float along = dot(ap, dir);
        float across = dot(ap, vec2(-dir.y, dir.x));
        if (uMode > 2.5) {
          outColor = vec4(mix(base, uValue, sweep(along, len, across, uRadius) * uStrength), 1.0);
          return;
        }
        vec3 add = vec3(uValue.xy * sweep(along, len, across, uRadius), uValue.z * sweep(along, len, across, uWide));
        outColor = vec4(base + add, 1.0);
        return;
      }
      float h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
      vec2 d = ap - ab * h;
      float r2 = dot(d, d);
      float falloff = exp(-r2 / (uRadius * uRadius));
      float wide = exp(-r2 / (uWide * uWide));
      vec3 result = uMode > 0.5 ? mix(base, uValue, falloff * uStrength) : base + vec3(uValue.xy * falloff, uValue.z * wide);
      outColor = vec4(result, 1.0);
    }`;
    
    const ADVECT = `${HEADER}
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 uVelocityTexel;
    uniform float uDt;
    uniform vec4 uDecay;
    void main() {
      vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uVelocityTexel;
      outColor = texture(uSource, coord) * uDecay;
    }`;
    
    const MACCORMACK = `${HEADER}
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform sampler2D uForward;
    uniform sampler2D uBack;
    uniform vec2 uVelocityTexel;
    uniform vec2 uSourceTexel;
    uniform float uDt;
    uniform vec4 uDecay;
    void main() {
      vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uVelocityTexel;
      vec4 forward = texture(uForward, vUv);
      vec4 corrected = forward + 0.5 * (texture(uSource, vUv) - texture(uBack, vUv));
      vec2 base = (floor(coord / uSourceTexel - 0.5) + 0.5) * uSourceTexel;
      vec4 a = texture(uSource, base);
      vec4 b = texture(uSource, base + vec2(uSourceTexel.x, 0.0));
      vec4 c = texture(uSource, base + vec2(0.0, uSourceTexel.y));
      vec4 d = texture(uSource, base + uSourceTexel);
      vec4 low = min(min(a, b), min(c, d));
      vec4 high = max(max(a, b), max(c, d));
      outColor = clamp(corrected, low, high) * uDecay;
    }`;
    
    const DIVERGENCE = `${HEADER}
    uniform sampler2D uVelocity;
    void main() {
      float left = texture(uVelocity, vL).x;
      float right = texture(uVelocity, vR).x;
      float top = texture(uVelocity, vT).y;
      float bottom = texture(uVelocity, vB).y;
      vec2 center = texture(uVelocity, vUv).xy;
      if (vL.x < 0.0) left = -center.x;
      if (vR.x > 1.0) right = -center.x;
      if (vT.y > 1.0) top = -center.y;
      if (vB.y < 0.0) bottom = -center.y;
      outColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
    }`;
    
    const SCALE = `${HEADER}
    uniform sampler2D uSource;
    uniform float uValue;
    void main() {
      outColor = texture(uSource, vUv) * uValue;
    }`;
    
    const PRESSURE = `${HEADER}
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    void main() {
      float left = texture(uPressure, vL).x;
      float right = texture(uPressure, vR).x;
      float top = texture(uPressure, vT).x;
      float bottom = texture(uPressure, vB).x;
      float divergence = texture(uDivergence, vUv).x;
      outColor = vec4((left + right + bottom + top - divergence) * 0.25, 0.0, 0.0, 1.0);
    }`;
    
    const GRADIENT = `${HEADER}
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    void main() {
      float left = texture(uPressure, vL).x;
      float right = texture(uPressure, vR).x;
      float top = texture(uPressure, vT).x;
      float bottom = texture(uPressure, vB).x;
      vec2 velocity = texture(uVelocity, vUv).xy - vec2(right - left, top - bottom);
      outColor = vec4(velocity, 0.0, 1.0);
    }`;
    
    const SHADE = `
    uniform vec3 uColor;
    uniform vec3 uSecondary;
    uniform float uIntensity;
    uniform float uHotspot;
    vec3 shade(vec3 dye) {
      float energy = max(dye.x, 0.0);
      float heat = clamp(dye.y, 0.0, energy);
      float gas = max(dye.z, 0.0);
      float fresh = heat / max(energy, 0.0001);
      vec3 tint = mix(uSecondary, uColor, fresh);
      return (tint * energy + uSecondary * gas + vec3(heat * heat * 0.3 * uHotspot)) * uIntensity;
    }
    `;
    
    const PREFILTER = `${HEADER}${SHADE}
    uniform sampler2D uDye;
    uniform vec2 uDyeTexel;
    void main() {
      vec2 o = uDyeTexel * 0.5;
      vec3 light = shade(texture(uDye, vUv + vec2(-o.x, -o.y)).xyz);
      light += shade(texture(uDye, vUv + vec2(o.x, -o.y)).xyz);
      light += shade(texture(uDye, vUv + vec2(-o.x, o.y)).xyz);
      light += shade(texture(uDye, vUv + vec2(o.x, o.y)).xyz);
      outColor = vec4(light * 0.25, 1.0);
    }`;
    
    const DOWN = `${HEADER}
    uniform sampler2D uSource;
    uniform vec2 uSourceTexel;
    void main() {
      vec2 o = uSourceTexel;
      vec3 color = texture(uSource, vUv).rgb * 4.0;
      color += texture(uSource, vUv + vec2(-o.x, -o.y)).rgb;
      color += texture(uSource, vUv + vec2(o.x, -o.y)).rgb;
      color += texture(uSource, vUv + vec2(-o.x, o.y)).rgb;
      color += texture(uSource, vUv + vec2(o.x, o.y)).rgb;
      outColor = vec4(color / 8.0, 1.0);
    }`;
    
    const UP = `${HEADER}
    uniform sampler2D uSource;
    uniform vec2 uSourceTexel;
    void main() {
      vec2 o = uSourceTexel;
      vec3 color = texture(uSource, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
      color += texture(uSource, vUv + vec2(o.x * 2.0, 0.0)).rgb;
      color += texture(uSource, vUv + vec2(0.0, -o.y * 2.0)).rgb;
      color += texture(uSource, vUv + vec2(0.0, o.y * 2.0)).rgb;
      color += texture(uSource, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
      color += texture(uSource, vUv + vec2(o.x, -o.y)).rgb * 2.0;
      color += texture(uSource, vUv + vec2(-o.x, o.y)).rgb * 2.0;
      color += texture(uSource, vUv + vec2(o.x, o.y)).rgb * 2.0;
      outColor = vec4(color / 12.0, 1.0);
    }`;
    
    const DISPLAY = `${HEADER}${SHADE}
    uniform sampler2D uDye;
    uniform sampler2D uBloom;
    uniform float uGlow;
    uniform float uGrain;
    uniform float uTime;
    uniform float uLight;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    void main() {
      vec3 dye = texture(uDye, vUv).xyz;
      vec3 light = shade(dye);
      vec3 bloom = texture(uBloom, vUv).rgb * uGlow;
      float edge = smoothstep(0.0, 0.02, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
      float grain = 1.0 + (hash(gl_FragCoord.xy + fract(uTime * 13.7) * 97.0) - 0.5) * uGrain * 2.0;
      if (uLight > 0.5) {
        float energy = max(dye.x, 0.0);
        float heat = clamp(dye.y, 0.0, energy);
        float gas = max(dye.z, 0.0);
        float fresh = heat / max(energy, 0.0001);
        vec3 tint = mix(uSecondary, uColor, fresh);
        float halo = dot(bloom, vec3(0.2126, 0.7152, 0.0722));
        float density = 1.0 - exp(-((energy * 1.1 + gas * 0.8) * uIntensity + halo * 0.25));
        float tone = dot(tint, vec3(0.2126, 0.7152, 0.0722));
        vec3 ink = tint * min(1.0, 0.5 / max(tone, 0.001)) * mix(0.95, 0.72, smoothstep(0.5, 3.0, energy));
        ink = mix(ink, vec3(1.0), clamp(heat * heat * 0.05 * uHotspot, 0.0, 0.45));
        density = clamp(density * grain, 0.0, 1.0) * edge;
        outColor = vec4(ink * density, density);
      } else {
        vec3 color = 1.0 - exp(-(light + bloom) * grain);
        color *= edge;
        outColor = vec4(color, max(color.r, max(color.g, color.b)));
      }
    }`;
    
    const QUALITY = {
      low: { sim: 96, dye: 384 },
      medium: { sim: 128, dye: 576 },
      high: { sim: 160, dye: 768 }
    };
    
    const PRESSURE_STEPS = 20;
    const FLOW = 0.75;
    const BLOOM_LEVELS = 5;

    const Math_min = Math.min, Math_max = Math.max, Math_round = Math.round;
    const clamp = (value, min, max) => Math_min(max, Math_max(min, value));
    
    const compile = (gl, type, source) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    };
    
    const toRgb = (hex) => {
        let r = 0, g = 0, b = 0;
        if (hex.length == 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length == 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        return [r / 255, g / 255, b / 255];
    };
    
    const toHsv = ([r, g, b]) => {
      const max = Math_max(r, g, b), min = Math_min(r, g, b);
      const delta = max - min;
      let hue = 0;
      if (delta > 0) {
        if (max === r) hue = ((g - b) / delta) % 6;
        else if (max === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
      }
      return [(hue * 60 + 360) % 360, max > 0 ? delta / max : 0, max];
    };
    
    const fromHsv = (hue, saturation, value) => {
      const h = (((hue % 360) + 360) % 360) / 60;
      const c = value * saturation;
      const x = c * (1 - Math.abs((h % 2) - 1));
      const m = value - c;
      const [r, g, b] =
        h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
      return [r + m, g + m, b + m];
    };
    
    const canvas = document.getElementById('neon-canvas');
    const container = document.getElementById('sim-container');
    if (!canvas || !container) return;
    
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false
    });
    
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;
    
    const vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX);
    
    const build = source => {
      const fragment = compile(gl, gl.FRAGMENT_SHADER, source);
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragment);
      gl.bindAttribLocation(program, 0, 'aPosition');
      gl.linkProgram(program);
      gl.deleteShader(fragment);
      const uniforms = {};
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i);
        uniforms[info.name] = gl.getUniformLocation(program, info.name);
      }
      return { program, uniforms };
    };
    
    const passes = {
      splat: build(SPLAT), advect: build(ADVECT), maccormack: build(MACCORMACK), divergence: build(DIVERGENCE),
      scale: build(SCALE), pressure: build(PRESSURE), gradient: build(GRADIENT), prefilter: build(PREFILTER),
      down: build(DOWN), up: build(UP), display: build(DISPLAY)
    };
    
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    
    let colorHex = '#6366f1'; 
    const state = {
      width: 1, height: 1, ratio: 1, color: toRgb(colorHex), secondary: [0,0,0],
      pointer: { x: 0, y: 0, inside: true },
      emitter: { x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, travelled: 0 },
      ready: false, isEmitting: true, bursts: [], active: -Infinity, time: 0, allocated: '', targets: null
    };
    
    const [h, s, v] = toHsv(state.color);
    state.secondary = fromHsv(h + 8, Math_min(1, s * 1.1 + 0.05), v);
    
    const createTarget = (w, h, intFmt, fmt, filter) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, intFmt, w, h, 0, fmt, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { texture, fbo, width: w, height: h, texel: [1 / w, 1 / h] };
    };
    
    const createPair = (w, h, intFmt, fmt, filter) => {
      let read = createTarget(w, h, intFmt, fmt, filter);
      let write = createTarget(w, h, intFmt, fmt, filter);
      return { get read() { return read; }, get write() { return write; }, swap() { const t = read; read = write; write = t; } };
    };
    
    const allocate = () => {
      const w = state.width, h = state.height;
      const key = `high|${w}|${h}`;
      if (key === state.allocated && state.targets) return;
      state.allocated = key;
      const preset = QUALITY['high'];
      const aspect = w / h;
      const dims = base => (aspect >= 1 ? [Math_round(base * aspect), base] : [base, Math_round(base / aspect)]);
      const [simW, simH] = dims(preset.sim);
      let [dyeW, dyeH] = dims(preset.dye);
      const bloom = [];
      let bloomW = dyeW >> 1, bloomH = dyeH >> 1;
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        bloom.push(createTarget(Math_max(1, bloomW), Math_max(1, bloomH), gl.RGBA16F, gl.RGBA, gl.LINEAR));
        bloomW >>= 1; bloomH >>= 1;
      }
      state.targets = {
        velocity: createPair(simW, simH, gl.RG16F, gl.RG, gl.LINEAR),
        dye: createPair(dyeW, dyeH, gl.RGBA16F, gl.RGBA, gl.LINEAR),
        forward: createTarget(dyeW, dyeH, gl.RGBA16F, gl.RGBA, gl.LINEAR),
        back: createTarget(dyeW, dyeH, gl.RGBA16F, gl.RGBA, gl.LINEAR),
        pressure: createPair(simW, simH, gl.R16F, gl.RED, gl.NEAREST),
        divergence: createTarget(simW, simH, gl.R16F, gl.RED, gl.NEAREST),
        bloom
      };
    };
    
    const resize = () => {
      state.width = Math_max(1, container.clientWidth);
      state.height = Math_max(1, container.clientHeight);
      canvas.width = state.width;
      canvas.height = state.height;
      allocate();
    };
    
    const draw = t => {
      if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, t.width, t.height); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    
    const use = (pass, texel) => {
      gl.useProgram(pass.program);
      if (pass.uniforms.uTexel) gl.uniform2f(pass.uniforms.uTexel, texel[0], texel[1]);
      return pass.uniforms;
    };
    
    const splat = (pair, ax, ay, bx, by, radius, value, mode, strength, wide = radius) => {
      const u = use(passes.splat, pair.read.texel);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pair.read.texture);
      gl.uniform1i(u.uTarget, 0);
      gl.uniform1f(u.uAspect, state.width / state.height);
      gl.uniform2f(u.uA, ax / state.width, 1 - ay / state.height);
      gl.uniform2f(u.uB, bx / state.width, 1 - by / state.height);
      gl.uniform1f(u.uRadius, radius / state.height);
      gl.uniform1f(u.uWide, wide / state.height);
      gl.uniform3f(u.uValue, value[0], value[1], value[2]);
      gl.uniform1f(u.uMode, mode);
      gl.uniform1f(u.uStrength, strength);
      draw(pair.write);
      pair.swap();
    };
    
    const toGrid = (vx, vy) => [(vx * state.targets.velocity.read.width) / state.width, (-vy * state.targets.velocity.read.height) / state.height];
    
    const emit = (dt, now) => {
      const e = state.emitter;
      e.px = e.x; e.py = e.y;
      
      const omega = 10 + 0.6 * 50;
      const steps = Math_max(1, Math.ceil(dt / 0.004));
      const h = dt / steps;
      for (let k = 0; k < steps; k++) {
        e.vx += (omega * omega * (state.pointer.x - e.x) - 2 * omega * e.vx) * h;
        e.vy += (omega * omega * (state.pointer.y - e.y) - 2 * omega * e.vy) * h;
        e.x += e.vx * h; e.y += e.vy * h;
      }
      
      const dx = e.x - e.px, dy = e.y - e.py;
      const len = Math.hypot(dx, dy);
      if (len < 0.05) return;
      const radius = Math_max(3 * 0.5, (state.height / state.targets.dye.read.height) * 0.9);
      
      const tg = toGrid(dx / Math_max(dt, 1e-3), dy / Math_max(dt, 1e-3));
      splat(state.targets.velocity, e.px, e.py, e.x, e.y, radius * 4 + 18, [tg[0], tg[1], 0], 3, FLOW * 0.6);
      splat(state.targets.dye, e.px, e.py, e.x, e.y, radius, [5.6, 5.6, 0.7], 2, 1, radius * 5 + 6);
      state.active = now;
    };
    
    const render = () => {
      const { dye, bloom } = state.targets;
      let u = use(passes.prefilter, bloom[0].texel);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dye.read.texture);
      gl.uniform1i(u.uDye, 0);
      gl.uniform2f(u.uDyeTexel, dye.read.texel[0], dye.read.texel[1]);
      gl.uniform3f(u.uColor, state.color[0], state.color[1], state.color[2]);
      gl.uniform3f(u.uSecondary, state.secondary[0], state.secondary[1], state.secondary[2]);
      gl.uniform1f(u.uIntensity, 1.3);
      gl.uniform1f(u.uHotspot, 0.8);
      draw(bloom[0]);
      
      u = use(passes.down, bloom[0].texel);
      for (let i = 1; i < bloom.length; i++) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bloom[i - 1].texture);
        gl.uniform1i(u.uSource, 0);
        gl.uniform2f(u.uSourceTexel, bloom[i - 1].texel[0], bloom[i - 1].texel[1]);
        draw(bloom[i]);
      }
      
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      u = use(passes.up, bloom[0].texel);
      for (let i = bloom.length - 1; i > 0; i--) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bloom[i].texture);
        gl.uniform1i(u.uSource, 0);
        gl.uniform2f(u.uSourceTexel, bloom[i].texel[0], bloom[i].texel[1]);
        draw(bloom[i - 1]);
      }
      gl.disable(gl.BLEND);
      
      u = use(passes.display, [1 / canvas.width, 1 / canvas.height]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dye.read.texture); gl.uniform1i(u.uDye, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloom[0].texture); gl.uniform1i(u.uBloom, 1);
      gl.uniform3f(u.uColor, state.color[0], state.color[1], state.color[2]);
      gl.uniform3f(u.uSecondary, state.secondary[0], state.secondary[1], state.secondary[2]);
      gl.uniform1f(u.uIntensity, 1.3);
      gl.uniform1f(u.uHotspot, 0.8);
      gl.uniform1f(u.uGlow, (1.2 * 1.4) / BLOOM_LEVELS);
      gl.uniform1f(u.uGrain, 0);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform1f(u.uLight, 0);
      draw(null);
    };
    
    let last = 0;
    const frame = now => {
      const dt = last ? Math_min(1 / 30, (now - last) / 1000) : 1 / 60;
      last = now;
      state.time += dt;
      
      // Control de Titiritero
      if (window.GlowCursorAPI && window.GlowCursorAPI.active) {
          state.pointer.x += (window.GlowCursorAPI.x - state.pointer.x) * (window.GlowCursorAPI.snap ? 0.3 : 0.08);
          state.pointer.y += (window.GlowCursorAPI.y - state.pointer.y) * (window.GlowCursorAPI.snap ? 0.3 : 0.08);
          if (!state.ready) {
              state.emitter.x = state.pointer.x; state.emitter.y = state.pointer.y;
              state.emitter.px = state.pointer.x; state.emitter.py = state.pointer.y;
              state.ready = true;
          }
      }

      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      
      if (state.ready && state.isEmitting) emit(dt, now);
      
      while (state.bursts.length) {
          const [bx, by] = state.bursts.shift();
          const r = Math_max(3 * 0.5, (state.height / state.targets.dye.read.height) * 0.9);
          for(let k=0; k<6; k++){
              const ang = Math.random() * Math.PI * 2;
              const rch = 20 + Math.random() * 14;
              splat(state.targets.dye, bx, by, bx + Math.cos(ang)*rch, by + Math.sin(ang)*rch, r * 1.1, [2.4, 2.4, 0.3], 0, 1, r * 5 + 6);
          }
          splat(state.targets.dye, bx, by, bx + 0.01, by, r * 2.2, [1.8, 1.8, 0.4], 0, 1, r * 7 + 10);
      }
      
      // Step Advection (Simplified for performance)
      const { velocity, dye, pressure, divergence } = state.targets;
      let u = use(passes.advect, dye.read.texel);
      gl.uniform2f(u.uVelocityTexel, velocity.read.texel[0], velocity.read.texel[1]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.texture); gl.uniform1i(u.uVelocity, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dye.read.texture); gl.uniform1i(u.uSource, 1);
      gl.uniform1f(u.uDt, dt);
      gl.uniform4f(u.uDecay, 0.98, 0.98, 0.98, 1);
      draw(dye.write);
      dye.swap();
      
      render();
      requestAnimationFrame(frame);
    };
    
    resize();
    requestAnimationFrame(frame);
    
    // API para Simulador
    window.GlowCursorAPI = {
        active: true,
        x: state.width/2,
        y: state.height/2,
        snap: false,
        setPointer: (x, y, snap=false) => { window.GlowCursorAPI.x = x; window.GlowCursorAPI.y = y; window.GlowCursorAPI.snap = snap; },
        burst: (x, y) => { state.bursts.push([x, y]); },
        release: () => { 
            window.GlowCursorAPI.active = false; 
            state.isEmitting = false; // Cortar el flujo de neón permanentemente
            
            // Ocultar el canvas suavemente después de que el humo se disipe (2 segundos)
            setTimeout(() => {
                if (canvas) {
                    canvas.style.transition = 'opacity 2s ease-out';
                    canvas.style.opacity = '0';
                    setTimeout(() => canvas.remove(), 2000); // Limpiar DOM
                }
            }, 1500);
        }
    };
    
    window.addEventListener('resize', resize);
    // Hemos eliminado el listener de 'pointermove' real. El canvas nunca obedecerá al mouse físico.
});