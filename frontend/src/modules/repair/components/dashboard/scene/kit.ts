import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Geometry helpers and procedural textures ported from the owner's model `แผนผังงานซ่อมอาคาร.html`
// (sections 2–3, D-082). No image downloads: every texture is drawn on a canvas. Colours here are the
// model's own material colours (3D only, not UI tokens).

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d", { willReadFrequently: true })!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function noise(g: CanvasRenderingContext2D, w: number, h: number, amp: number, rnd: () => number = Math.random) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amp;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

/** Box geometry with its bottom at y. */
export function bg(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

/** World-scaled box-projected UVs so textures keep real size on long and short pieces. */
export function worldUV<T extends THREE.BufferGeometry>(geo: T, s = 0.25): T {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i) * s, p.getY(i) * s);
    else if (ay >= az) uv.setXY(i, p.getX(i) * s, p.getZ(i) * s);
    else uv.setXY(i, p.getX(i) * s, p.getY(i) * s);
  }
  return geo;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function merged(list: THREE.BufferGeometry[], mat: THREE.Material, cast = true, receive = true) {
  return mesh(mergeGeometries(list), mat, cast, receive);
}

export function planeUV(w: number, h: number, ru: number, rv = 1, uOff = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru + uOff, uv.getY(i) * rv);
  return g;
}

export const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export type Textures = ReturnType<typeof createTextures>;

