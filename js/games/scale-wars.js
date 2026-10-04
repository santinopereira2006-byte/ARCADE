/**
 * ARCADE - Game Module: Scale Wars (Round 1)
 * Fictional character size comparisons, estimation, and tactical reference scales
 */

import { SCALE_WARS_CHARACTERS } from "../data/round1-scale.js";

// Persistent pool for preloaded & pre-rendered <model-viewer> elements
const modelViewerPool = new Map();
let preloadPromise = null;

const POOL_CONTAINER_ID = "scale-wars-model-pool";

// Preload priority based on round question progression
const PRELOAD_PRIORITY = ["mario", "pikachu", "masterchief", "hulk", "megatron", "optimus", "shrek", "thanos"];

function getOrCreatePoolContainer() {
  let pool = document.getElementById(POOL_CONTAINER_ID);
  if (!pool) {
    pool = document.createElement("div");
    pool.id = POOL_CONTAINER_ID;
    pool.className = "scale-wars-model-pool";
    pool.setAttribute("aria-hidden", "true");
    document.body.appendChild(pool);
  }
  return pool;
}

function createPooledModelViewer(char) {
  const mv = document.createElement("model-viewer");
  mv.setAttribute("src", char.glbSrc);
  mv.setAttribute("alt", (char ? char.name : "Character") + " 3D Model");
  mv.setAttribute("auto-rotate", "");
  mv.setAttribute("auto-rotate-delay", "0");
  mv.setAttribute("rotation-per-second", "30deg");
  mv.setAttribute("camera-controls", "");
  mv.setAttribute("touch-action", "pan-y");
  mv.setAttribute("interaction-prompt", "none");
  mv.setAttribute("shadow-intensity", "0.8");
  mv.setAttribute("shadow-softness", "0.8");
  mv.setAttribute("environment-image", "neutral");
  mv.setAttribute("exposure", "1.15");
  mv.setAttribute("bounds", "tight");
  mv.setAttribute("autoplay", "");
  mv.setAttribute("loading", "eager");
  mv.setAttribute("reveal", "auto");
  mv.style.width = "100%";
  mv.style.height = "100%";
  mv.style.background = "transparent";
  mv.dataset.charId = char.id;
  mv.dataset.glb = char.glbSrc;

  mv.addEventListener("load", () => {
    mv.dataset.modelLoaded = "true";
  });

  mv.addEventListener("error", (e) => {
    console.warn(`Scale Wars model failed to load (${char.glbSrc}):`, e);
    mv.dataset.modelError = "true";
    if (char && char.svg && mv.parentElement && !mv.parentElement.classList.contains("scale-wars-model-pool")) {
      const fallbackDiv = document.createElement("div");
      fallbackDiv.innerHTML = char.svg;
      mv.replaceWith(fallbackDiv.firstElementChild || fallbackDiv);
    }
  });

  return mv;
}

/**
 * Preloads and pre-renders all 3D models used in Scale Wars.
 * Configures modelCacheSize and creates <model-viewer> elements in a hidden pool.
 */
export async function preloadScaleWarsModels() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    if (!customElements.get("model-viewer")) {
      try {
        await Promise.race([
          customElements.whenDefined("model-viewer"),
          new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
      } catch (err) {
        console.warn("model-viewer definition wait timeout:", err);
      }
    }

    // Set modelCacheSize so loaded GLTF models are retained in GPU/memory cache
    const MVE = customElements.get("model-viewer");
    if (MVE && typeof MVE.modelCacheSize !== "undefined") {
      try {
        MVE.modelCacheSize = 25;
      } catch (_) {}
    }

    const pool = getOrCreatePoolContainer();

    // 1. First preload in order of questions (Q1, then Q2, then Q3)
    for (const charId of PRELOAD_PRIORITY) {
      const char = SCALE_WARS_CHARACTERS[charId];
      if (char && char.glbSrc && !modelViewerPool.has(charId)) {
        const mv = createPooledModelViewer(char);
        modelViewerPool.set(charId, mv);
        pool.appendChild(mv);
      }
    }

    // 2. Preload any remaining characters with glbSrc
    for (const char of Object.values(SCALE_WARS_CHARACTERS)) {
      if (char.glbSrc && !modelViewerPool.has(char.id)) {
        const mv = createPooledModelViewer(char);
        modelViewerPool.set(char.id, mv);
        pool.appendChild(mv);
      }
    }
  })();

  return preloadPromise;
}

