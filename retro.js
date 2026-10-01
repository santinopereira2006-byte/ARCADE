/**
 * RETRO BLAST: ARCADE EDITION - CORE GAME ENGINE
 * High-performance vanilla JavaScript Aim Labs clone with Three.js 3D FPV Weapon Rig.
 */

(function () {
  'use strict';

  // Ensure safe audio fallback
  if (!window.retroAudio) {
    window.retroAudio = {
      isMuted: false,
      init() {},
      ensureContext() {},
      startBGM() {},
      stopBGM() {},
      toggleMute() { this.isMuted = !this.isMuted; return !this.isMuted; },
      playLaserShoot() {},
      playTargetHit() {},
      playBombExplosion() {},
      playDespawnFizzle() {},
      playCountdownBeep() {},
      playRoundFanfare() {},
      playWarpSwoosh() {}
    };
  }

  // ==========================================================================
  // GAME CONFIG & STATE CONSTANTS
  // ==========================================================================
  const STATES = {
    MENU: 'MENU',
    TRANSITIONING: 'TRANSITIONING',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    INTERMISSION: 'INTERMISSION',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
  };

  const GAME_CONFIG = {
    ROUND_1: {
      waves: 3,
      targetsPerWave: [5, 5, 10],
      totalTargets: 20,
      name: 'GRID CLEAR',
      desc: '3 Waves: 5, 5 & 10 Simultaneous Targets',
      maxAmmo: Infinity
    },
    ROUND_2: {
      totalTargets: 30,
      maxAmmo: 30,
      name: 'REFLEX SNAP',
      desc: '30 Fast Reflex Spawns (Instant Respawn on Hit)'
    },
    ROUND_3: {
      waves: 2,
      targetsPerWave: 10,
      totalTargets: 20,
      maxAmmo: 20,
      waveSpeedMultipliers: [1.5, 2.0],
      name: 'KINETIC DRIFT',
      desc: '2 Waves of 10 Moving Targets (1.5x & 2.0x Speed)'
    },
    ROUND_4: {
      targetCount: 30,
      bombCount: 18,
      totalItems: 48,
      targetLifespan: 1000,  // 1.0s for targets
      bombLifespan: 750,     // 0.75s for bombs
      name: 'TIME & HAZARDS',
      desc: '30 Targets + 18 Bombs (1.0s / 0.75s Despawn)',
      maxAmmo: Infinity
    }
  };

  let gameState = STATES.MENU;
  let currentRound = 1;
  let currentWave = 1; // For Round 1
  let currentAmmo = Infinity;
  let score = 0;
  let shotsFired = 0;
  let targetsHit = 0;
  let targetsMissed = 0;
  let bombsAvoided = 0;
  let bombsHit = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let reactionTimes = [];
  let itemSpawnTimestamp = 0;

  // Round 2 tracking
  let round2TargetsSpawned = 0;
  let round2TargetsHit = 0;

  // Round 3 Kinetic Drift tracking
  let round3Wave = 1;
  let round3MovingTargets = [];

  // Round 4 items queue (Time & Hazards)
  let round4Queue = [];
  let round4CurrentItem = null;
  let round4TimerId = null;
  let round4AnimFrameId = null;

  // Ammo over transition lock
  let isAmmoOverTransitioning = false;

  // Active targets on screen
  let activeTargets = [];

  // Mouse tracking
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  // High Score
  const STORAGE_KEY = 'retro_blast_high_score_v2';
  let highScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);

  // ==========================================================================
  // DOM ELEMENT REFERENCES
  // ==========================================================================
  const appContainer = document.getElementById('game-app');
  const screenMenu = document.getElementById('screen-menu');
  const screenGameplay = document.getElementById('screen-gameplay');
  const screenGameover = document.getElementById('screen-gameover');
  const targetArena = document.getElementById('target-arena');
  const fxCanvas = document.getElementById('fx-canvas');
  const starfieldCanvas = document.getElementById('starfield-canvas');
  const screenFlash = document.getElementById('screen-flash');
  const customCrosshair = document.getElementById('custom-crosshair');
  const weaponRig = document.getElementById('fpv-weapon-rig');
  const muzzleFlash = document.getElementById('muzzle-flash');
  const fpvThreeCanvas = document.getElementById('fpv-three-canvas');

  // Modals
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownRoundBadge = document.getElementById('countdown-round-badge');
  const countdownRoundTitle = document.getElementById('countdown-round-title');
  const countdownRoundDesc = document.getElementById('countdown-round-desc');
  const countdownDigit = document.getElementById('countdown-digit');
  const countdownProgress = document.getElementById('countdown-progress');

  const intermissionOverlay = document.getElementById('intermission-overlay');
  const intermissionTitle = document.getElementById('intermission-title');
  const istatHits = document.getElementById('istat-hits');
  const istatAccuracy = document.getElementById('istat-accuracy');
  const istatScore = document.getElementById('istat-score');
  const intermissionTimer = document.getElementById('intermission-timer');

  const pauseOverlay = document.getElementById('pause-overlay');
  const ammoOverBanner = document.getElementById('ammo-over-banner');
  const ammoOverSub = document.getElementById('ammo-over-sub');

  // HUD
  const hudScoreVal = document.getElementById('hud-score-val');
  const hudRoundVal = document.getElementById('hud-round-val');
  const hudRoundName = document.getElementById('hud-round-name');
  const hudAmmoVal = document.getElementById('hud-ammo-val');
  const hudTargetsVal = document.getElementById('hud-targets-val');
  const hudAccuracyVal = document.getElementById('hud-accuracy-val');
  const hudWaveTag = document.getElementById('hud-wave-tag');
  const hudStreakTag = document.getElementById('hud-streak-tag');

  // Buttons & Controls
  const btnStart = document.getElementById('btn-start');
  const soundStatusLabel = document.getElementById('sound-status-label');
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  const btnIngamePause = document.getElementById('btn-ingame-pause');
  const btnIngameSound = document.getElementById('btn-ingame-sound');
  const btnResume = document.getElementById('btn-resume');
  const btnQuit = document.getElementById('btn-quit');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnReturnMenu = document.getElementById('btn-return-menu');

  // Game Over Elements
  const finalScoreVal = document.getElementById('final-score-val');
  const finalHighScore = document.getElementById('final-high-score');
  const newHighScoreBanner = document.getElementById('new-high-score-banner');
  const finalRankGrade = document.getElementById('final-rank-grade');
  const rankTitle = document.getElementById('rank-title');
  const statAccuracy = document.getElementById('stat-accuracy');
  const statShots = document.getElementById('stat-shots');
  const statHits = document.getElementById('stat-hits');
  const statMissed = document.getElementById('stat-missed');
  const statBombsAvoided = document.getElementById('stat-bombs-avoided');
  const statBombsHit = document.getElementById('stat-bombs-hit');
  const statBestStreak = document.getElementById('stat-best-streak');
  const statReactionTime = document.getElementById('stat-reaction-time');

  // Canvas 2D Contexts
  const fxCtx = fxCanvas.getContext('2d');
  const starCtx = starfieldCanvas.getContext('2d');

  // Particle System
  let particles = [];
  let laserTracers = [];
  let stars = [];

  // ==========================================================================
  // THREE.JS 3D FPV NEON RAYGUN WEAPON & HAND RIG
  // ==========================================================================
  let fpvScene, fpvCamera, fpvRenderer, fpvRaygunGroup, fpvTipMesh, fpvArmGroup;
  let recoilRecoilZ = 0;
  let recoilPitch = 0;
  let weaponSwayRotX = 0, weaponSwayRotY = 0;
  let targetSwayRotX = 0, targetSwayRotY = 0;

  function initThreeFPVWeapon() {
    if (!fpvThreeCanvas || typeof THREE === 'undefined') return;

    const width = fpvThreeCanvas.clientWidth || 650;
    const height = fpvThreeCanvas.clientHeight || 550;

    fpvScene = new THREE.Scene();
    fpvCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
    fpvCamera.position.set(0, 5, 130);

    fpvRenderer = new THREE.WebGLRenderer({
      canvas: fpvThreeCanvas,
      alpha: true,
      antialias: true
    });
    fpvRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    fpvRenderer.setSize(width, height);
    fpvRenderer.setClearColor(0x000000, 0);

    // Lights
    fpvScene.add(new THREE.AmbientLight(0x445566, 0.75));
    const key = new THREE.PointLight(0xdff7ff, 2.4, 320); key.position.set(70, 70, 90); fpvScene.add(key);
    const rim = new THREE.PointLight(0xff00e0, 1.8, 300); rim.position.set(-90, -10, -50); fpvScene.add(rim);
    const fillC = new THREE.PointLight(0x00eaff, 1.5, 260); fillC.position.set(-40, -30, 70); fpvScene.add(fillC);

    // Build the Raygun from GUN.txt
    buildRaygunModel();

    // Resize handling
    window.addEventListener('resize', onFPVResize);
  }

  function onFPVResize() {
    if (!fpvRenderer || !fpvThreeCanvas) return;
    const width = fpvThreeCanvas.clientWidth || 650;
    const height = fpvThreeCanvas.clientHeight || 550;
    fpvCamera.aspect = width / height;
    fpvCamera.updateProjectionMatrix();
    fpvRenderer.setSize(width, height);
  }

  function buildRaygunModel() {
    const rig = new THREE.Group();
    fpvRaygunGroup = rig;
    fpvScene.add(rig);

    function neonEdge(mesh, color, op = 0.5) {
      const eg = new THREE.EdgesGeometry(mesh.geometry);
      const line = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
      mesh.add(line);
    }
    const white = new THREE.MeshStandardMaterial({ color: 0xf3f5f8, metalness: 0.15, roughness: 0.32 });
    const black = new THREE.MeshStandardMaterial({ color: 0x121216, metalness: 0.25, roughness: 0.42 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0e0e11, metalness: 0.1, roughness: 0.85 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x15092a, metalness: 0.4, roughness: 0.5 });
    function glowCore(color) { return new THREE.MeshBasicMaterial({ color }); }

    const _texCache = {};
    function glowTexture(colorHex) {
      if (_texCache[colorHex]) return _texCache[colorHex];
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const ctx = cv.getContext('2d');
      const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      const c = '#' + colorHex.toString(16).padStart(6, '0');
      grd.addColorStop(0, c); grd.addColorStop(0.4, c); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(cv);
      _texCache[colorHex] = tex; return tex;
    }
    function addGlowSprite(x, y, z, color, size) {
      const mat = new THREE.SpriteMaterial({ map: glowTexture(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(mat); s.position.set(x, y, z); s.scale.set(size, size, 1); rig.add(s); return s;
    }
    function textTexture(str, color, glow) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 256, 96);
      ctx.font = "900 78px 'Arial Black', Arial, sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const c = '#' + color.toString(16).padStart(6, '0');
      ctx.shadowColor = '#' + glow.toString(16).padStart(6, '0');
      ctx.shadowBlur = 18;
      ctx.fillStyle = c;
      ctx.fillText(str, 128, 52);
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(str, 128, 52);
      const tex = new THREE.CanvasTexture(cv);
      tex.needsUpdate = true;
      return tex;
    }
    function rivet(x, y, z) {
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), black);
      r.position.set(x, y, z); rig.add(r);
    }

    const CYAN = 0x00eaff, MAG = 0xff00e0, BLUE = 0x2a6bff;

    // ===== NOSE CONE (tapered, tip toward -X) =====
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(3, 8.5, 22, 18), white);
    nose.rotation.z = Math.PI / 2;
    nose.position.set(-70, 9, 0);
    rig.add(nose);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 16), glowCore(CYAN));
    tip.position.set(-81, 9, 0);
    rig.add(tip);
    fpvTipMesh = tip;
    addGlowSprite(-82, 9, 0, CYAN, 26);

    // Blue accent ring on nose surface
    const noseBlueRing = new THREE.Mesh(new THREE.TorusGeometry(6, 0.4, 8, 24), glowCore(BLUE));
    noseBlueRing.rotation.y = Math.PI / 2;
    noseBlueRing.position.set(-74, 9, 0);
    rig.add(noseBlueRing);

    // Nose seam ring (connector)
    const noseSeam = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 2, 18), black);
    noseSeam.rotation.z = Math.PI / 2;
    noseSeam.position.set(-59, 9, 0);
    rig.add(noseSeam);

    // ===== RIBBED COLLAR RINGS (alternating magenta / cyan rims) =====
    const ringColors = [MAG, BLUE, CYAN];
    [-56, -51, -46].forEach((x, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 1.1, 10, 28), black);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, 9, 0);
      rig.add(ring);
      const rim2 = new THREE.Mesh(new THREE.TorusGeometry(9, 0.35, 8, 28), glowCore(ringColors[i]));
      rim2.rotation.y = Math.PI / 2;
      rim2.position.set(x, 9, 0);
      rig.add(rim2);
    });

    // Connector sleeve bridging rings to barrel
    const collar1 = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 7, 20), white);
    collar1.rotation.z = Math.PI / 2;
    collar1.position.set(-40, 9, 0);
    rig.add(collar1);
    neonEdge(collar1, CYAN, 0.4);

    // ===== MAIN BARREL (white cylinder) =====
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 28, 20), white);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(-22, 9, 0);
    rig.add(barrel);

    // Thin accent lines along barrel
    const barrelLine = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 26, 10), glowCore(CYAN));
    barrelLine.rotation.z = Math.PI / 2;
    barrelLine.position.set(-22, 17, 0);
    rig.add(barrelLine);

    const barrelLine2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 26, 10), glowCore(MAG));
    barrelLine2.rotation.z = Math.PI / 2;
    barrelLine2.position.set(-22, 1.2, 5);
    rig.add(barrelLine2);

    const barrelLine3 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 26, 10), glowCore(BLUE));
    barrelLine3.rotation.z = Math.PI / 2;
    barrelLine3.position.set(-22, 1.2, -5);
    rig.add(barrelLine3);

    // Seam rivets along barrel
    for (let x = -34; x <= -10; x += 8) { rivet(x, 15.5, 6.5); rivet(x, 2.5, 6.5); }

    // Connector collar bridging barrel to main body
    const collar2 = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.4, 6, 20), black);
    collar2.rotation.z = Math.PI / 2;
    collar2.position.set(-6, 9.5, 0);
    rig.add(collar2);
    neonEdge(collar2, MAG, 0.5);

    // ===== MAIN BODY (chunky receiver, white with black panels) =====
    const body = new THREE.Mesh(new THREE.BoxGeometry(44, 19, 18), white);
    body.position.set(20, 10, 0);
    rig.add(body);
    neonEdge(body, CYAN, 0.3);

    // Black side panel insets
    const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(24, 13, 0.6), black);
    sidePanel.position.set(16, 9, 9.05);
    rig.add(sidePanel);
    neonEdge(sidePanel, BLUE, 0.55);
    const sidePanelB = sidePanel.clone(); sidePanelB.position.z = -9.05; rig.add(sidePanelB);

    // Blue rivets dotting side panels
    [[6, 14], [16, 14], [26, 14], [6, 4], [16, 4], [26, 4]].forEach(([x, y]) => {
      rivet(x, y, 9.4);
      rivet(x, y, -9.4);
    });

    // Blue accent strips
    const bodyStripBlue = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 0.8), glowCore(BLUE));
    bodyStripBlue.position.set(20, 1.2, 9.3);
    rig.add(bodyStripBlue);
    const bodyStripBlueB = bodyStripBlue.clone(); bodyStripBlueB.position.z = -9.3; rig.add(bodyStripBlueB);

    const bodyStripTopBlue = new THREE.Mesh(new THREE.BoxGeometry(38, 0.5, 0.5), glowCore(BLUE));
    bodyStripTopBlue.position.set(20, 18.7, 9.3);
    rig.add(bodyStripTopBlue);

    // Top step panel
    const panelTop = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 13), black);
    panelTop.position.set(16, 19.5, 0);
    rig.add(panelTop);
    const panelTopLine = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 0.4), glowCore(CYAN));
    panelTopLine.position.set(16, 21.1, 6.6);
    rig.add(panelTopLine);

    // Rear swept fin
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0, 10, 22, 3), black);
    fin.rotation.z = Math.PI / 2; fin.rotation.x = Math.PI / 2;
    fin.position.set(38, 21, 0);
    rig.add(fin);
    neonEdge(fin, MAG, 0.7);

    const finBase = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 10), white);
    finBase.position.set(32, 19.5, 0);
    rig.add(finBase);

    // Porthole dial on side
    const porthOuter = new THREE.Mesh(new THREE.TorusGeometry(6.5, 1, 10, 28), black);
    porthOuter.position.set(6, 10, 9.2);
    rig.add(porthOuter);
    const porthDisc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 28), glowCore(MAG));
    porthDisc.position.set(6, 10, 9.3);
    rig.add(porthDisc);
    const porthDot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1, 12), white);
    porthDot.rotation.x = Math.PI / 2;
    porthDot.position.set(6, 10, 9.9);
    rig.add(porthDot);
    addGlowSprite(6, 10, 10, MAG, 16);

    const porthRimBlue = new THREE.Mesh(new THREE.TorusGeometry(7.1, 0.3, 8, 28), glowCore(BLUE));
    porthRimBlue.position.set(6, 10, 9.1);
    rig.add(porthRimBlue);

    // Small dial
    const smallDial = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.5, 8, 20), black);
    smallDial.position.set(-2, 15, 9.2);
    rig.add(smallDial);
    const smallDialCore = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), glowCore(CYAN));
    smallDialCore.position.set(-2, 15, 9.25);
    rig.add(smallDialCore);

    // Blue vent block
    const blueVent = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.6), black);
    blueVent.position.set(-8, 7, 9.4);
    rig.add(blueVent);
    addGlowSprite(-8, 7, 9.8, BLUE, 9);

    // Grille vents
    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 7, 1.5), black);
      slat.position.set(-6 + i * 2.6, 12, 9.3);
      rig.add(slat);
    }

    // Small HUD accent squares
    [[-4, 20, 6, CYAN], [4, 20, 6, MAG], [12, 20, 6, BLUE]].forEach(([x, y, z, c]) => {
      const sq = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.5), black);
      sq.position.set(x, y, z);
      rig.add(sq);
      addGlowSprite(x, y, z + 0.6, c, 8);
    });

    // Underbarrel accent strip
    const underStrip = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 1.2), glowCore(CYAN));
    underStrip.position.set(4, 0.5, 9.2);
    rig.add(underStrip);
    const underWedge = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 14), black);
    underWedge.position.set(10, -2, 0);
    rig.add(underWedge);

    // ===== GRIP + TRIGGER GUARD =====
    const grip = new THREE.Mesh(new THREE.BoxGeometry(11, 25, 13), rubber);
    grip.position.set(40, -13, 0);
    grip.rotation.z = -0.26;
    rig.add(grip);

    for (let i = -2; i <= 2; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1, 13.4), black);
      line.position.set(40 + i * 2.2 * Math.sin(-0.26), -13 + i * 2.2 * Math.cos(-0.26), 0);
      line.rotation.z = -0.26;
      rig.add(line);
    }

    // Magenta pinstripe wrapping grip
    const gripStripe = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.5, 13.5), glowCore(MAG));
    gripStripe.position.set(40 - 6 * Math.sin(-0.26), -13 - 6 * Math.cos(-0.26), 0);
    gripStripe.rotation.z = -0.26;
    rig.add(gripStripe);

    const gripCap = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 3, 16), black);
    gripCap.rotation.x = Math.PI / 2;
    gripCap.position.set(44, -25, 0);
    gripCap.rotation.z = -0.26;
    rig.add(gripCap);

    const gripCapRim = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.35, 8, 20), glowCore(BLUE));
    gripCapRim.rotation.x = Math.PI / 2;
    gripCapRim.position.set(44, -25, 0);
    gripCapRim.rotation.z = -0.26;
    rig.add(gripCapRim);

    const gripConnector = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 15), white);
    gripConnector.position.set(34, -1, 0);
    gripConnector.rotation.z = -0.15;
    rig.add(gripConnector);

    // "CSI" logo decal
    const csiMat = new THREE.MeshBasicMaterial({ map: textTexture('CSI', 0xffffff, 0xfff200), transparent: true });
    const csiPlaneF = new THREE.Mesh(new THREE.PlaneGeometry(19, 7.5), csiMat);
    csiPlaneF.position.set(34, 13, 9.35);
    rig.add(csiPlaneF);
    const csiPlaneB = new THREE.Mesh(new THREE.PlaneGeometry(19, 7.5), csiMat);
    csiPlaneB.position.set(34, 13, -9.35);
    csiPlaneB.rotation.y = Math.PI;
    rig.add(csiPlaneB);

    const guard = new THREE.Mesh(new THREE.TorusGeometry(6.5, 1, 10, 28, Math.PI * 1.5), black);
    guard.position.set(25, -5, 0);
    guard.rotation.z = Math.PI * 0.15;
    rig.add(guard);

    const trigger = new THREE.Mesh(new THREE.BoxGeometry(1.3, 4.6, 3.6), glowCore(MAG));
    trigger.position.set(26, -2, 0);
    trigger.rotation.z = 0.15;
    rig.add(trigger);

    const underRail = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 8), black);
    underRail.position.set(8, -1, 0);
    rig.add(underRail);

    // ===== FPV CYBERNETIC GLOVE & FOREARM RIG =====
    const armGroup = new THREE.Group();
    fpvArmGroup = armGroup;

    // Cyber Forearm Sleeve / Armor Plate
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 36, 12), gloveMat);
    forearm.rotation.z = -0.7;
    forearm.rotation.x = 0.4;
    forearm.position.set(58, -32, 12);
    armGroup.add(forearm);
    neonEdge(forearm, MAG, 0.45);

    // Glowing Cyan Energy Wrist Ring
    const wristRing = new THREE.Mesh(new THREE.TorusGeometry(8, 0.6, 8, 20), glowCore(CYAN));
    wristRing.rotation.x = Math.PI / 2;
    wristRing.rotation.z = -0.7;
    wristRing.position.set(52, -24, 8);
    armGroup.add(wristRing);

    // Hand Palm Wrapping Grip
    const palm = new THREE.Mesh(new THREE.BoxGeometry(13, 18, 14), gloveMat);
    palm.position.set(42, -14, 2);
    palm.rotation.z = -0.26;
    armGroup.add(palm);
    neonEdge(palm, CYAN, 0.35);

    // Cyber Fingers wrapping the front of the grip
    for (let f = 0; f < 3; f++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 14), gloveMat);
      finger.position.set(33, -11 - f * 4.5, 1);
      finger.rotation.z = -0.15;
      armGroup.add(finger);
      neonEdge(finger, CYAN, 0.4);
    }

    // Index Trigger Finger reaching trigger
    const triggerFinger = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 4.5), gloveMat);
    triggerFinger.position.set(28, -3, 3);
    triggerFinger.rotation.z = 0.1;
    armGroup.add(triggerFinger);
    neonEdge(triggerFinger, MAG, 0.5);

    rig.add(armGroup);

    // Scale down Gun and Hand assets so they take up less screen real estate
    rig.scale.set(0.68, 0.68, 0.68);

    // FPV Perspective Setup:
    // Gun concentric rings and barrel point directly forward along camera's negative Z-axis
    rig.position.set(18, -16, 20);
    rig.rotation.set(0.04, -Math.PI / 2 + 0.05, -0.02);
  }

  function updateFPVWeaponAnimation(t) {
    if (!fpvRaygunGroup || !fpvRenderer || !fpvRaygunGroup.visible) return;

    // Recoil spring recovery
    recoilRecoilZ *= 0.82;
    recoilPitch *= 0.82;

    // Mouse Sway interpolation
    weaponSwayRotX += (targetSwayRotX - weaponSwayRotX) * 0.08;
    weaponSwayRotY += (targetSwayRotY - weaponSwayRotY) * 0.08;

    // Breathing idle oscillation
    const breathY = Math.sin(t * 0.002) * 0.4;
    const breathRot = Math.cos(t * 0.002) * 0.006;

    // Base position + recoil kick + sway + idle
    fpvRaygunGroup.position.set(
      18 + weaponSwayRotY * 0.4,
      -16 + breathY - weaponSwayRotX * 0.3,
      20 + recoilRecoilZ
    );

    fpvRaygunGroup.rotation.set(
      0.04 + recoilPitch + weaponSwayRotX + breathRot,
      -Math.PI / 2 + 0.05 + weaponSwayRotY,
      -0.02
    );

    if (fpvTipMesh) {
      fpvTipMesh.scale.setScalar(1 + Math.sin(t * 0.005) * 0.08);
    }

    fpvRenderer.render(fpvScene, fpvCamera);
  }

  // ==========================================================================
  // SCREEN ROUTING & STATE MANAGEMENT (STRICT CONDITIONAL MOUNTING)
  // ==========================================================================
  function setScreenState(newState) {
    gameState = newState;

    if (newState === STATES.MENU) {
      if (screenMenu) {
        screenMenu.classList.remove('hidden');
        screenMenu.style.display = 'flex';
      }
      if (screenGameplay) {
        screenGameplay.classList.add('hidden');
        screenGameplay.style.display = 'none';
      }
      if (screenGameover) {
        screenGameover.classList.add('hidden');
        screenGameover.style.display = 'none';
      }
      if (weaponRig) {
        weaponRig.classList.add('hidden');
        weaponRig.style.display = 'none';
      }
      if (fpvRaygunGroup) {
        fpvRaygunGroup.visible = false;
      }
      document.body.classList.remove('in-gameplay');
      appContainer.className = 'game-container state-menu';
      pauseOverlay.classList.add('hidden');
      countdownOverlay.classList.add('hidden');
      intermissionOverlay.classList.add('hidden');
    } else if (newState === STATES.GAMEOVER) {
      if (screenMenu) {
        screenMenu.classList.add('hidden');
        screenMenu.style.display = 'none';
      }
      if (screenGameplay) {
        screenGameplay.classList.add('hidden');
        screenGameplay.style.display = 'none';
      }
      if (screenGameover) {
        screenGameover.classList.remove('hidden');
        screenGameover.style.display = 'flex';
      }
      if (weaponRig) {
        weaponRig.classList.add('hidden');
        weaponRig.style.display = 'none';
      }
      if (fpvRaygunGroup) {
        fpvRaygunGroup.visible = false;
      }
      document.body.classList.remove('in-gameplay');
      appContainer.className = 'game-container state-gameover';
      pauseOverlay.classList.add('hidden');
      countdownOverlay.classList.add('hidden');
      intermissionOverlay.classList.add('hidden');
    } else {
      // Gameplay active states: PLAYING, COUNTDOWN, INTERMISSION, PAUSED, TRANSITIONING
      if (screenMenu) {
        screenMenu.classList.add('hidden');
        screenMenu.style.display = 'none';
      }
      if (screenGameplay) {
        screenGameplay.classList.remove('hidden');
        screenGameplay.style.display = 'block';
      }
      if (screenGameover) {
        screenGameover.classList.add('hidden');
        screenGameover.style.display = 'none';
      }
      if (weaponRig) {
        weaponRig.classList.remove('hidden');
        weaponRig.style.display = 'block';
      }
      if (fpvRaygunGroup) {
        fpvRaygunGroup.visible = true;
      }
      document.body.classList.add('in-gameplay');
      appContainer.className = 'game-container state-playing';
    }
  }

  // ==========================================================================
  // INITIALIZATION & RESIZE
  // ==========================================================================
  function init() {
    updateHighScoreDisplay();
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    initStarfield();
    initThreeFPVWeapon();
    setupEventListeners();

    // Enforce initial Screen State to MENU
    setScreenState(STATES.MENU);

    // Start render loop
    requestAnimationFrame(mainRenderLoop);
  }

  function resizeCanvases() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    fxCanvas.width = w;
    fxCanvas.height = h;

    starfieldCanvas.width = w;
    starfieldCanvas.height = h;
  }

  function updateHighScoreDisplay() {
    const hsStr = String(highScore).padStart(4, '0');
    const menuHighScore = document.getElementById('menu-high-score');
    if (menuHighScore) menuHighScore.textContent = hsStr;
    if (finalHighScore) finalHighScore.textContent = hsStr;
  }

  // ==========================================================================
  // STARFIELD BACKGROUND SIMULATION
  // ==========================================================================
  function initStarfield() {
    stars = [];
    const count = Math.floor((window.innerWidth * window.innerHeight) / 7000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * (window.innerHeight * 0.55),
        size: Math.random() * 2 + 0.5,
        baseAlpha: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.04 + 0.01,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.3 ? '#00fdfa' : '#f600ff'
      });
    }
  }

  function renderStarfield() {
    starCtx.clearRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.phase += s.twinkleSpeed;
      const alpha = s.baseAlpha + Math.sin(s.phase) * 0.35;
      starCtx.fillStyle = s.color;
      starCtx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
      starCtx.fillRect(s.x, s.y, s.size, s.size);
    }
    starCtx.globalAlpha = 1.0;
  }

  // ==========================================================================
  // EVENT LISTENERS & INPUT
  // ==========================================================================
  function setupEventListeners() {
    // Exact 1:1 Zero-Latency Mouse Crosshair & Sway Tracking
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (customCrosshair) {
        customCrosshair.style.left = `${mouseX}px`;
        customCrosshair.style.top = `${mouseY}px`;
        customCrosshair.style.transform = 'translate(-50%, -50%)';
      }

      // Calculate 3D weapon sway offset from screen center
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      targetSwayRotY = -((mouseX - centerX) / centerX) * 0.12;
      targetSwayRotX = -((mouseY - centerY) / centerY) * 0.08;
    });

    // Fire Blaster on Left Click
    window.addEventListener('pointerdown', (e) => {
      // Audio unlock on user gesture
      window.retroAudio.ensureContext();
      if (gameState === STATES.MENU && !window.retroAudio.bgmTimer && !window.retroAudio.isMuted) {
        window.retroAudio.startBGM();
      }

      // Ignore UI buttons / modal clicks
      if (e.target.closest('button') || e.target.closest('.keybind-pill') || e.target.closest('.modal-overlay:not(.hidden)')) {
        return;
      }

      if (gameState === STATES.PLAYING) {
        e.preventDefault();
        handleBlasterShot(e.clientX, e.clientY, e.target);
      }
    });

    // Keyboard Shortcuts: [M] MUTE, [SPACE] PAUSE
    window.addEventListener('keydown', (e) => {
      window.retroAudio.ensureContext();

      if (e.code === 'KeyM') {
        toggleMasterMute();
      } else if (e.code === 'Space') {
        if (gameState === STATES.PLAYING) {
          pauseGame();
        } else if (gameState === STATES.PAUSED) {
          resumeGame();
        }
      } else if (e.code === 'KeyR' && gameState === STATES.GAMEOVER) {
        startNewGame();
      }
    });

    // Menu CTA Button
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        window.retroAudio.init();
        if (!window.retroAudio.isMuted) {
          window.retroAudio.startBGM();
        }
        triggerTransitionToGameplay();
      });
    }

    if (btnToggleSound) {
      btnToggleSound.addEventListener('click', toggleMasterMute);
    }

    if (btnIngameSound) btnIngameSound.addEventListener('click', toggleMasterMute);
    if (btnIngamePause) btnIngamePause.addEventListener('click', pauseGame);

    if (btnResume) btnResume.addEventListener('click', resumeGame);
    if (btnQuit) btnQuit.addEventListener('click', abortToMenu);

    if (btnPlayAgain) btnPlayAgain.addEventListener('click', startNewGame);
    if (btnReturnMenu) btnReturnMenu.addEventListener('click', returnToMainMenu);
  }

  function toggleMasterMute() {
    const isUnmuted = window.retroAudio.toggleMute();
    const label = isUnmuted ? 'MUTE' : 'UNMUTE';
    const icon = isUnmuted ? '🔊' : '🔇';

    if (soundStatusLabel) soundStatusLabel.textContent = label;
    if (btnIngameSound) btnIngameSound.textContent = icon;
  }

  // ==========================================================================
  // TRANSITION: OVERVIEW TO FIRST-PERSON PERSPECTIVE (FPV)
  // ==========================================================================
  function triggerTransitionToGameplay() {
    if (gameState === STATES.TRANSITIONING) return;
    gameState = STATES.TRANSITIONING;

    window.retroAudio.playWarpSwoosh();

    appContainer.classList.add('transition-to-fpv');
    document.body.classList.add('in-gameplay');

    setTimeout(() => {
      appContainer.classList.remove('transition-to-fpv');
      setScreenState(STATES.COUNTDOWN);

      // Start Round 1
      resetGameData();
      startRoundCountdown(1);
    }, 600);
  }

  function returnToMainMenu() {
    clearTargetArena();
    setScreenState(STATES.MENU);
    updateHighScoreDisplay();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'RETRO_BLAST_EXIT' }, '*');
    }
  }

  function startNewGame() {
    resetGameData();
    setScreenState(STATES.COUNTDOWN);
    startRoundCountdown(1);
  }

  function resetGameData() {
    currentRound = 1;
    currentWave = 1;
    currentAmmo = Infinity;
    score = 0;
    shotsFired = 0;
    targetsHit = 0;
    targetsMissed = 0;
    bombsAvoided = 0;
    bombsHit = 0;
    round2TargetsSpawned = 0;
    round2TargetsHit = 0;
    round3Wave = 1;
    round3MovingTargets = [];
    currentStreak = 0;
    bestStreak = 0;
    reactionTimes = [];
    activeTargets = [];
    round4Queue = [];
    round4CurrentItem = null;
    isAmmoOverTransitioning = false;

    if (round4TimerId) clearTimeout(round4TimerId);
    if (round4AnimFrameId) cancelAnimationFrame(round4AnimFrameId);

    if (ammoOverBanner) {
      ammoOverBanner.classList.remove('active');
      ammoOverBanner.classList.add('hidden');
    }

    clearTargetArena();
    updateHUD();
  }

  // ==========================================================================
  // PRE-ROUND COUNTDOWN
  // ==========================================================================
  function startRoundCountdown(roundNumber) {
    setScreenState(STATES.COUNTDOWN);
    currentRound = roundNumber;
    clearTargetArena();

    if (ammoOverBanner) {
      ammoOverBanner.classList.remove('active');
      ammoOverBanner.classList.add('hidden');
    }

    const config = GAME_CONFIG[`ROUND_${roundNumber}`];
    countdownRoundBadge.textContent = `ROUND 0${roundNumber}`;
    countdownRoundTitle.textContent = config.name;
    countdownRoundDesc.textContent = config.desc;

    countdownOverlay.classList.remove('hidden');
    countdownProgress.style.width = '0%';

    let count = 3;
    countdownDigit.textContent = count;
    window.retroAudio.playCountdownBeep(false);

    countdownProgress.style.transition = 'width 2.8s linear';
    requestAnimationFrame(() => {
      countdownProgress.style.width = '100%';
    });

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        countdownDigit.textContent = count;
        window.retroAudio.playCountdownBeep(false);
      } else if (count === 0) {
        countdownDigit.textContent = 'GO!';
        countdownDigit.style.color = '#39ff14';
        window.retroAudio.playCountdownBeep(true);
      } else {
        clearInterval(timer);
        countdownOverlay.classList.add('hidden');
        countdownDigit.style.color = '#ffffff';
        countdownProgress.style.width = '0%';
        countdownProgress.style.transition = 'none';

        // Begin round
        beginRound(roundNumber);
      }
    }, 900);
  }

  // ==========================================================================
  // ROUND CONTROLLERS
  // ==========================================================================
  function beginRound(roundNumber) {
    setScreenState(STATES.PLAYING);
    currentRound = roundNumber;
    isAmmoOverTransitioning = false;

    if (roundNumber === 1) {
      currentAmmo = Infinity;
      currentWave = 1;
      spawnRound1Wave(currentWave);
    } else if (roundNumber === 2) {
      currentAmmo = GAME_CONFIG.ROUND_2.maxAmmo;
      round2TargetsSpawned = 0;
      round2TargetsHit = 0;
      spawnRound2Target();
    } else if (roundNumber === 3) {
      currentAmmo = GAME_CONFIG.ROUND_3.maxAmmo;
      round3Wave = 1;
      spawnRound3KineticDrift(1);
    } else if (roundNumber === 4) {
      currentAmmo = Infinity;
      buildRound4Queue();
      spawnNextRound4Item();
    }

    updateHUD();
  }

  /* --------------------------------------------------------------------------
     ROUND 1: GRID CLEAR (3 Waves: 5, 5, 10 Targets; 20 Total; Infinite Ammo)
  -------------------------------------------------------------------------- */
  function spawnRound1Wave(waveNum) {
    clearTargetArena();
    hudWaveTag.classList.remove('hidden');
    hudWaveTag.textContent = `WAVE ${waveNum} OF 3`;

    const count = GAME_CONFIG.ROUND_1.targetsPerWave[waveNum - 1];
    const arenaRect = getArenaBounds();
    const positions = generateNonOverlappingCoords(count, 80, arenaRect);

    itemSpawnTimestamp = performance.now();

    positions.forEach((pos, idx) => {
      createTargetElement({
        id: `r1-t-${waveNum}-${idx}`,
        x: pos.x,
        y: pos.y,
        isBomb: false
      });
    });

    updateHUD();
  }

  function handleRound1TargetHit(targetObj) {
    removeTarget(targetObj);
    score += 1;
    targetsHit++;
    shotsFired++;
    currentStreak++;
    bestStreak = Math.max(bestStreak, currentStreak);
    recordReactionTime();

    triggerTargetExplosion(targetObj.x, targetObj.y, false);
    spawnScorePopup(targetObj.x, targetObj.y, '+1', true);
    window.retroAudio.playTargetHit();

    updateHUD();

    if (activeTargets.length === 0) {
      if (currentWave < 3) {
        currentWave++;
        window.retroAudio.playRoundFanfare();
        setTimeout(() => {
          if (gameState === STATES.PLAYING) {
            spawnRound1Wave(currentWave);
          }
        }, 350);
      } else {
        triggerRoundIntermission(1);
      }
    }
  }

  /* --------------------------------------------------------------------------
     ROUND 2: REFLEX SNAP (30 Fast Reflex Spawns, Max 30 Ammo)
  -------------------------------------------------------------------------- */
  function spawnRound2Target() {
    clearTargetArena();
    hudWaveTag.classList.remove('hidden');
    hudWaveTag.textContent = `TARGET ${round2TargetsSpawned + 1} OF ${GAME_CONFIG.ROUND_2.totalTargets}`;

    const arenaRect = getArenaBounds();
    const pos = generateNonOverlappingCoords(1, 80, arenaRect)[0];

    itemSpawnTimestamp = performance.now();
    round2TargetsSpawned++;

    createTargetElement({
      id: `r2-t-${round2TargetsSpawned}`,
      x: pos.x,
      y: pos.y,
      isBomb: false
    });

    updateHUD();
  }

  function handleRound2TargetHit(targetObj) {
    removeTarget(targetObj);
    score += 1;
    targetsHit++;
    round2TargetsHit++;
    shotsFired++;
    currentStreak++;
    bestStreak = Math.max(bestStreak, currentStreak);
    recordReactionTime();

    triggerTargetExplosion(targetObj.x, targetObj.y, false);
    spawnScorePopup(targetObj.x, targetObj.y, '+1', true);
    window.retroAudio.playTargetHit();

    updateHUD();

    if (round2TargetsHit >= GAME_CONFIG.ROUND_2.totalTargets) {
      round2TargetsSpawned = 0;
      round2TargetsHit = 0;
      triggerRoundIntermission(2);
    } else if (currentAmmo === 0) {
      const remaining = GAME_CONFIG.ROUND_2.totalTargets - round2TargetsHit;
      if (remaining > 0) {
        showAmmoOverNotification(remaining, () => {
          round2TargetsSpawned = 0;
          round2TargetsHit = 0;
          triggerRoundIntermission(2);
        });
      } else {
        triggerRoundIntermission(2);
      }
    } else if (round2TargetsSpawned < GAME_CONFIG.ROUND_2.totalTargets) {
      spawnRound2Target();
    } else {
      triggerRoundIntermission(2);
    }
  }

  /* --------------------------------------------------------------------------
     ROUND 3: KINETIC DRIFT (2 Waves of 10 Moving Targets: 1.5x & 2.0x Speed Multipliers; Max 20 Ammo)
  -------------------------------------------------------------------------- */
  function spawnRound3KineticDrift(waveNum = 1) {
    clearTargetArena();
    round3MovingTargets = [];
    round3Wave = waveNum;

    hudWaveTag.classList.remove('hidden');
    hudWaveTag.textContent = `WAVE ${round3Wave} OF 2 (10 TARGETS)`;

    const arenaRect = getArenaBounds();
    const patterns = ['vertical', 'horizontal', 'diagonal', 'circular'];
    const count = GAME_CONFIG.ROUND_3.targetsPerWave; // 10
    const speedMult = GAME_CONFIG.ROUND_3.waveSpeedMultipliers[waveNum - 1] || (waveNum === 1 ? 1.5 : 2.0);

    const positions = generateNonOverlappingCoords(count, 80, arenaRect);
    itemSpawnTimestamp = performance.now();

    positions.forEach((pos, idx) => {
      const patternType = patterns[idx % patterns.length];
      const el = createTargetElement({
        id: `r3-w${round3Wave}-kd-${idx}`,
        x: pos.x,
        y: pos.y,
        isBomb: false
      });

      let vx = 0, vy = 0;
      const baseSpeed = (3.0 + (idx % 3) * 0.5) * speedMult;

      if (patternType === 'vertical') {
        vy = (idx % 2 === 0 ? 1 : -1) * baseSpeed;
      } else if (patternType === 'horizontal') {
        vx = (idx % 2 === 0 ? 1 : -1) * baseSpeed;
      } else if (patternType === 'diagonal') {
        vx = (idx % 2 === 0 ? 1 : -1) * (baseSpeed * 0.75);
        vy = (idx % 4 < 2 ? 1 : -1) * (baseSpeed * 0.75);
      }

      const movingObj = {
        id: `r3-w${round3Wave}-kd-${idx}`,
        el: el,
        x: pos.x,
        y: pos.y,
        originX: pos.x,
        originY: pos.y,
        pattern: patternType,
        vx: vx,
        vy: vy,
        radius: 42 + (idx % 3) * 18,
        angle: (idx * Math.PI) / 5,
        speed: (0.03 + (idx % 2) * 0.015) * speedMult
      };

      round3MovingTargets.push(movingObj);
    });

    updateHUD();
  }

  function updateKineticTargets() {
    if (gameState !== STATES.PLAYING || currentRound !== 3) return;

    const bounds = getArenaBounds();
    const minX = bounds.left + 35;
    const maxX = bounds.left + bounds.width - 35;
    const minY = bounds.top + 35;
    const maxY = bounds.top + bounds.height - 35;

    round3MovingTargets.forEach(t => {
      const activeT = activeTargets.find(at => at.id === t.id);
      if (!activeT) return;

      if (t.pattern === 'circular') {
        t.angle += t.speed;
        let nx = t.originX + Math.cos(t.angle) * t.radius;
        let ny = t.originY + Math.sin(t.angle) * t.radius;

        if (nx < minX || nx > maxX) t.originX = Math.max(minX + t.radius, Math.min(maxX - t.radius, t.originX));
        if (ny < minY || ny > maxY) t.originY = Math.max(minY + t.radius, Math.min(maxY - t.radius, t.originY));

        if (isInsideGunZone(nx, ny, 40)) {
          t.originY -= 40;
        }

        t.x = nx;
        t.y = ny;
      } else {
        let nx = t.x + t.vx;
        let ny = t.y + t.vy;

        if (nx <= minX || nx >= maxX) {
          t.vx = -t.vx;
          nx = Math.max(minX, Math.min(maxX, nx));
        }

        if (ny <= minY || ny >= maxY) {
          t.vy = -t.vy;
          ny = Math.max(minY, Math.min(maxY, ny));
        }

        if (isInsideGunZone(nx, ny, 40)) {
          t.vx = -Math.abs(t.vx);
          t.vy = -Math.abs(t.vy);
        }

        t.x = nx;
        t.y = ny;
      }

      activeT.x = t.x;
      activeT.y = t.y;
      if (t.el) {
        t.el.style.left = `${t.x}px`;
        t.el.style.top = `${t.y}px`;
      }
    });
  }

  function handleRound3TargetHit(targetObj) {
    removeTarget(targetObj);
    round3MovingTargets = round3MovingTargets.filter(t => t.id !== targetObj.id);

    score += 1;
    targetsHit++;
    shotsFired++;
    currentStreak++;
    bestStreak = Math.max(bestStreak, currentStreak);
    recordReactionTime();

    triggerTargetExplosion(targetObj.x, targetObj.y, false);
    spawnScorePopup(targetObj.x, targetObj.y, '+1', true);
    window.retroAudio.playTargetHit();

    updateHUD();

    if (activeTargets.length === 0) {
      if (round3Wave === 1) {
        window.retroAudio.playRoundFanfare();
        setTimeout(() => {
          if (gameState === STATES.PLAYING) {
            spawnRound3KineticDrift(2);
          }
        }, 350);
      } else {
        triggerRoundIntermission(3);
      }
    } else if (currentAmmo === 0) {
      const remaining = activeTargets.length + (round3Wave === 1 ? 10 : 0);
      if (remaining > 0) {
        showAmmoOverNotification(remaining, () => {
          triggerRoundIntermission(3);
        });
      } else {
        triggerRoundIntermission(3);
      }
    }
  }

  /* --------------------------------------------------------------------------
     ROUND 4: TIME & HAZARDS (30 Targets + 18 Bombs; 1.0s / 0.75s Despawn; Infinite Ammo)
  -------------------------------------------------------------------------- */
  function buildRound4Queue() {
    round4Queue = [];
    for (let i = 0; i < GAME_CONFIG.ROUND_4.targetCount; i++) round4Queue.push({ isBomb: false });
    for (let i = 0; i < GAME_CONFIG.ROUND_4.bombCount; i++) round4Queue.push({ isBomb: true });

    // Fisher-Yates Shuffle
    for (let i = round4Queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [round4Queue[i], round4Queue[j]] = [round4Queue[j], round4Queue[i]];
    }
  }

  function spawnNextRound4Item() {
    clearTargetArena();
    if (round4TimerId) clearTimeout(round4TimerId);
    if (round4AnimFrameId) cancelAnimationFrame(round4AnimFrameId);

    if (round4Queue.length === 0) {
      finishGame();
      return;
    }

    const itemData = round4Queue.shift();
    const arenaRect = getArenaBounds();
    const pos = generateNonOverlappingCoords(1, 80, arenaRect)[0];

    hudWaveTag.classList.remove('hidden');
    const itemsLeft = round4Queue.length + 1;
    hudWaveTag.textContent = `${itemsLeft} ITEMS REMAINING`;

    itemSpawnTimestamp = performance.now();
    const itemLifespan = itemData.isBomb ? GAME_CONFIG.ROUND_4.bombLifespan : GAME_CONFIG.ROUND_4.targetLifespan;
    round4CurrentItem = {
      isBomb: itemData.isBomb,
      x: pos.x,
      y: pos.y,
      spawnTime: performance.now(),
      lifespan: itemLifespan
    };

    const targetEl = createTargetElement({
      id: `r4-item-${round4Queue.length}`,
      x: pos.x,
      y: pos.y,
      isBomb: itemData.isBomb,
      hasTimerRing: true
    });

    const timerCircle = targetEl.querySelector('.timer-circle-progress');
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    if (timerCircle) {
      timerCircle.style.strokeDasharray = `${circumference}`;
      timerCircle.style.strokeDashoffset = '0';
    }

    function updateRing() {
      if (gameState !== STATES.PLAYING || !round4CurrentItem) return;
      const elapsed = performance.now() - round4CurrentItem.spawnTime;
      const progress = Math.min(1, elapsed / round4CurrentItem.lifespan);

      if (timerCircle) {
        timerCircle.style.strokeDashoffset = `${circumference * progress}`;
      }

      if (progress < 1) {
        round4AnimFrameId = requestAnimationFrame(updateRing);
      }
    }
    round4AnimFrameId = requestAnimationFrame(updateRing);

    // Auto-despawn timer
    round4TimerId = setTimeout(() => {
      handleRound4ItemTimeout();
    }, itemLifespan);

    updateHUD();
  }

  function handleRound4ItemTimeout() {
    if (!round4CurrentItem || gameState !== STATES.PLAYING) return;

    if (round4CurrentItem.isBomb) {
      bombsAvoided++;
      spawnScorePopup(round4CurrentItem.x, round4CurrentItem.y, 'AVOIDED', true);
      window.retroAudio.playDespawnFizzle();
    } else {
      targetsMissed++;
      currentStreak = 0;
      spawnScorePopup(round4CurrentItem.x, round4CurrentItem.y, 'EXPIRED', false);
      window.retroAudio.playDespawnFizzle();
    }

    round4CurrentItem = null;
    clearTargetArena();
    updateHUD();

    spawnNextRound4Item();
  }

  function handleRound4TargetHit(targetObj) {
    if (round4TimerId) clearTimeout(round4TimerId);
    if (round4AnimFrameId) cancelAnimationFrame(round4AnimFrameId);

    shotsFired++;
    recordReactionTime();

    if (targetObj.isBomb) {
      // BOMB DETONATED: -2 Points
      score -= 2;
      bombsHit++;
      currentStreak = 0;

      triggerBombExplosion(targetObj.x, targetObj.y);
      spawnScorePopup(targetObj.x, targetObj.y, '-2', false);
      triggerScreenShake();
      triggerScreenFlash();
      window.retroAudio.playBombExplosion();
    } else {
      // TARGET HIT: +1 Point
      score += 1;
      targetsHit++;
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);

      triggerTargetExplosion(targetObj.x, targetObj.y, false);
      spawnScorePopup(targetObj.x, targetObj.y, '+1', true);
      window.retroAudio.playTargetHit();
    }

    round4CurrentItem = null;
    removeTarget(targetObj);
    updateHUD();

    if (gameState === STATES.PLAYING) {
      spawnNextRound4Item();
    }
  }

  // ==========================================================================
  // ROUND INTERMISSION & GAME OVER
  // ==========================================================================
  function triggerRoundIntermission(completedRound) {
    setScreenState(STATES.INTERMISSION);
    clearTargetArena();
    window.retroAudio.playRoundFanfare();

    intermissionOverlay.classList.remove('hidden');
    intermissionTitle.textContent = `ROUND 0${completedRound} CLEARED!`;
    istatHits.textContent = targetsHit;
    istatAccuracy.textContent = calculateAccuracy() + '%';
    istatScore.textContent = score;

    let countdown = 3;
    intermissionTimer.textContent = countdown;

    const timer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        intermissionTimer.textContent = countdown;
      } else {
        clearInterval(timer);
        intermissionOverlay.classList.add('hidden');
        if (completedRound < 4) {
          startRoundCountdown(completedRound + 1);
        } else {
          finishGame();
        }
      }
    }, 1000);
  }

  function finishGame() {
    clearTargetArena();
    window.retroAudio.playRoundFanfare();
    setScreenState(STATES.GAMEOVER);

    const accuracy = calculateAccuracy();
    const isNewHigh = score > highScore;
    if (isNewHigh) {
      highScore = score;
      localStorage.setItem(STORAGE_KEY, String(highScore));
      newHighScoreBanner.classList.remove('hidden');
    } else {
      newHighScoreBanner.classList.add('hidden');
    }

    finalScoreVal.textContent = String(score).padStart(4, '0');
    finalHighScore.textContent = String(highScore).padStart(4, '0');
    statAccuracy.textContent = accuracy + '%';
    statShots.textContent = shotsFired;
    statHits.textContent = targetsHit;
    statMissed.textContent = targetsMissed;
    statBombsAvoided.textContent = `${bombsAvoided}/${GAME_CONFIG.ROUND_4.bombCount}`;
    statBombsHit.textContent = bombsHit;
    statBestStreak.textContent = bestStreak;

    const avgReaction = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    statReactionTime.textContent = avgReaction + ' ms';

    const rankData = computeArcadeGrade(score, accuracy, bombsHit);
    finalRankGrade.textContent = rankData.grade;
    finalRankGrade.className = `rank-grade ${rankData.cssClass}`;
    rankTitle.textContent = rankData.title;

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'RETRO_BLAST_COMPLETE',
        score: score,
        stats: {
          shotsFired,
          targetsHit,
          targetsMissed,
          bombsAvoided,
          bombsHit,
          accuracy,
          bestStreak,
          avgReaction
        }
      }, '*');
    }
  }

  function computeArcadeGrade(finalScore, accuracy, bombsDetonated) {
    if (bombsDetonated === 0 && accuracy >= 88 && finalScore >= 65) {
      return { grade: 'S', cssClass: 'grade-s', title: 'CYBER SHARPSHOOTER' };
    } else if (accuracy >= 78 && finalScore >= 45) {
      return { grade: 'A', cssClass: 'grade-a', title: 'NEON ASSASSIN' };
    } else if (accuracy >= 60 && finalScore >= 30) {
      return { grade: 'B', cssClass: 'grade-b', title: 'ARCADE VETERAN' };
    } else if (accuracy >= 45) {
      return { grade: 'C', cssClass: 'grade-c', title: 'GRID CADET' };
    } else {
      return { grade: 'D', cssClass: 'grade-d', title: 'MALFUNCTION RECRUIT' };
    }
  }

  // ==========================================================================
  // AMMO OVER NOTIFICATION
  // ==========================================================================
  function showAmmoOverNotification(remainingTargets, onProceed) {
    if (isAmmoOverTransitioning) return;
    isAmmoOverTransitioning = true;

    if (ammoOverBanner && ammoOverSub) {
      ammoOverSub.textContent = `${remainingTargets} TARGET${remainingTargets === 1 ? '' : 'S'} REMAINING`;
      ammoOverBanner.classList.remove('hidden');
      ammoOverBanner.classList.add('active');
    }
    if (window.retroAudio && window.retroAudio.playDespawnFizzle) {
      window.retroAudio.playDespawnFizzle();
    }

    setTimeout(() => {
      if (ammoOverBanner) {
        ammoOverBanner.classList.remove('active');
        ammoOverBanner.classList.add('hidden');
      }
      isAmmoOverTransitioning = false;
      if (typeof onProceed === 'function') {
        onProceed();
      }
    }, 1600);
  }

  // ==========================================================================
  // BLASTER SHOOTING MECHANICS & HIT DETECTION
  // ==========================================================================
  function handleBlasterShot(clientX, clientY, hitElement) {
    if (isAmmoOverTransitioning) return;

    // Check finite ammo limit
    if (currentAmmo !== Infinity) {
      if (currentAmmo <= 0) {
        if (window.retroAudio && window.retroAudio.playDespawnFizzle) {
          window.retroAudio.playDespawnFizzle();
        }
        return;
      }
      currentAmmo--;
      updateHUD();
    }

    // 1. Audio SFX
    window.retroAudio.playLaserShoot();

    // 2. Weapon 3D Recoil Kick & Muzzle Flash (Snapped to 3D tip)
    triggerWeaponRecoil();

    // 3. Laser Tracer Beam from 3D weapon barrel tip to click point
    createLaserTracer(clientX, clientY);

    // 4. Crosshair Recoil Effect
    if (customCrosshair) {
      customCrosshair.classList.add('crosshair-recoil');
      setTimeout(() => customCrosshair.classList.remove('crosshair-recoil'), 120);
    }

    // 5. Dual Hit Detection: DOM element check + Radius Check
    let hitTargetObj = null;
    const targetElement = hitElement ? hitElement.closest('.game-target') : null;

    if (targetElement) {
      const targetId = targetElement.dataset.targetId;
      hitTargetObj = activeTargets.find(t => t.id === targetId);
    }

    if (!hitTargetObj && activeTargets.length > 0) {
      const hitRadius = 45;
      let closestDist = Infinity;
      for (const t of activeTargets) {
        const d = Math.hypot(t.x - clientX, t.y - clientY);
        if (d <= hitRadius && d < closestDist) {
          closestDist = d;
          hitTargetObj = t;
        }
      }
    }

    if (hitTargetObj) {
      if (currentRound === 1) {
        handleRound1TargetHit(hitTargetObj);
      } else if (currentRound === 2) {
        handleRound2TargetHit(hitTargetObj);
      } else if (currentRound === 3) {
        handleRound3TargetHit(hitTargetObj);
      } else if (currentRound === 4) {
        handleRound4TargetHit(hitTargetObj);
      }
    } else {
      shotsFired++;
      targetsMissed++;
      currentStreak = 0;
      updateHUD();
      createMissSparks(clientX, clientY);

      // Check if ammo ran out on miss for Round 2 or Round 3
      if (currentRound === 2 && currentAmmo === 0) {
        const remaining = Math.max(0, GAME_CONFIG.ROUND_2.totalTargets - round2TargetsHit);
        if (remaining > 0) {
          showAmmoOverNotification(remaining, () => {
            round2TargetsSpawned = 0;
            round2TargetsHit = 0;
            triggerRoundIntermission(2);
          });
        }
      } else if (currentRound === 3 && currentAmmo === 0) {
        const remaining = activeTargets.length + (round3Wave === 1 ? 10 : 0);
        if (remaining > 0) {
          showAmmoOverNotification(remaining, () => {
            triggerRoundIntermission(3);
          });
        }
      }
    }
  }

  function getBarrelTipScreenPos() {
    if (fpvTipMesh && fpvCamera && fpvThreeCanvas) {
      const tipWorld = new THREE.Vector3();
      fpvTipMesh.getWorldPosition(tipWorld);
      tipWorld.project(fpvCamera);

      const canvasRect = fpvThreeCanvas.getBoundingClientRect();
      const screenX = canvasRect.left + ((tipWorld.x + 1) * canvasRect.width) / 2;
      const screenY = canvasRect.top + ((-tipWorld.y + 1) * canvasRect.height) / 2;

      if (screenX > 0 && screenY > 0) {
        return { x: screenX, y: screenY };
      }
    }
    return { x: window.innerWidth * 0.78, y: window.innerHeight * 0.82 };
  }

  function triggerWeaponRecoil() {
    // 3D Recoil impulse
    recoilRecoilZ = -14;
    recoilPitch = -0.16;

    // Snap Muzzle Flash origin directly to 3D barrel tip
    const tipPos = getBarrelTipScreenPos();
    if (muzzleFlash) {
      muzzleFlash.style.left = `${tipPos.x}px`;
      muzzleFlash.style.top = `${tipPos.y}px`;
      muzzleFlash.classList.add('active');
      setTimeout(() => muzzleFlash.classList.remove('active'), 65);
    }
  }

  function createLaserTracer(destX, destY) {
    const tipPos = getBarrelTipScreenPos();
    laserTracers.push({
      x1: tipPos.x,
      y1: tipPos.y,
      x2: destX,
      y2: destY,
      alpha: 1.0,
      width: 4.5,
      color: '#00fdfa'
    });
  }

  function createMissSparks(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 2;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 2,
        color: '#f600ff',
        alpha: 1.0,
        decay: Math.random() * 0.05 + 0.04
      });
    }
  }

  // ==========================================================================
  // TARGET & BOMB FACTORY (DOM + SVG)
  // ==========================================================================
  function createTargetElement({ id, x, y, isBomb = false, hasTimerRing = false }) {
    const el = document.createElement('div');
    el.className = `game-target ${isBomb ? 'is-bomb' : ''}`;
    el.dataset.targetId = id;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    let timerSvgHtml = '';
    if (hasTimerRing) {
      timerSvgHtml = `
        <svg class="countdown-svg-timer" viewBox="0 0 88 88">
          <circle class="timer-circle-track" cx="44" cy="44" r="40" />
          <circle class="timer-circle-progress" cx="44" cy="44" r="40" />
        </svg>
      `;
    }

    el.innerHTML = `
      ${timerSvgHtml}
      <div class="target-graphic">
        <div class="target-outer-ring"></div>
        <div class="target-geo-ring"></div>
        <div class="target-inner-ring"></div>
        <div class="target-core"></div>
        <div class="target-cross h"></div>
        <div class="target-cross v"></div>
      </div>
    `;

    if (isBomb) {
      el.addEventListener('mouseenter', () => {
        if (customCrosshair) customCrosshair.classList.add('hazard-lock');
      });
      el.addEventListener('mouseleave', () => {
        if (customCrosshair) customCrosshair.classList.remove('hazard-lock');
      });
    }

    targetArena.appendChild(el);

    const targetObj = { id, x, y, isBomb, el };
    activeTargets.push(targetObj);
    return el;
  }

  function removeTarget(targetObj) {
    if (targetObj.el && targetObj.el.parentNode) {
      targetObj.el.parentNode.removeChild(targetObj.el);
    }
    activeTargets = activeTargets.filter(t => t.id !== targetObj.id);
    if (customCrosshair) customCrosshair.classList.remove('hazard-lock');
  }

  function clearTargetArena() {
    activeTargets.forEach(t => {
      if (t.el && t.el.parentNode) {
        t.el.parentNode.removeChild(t.el);
      }
    });
    activeTargets = [];
    round3MovingTargets = [];
    if (customCrosshair) customCrosshair.classList.remove('hazard-lock');
  }

  function isInsideGunZone(x, y, radius = 45) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // FPV Weapon rig sits in bottom right (width 600px, height 600px).
    // Bounds check ensures targets and their hit radii never intersect gun elements.
    const gunMarginX = Math.min(480, w * 0.40) + radius;
    const gunMarginY = Math.min(420, h * 0.48) + radius;
    return (x > w - gunMarginX && y > h - gunMarginY);
  }

  function generateNonOverlappingCoords(count, targetSize, bounds) {
    const coords = [];
    const padding = 25;
    const minDistance = targetSize + 25;
    const maxAttempts = 350;

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let valid = false;
      let pos = null;

      while (!valid && attempts < maxAttempts) {
        attempts++;
        const x = bounds.left + padding + Math.random() * (bounds.width - padding * 2);
        const y = bounds.top + padding + Math.random() * (bounds.height - padding * 2);

        // Prevent target spawns behind or intersecting gun
        if (isInsideGunZone(x, y, targetSize / 2)) {
          continue;
        }

        valid = true;
        for (let j = 0; j < coords.length; j++) {
          const dist = Math.hypot(coords[j].x - x, coords[j].y - y);
          if (dist < minDistance) {
            valid = false;
            break;
          }
        }

        if (valid) pos = { x, y };
      }

      if (pos) {
        coords.push(pos);
      } else {
        // Safe fallback outside gun area
        const safeWidth = Math.min(bounds.width * 0.72, window.innerWidth - 480);
        coords.push({
          x: bounds.left + 40 + (i % 5) * (safeWidth / 5),
          y: bounds.top + 60 + Math.floor(i / 5) * 70
        });
      }
    }
    return coords;
  }

  function getArenaBounds() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      left: w * 0.12,
      top: h * 0.16,
      width: w * 0.76,
      height: h * 0.58
    };
  }

  // ==========================================================================
  // PARTICLE SYSTEM & VISUAL EFFECTS
  // ==========================================================================
  function triggerTargetExplosion(x, y, isBomb = false) {
    const count = isBomb ? 45 : 28;
    const color = isBomb ? '#ff003c' : '#00fdfa';
    const subColor = isBomb ? '#ff7700' : '#f600ff';

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isBomb ? 9 : 6) + 2;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.4 ? color : subColor,
        alpha: 1.0,
        decay: Math.random() * 0.035 + 0.02
      });
    }

    particles.push({
      x: x,
      y: y,
      isRing: true,
      radius: 10,
      maxRadius: isBomb ? 90 : 55,
      growSpeed: isBomb ? 6 : 4,
      color: color,
      alpha: 1.0,
      decay: 0.04
    });
  }

  function triggerBombExplosion(x, y) {
    triggerTargetExplosion(x, y, true);
  }

  function spawnScorePopup(x, y, text, isPositive = true) {
    const el = document.createElement('div');
    el.className = `score-popup ${isPositive ? 'positive' : 'negative'}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    targetArena.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 850);
  }

  function triggerScreenShake() {
    appContainer.classList.add('screen-shake');
    setTimeout(() => appContainer.classList.remove('screen-shake'), 400);
  }

  function triggerScreenFlash() {
    screenFlash.classList.add('flash-active');
    setTimeout(() => screenFlash.classList.remove('flash-active'), 180);
  }

  // ==========================================================================
  // HUD UPDATES & METRICS
  // ==========================================================================
  function updateHUD() {
    hudScoreVal.textContent = score;

    let targetsRemaining = 0;
    if (currentRound === 1) {
      hudRoundVal.textContent = '1/4';
      hudRoundName.textContent = 'GRID CLEAR';
      let remaining = activeTargets.length;
      for (let w = currentWave; w < 3; w++) {
        remaining += GAME_CONFIG.ROUND_1.targetsPerWave[w];
      }
      targetsRemaining = remaining;
    } else if (currentRound === 2) {
      hudRoundVal.textContent = '2/4';
      hudRoundName.textContent = 'REFLEX SNAP';
      targetsRemaining = Math.max(0, GAME_CONFIG.ROUND_2.totalTargets - round2TargetsHit);
    } else if (currentRound === 3) {
      hudRoundVal.textContent = '3/4';
      hudRoundName.textContent = 'KINETIC DRIFT';
      targetsRemaining = activeTargets.length + (round3Wave === 1 ? 10 : 0);
    } else if (currentRound === 4) {
      hudRoundVal.textContent = '4/4';
      hudRoundName.textContent = 'TIME & HAZARDS';
      targetsRemaining = round4Queue.length + (round4CurrentItem ? 1 : 0);
    }
    hudTargetsVal.textContent = targetsRemaining;

    if (hudAmmoVal) {
      hudAmmoVal.textContent = currentAmmo === Infinity ? '∞' : currentAmmo;
      if (currentAmmo !== Infinity && currentAmmo <= 5) {
        hudAmmoVal.className = 'hud-value hud-glow-pink';
      } else {
        hudAmmoVal.className = 'hud-value hud-glow-green';
      }
    }

    const acc = calculateAccuracy();
    hudAccuracyVal.textContent = acc + '%';

    if (currentStreak >= 3) {
      hudStreakTag.classList.remove('hidden');
      hudStreakTag.textContent = `${currentStreak}X STREAK!`;
    } else {
      hudStreakTag.classList.add('hidden');
    }

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'RETRO_BLAST_SCORE',
        score: score,
        round: currentRound
      }, '*');
    }
  }

  function calculateAccuracy() {
    if (shotsFired === 0) return 100;
    return Math.min(100, Math.max(0, Math.round((targetsHit / shotsFired) * 100)));
  }

  function recordReactionTime() {
    if (itemSpawnTimestamp > 0) {
      const dt = Math.round(performance.now() - itemSpawnTimestamp);
      reactionTimes.push(dt);
    }
  }

  // ==========================================================================
  // PAUSE & RESUME
  // ==========================================================================
  function pauseGame() {
    if (gameState !== STATES.PLAYING) return;
    gameState = STATES.PAUSED;
    pauseOverlay.classList.remove('hidden');
  }

  function resumeGame() {
    if (gameState !== STATES.PAUSED) return;
    gameState = STATES.PLAYING;
    pauseOverlay.classList.add('hidden');
  }

  function abortToMenu() {
    pauseOverlay.classList.add('hidden');
    returnToMainMenu();
  }

  // ==========================================================================
  // MAIN RENDER LOOP (60FPS CANVAS + THREE.JS WEAPON + KINETIC TARGETS)
  // ==========================================================================
  function mainRenderLoop(timestamp) {
    renderStarfield();
    renderFX();
    updateKineticTargets();
    updateFPVWeaponAnimation(timestamp);
    requestAnimationFrame(mainRenderLoop);
  }

  function renderFX() {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    // 1. Render Laser Tracers
    for (let i = laserTracers.length - 1; i >= 0; i--) {
      const beam = laserTracers[i];
      fxCtx.save();
      fxCtx.strokeStyle = beam.color;
      fxCtx.lineWidth = beam.width;
      fxCtx.shadowColor = beam.color;
      fxCtx.shadowBlur = 15;
      fxCtx.globalAlpha = beam.alpha;

      fxCtx.beginPath();
      fxCtx.moveTo(beam.x1, beam.y1);
      fxCtx.lineTo(beam.x2, beam.y2);
      fxCtx.stroke();

      fxCtx.strokeStyle = '#ffffff';
      fxCtx.lineWidth = beam.width * 0.4;
      fxCtx.shadowBlur = 4;
      fxCtx.beginPath();
      fxCtx.moveTo(beam.x1, beam.y1);
      fxCtx.lineTo(beam.x2, beam.y2);
      fxCtx.stroke();

      fxCtx.restore();

      beam.alpha -= 0.12;
      beam.width *= 0.88;
      if (beam.alpha <= 0) {
        laserTracers.splice(i, 1);
      }
    }

    // 2. Render Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.isRing) {
        fxCtx.save();
        fxCtx.strokeStyle = p.color;
        fxCtx.lineWidth = 2.5;
        fxCtx.shadowColor = p.color;
        fxCtx.shadowBlur = 12;
        fxCtx.globalAlpha = p.alpha;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.restore();

        p.radius += p.growSpeed;
        p.alpha -= p.decay;
        if (p.alpha <= 0 || p.radius >= p.maxRadius) {
          particles.splice(i, 1);
        }
      } else {
        fxCtx.save();
        fxCtx.fillStyle = p.color;
        fxCtx.shadowColor = p.color;
        fxCtx.shadowBlur = 8;
        fxCtx.globalAlpha = p.alpha;
        fxCtx.fillRect(p.x, p.y, p.size, p.size);
        fxCtx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14;
        p.vx *= 0.96;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
        }
      }
    }
  }

  // Start initialization on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
