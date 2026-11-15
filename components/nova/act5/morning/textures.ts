import * as THREE from "three";

/**
 * Procedural PBR texture sets for "The Morning of the Inspection" (no image assets): each set draws a
 * colour field and a height field on canvases, derives a tangent-space normal map from the height,
 * and optionally a roughness map. Sizes stay small (256–1024 px) and tile in world units (see worldUV).
 */

let seed = 4242;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export const resetSeed = (s = 4242) => { seed = s; };

type Ctx = CanvasRenderingContext2D;
const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Smooth value noise, tileable on an n×n grid. */
function valueNoise(cells: number) {
  const g = Array.from({ length: cells * cells }, rnd);
  const at = (i: number, j: number) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
  return (u: number, v: number) => {
    const x = u * cells, y = v * cells;
    const i = Math.floor(x), j = Math.floor(y);
    const fx = x - i, fy = y - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
}
/** Fractal noise from several octaves (all tileable). */
export function fbm(octaves: number[]) {
  const ns = octaves.map((c) => valueNoise(c));
  return (u: number, v: number) => {
    let s = 0, w = 0, a = 1;
    for (const n of ns) { s += n(u, v) * a; w += a; a *= 0.55; }
    return s / w;
  };
}

/** Normal map from a greyscale height canvas (wrapping at the edges, so it tiles). */
function heightToNormal(h: HTMLCanvasElement, strength: number) {
  const w = h.width, ht = h.height;
  const src = h.getContext("2d")!.getImageData(0, 0, w, ht).data;
  const out = canvas(w, ht);
  const ctx = out.getContext("2d")!;
  const img = ctx.createImageData(w, ht);
  const H = (x: number, y: number) => src[(((y + ht) % ht) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < ht; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function tex(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface TextureSet { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap?: THREE.Texture }

/** Build a set from per-pixel functions (u, v in 0..1): colour [r,g,b] 0..255, height 0..1, roughness 0..1. */
export function makeSet(
  w: number, h: number,
  f: { color: (u: number, v: number) => [number, number, number]; height: (u: number, v: number) => number; rough?: (u: number, v: number) => number },
  normalStrength: number,
): TextureSet {
  const cc = canvas(w, h), hc = canvas(w, h), rc = f.rough ? canvas(w, h) : null;
  const ci = cc.getContext("2d")!.createImageData(w, h);
  const hi = hc.getContext("2d")!.createImageData(w, h);
  const ri = rc?.getContext("2d")!.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h, i = (y * w + x) * 4;
      const [r, g, b] = f.color(u, v);
      ci.data[i] = r; ci.data[i + 1] = g; ci.data[i + 2] = b; ci.data[i + 3] = 255;
      const hv = Math.max(0, Math.min(1, f.height(u, v))) * 255;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hv; hi.data[i + 3] = 255;
      if (ri && f.rough) { const rv = Math.max(0, Math.min(1, f.rough(u, v))) * 255; ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = rv; ri.data[i + 3] = 255; }
    }
  }
  cc.getContext("2d")!.putImageData(ci, 0, 0);
  hc.getContext("2d")!.putImageData(hi, 0, 0);
  if (rc && ri) rc.getContext("2d")!.putImageData(ri, 0, 0);
  return { map: tex(cc, true), normalMap: tex(heightToNormal(hc, normalStrength), false), roughnessMap: rc ? tex(rc, false) : undefined };
}

/** A canvas-drawn texture (labels, print). */
export function drawTexture(w: number, h: number, draw: (g: Ctx) => void, srgb = true) {
  const c = canvas(w, h);
  draw(c.getContext("2d")!);
  return tex(c, srgb);
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const shade = (rgb: [number, number, number], k: number): [number, number, number] => [rgb[0] * k, rgb[1] * k, rgb[2] * k];
const fract = (v: number) => v - Math.floor(v);

/**
 * Re-maps a BoxGeometry's UVs to world units (one texture repeat = `tile` metres), so the same
 * material tiles at real-world scale on boxes of any size.
 */
export function worldUV(geo: THREE.BoxGeometry, tileU: number, tileV = tileU) {
  const { width: W, height: H, depth: D } = geo.parameters;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const faceDims: [number, number][] = [[D, H], [D, H], [W, D], [W, D], [W, H], [W, H]];
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = faceDims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * fu / tileU, uv.getY(i) * fv / tileV);
    }
  }
  uv.needsUpdate = true;
  return geo;
}
/** Same for a PlaneGeometry. */
export function planeUV(geo: THREE.PlaneGeometry, tileU: number, tileV = tileU) {
  const { width: W, height: H } = geo.parameters;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W / tileU, uv.getY(i) * H / tileV);
  uv.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------------------------------------
// Texture sets
// ---------------------------------------------------------------------------------------------

/** Composite facade cladding: 4 panels per tile, recessed joints, slight per-panel tone (tile = 4 m × 1.5 m). */
export function claddingSet() {
  const n = fbm([8, 32]);
  const tones = Array.from({ length: 4 }, () => 0.96 + rnd() * 0.06);
  return makeSet(512, 192, {
    color: (u, v) => {
      const p = Math.floor(u * 4);
      const k = tones[p] * (0.97 + n(u, v) * 0.05);
      const seam = fract(u * 4) < 0.012 || v < 0.03;
      return seam ? [70, 76, 84] : shade([200, 205, 210], k);
    },
    height: (u, v) => (fract(u * 4) < 0.012 || v < 0.03 ? 0.2 : 0.8 + n(u, v) * 0.02),
    rough: (u, v) => 0.48 + n(u, v) * 0.12,
  }, 3);
}

/** Dark anodised aluminium (window frames, fascias, coping) — fine brushed streaks. */
export function brushedSet(base: [number, number, number]) {
  const n = fbm([4, 64, 256]);
  return makeSet(256, 256, {
    color: (u, v) => shade(base, 0.92 + n(u * 0.05, v) * 0.16),
    height: (u, v) => n(u * 0.02, v) * 0.5,
    rough: (u, v) => 0.32 + n(u * 0.02, v) * 0.12,
  }, 1.2);
}

/** Precast concrete: fine pores and soft mottling (tile 2 m). */
export function concreteSet(base: [number, number, number] = [158, 158, 154]) {
  const n = fbm([6, 24, 96]);
  const pores = fbm([200]);
  return makeSet(512, 512, {
    color: (u, v) => shade(base, 0.86 + n(u, v) * 0.22 - (pores(u, v) > 0.82 ? 0.15 : 0)),
    height: (u, v) => n(u, v) * 0.4 + (pores(u, v) > 0.82 ? 0 : 0.5),
    rough: (u, v) => 0.82 + n(u, v) * 0.12,
  }, 2.5);
}

/** Asphalt: dark binder with light aggregate (tile 3 m). */
export function asphaltSet() {
  const n = fbm([4, 16]);
  const agg = fbm([180, 360]);
  return makeSet(512, 512, {
    color: (u, v) => {
      const a = agg(u, v);
      const base = 58 + n(u, v) * 16;
      const s = a > 0.68 ? 40 * (a - 0.68) / 0.32 : 0;
      return [base + s, base + 2 + s, base + 5 + s];
    },
    height: (u, v) => agg(u, v),
    rough: (u, v) => 0.86 - n(u, v) * 0.12,
  }, 4);
}

/** Paving slabs 600×600 with sand joints (tile 1.2 m = 2×2 slabs). */
export function pavingSet() {
  const n = fbm([8, 64]);
  const tones = Array.from({ length: 4 }, () => 0.9 + rnd() * 0.12);
  return makeSet(256, 256, {
    color: (u, v) => {
      const joint = fract(u * 2) < 0.02 || fract(v * 2) < 0.02;
      const t = tones[Math.floor(u * 2) + Math.floor(v * 2) * 2];
      return joint ? [92, 92, 88] : shade([176, 172, 164], t * (0.95 + n(u, v) * 0.1));
    },
    height: (u, v) => (fract(u * 2) < 0.02 || fract(v * 2) < 0.02 ? 0.1 : 0.7 + n(u, v) * 0.1),
    rough: () => 0.85,
  }, 3);
}

/** Mown grass at dawn (desaturated, dewy) — tile 2 m. */
export function grassSet() {
  const n = fbm([6, 32, 160]);
  return makeSet(256, 256, {
    color: (u, v) => { const k = n(u, v); return [mix(48, 74, k), mix(62, 90, k), mix(48, 64, k)]; },
    height: (u, v) => n(u, v),
    rough: () => 0.95,
  }, 3);
}

/** Roller-door slats: horizontal ribs (tile 1 m). */
export function slatsSet() {
  return makeSet(64, 256, {
    color: (_u, v) => shade([150, 156, 162], 0.9 + 0.1 * Math.sin(v * Math.PI * 2 * 12)),
    height: (_u, v) => 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 12),
    rough: () => 0.5,
  }, 2);
}

