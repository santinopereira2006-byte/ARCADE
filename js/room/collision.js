/**
 * ARCADE - collision world
 * Axis-aligned box colliders for every static obstacle plus an invisible
 * perimeter shell. The player is treated as a vertical capsule (radius in XZ,
 * a height range in Y) and is resolved per axis so it slides along surfaces
 * instead of sticking. Movement is sub-stepped so a sprint can never tunnel
 * through a thin wall.
 */

import * as THREE from "three";

// Largest distance the player may travel in one physics sub-step. Kept well
// below the thinnest collider (wall ~0.2m) so tunneling is impossible.
const MAX_STEP = 0.22;

export class CollisionWorld {
  constructor(scene) {
    this.scene = scene;
    this.entries = []; // { box: THREE.Box3, label: string }
    this.debugGroup = null;
    this._ray = new THREE.Ray();
    this._hit = new THREE.Vector3();
    this._dir = new THREE.Vector3();   // scratch: no per-frame allocation in the camera wall test
  }

  addBox(box, label = "box") {
    if (!box.isEmpty()) this.entries.push({ box, label });
    return box;
  }

  /** Auto-generate a collider from a mesh/group's world bounding box. */
  addFromObject(object3d, label = "mesh") {
    object3d.updateMatrixWorld(true);
    return this.addBox(new THREE.Box3().setFromObject(object3d), label);
  }

  /**
   * Sweep a room model and collider-ify everything that is genuinely solid:
   * skips the floor (flat), the ceiling (high) and any single mesh that spans
   * the entire room (the outer shell is replaced by the perimeter below).
   */
  addFromRoom(room, bounds) {
    const size = new THREE.Vector3();
    room.traverse(node => {
      if (!node.isMesh || !node.visible) return;
      const box = new THREE.Box3().setFromObject(node);
      if (box.isEmpty()) return;
      box.getSize(size);
      if (size.y < 0.3) return;                              // floor / rugs
      if (box.min.y > 2.6) return;                           // ceiling parts
      if (size.x > bounds.x * 1.5 && size.z > bounds.z * 1.5) return; // shell
      this.addBox(box, node.name || "room");
    });
  }

  /**
   * Make the room model's interior walls solid. The house ships as one mesh
   * (skipped by addFromRoom as the "shell"), so walk its triangles instead:
   * every near-vertical triangle at body height inside the hall is stamped
   * onto a coarse grid, and runs of solid cells are merged into boxes.
   * Outer walls are left to the perimeter colliders.
   */
  addRoomWalls(room, bounds, cell = 0.35, floorY = 0) {
    const hx = bounds.x + 0.6, hz = bounds.z + 0.6;      // just inside the hall's walls
    const nx = Math.ceil((hx * 2) / cell), nz = Math.ceil((hz * 2) / cell);
    const grid = new Uint8Array(nx * nz);
    const mark = (x, z) => {
      const i = Math.floor((x + hx) / cell), j = Math.floor((z + hz) / cell);
      if (i >= 0 && j >= 0 && i < nx && j < nz) grid[j * nx + i] = 1;
    };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
    const yLo = floorY + 0.25, yHi = floorY + 2.0;
    room.updateMatrixWorld(true);
    room.traverse(node => {
      if (!node.isMesh || !node.visible || !node.geometry) return;
      const pos = node.geometry.attributes.position;
      if (!pos) return;
      const idx = node.geometry.index;
      const count = idx ? idx.count : pos.count;
      const mw = node.matrixWorld;
      for (let t = 0; t < count; t += 3) {
        const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(mw);
        b.fromBufferAttribute(pos, ib).applyMatrix4(mw);
        c.fromBufferAttribute(pos, ic).applyMatrix4(mw);
        if (Math.max(a.y, b.y, c.y) < yLo || Math.min(a.y, b.y, c.y) > yHi) continue;
        n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
        const len = n.length();
        if (len < 1e-9 || Math.abs(n.y / len) > 0.5) continue;   // floors, ceilings, table tops
        // Stamp the triangle's footprint (a line for a vertical face) onto the grid.
        [[a, b], [b, c], [c, a]].forEach(([p, q]) => {
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          const steps = Math.max(1, Math.ceil(d / (cell * 0.5)));
          for (let k = 0; k <= steps; k++) {
            const u = k / steps;
            mark(p.x + (q.x - p.x) * u, p.z + (q.z - p.z) * u);
          }
        });
      }
    });
    // Merge horizontal runs of solid cells into boxes.
    let added = 0;
    for (let j = 0; j < nz; j++) {
      let i = 0;
      while (i < nx) {
        if (!grid[j * nx + i]) { i++; continue; }
        const start = i;
        while (i < nx && grid[j * nx + i]) i++;
        const x0 = -hx + start * cell, x1 = -hx + i * cell;
        const z0 = -hz + j * cell, z1 = z0 + cell;
        // Skip strips hugging the outer walls; the perimeter already covers them.
        if (Math.min(x1, hx - 0.001) <= -bounds.x - 0.2 || x0 >= bounds.x + 0.2) continue;
        if (z1 <= -bounds.z - 0.2 || z0 >= bounds.z + 0.2) continue;
        this.addBox(new THREE.Box3(new THREE.Vector3(x0, floorY, z0), new THREE.Vector3(x1, floorY + 3, z1)), "room-wall");
        added++;
      }
    }
    return added;
  }

