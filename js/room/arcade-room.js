/**
 * ARCADE - 3D Arcade Floor Lobby
 * Walk a chosen fighter around a room of cabinets. Each cabinet launches one round.
 * Uses vendored Three.js (see js/vendor + importmap in index.html); no build step.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CollisionWorld } from "./collision.js";
import { addBaseLights, addCornerGlow, addNeonAccents } from "./lighting.js";
import { RoomDecor } from "./decor.js";
import { LeaderboardManager } from "../leaderboard.js";

const ROOM_URL = "models/room-blank/source/Room%20house.gltf";

const MACHINE_MODELS = [
  // `forward` = the model's authored screen-facing direction in XZ, measured
  // from yaw-sweep contact sheets (only the pixel rig names its screen node).
  { id: "pixel", url: "models/arcade_machine_-_pixel-art_low-poly/scene.gltf", forward: [0, 1] },
  { id: "cabA", url: "models/arcade_machine/scene.gltf", forward: [-0.423, 0.906] },
  { id: "cabB", url: "models/arcademachine%20(1)/scene.gltf", forward: [0, 1] }
];

const FIGHTER = {
  id: "chameleon",
  name: "MECHA CHAMELEON",
  url: "models/chameleon_man_lite_-_simple_player_model/scene.gltf",
  height: 1.15,
  tint: 0x9dff70
};

const ROOM_TARGET_SPAN = 34;   // longest horizontal side of the room, in metres (bigger arena)
const WALL_INSET = 1.6;        // keep-away distance from the walls
const CABINET_HEIGHT = 2.2;
const WALK_SPEED = 3.2;
const RUN_SPEED = 7.0;
const ACCEL_WALK = 26;
const ACCEL_RUN = 34;
const FRICTION = 11;
const TURN_RATE = 14;
const JUMP_VELOCITY = 7.4;
const GRAVITY = 21;
const TONGUE_RANGE = 3.4;
const INTERACT_DISTANCE = 3.2;
const BASE_FOV = 58;           // vertical FOV at the reference aspect below
const BASE_ASPECT = 16 / 9;

const CABINETS = [
  { round: 1, name: "SCALE WARS", color: 0x00e5ff, machine: 0 },
  { round: 2, name: "CTRL+ALT+GUESS", color: 0xff2bd6, machine: 1 },
  { round: 3, name: "TECH MEME BATTLE", color: 0xa855f7, machine: 2 },
  { round: 4, name: "BLACKOUT CODE", color: 0x39ff14, machine: 1 },
  { round: 5, name: "RETRO BLAST", color: 0xffe600, machine: 0 }
];

// The five round cabinets ring the dance floor (left, back-left, back,
// back-right, right), each facing the centre; the front stays open.
const CABINET_ANGLES = [-90, -150, 180, 150, 90];  // back pair kept clear of the room's partition walls
const CABINET_RING = 6.6;          // metres from the centre of the dance floor
const SPAWN = { x: 0, z: 8.2 };    // front of the arena, looking at the dance floor

const UP = new THREE.Vector3(0, 1, 0);

/** Yaw that rotates `localDir` onto `desiredDir` (both XZ vectors). */
function yawBetween(localDir, desiredDir) {
  return Math.atan2(localDir.x, -localDir.z) - Math.atan2(desiredDir.x, -desiredDir.z);
}

