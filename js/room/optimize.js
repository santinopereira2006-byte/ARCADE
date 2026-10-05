/**
 * ARCADE - render-cost helpers for the 3D lobby
 *
 * Small, dependency-free utilities that cut CPU draw-call overhead and GPU
 * shading cost without changing how the scene looks:
 *   - simplifyMaterial / simplifyTree : drop PBR extras (Lambert on Low) and kill
 *     glass "transmission", which makes three.js render the whole scene twice.
 *   - mergeMeshesByMaterial           : collapse a multi-mesh model (e.g. an arcade
 *     cabinet made of 12 meshes) into one mesh per material.
 *   - mergeStatic                     : merge many small static meshes into one.
 *   - textureIsOpaque                 : lets alpha-blended materials with fully
 *     opaque textures be drawn as plain opaque (no sorting, no blending).
 */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ------------------------------------------------------------------ textures

let _scanCanvas = null;

/**
 * True when every pixel of `tex` is fully opaque. Only small textures are
 * scanned (palette / pixel-art atlases); large or unreadable ones return false
 * so the caller keeps the original (safe) blending behaviour.
 */
export function textureIsOpaque(tex, maxPixels = 512 * 512) {
  try {
    const img = tex && tex.image;
    if (!img) return false;
    const w = img.width || img.videoWidth || 0;
    const h = img.height || img.videoHeight || 0;
    if (!w || !h || w * h > maxPixels) return false;
    if (!_scanCanvas) _scanCanvas = document.createElement("canvas");
    _scanCanvas.width = w;
    _scanCanvas.height = h;
    const ctx = _scanCanvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return false;
    return true;
  } catch (_) {
    return false;
  }
}

// ----------------------------------------------------------------- materials

const GLASS_OPACITY = 0.16;

/**
 * Cheaper stand-in for a PBR material. Physical/transmissive materials always
 * become plain Standard (or Lambert when `lambert`) ones; glass turns into a
 * faint alpha-blended pane. Unlit / basic / custom materials are left alone.
 */
export function simplifyMaterial(m, { lambert = false } = {}) {
  if (!m || !m.isMeshStandardMaterial) return m;     // Physical extends Standard
  const transmissive = (m.transmission || 0) > 0;
  if (!lambert && !m.isMeshPhysicalMaterial) return m;

  const next = lambert ? new THREE.MeshLambertMaterial() : new THREE.MeshStandardMaterial();
  next.name = m.name;
  next.color.copy(m.color);
  next.map = m.map || null;
  next.emissive.copy(m.emissive);
  next.emissiveMap = m.emissiveMap || null;
  next.emissiveIntensity = m.emissiveIntensity;
  next.alphaMap = m.alphaMap || null;
  next.alphaTest = m.alphaTest;
  next.opacity = m.opacity;
  next.transparent = m.transparent;
  next.side = m.side;
  next.vertexColors = m.vertexColors;
  next.flatShading = m.flatShading;
  next.depthWrite = m.depthWrite;
  next.visible = m.visible;
  if (!lambert) {
    next.roughness = m.roughness;
    next.metalness = m.metalness;
    next.roughnessMap = m.roughnessMap || null;
    next.metalnessMap = m.metalnessMap || null;
    next.normalMap = m.normalMap || null;
    if (m.normalScale) next.normalScale.copy(m.normalScale);
    next.envMap = m.envMap || null;
    next.envMapIntensity = m.envMapIntensity;
  }
  if (transmissive) {
    next.transparent = true;
    next.opacity = Math.min(next.opacity, GLASS_OPACITY);
    next.depthWrite = false;
  }
  m.dispose();
  return next;
}

/** simplifyMaterial over every mesh below `root` (shared materials stay shared). */
export function simplifyTree(root, opts) {
  const cache = new Map();
  const swap = m => {
    if (!cache.has(m)) cache.set(m, simplifyMaterial(m, opts));
    return cache.get(m);
  };
  root.traverse(node => {
    if (!node.isMesh || !node.material) return;
    node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
  });
}

// -------------------------------------------------------------------- merging

/**
 * Collapse every mesh below `root` into one mesh per material, baked into root
 * space (root's own transform is baked in too). Invisible meshes and fully
 * transparent (opacity 0) ones are dropped. Returns a new Group, or null when
 * the model is not safely mergeable (skinned / instanced / multi-material /
 * morph targets) - the caller then keeps the original.
 */
export function mergeMeshesByMaterial(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();           // material -> BufferGeometry[]
  let ok = true;
  let sourceMeshes = 0;

  root.traverse(n => {
    if (!ok || !n.isMesh) return;
    if (n.isSkinnedMesh || n.isInstancedMesh || Array.isArray(n.material) ||
        (n.morphTargetInfluences && n.morphTargetInfluences.length)) { ok = false; return; }
    const mat = n.material;
    if (!mat || !n.geometry || !n.visible) return;
    if (mat.transparent && mat.opacity === 0) return;                  // invisible helper plane
    // A parent that is hidden hides this mesh too.
    for (let p = n.parent; p; p = p.parent) if (!p.visible) return;
    const g = n.geometry.clone();
    g.applyMatrix4(n.matrixWorld);
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(g);
    sourceMeshes++;
  });
  if (!ok || !buckets.size) return null;

  const out = new THREE.Group();
  out.name = root.name || "merged";
  for (const [mat, geos] of buckets) {
    const merged = mergeCompatible(geos);
    if (!merged) { out.traverse(o => o.geometry && o.geometry.dispose()); return null; }
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = mat.name || "merged";
    out.add(mesh);
  }
  out.userData.mergedFrom = sourceMeshes;
  return out;
}

/** mergeGeometries that first aligns attribute sets / indexing. Null on failure. */
function mergeCompatible(geos) {
  if (geos.length === 1) return geos[0];
  const common = new Set(Object.keys(geos[0].attributes));
  geos.forEach(g => { for (const k of common) if (!(k in g.attributes)) common.delete(k); });
  const anyIndexed = geos.some(g => g.index);
  const allIndexed = geos.every(g => g.index);
  const prepared = geos.map(g => {
    for (const k of Object.keys(g.attributes)) if (!common.has(k)) g.deleteAttribute(k);
    g.morphAttributes = {};
    return anyIndexed && !allIndexed ? g.toNonIndexed() : g;
  });
  try {
    const merged = mergeGeometries(prepared, false);
    prepared.forEach(g => g.dispose());
    return merged || null;
  } catch (_) {
    return null;
  }
}

/**
 * Merge already-positioned geometries into a single Mesh. Optionally bakes a
 * per-geometry colour into a `color` vertex attribute (so differently coloured
 * pieces can share ONE material with vertexColors:true).
 *   parts: [{ geo, color? (THREE.Color, linear), matrix? (THREE.Matrix4) }]
 */
export function mergeStatic(parts, material, name = "merged") {
  const geos = parts.map(({ geo, color, matrix }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) {
      if (k !== "position" && k !== "uv" && k !== "normal") g.deleteAttribute(k);
    }
    if (color) {
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
      g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    }
    return g;
  });
  const merged = mergeCompatible(geos);
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = name;
  return mesh;
}