/**
 * Reclaims active <model-viewer> elements currently displayed in the game arena
 * and stores them safely back in the persistent pool container before DOM rewrites.
 * This prevents their WebGL context / Three.js scenes from being disposed!
 */
export function reclaimActiveModelViewers() {
  const pool = getOrCreatePoolContainer();
  const activeMvs = document.querySelectorAll(
    "#gameArena model-viewer, .character-card model-viewer, .size-it-up-stage model-viewer, .estimation-stage model-viewer"
  );
  activeMvs.forEach((mv) => {
    const charId = mv.dataset.charId;
    if (charId && modelViewerPool.has(charId)) {
      pool.appendChild(mv);
      // Reset camera orbit to default if needed
      try {
        if (mv.cameraOrbit) mv.cameraOrbit = "0deg 75deg 105%";
      } catch (_) {}
    }
  });
}

/**
 * Returns inline media HTML for a character.
 * If the model is already preloaded, omits the loading spinner for an instant experience.
 */
function charMediaHTML(char) {
  if (char.glbSrc) {
    const mv = modelViewerPool.get(char.id);
    const isLoaded = Boolean(mv && (mv.dataset.modelLoaded === "true" || mv.loaded));
    return `<div class="mv-slot" data-char-id="${char.id}" data-glb="${char.glbSrc}" data-color="${char.color}">
              ${isLoaded ? '' : `
              <div class="mv-loading-spinner" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
                <div style="width:28px;height:28px;border:3px solid rgba(0,240,255,0.2);border-top-color:${char.color};border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                <span style="color:${char.color};font-family:var(--font-tech,sans-serif);font-size:12px;letter-spacing:1px;font-weight:600;">LOADING 3D MODEL…</span>
              </div>`}
            </div>`;
  }
  return char.svg;
}

/**
 * Replaces every .mv-slot with its corresponding preloaded <model-viewer> element
 * from the persistent pool. Instant display if already loaded!
 */
export function mountModelViewers() {
  const slots = document.querySelectorAll(".mv-slot");
  if (!slots.length) return;

  const pool = getOrCreatePoolContainer();

  slots.forEach((slot) => {
    const glbSrc = slot.dataset.glb;
    const charId = slot.dataset.charId;
    const char = SCALE_WARS_CHARACTERS[charId];
    if (!glbSrc || !charId) return;

    let mv = modelViewerPool.get(charId);
    if (!mv) {
      mv = createPooledModelViewer(char || { id: charId, glbSrc, name: "Character" });
      modelViewerPool.set(charId, mv);
      pool.appendChild(mv);
    }

    if (mv.dataset.modelError === "true" && char && char.svg) {
      const fallbackDiv = document.createElement("div");
      fallbackDiv.innerHTML = char.svg;
      slot.replaceWith(fallbackDiv.firstElementChild || fallbackDiv);
      return;
    }

    // Seamlessly swap the slot with the pre-rendered model-viewer
    slot.replaceWith(mv);

    // If model fails after insertion, gracefully fall back to SVG
    mv.addEventListener("error", () => {
      if (char && char.svg && mv.parentElement) {
        const fallbackDiv = document.createElement("div");
        fallbackDiv.innerHTML = char.svg;
        mv.replaceWith(fallbackDiv.firstElementChild || fallbackDiv);
      }
    }, { once: true });
  });
}

export class ScaleWarsRenderer {
  static preloadAllModels() {
    return preloadScaleWarsModels();
  }

  static reclaimModelViewers() {
    reclaimActiveModelViewers();
  }

  static mountModelViewers() {
    mountModelViewers();
  }

  static isModelLoaded(charId) {
    const mv = modelViewerPool.get(charId);
    return Boolean(mv && (mv.dataset.modelLoaded === "true" || mv.loaded));
  }

  static renderQuestion(question, onSelectAnswer, onEstimateSubmit, onPass) {
    // Reclaim active model-viewers to the pool before rendering new question
    reclaimActiveModelViewers();

    if (question.type === "comparison") {
      return this.renderComparison(question, onSelectAnswer, onPass);
    } else if (question.type === "size_it_up" || question.type === "interactive_scale") {
      return this.renderSizeItUp(question, onEstimateSubmit, onPass);
    } else {
      return this.renderEstimation(question, onEstimateSubmit, onPass);
    }
  }