/** Air-handler louvres: angled blades (tile 1 m). */
export function louvreSet() {
  return makeSet(64, 256, {
    color: (_u, v) => { const f = fract(v * 10); return f < 0.35 ? [52, 56, 60] : shade([170, 174, 176], 0.85 + f * 0.15); },
    height: (_u, v) => fract(v * 10),
    rough: () => 0.45,
  }, 3);
}

/** Oak veneer: long, irregular grain (stretched noise), soft figure bands and fine pores. Tile 2.4 m × 0.6 m. */
export function oakSet(base: [number, number, number] = [146, 112, 80]) {
  const warp = fbm([3, 7]);
  const grain = fbm([12, 48, 160]);
  const band = fbm([2, 5]);
  const pores = fbm([300]);
  const lines = (u: number, v: number) => { const w = v + (warp(u, v) - 0.5) * 0.08; return grain(u * 0.08, w); };
  return makeSet(1024, 256, {
    color: (u, v) => {
      const l = lines(u, v);
      const k = 0.8 + l * 0.26 + (band(u * 0.4, v) - 0.5) * 0.14 - (pores(u * 0.15, v) > 0.8 ? 0.05 : 0);
      return shade(base, k);
    },
    height: (u, v) => lines(u, v) * 0.6 - (pores(u * 0.15, v) > 0.8 ? 0.15 : 0),
    rough: (u, v) => 0.4 + (1 - lines(u, v)) * 0.12,
  }, 0.5);
}