/** The model's procedural textures (sky, concrete, glass interior, site, plan floors, sign). */
export function createTextures() {
  const sky = canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#3f78b5"); gr.addColorStop(0.28, "#7eaedb"); gr.addColorStop(0.46, "#cfdfea");
    gr.addColorStop(0.5, "#e3e9ea"); gr.addColorStop(0.515, "#a7a99f"); gr.addColorStop(1, "#55574f");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.filter = "blur(10px)";
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.35})`;
      g.beginPath(); g.ellipse(r() * w, 120 + r() * 110, 40 + r() * 90, 10 + r() * 18, 0, 0, Math.PI * 2); g.fill();
    }
    g.filter = "none";
    const sun = g.createRadialGradient(w * 0.62, h * 0.2, 0, w * 0.62, h * 0.2, 60);
    sun.addColorStop(0, "rgba(255,250,235,1)"); sun.addColorStop(1, "rgba(255,250,235,0)");
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
  });
  sky.mapping = THREE.EquirectangularReflectionMapping;

  const concrete = canvasTex(512, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = "#ecebe6"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${110 + r() * 40},${110 + r() * 35},${100 + r() * 30},${0.05 + r() * 0.06})`); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 90; i++) {
      const x = r() * w, len = 40 + r() * 260, wd = 1 + r() * 4;
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, `rgba(70,72,66,${0.12 + r() * 0.12})`); gr.addColorStop(1, "rgba(70,72,66,0)");
      g.fillStyle = gr; g.fillRect(x, 0, wd, len);
    }
    noise(g, w, h, 18, r);
  });

  const interior = canvasTex(1024, 256, (g, w, h) => {
    const r = rng(23), pw = w / 8;
    for (let i = 0; i < 8; i++) {
      const x = i * pw;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#596064"); gr.addColorStop(0.2, "#3c4245"); gr.addColorStop(1, "#262b2d");
      g.fillStyle = gr; g.fillRect(x, 0, pw, h);
      if (r() < 0.7) { g.fillStyle = "rgba(235,242,236,.85)"; g.fillRect(x + 12, 30, pw - 24, 5); }
      g.fillStyle = "#1b1f21";
      for (let k = 0; k < 3; k++) { const fh = 30 + r() * 50; g.fillRect(x + r() * pw * 0.7, h - fh, 20 + r() * 40, fh); }
      if (r() < 0.45) {
        const bh = 40 + r() * 150;
        g.fillStyle = "#c9c7bd"; g.fillRect(x + 2, 0, pw - 4, bh);
        g.fillStyle = "rgba(0,0,0,.12)";
        for (let y = 0; y < bh; y += 5) g.fillRect(x + 2, y, pw - 4, 1);
      }
    }
    g.fillStyle = "rgba(28,62,74,.42)"; g.fillRect(0, 0, w, h);
    const rf = g.createLinearGradient(0, 0, w, h);
    rf.addColorStop(0, "rgba(255,255,255,.10)"); rf.addColorStop(0.5, "rgba(255,255,255,0)"); rf.addColorStop(1, "rgba(255,255,255,.06)");
    g.fillStyle = rf; g.fillRect(0, 0, w, h);
  });

  const asphalt = canvasTex(512, 512, (g, w, h) => {
    const r = rng(3);
    g.fillStyle = "#6c6f6d"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = r() < 0.5 ? "rgba(20,20,20,.35)" : "rgba(170,170,165,.3)"; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    for (let i = 0; i < 25; i++) {
      const x = r() * w, y = r() * h, rad = 30 + r() * 80;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(30,30,30,.07)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    noise(g, w, h, 14, r);
  });

  const paving = canvasTex(256, 256, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = "#c4bfb4"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.fillStyle = `rgba(${150 + r() * 40},${145 + r() * 40},${135 + r() * 35},.35)`; g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62); }
    g.fillStyle = "rgba(80,76,70,.55)";
    for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1, 0, 2, h); g.fillRect(0, i * 64 - 1, w, 2); }
    noise(g, w, h, 16, r);
  });

  const grass = canvasTex(256, 256, (g, w, h) => {
    const r = rng(9);
    g.fillStyle = "#5f8a3f"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${40 + r() * 70},${90 + r() * 70},${25 + r() * 30},.55)`; g.fillRect(r() * w, r() * h, 1, 2 + r() * 3); }
    noise(g, w, h, 20, r);
  });

  const leaves = canvasTex(256, 256, (g, w, h) => {
    const r = rng(17), cols = ["#2c5224", "#3a6a2c", "#4b7a34", "#5f8c3e", "#6f9a48", "#26461f"];
    for (let i = 0; i < 900; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 118;
      g.fillStyle = cols[(r() * cols.length) | 0];
      g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 5 + r() * 6, 2.5 + r() * 2.5, r() * Math.PI, 0, Math.PI * 2); g.fill();
    }
  });
  leaves.wrapS = leaves.wrapT = THREE.ClampToEdgeWrapping;

  const hedge = canvasTex(256, 256, (g, w, h) => {
    const r = rng(19);
    g.fillStyle = "#2f5426"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${40 + r() * 60},${80 + r() * 70},${30 + r() * 30},.8)`; g.beginPath(); g.ellipse(r() * w, r() * h, 3, 1.6, r() * 3, 0, Math.PI * 2); g.fill(); }
  });

  const poster = canvasTex(256, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#125d9e"); gr.addColorStop(1, "#3a9fdc");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,.22)";
    g.beginPath(); g.ellipse(w * 0.72, h * 0.95, 120, 70, -0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(18, 20, 112, 11); g.fillRect(18, 38, 74, 7);
    g.fillStyle = "#dfe8ee"; g.fillRect(150, 52, 84, 62);
    g.fillStyle = "#9fb3c1"; g.fillRect(156, 92, 72, 16);
  });

  const portrait = canvasTex(64, 96, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#8aa6bd"); gr.addColorStop(1, "#4c5d6c");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "#e9e2d0";
    g.beginPath(); g.ellipse(w / 2, h * 0.36, 9, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(w / 2 - 15, h * 0.5, 30, h * 0.5);
  });

  const curb = canvasTex(64, 8, (g, w, h) => {
    g.fillStyle = "#e8772a"; g.fillRect(0, 0, w / 2, h);
    g.fillStyle = "#ecebe5"; g.fillRect(w / 2, 0, w / 2, h);
  });

  const tile = canvasTex(256, 256, (g, w, h) => {
    const r = rng(29);
    g.fillStyle = "#e4e3de"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.fillStyle = `rgba(${200 + r() * 30},${198 + r() * 30},${190 + r() * 30},.5)`; g.fillRect(x * 64, y * 64, 64, 64); }
    g.fillStyle = "rgba(150,148,140,.6)";
    for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1, 0, 1.5, h); g.fillRect(0, i * 64 - 1, w, 1.5); }
    noise(g, w, h, 8, r);
  });

  const carpet = canvasTex(256, 256, (g, w, h) => {
    const r = rng(31);
    g.fillStyle = "#d6d6d2"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = 150 + r() * 90; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(r() * w, r() * h, 1, 1); }
    noise(g, w, h, 22, r);
  });

  const wetTile = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#c7d4da"; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(110,130,140,.5)";
    for (let i = 0; i <= 4; i++) { g.fillRect(i * 32 - 1, 0, 1.5, h); g.fillRect(0, i * 32 - 1, w, 1.5); }
  });

  const signCanvas = document.createElement("canvas");
  signCanvas.width = 2048;
  signCanvas.height = 176;
  drawSign(signCanvas.getContext("2d")!, 2048, 176);
  const sign = new THREE.CanvasTexture(signCanvas);
  sign.colorSpace = THREE.SRGBColorSpace;
  sign.anisotropy = 8;

  return { sky, concrete, interior, asphalt, paving, grass, leaves, hedge, poster, portrait, curb, tile, carpet, wetTile, sign };
}