  static renderSizeItUp(question, onEstimateSubmit, onPass) {
    const char = SCALE_WARS_CHARACTERS[question.character] || SCALE_WARS_CHARACTERS.megatron;
    const refChar = SCALE_WARS_CHARACTERS[question.referenceItem] || SCALE_WARS_CHARACTERS.optimus;
    const minM = question.minM || 1.0;
    const maxM = question.maxM || 20.0;
    const initialM = question.initialM || 6.00;
    const refLenM = question.referenceLengthM || 8.50;

    const html = `
      <div class="scale-wars-container size-it-up-container">
        <!-- Top Banner -->
        <div class="game-instruction-banner">
          <div class="size-it-up-subbar">${question.subPrompt || "Guess: Megatron · Decepticon Leader · Height | Reference: Optimus Prime · 8.50 m"}</div>
          <h2 class="game-headline size-it-up-title">${question.question}</h2>
        </div>

        <!-- Interactive Dark Mode Cyber Stage -->
        <div class="size-it-up-stage dark-cyber-stage" id="sizeItUpStage">
          <div class="size-stage-grid"></div>
          <div class="stage-cyber-scanlines"></div>

          <!-- Reference Entity: Optimus Prime (Left) -->
          <div class="reference-entity-anchor dark-ref-anchor">
            <div class="ref-entity-label">
              <span class="ref-icon-sq">■</span> ${question.referenceLabel || "Optimus Prime 8.50 m · 27.89 ft tall"}
            </div>
            <div class="ref-dimension-bar">
              <span class="dim-tick-l">|</span>
              <span class="dim-line"></span>
              <span class="dim-tick-r">|</span>
            </div>
            <div class="ref-entity-graphic">
              ${charMediaHTML(refChar)}
            </div>
          </div>

          <!-- Resizable Target: Megatron (Center / Right) -->
          <div class="scalable-target-anchor dark-target-anchor" id="scalableTargetAnchor">
            <!-- Dynamic Height Drop Line -->
            <div class="target-height-guide" id="targetHeightGuide"></div>

            <!-- Floating Dark Cyber Dimension Tooltip -->
            <div class="size-dimension-tooltip dark-cyber-tooltip" id="sizeDimensionTooltip">
              <span class="m-val neon-cyan" id="liveMetersDisplay">${initialM.toFixed(2)} m</span>
              <span class="sep">·</span>
              <span class="ft-val neon-amber" id="liveFeetDisplay">${(initialM * 3.28084).toFixed(2)} ft tall</span>
            </div>

            <!-- Resize Corner Handle Tag -->
            <div class="resize-handle-tag dark-resize-handle" id="resizeHandleTag" title="Drag to resize">
              <span>↗</span>
            </div>

            <!-- Target 3D Model / Graphic Body -->
            <div class="target-scalable-graphic" id="targetScalableGraphic">
              ${charMediaHTML(char)}
            </div>
          </div>

          <!-- Ground Baseline -->
          <div class="size-stage-ground-baseline dark-cyber-ground"></div>
        </div>

        <!-- Bottom Interactive Dark Cyber Ruler Bar -->
        <div class="size-it-up-ruler-bar dark-cyber-ruler">
          <div class="ruler-step-controls">
            <button type="button" class="btn-ruler-step dark-step-btn" id="btnSizeMinus" title="Decrease Size">−</button>
            <button type="button" class="btn-ruler-step dark-step-btn" id="btnSizePlus" title="Increase Size">+</button>
          </div>

          <div class="ruler-track-container" id="rulerTrackContainer">
            <div class="ruler-track" id="rulerTrack">
              ${(() => {
                if (maxM <= 6) {
                  let marks = "";
                  for (let m = 0; m <= maxM; m += 0.5) {
                    const isMajor = (m % 1 === 0);
                    const pct = (m / maxM) * 100;
                    marks += `<div class="ruler-mark" style="left: ${pct.toFixed(2)}%"><span class="ruler-tick ${isMajor ? 'major' : ''}"></span>${isMajor ? `<span class="ruler-num">${m === 0 ? '0' : m + ' m'}</span>` : ''}</div>`;
                  }
                  return marks;
                } else {
                  let marks = "";
                  for (let m = 0; m <= maxM; m += 1) {
                    const isMajor = (m % 2 === 0);
                    const pct = (m / maxM) * 100;
                    marks += `<div class="ruler-mark" style="left: ${pct.toFixed(2)}%"><span class="ruler-tick ${isMajor ? 'major' : ''}"></span>${isMajor ? `<span class="ruler-num">${m === 0 ? '0' : m + ' m'}</span>` : ''}</div>`;
                  }
                  return marks;
                }
              })()}

              <!-- Red Slider Cursor Needle -->
              <div class="ruler-cursor-indicator dark-cursor" id="rulerCursorIndicator">
                <div class="ruler-cursor-needle"></div>
                <div class="ruler-cursor-thumb"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="size-it-up-footer dark-cyber-footer">
          <div class="size-it-up-hint">
            Slide anywhere on the board to resize · then <strong class="neon-cyan-text">Lock in</strong>
          </div>
          <div class="size-it-up-actions">
            <button type="button" class="btn-arcade-pass" id="btnPass">
              ⏭️ PASS (0 PTS)
            </button>
            <button type="button" class="btn-primary-gaming btn-lock-in-cyber" id="btnLockInSize">
              <span class="lock-icon">☑</span> LOCK IN
            </button>
          </div>
        </div>
      </div>
    `;

    // Mount interactive events & 3D models
    setTimeout(() => {
      mountModelViewers();
      this.mountSizeItUpEvents(minM, maxM, initialM, refLenM, onEstimateSubmit, onPass);
    }, 0);

    return html;
  }

