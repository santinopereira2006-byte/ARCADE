/**
 * ARCADE - "Arcade Arena" set dressing for the 3D lobby
 *
 * Rebuilds the neon arena from the reference video inside the blank room:
 *   - raised, animated neon dance floor in the middle (walkable)
 *   - disco ball with beams + light specks above it
 *   - giant pink headphone neon sign, PLAY neon sign on the back wall
 *   - hanging INSERT COIN / ARCADE ARENA signs and a HI-SCORE LEADERBOARD board
 *   - tall cyan pillars, pink/cyan ceiling neon strips
 *   - christmas-light strands draped across the hall between pillar tops
 *   - neon court markings (rings, arcs, lines) painted on the floor
 *   - character statues (Mario, Pikachu, Hulk, Megatron, Optimus, Master Chief)
 *     on glowing ring pedestals
 *   - floating coloured glow orbs
 *
 * Every model is optional: each entry lists candidate files (relative to
 * index.html); if none load, a neon stand-in is built so the room is always
 * complete. Positions are laid out for a reference hall of 12.8 x 9.5 m
 * half-extents and scaled to the real hall.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const DECOR_MODELS = {
  danceFloor: ["models/animated-dance-floor-neon-lights/source/dancefloor.glb", "models/animated-dance-floor-neon-lights/scene.gltf"],
  discoBall: ["models/disco-ball-with-colored-lights/source/disco-ball.glb", "models/disco-ball-with-colored-lights/scene.gltf"],
  headphoneSign: ["models/headphone-neon-sign-headset/source/light head phone.glb", "models/headphone-neon-sign-headset/scene.gltf"],
  playNeon: ["models/play_neon/scene.gltf", "models/play_neon/source/play_neon.glb"]
};

// Statues on glowing pedestals. `pos` is in reference-hall coordinates.
export const STATUES = [
  { id: "mario", files: ["models/mario-mini/source/mario.glb", "models/mario-mini/source/Mario mini.glb"], height: 1.35, ring: 0xff2050, pos: [8.2, 6.6] },
  { id: "pikachu", files: ["models/pikachu/source/pikachu2.glb"], height: 0.95, ring: 0xffe600, pos: [-6.4, 6.4], clip: /idle/i },
  { id: "hulk", files: ["models/hulk/scene.gltf"], height: 2.3, ring: 0x39ff14, pos: [-10.4, 1.6], clip: /@idle/i },
  { id: "megatron", files: ["models/megatron/scene.gltf"], height: 2.9, ring: 0xa855f7, pos: [-9.2, -6.8] },
  { id: "optimus", files: ["models/optimus_prime/scene.gltf"], height: 2.7, ring: 0x00e5ff, pos: [9.2, -6.8] },
  { id: "masterchief", files: ["models/masterchief/scene.gltf", "models/masterchief-walk/scene.gltf"], height: 2.15, ring: 0x2dd4bf, pos: [10.4, 1.6], clip: /walk/i, freeze: true }
];

const REF = { x: 12.8, z: 9.5 };
const NEON = [0xff2bd6, 0x00e5ff, 0xa855f7, 0x39ff14, 0xffe600, 0xff6a00];
const FLOOR_SIZE = 9;       // dance floor edge length (m)
const FLOOR_TOP = 0.3;      // dance floor surface height above the room floor
const PILLAR_H = 6.2;
const STRIP_Y = 5.6;

// ---------------------------------------------------------------- helpers

function fitModel(root, { span, by = "max", anchor = "bottom" }) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const ref =
    by === "xz" ? Math.max(size.x, size.z) :
    by === "x" ? size.x :
    by === "y" ? size.y :
    Math.max(size.x, size.y, size.z);
  root.scale.multiplyScalar(span / (ref || 1));
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  const c = b2.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= anchor === "center" ? c.y : anchor === "top" ? b2.max.y : b2.min.y;
  const wrap = new THREE.Group();
  wrap.add(root);
  return wrap;
}

function boostEmissive(root, min = 1.6) {
  root.traverse(node => {
    if (!node.isMesh || !node.material) return;
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => {
      const glow = m.emissiveMap || (m.emissive && m.emissive.getHex() !== 0);
      if (glow && "emissiveIntensity" in m) m.emissiveIntensity = Math.max(m.emissiveIntensity || 1, min);
    });
  });
}

function doubleSided(root) {
  root.traverse(n => {
    if (!n.isMesh || !n.material) return;
    (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { m.side = THREE.DoubleSide; });
  });
}

function glowMat(color, strength = 1) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), toneMapped: false });
}

function additive(color, opacity, map = null) {
  return new THREE.MeshBasicMaterial({
    color, map, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
  });
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const hex = c => "#" + new THREE.Color(c).getHexString();

// ---------------------------------------------------------------- arena

export class RoomDecor {
  /**
   * @param {THREE.Scene} scene
   * @param {{x:number,z:number}} bounds walkable half-extents (hall centred on origin)
   * @param {{envMap?:THREE.Texture, floorY?:number, walls?:object, leaderboard?:Array}} opts
   */
  constructor(scene, bounds, opts = {}) {
    this.scene = scene;
    this.bounds = bounds;
    this.envMap = opts.envMap || null;
    this.floorY = opts.floorY || 0;
    this.walls = opts.walls || { xMin: -bounds.x - 1.6, xMax: bounds.x + 1.6, zMin: -bounds.z - 1.6, zMax: bounds.z + 1.6 };
    this.leaderboard = opts.leaderboard || [];
    this.group = new THREE.Group();
    this.group.name = "arcade-arena";
    this.group.position.y = this.floorY;
    scene.add(this.group);
    this.mixers = [];
    this.lights = [];
    this.pulses = [];
    this.solidBoxes = [];
    this.sources = {};
    this.loader = new GLTFLoader();
    this.glowTex = glowTexture();
    this._c = new THREE.Color();
    this.sx = bounds.x / REF.x;
    this.sz = bounds.z / REF.z;
  }

  /** Reference-hall XZ -> real hall XZ, clamped inside the walkable area. */
  at(x, z) {
    return [
      THREE.MathUtils.clamp(x * this.sx, -this.bounds.x + 0.8, this.bounds.x - 0.8),
      THREE.MathUtils.clamp(z * this.sz, -this.bounds.z + 0.8, this.bounds.z - 0.8)
    ];
  }

  addSolid(x, z, halfW, halfD, height) {
    const y = this.floorY;
    this.solidBoxes.push(new THREE.Box3(
      new THREE.Vector3(x - halfW, y, z - halfD),
      new THREE.Vector3(x + halfW, y + height, z + halfD)
    ));
  }

  // -------------------------------------------------------------- loading

  async load(onNote) {
    // Signs are drawn to canvases once, so wait (briefly) for the game font.
    try {
      await Promise.race([
        Promise.all(["bold 64px Orbitron", "bold 40px 'Share Tech Mono'"].map(f => document.fonts.load(f))),
        new Promise(r => setTimeout(r, 1500))
      ]);
    } catch (_) { /* fall back to monospace */ }
    const [floor, ball, phones, play] = await Promise.all([
      this.tryModel("danceFloor", DECOR_MODELS.danceFloor),
      this.tryModel("discoBall", DECOR_MODELS.discoBall),
      this.tryModel("headphoneSign", DECOR_MODELS.headphoneSign),
      this.tryModel("playNeon", DECOR_MODELS.playNeon)
    ]);
    onNote && onNote("Wiring up the neon…");

    this.buildDanceFloor(floor);
    this.buildDiscoBall(ball);
    this.buildHeadphoneSign(phones);
    this.buildPlaySign(play);
    this.buildPillars();
    this.buildCeilingStrips();
    this.buildHangingSigns();
    this.buildLeaderboard();
    this.buildStringLights();
    this.buildFloorMarkings();
    this.buildOrbs();
    this.buildPedestals();

    console.info("[arena] " + Object.entries(this.sources).map(([k, v]) => k + ":" + v).join(" "));
    return this.sources;
  }

  async tryModel(key, files) {
    for (const file of files) {
      const url = file.split("/").map(encodeURIComponent).join("/");
      try {
        const gltf = await this.loader.loadAsync(url);
        this.sources[key] = "model";
        return gltf;
      } catch (_) { /* next candidate */ }
    }
    this.sources[key] = "built-in";
    return null;
  }

  playClips(root, clips, match, freeze = false) {
    if (!clips || !clips.length) return;
    const mixer = new THREE.AnimationMixer(root);
    const chosen = match ? clips.filter(c => match.test(c.name)).slice(0, 1) : clips;
    (chosen.length ? chosen : clips.slice(0, 1)).forEach(c => mixer.clipAction(c).play());
    mixer.update(freeze ? 0.35 : 0);
    if (!freeze) this.mixers.push(mixer);
  }

  // -------------------------------------------------------------- dance floor

  buildDanceFloor(gltf) {
    const size = FLOOR_SIZE;
    const holder = new THREE.Group();
    holder.name = "dance-floor";
    if (gltf) {
      // The model's surface is its top face; sink it so the top sits at FLOOR_TOP.
      const wrap = fitModel(gltf.scene, { span: size, by: "xz", anchor: "top" });
      wrap.position.y = FLOOR_TOP;
      // Tame the model's emissive so it glows without flooding the room with bloom.
      gltf.scene.traverse(n => {
        if (!n.isMesh || !n.material) return;
        [].concat(n.material).forEach(m => { if ("emissiveIntensity" in m) m.emissiveIntensity = 1.3; });
      });
      holder.add(wrap);
      this.playClips(gltf.scene, gltf.animations);
    } else {
      this.buildTileFloor(holder, size);
    }
    // Plinth sides + neon lip so the platform reads as raised.
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.1, FLOOR_TOP - 0.02, size + 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0b0d18, roughness: 0.4, metalness: 0.6 })
    );
    plinth.position.y = (FLOOR_TOP - 0.02) / 2;
    holder.add(plinth);
    const lipMat = glowMat(0xffffff, 0.9);
    const h = size / 2 + 0.06;
    [[0, h, size + 0.24, 0.08], [0, -h, size + 0.24, 0.08], [h, 0, 0.08, size + 0.24], [-h, 0, 0.08, size + 0.24]].forEach(([x, z, w, d]) => {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), lipMat);
      lip.position.set(x, FLOOR_TOP - 0.03, z);
      holder.add(lip);
    });
    this.floorLip = lipMat;
    // Soft glow pool spilling onto the room floor around the platform.
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(size + 4, size + 4), additive(0xffffff, 0.05, this.glowTex));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.012;
    holder.add(pool);
    // Two lights so nearby cabinets and statues pick up the floor colours.
    [[-2, 0xff2bd6], [2, 0x00e5ff]].forEach(([x, c]) => {
      const l = new THREE.PointLight(c, 8, 12, 2);
      l.position.set(x, 1.2, 0);
      holder.add(l);
      this.lights.push(l);
    });
    this.floorLights = this.lights.slice(-2);
    this.group.add(holder);
  }

  buildTileFloor(holder, size) {
    const N = 10;
    const tile = size / N;
    const tiles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(tile * 0.92, 0.04, tile * 0.92),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      N * N
    );
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        m4.makeTranslation((i - (N - 1) / 2) * tile, FLOOR_TOP - 0.01, (j - (N - 1) / 2) * tile);
        tiles.setMatrixAt(i * N + j, m4);
        tiles.setColorAt(i * N + j, this._c.setHex(0x222222));
      }
    }
    holder.add(tiles);
    this.tiles = { mesh: tiles, N, t: 0, mode: 0, modeT: 0 };
  }

  updateTiles(dt, t) {
    const T = this.tiles;
    if (!T) return;
    T.t += dt; T.modeT += dt;
    if (T.modeT > 6) { T.modeT = 0; T.mode = (T.mode + 1) % 3; }
    if (T.t < 1 / 10) return;
    T.t = 0;
    const { N } = T;
    const beat = Math.floor(t * 2);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        let idx;
        if (T.mode === 0) idx = (i + j + beat) % NEON.length;
        else if (T.mode === 1) idx = Math.floor(Math.hypot(i - N / 2, j - N / 2) - t * 4) & 0xff;
        else idx = Math.random() < 0.5 ? Math.floor(Math.random() * NEON.length) : -1;
        this._c.setHex(idx < 0 ? 0xdddddd : NEON[idx % NEON.length]).lerp(new THREE.Color(0xffffff), 0.35);
        T.mesh.setColorAt(i * N + j, this._c);
      }
    }
    T.mesh.instanceColor.needsUpdate = true;
  }

  /** Walkable height (world Y) at a point: the dance-floor top or the room floor. */
  groundHeightAt(x, z) {
    const h = FLOOR_SIZE / 2 + 0.05;
    return (Math.abs(x) <= h && Math.abs(z) <= h) ? this.floorY + FLOOR_TOP : this.floorY;
  }

  /** Neon colour underfoot for the chameleon's camo, or null off the floor. */
  colorAt(x, z) {
    const h = FLOOR_SIZE / 2;
    if (Math.abs(x) > h || Math.abs(z) > h) return null;
    const i = Math.floor((x + h) / 1.5), j = Math.floor((z + h) / 1.5);
    return this._c.setHex(NEON[(i + j + Math.floor(performance.now() / 500)) % NEON.length]);
  }

  // -------------------------------------------------------------- disco ball

  buildDiscoBall(gltf) {
    const hangY = 4.7;
    const rig = new THREE.Group();
    rig.name = "disco-ball";
    rig.position.set(0, hangY, 0);
    let ball;
    if (gltf) {
      ball = fitModel(gltf.scene, { span: 1.9, by: "y", anchor: "center" });
      boostEmissive(gltf.scene, 2);
      this.playClips(gltf.scene, gltf.animations);
      this.ballSpins = !gltf.animations.length;
    } else {
      ball = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.55, 3),
        new THREE.MeshStandardMaterial({ color: 0xd8dcff, metalness: 1, roughness: 0.12, flatShading: true, envMap: this.envMap, envMapIntensity: 1.2 })
      );
      this.ballSpins = true;
    }
    rig.add(ball);
    this.ball = ball;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x777788, metalness: 0.9, roughness: 0.3 }));
    chain.position.y = 1.7;
    rig.add(chain);

    const beams = new THREE.Group();
    const len = hangY - FLOOR_TOP;
    const geo = new THREE.ConeGeometry(0.3, len, 12, 1, true);
    geo.translate(0, -len / 2, 0);
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 6) * Math.PI * 2;
      const beam = new THREE.Mesh(geo, additive(NEON[i], 0.03));
      beam.rotation.z = 0.35 + (i % 2) * 0.2;
      pivot.add(beam);
      beams.add(pivot);
    }
    rig.add(beams);
    this.beams = beams;

    const specks = new THREE.Group();
    const sg = new THREE.PlaneGeometry(0.3, 0.3);
    for (let i = 0; i < 60; i++) {
      const s = new THREE.Mesh(sg, additive(NEON[i % NEON.length], 0.75, this.glowTex));
      const a = Math.random() * Math.PI * 2;
      const r = FLOOR_SIZE / 2 + 0.5 + Math.random() * Math.min(this.bounds.x, this.bounds.z) * 0.6;
      s.position.set(Math.cos(a) * r, 0.02 - hangY, Math.sin(a) * r);
      s.rotation.x = -Math.PI / 2;
      s.scale.setScalar(0.6 + Math.random());
      specks.add(s);
    }
    rig.add(specks);
    this.specks = specks;

    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(NEON[i * 2], 7, 14, 2);
      rig.add(l);
      this.lights.push(l);
    }
    this.discoLights = this.lights.slice(-2);
    this.group.add(rig);
    this.discoRig = rig;
  }

  updateDisco(dt, t) {
    if (!this.discoRig) return;
    if (this.ballSpins) this.ball.rotation.y += dt * 0.6;
    this.beams.rotation.y -= dt * 0.8;
    this.specks.rotation.y += dt * 0.3;
    this.discoLights.forEach((l, i) => {
      const a = t * 0.8 + i * Math.PI;
      l.position.set(Math.cos(a) * 4, -2.4, Math.sin(a) * 4);
      l.color.setHex(NEON[(Math.floor(t * 0.7) + i * 3) % NEON.length]);
    });
    const pulse = 0.015 + 0.02 * Math.max(0, Math.sin(t * 4.4));
    this.beams.children.forEach(p => { p.children[0].material.opacity = pulse; });
  }

  // -------------------------------------------------------------- neon signs

  buildHeadphoneSign(gltf) {
    const H = 3.8;
    let sign;
    if (gltf) {
      sign = fitModel(gltf.scene, { span: H, by: "y" });
      boostEmissive(gltf.scene, 3);
      doubleSided(gltf.scene);
    } else {
      sign = this.buildHeadphoneNeon(H);
    }
    const [x, z] = this.at(5.8, 5.4);
    const holder = new THREE.Group();
    holder.add(sign);
    holder.position.set(x, 0, z);
    holder.rotation.y = Math.atan2(-x * 0.6, (this.bounds.z) - z); // face the front / spawn area
    this.group.add(holder);
    const light = new THREE.PointLight(0xff2b6a, 9, 9, 2);
    light.position.set(0, H * 0.55, 0.8);
    holder.add(light);
    this.lights.push(light);
    this.addSolid(x, z, 1.1, 1.1, H);
  }

  buildHeadphoneNeon(H) {
    const g = new THREE.Group();
    const pink = glowMat(0xff2b6a, 1.4);
    const s = H / 2.2;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.8 * s, 0.05 * s, 10, 48, Math.PI), pink);
    band.position.y = 1.35 * s;
    g.add(band);
    [-1, 1].forEach(side => {
      const cup = new THREE.Mesh(new THREE.TorusGeometry(0.28 * s, 0.05 * s, 10, 32), pink);
      cup.scale.set(0.75, 1.3, 1);
      cup.position.set(side * 0.8 * s, 1.0 * s, 0);
      g.add(cup);
    });
    return g;
  }

  buildPlaySign(gltf) {
    let sign;
    if (gltf) {
      sign = fitModel(gltf.scene, { span: 3.2, by: "x", anchor: "center" });
      boostEmissive(gltf.scene, 2.4);
      doubleSided(gltf.scene);
    } else {
      sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ map: this.makeTextTexture("▶ PLAY", 0x39ff14, 512, 205), transparent: true, toneMapped: false }));
    }
    sign.position.set(0, 3.4, this.walls.zMin + 0.15);
    this.group.add(sign);
  }

  makeTextTexture(text, color, w = 512, h = 128, font = "bold 96px 'Orbitron', monospace") {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = hex(color);
    ctx.shadowBlur = 24;
    ctx.fillStyle = hex(color);
    ctx.fillText(text, w / 2, h / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.55;
    ctx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Neon-framed board: dark glass panel, glowing border and glowing text. */
  makeBoardTexture(lines, color, w, h, { title = null } = {}) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const col = hex(color);
    ctx.fillStyle = "rgba(8,10,20,0.82)";
    ctx.beginPath();
    ctx.roundRect(10, 10, w - 20, h - 20, 22);
    ctx.fill();
    ctx.shadowColor = col;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = col;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.textBaseline = "middle";
    let y = 0;
    if (title) {
      ctx.textAlign = "center";
      ctx.fillStyle = col;
      ctx.font = `bold ${Math.round(h * 0.13)}px 'Orbitron', monospace`;
      ctx.fillText(title, w / 2, h * 0.14);
      y = h * 0.3;
    }
    lines.forEach((ln, i) => {
      ctx.shadowColor = ln.color ? hex(ln.color) : col;
      ctx.fillStyle = ln.color ? hex(ln.color) : "#f2f4ff";
      ctx.font = ln.font;
      ctx.textAlign = ln.align || "center";
      ctx.fillText(ln.text, ln.x ?? w / 2, ln.y ?? (y + i * ln.step));
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  makeHangingSign(text, color, w, h) {
    const g = new THREE.Group();
    const tex = this.makeBoardTexture([{ text, font: "bold 120px 'Orbitron', monospace", y: 128 }], color, 1024, 256);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false, color: 0xdddddd }));
    g.add(board);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.7, roughness: 0.4 });
    [-w * 0.38, w * 0.38].forEach(x => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 6), rodMat);
      rod.position.set(x, h / 2 + 1.1, 0);
      g.add(rod);
    });
    return g;
  }

  buildHangingSigns() {
    const insert = this.makeHangingSign("INSERT COIN", 0x9dff5a, 4.6, 1.15);
    insert.position.set(-1.2, 4.1, -2.6);
    insert.rotation.set(-0.12, 0.1, 0);
    this.group.add(insert);

    const arena = this.makeHangingSign("ARCADE ARENA", 0x8ff0ff, 4.8, 1.2);
    arena.position.set(4.0, 4.5, -0.6);
    arena.rotation.set(-0.1, -0.45, 0);
    this.group.add(arena);
  }

  buildLeaderboard() {
    const fallback = [
      { name: "TEAM NOVA", score: 640, tier: "S" },
      { name: "CYBER PHANTOM", score: 615, tier: "S" },
      { name: "GADGET SQUAD", score: 580, tier: "A" },
      { name: "BYTE RUNNERS", score: 540, tier: "A" },
      { name: "NEON CHAMELEON", score: 510, tier: "B" }
    ];
    const rows = (this.leaderboard.length ? this.leaderboard : fallback).slice(0, 5);
    const W = 1024, Hh = 560;
    const rowColors = [0x5ff3ff, 0x8dff5a, 0xf2f4ff, 0xf2f4ff, 0xf2f4ff];
    const lines = [];
    rows.forEach((r, i) => {
      const y = Hh * 0.32 + i * 70;
      const font = "bold 40px 'Share Tech Mono', 'Consolas', monospace";
      const name = String(r.name || "").toUpperCase().slice(0, 18);
      lines.push({ text: `${i + 1}. ${name}`, font, align: "left", x: 90, y, color: rowColors[i] });
      lines.push({ text: `${r.score} PTS`, font, align: "left", x: 600, y, color: rowColors[i] });
      lines.push({ text: `[${r.tier || "-"}-TIER]`, font, align: "left", x: 780, y, color: rowColors[i] });
    });
    const tex = this.makeBoardTexture(lines, 0xffe600, W, Hh, { title: "HI-SCORE LEADERBOARD" });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false, color: 0xe6e6e6 }));
    const [x, z] = this.at(-8.4, 4.2);
    board.position.set(x, 3.7, z);
    board.rotation.y = Math.atan2(-x, this.bounds.z - z) * 0.9;
    this.group.add(board);
    this.leaderboardMesh = board;
  }

  // -------------------------------------------------------------- structure

  pillarSpots() {
    return [[-3.4, 8.6], [3.4, 8.6], [-8.8, 8.6], [8.8, 8.6], [-12.3, -0.9], [12.3, -0.9], [-3.6, -9.1], [3.6, -9.1]]
      .map(([x, z]) => this.at(x, z));
  }

  buildPillars() {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x36d6cf).multiplyScalar(0.85), toneMapped: false });
    const geo = new THREE.BoxGeometry(0.42, PILLAR_H, 0.42);
    this.pillarTops = [];
    this.pillarSpots().forEach(([x, z]) => {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, PILLAR_H / 2, z);
      this.group.add(p);
      this.addSolid(x, z, 0.26, 0.26, PILLAR_H);
      this.pillarTops.push(new THREE.Vector3(x, PILLAR_H - 0.4, z));
    });
  }

  buildCeilingStrips() {
    const W = this.walls;
    const x0 = W.xMin + 1.2, x1 = W.xMax - 1.2, z0 = W.zMin + 1.2, z1 = W.zMax - 1.2;
    const pink = glowMat(0xff2bd6, 1.3), cyan = glowMat(0x5ff3ff, 1.2);
    const strip = (a, b, mat) => {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, len), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.lookAt(b);
      this.group.add(m);
    };
    const V = (x, z, dy = 0) => new THREE.Vector3(x, STRIP_Y + dy, z);
    // Outer frame
    strip(V(x0, z0), V(x1, z0), pink);
    strip(V(x0, z1), V(x1, z1), pink);
    strip(V(x0, z0), V(x0, z1), cyan);
    strip(V(x1, z0), V(x1, z1), cyan);
    // Inner parallel runs (the long pink/cyan lines seen overhead)
    strip(V(x0, z0 + 1.2, -0.25), V(x1, z0 + 1.2, -0.25), cyan);
    strip(V(x0 + 2, (z0 + z1) / 2, 0.2), V(x1 - 2, (z0 + z1) / 2, 0.2), pink);
    strip(V(x0, z1 - 1.2, -0.25), V(x1, z1 - 1.2, -0.25), cyan);
  }

  // -------------------------------------------------------------- string lights

  buildStringLights() {
    const P = this.pillarTops;
    if (!P || P.length < 8) return;
    // Pillar index pairs: side runs + long diagonals over the open floor.
    // (none cross the room's partition walls)
    const pairs = [[2, 4], [5, 3], [0, 4], [1, 5], [0, 2], [1, 3], [6, 7]];
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x1a2a22, roughness: 0.8 });
    const bulbPos = [];
    pairs.forEach(([a, b]) => {
      const A = P[a], B = P[b];
      const len = A.distanceTo(B);
      const sag = Math.min(2.2, 0.8 + len * 0.1);
      const pts = [];
      const n = 32;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const p = A.clone().lerp(B, u);
        p.y -= Math.sin(u * Math.PI) * sag;
        pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      this.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.018, 5), wireMat));
      const count = Math.floor(len / 0.7);
      for (let k = 1; k < count; k++) bulbPos.push(curve.getPoint(k / count).add(new THREE.Vector3(0, -0.07, 0)));
    });
    const COLORS = [0xff2030, 0x20ff60, 0x3a7bff, 0xffffff, 0xffd020, 0xff40d0];
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), bulbPos.length);
    const m4 = new THREE.Matrix4();
    const halo = new Float32Array(bulbPos.length * 3);
    const haloCol = new Float32Array(bulbPos.length * 3);
    const base = [];
    bulbPos.forEach((p, i) => {
      m4.makeTranslation(p.x, p.y, p.z);
      bulbs.setMatrixAt(i, m4);
      const c = COLORS[i % COLORS.length];
      base.push(c);
      bulbs.setColorAt(i, this._c.setHex(c).multiplyScalar(1.4));
      halo.set([p.x, p.y, p.z], i * 3);
      this._c.setHex(c);
      haloCol.set([this._c.r, this._c.g, this._c.b], i * 3);
    });
    this.group.add(bulbs);
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.BufferAttribute(halo, 3));
    hg.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
    const halos = new THREE.Points(hg, new THREE.PointsMaterial({
      size: 0.9, map: this.glowTex, vertexColors: true, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    }));
    this.group.add(halos);
    this.strings = { bulbs, halos, base, phase: bulbPos.map(() => Math.random() * 6.28), t: 0 };
  }

  updateStrings(dt, t) {
    const S = this.strings;
    if (!S) return;
    S.t += dt;
    if (S.t < 1 / 12) return;
    S.t = 0;
    const col = S.halos.geometry.attributes.color;
    for (let i = 0; i < S.base.length; i++) {
      const k = 0.45 + 0.55 * Math.max(0, Math.sin(t * 2 + S.phase[i]));
      this._c.setHex(S.base[i]).multiplyScalar(k);
      col.setXYZ(i, this._c.r, this._c.g, this._c.b);
      S.bulbs.setColorAt(i, this._c.multiplyScalar(1.6));
    }
    col.needsUpdate = true;
    S.bulbs.instanceColor.needsUpdate = true;
  }

  // -------------------------------------------------------------- floor art

  buildFloorMarkings() {
    const g = new THREE.Group();
    g.name = "floor-markings";
    const y = 0.015;
    const ring = (x, z, r, color, arc = Math.PI * 2, rot = 0, w = 0.22) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 72, 1, rot, arc), glowMat(color, 0.75));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      g.add(m);
    };
    const line = (x0, z0, x1, z1, color, w = 0.12) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), glowMat(color, 0.7));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
      m.position.set((x0 + x1) / 2, y + 0.001, (z0 + z1) / 2);
      g.add(m);
    };
    const h = FLOOR_SIZE / 2;
    const P = (x, z) => this.at(x, z);
    // Centre court arc in front of the dance floor
    ring(0, h, 2.8, 0xff2bd6, Math.PI, Math.PI, 0.2);
    // Big rings in the side bays
    ring(...P(-8.8, 3.4), 2.1, 0x2dd4bf);
    ring(...P(8.6, 3.2), 2.1, 0xa855f7);
    ring(...P(-3.2, 8.3), 1.5, 0xffe600, Math.PI * 1.2, 0.3);
    ring(...P(6.0, -3.2), 1.3, 0xff2bd6, Math.PI, -0.5);
    // Lines tying the court together
    const [ax, az] = P(-8.8, 3.4), [bx, bz] = P(8.6, 3.2);
    line(-h - 0.3, h + 0.3, ...P(-11.5, 9), 0xf2f4ff);
    line(h + 0.3, h + 0.3, ...P(11.5, 9), 0xf2f4ff);
    line(ax + 2.1, az, -h - 0.3, 1.2, 0x2dd4bf);
    line(bx - 2.1, bz, h + 0.3, 1.2, 0xa855f7);
    line(-h - 0.3, h + 0.3, h + 0.3, h + 0.3, 0xffe600, 0.1);
    this.group.add(g);
  }

  buildOrbs() {
    const n = 44;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    this.orbSeeds = [];
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 2 - 1) * this.bounds.x;
      const z = (Math.random() * 2 - 1) * this.bounds.z;
      const y = 0.4 + Math.random() * 2.8;
      pos.set([x, y, z], i * 3);
      this._c.setHex(NEON[i % 4 === 3 ? 3 : [0, 1, 2][i % 3]]);
      col.set([this._c.r, this._c.g, this._c.b], i * 3);
      this.orbSeeds.push({ y, p: Math.random() * 6.28, s: 0.3 + Math.random() * 0.5 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.orbs = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.75, map: this.glowTex, vertexColors: true, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    }));
    this.group.add(this.orbs);
  }

  updateOrbs(t) {
    if (!this.orbs) return;
    const a = this.orbs.geometry.attributes.position;
    this.orbSeeds.forEach((s, i) => a.setY(i, s.y + Math.sin(t * s.s + s.p) * 0.35));
    a.needsUpdate = true;
  }

  // -------------------------------------------------------------- statues

  buildPedestals() {
    this.statueSpots = STATUES.map(cfg => {
      const [x, z] = this.at(...cfg.pos);
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const mat = glowMat(cfg.ring, 1.2);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.045, 10, 64), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.85, 48), additive(cfg.ring, 0.14));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.02;
      g.add(disc);
      this.group.add(g);
      this.addSolid(x, z, 0.6, 0.6, 2.4);
      this.pulses.push({ mat, base: new THREE.Color(cfg.ring).multiplyScalar(1.2), phase: Math.random() * 6 });
      return { cfg, holder: g };
    });
  }

  /** Statues load in the background (Master Chief alone is ~68 MB). */
  async loadStatues() {
    await Promise.all(this.statueSpots.map(async ({ cfg, holder }) => {
      const gltf = await this.tryModel(cfg.id, cfg.files);
      if (!gltf) return;
      const model = gltf.scene;
      // The hall is nearly black; give statues a soft studio reflection so
      // they read like the lit figures in the reference.
      model.traverse(n => {
        if (!n.isMesh) return;
        n.frustumCulled = false;
        [].concat(n.material).forEach(m => {
          if (m && m.isMeshStandardMaterial) { m.envMap = this.envMap; m.envMapIntensity = 1.4; m.needsUpdate = true; }
        });
      });
      this.playClips(model, gltf.animations, cfg.clip, cfg.freeze);
      const wrap = fitModel(model, { span: cfg.height, by: "y" });
      wrap.position.y = 0.06;
      // Face the dance floor.
      wrap.rotation.y = Math.atan2(-holder.position.x, -holder.position.z);
      holder.add(wrap);
    }));
  }

  // -------------------------------------------------------------- per frame

  update(dt, t) {
    this.mixers.forEach(m => m.update(dt));
    this.updateTiles(dt, t);
    this.updateDisco(dt, t);
    this.updateStrings(dt, t);
    this.updateOrbs(t);
    this.pulses.forEach(p => p.mat.color.copy(p.base).multiplyScalar(0.7 + 0.3 * Math.sin(t * 2.4 + p.phase)));
    if (this.floorLip) this.floorLip.color.setHex(NEON[Math.floor(t * 1.2) % NEON.length]);
    if (this.floorLights) this.floorLights.forEach((l, i) => l.color.setHex(NEON[(Math.floor(t * 1.5) + i * 2) % NEON.length]));
  }

  setQuality(q) {
    const on = q !== "low";
    this.lights.forEach(l => { l.visible = on; });
    if (this.beams) this.beams.visible = on;
    if (this.orbs) this.orbs.visible = on;
  }
}