  /** Invisible thick boundary walls so the player can never leave the floor. */
  addPerimeter(bounds, height = 5, thickness = 0.8) {
    const x = bounds.x + thickness / 2;
    const z = bounds.z + thickness / 2;
    const half = thickness / 2;
    const y = height / 2;
    this.addBox(new THREE.Box3(new THREE.Vector3(-x - half, 0, -z - half), new THREE.Vector3(-x + half, height, z + half)), "wall-W");
    this.addBox(new THREE.Box3(new THREE.Vector3(x - half, 0, -z - half), new THREE.Vector3(x + half, height, z + half)), "wall-E");
    this.addBox(new THREE.Box3(new THREE.Vector3(-x - half, 0, -z - half), new THREE.Vector3(x + half, height, -z + half)), "wall-N");
    this.addBox(new THREE.Box3(new THREE.Vector3(-x - half, 0, z - half), new THREE.Vector3(x + half, height, z + half)), "wall-S");
  }

  /**
   * Push `pos` (feet centre) out of any collider whose vertical range overlaps
   * [bottomY, topY], treating the player as a circle of `radius` in XZ.
   * Resolves along the axis of least penetration for a smooth slide.
   */
  resolve(pos, radius, bottomY, topY) {
    for (let i = 0; i < this.entries.length; i++) {
      const box = this.entries[i].box;
      if (box.max.y <= bottomY + 0.05 || box.min.y >= topY) continue;
      const minX = box.min.x - radius;
      const maxX = box.max.x + radius;
      const minZ = box.min.z - radius;
      const maxZ = box.max.z + radius;
      if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue;
      // Penetration depth on each side; escape through the shallowest.
      const dxMin = pos.x - minX;
      const dxMax = maxX - pos.x;
      const dzMin = pos.z - minZ;
      const dzMax = maxZ - pos.z;
      const m = Math.min(dxMin, dxMax, dzMin, dzMax);
      if (m === dxMin) pos.x = minX;
      else if (m === dxMax) pos.x = maxX;
      else if (m === dzMin) pos.z = minZ;
      else pos.z = maxZ;
    }
    return pos;
  }

  /**
   * Integrate a movement delta with per-axis resolution and sub-stepping.
   * X is applied and resolved, then Z is applied and resolved, which is what
   * lets the capsule glide along a wall it is pressed against.
   */
  move(pos, delta, radius, bottomY, topY) {
    const distance = Math.hypot(delta.x, delta.z);
    const steps = Math.max(1, Math.min(8, Math.ceil(distance / MAX_STEP)));
    const sx = delta.x / steps;
    const sz = delta.z / steps;
    for (let s = 0; s < steps; s++) {
      pos.x += sx;
      this.resolve(pos, radius, bottomY, topY);
      pos.z += sz;
      this.resolve(pos, radius, bottomY, topY);
    }
    return pos;
  }

  /**
   * Distance from `origin` toward `target` before a collider gets in the way.
   * Used to pull the third-person camera in front of walls.
   */
  distanceToWall(origin, target, margin = 0.35) {
    const dir = this._dir.copy(target).sub(origin);
    const full = dir.length();
    if (full < 1e-4) return 0;
    dir.divideScalar(full);
    this._ray.set(origin, dir);
    let best = full;
    for (let i = 0; i < this.entries.length; i++) {
      const box = this.entries[i].box;
      if (this._ray.intersectBox(box, this._hit)) {
        const d = this._hit.distanceTo(origin);
        if (d < best) best = d;
      }
    }
    return Math.max(0.6, best - margin);
  }

  /** Wireframe overlay of every collider, toggled with F3. */
  buildDebug() {
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = "collider-debug";
    const mat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.85 });
    this.entries.forEach(entry => {
      const b = entry.box;
      const size = b.getSize(new THREE.Vector3());
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
      const line = new THREE.LineSegments(geo, mat);
      b.getCenter(line.position);
      this.debugGroup.add(line);
    });
    this.debugGroup.visible = false;
    this.scene.add(this.debugGroup);
    return this.debugGroup;
  }

  toggleDebug() {
    if (!this.debugGroup) this.buildDebug();
    this.debugGroup.visible = !this.debugGroup.visible;
    return this.debugGroup.visible;
  }

  dispose() {
    if (this.debugGroup) {
      this.debugGroup.traverse(n => { if (n.geometry) n.geometry.dispose(); });
      this.scene.remove(this.debugGroup);
      this.debugGroup = null;
    }
    this.entries.length = 0;
  }
}