  static mountSizeItUpEvents(minM, maxM, initialM, refLenM, onEstimateSubmit, onPass) {
    let currentM = initialM;
    const stage = document.getElementById("sizeItUpStage");
    const targetAnchor = document.getElementById("scalableTargetAnchor");
    const targetGraphic = document.getElementById("targetScalableGraphic");
    const liveM = document.getElementById("liveMetersDisplay");
    const liveFt = document.getElementById("liveFeetDisplay");
    const rulerTrack = document.getElementById("rulerTrack");
    const cursor = document.getElementById("rulerCursorIndicator");
    const btnMinus = document.getElementById("btnSizeMinus");
    const btnPlus = document.getElementById("btnSizePlus");
    const btnLock = document.getElementById("btnLockInSize");
    const btnPassEl = document.getElementById("btnPass");

    if (!stage || !targetAnchor || !cursor) return;

    // Reference baseline height (matches Optimus Prime 210px at 8.5m)
    const BASE_HEIGHT_PX = 210;
    const BASE_WIDTH_PX = 180;

    const renderScale = (m) => {
      currentM = Math.max(minM, Math.min(maxM, parseFloat(m.toFixed(2))));

      if (liveM) liveM.textContent = `${currentM.toFixed(2)} m`;
      if (liveFt) liveFt.textContent = `${(currentM * 3.28084).toFixed(2)} ft tall`;

      // Proportional pixel scaling relative to reference entity height
      const scaleFactor = currentM / refLenM; // e.g. 10.67 / 8.50 = 1.255
      const targetHeightPx = Math.round(BASE_HEIGHT_PX * scaleFactor);
      const targetWidthPx = Math.round(BASE_WIDTH_PX * scaleFactor);

      if (targetAnchor) {
        // Guarantee character model stays clearly visible (at least 55px tall)
        const displayH = Math.max(55, targetHeightPx);
        const displayW = Math.max(48, targetWidthPx);
        targetAnchor.style.height = `${displayH}px`;
        targetAnchor.style.width = `${displayW}px`;
      }

      if (targetGraphic) {
        targetGraphic.style.transform = "none";
        targetGraphic.style.height = "100%";
        targetGraphic.style.width = "100%";
      }

      // Cursor position on 0m -> maxM track
      const pct = Math.max(0, Math.min(100, (currentM / maxM) * 100));
      if (cursor) {
        cursor.style.left = `${pct}%`;
      }
    };

    renderScale(currentM);

    // 1. Slider Track Drag & Click
    let isDraggingRuler = false;
    const updateFromRulerEvent = (e) => {
      const rect = rulerTrack.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const fraction = relX / rect.width;
      const newM = fraction * maxM;
      renderScale(newM);
    };

    if (rulerTrack) {
      rulerTrack.addEventListener("mousedown", (e) => {
        isDraggingRuler = true;
        updateFromRulerEvent(e);
      });
      rulerTrack.addEventListener("touchstart", (e) => {
        isDraggingRuler = true;
        updateFromRulerEvent(e);
      }, { passive: true });
    }

    // 2. Stage Dragging / Sliding (Vertical & Horizontal Gestures)
    let isDraggingStage = false;
    let startY = 0;
    let startM = currentM;

    const startStageDrag = (clientY) => {
      isDraggingStage = true;
      startY = clientY;
      startM = currentM;
    };

    const moveStageDrag = (clientY) => {
      if (!isDraggingStage) return;
      const deltaY = startY - clientY; // Dragging UP increases size
      const deltaM = (deltaY / 220) * (maxM * 0.4); // Responsive sensitivity
      renderScale(startM + deltaM);
    };

    stage.addEventListener("mousedown", (e) => {
      if (e.target.closest(".btn-ruler-step") || e.target.closest(".ruler-track")) return;
      startStageDrag(e.clientY);
    });

    stage.addEventListener("touchstart", (e) => {
      if (e.target.closest(".btn-ruler-step") || e.target.closest(".ruler-track")) return;
      startStageDrag(e.touches[0].clientY);
    }, { passive: true });

    // Global Window Move and Up
    const onPointerMove = (e) => {
      if (isDraggingRuler) {
        updateFromRulerEvent(e);
      } else if (isDraggingStage) {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        moveStageDrag(clientY);
      }
    };

    const onPointerUp = () => {
      isDraggingRuler = false;
      isDraggingStage = false;
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);

    // 3. Step buttons (-) and (+)
    const stepDelta = maxM <= 6 ? 0.05 : 0.25;
    if (btnMinus) {
      btnMinus.addEventListener("click", () => {
        renderScale(currentM - stepDelta);
      });
    }
    if (btnPlus) {
      btnPlus.addEventListener("click", () => {
        renderScale(currentM + stepDelta);
      });
    }

    // 4. Keyboard Arrow Controls
    const arrowDelta = maxM <= 6 ? 0.02 : 0.1;
    const onKeyDown = (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        renderScale(currentM + arrowDelta);
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        renderScale(currentM - arrowDelta);
      } else if (e.key === "Enter") {
        if (onEstimateSubmit) onEstimateSubmit(currentM);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    // 5. Lock In / Submit Button
    if (btnLock) {
      btnLock.addEventListener("click", () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        if (onEstimateSubmit) {
          onEstimateSubmit(currentM);
        }
      });
    }

    // 6. Pass Button
    if (btnPassEl) {
      btnPassEl.addEventListener("click", () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("mousemove", onPointerMove);
        window.removeEventListener("mouseup", onPointerUp);
        if (onPass) {
          onPass();
        }
      });
    }
  }

  static renderComparison(question, onSelectAnswer, onPass) {
    const charA = SCALE_WARS_CHARACTERS[question.characterA];
    const charB = SCALE_WARS_CHARACTERS[question.characterB];

    const html = `
      <div class="scale-wars-container">
        <div class="game-instruction-banner">
          <span class="game-badge">ROUND 1: SCALE WARS</span>
          <h2 class="game-headline">${question.question}</h2>
          <p class="game-sub">${charA.name} VS ${charB.name} — Select the taller or larger entity</p>
        </div>

        <div class="comparison-stage">
          <!-- Card A -->
          <div class="character-card" id="cardA">
            <div class="card-tag">CHARACTER A</div>
            <div class="card-media">
              ${charMediaHTML(charA)}
              <div class="laser-height-gauge">
                <span class="gauge-mark apex">MAX</span>
                <span class="gauge-mark base">0m</span>
              </div>
            </div>
            <div class="card-details">
              <h3 class="char-name">${charA.name}</h3>
              <span class="char-franchise">${charA.franchise}</span>
              <span class="char-category">${charA.category}</span>
            </div>
            <button type="button" class="btn-select-entity btn-choice-opt" data-choice="${charA.id}">
              SELECT ${charA.name.toUpperCase()}
            </button>
          </div>

          <div class="vs-divider">
            <div class="vs-circle">VS</div>
            <div class="vs-laser-beam"></div>
          </div>

          <!-- Card B -->
          <div class="character-card" id="cardB">
            <div class="card-tag">CHARACTER B</div>
            <div class="card-media">
              ${charMediaHTML(charB)}
              <div class="laser-height-gauge">
                <span class="gauge-mark apex">MAX</span>
                <span class="gauge-mark base">0m</span>
              </div>
            </div>
            <div class="card-details">
              <h3 class="char-name">${charB.name}</h3>
              <span class="char-franchise">${charB.franchise}</span>
              <span class="char-category">${charB.category}</span>
            </div>
            <button type="button" class="btn-select-entity btn-choice-opt" data-choice="${charB.id}">
              SELECT ${charB.name.toUpperCase()}
            </button>
          </div>
        </div>

        <div class="game-action-footer">
          <button type="button" class="btn-arcade-pass" id="btnPass">
            ⏭️ PASS (0 PTS)
          </button>
        </div>
      </div>
    `;

    // Mount after innerHTML is written to DOM
    setTimeout(mountModelViewers, 0);

    return html;
  }

  static renderEstimation(question, onEstimateSubmit, onPass) {
    const char = SCALE_WARS_CHARACTERS[question.character];

    const spotlightMedia = char.silhouetteSrc
      ? `<img src="${char.silhouetteSrc}" class="spotlight-silhouette-img ${char.id}-sil" alt="${char.name} Silhouette" />`
      : `<div class="estimation-silhouette">${charMediaHTML(char)}</div>`;

    const targetMedia = char.silhouetteSrc
      ? `<img src="${char.silhouetteSrc}" class="ref-sil-img ${char.id}-sil" alt="${char.name}" />`
      : `<div class="estimation-silhouette" style="height:100%;max-height:100%;display:flex;align-items:flex-end;justify-content:center;">${charMediaHTML(char)}</div>`;

    const html = `
      <div class="scale-wars-container">
        <div class="game-instruction-banner">
          <span class="game-badge">ROUND 1: SCALE WARS</span>
          <h2 class="game-headline">${question.question}</h2>
          <p class="game-sub">Use the tactical reference scale to calibrate your estimate in metres</p>
        </div>

        <div class="estimation-stage">
          <!-- Spotlight Character Card -->
          <div class="character-spotlight-card">
            <span class="classified-tag">⚡ CLASSIFIED TARGET SILHOUETTE</span>
            <div class="spotlight-media">${spotlightMedia}</div>
            <div class="spotlight-meta">
              <h3 class="spotlight-name">${char.name}</h3>
              <span class="spotlight-franchise">${char.franchise}</span>
              <span class="spotlight-category">${char.category}</span>
            </div>
          </div>

          <!-- Tactical Reference Scale Bar -->
          <div class="reference-scale-container">
            <div class="reference-scale-header">
              <span class="scale-icon">📐</span>
              <span class="scale-title">TACTICAL REFERENCE SCALE</span>
              <span class="scale-subtitle">HUMAN (1.8m) → CAR (4.5m) → BUILDING (30m) → TARGET</span>
            </div>
            <div class="reference-scale-stage">
              <div class="scale-col">
                <div class="scale-box" style="height: 25%">
                  <img src="assets/human_silhouette.svg" class="ref-sil-img human-sil" alt="Human (1.8m)" />
                </div>
                <div class="scale-base"><span>HUMAN</span><strong>1.8m</strong></div>
              </div>
              <div class="scale-col">
                <div class="scale-box" style="height: 40%">
                  <img src="assets/car_silhouette.png" class="ref-sil-img car-sil" alt="Car (4.5m)" />
                </div>
                <div class="scale-base"><span>CAR</span><strong>4.5m</strong></div>
              </div>
              <div class="scale-col">
                <div class="scale-box" style="height: 70%">
                  <img src="assets/building_transparent.png" class="ref-sil-img building-sil" alt="Building (30m)" />
                </div>
                <div class="scale-base"><span>BUILDING</span><strong>30m</strong></div>
              </div>
              <div class="scale-col target-col">
                <div class="scale-box" style="height: 90%">
                  ${targetMedia}
                  <div class="mystery-tag">???</div>
                </div>
                <div class="scale-base target-base"><span>${char.name.toUpperCase()}</span><strong class="neon-cyan">??? m</strong></div>
              </div>
            </div>
          </div>

          <!-- Numerical Estimation Input -->
          <div class="estimation-input-card">
            <label for="numericalEstimateInput" class="estimation-label">ENTER ESTIMATE IN METRES:</label>
            <div class="estimation-input-group">
              <input type="number" id="numericalEstimateInput" class="arcade-num-input" placeholder="e.g. 50.0" step="0.1" min="0.1" max="2000" autofocus />
              <span class="input-unit">METRES</span>
              <button type="button" class="btn-primary-gaming" id="btnSubmitEstimate">
                SUBMIT &amp; LOCK
              </button>
            </div>
            <p class="tolerance-hint">🎯 Pinpoint accuracy earns the maximum 20 points!</p>
          </div>
        </div>

        <div class="game-action-footer">
          <button type="button" class="btn-arcade-pass" id="btnPass">
            ⏭️ PASS (0 PTS)
          </button>
        </div>
      </div>
    `;

    setTimeout(mountModelViewers, 0);

    return html;
  }
}
