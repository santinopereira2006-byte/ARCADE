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
import { simplifyTree, mergeMeshesByMaterial, mergeStatic, textureIsOpaque } from "./optimize.js";
import { LeaderboardManager } from "../leaderboard.js";
import { state } from "../state.js";

const ROOM_URL = "models/room-blank/source/Room%20house.gltf";

const MACHINE_MODELS = [
  // `forward` = the model's authored screen-facing direction in XZ, measured
  // from yaw-sweep contact sheets (only the pixel rig names its screen node).
  { id: "pixel", url: "models/arcade_machine_-_pixel-art_low-poly/scene.gltf", forward: [0, 1] },
  { id: "cabA", url: "models/arcade_machine/scene.gltf", forward: [-0.423, 0.906] }
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
const WALK_SPEED = 2.8;
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

// Dynamic resolution: the renderer starts at `start` and keeps the frame rate
// smooth by trading resolution (never gameplay) between `min` and `max`.
const RES_TIERS = {
  low: { start: 0.85, min: 0.5, max: 1.0 },
  medium: { start: 0.95, min: 0.6, max: 1.0 },
  high: { start: 1.0, min: 0.7, max: 1.0 }
};
const FPS_CAP = 30;            // the game renders at most this many frames per second
const TARGET_FPS = FPS_CAP;    // what "smooth" means for the adaptive resolution
const MAX_PHYS_STEP = 1 / 50;  // longest single physics step (s); frames are split evenly

const CABINETS = [
  // The two cabinet models in /models, alternating around the ring.
  { round: 1, name: "SCALE WARS", color: 0x00e5ff, machine: 0 },
  { round: 2, name: "CTRL+ALT+GUESS", color: 0xff2bd6, machine: 1 },
  { round: 3, name: "TECH MEME BATTLE", color: 0xa855f7, machine: 0 },
  { round: 4, name: "BLACKOUT CODE", color: 0x39ff14, machine: 1 },
  { round: 5, name: "RETRO BLAST", color: 0xffe600, machine: 0 }
];

// The five round cabinets ring the dance floor (left, back-left, back,
// back-right, right), each facing the centre; the front stays open.
const CABINET_ANGLES = [-90, -150, 180, 150, 90];  // back pair kept clear of the room's partition walls
const CABINET_RING = 6.6;          // metres from the centre of the dance floor
const SPAWN = { x: 0, z: 8.2 };    // front of the arena, looking at the dance floor

const UP = new THREE.Vector3(0, 1, 0);

// Reusable scratch vectors to avoid per-frame GC allocations in tick()
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _camWant = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _deltaMove = new THREE.Vector3();
const _sphere = new THREE.Sphere();

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
    this.cabinetLights = [];
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
    // Quality setting: strictly defaults to Low for smooth, ultra-fast loading on all machines,
    // but fully respects manual user selection in the pause menu if explicitly changed.
    const savedQuality = localStorage.getItem("arcade_quality");
    this.manualQuality = localStorage.getItem("arcade_manual_quality") === "true";
    this.quality = (this.manualQuality && savedQuality) ? savedQuality : "low";
    this.resScale = (RES_TIERS[this.quality] || RES_TIERS.low).start;

    // FPS counter (toggle with F) + frame pacing + adaptive resolution state
    this.fpsEl = document.getElementById("room3dFps");
    this.showFps = localStorage.getItem("arcade_show_fps") !== "false";
    this._perf = { frames: 0, since: 0, lastText: "" };
    this._pace = { samples: [], skip: 1, count: 0, detected: false, last: 0 };
    this.resetAdaptive();
    this._frustum = new THREE.Frustum();
    this._pv = new THREE.Matrix4();
  }

  /**
   * Sniffs the WebGL renderer string to detect integrated / low-end GPUs.
   * Defaults to "low" for guaranteed performance on low-end hardware.
   */
  static _detectDefaultQuality() {
    return "low";
  }

  async init(onLaunchRound, onExit) {
    this.onLaunchRound = onLaunchRound;
    this.onExit = onExit;

    if (!this.canvas) throw new Error("room3dCanvas missing from index.html");

    if (this.loadingEl) this.loadingEl.classList.remove("hidden");

    if (document.fonts && document.fonts.load) {
      Promise.all(["900 32px Orbitron", "700 24px Orbitron", "700 16px 'JetBrains Mono'"].map(f => document.fonts.load(f)))
        .then(() => this.refreshFontDependent())
        .catch(() => { /* system fonts are fine */ });
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: "high-performance"
    });
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = this.quality === "low" ? THREE.LinearToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070d);
    this.scene.fog = new THREE.Fog(0x05070d, 12, 32);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
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
    this.createBlobShadow();
    this.setProgress(0.85, "Dropping the dance floor…");
    await this.loadDecor();
    // Snap character to the real floor now that decor (and its floorY) is loaded.
    if (this.character) {
      const spawnGround = this.groundHeightAt(this.character.position.x, this.character.position.z);
      this.character.position.y = spawnGround;
      this.vertY = spawnGround;
      this.grounded = true;
    }
    this.buildCollision();
    this.initComposer();

    this.bindEvents();
    this.resize();
    requestAnimationFrame(() => this.resize());
    this.applyQuality(this.quality);
    this.applyFpsVisibility();
    this.primeScreens();
    this.warmUp();
    this.ready = true;
    this.setProgress(1, "DIMENSIONAL BREACH ACHIEVED — ENTERING MECHA WORLD");
    if (this.loadingEl) {
      setTimeout(() => {
        // Trigger dramatic scale-up zoom into the mecha world
        this.loadingEl.classList.add("warp-out");
        setTimeout(() => {
          this.loadingEl.classList.add("hidden");
          this.loadingEl.classList.remove("warp-out");
        }, 850);
      }, 350);
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

  /** Canvas textures bake their text at draw time: redo them once the game fonts are really loaded. */
  refreshFontDependent() {
    this._fontEpoch = (this._fontEpoch || 0) + 1;
    this.cabinetSpots.forEach(spot => {
      const label = spot.holder.userData.label;
      const cfg = CABINETS.find(c => c.round === spot.round);
      if (!label || !cfg) return;
      const old = label.material.map;
      label.material.map = this.makeLabelTexture(cfg, new THREE.Color(cfg.color));
      label.material.needsUpdate = true;
      if (old) old.dispose();
    });
  }

  /** Paint every cabinet screen once so none is blank the first time it comes into view. */
  primeScreens() {
    const next = state.getNextAvailableRound();
    this.cabinetSpots.forEach(spot => {
      const screen = spot.holder.userData.pulse && spot.holder.userData.pulse.screen;
      if (!screen) return;
      this.drawAttractScreen(screen, 0, next);
      screen.lastDraw = 0;
      screen.sig = (state.isRoundCompleted(screen.round) ? "c" : "-") + (state.roundScores[screen.round] || 0) + "|" + next;
    });
  }

  /**
   * Compile every shader and upload every texture up front (including objects
   * that are off-camera right now) so turning around never stalls a frame.
   */
  warmUp() {
    try {
      this.renderer.compile(this.scene, this.camera);
      this.scene.traverse(node => {
        const mats = Array.isArray(node.material) ? node.material : (node.material ? [node.material] : []);
        mats.forEach(m => {
          ["map", "emissiveMap", "alphaMap"].forEach(k => {
            if (m[k] && m[k].isTexture) this.renderer.initTexture(m[k]);
          });
        });
      });
    } catch (err) {
      console.warn("Shader warm-up skipped:", err);
    }
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
      if (spot.holder) this.collision.addBox(this.cabinetColliderBox(spot.holder), "cabinet");
    });
    (this.scenerySolids || []).forEach(obj => this.collision.addFromObject(obj, "scenery"));
    if (this.decor) this.decor.solidBoxes.forEach(box => this.collision.addBox(box.clone(), "arena"));
    this.collision.buildDebug();
  }

  /**
   * Collider of one round cabinet: its model, marquee and screen plus the neon ring on
   * the floor in front (that footprint is what keeps players a comfortable step back).
   * The soft glow quad around the ring is purely visual and must not grow the collider.
   */
  cabinetColliderBox(holder) {
    holder.updateMatrixWorld(true);
    const pulse = holder.userData.pulse;
    const ring = pulse && pulse.ring;
    const box = new THREE.Box3();
    holder.children.forEach(child => { if (child !== ring) box.expandByObject(child); });
    if (ring) {
      const c = ring.getWorldPosition(new THREE.Vector3());
      const R = CABINET_HEIGHT * 0.42;                 // outer radius of the original ring
      box.expandByPoint(_v1.set(c.x - R, c.y, c.z - R));
      box.expandByPoint(_v1.set(c.x + R, c.y, c.z + R));
    }
    return box;
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
        quality: this.quality,
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

  createBlobShadow() {
    if (this.blobShadow) return;
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0, 0, 0, 0.7)");
    g.addColorStop(0.5, "rgba(0, 0, 0, 0.35)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);

    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1.0, 1.0);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(geo, mat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    this.scene.add(shadow);
    this.blobShadow = shadow;
  }

  /**
   * Make imported models cheap to draw:
   *  - glass "transmission" is flattened on every tier (it makes three.js render
   *    the whole scene a second time each frame),
   *  - on Low every PBR material becomes plain Lambert (no specular / env / normal maps),
   *  - alpha-blended materials whose texture is fully opaque are drawn opaque
   *    (no blending, no sorting),
   *  - mipmaps stay ON: they are faster to sample and stop textures shimmering.
   */
  optimizeMaterials(root) {
    if (!root) return;
    const low = this.quality === "low";
    simplifyTree(root, { lambert: low });
    root.traverse(node => {
      if (!node.isMesh || !node.material) return;
      node.frustumCulled = true;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(m => {
        if (low) {
          m.envMap = null;
          m.normalMap = null;
          m.roughnessMap = null;
          m.metalnessMap = null;
          ["map", "emissiveMap"].forEach(key => { if (m[key] && m[key].isTexture) m[key].anisotropy = 1; });
        }
        if (m.transparent && m.opacity === 1 && m.map && !m.alphaMap && !m.alphaTest && textureIsOpaque(m.map)) {
          m.transparent = false;
          m.depthWrite = true;
        }
      });
    });
  }

  groundHeightAt(x, z) {
    return this.decor ? this.decor.groundHeightAt(x, z) : 0;
  }

  /** Height of the room model's walkable floor at the centre (it sits a little above y=0). */
  measureFloorY() {
    if (!this.room) return 0;
    // Cast from OUTSIDE the dance floor zone (half-size 4.55 m) so we hit the
    // room's actual floor, not any raised platform that might load first.
    const probes = [
      new THREE.Vector3(0, 3, 7),    // near front wall, clear of dance floor
      new THREE.Vector3(7, 3, 0),    // side wall area
      new THREE.Vector3(-7, 3, 0),   // opposite side
      new THREE.Vector3(0, 3, -7),   // back wall area
      new THREE.Vector3(0.2, 2, 0.2) // legacy centre fallback
    ];
    const dir = new THREE.Vector3(0, -1, 0);
    for (const origin of probes) {
      const ray = new THREE.Raycaster(origin, dir, 0, 5);
      const hit = ray.intersectObject(this.room, true).find(h => h.point.y < 0.5);
      if (hit) return hit.point.y + 0.004;
    }
    return 0;
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
    if (this.quality === "low") return;
    const geo = new THREE.PlaneGeometry(this.bounds.x * 2 + 2, this.bounds.z * 2 + 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0e1c,
      roughness: 0.45,
      metalness: 0.5,
      envMap: this.quality === "high" ? (this.envTexture || null) : null,
      envMapIntensity: 0.5
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
      this.optimizeMaterials(room);
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
    // Both cabinet models load on every quality tier; each prototype is loaded
    // once and cloned (geometry and textures are shared) for every cabinet using it.
    const loadedPrototypes = await Promise.all(MACHINE_MODELS.map(async (cfg) => {
      try {
        const gltf = await this.loadGltf(cfg.url);
        return this.prepareMachinePrototype(this.slimMachine(gltf.scene), cfg);
      } catch (err) {
        console.warn("Cabinet model " + cfg.id + " failed, using neon stand-in:", err);
        return this.prepareMachinePrototype(this.buildFallbackCabinet(), cfg);
      }
    }));
    const prototypes = loadedPrototypes;
    this.machinePrototypes = prototypes;

    const ringX = Math.min(CABINET_RING, this.bounds.x - 1.2);
    const ringZ = Math.min(CABINET_RING, this.bounds.z - 1.2);

    CABINETS.forEach((cfg, i) => {
      const proto = prototypes[cfg.machine] || prototypes[0];
      const cab = proto.root.clone(true);
      cab.scale.setScalar(proto.scale);
      this.optimizeMaterials(cab);

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

  /**
   * Arcade cabinet models ship as ~12 separate meshes (body, glare, 8 button
   * decals, ...). Flatten their materials and merge them to one mesh per
   * material, so each of the 9 cabinets costs ~4 draw calls instead of ~12.
   * Falls back to the untouched model if it cannot be merged safely.
   */
  slimMachine(scene) {
    try {
      this.optimizeMaterials(scene);
      const merged = mergeMeshesByMaterial(scene);
      if (merged) return merged;
    } catch (err) {
      console.warn("Cabinet merge skipped:", err);
    }
    return scene;
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
    holder.userData.label = label;

    // Animated attract-mode screen floating on the cabinet's front face
    const screen = this.makeAttractScreen(cfg, color);
    screen.mesh.position.set(fwd.x * (proto.frontExt + 0.04), CABINET_HEIGHT * 0.62, fwd.z * (proto.frontExt + 0.04));
    screen.mesh.rotation.y = label.rotation.y;
    holder.add(screen.mesh);

    // Neon halo on the floor in front of the cabinet: a glowing ring with a soft
    // light pool around it. One textured quad (shared texture + geometry) fakes
    // the pool of light a real PointLight would cast, at no per-pixel lighting cost.
    if (!this._haloTex) this._haloTex = this.makeHaloTexture();
    if (!this._haloGeo) this._haloGeo = new THREE.PlaneGeometry(CABINET_HEIGHT * 1.55, CABINET_HEIGHT * 1.55);
    const ring = new THREE.Mesh(
      this._haloGeo,
      new THREE.MeshBasicMaterial({ color, map: this._haloTex, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(fwd.x * (CABINET_HEIGHT * 0.55), 0.03, fwd.z * (CABINET_HEIGHT * 0.55));
    holder.add(ring);

    const light = new THREE.PointLight(color, 5.5, 9, 2);
    light.position.set(fwd.x * 1.2, CABINET_HEIGHT * 0.75, fwd.z * 1.2);
    if (this.quality === "low") light.visible = false;
    holder.add(light);
    if (!this.cabinetLights) this.cabinetLights = [];
    this.cabinetLights.push(light);

    holder.userData.pulse = { ring, light, base: 5.5, phase: cfg.round * 0.7, screen };
  }

  /** White ring + soft radial glow; tinted per cabinet by the material colour. */
  makeHaloTexture() {
    const S = 128;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    [[0, 0.1], [0.3, 0.14], [0.42, 0.3], [0.455, 0.95], [0.49, 1], [0.525, 0.95], [0.56, 0.35], [0.7, 0.14], [1, 0]]
      .forEach(([stop, a]) => g.addColorStop(stop, `rgba(255,255,255,${a})`));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Canvas-textured plane that plays a looping attract-mode animation per round. */
  makeAttractScreen(cfg, color) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 192;
    const ctx = c.getContext("2d");
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;               // redrawn live: skip mip generation on every upload
    tex.minFilter = THREE.LinearFilter;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CABINET_HEIGHT * 0.52, CABINET_HEIGHT * 0.39),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    // Static layer (titles / status text) is cached on its own canvas and only
    // re-rendered when the round state changes; the live canvas just blits it.
    const layer = document.createElement("canvas");
    layer.width = c.width;
    layer.height = c.height;
    return {
      mesh, ctx, tex, color, hex: "#" + color.getHexString(), phase: cfg.round * 1.3, round: cfg.round, name: cfg.name,
      layer, layerCtx: layer.getContext("2d"), layerKey: "", lastDraw: -1
    };
  }

  /** Round status of one cabinet screen: drives colours, text and the cache key. */
  screenStatus(s, nextRound = state.getNextAvailableRound()) {
    const isCompleted = state.isRoundCompleted(s.round);
    const isNext = !isCompleted && s.round === nextRound;
    const isLocked = !isCompleted && s.round > nextRound;
    return {
      isCompleted, isNext, isLocked, nextRound,
      score: state.roundScores[s.round] || 0,
      hex: isCompleted ? "#10b981" : (isLocked ? "#475569" : s.hex)
    };
  }

  /** Static text layer of a cabinet screen. Rebuilt only when the round status (or the game font) changes. */
  buildScreenLayer(s, st) {
    const ctx = s.layerCtx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.fillStyle = st.hex;
    ctx.font = "900 32px Orbitron, 'Segoe UI', sans-serif";
    ctx.fillText("ROUND " + s.round, w / 2, 46);

    ctx.fillStyle = "#ffffff";
    let fs = 24;
    ctx.font = `700 ${fs}px Orbitron, 'Segoe UI', sans-serif`;
    while (ctx.measureText(s.name).width > w - 24 && fs > 12) {
      fs -= 2;
      ctx.font = `700 ${fs}px Orbitron, 'Segoe UI', sans-serif`;
    }
    ctx.fillText(s.name, w / 2, 80);

    if (st.isCompleted) {
      ctx.fillStyle = "#10b981";
      ctx.font = "900 18px Orbitron, 'Segoe UI', sans-serif";
      ctx.fillText("✓ CLEARED", w / 2, 122);
      ctx.fillStyle = "#ffe600";
      ctx.font = "700 16px 'JetBrains Mono', monospace";
      ctx.fillText(`SCORE: ${st.score} PTS`, w / 2, 150);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "600 13px 'Rajdhani', sans-serif";
      ctx.fillText("[COMPLETED]", w / 2, h - 14);
    } else if (st.isNext) {
      ctx.fillStyle = "#ffe600";
      ctx.font = "700 17px Orbitron, 'Segoe UI', sans-serif";
      ctx.fillText("★ NEXT MISSION ★", w / 2, 120);
    } else {
      ctx.fillStyle = "#ef4444";
      ctx.font = "700 17px Orbitron, 'Segoe UI', sans-serif";
      ctx.fillText("🔒 LOCKED", w / 2, 122);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 14px 'Rajdhani', sans-serif";
      ctx.fillText(`CLEAR ROUND ${st.nextRound} FIRST`, w / 2, 150);
    }
  }

  drawAttractScreen(s, t, nextRound) {
    const { ctx } = s;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const st = this.screenStatus(s, nextRound);
    const key = `${st.isCompleted ? "c" : st.isNext ? "n" : "l"}|${st.score}|${st.nextRound}|${this._fontEpoch || 0}`;
    if (key !== s.layerKey) {
      s.layerKey = key;
      this.buildScreenLayer(s, st);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = st.isCompleted ? "rgba(2,16,10,0.92)" : (st.isLocked ? "rgba(10,12,18,0.92)" : "rgba(2,4,12,0.9)");
    ctx.fillRect(0, 0, w, h);

    if (!st.isLocked) {
      // Equalizer bars
      ctx.fillStyle = st.hex;
      ctx.globalAlpha = st.isCompleted ? 0.35 : 0.55;
      for (let i = 0; i < 12; i++) {
        const bh = (0.25 + 0.75 * Math.abs(Math.sin(t * 2.2 + i * 0.7 + s.phase))) * h * 0.34;
        ctx.fillRect(8 + i * 20, h - 14 - bh, 12, bh);
      }
      ctx.globalAlpha = 1;
    }

    // Scanline sweep
    const sy = (t * 60 + s.phase * 40) % h;
    const grad = ctx.createLinearGradient(0, sy - 18, 0, sy + 18);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, st.isCompleted ? "rgba(16,185,129,0.25)" : (st.isLocked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.35)"));
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, sy - 18, w, 36);

    ctx.drawImage(s.layer, 0, 0);

    if (st.isNext) {
      ctx.textAlign = "center";
      ctx.fillStyle = st.hex;
      ctx.font = "700 18px Orbitron, 'Segoe UI', sans-serif";
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + s.phase);
      ctx.fillText("PRESS E TO PLAY", w / 2, h - 24);
      ctx.globalAlpha = 1;
    }

    s.tex.needsUpdate = true;
  }

  /**
   * Redraw the cabinet screens: at most ONE per frame (so a frame never pays for
   * all five at once), ~12 times a second each, and only the ones on camera.
   * A change in round status forces an immediate redraw.
   */
  updateScreens(t, nextRound) {
    const spots = this.cabinetSpots;
    const n = spots.length;
    if (!n) return;
    this._pv.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._pv);
    for (let k = 0; k < n; k++) {
      const idx = ((this._screenCursor || 0) + k) % n;
      const spot = spots[idx];
      const screen = spot.holder.userData.pulse && spot.holder.userData.pulse.screen;
      if (!screen) continue;
      if (!this._frustum.intersectsSphere(_sphere.set(_v1.set(spot.position.x, CABINET_HEIGHT * 0.6, spot.position.z), CABINET_HEIGHT))) continue;
      const sig = (state.isRoundCompleted(screen.round) ? "c" : "-") + (state.roundScores[screen.round] || 0) + "|" + nextRound;
      if (screen.lastDraw >= 0 && sig === screen.sig && t - screen.lastDraw <= 1 / 12) continue;
      this.drawAttractScreen(screen, t, nextRound);
      screen.lastDraw = t;
      screen.sig = sig;
      this._screenCursor = idx + 1;
      return;
    }
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
    // The stride speed was measured BEFORE the rig was scaled to the character's
    // height; without this the legs cycle far too slowly for the ground speed and
    // the player glides ("floats") instead of stepping.
    if (this.walkCycleSpeed && this._probeScale) {
      model.updateMatrixWorld(true);
      this.walkCycleSpeed *= (model.getWorldScale(new THREE.Vector3()).x || this._probeScale) / this._probeScale;
    }

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
    // Skinned-mesh bounding boxes are derived from bind-pose bone positions and
    // often sit slightly above the visual foot surface. Sink the model down a
    // small constant so feet visually make contact with the floor.
    const FOOT_SINK = 0.04;
    model.position.y -= groundY - this.character.position.y + FOOT_SINK;
    model.updateMatrixWorld(true);
    this.modelBaseY = model.position.y;

    this.forwardOffsetDir = this.detectModelForward(model, clipForward);
    this.forwardAlpha = Math.atan2(this.forwardOffsetDir.x, -this.forwardOffsetDir.z);
    this.measureActionFootLift(model);
    this.mixer.update(0);
  }

  /**
   * The rig is grounded in its idle pose, but the walk / crouch clips carry a
   * different hip height (their root-height track is stripped because the
   * controller owns movement). Played as-is, the whole body hovers ~0.25 m above
   * the floor while moving. Here we find how high each clip's lowest foot sits
   * relative to idle, so updateAnimation can drop the model by exactly that.
   */
  measureActionFootLift(model) {
    this.actionLift = { walk: 0, crouch: 0 };
    try {
      const feet = [];
      model.traverse(n => { if (n.isBone && /foot|ankle|toe/i.test(n.name || "")) feet.push(n); });
      const actions = { idle: this.idleAction, walk: this.walkAction, crouch: this.crouchAction };
      if (!feet.length || !actions.idle) return;
      const saved = {};
      Object.entries(actions).forEach(([k, a]) => { if (a) { saved[k] = a.time; a.setEffectiveWeight(0); } });
      const v = new THREE.Vector3();
      const lowestFoot = (name) => {
        const a = actions[name];
        if (!a) return null;
        a.setEffectiveWeight(1);
        const dur = a.getClip().duration || 0;
        const n = dur > 0 ? 24 : 1;
        let low = Infinity;
        for (let i = 0; i < n; i++) {
          a.time = dur * i / n;
          this.mixer.update(0);
          model.updateMatrixWorld(true);
          feet.forEach(f => { low = Math.min(low, f.getWorldPosition(v).y); });
        }
        a.setEffectiveWeight(0);
        return low;
      };
      const idle = lowestFoot("idle");
      const walk = lowestFoot("walk");
      const crouch = lowestFoot("crouch");
      if (walk !== null && Number.isFinite(walk)) this.actionLift.walk = walk - idle;
      if (crouch !== null && Number.isFinite(crouch)) this.actionLift.crouch = crouch - idle;
      Object.entries(actions).forEach(([k, a]) => { if (a) a.time = saved[k] || 0; });
      if (this.idleAction) this.idleAction.setEffectiveWeight(1);
    } catch (err) {
      console.warn("Foot-height probe skipped:", err);
    }
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
      this._probeScale = model.getWorldScale(new THREE.Vector3()).x || 1;   // stride is measured at this scale
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
    let cx = 0, cy = 0, cz = 0, ang = 0;
    const tailParts = [];
    for (let i = 0; i < 14; i++) {
      tailParts.push({
        geo: new THREE.SphereGeometry(Math.max(0.012, 0.05 - i * 0.003), 8, 6),
        matrix: new THREE.Matrix4().makeTranslation(cx, cy, cz)
      });
      ang += 0.5;
      cx -= Math.sin(ang) * 0.05;
      cz -= Math.cos(ang) * 0.05 * (i < 5 ? 1 : 0.4);
      cy += i > 6 ? 0.02 : 0;
    }
    // One draw call for the whole curled tail instead of fourteen.
    const tailMesh = mergeStatic(tailParts, segMat, "tail");
    if (tailMesh) tailPivot.add(tailMesh);
    else tailParts.forEach(({ geo, matrix }) => {
      const seg = new THREE.Mesh(geo, segMat);
      seg.position.setFromMatrixPosition(matrix);
      tailPivot.add(seg);
    });
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
    if (this.quality === "low") {
      this.composer = null;
      return;
    }
    try {
      const size = new THREE.Vector2();
      this.renderer.getSize(size);
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      // Lightweight single bloom pass (cheap threshold and small blur radius)
      this.bloomPass = new UnrealBloomPass(size, 0.45, 0.4, 0.8);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } catch (err) {
      console.warn("Bloom composer unavailable, rendering direct:", err);
      this.composer = null;
    }
  }

  loadGltf(url) {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(url, resolve, undefined, reject);
    });
  }

  // ------------------------------------------------------------------ lifecycle

  setReturnPosition(roundJustFinished) {
    if (!this.character) return;
    const spot = this.cabinetSpots.find(s => s.round === Number(roundJustFinished));
    if (spot) {
      // Step back ~2.4 metres from the cabinet toward the room center
      const dirToCenter = new THREE.Vector3(-spot.position.x, 0, -spot.position.z).normalize();
      this.character.position.copy(spot.position).addScaledVector(dirToCenter, 2.4);
      const ground = this.groundHeightAt(this.character.position.x, this.character.position.z);
      this.character.position.y = ground;
      this.vertY = ground;
      this.charYaw = Math.atan2(dirToCenter.x, -dirToCenter.z);
      this.character.rotation.y = this.forwardAlpha - this.charYaw;
      this.cameraYaw = this.charYaw;
      if (this.camera) {
        this.camera.position.set(
          this.character.position.x - dirToCenter.x * 4.2,
          this.character.position.y + 2.4,
          this.character.position.z - dirToCenter.z * 4.2
        );
      }
    }
  }

  showToast(message, type = "info") {
    let toast = document.getElementById("room3dToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "room3dToast";
      toast.className = "room3d-toast";
      const stage = document.querySelector(".room3d-stage") || document.body;
      stage.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `room3d-toast visible ${type}`;
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove("visible");
    }, 3500);
  }

  enter() {
    if (!this.ready) return false;
    this.active = true;
    this.clock.getDelta();
    document.body.classList.add("room3d-mode");

    const scoreValEl = document.getElementById("room3dTotalScore");
    if (scoreValEl) scoreValEl.textContent = String(state.totalScore).padStart(3, "0");

    this.resize();
    requestAnimationFrame(() => this.resize());

    // Fresh pacing / measurement state on every entry (the display may differ).
    this._pace = { samples: [], skip: 1, count: 0, detected: false, last: 0, hz: 60, pausedAt: 0 };
    this._perf = { frames: 0, sum: 0, since: 0, lastTime: 0, lastText: "", fps: 0, ms: 0 };
    this.resetAdaptive();
    this.renderer.setAnimationLoop((time) => this.frame(time));
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
    if (this._boundHandlers.visibility) {
      document.removeEventListener("visibilitychange", this._boundHandlers.visibility);
    }
    const sensEl = document.getElementById("room3dSens");
    if (sensEl && this._boundHandlers.sens) sensEl.removeEventListener("input", this._boundHandlers.sens);
    const pauseSensEl = document.getElementById("room3dSensPause");
    if (pauseSensEl && this._boundHandlers.pauseSens) pauseSensEl.removeEventListener("input", this._boundHandlers.pauseSens);
    const qualityEl = document.getElementById("room3dQuality");
    if (qualityEl && this._boundHandlers.qualityChange) {
      qualityEl.removeEventListener("change", this._boundHandlers.qualityChange);
    }
    ["btnPauseResume", "btnPauseSettings", "btnPauseLeave"].forEach(id => {
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
      if (e.code === "KeyF" && !e.repeat) {
        e.preventDefault();
        this.toggleFps();
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
    this._boundHandlers.visibility = () => {
      this.tabHidden = document.hidden;
    };
    document.addEventListener("visibilitychange", this._boundHandlers.visibility);

    const qualityEl = document.getElementById("room3dQuality");
    if (qualityEl) {
      qualityEl.value = this.quality || "low";
      this._boundHandlers.qualityChange = () => {
        this.applyQuality(qualityEl.value, true);
        this.showToast(`Graphics set to ${qualityEl.value.toUpperCase()}`, "info");
      };
      qualityEl.addEventListener("change", this._boundHandlers.qualityChange);
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
      const qEl = document.getElementById("room3dQuality");
      if (qEl) qEl.value = this.quality || "low";
    } else if (this.canvas) {
      this.canvas.focus();
    }
    return want;
  }

  resize() {
    if (!this.renderer || !this.canvas) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const s = this.resScale || (this.quality === "low" ? 0.75 : (this.quality === "medium" ? 0.85 : 1.0));
    const rw = Math.max(320, Math.round(w * s));
    const rh = Math.max(240, Math.round(h * s));
    this.renderer.setSize(rw, rh, false);
    if (this.composer) this.composer.setSize(rw, rh);
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

  // ------------------------------------------------------------ pacing + metrics

  /**
   * One display-refresh callback. Paces the loop to the FPS cap by rendering
   * every Nth display refresh (60 Hz -> every 2nd = an even 33 ms, 120 Hz -> every
   * 4th), so frame times stay perfectly even instead of a timer beating against
   * the monitor. Runs the tick and feeds the FPS counter / adaptive resolution.
   */
  frame(time) {
    const pace = this._pace;
    if (this.tabHidden || document.hidden) { pace.last = 0; this._perf.lastTime = 0; return; }

    if (this.paused) {                       // menu open: the scene is frozen, so redraw rarely
      if (time - pace.pausedAt < 200) return;
      pace.pausedAt = time;
      this._perf.lastTime = 0;
      this.tick();
      return;
    }

    // Learn the refresh rate from the first callbacks (median, so one hitch can't skew it).
    if (!pace.detected) {
      if (pace.last) pace.samples.push(time - pace.last);
      pace.last = time;
      if (pace.samples.length >= 40) {
        const sorted = pace.samples.slice().sort((a, b) => a - b);
        pace.hz = 1000 / Math.max(1, sorted[sorted.length >> 1]);
        pace.skip = Math.max(1, Math.ceil(pace.hz / FPS_CAP - 0.1));
        pace.detected = true;
      }
    }
    if (++pace.count < pace.skip) return;
    pace.count = 0;

    this.tick();
    this.measureFrame(time);
  }

  /** The frame rate we are trying to hold: the cap, or the display rate when that is lower. */
  targetFps() {
    const { hz, skip } = this._pace;
    return Math.min(TARGET_FPS, hz / skip);
  }

  /** Counts rendered frames from the rAF timestamps; updates the FPS readout twice a second. */
  measureFrame(time) {
    const perf = this._perf;
    if (perf.lastTime) {
      const d = time - perf.lastTime;
      if (d < 500) { perf.frames++; perf.sum += d; }   // ignore stalls (tab switch, debugger)
    }
    perf.lastTime = time;
    if (!perf.since) { perf.since = time; return; }
    const span = time - perf.since;
    if (span < 500) return;
    if (perf.frames >= 3) {
      perf.fps = (perf.frames * 1000) / perf.sum;
      perf.ms = perf.sum / perf.frames;
      this.updateFpsCounter();
      this.adaptResolution(perf.fps, time);
    }
    perf.frames = 0;
    perf.sum = 0;
    perf.since = time;
  }

  ensureFpsElement() {
    if (this.fpsEl) return this.fpsEl;
    const stage = (this.canvas && this.canvas.parentElement) || document.body;
    const el = document.createElement("div");
    el.id = "room3dFps";
    el.className = "room3d-fps";
    el.setAttribute("aria-hidden", "true");
    el.title = "Frames per second — press F to hide / show";
    el.innerHTML = '<span class="room3d-fps-val">--</span><span class="room3d-fps-unit">FPS</span>' +
      '<span class="room3d-fps-ms"></span><span class="room3d-fps-res"></span>';
    stage.appendChild(el);
    this.fpsEl = el;
    return el;
  }

  applyFpsVisibility() {
    const el = this.ensureFpsElement();
    el.hidden = !this.showFps;
    this._perf.lastText = "";
  }

  toggleFps(force) {
    this.showFps = force === undefined ? !this.showFps : force;
    try { localStorage.setItem("arcade_show_fps", String(this.showFps)); } catch (_) { /* private mode */ }
    this.applyFpsVisibility();
    this.showToast(`FPS counter ${this.showFps ? "ON" : "OFF"}  (F)`, "info");
  }

  updateFpsCounter() {
    if (!this.showFps) return;
    const el = this.ensureFpsElement();
    const { fps, ms } = this._perf;
    const target = this.targetFps();
    const tier = fps >= target * 0.9 ? "good" : (fps >= target * 0.6 ? "ok" : "bad");
    const res = this.resScale < 0.995 ? Math.round(this.resScale * 100) + "% RES" : "";
    const text = `${Math.round(fps)}|${ms.toFixed(1)}|${res}|${tier}`;
    if (text === this._perf.lastText) return;
    this._perf.lastText = text;
    el.dataset.tier = tier;
    const kids = el.children;
    kids[0].textContent = String(Math.round(fps));
    kids[2].textContent = ms.toFixed(1) + " ms";
    kids[3].textContent = res;
  }

  // ------------------------------------------------------ adaptive resolution

  resetAdaptive(now = performance.now()) {
    this._drs = {
      lagWins: 0,            // consecutive slow half-second windows
      goodWins: 0,           // consecutive on-target windows (probe for a higher resolution)
      needGood: 10,          // on-target windows required before probing higher (backs off after a failed probe)
      lastClimb: -1e9,
      cooldownUntil: now + 2500,   // ignore the first seconds: shader/texture warm-up hitches
      prevFps: 0, prevScale: 0, noGain: 0
    };
  }

  /**
   * Keeps the game smooth on weak GPUs: if the frame rate sags, lower the render
   * resolution a step (the picture softens a little, the game never stutters).
   * With clear stability it probes back up one small step at a time, and backs off
   * (probes less often) whenever a probe fails. If lowering the resolution does
   * not help (the machine is CPU-bound), it restores the picture and stops trying.
   * Called twice a second with the measured fps.
   */
  adaptResolution(fps, now) {
    const drs = this._drs;
    const tier = RES_TIERS[this.quality] || RES_TIERS.low;
    if (drs.off || !this.active || this.paused || now < drs.cooldownUntil) return;
    const target = this.targetFps();

    if (fps < target * 0.9) {
      drs.goodWins = 0;
      // Did the previous reduction actually buy any speed?
      if (drs.prevScale) {
        drs.noGain = fps < drs.prevFps * 1.05 ? drs.noGain + 1 : 0;
        drs.prevFps = fps;
        if (drs.noGain >= 2) {                     // resolution is not the bottleneck: undo and stop
          const back = Math.min(tier.max, drs.prevScale);
          drs.prevScale = 0; drs.noGain = 0; drs.lagWins = 0;
          drs.off = true;                          // stay put until the quality setting changes
          this.setResolutionScale(back);
          return;
        }
      }
      drs.lagWins++;
      if (drs.lagWins >= 2 || fps < target * 0.6) {
        const step = fps < target * 0.6 ? 0.15 : 0.1;
        const next = Math.max(tier.min, Math.round((this.resScale - step) * 100) / 100);
        drs.lagWins = 0;
        if (next < this.resScale) {
          if (now - drs.lastClimb < 15000) drs.needGood = Math.min(120, drs.needGood * 2);   // last probe did not hold
          if (!drs.prevScale) { drs.prevScale = this.resScale; drs.prevFps = fps; drs.noGain = 0; }
          drs.cooldownUntil = now + 1500;
          this.setResolutionScale(next);
        }
      }
      return;
    }

    drs.lagWins = 0;
    drs.prevScale = 0;                             // we are on target again: the reduction worked
    drs.goodWins = fps >= target * 0.95 ? drs.goodWins + 1 : 0;
    if (drs.goodWins >= drs.needGood && this.resScale < tier.max - 0.001) {
      drs.goodWins = 0;
      drs.lastClimb = now;
      drs.cooldownUntil = now + 1500;
      this.setResolutionScale(Math.min(tier.max, Math.round((this.resScale + 0.05) * 100) / 100));
    }
  }

  setResolutionScale(scale) {
    if (Math.abs(scale - this.resScale) < 0.001) return;
    this.resScale = scale;
    this.resize();
    this._perf.lastText = "";
  }

  // ------------------------------------------------------------------- per-frame

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.paused) {
      this.renderFrame();
      return;
    }

    // Split the frame into equal physics steps (never a fixed 60 Hz accumulator):
    // every frame then advances by exactly its own dt, so motion stays smooth at
    // 50, 60, 75 or 144 fps with no leftover time to cause judder.
    const steps = Math.max(1, Math.ceil(dt / MAX_PHYS_STEP - 1e-6));
    const stepDt = dt / steps;
    for (let i = 0; i < steps; i++) this.updateMovement(stepDt);

    if (this.blobShadow && this.character) {
      this.blobShadow.position.x = this.character.position.x;
      this.blobShadow.position.z = this.character.position.z;
      const ground = this.groundHeightAt(this.character.position.x, this.character.position.z);
      this.blobShadow.position.y = ground + 0.015;
      const airDist = Math.max(0, this.vertY - ground);
      this.blobShadow.scale.setScalar(Math.max(0.4, 1 - airDist * 0.25));
      this.blobShadow.material.opacity = Math.max(0.15, 0.75 - airDist * 0.35);
    }

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
    if (this.quality === "low" || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
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
    _v1.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    _v2.set(Math.cos(yaw), 0, -Math.sin(yaw));
    _v3.set(0, 0, 0)
      .addScaledVector(_v1, iz)
      .addScaledVector(_v2, ix);
    if (_v3.lengthSq() > 1e-6) _v3.normalize().multiplyScalar(targetSpeed);

    // Exponential accel / friction: snappy start, no sliding stop
    const rate = (ix || iz) ? (running ? ACCEL_RUN : ACCEL_WALK) : FRICTION;
    this.velocity.lerp(_v3, 1 - Math.exp(-rate * dt));
    if (this.velocity.lengthSq() < 1e-4) this.velocity.set(0, 0, 0);

    const pos = this.character.position;
    // Horizontal move resolved against the collision world (per-axis, sub-stepped).
    if (this.collision) {
      _deltaMove.set(this.velocity.x * dt, 0, this.velocity.z * dt);
      this.collision.move(pos, _deltaMove, 0.4, this.vertY, this.vertY + (crouch ? 0.8 : 1.2));
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
      const targetYaw = Math.atan2(this.velocity.x, -this.velocity.z);
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
      // Play the stride fast enough to roughly plant the feet: a small rig covering
      // 3+ m/s needs a quick shuffle, so the cap is generous (and a little higher at a sprint).
      const maxCycle = Math.min(4.6, 3.7 + Math.max(0, speed - 3) * 0.3);
      const cycle = this.walkCycleSpeed ? THREE.MathUtils.clamp(speed / this.walkCycleSpeed * 0.85, 0.5, maxCycle) : 1;
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
    if (this.model) {
      const t = performance.now() / 1000;
      const bob = !this.walkAction && moving
        ? Math.abs(Math.sin(t * 9)) * 0.05 * Math.min(1, speed / WALK_SPEED)
        : (this.walkAction && moving ? 0 : Math.sin(t * 2.1) * 0.012);
      // Keep the feet on the floor: remove the extra hip height of whichever
      // clips are blended in (see measureActionFootLift).
      let lift = 0;
      const lifts = this.actionLift;
      if (lifts) {
        const ww = this.walkAction ? this.walkAction.getEffectiveWeight() : 0;
        const cw = this.crouchAction ? this.crouchAction.getEffectiveWeight() : 0;
        const iw = this.idleAction ? this.idleAction.getEffectiveWeight() : 0;
        const total = ww + cw + iw;
        if (total > 0.001) lift = (ww * lifts.walk + cw * lifts.crouch) / Math.max(1, total);
      }
      this.model.position.y = this.modelBaseY - lift + bob;
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
    _camLook.copy(this.character.position).addScaledVector(this.velocity, 0.3);
    const headY = this.character.position.y + this.charHeight * 0.82;
    _v1.set(_camLook.x, headY, _camLook.z);
    let dist = (aim ? 4.6 : 6.1) + speed * 0.3;
    // Pull the camera in when a wall sits between it and the player.
    if (this.collision) {
      _v2.set(
        _v1.x + Math.sin(yaw) * dist,
        height,
        _v1.z + Math.cos(yaw) * dist
      );
      dist = Math.min(dist, this.collision.distanceToWall(_v1, _v2, 0.35));
    }
    _camTarget.set(
      _camLook.x + Math.sin(yaw) * dist,
      height,
      _camLook.z + Math.cos(yaw) * dist
    );
    // Keep the camera inside the room shell so it never sinks into a wall
    const mx = this.bounds.x - 0.7;
    const mz = this.bounds.z - 0.7;
    _camTarget.x = THREE.MathUtils.clamp(_camTarget.x, -mx, mx);
    _camTarget.z = THREE.MathUtils.clamp(_camTarget.z, -mz, mz);

    // Critically-damped spring follow
    this.camera.position.lerp(_camTarget, 1 - Math.exp(-10 * dt));
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -mx, mx);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -mz, mz);

    if (!this._lookAt) this._lookAt = this.character.position.clone();
    _camWant.set(_camLook.x, this.character.position.y + this.charHeight * 0.82, _camLook.z);
    this._lookAt.lerp(_camWant, 1 - Math.exp(-13 * dt));
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
      const isCompleted = state.isRoundCompleted(best.round);
      const nextRound = state.getNextAvailableRound();
      const isNext = best.round === nextRound;
      const isLocked = best.round > nextRound;
      const roundScore = state.roundScores[best.round] || 0;
      const statusKey = `${best.round}-${isCompleted ? 'c' : (isNext ? 'n' : 'l')}`;

      if (this.nearest !== best || this._lastStatusKey !== statusKey) {
        this.nearest = best;
        this._lastStatusKey = statusKey;

        if (this.promptRoundEl) {
          if (isCompleted) {
            this.promptRoundEl.textContent = `ROUND ${best.round} / 5 · [CLEARED]`;
          } else if (isNext) {
            this.promptRoundEl.textContent = `ROUND ${best.round} / 5 · [ACTIVE MISSION]`;
          } else {
            this.promptRoundEl.textContent = `ROUND ${best.round} / 5 · [LOCKED]`;
          }
        }

        if (this.promptNameEl) this.promptNameEl.textContent = best.name;

        const promptKeyEl = this.promptEl ? this.promptEl.querySelector(".room3d-prompt-key") : null;
        if (promptKeyEl) {
          if (isCompleted) {
            promptKeyEl.innerHTML = `<span style="color: #10b981; font-weight: 800;">✓ CLEARED · SCORE: ${roundScore} PTS</span> <span style="opacity: 0.7; font-size: 0.8rem; margin-left: 6px;">[CANNOT REPLAY]</span>`;
          } else if (isNext) {
            promptKeyEl.innerHTML = `PRESS <b>E</b> TO PLAY`;
          } else {
            promptKeyEl.innerHTML = `<span style="color: #ef4444; font-weight: 800;">🔒 LOCKED</span> · CLEAR ROUND ${nextRound} FIRST`;
          }
        }

        if (this.promptEl) {
          const colorHex = isCompleted ? "#10b981" : (isLocked ? "#64748b" : "#" + new THREE.Color(best.color).getHexString());
          this.promptEl.style.setProperty("--prompt-color", colorHex);
          this.promptEl.classList.add("visible");
        }
      }
    } else if (this.nearest) {
      this.nearest = null;
      this._lastStatusKey = null;
      if (this.promptEl) this.promptEl.classList.remove("visible");
    }
  }

  updateAmbience(dt) {
    const t = performance.now() / 1000;
    if (this.filmPass) this.filmPass.uniforms.uTime.value = t;
    const nextRound = state.getNextAvailableRound();   // once per frame, not once per cabinet

    if (this.glowParts) {
      const camoGain = 0.3 + 0.7 * this.camo;
      this.glowParts.forEach(g => {
        g.mat.emissiveIntensity = g.base * (0.8 + 0.3 * Math.sin(t * 3.1 + g.phase)) * camoGain;
      });
    }

    this.cabinetSpots.forEach(spot => {
      const pulse = spot.holder.userData.pulse;
      if (!pulse) return;
      const isCompleted = state.isRoundCompleted(spot.round);
      const isNext = spot.round === nextRound;
      const isNear = spot === this.nearest;
      const activePulse = 0.8 + Math.sin(t * 3.5 + pulse.phase) * 0.4;
      const lit = pulse.light.visible;   // lights are off on Low: don't animate what isn't drawn

      if (isCompleted) {
        pulse.ring.material.opacity = isNear ? 0.95 : 0.45;
        if (lit) pulse.light.intensity = pulse.base * (isNear ? 1.4 : 0.6);
        this.setPulseColor(pulse, 0x10b981);
      } else if (isNext) {
        pulse.ring.material.opacity = isNear ? 1.0 : activePulse;
        if (lit) pulse.light.intensity = pulse.base * (isNear ? 2.0 : 1.4 + activePulse * 0.5);
        this.setPulseColor(pulse, spot.color);
      } else {
        pulse.ring.material.opacity = isNear ? 0.6 : 0.25;
        if (lit) pulse.light.intensity = pulse.base * (isNear ? 0.8 : 0.35);
        this.setPulseColor(pulse, 0x334155);
      }
    });

    this.updateScreens(t, nextRound);
  }

  /** Set the ring / light colour only when it actually changes. */
  setPulseColor(pulse, hex) {
    if (pulse.hex === hex) return;
    pulse.hex = hex;
    pulse.light.color.setHex(hex);
    pulse.ring.material.color.setHex(hex);
  }

  interact() {
    if (!this.nearest) return false;
    const round = this.nearest.round;
    const isCompleted = state.isRoundCompleted(round);
    const nextRound = state.getNextAvailableRound();
    const roundScore = state.roundScores[round] || 0;

    if (isCompleted) {
      this.showToast(`Cabinet Cleared! You scored ${roundScore} pts in Round ${round}. Proceed to Round ${nextRound}!`, "warning");
      return false;
    }

    if (round > nextRound) {
      this.showToast(`Cabinet Locked! Clear Round ${nextRound} first to unlock this machine.`, "error");
      return false;
    }

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
    _v1.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    _v2.copy(this.character.position);
    _v2.y += this.charHeight * 0.62 + this.vertY;

    // Raycast hit detection at full extension (once per shot)
    if (!this.tongueHitDone && p >= 0.45) {
      this.tongueHitDone = true;
      this.tongueHit = this.raycastTongue(_v2, _v1);
    }

    const g = this.tongueMesh;
    g.visible = true;
    g.position.copy(_v2);
    _v3.copy(_v2).add(_v1);
    g.lookAt(_v3);
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
    // Fully visible and already applied: nothing to do (skips ~25 material writes per frame).
    if (this._camoSettled && o >= 0.999 && target >= 0.999) return;
    this._camoSettled = o >= 0.999;
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

  /** Reflect sprint stamina and camo state in the on-screen meters without touching DOM every frame. */
  updateHudMeters() {
    const staminaPct = Math.round(this.stamina * 100);
    if (this._lastStaminaPct !== staminaPct) {
      this._lastStaminaPct = staminaPct;
      if (this.staminaEl) this.staminaEl.style.width = staminaPct + "%";
    }
    const camoOn = this.camoTarget < 0.5;
    const camoPct = camoOn ? 100 : Math.round(this.camo * 100);
    const ready = this.tongueCooldown <= 0;
    const camoKey = `${camoPct}-${ready}`;
    if (this._lastCamoKey !== camoKey) {
      this._lastCamoKey = camoKey;
      if (this.camoMeterEl) {
        this.camoMeterEl.style.width = camoPct + "%";
        this.camoMeterEl.style.opacity = ready ? "1" : "0.4";
      }
    }
  }

  /**
   * Quality tiers trade resolution + post-processing + accent lights for FPS.
   * LOW is the default safety net for integrated GPUs (Intel UHD / i3) on event day.
   */
  applyQuality(q, isManual = false) {
    if (isManual) {
      this.manualQuality = true;
      localStorage.setItem("arcade_manual_quality", "true");
    }
    this.quality = q;
    localStorage.setItem("arcade_quality", q);
    // Start each tier at its own resolution; adaptive scaling then tunes it live.
    this.resScale = (RES_TIERS[q] || RES_TIERS.low).start;
    this.resetAdaptive();

    if (q === "low") {
      this.renderer.setPixelRatio(1);
      if (this.bloomPass) this.bloomPass.enabled = false;
      (this.accentLights || []).forEach(l => { l.visible = false; });
      (this.cabinetLights || []).forEach(l => { l.visible = false; });
      if (this.cornerLights) this.cornerLights.forEach(l => { l.visible = false; });
      if (this.glossyFloor) this.glossyFloor.visible = false;
      if (this.scene.fog) { this.scene.fog.near = 10; this.scene.fog.far = 28; }
      if (this.camera) { this.camera.far = 70; this.camera.updateProjectionMatrix(); }
      if (this.renderer) {
        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.shadowMap.enabled = false;
      }
    } else if (q === "high") {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      if (!this.composer) this.initComposer();
      if (this.bloomPass) this.bloomPass.enabled = true;
      (this.accentLights || []).forEach(l => { l.visible = true; });
      (this.cabinetLights || []).forEach(l => { l.visible = true; });
      if (this.cornerLights) this.cornerLights.forEach(l => { l.visible = true; });
      if (this.glossyFloor) this.glossyFloor.visible = true;
      if (this.scene.fog) { this.scene.fog.near = 18; this.scene.fog.far = 46; }
      if (this.camera) { this.camera.far = 200; this.camera.updateProjectionMatrix(); }
      if (this.renderer) this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      if (this.decor) this.decor.loadStatues().catch(() => {});
    } else {
      // medium
      this.renderer.setPixelRatio(1);
      if (!this.composer) this.initComposer();
      if (this.bloomPass) this.bloomPass.enabled = true;
      (this.accentLights || []).forEach(l => { l.visible = true; });
      (this.cabinetLights || []).forEach(l => { l.visible = true; });
      if (this.cornerLights) this.cornerLights.forEach(l => { l.visible = true; });
      if (this.glossyFloor) this.glossyFloor.visible = true;
      if (this.scene.fog) { this.scene.fog.near = 18; this.scene.fog.far = 46; }
      if (this.camera) { this.camera.far = 160; this.camera.updateProjectionMatrix(); }
      if (this.renderer) this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      if (this.decor) this.decor.loadStatues().catch(() => {});
    }
    if (this.decor) this.decor.setQuality(q);
    const qEl = document.getElementById("room3dQuality");
    if (qEl && qEl.value !== q) qEl.value = q;
    this.resize();
  }

  // ------------------------------------------------------------------- plumbing

  setProgress(ratio, note) {
    const pct = Math.round(ratio * 100);
    if (this.progressBarEl) this.progressBarEl.style.width = pct + "%";
    if (this.loadingNoteEl && note) this.loadingNoteEl.textContent = note;
    const pctEl = document.getElementById("room3dLoadingPct");
    if (pctEl) pctEl.textContent = pct + "%";
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