/** The roof billboard (CPAC blue). Uses the app font (Anuphan) instead of the model's web fonts. */
function drawSign(g: CanvasRenderingContext2D, w: number, h: number) {
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  g.fillStyle = "#1d7cc0"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#ffffff"; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = "#ffffff"; g.textBaseline = "middle";
  g.font = `600 62px ${font}`;
  g.textAlign = "left"; g.fillText("เจาะจงคุณภาพ  เจาะจง", 60, h / 2 + 4);
  g.textAlign = "center";
  g.strokeRect(w * 0.56 - 90, 26, 180, h - 52);
  g.font = `700 60px ${font}`; g.fillText("CPAC", w * 0.56, h / 2 + 2);
  g.textAlign = "right"; g.font = "600 62px monospace"; g.fillText("02-555-5555", w - 60, h / 2 + 2);
}

/** Alpha-tested leaf cards with rounded normals (potted plants, roof planters, trees). */
export function leafClusters(parent: THREE.Object3D, tex: Textures, list: [number, number, number, number, number][]) {
  const leafMat = new THREE.MeshStandardMaterial({ map: tex.leaves, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.4 });
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex.leaves, alphaTest: 0.5 });
  const geos: THREE.BufferGeometry[] = [];
  const r = rng(list.length * 13 + 5), e = new THREE.Euler(), mtx = new THREE.Matrix4(), c = new THREE.Vector3(), v = new THREE.Vector3();
  for (const [x, y, z, rad, n] of list) {
    c.set(x, y, z);
    for (let i = 0; i < n; i++) {
      const p = new THREE.PlaneGeometry(rad * 1.25, rad * 1.25);
      e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
      p.applyMatrix4(mtx.makeRotationFromEuler(e));
      const a = r() * Math.PI * 2, u = r() * 2 - 1, d = Math.cbrt(r()) * rad * 0.7, s = Math.sqrt(1 - u * u);
      p.translate(x + Math.cos(a) * s * d, y + u * d * 0.8, z + Math.sin(a) * s * d);
      const pos = p.attributes.position, nor = p.attributes.normal;
      for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).sub(c).normalize(); nor.setXYZ(k, v.x, v.y, v.z); }
      geos.push(p);
    }
  }
  const m = mesh(mergeGeometries(geos), leafMat);
  m.customDepthMaterial = leafDepth;
  parent.add(m);
  return m;
}

/** Releases every geometry, material and texture under `root`. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture && v.userData.owned) v.dispose();
      mat.dispose();
    }
  });
}
