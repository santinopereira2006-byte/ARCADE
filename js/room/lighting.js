/**
 * ARCADE - lighting rig
 * All real-time lights live here so the count and cost stay auditable.
 * Shadows are intentionally disabled everywhere: the neon look is carried by
 * emissive materials + bloom, and shadow maps are the single biggest GPU cost
 * on a mid-range laptop.
 */

import * as THREE from "three";

/** Cheap global fill: hemisphere sky/ground + a touch of ambient + soft key. */
export function addBaseLights(scene) {
  scene.add(new THREE.HemisphereLight(0x4a6bff, 0x0a0a14, 0.5));
  scene.add(new THREE.AmbientLight(0xffffff, 0.14));
  const key = new THREE.DirectionalLight(0xbfd4ff, 0.22);
  key.position.set(6, 14, 8);
  key.castShadow = false;
  scene.add(key);
  return [key];
}

/** Four coloured corner pools so the room edges read as neon. */
export function addCornerGlow(scene, bounds) {
  const corners = [
    { x: -bounds.x, z: -bounds.z, color: 0xff2bd6 },
    { x: bounds.x, z: -bounds.z, color: 0x00e5ff },
    { x: -bounds.x, z: bounds.z, color: 0xa855f7 },
    { x: bounds.x, z: bounds.z, color: 0x39ff14 }
  ];
  return corners.map(cfg => {
    const light = new THREE.PointLight(cfg.color, 9, 22, 2);
    light.position.set(cfg.x * 0.92, 3.2, cfg.z * 0.92);
    light.castShadow = false;
    scene.add(light);
    return light;
  });
}

/** A handful of accent PointLights near cabinets (capped for perf). */
export function addNeonAccents(scene, cabinetSpots, colors, max = 4) {
  const lights = [];
  for (let i = 0; i < Math.min(max, cabinetSpots.length); i++) {
    const spot = cabinetSpots[i];
    const light = new THREE.PointLight(colors[i % colors.length], 5, 9, 2);
    light.position.set(spot.position.x * 0.82, 2.4, spot.position.z * 0.82);
    light.castShadow = false;
    scene.add(light);
    lights.push(light);
  }
  return lights;
}