/** Upholstery: tight woven fabric (tile 0.12 m). */
export function fabricSet(base: [number, number, number]) {
  const n = fbm([8, 64]);
  return makeSet(128, 128, {
    color: (u, v) => shade(base, 0.93 + n(u, v) * 0.1 + 0.015 * Math.sin(u * Math.PI * 64) * Math.sin(v * Math.PI * 64)),
    height: (u, v) => 0.5 + 0.25 * Math.sin(u * Math.PI * 64) + 0.25 * Math.sin(v * Math.PI * 64 + Math.PI / 2),
    rough: () => 0.95,
  }, 1.5);
}

/** Carpet tiles (500 mm, quarter-turned): loop pile with a directional stripe (tile 1 m = 2×2 tiles). */
export function carpetSet() {
  const n = fbm([16, 128, 256]);
  return makeSet(512, 512, {
    color: (u, v) => {
      const tile = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
      const stripe = 0.5 + 0.5 * Math.sin((tile ? u : v) * Math.PI * 2 * 40);
      return shade([74, 80, 90], 0.84 + n(u, v) * 0.2 + stripe * 0.06);
    },
    height: (u, v) => n(u, v) * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(((Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? u : v) * Math.PI * 2 * 40)),
    rough: () => 1,
  }, 2);
}

/** Painted plaster: barely-there roller texture (tile 1.5 m). */
export function plasterSet() {
  const n = fbm([12, 64, 256]);
  return makeSet(256, 256, {
    color: (u, v) => shade([224, 222, 216], 0.97 + n(u, v) * 0.04),
    height: (u, v) => n(u, v),
    rough: () => 0.9,
  }, 0.6);
}

/** Tegular ceiling tiles 600×600 in a white T-bar grid, fissured surface (tile 1.2 m). */
export function ceilingSet() {
  const n = fbm([32, 160]);
  return makeSet(256, 256, {
    color: (u, v) => {
      const bar = fract(u * 2) < 0.018 || fract(v * 2) < 0.018;
      return bar ? [238, 238, 236] : shade([226, 226, 222], 0.95 + n(u, v) * 0.06 - (n(u * 3, v * 3) > 0.72 ? 0.05 : 0));
    },
    height: (u, v) => { const e = Math.min(fract(u * 2), fract(v * 2), 1 - fract(u * 2), 1 - fract(v * 2)); return Math.min(1, e * 30) * 0.8 + n(u, v) * 0.1; },
    rough: () => 0.95,
  }, 2.5);
}

/** Bookcloth / linen board for the dossier (tile 0.25 m). */
export function linenSet(base: [number, number, number]) {
  const n = fbm([16, 128]);
  return makeSet(256, 256, {
    color: (u, v) => shade(base, 0.92 + n(u, v) * 0.1 + 0.03 * Math.sin(u * Math.PI * 180)),
    height: (u, v) => 0.5 + 0.25 * Math.sin(u * Math.PI * 180) + 0.25 * Math.sin(v * Math.PI * 180),
    rough: () => 0.8,
  }, 0.8);
}
