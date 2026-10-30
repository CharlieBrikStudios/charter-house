// "Step inside": the Charter House interior CGIs, upscaled with AI and given depth by a monocular
// depth model (MiDaS), rendered as a displaced surface so the room has real parallax as you move.
import * as THREE from 'three';

const HOTS = {
  int_living1: [[0.13, 0.43, 'Marble-effect quartz worktops'], [0.27, 0.62, 'Integrated appliances and LED under-cabinet lights'], [0.86, 0.30, 'Tall timber windows'], [0.55, 0.86, 'Premium LVT flooring']],
  int_living2a: [[0.86, 0.42, 'Kitchen with quartz worktops'], [0.10, 0.25, 'Light from two directions'], [0.45, 0.82, 'Premium LVT flooring']],
  int_living2b: [[0.62, 0.42, 'Fully fitted kitchen'], [0.83, 0.35, 'Dual-aspect corner windows'], [0.30, 0.72, 'Space to live and dine']],
  int_bedroom: [[0.50, 0.30, 'Full-height window'], [0.66, 0.55, 'Room for a king-size bed'], [0.18, 0.62, 'Wooden doors and heritage-colour joinery']],
  int_bathroom: [[0.70, 0.40, 'Glass shower screen, matt black fittings'], [0.48, 0.30, 'Backlit mirrored cabinet'], [0.42, 0.62, 'Wall-hung WC and basin']],
};

export class Interior {
  constructor(base) {
    this.base = base;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0908');
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.01, 60);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, depth: { value: null }, uAmp: { value: 0.42 }, uFade: { value: 0 }, uAspect: { value: 1.95 } },
      vertexShader: `
        uniform sampler2D depth; uniform float uAmp;
        varying vec2 vUv; varying float vD;
        void main(){
          vUv = uv;
          float d = texture2D(depth, uv).r;
          // no displacement at the frame edges, so the borders never tear or stretch
          float edge = smoothstep(0.0, 0.16, uv.x) * smoothstep(1.0, 0.84, uv.x) * smoothstep(0.0, 0.16, uv.y) * smoothstep(1.0, 0.84, uv.y);
          d = mix(0.45, d, edge);
          vD = d;
          vec3 p = position;
          p.z += pow(d, 1.35) * uAmp;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform float uFade; varying vec2 vUv; varying float vD;
        void main(){
          vec4 c = texture2D(map, vUv);
          vec2 q = vUv - 0.5;
          float vig = smoothstep(0.95, 0.25, length(q * vec2(1.0, 1.25)));
          c.rgb *= mix(0.92, 1.0, vig);
          c.rgb *= (1.0 - uFade);
          gl_FragColor = c;
          #include <colorspace_fragment>
        }`,
      toneMapped: false,
    });
    this.mesh = null;
    this.target = new THREE.Vector2(); this.cur = new THREE.Vector2();
    this.t = 0; this.zoom = 0;
    this.loader = new THREE.TextureLoader();
    this.depthCanvas = document.createElement('canvas');
    this.hots = [];
    this.manifest4k = new Set();
  }

  setAspect(w, h) { this.vw = w; this.vh = h; this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this._fit(); }

  _fit() {
    if (!this.mesh) return;
    const H = 2, W = H * this.imgAspect;
    const vf = THREE.MathUtils.degToRad(this.cam.fov);
    // distance so the image covers the viewport (with overscan for parallax)
    const dH = (H / 2) / Math.tan(vf / 2);
    const dW = (W / 2) / (Math.tan(vf / 2) * this.cam.aspect);
    this.dist = Math.min(dH, dW) * 0.93;
  }

  async show(key, { big = false } = {}) {
    const url2k = `${this.base}cgi/${key}_2k.jpg`, url4k = `${this.base}cgi/${key}_4k.jpg`;
    const [img, dep] = await Promise.all([this._tex(url2k, true), this._tex(`${this.base}cgi/${key}_depth.png`, false)]);
    this.imgAspect = img.image.width / img.image.height;
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    const H = 2, W = H * this.imgAspect;
    const g = new THREE.PlaneGeometry(W, H, 320, Math.round(320 / this.imgAspect));
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mat.uniforms.map.value = img; this.mat.uniforms.depth.value = dep;
    this.scene.add(this.mesh);
    this.key = key; this.zoom = 0; this.t = 0;
    this._fit();
    this._depthSample(dep.image);
    this._buildHots(key);
    // upgrade to the AI-upscaled 4K frame on large screens
    if (big) this._tex(url4k, true).then(t4 => { if (this.key === key) { this.mat.uniforms.map.value = t4; } }).catch(() => {});
  }

  _tex(url, srgb) {
    return new Promise((res, rej) => this.loader.load(url, t => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
      res(t);
    }, undefined, rej));
  }

  _depthSample(img) {
    const c = this.depthCanvas; c.width = 160; c.height = Math.round(160 * img.height / img.width);
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height);
    this.depthData = x.getImageData(0, 0, c.width, c.height);
  }
  depthAt(u, v) {
    const d = this.depthData; if (!d) return 0.5;
    const x = Math.min(d.width - 1, Math.max(0, Math.round(u * (d.width - 1)))), y = Math.min(d.height - 1, Math.max(0, Math.round(v * (d.height - 1))));
    return d.data[(y * d.width + x) * 4] / 255;
  }

  _buildHots(key) {
    const el = document.getElementById('hots'); el.innerHTML = '';
    this.hots = (HOTS[key] || []).map(([u, v, text]) => {
      const d = document.createElement('div'); d.className = 'hot';
      d.innerHTML = `<i tabindex="0" role="button" aria-label="${text}"></i><span>${text}</span>`;
      el.appendChild(d);
      const H = 2, W = H * this.imgAspect;
      const z = Math.pow(this.depthAt(u, v), 1.35) * this.mat.uniforms.uAmp.value;
      return { el: d, p: new THREE.Vector3((u - 0.5) * W, (0.5 - v) * H, z) };
    });
  }

  pointer(nx, ny) { this.target.set(nx, ny); }

  update(dt) {
    this.t += dt;
    this.zoom = Math.min(1, this.zoom + dt * 0.35);
    const k = 1 - Math.pow(0.0015, dt);
    this.cur.lerp(this.target, k);
    const drift = Math.sin(this.t * 0.18) * 0.04;
    const ez = 1 - Math.pow(1 - this.zoom, 3);
    const d = (this.dist || 2.4) * (0.82 + 0.18 * ez) - this.t * 0.004;
    // on narrow (portrait) screens the room is wider than the view: let the viewer pan across it
    const halfW = d * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * this.cam.aspect;
    const pan = Math.max(0, (this.imgAspect || 2) - halfW) * 0.92;
    const px = pan > 0.2 ? this.cur.x * pan + Math.sin(this.t * 0.12) * pan * 0.35 * (1 - Math.min(1, Math.abs(this.cur.x) * 3)) : this.cur.x * 0.1 + drift * 0.6;
    this.cam.position.set(px, -this.cur.y * 0.05, Math.max(1.2, d));
    this.cam.lookAt(pan > 0.2 ? px : this.cur.x * 0.05, -this.cur.y * 0.03, 0);
    // hotspots
    const v = new THREE.Vector3();
    for (const h of this.hots) {
      v.copy(h.p).project(this.cam);
      h.el.style.left = ((v.x + 1) / 2 * this.vw) + 'px';
      h.el.style.top = ((1 - v.y) / 2 * this.vh) + 'px';
    }
  }

  render(renderer) {
    const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.cam);
    renderer.toneMapping = tm;
  }
}