function shortestAngle(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export class ArcadeRoom3D {
  constructor() {
    this.canvas = document.getElementById("room3dCanvas");
    this.loadingEl = document.getElementById("room3dLoading");
    this.progressBarEl = document.getElementById("room3dProgressBar");
    this.loadingNoteEl = document.getElementById("room3dLoadingNote");
    this.promptEl = document.getElementById("room3dPrompt");
    this.promptRoundEl = document.getElementById("room3dPromptRound");
    this.promptNameEl = document.getElementById("room3dPromptName");
    this.errorEl = document.getElementById("room3dError");
    this.pauseEl = document.getElementById("room3dPause");
    this.staminaEl = document.getElementById("room3dStamina");
    this.camoMeterEl = document.getElementById("room3dCamo");

    this.ready = false;
    this.active = false;
    this.keys = new Set();
    this.velocity = new THREE.Vector3();
    this.charYaw = 0;
    this.lean = 0;
    this.runLean = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.24;
    this.nearest = null;
    this.roomSource = "none";
    this.clock = new THREE.Clock();
    this.bounds = { x: 10, z: 8 };
    this.cabinetSpots = [];
    this.dragging = false;
    this._boundHandlers = {};
    this.fighter = FIGHTER;
    this.charHeight = FIGHTER.height;

    // Movement / ability state
    this.vertY = 0;
    this.vertVel = 0;
    this.grounded = true;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.stamina = 1;
    this.crouching = false;
    this.landTimer = 0;
    this.moveState = "idle";
    this.camo = 1;
    this.camoTarget = 1;
    this.aiming = false;
    this.tongueT = -1;
    this.tongueCooldown = 0;
    this.camSens = parseFloat(localStorage.getItem("arcade_cam_sens") || "1") || 1;
    this.quality = localStorage.getItem("arcade_quality") || "medium";
  }

  async init(onLaunchRound, onExit) {
    this.onLaunchRound = onLaunchRound;
    this.onExit = onExit;

    if (!this.canvas) throw new Error("room3dCanvas missing from index.html");

    if (this.loadingEl) this.loadingEl.classList.remove("hidden");

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070d);
    this.scene.fog = new THREE.Fog(0x05070d, 18, 46);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
    this.camera.position.set(0, 4, 10);

    this.addLights();
    this.initEnvironment();

    this.setProgress(0.05, "Loading arcade room geometry…");
    await this.loadRoom();
    this.setProgress(0.4, "Rolling in the cabinets…");
    await this.loadCabinets();
    this.setProgress(0.72, "Waking " + this.fighter.name + "…");
    await this.loadCharacter();
    this.character.position.set(
      THREE.MathUtils.clamp(SPAWN.x, -this.bounds.x, this.bounds.x), 0,
      THREE.MathUtils.clamp(SPAWN.z, -this.bounds.z + 1, this.bounds.z - 0.5)
    );
    this.addFloorGrid();
    this.buildScenery();
    this.setProgress(0.85, "Dropping the dance floor…");
    await this.loadDecor();
    this.buildCollision();
    this.initComposer();

    this.bindEvents();
    this.resize();
    this.applyQuality(this.quality);
    this.ready = true;
    this.setProgress(1, "ARENA READY — SPAWNING MECHA CHAMELEON");
    if (this.loadingEl) {
      setTimeout(() => this.loadingEl.classList.add("hidden"), 350);
    }
    this.renderFrame();
    // Character statues stream in after the room is usable (Master Chief is large).
    if (this.decor) this.decor.loadStatues().catch(err => console.warn("Statues failed:", err));
    return true;
  }

  // --------------------------------------------------------------- scene build

  addLights() {
    this.baseLights = addBaseLights(this.scene);
  }

  addCornerGlow() {
    this.cornerLights = addCornerGlow(this.scene, this.bounds);
  }

  addFloorGrid() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(0,229,255,0.55)";
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(this.bounds.x / 2, this.bounds.z / 2);

    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(this.bounds.x * 2, this.bounds.z * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = 0.02;
    this.scene.add(grid);
  }

  /**
   * Assemble the static collision world: an invisible perimeter shell, the real
   * room geometry (when we have a model), and one collider per cabinet holder.
   * The debug wireframe is built here too so F3 has something to show.
   */
  buildCollision() {
    this.collision = new CollisionWorld(this.scene);
    this.collision.addPerimeter(this.bounds, 5, 0.8);
    if (this.roomSource === "gltf" && this.room) {
      this.collision.addFromRoom(this.room, this.bounds);
      const floorY = this.decor ? this.decor.floorY : 0;
      const n = this.collision.addRoomWalls(this.room, this.bounds, 0.35, floorY);
      console.info("[collision] interior room wall boxes:", n);
    }
    this.cabinetSpots.forEach(spot => {
      if (spot.holder) this.collision.addFromObject(spot.holder, "cabinet");
    });
    (this.scenerySolids || []).forEach(obj => this.collision.addFromObject(obj, "scenery"));
    if (this.decor) this.decor.solidBoxes.forEach(box => this.collision.addBox(box.clone(), "arena"));
    this.collision.buildDebug();
  }

  // ------------------------------------------------------------------- scenery

  /** Shared emissive material factory so neon props glow through the bloom pass. */
  neonMat(color, intensity = 2.4) {
    return new THREE.MeshStandardMaterial({
      color: 0x05070d,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.4,
      metalness: 0.1
    });
  }

  /**
   * Fill the arcade so it reads as a venue, not an empty box: ceiling neon
   * strips, hanging signs, a claw machine, a prize counter, rug patches, wall
   * posters and extra rows of (non-interactive) cabinets. Solid props are
   * collected in scenerySolids and collider-ified by buildCollision.
   */
  buildScenery() {
    this.scenery = new THREE.Group();
    this.scenery.name = "scenery";
    this.scene.add(this.scenery);
    this.scenerySolids = [];
    const B = this.bounds;

    // Ceiling strips, hanging signs, leaderboard, floor art etc. live in decor.js.

    // Claw machine (solid) tucked in a corner
    const claw = this.buildClawMachine();
    claw.position.set(-B.x + 1.4, 0, -B.z + 1.4);
    claw.rotation.y = Math.PI / 4;
    this.scenery.add(claw);
    this.scenerySolids.push(claw);

    // Prize counter (solid) along the back wall, under the PLAY sign
    const counter = this.buildPrizeCounter();
    counter.position.set(0, 0, -B.z + 0.8);
    counter.rotation.y = Math.PI / 2;
    this.scenery.add(counter);
    this.scenerySolids.push(counter);

    // Extra rows of deco cabinets to fill the floor (solid, non-interactive)
    if (this.machinePrototypes && this.machinePrototypes.length) {
      // Along the side walls, facing into the arena.
      const rows = [
        { x: -B.x + 0.9, z: -B.z * 0.36, yaw: Math.PI / 2 },
        { x: B.x - 0.9, z: -B.z * 0.36, yaw: -Math.PI / 2 },
        { x: -B.x + 0.9, z: B.z * 0.52, yaw: Math.PI / 2 },
        { x: B.x - 0.9, z: B.z * 0.52, yaw: -Math.PI / 2 }
      ];
      rows.forEach((row, i) => {
        const proto = this.machinePrototypes[i % this.machinePrototypes.length];
        const cab = proto.root.clone(true);
        cab.scale.setScalar(proto.scale * 0.92);
        const holder = new THREE.Group();
        holder.add(cab);
        holder.position.set(row.x, 0, row.z);
        holder.rotation.y = row.yaw;
        cab.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(cab);
        cab.position.y -= bb.min.y;
        holder.updateMatrixWorld(true);
        this.scenery.add(holder);
        this.scenerySolids.push(holder);
      });
    }

    this.addNeonAccents();
    this.addGlossyFloor();
  }

  /**
   * Party decor (dance floor, disco ball, christmas lights, neon signs). Uses the
   * model folders when present, neon stand-ins otherwise; never blocks the room.
   */
  async loadDecor() {
    try {
      this.decor = new RoomDecor(this.scene, this.bounds, {
        envMap: this.envTexture,
        floorY: this.measureFloorY(),
        walls: this.measureWalls(),
        leaderboard: (() => { try { return LeaderboardManager.getEntries(); } catch (_) { return []; } })()
      });
      await this.decor.load(note => this.setProgress(0.92, note));
    } catch (err) {
      console.warn("Party decor failed to load:", err);
      this.decor = null;
    }
  }

  groundHeightAt(x, z) {
    return this.decor ? this.decor.groundHeightAt(x, z) : 0;
  }

  /** Height of the room model's walkable floor at the centre (it sits a little above y=0). */
  measureFloorY() {
    if (!this.room) return 0;
    const ray = new THREE.Raycaster(new THREE.Vector3(0.2, 2, 0.2), new THREE.Vector3(0, -1, 0), 0, 4);
    const hit = ray.intersectObject(this.room, true).find(h => h.point.y < 0.6);
    return hit ? hit.point.y + 0.004 : 0;
  }

  /**
   * Inner wall faces of the hall around the spawn point, found by casting rays
   * out from the centre (the house model has interior walls, so its bounding
   * box is not the hall). Falls back to the walkable bounds.
   */
  measureWalls() {
    const B = this.bounds;
    const fallback = { xMin: -B.x - 0.6, xMax: B.x + 0.6, zMin: -B.z - 0.6, zMax: B.z + 0.6 };
    if (!this.room) return fallback;
    const ray = new THREE.Raycaster();
    const origin = new THREE.Vector3(0, 1.6, 0);
    const cast = (dir, fb) => {
      ray.set(origin, dir);
      ray.far = 40;
      const hit = ray.intersectObject(this.room, true)[0];
      return hit ? hit.distance - 0.12 : fb;
    };
    return {
      xMin: -cast(new THREE.Vector3(-1, 0, 0), -fallback.xMin),
      xMax: cast(new THREE.Vector3(1, 0, 0), fallback.xMax),
      zMin: -cast(new THREE.Vector3(0, 0, -1), -fallback.zMin),
      zMax: cast(new THREE.Vector3(0, 0, 1), fallback.zMax)
    };
  }

  /** A handful of accent PointLights near cabinets; shadows stay off for perf. */
  addNeonAccents() {
    this.accentLights = addNeonAccents(this.scene, this.cabinetSpots, CABINETS.map(c => c.color));
  }

  /** Glossy reflective floor overlay so neon pools and cabinets mirror. */
  addGlossyFloor() {
    const geo = new THREE.PlaneGeometry(this.bounds.x * 2 + 2, this.bounds.z * 2 + 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0e1c,
      roughness: 0.35,
      metalness: 0.6,
      envMap: this.envTexture || null,
      envMapIntensity: 0.7
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.008;
    this.scene.add(floor);
    this.glossyFloor = floor;
  }

  buildClawMachine() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), new THREE.MeshStandardMaterial({ color: 0x2a1040, roughness: 0.5, metalness: 0.3 }));
    body.position.y = 0.5;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshStandardMaterial({ color: 0x88ddff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.22 }));
    glass.position.y = 1.55;
    g.add(glass);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.3, 1.25), this.neonMat(0xff2bd6, 2.2));
    top.position.y = 2.25;
    g.add(top);
    return g;
  }

  buildPrizeCounter() {
    const g = new THREE.Group();
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 5.0), new THREE.MeshStandardMaterial({ color: 0x14203c, roughness: 0.5, metalness: 0.3 }));
    desk.position.y = 0.55;
    g.add(desk);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 4.8), this.neonMat(0x00e5ff, 2.4));
    strip.position.set(-0.52, 1.0, 0);
    g.add(strip);
    return g;
  }

  makeSignTexture(text, color) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(5,7,13,0.85)";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#" + new THREE.Color(color).getHexString();
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = "#" + new THREE.Color(color).getHexString();
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  makePosterTexture(color) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 352;
    const ctx = c.getContext("2d");
    const hex = "#" + new THREE.Color(color).getHexString();
    ctx.fillStyle = "#0a0e1c";
    ctx.fillRect(0, 0, 256, 352);
    ctx.strokeStyle = hex;
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, 232, 328);
    ctx.fillStyle = hex;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(128, 90 + i * 44, 26 - i * 3, 0, Math.PI * 2);
      ctx.globalAlpha = 0.25 + i * 0.15;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  async loadRoom() {
    try {
      const gltf = await this.loadGltf(ROOM_URL);
      const room = gltf.scene;
      room.traverse((node) => {
        if (node.isMesh) {
          node.frustumCulled = true;
          if (Array.isArray(node.material)) node.material.forEach(m => { m.side = THREE.DoubleSide; });
          else if (node.material) node.material.side = THREE.DoubleSide;
        }
        if (/roof|ceiling/i.test(node.name || "")) node.visible = false;
      });

      this.scene.add(room);
      room.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(room);
      const size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.z) || 1;
      const scale = ROOM_TARGET_SPAN / span;
      room.scale.setScalar(scale);
      room.updateMatrixWorld(true);

      const scaled = new THREE.Box3().setFromObject(room);
      const center = scaled.getCenter(new THREE.Vector3());
      room.position.x -= center.x;
      room.position.z -= center.z;
      room.position.y -= scaled.min.y;
      room.updateMatrixWorld(true);

      const finalBox = new THREE.Box3().setFromObject(room);
      const finalSize = finalBox.getSize(new THREE.Vector3());
      this.bounds = {
        x: Math.max(6, finalSize.x / 2 - WALL_INSET),
        z: Math.max(5, finalSize.z / 2 - WALL_INSET)
      };
      // The house model has interior walls, so its bounding box is not the
      // hall we stand in. Find the hall's inner walls by ray casting, move the
      // hall onto the origin and size the walkable area from it.
      for (let pass = 0; pass < 2; pass++) {
        const hall = this.castHall(room);
        if (!hall) break;
        room.position.x -= (hall.xMin + hall.xMax) / 2;
        room.position.z -= (hall.zMin + hall.zMax) / 2;
        room.updateMatrixWorld(true);
        if (pass === 1) {
          this.bounds = {
            x: Math.max(6, (hall.xMax - hall.xMin) / 2 - 1.0),
            z: Math.max(5, (hall.zMax - hall.zMin) / 2 - 1.0)
          };
        }
      }
      // Dim the house materials so the neon cabinets carry the lighting.
      room.traverse(node => {
        if (!node.isMesh || !node.material) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(m => {
          if (m.color) m.color.multiplyScalar(0.16); // near-black hall so the neon pops
          if (m.emissive) m.emissive.multiplyScalar(0.25);
        });
      });
      this.room = room;
      this.roomSource = "gltf";
      this.addCornerGlow();
    } catch (err) {
      console.warn("Room model failed to load, building procedural floor:", err);
      this.buildProceduralRoom();
      this.roomSource = "procedural";
    }
  }

  /** Inner wall extents around the origin (min over a few parallel rays per side). */
  castHall(room) {
    const ray = new THREE.Raycaster();
    ray.far = 60;
    const dist = (dir, lateral) => {
      let best = Infinity;
      [-1.5, 0, 1.5].forEach(o => {
        const origin = new THREE.Vector3(lateral.x * o, 1.6, lateral.z * o);
        ray.set(origin, dir);
        const hit = ray.intersectObject(room, true)[0];
        if (hit) best = Math.min(best, hit.distance);
      });
      return best;
    };
    const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
    const xMax = dist(X, Z), xMin = -dist(X.clone().negate(), Z);
    const zMax = dist(Z, X), zMin = -dist(Z.clone().negate(), X);
    if (![xMax, xMin, zMax, zMin].every(Number.isFinite)) return null;
    return { xMin, xMax, zMin, zMax };
  }

  buildProceduralRoom() {
    this.bounds = { x: 12, z: 8.5 };
    const w = this.bounds.x * 2 + WALL_INSET * 2;
    const d = this.bounds.z * 2 + WALL_INSET * 2;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 0.55, metalness: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x121a33, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide });
    const wallGeoX = new THREE.PlaneGeometry(w, 5);
    const wallGeoZ = new THREE.PlaneGeometry(d, 5);
    const walls = [
      { geo: wallGeoX, pos: [0, 2.5, -d / 2], rot: [0, 0, 0] },
      { geo: wallGeoX, pos: [0, 2.5, d / 2], rot: [0, Math.PI, 0] },
      { geo: wallGeoZ, pos: [-w / 2, 2.5, 0], rot: [0, Math.PI / 2, 0] },
      { geo: wallGeoZ, pos: [w / 2, 2.5, 0], rot: [0, -Math.PI / 2, 0] }
    ];
    walls.forEach(cfg => {
      const mesh = new THREE.Mesh(cfg.geo, wallMat);
      mesh.position.set(...cfg.pos);
      mesh.rotation.set(...cfg.rot);
      this.scene.add(mesh);
    });
  }

  async loadCabinets() {
    const prototypes = await Promise.all(MACHINE_MODELS.map(async (cfg) => {
      try {
        const gltf = await this.loadGltf(cfg.url);
        return this.prepareMachinePrototype(gltf.scene, cfg);
      } catch (err) {
        console.warn("Cabinet model " + cfg.id + " failed, using neon stand-in:", err);
        return this.prepareMachinePrototype(this.buildFallbackCabinet(), cfg);
      }
    }));
    this.machinePrototypes = prototypes;

    const ringX = Math.min(CABINET_RING, this.bounds.x - 1.2);
    const ringZ = Math.min(CABINET_RING, this.bounds.z - 1.2);

    CABINETS.forEach((cfg, i) => {
      const proto = prototypes[cfg.machine] || prototypes[0];
      const cab = proto.root.clone(true);
      cab.scale.setScalar(proto.scale);

      const holder = new THREE.Group();
      holder.add(cab);

      const ang = (CABINET_ANGLES[i] || 0) * Math.PI / 180;
      holder.position.set(Math.sin(ang) * ringX, 0, Math.cos(ang) * ringZ);

      // Feet on the floor after scaling
      cab.updateMatrixWorld(true);
      const localBox = new THREE.Box3().setFromObject(cab);
      cab.position.y -= localBox.min.y;

      const toCenter = new THREE.Vector3(-holder.position.x, 0, -holder.position.z).normalize();
      holder.rotation.y = yawBetween(proto.screenDir, toCenter);
      holder.updateMatrixWorld(true);

      this.scene.add(holder);
      this.decorateCabinet(holder, cfg, proto);

      this.cabinetSpots.push({
        round: cfg.round,
        name: cfg.name,
        color: cfg.color,
        machine: MACHINE_MODELS[cfg.machine].id,
        position: holder.position.clone(),
        radius: proto.radius,
        holder
      });
    });
  }

  /** Scales, measures and finds the screen-facing direction of one machine model. */
  prepareMachinePrototype(root, cfg) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const scale = CABINET_HEIGHT / (size.y || 1);
    const center = box.getCenter(new THREE.Vector3());

    // Recentre the geometry on the origin so marquees, screens and halos line up
    // (Sketchfab exports often park the mesh far from the node origin).
    const protoRoot = new THREE.Group();
    root.position.x -= center.x;
    root.position.z -= center.z;
    protoRoot.add(root);

    let screenDir = null;
    if (cfg.forward) {
      screenDir = new THREE.Vector3(cfg.forward[0], 0, cfg.forward[1]).normalize();
    } else {
      let screenMesh = null;
      root.traverse(node => { if (!screenMesh && /screen|glare|display|monitor/i.test(node.name || "")) screenMesh = node; });
      if (screenMesh) {
        // The glare plane's normal is the screen's facing direction; node origins
        // and box centers are unreliable in FBX-converted exports.
        screenMesh.updateMatrixWorld(true);
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(screenMesh.getWorldQuaternion(new THREE.Quaternion()));
        normal.y = 0;
        if (normal.lengthSq() > 1e-6) screenDir = normal.normalize();
      }
    }
    if (!screenDir) screenDir = new THREE.Vector3(0, 0, -1);

    // How far the front face sits from the origin, for placing the screen glow.
    let frontExt = 0.4;
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root);
    const corners = [];
    for (let i = 0; i < 8; i++) {
      corners.push(new THREE.Vector3(
        i & 1 ? b.max.x : b.min.x,
        i & 2 ? b.max.y : b.min.y,
        i & 4 ? b.max.z : b.min.z
      ));
    }
    frontExt = Math.max(...corners.map(p => p.dot(screenDir))) - center.dot(screenDir);
    frontExt = THREE.MathUtils.clamp(frontExt * scale, 0.25, 1.2);

    return {
      id: cfg.id,
      root: protoRoot,
      scale,
      screenDir,
      frontExt,
      radius: Math.max(0.8, Math.max(size.x, size.z) * scale * 0.55)
    };
  }

  decorateCabinet(holder, cfg, proto) {
    const color = new THREE.Color(cfg.color);
    const fwd = proto.screenDir;

    // Marquee sign above the cabinet
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(CABINET_HEIGHT * 0.92, CABINET_HEIGHT * 0.28),
      new THREE.MeshBasicMaterial({ map: this.makeLabelTexture(cfg, color), transparent: true, side: THREE.DoubleSide })
    );
    label.position.set(fwd.x * 0.05, CABINET_HEIGHT + 0.42, fwd.z * 0.05);
    label.rotation.y = yawBetween(new THREE.Vector3(0, 0, 1), fwd);
    holder.add(label);

    // Animated attract-mode screen floating on the cabinet's front face
    const screen = this.makeAttractScreen(cfg, color);
    screen.mesh.position.set(fwd.x * (proto.frontExt + 0.04), CABINET_HEIGHT * 0.62, fwd.z * (proto.frontExt + 0.04));
    screen.mesh.rotation.y = label.rotation.y;
    holder.add(screen.mesh);

    // Neon halo on the floor in front of the cabinet
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(CABINET_HEIGHT * 0.34, CABINET_HEIGHT * 0.42, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(fwd.x * (CABINET_HEIGHT * 0.55), 0.03, fwd.z * (CABINET_HEIGHT * 0.55));
    holder.add(ring);

    const light = new THREE.PointLight(color, 5.5, 9, 2);
    light.position.set(fwd.x * 1.2, CABINET_HEIGHT * 0.75, fwd.z * 1.2);
    holder.add(light);

    holder.userData.pulse = { ring, light, base: 5.5, phase: cfg.round * 0.7, screen };
  }

  /** Canvas-textured plane that plays a looping attract-mode animation per round. */
  makeAttractScreen(cfg, color) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 192;
    const ctx = c.getContext("2d");
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CABINET_HEIGHT * 0.52, CABINET_HEIGHT * 0.39),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    return { mesh, ctx, tex, color, hex: "#" + color.getHexString(), phase: cfg.round * 1.3, round: cfg.round, name: cfg.name };
  }

  drawAttractScreen(s, t) {
    const { ctx, hex } = s;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(2,4,12,0.9)";
    ctx.fillRect(0, 0, w, h);

    // Equalizer bars
    for (let i = 0; i < 12; i++) {
      const bh = (0.25 + 0.75 * Math.abs(Math.sin(t * 2.2 + i * 0.7 + s.phase))) * h * 0.34;
      ctx.fillStyle = hex;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(8 + i * 20, h - 14 - bh, 12, bh);
    }
    ctx.globalAlpha = 1;

    // Scanline sweep
    const sy = (t * 60 + s.phase * 40) % h;
    const grad = ctx.createLinearGradient(0, sy - 18, 0, sy + 18);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, sy - 18, w, 36);

    ctx.textAlign = "center";
    ctx.fillStyle = hex;
    ctx.font = "900 34px Orbitron, 'Segoe UI', sans-serif";
    ctx.fillText("ROUND " + s.round, w / 2, 52);
    ctx.fillStyle = "#ffffff";
    let fs = 26;
    ctx.font = `700 ${fs}px Orbitron, 'Segoe UI', sans-serif`;
    while (ctx.measureText(s.name).width > w - 24 && fs > 12) {
      fs -= 2;
      ctx.font = `700 ${fs}px Orbitron, 'Segoe UI', sans-serif`;
    }
    ctx.fillText(s.name, w / 2, 88);
    ctx.fillStyle = hex;
    ctx.font = "700 18px Orbitron, 'Segoe UI', sans-serif";
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + s.phase);
    ctx.fillText("PRESS E TO PLAY", w / 2, h - 26);
    ctx.globalAlpha = 1;
    s.tex.needsUpdate = true;
  }

  makeLabelTexture(cfg, color) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 320;
    const ctx = c.getContext("2d");
    const hex = "#" + color.getHexString();

    ctx.fillStyle = "rgba(4,7,18,0.92)";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = hex;
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, c.width - 20, c.height - 20);

    ctx.textAlign = "center";
    ctx.fillStyle = hex;
    ctx.font = "700 84px Orbitron, 'Segoe UI', sans-serif";
    ctx.fillText("ROUND " + cfg.round, c.width / 2, 122);
    ctx.fillStyle = "#ffffff";
    let fontSize = 96;
    ctx.font = `900 ${fontSize}px Orbitron, 'Segoe UI', sans-serif`;
    while (ctx.measureText(cfg.name).width > c.width - 90 && fontSize > 40) {
      fontSize -= 6;
      ctx.font = `900 ${fontSize}px Orbitron, 'Segoe UI', sans-serif`;
    }
    ctx.fillText(cfg.name, c.width / 2, 248);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  buildFallbackCabinet() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.9, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1a2140, roughness: 0.6, metalness: 0.3 })
    );
    body.position.y = 0.95;
    body.name = "CabinetBody";
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.55),
      new THREE.MeshBasicMaterial({ color: 0x66f6ff })
    );
    screen.name = "screen";
    screen.position.set(0, 1.35, 0.41);
    group.add(body, screen);
    return group;
  }

  async loadCharacter() {
    let model;
    try {
      const gltf = await this.loadGltf(this.fighter.url);
      model = gltf.scene;
      this.animations = gltf.animations || [];
    } catch (err) {
      console.warn("Fighter model failed, using stand-in capsule:", err);
      model = this.buildFallbackCharacter();
      this.animations = [];
    }

    this.model = model;
    this.camoMats = [];
    model.traverse(node => {
      if (node.isMesh && node.material) {
        (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => {
          if (!this.camoMats.includes(m)) this.camoMats.push(m);
        });
      }
    });
    this.paintMechaChameleon(model);
    this.addCharacterExtras(model);
    this.character = new THREE.Group();
    this.character.add(model);
    this.character.position.set(0, 0, 0);
    this.scene.add(this.character);

    this.mixer = new THREE.AnimationMixer(model);
    const walkClip = this.animations.find(a => /walk|run|dash/i.test(a.name)) || null;
    const idleClip = this.animations.find(a => /idle|wait|pose_a/i.test(a.name)) || null;
    const crouchClip = this.animations.find(a => /crosslegged|crouch|sit/i.test(a.name)) || null;
    // Probe root motion BEFORE stripping it: the travel direction of the walk
    // cycle is the most reliable facing signal for game-exported rigs.
    const clipForward = walkClip ? this.probeClipForward(model, walkClip) : null;
    // Clips often bake root motion into the walk cycle; the controller owns
    // movement, so drop root-bone position tracks or the mesh drifts away.
    const ROOT_BONE = /^(origin|root|hips|waist|pelvis|pm0025_00_pikachu|bone[._]?0+)$/i;
    this.animations.forEach(clip => {
      clip.tracks = clip.tracks.filter(t => {
        const dot = t.name.lastIndexOf(".");
        if (dot < 0) return true;
        return !(t.name.slice(dot + 1) === "position" && ROOT_BONE.test(t.name.slice(0, dot)));
      });
    });
    this.walkAction = walkClip ? this.mixer.clipAction(walkClip) : null;
    this.idleAction = idleClip ? this.mixer.clipAction(idleClip) : null;
    this.crouchAction = crouchClip ? this.mixer.clipAction(crouchClip) : null;
    if (this.walkAction) {
      this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
      this.walkAction.play();
      this.walkAction.setEffectiveWeight(0);
    }
    if (this.idleAction) {
      this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
      this.idleAction.play();
      this.idleAction.setEffectiveWeight(1);
    }
    if (this.crouchAction) {
      this.crouchAction.setLoop(THREE.LoopRepeat, Infinity);
      this.crouchAction.play();
      this.crouchAction.setEffectiveWeight(0);
    }
    this.animState = "idle";

    // The first animation frame decides how the rig actually stands, so pose it
    // before measuring — some exports keep the upright orientation in the clip.
    this.mixer.update(0);
    // Skinned meshes report their bind-pose box: it tells upright rigs apart from
    // rigs whose upright pose lives only in the clips (bind box lying along Z).
    const bindBox = new THREE.Box3().setFromObject(model);
    const bindSize = bindBox.getSize(new THREE.Vector3());
    const upright = bindSize.y >= 0.8 * Math.max(bindSize.x, bindSize.z);
    // Clip-less rigs are already in their play pose, so their bind box is truth
    // even when protruding weapons make it look "lying down".
    const useSkinned = this.animations.length === 0 || upright;
    const posedBox = this.measureCharacter(model);
    const currentHeight = useSkinned ? bindSize.y : posedBox.getSize(new THREE.Vector3()).y;
    model.scale.multiplyScalar(this.charHeight / (currentHeight || 1));

    const posed = this.measureCharacter(model);
    const skinnedBox = new THREE.Box3().setFromObject(model);
    let anchor = null;
    model.traverse(n => {
      if (!anchor && n.isBone && /hip|waist|pelvis|origin|^root/i.test(n.name || "")) anchor = n;
    });
    const aw = anchor ? anchor.getWorldPosition(new THREE.Vector3()) : posed.getCenter(new THREE.Vector3());
    // Anchor the body core (stray tail/antenna bones would skew a box centre)
    // on the spawn point with feet on the floor, in character-local space.
    model.position.x -= aw.x - this.character.position.x;
    model.position.z -= aw.z - this.character.position.z;
    const groundY = useSkinned ? Math.min(posed.min.y, skinnedBox.min.y) : posed.min.y;
    model.position.y -= groundY - this.character.position.y;
    model.updateMatrixWorld(true);
    this.modelBaseY = model.position.y;

    this.forwardOffsetDir = this.detectModelForward(model, clipForward);
    this.forwardAlpha = Math.atan2(this.forwardOffsetDir.x, -this.forwardOffsetDir.z);
    this.mixer.update(0);
  }

  /** World-space box of a rigged model, from its posed bones (geometry box as fallback). */
  measureCharacter(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    root.traverse(node => {
      if (node.isBone) box.expandByPoint(node.getWorldPosition(v));
    });
    return box.isEmpty() ? new THREE.Box3().setFromObject(root) : box;
  }

  /**
   * Facing direction of the fighter: root-motion of the walk clip first (game-exported
   * rigs travel along their facing axis), then shoulder bones, then glTF -Z.
   */
  probeClipForward(model, walkClip) {
    try {
      // Use whichever bone actually travels the most over a full cycle: some
      // rigs put root motion on a child of the named root (chameleon: Bone_00).
      const bones = [];
      model.traverse(node => { if (node.isBone) bones.push(node); });
      if (!bones.length) return null;
      // The clip must actually be playing or mixer updates apply nothing.
      const act = this.mixer.clipAction(walkClip);
      act.reset();
      act.setEffectiveWeight(1);
      act.play();
      model.updateMatrixWorld(true);
      const start = new Map();
      const v = new THREE.Vector3();
      this.mixer.setTime(0);
      model.updateMatrixWorld(true);
      bones.forEach(b => start.set(b, b.getWorldPosition(v.clone())));
      this.mixer.setTime(walkClip.duration * 0.5);
      model.updateMatrixWorld(true);
      let best = null;
      let bestLen = 0;
      bones.forEach(b => {
        const d = b.getWorldPosition(v.clone()).sub(start.get(b));
        d.y = 0;
        const len = d.length();
        if (len > bestLen) { bestLen = len; best = d; }
      });
      this.mixer.setTime(0);
      model.updateMatrixWorld(true);
      act.stop();
      if (best && bestLen > 1e-4) {
        // Half-cycle travel doubled = metres per second of the authored cycle;
        // used to scale playback so feet plant instead of skating.
        this.walkCycleSpeed = (bestLen * 2) / walkClip.duration;
        return best.normalize();
      }
    } catch (err) {
      console.warn("Root-motion facing probe failed:", err);
    }
    return null;
  }

  detectModelForward(model, clipForward) {
    if (clipForward) return clipForward;

    let shoulderR = null;
    let shoulderL = null;
    model.traverse(node => {
      const n = (node.name || "").toLowerCase();
      if (!shoulderR && /shoulder[._]?r/.test(n)) shoulderR = node;
      if (!shoulderL && /shoulder[._]?l/.test(n)) shoulderL = node;
    });
    if (shoulderR && shoulderL) {
      model.updateMatrixWorld(true);
      const pr = shoulderR.getWorldPosition(new THREE.Vector3());
      const pl = shoulderL.getWorldPosition(new THREE.Vector3());
      const right = pr.sub(pl);
      right.y = 0;
      if (right.lengthSq() > 1e-6) {
        right.normalize();
        return new THREE.Vector3().crossVectors(UP, right).normalize();
      }
    }
    return new THREE.Vector3(0, 0, -1);
  }

  buildFallbackCharacter() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.55, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x39ff14, roughness: 0.4, metalness: 0.2, emissive: 0x0d5c07 })
    );
    body.position.y = 0.55;
    body.name = "ChameleonBody";
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.25, 10),
      new THREE.MeshStandardMaterial({ color: 0x8bff6a })
    );
    nose.name = "shoulder.R_nose";
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.85, -0.25);
    group.add(body, nose);
    return group;
  }

  initEnvironment() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      // Kept off scene.environment so the room stays dark neon; the chameleon
      // armor samples it directly for metal reflections.
      this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch (err) {
      console.warn("Environment map unavailable:", err);
    }
  }

  // The chameleon gltf ships as one untextured white mesh, so the mecha look is
  // painted procedurally: PBR armor, per-bone vertex colours, neon rig joints.
  paintMechaChameleon(model) {
    this.glowParts = [];
    const PALETTE = [
      [/foot|shin/i, 0x2a3340],
      [/thigh/i, 0x1f5c3a],
      [/hand|lower_arm/i, 0x35684a],
      [/upper_arm|shoulder/i, 0x2f8f4f],
      [/Bone\.?00[34]|head/i, 0x46b46a],
      [/Bone|root/i, 0x2f8f4f]
    ];
    const glowMat = (color, intensity, phase) => {
      const m = new THREE.MeshStandardMaterial({
        color: 0x05070d,
        emissive: color,
        emissiveIntensity: intensity,
        metalness: 0.3,
        roughness: 0.35,
        envMap: this.envTexture || null,
        transparent: true,
        opacity: 1
      });
      this.camoMats.push(m);
      this.glowParts.push({ mat: m, base: intensity, phase });
      return m;
    };

    model.traverse(node => {
      if (!node.isSkinnedMesh) return;
      const geo = node.geometry;
      const bones = node.skeleton ? node.skeleton.bones : [];
      const si = geo.attributes.skinIndex;
      const sw = geo.attributes.skinWeight;
      const count = geo.attributes.position.count;
      const colors = new Float32Array(count * 3);
      const c = new THREE.Color();
      for (let v = 0; v < count; v++) {
        let bi = 0;
        let bw = -1;
        if (si && sw) {
          for (let k = 0; k < 4; k++) {
            const w = sw.getComponent(v, k);
            if (w > bw) { bw = w; bi = si.getComponent(v, k); }
          }
        }
        const name = bones[bi] ? bones[bi].name : "";
        let hex = 0x2f8f4f;
        for (const [re, h] of PALETTE) {
          if (re.test(name)) { hex = h; break; }
        }
        c.set(hex);
        const wear = 0.9 + 0.2 * Math.abs((Math.sin(v * 12.9898) * 43758.5453) % 1);
        colors[v * 3] = c.r * wear;
        colors[v * 3 + 1] = c.g * wear;
        colors[v * 3 + 2] = c.b * wear;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const old = Array.isArray(node.material) ? node.material[0] : node.material;
      const armor = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.78,
        roughness: 0.36,
        envMap: this.envTexture || null,
        envMapIntensity: 1.15,
        side: THREE.DoubleSide
      });
      node.material = armor;
      const idx = this.camoMats.indexOf(old);
      if (idx >= 0) this.camoMats[idx] = armor;
      else this.camoMats.push(armor);

      // Neon rings/core rigidly parented to bones so they follow the rig
      model.updateMatrixWorld(true);
      const Z = new THREE.Vector3(0, 0, 1);
      const limbAxis = (bone) => {
        const p = bone.getWorldPosition(new THREE.Vector3());
        const child = bone.children.find(ch => ch.isBone);
        if (child) return child.getWorldPosition(new THREE.Vector3()).sub(p);
        if (bone.parent && bone.parent.isBone) return p.sub(bone.parent.getWorldPosition(new THREE.Vector3()));
        return null;
      };
      const addRing = (boneRe, radius, tube, color, intensity) => {
        bones.forEach(bone => {
          if (!boneRe.test(bone.name)) return;
          const axis = limbAxis(bone);
          const mesh = new THREE.Mesh(
            new THREE.TorusGeometry(radius, tube, 10, 24),
            glowMat(color, intensity, bone.name.length)
          );
          if (axis && axis.lengthSq() > 1e-8) {
            const q = new THREE.Quaternion().setFromUnitVectors(Z, axis.normalize());
            mesh.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
          }
          bone.add(mesh);
        });
      };
      addRing(/foot/i, 0.075, 0.016, 0x66f6ff, 1.8);
      addRing(/hand/i, 0.06, 0.014, 0x66f6ff, 1.6);
      addRing(/Bone\.?003/i, 0.1, 0.02, 0xff2bd6, 2.0);
      bones.forEach(bone => {
        if (!/Bone\.?002/i.test(bone.name)) return;
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), glowMat(0xff2bd6, 2.2, 1.7));
        bone.add(core);
      });
    });
  }

  /**
   * Chameleon silhouette extras the base rig lacks: a curled tail, two eyes that
   * swivel independently, a casque/crest and toe pads. Parented to bones where a
   * matching one exists so they ride the animation, else to the model root.
   */
  addCharacterExtras(model) {
    const bones = [];
    model.traverse(n => { if (n.isBone) bones.push(n); });
    const find = re => bones.find(b => re.test(b.name)) || null;
    const head = find(/head/i) || find(/neck/i);
    const tail = find(/tail/i);
    const feet = bones.filter(b => /foot/i.test(b.name));
    const anchor = head || model;

    this.charExtras = { eyes: [], tailPivot: null };

    // Casque / crest: a swept fin on top of the head
    const crest = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x1de08a, roughness: 0.4, metalness: 0.5, emissive: 0x0a4d2e, emissiveIntensity: 0.6 })
    );
    crest.rotation.x = -0.5;
    crest.position.set(0, 0.16, -0.04);
    anchor.add(crest);

    // Independently rotating eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe600, roughness: 0.25, metalness: 0.3, emissive: 0x665c00, emissiveIntensity: 0.8 });
    [-1, 1].forEach(side => {
      const pivot = new THREE.Group();
      pivot.position.set(0.07 * side, 0.08, 0.1);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), eyeMat);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: 0x05070d }));
      pupil.position.z = 0.035;
      pivot.add(eye, pupil);
      anchor.add(pivot);
      this.charExtras.eyes.push({ pivot, phase: side * 1.7 });
    });

    // Curled tail: a spiral of shrinking segments behind the hips
    const tailPivot = new THREE.Group();
    (tail || model).add(tailPivot);
    const segMat = new THREE.MeshStandardMaterial({ color: 0x1de08a, roughness: 0.45, metalness: 0.5, emissive: 0x0a4d2e, emissiveIntensity: 0.5 });
    let cx = 0, cy = 0, cz = 0, ang = 0, r = 0.05;
    for (let i = 0; i < 14; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, 0.05 - i * 0.003), 8, 8), segMat);
      seg.position.set(cx, cy, cz);
      tailPivot.add(seg);
      ang += 0.5;
      r = Math.max(0.02, 0.05 - i * 0.002);
      cx -= Math.sin(ang) * 0.05;
      cz -= Math.cos(ang) * 0.05 * (i < 5 ? 1 : 0.4);
      cy += i > 6 ? 0.02 : 0;
    }
    tailPivot.position.set(0, 0.35, -0.25);
    this.charExtras.tailPivot = tailPivot;

    // Toe pads on each foot
    feet.forEach(foot => {
      [-1, 1].forEach(side => {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), segMat);
        pad.position.set(0.03 * side, -0.02, 0.06);
        foot.add(pad);
      });
    });

    // Lock-on reticle ring, shown around the aimed cabinet
    this.lockRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.lockRing.visible = false;
    this.scene.add(this.lockRing);
  }

  /** Swivel the eyes on separate clocks and sway the tail each frame. */
  updateCharacterExtras(dt) {
    if (!this.charExtras) return;
    const t = performance.now() / 1000;
    this.charExtras.eyes.forEach((e, i) => {
      e.pivot.rotation.y = Math.sin(t * (0.9 + i * 0.35) + e.phase) * 0.7;
      e.pivot.rotation.x = Math.cos(t * (0.7 + i * 0.22) + e.phase) * 0.3;
    });
    if (this.charExtras.tailPivot) {
      this.charExtras.tailPivot.rotation.y = Math.sin(t * 1.6) * 0.18;
      this.charExtras.tailPivot.rotation.x = Math.cos(t * 1.1) * 0.08;
    }
  }

  initComposer() {
    try {
      const size = new THREE.Vector2();
      this.renderer.getSize(size);
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(size, 0.62, 0.75, 0.55);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(this.makeFilmPass());
      this.composer.addPass(new OutputPass());
    } catch (err) {
      console.warn("Bloom composer unavailable, rendering direct:", err);
      this.composer = null;
    }
  }

  /** Subtle vignette + animated film grain to give the neon room a CRT feel. */
  makeFilmPass() {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uVignette: { value: 0.32 },
        uGrain: { value: 0.035 }
      },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: [
        "uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uGrain;",
        "varying vec2 vUv;",
        "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }",
        "void main(){",
        "  vec4 c = texture2D(tDiffuse, vUv);",
        "  vec2 q = vUv - 0.5;",
        "  float vig = smoothstep(0.95, 0.25, dot(q,q) * 1.9);",
        "  c.rgb *= mix(1.0, vig, uVignette);",
        "  c.rgb += (hash(vUv * 913.0 + uTime) - 0.5) * uGrain;",
        "  gl_FragColor = c;",
        "}"
      ].join("\n")
    };
    this.filmPass = new ShaderPass(shader);
    return this.filmPass;
  }

  loadGltf(url) {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(url, resolve, undefined, reject);
    });
  }

  // ------------------------------------------------------------------ lifecycle

  enter() {
    if (!this.ready) return false;
    this.active = true;
    this.clock.getDelta();
    document.body.classList.add("room3d-mode");
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
    if (this.canvas) this.canvas.focus();
    return true;
  }

  exit() {
    this.active = false;
    this.paused = false;
    if (this.pauseEl) this.pauseEl.hidden = true;
    document.body.classList.remove("room3d-mode");
    if (this.renderer) this.renderer.setAnimationLoop(null);
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.keys.clear();
    if (this.promptEl) this.promptEl.classList.remove("visible");
    this.nearest = null;
  }

  dispose() {
    this.exit();

    // Detach every listener we registered so re-entering never double-binds.
    window.removeEventListener("keydown", this._boundHandlers.keydown);
    window.removeEventListener("keyup", this._boundHandlers.keyup);
    window.removeEventListener("blur", this._boundHandlers.blur);
    window.removeEventListener("resize", this._boundHandlers.resize);
    window.removeEventListener("pointermove", this._boundHandlers.pointermove);
    window.removeEventListener("pointerup", this._boundHandlers.pointerup);
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this._boundHandlers.pointerdown);
      this.canvas.removeEventListener("contextmenu", this._boundHandlers.contextmenu);
    }
    const sensEl = document.getElementById("room3dSens");
    if (sensEl && this._boundHandlers.sens) sensEl.removeEventListener("input", this._boundHandlers.sens);
    const pauseSensEl = document.getElementById("room3dSensPause");
    if (pauseSensEl && this._boundHandlers.pauseSens) pauseSensEl.removeEventListener("input", this._boundHandlers.pauseSens);
    ["btnPauseResume", "btnPauseSettings", "btnPauseLeave", "room3dQuality"].forEach(id => {
      const el = document.getElementById(id);
      const fn = this._boundHandlers["click_" + id];
      if (el && fn) el.removeEventListener("click", fn);
    });

    if (this.collision) { this.collision.dispose(); this.collision = null; }

    // Free GPU resources: geometries, materials and any canvas textures.
    if (this.scene) {
      this.scene.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        const mats = Array.isArray(node.material) ? node.material : (node.material ? [node.material] : []);
        mats.forEach(m => {
          ["map", "emissiveMap", "envMap", "normalMap", "roughnessMap"].forEach(k => {
            if (m[k] && m[k].dispose) m[k].dispose();
          });
          m.dispose();
        });
      });
    }
    if (this.envTexture && this.envTexture.dispose) this.envTexture.dispose();
    if (this.composer) {
      (this.composer.passes || []).forEach(p => { if (p.dispose) p.dispose(); });
      this.composer = null;
    }
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      this.renderer.dispose();
    }
    this.ready = false;
  }

  bindEvents() {
    const isTypingTarget = () => {
      const el = document.activeElement;
      return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };

    this._boundHandlers.keydown = (e) => {
      if (!this.active || isTypingTarget()) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") {
        // While pointer-locked the browser consumes Esc to unlock the mouse
        if (document.pointerLockElement) return;
        e.preventDefault();
        this.togglePause();
        return;
      }
      if (e.code === "KeyE") {
        e.preventDefault();
        if (!this.interact()) this.fireTongue();
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        this.jumpBuffer = 0.15;
        return;
      }
      if (e.code === "KeyQ" && !e.repeat) {
        this.camoTarget = this.camoTarget < 0.5 ? 1 : 0.22;
        return;
      }
      if (e.code === "ControlLeft" || e.code === "ControlRight") {
        this.crouching = true;
        return;
      }
      if (e.code === "F3" && !e.repeat) {
        e.preventDefault();
        if (this.collision) this.collision.toggleDebug();
        return;
      }
      this.keys.add(e.code);
    };

    this._boundHandlers.keyup = (e) => {
      if (e.code === "ControlLeft" || e.code === "ControlRight") this.crouching = false;
      this.keys.delete(e.code);
    };
    this._boundHandlers.blur = () => { this.keys.clear(); this.crouching = false; this.aiming = false; };
    this._boundHandlers.resize = () => { if (this.active) this.resize(); };

    window.addEventListener("keydown", this._boundHandlers.keydown);
    window.addEventListener("keyup", this._boundHandlers.keyup);
    window.addEventListener("blur", this._boundHandlers.blur);
    window.addEventListener("resize", this._boundHandlers.resize);

    // Mouse look via pointer lock; drag-orbit remains as the unlocked fallback
    this._boundHandlers.pointerdown = (e) => {
      if (e.button === 2) { this.aiming = true; return; }
      if (e.button !== 0) return;
      if (document.pointerLockElement === this.canvas) {
        this.fireTongue();
        return;
      }
      this.canvas.requestPointerLock?.();
      this.dragging = true;
      this._lastPointer = { x: e.clientX, y: e.clientY };
    };
    this._boundHandlers.pointermove = (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.cameraYaw -= e.movementX * 0.0024 * this.camSens;
        this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + e.movementY * 0.002 * this.camSens, -0.15, 0.85);
        return;
      }
      if (!this.dragging || !this._lastPointer) return;
      const dx = e.clientX - this._lastPointer.x;
      const dy = e.clientY - this._lastPointer.y;
      this._lastPointer = { x: e.clientX, y: e.clientY };
      this.cameraYaw -= dx * 0.006 * this.camSens;
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + dy * 0.004 * this.camSens, -0.15, 0.85);
    };
    this._boundHandlers.pointerup = (e) => {
      if (e.button === 2) this.aiming = false;
      this.dragging = false;
      this._lastPointer = null;
    };
    this._boundHandlers.contextmenu = (e) => e.preventDefault();
    this.canvas.addEventListener("pointerdown", this._boundHandlers.pointerdown);
    this.canvas.addEventListener("contextmenu", this._boundHandlers.contextmenu);
    window.addEventListener("pointermove", this._boundHandlers.pointermove);
    window.addEventListener("pointerup", this._boundHandlers.pointerup);

    const sensEl = document.getElementById("room3dSens");
    if (sensEl) {
      sensEl.value = String(Math.round(this.camSens * 100));
      this._boundHandlers.sens = () => {
        this.camSens = (parseFloat(sensEl.value) || 100) / 100;
        localStorage.setItem("arcade_cam_sens", String(this.camSens));
      };
      sensEl.addEventListener("input", this._boundHandlers.sens);
    }

    const pauseSensEl = document.getElementById("room3dSensPause");
    if (pauseSensEl) {
      pauseSensEl.value = String(Math.round(this.camSens * 100));
      this._boundHandlers.pauseSens = () => {
        this.camSens = (parseFloat(pauseSensEl.value) || 100) / 100;
        localStorage.setItem("arcade_cam_sens", String(this.camSens));
        const main = document.getElementById("room3dSens");
        if (main) main.value = pauseSensEl.value;
      };
      pauseSensEl.addEventListener("input", this._boundHandlers.pauseSens);
    }

    const resumeBtn = document.getElementById("btnPauseResume");
    if (resumeBtn) this._onClick(resumeBtn, () => this.togglePause(false));
    const settingsBtn = document.getElementById("btnPauseSettings");
    if (settingsBtn) this._onClick(settingsBtn, () => {
      this._settingsOpen = !this._settingsOpen;
      const row = document.getElementById("pauseSensRow");
      const qrow = document.getElementById("pauseQualityRow");
      if (row) row.hidden = !this._settingsOpen;
      if (qrow) qrow.hidden = !this._settingsOpen;
    });
    const qualityEl = document.getElementById("room3dQuality");
    if (qualityEl) {
      qualityEl.value = this.quality || "medium";
      this._onClick(qualityEl, () => this.applyQuality(qualityEl.value));
    }
    const leaveBtn = document.getElementById("btnPauseLeave");
    if (leaveBtn) this._onClick(leaveBtn, () => { this.togglePause(false); if (this.onExit) this.onExit(); });
  }

  _onClick(el, fn) {
    this._boundHandlers["click_" + el.id] = fn;
    el.addEventListener("click", fn);
  }

  /** Show / hide the pause menu; freezes input and the sim while open. */
  togglePause(force) {
    const want = force === undefined ? !this.paused : force;
    this.paused = want;
    if (this.pauseEl) this.pauseEl.hidden = !want;
    if (want) {
      this.keys.clear();
      this.crouching = false;
      this.aiming = false;
      if (document.pointerLockElement) document.exitPointerLock?.();
    } else if (this.canvas) {
      this.canvas.focus();
    }
    return want;
  }

  resize() {
    if (!this.renderer || !this.canvas) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;
    this.baseFov = this.fovForAspect(aspect);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  /** Keeps the horizontal field of view constant as the canvas gets narrower. */
  fovForAspect(aspect) {
    if (aspect >= BASE_ASPECT) return BASE_FOV;
    const halfHFov = Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) * BASE_ASPECT);
    const fov = (2 * Math.atan(Math.tan(halfHFov) / aspect) * 180) / Math.PI;
    return Math.min(90, fov);
  }

  // ------------------------------------------------------------------- per-frame

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.paused) {
      this.renderFrame();
      return;
    }
    // Fixed-timestep physics so movement is identical at any frame rate; the
    // camera is updated once afterwards from the settled position (no jitter).
    const FIXED = 1 / 120;
    this._physAcc = (this._physAcc || 0) + dt;
    let guard = 0;
    while (this._physAcc >= FIXED && guard < 8) {
      this.updateMovement(FIXED);
      this._physAcc -= FIXED;
      guard++;
    }
    if (guard >= 8) this._physAcc = 0;
    this.updateCamera(dt);
    this.updateInteraction();
    this.updateTongue(dt);
    this.updateCamo(dt);
    this.updateCharacterExtras(dt);
    this.updateLockOn(dt);
    this.updateAmbience(dt);
    if (this.decor) this.decor.update(dt, performance.now() / 1000);
    this.updateHudMeters();
    if (this.mixer) this.mixer.update(dt);
    this.renderFrame();
  }

  renderFrame() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  updateMovement(dt) {
    if (!this.character) return;

    let ix = 0;
    let iz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) iz += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) iz -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ix += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ix -= 1;

    const wantRun = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && !this.crouching;
    // Sprint drains stamina; once empty you must recover before sprinting again.
    const movingInput = (ix || iz) !== 0;
    if (wantRun && movingInput && this.stamina > 0) this.stamina = Math.max(0, this.stamina - dt * 0.32);
    else this.stamina = Math.min(1, this.stamina + dt * 0.22);
    const exhausted = this.stamina <= 0.02;
    const running = wantRun && !exhausted;
    const crouch = this.crouching && this.grounded;
    const maxSpeed = crouch ? WALK_SPEED * 0.45 : (running ? RUN_SPEED : WALK_SPEED);
    const targetSpeed = (ix || iz) ? maxSpeed : 0;

    const yaw = this.cameraYaw;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const desired = new THREE.Vector3()
      .addScaledVector(forward, iz)
      .addScaledVector(right, ix);
    if (desired.lengthSq() > 1e-6) desired.normalize().multiplyScalar(targetSpeed);

    // Exponential accel / friction: snappy start, no sliding stop
    const rate = (ix || iz) ? (running ? ACCEL_RUN : ACCEL_WALK) : FRICTION;
    this.velocity.lerp(desired, 1 - Math.exp(-rate * dt));
    if (this.velocity.lengthSq() < 1e-4) this.velocity.set(0, 0, 0);

    const pos = this.character.position;
    // Horizontal move resolved against the collision world (per-axis, sub-stepped).
    if (this.collision) {
      const delta = new THREE.Vector3(this.velocity.x * dt, 0, this.velocity.z * dt);
      this.collision.move(pos, delta, 0.4, this.vertY, this.vertY + (crouch ? 0.8 : 1.2));
    } else {
      pos.addScaledVector(this.velocity, dt);
    }

    // Vertical physics: buffered jump + coyote time, gravity, landing
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.grounded) this.coyote = 0.12;
    else if (this.coyote > 0) this.coyote -= dt;
    if (this.jumpBuffer > 0 && this.coyote > 0 && !crouch) {
      this.vertVel = JUMP_VELOCITY;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
    }
    // Walkable ground under the player (the dance floor is a raised platform).
    const ground = this.groundHeightAt(pos.x, pos.z);
    if (this.grounded) {
      if (ground > this.vertY && ground - this.vertY <= 0.45) this.vertY = ground;   // step up
      else if (ground < this.vertY - 0.02) { this.grounded = false; this.vertVel = 0; } // walked off an edge
    }
    if (!this.grounded) {
      this.vertVel -= GRAVITY * dt;
      this.vertY += this.vertVel * dt;
      if (this.vertY <= ground) {
        if (this.vertVel < -3) this.landTimer = 0.26;
        this.vertY = ground;
        this.vertVel = 0;
        this.grounded = true;
      }
    }
    if (this.landTimer > 0) this.landTimer -= dt;
    pos.y = this.vertY;

    // Stay inside the room (cheap backstop; the perimeter colliders are primary)
    pos.x = THREE.MathUtils.clamp(pos.x, -this.bounds.x, this.bounds.x);
    pos.z = THREE.MathUtils.clamp(pos.z, -this.bounds.z + 0.9, this.bounds.z);

    const speed = this.velocity.length();
    let turnDelta = 0;
    if (speed > 0.05) {
      const moveDir = this.velocity.clone().normalize();
      const targetYaw = Math.atan2(moveDir.x, -moveDir.z);
      turnDelta = shortestAngle(this.charYaw, targetYaw);
      this.charYaw += turnDelta * Math.min(1, TURN_RATE * dt);
    }
    this.character.rotation.y = this.forwardAlpha - this.charYaw;

    // Bank into turns, lean forward when sprinting, tuck on jump / brace on land
    const leanTarget = THREE.MathUtils.clamp(-turnDelta * 0.55, -0.3, 0.3) * Math.min(1, speed / WALK_SPEED);
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 8);
    let pitchTarget = running && speed > WALK_SPEED * 0.8 ? 0.14 : 0;
    if (!this.grounded) pitchTarget = this.vertVel > 0 ? -0.16 : 0.12;
    else if (this.landTimer > 0) pitchTarget = 0.22;
    this.runLean += (pitchTarget - this.runLean) * Math.min(1, dt * 8);
    if (this.model) {
      this.model.rotation.z = this.lean;
      this.model.rotation.x = this.runLean;
    }

    this.updateAnimation(speed, running, dt);
  }

  updateAnimation(speed, running, dt) {
    const moving = speed > 0.2;
    const crouch = this.crouching && this.grounded;

    let state;
    if (!this.grounded) state = this.vertVel > 0.5 ? "jump" : "fall";
    else if (this.landTimer > 0) state = "land";
    else if (crouch) state = moving ? "crouchwalk" : "crouch";
    else if (!moving) state = "idle";
    else if (speed > RUN_SPEED * 0.92) state = "sprint";
    else if (speed > WALK_SPEED * 0.92) state = "run";
    else state = "walk";
    this.moveState = state;

    // Target blend weights per state, then crossfade smoothly
    const w = { walk: 0, idle: 0, crouch: 0 };
    switch (state) {
      case "walk": w.walk = 1; break;
      case "run": w.walk = 1; break;
      case "sprint": w.walk = 1; break;
      case "crouchwalk": w.crouch = 0.65; w.walk = 0.5; break;
      case "crouch": case "land": w.crouch = 1; break;
      case "jump": case "fall": w.walk = Math.min(1, speed / RUN_SPEED + 0.25); w.idle = 0.35; break;
      default: w.idle = 1;
    }
    if (!this.crouchAction) { w.walk += w.crouch; w.crouch = 0; }
    if (!this.idleAction) { w.walk += w.idle; w.idle = 0; }
    if (!this.walkAction) { w.idle += w.walk; w.walk = 0; }

    const blend = Math.min(1, dt * 12);
    if (this.walkAction) {
      this.walkAction.setEffectiveWeight(this.walkAction.getEffectiveWeight() + (w.walk - this.walkAction.getEffectiveWeight()) * blend);
      const cycle = this.walkCycleSpeed ? THREE.MathUtils.clamp(speed / this.walkCycleSpeed, 0.4, 3.2) : 1;
      this.walkAction.timeScale = cycle * (state === "crouchwalk" ? 0.6 : 1);
    }
    if (this.idleAction) {
      this.idleAction.setEffectiveWeight(this.idleAction.getEffectiveWeight() + (w.idle - this.idleAction.getEffectiveWeight()) * blend);
    }
    if (this.crouchAction) {
      this.crouchAction.setEffectiveWeight(this.crouchAction.getEffectiveWeight() + (w.crouch - this.crouchAction.getEffectiveWeight()) * blend);
    }
    this.animState = state;

    // Landing squash: dip the whole character and recover
    if (this.character) {
      const squash = this.landTimer > 0 ? 0.9 : 1;
      this.character.scale.y += (squash - this.character.scale.y) * Math.min(1, dt * 14);
    }

    // Rigs without clips get procedural locomotion: stride bob while moving,
    // breathing bob while standing.
    if (this.model && (!this.walkAction || !moving)) {
      const t = performance.now() / 1000;
      const bob = moving && !this.walkAction
        ? Math.abs(Math.sin(t * 9)) * 0.05 * Math.min(1, speed / WALK_SPEED)
        : Math.sin(t * 2.1) * 0.012;
      this.model.position.y = this.modelBaseY + bob;
    }
    if (this.model && moving && !this.walkAction && dt) {
      this.model.rotation.y = Math.sin(performance.now() / 1000 * 9) * 0.06;
    }
  }

  updateCamera(dt) {
    if (!this.character) return;
    const speed = this.velocity.length();

    // RMB lock-on: swing the camera behind the line to the nearest cabinet
    if (this.aiming && this.aimTarget) {
      const dx = this.aimTarget.position.x - this.character.position.x;
      const dz = this.aimTarget.position.z - this.character.position.z;
      if (Math.hypot(dx, dz) < 16) {
        const wantYaw = Math.atan2(dx, dz);
        this.cameraYaw += shortestAngle(this.cameraYaw, wantYaw) * Math.min(1, dt * 6);
      }
    }

    const aim = this.aiming && this.aimTarget;
    const height = this.charHeight * 1.32 + this.cameraPitch * 3.4 + this.vertY * 0.55;
    const yaw = this.cameraYaw;
    const look = this.character.position.clone().addScaledVector(this.velocity, 0.3);
    const headY = this.character.position.y + this.charHeight * 0.82;
    const origin = new THREE.Vector3(look.x, headY, look.z);
    let dist = (aim ? 4.6 : 6.1) + speed * 0.42;
    // Pull the camera in when a wall sits between it and the player.
    if (this.collision) {
      const probe = new THREE.Vector3(
        origin.x + Math.sin(yaw) * dist,
        height,
        origin.z + Math.cos(yaw) * dist
      );
      dist = Math.min(dist, this.collision.distanceToWall(origin, probe, 0.35));
    }
    const target = new THREE.Vector3(
      look.x + Math.sin(yaw) * dist,
      height,
      look.z + Math.cos(yaw) * dist
    );
    // Keep the camera inside the room shell so it never sinks into a wall
    const mx = this.bounds.x - 0.7;
    const mz = this.bounds.z - 0.7;
    target.x = THREE.MathUtils.clamp(target.x, -mx, mx);
    target.z = THREE.MathUtils.clamp(target.z, -mz, mz);

    // Critically-damped spring follow
    this.camera.position.lerp(target, 1 - Math.exp(-7.5 * dt));
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -mx, mx);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -mz, mz);

    this._lookAt = this._lookAt || this.character.position.clone();
    const want = new THREE.Vector3(look.x, this.character.position.y + this.charHeight * 0.82, look.z);
    this._lookAt.lerp(want, 1 - Math.exp(-9 * dt));
    this.camera.lookAt(this._lookAt);

    // Sprint FOV kick, tightened while aiming
    const kick = aim ? -5 : Math.min(6, speed * 0.85);
    const wantFov = Math.min(92, (this.baseFov || BASE_FOV) + kick);
    if (Math.abs(this.camera.fov - wantFov) > 0.02) {
      this.camera.fov += (wantFov - this.camera.fov) * Math.min(1, dt * 5);
      this.camera.updateProjectionMatrix();
    }
  }

  updateInteraction() {
    let best = null;
    let bestDist = Infinity;
    this.cabinetSpots.forEach(spot => {
      const d = Math.hypot(
        this.character.position.x - spot.position.x,
        this.character.position.z - spot.position.z
      );
      if (d < bestDist) { bestDist = d; best = spot; }
    });

    // Closest cabinet regardless of range — used for RMB lock-on aiming
    this.aimTarget = best;

    if (best && bestDist <= INTERACT_DISTANCE) {
      if (this.nearest !== best) {
        this.nearest = best;
        if (this.promptRoundEl) this.promptRoundEl.textContent = "ROUND " + best.round + " / 5";
        if (this.promptNameEl) this.promptNameEl.textContent = best.name;
        if (this.promptEl) {
          this.promptEl.style.setProperty("--prompt-color", "#" + new THREE.Color(best.color).getHexString());
          this.promptEl.classList.add("visible");
        }
      }
    } else if (this.nearest) {
      this.nearest = null;
      if (this.promptEl) this.promptEl.classList.remove("visible");
    }
  }

  updateAmbience(dt) {
    const t = performance.now() / 1000;
    if (this.filmPass) this.filmPass.uniforms.uTime.value = t;
    this._screenTick = (this._screenTick || 0) + dt;
    const redrawScreens = this._screenTick > 1 / 15;
    if (redrawScreens) this._screenTick = 0;

    if (this.glowParts) {
      this.glowParts.forEach(g => {
        g.mat.emissiveIntensity =
          g.base * (0.8 + 0.3 * Math.sin(t * 3.1 + g.phase)) * (0.3 + 0.7 * this.camo);
      });
    }

    this.cabinetSpots.forEach(spot => {
      const pulse = spot.holder.userData.pulse;
      if (!pulse) return;
      const glow = 0.55 + Math.sin(t * 2 + pulse.phase) * 0.2;
      pulse.ring.material.opacity = spot === this.nearest ? 0.95 : glow * 0.7;
      pulse.light.intensity = pulse.base * (spot === this.nearest ? 1.6 : glow + 0.4);
      if (redrawScreens && pulse.screen) this.drawAttractScreen(pulse.screen, t);
    });
  }

  interact() {
    if (!this.nearest) return false;
    const round = this.nearest.round;
    if (this.onLaunchRound) this.onLaunchRound(round);
    return true;
  }

  // ------------------------------------------------------------------- tongue + camo

  ensureTongue() {
    if (this.tongueMesh) return this.tongueMesh;
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff2bd6,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 1, 8, 1, true), mat);
    shaft.rotation.x = Math.PI / 2; // axis along +Z
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat);
    const group = new THREE.Group();
    group.add(shaft, tip);
    group.visible = false;
    this.tongueMat = mat;
    this.tongueShaft = shaft;
    this.tongueTip = tip;
    this.tongueMesh = group;
    this.scene.add(group);
    return group;
  }

  fireTongue() {
    if (!this.character || this.tongueT >= 0 || this.tongueCooldown > 0) return;
    this.ensureTongue();
    this.tongueT = 0;
    this.tongueCooldown = 0.6;
    this.tongueHitDone = false;
  }

  updateTongue(dt) {
    if (this.tongueCooldown > 0) this.tongueCooldown -= dt;
    if (this.tongueT < 0 || !this.tongueMesh) return;
    const DUR = 0.34;
    this.tongueT += dt;
    const p = this.tongueT / DUR;
    if (p >= 1) {
      this.tongueT = -1;
      this.tongueMesh.visible = false;
      return;
    }
    const ext = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
    const len = Math.max(0.02, ext * TONGUE_RANGE);
    const yaw = this.charYaw;
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const origin = this.character.position.clone();
    origin.y += this.charHeight * 0.62 + this.vertY;

    // Raycast hit detection at full extension (once per shot)
    if (!this.tongueHitDone && p >= 0.45) {
      this.tongueHitDone = true;
      this.tongueHit = this.raycastTongue(origin, dir);
    }

    const g = this.tongueMesh;
    g.visible = true;
    g.position.copy(origin);
    g.lookAt(origin.clone().add(dir));
    this.tongueShaft.scale.set(1, 1, len);
    this.tongueShaft.position.z = len / 2;
    this.tongueTip.position.z = len;
    this.tongueMat.opacity = 0.55 + 0.45 * ext;
    if (this.tongueHit) this.tongueMat.color.setHex(0x39ff14);
    else this.tongueMat.color.setHex(0xff2bd6);
  }

  /** Returns the cabinet spot the tongue ray connects with, or null. */
  raycastTongue(origin, dir) {
    if (!this._tongueRay) this._tongueRay = new THREE.Raycaster();
    this._tongueRay.set(origin, dir.clone().normalize());
    this._tongueRay.far = TONGUE_RANGE;
    const targets = [];
    this.cabinetSpots.forEach(s => { if (s.holder) targets.push(s.holder); });
    const hits = this._tongueRay.intersectObjects(targets, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj && !this.cabinetSpots.some(s => s.holder === obj)) obj = obj.parent;
    return this.cabinetSpots.find(s => s.holder === obj) || null;
  }

  updateCamo(dt) {
    const target = this.camoTarget;
    if (Math.abs(this.camo - target) < 0.002) this.camo = target;
    else this.camo += (target - this.camo) * Math.min(1, dt * 6);
    if (!this.camoMats || !this.camoMats.length) return;
    const o = this.camo;
    const transparent = o < 0.999;
    // Blend toward the neon colour of the surface/light beneath the player.
    const surface = this.surfaceColorBeneath();
    const t = performance.now() / 1000;
    const shimmer = transparent ? 0.86 + 0.14 * Math.sin(t * 18) : 1;
    this.camoMats.forEach(m => {
      if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
      m.transparent = transparent;
      m.opacity = o * shimmer;
      m.depthWrite = !transparent;
      if (m.color && m.userData.baseColor) {
        m.color.copy(m.userData.baseColor).lerp(surface, (1 - o) * 0.75);
      }
    });
  }

  /** Neon colour of the nearest cabinet / accent light under the player. */
  surfaceColorBeneath() {
    if (!this._surfaceColor) this._surfaceColor = new THREE.Color(0x00e5ff);
    let best = null;
    let bestD = Infinity;
    this.cabinetSpots.forEach(s => {
      const d = Math.hypot(this.character.position.x - s.position.x, this.character.position.z - s.position.z);
      if (d < bestD) { bestD = d; best = s; }
    });
    const hex = best && bestD < 6 ? best.color : 0x00e5ff;
    this._surfaceColor.setHex(hex);
    // Standing on the dance floor? Blend into whichever tile is lit underfoot.
    const floorColor = this.decor && this.decor.colorAt(this.character.position.x, this.character.position.z);
    if (floorColor) this._surfaceColor.copy(floorColor);
    return this._surfaceColor;
  }

  /** RMB lock-on: park a spinning reticle ring on the aimed cabinet. */
  updateLockOn(dt) {
    if (!this.lockRing) return;
    const on = this.aiming && this.aimTarget;
    this.lockRing.visible = !!on;
    if (!on) return;
    const s = this.aimTarget;
    this.lockRing.position.set(s.position.x, 1.4, s.position.z);
    this.lockRing.rotation.z += dt * 2.2;
    this.lockRing.rotation.x = Math.PI / 2;
    this.lockRing.material.color.setHex(s.color);
  }

  /** Reflect sprint stamina and camo state in the on-screen meters. */
  updateHudMeters() {
    if (this.staminaEl) this.staminaEl.style.width = Math.round(this.stamina * 100) + "%";
    if (this.camoMeterEl) {
      const camoOn = this.camoTarget < 0.5;
      const ready = this.tongueCooldown <= 0;
      this.camoMeterEl.style.width = (camoOn ? 100 : Math.round(this.camo * 100)) + "%";
      this.camoMeterEl.style.opacity = ready ? "1" : "0.4";
    }
  }

  /**
   * Quality tiers trade resolution + post-processing + accent lights for FPS.
   * LOW is the safety net for weak integrated GPUs on event day.
   */
  applyQuality(q) {
    this.quality = q;
    localStorage.setItem("arcade_quality", q);
    const dpr = window.devicePixelRatio || 1;
    if (q === "low") {
      this.renderer.setPixelRatio(1);
      if (this.bloomPass) this.bloomPass.enabled = false;
      if (this.filmPass) this.filmPass.enabled = false;
      (this.accentLights || []).forEach(l => { l.visible = false; });
    } else if (q === "high") {
      this.renderer.setPixelRatio(Math.min(dpr, 2));
      if (this.bloomPass) this.bloomPass.enabled = true;
      if (this.filmPass) this.filmPass.enabled = true;
      (this.accentLights || []).forEach(l => { l.visible = true; });
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
      if (this.bloomPass) this.bloomPass.enabled = true;
      if (this.filmPass) this.filmPass.enabled = true;
      (this.accentLights || []).forEach(l => { l.visible = true; });
    }
    if (this.decor) this.decor.setQuality(q);
    this.resize();
  }

  // ------------------------------------------------------------------- plumbing

  setProgress(ratio, note) {
    if (this.progressBarEl) this.progressBarEl.style.width = Math.round(ratio * 100) + "%";
    if (this.loadingNoteEl && note) this.loadingNoteEl.textContent = note;
  }

  showError(message) {
    if (this.errorEl) {
      this.errorEl.hidden = false;
      this.errorEl.textContent = message;
    }
  }

  /** Snapshot used for automated verification. */
  getDebugState() {
    const facing = this.model
      ? this.forwardOffsetDir.clone().applyAxisAngle(UP, this.character.rotation.y).normalize()
      : null;
    return {
      ready: this.ready,
      active: this.active,
      roomSource: this.roomSource,
      fighter: this.fighter.id,
      machines: this.cabinetSpots.map(s => s.machine),
      cabinets: this.cabinetSpots.length,
      hasCharacter: Boolean(this.character),
      animation: this.animState,
      moveState: this.moveState,
      grounded: this.grounded,
      vertY: +this.vertY.toFixed(3),
      camo: +this.camo.toFixed(3),
      aiming: this.aiming,
      tongue: this.tongueT >= 0,
      walkClip: this.walkAction ? this.walkAction.getClip().name : null,
      idleClip: this.idleAction ? this.idleAction.getClip().name : null,
      bloom: Boolean(this.composer),
      position: this.character ? [+this.character.position.x.toFixed(3), +this.character.position.z.toFixed(3)] : null,
      velocity: [+this.velocity.x.toFixed(3), +this.velocity.z.toFixed(3)],
      speed: +this.velocity.length().toFixed(3),
      facing: facing ? [+facing.x.toFixed(3), +facing.z.toFixed(3)] : null,
      camera: [+this.camera.position.x.toFixed(2), +this.camera.position.y.toFixed(2), +this.camera.position.z.toFixed(2)],
      fov: +this.camera.fov.toFixed(1),
      nearest: this.nearest ? { round: this.nearest.round, name: this.nearest.name } : null,
      bounds: this.bounds,
      drawCalls: this.renderer ? this.renderer.info.render.calls : null,
      triangles: this.renderer ? this.renderer.info.render.triangles : null
    };
  }
}
