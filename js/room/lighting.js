/**
 * ARCADE - lighting rig
 * All real-time lights live here so the count and cost stay auditable.
 * Shadows are intentionally disabled everywhere: the neon look is carried by
 * emissive materials + bloom, and shadow maps are the single biggest GPU cost
 * on a mid-range laptop.
 */

import * as THREE from "three";

/** Cheap global fill: hemisphere sky/ground + soft ambient + directional key. Exactly 3 real lights! */
export function addBaseLights(scene) {
  const hemi = new THREE.HemisphereLight(0x4a6bff, 0x0a0a14, 0.45);
  scene.add(hemi);

  const amb = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(amb);

  const key = new THREE.DirectionalLight(0xbfd4ff, 0.35);
  key.position.set(6, 14, 8);
  key.castShadow = false;
  scene.add(key);

  return [hemi, amb, key];
}

/** Four coloured corner pools — disabled by default on Low quality to preserve fillrate. */
export function addCornerGlow(scene, bounds, enabled = false) {
  if (!enabled) return [];
  const corners = [
    { x: -bounds.x, z: -bounds.z, color: 0xff2bd6 },
    { x: bounds.x, z: -bounds.z, color: 0x00e5ff },
    { x: -bounds.x, z: bounds.z, color: 0xa855f7 },
    { x: bounds.x, z: bounds.z, color: 0x39ff14 }
  ];
  return corners.map(cfg => {
    const light = new THREE.PointLight(cfg.color, 4, 14, 2);
    light.position.set(cfg.x * 0.92, 3.2, cfg.z * 0.92);
    light.castShadow = false;
    scene.add(light);
    return light;
  });
}

/** Accent PointLights near cabinets — disabled on Low quality. */
export function addNeonAccents(scene, cabinetSpots, colors, max = 2, enabled = false) {
  if (!enabled) return [];
  const lights = [];
  for (let i = 0; i < Math.min(max, cabinetSpots.length); i++) {
    const spot = cabinetSpots[i];
    const light = new THREE.PointLight(colors[i % colors.length], 3.5, 7, 2);
    light.position.set(spot.position.x * 0.82, 2.4, spot.position.z * 0.82);
    light.castShadow = false;
    scene.add(light);
    lights.push(light);
  }
  return lights;
}
