/**
 * ARCADE - Main Tournament Application Controller
 * Orchestrates all 4 game modules, timers, scoring, organizer overrides, and lifecycle
 */

import { state } from "./state.js";
import { ArcadeTimer } from "./timer.js";
import { ArcadeUIController } from "./ui.js";
import { OrganizerConsole } from "./organizer.js";
import { LeaderboardManager } from "./leaderboard.js";
import { AuthManager } from "./auth.js";

import { ROUND1_SCALE_QUESTIONS } from "./data/round1-scale.js";
import { ROUND2_TECH_QUESTIONS } from "./data/round2-ctrl-alt.js";
import { ROUND3_MEME_TRIVIA, MEME_TEMPLATES, MEME_CORRECT_TEMPLATE_ID, MEME_CREATION_POINTS } from "./data/round3-memes.js";
import { BLACKOUT_LEVELS, ROUND4_CONFIG } from "./data/round4-blackout.js";

import { ScaleWarsRenderer } from "./games/scale-wars.js";
import { CtrlAltGuessRenderer } from "./games/ctrl-alt-guess.js";
import { MemeBattleRenderer } from "./games/meme-battle.js";
import { BlackoutBuildRenderer } from "./games/blackout-build.js";
import { RetroBlastRenderer } from "./games/retro-blast.js";
import { ROUND5_RETRO_BLAST_CONFIG } from "./data/round5-retro-blast.js";
import { retroAudio } from "./audio.js";
import { AntigravityBackground } from "./antigravity-bg.js";
import { TechText } from "./tech-text.js";
import { GradientText } from "./gradient-text.js";
import { SpotlightCard } from "./spotlight-card.js";
import { ArcadeCursor } from "./arcade-cursor.js";

class ArcadeApp {
  constructor() {
    this.audio = retroAudio;
    this.timer = new ArcadeTimer({
      onTick: (data) => this.ui.updateTimerDisplay(data),
      onWarning: (isWarn) => {
        const card = document.getElementById("hudTimerCard");
        if (card) card.classList.toggle("warning-danger", isWarn);
      },
      onExpire: () => this.handleTimerExpire()
    });

    this.ui = new ArcadeUIController(state, this.timer);
    this.organizer = new OrganizerConsole(state, this);
    this.retroBlast = null;
    this.room3d = null;
    this.antigravity = null;
    this.techText = null;
    this.gradientTexts = [];
    this.spotlightCards = [];
    this.cursor = null;

    // Selected meme state for Round 3 Phase B
    this.currentMemeTemplateId = "drake";
    this.currentMemePromptIdx = 0;

    // Low-stakes practice / warm-up mode state
    this.practice = { active: false, step: 0 };
  }

  init() {
    this.organizer.init();
    this.bindGlobalNavigation();
    this.ui.showScreen("screen-home");
    AuthManager.applyRoleVisibility();
    this.initAntigravity();
    this.initTechText();
    this.initGradientText();
    this.initSpotlightCards();
    this.initCursor();
    // Preload & pre-render all Scale Wars 3D models early in background
    ScaleWarsRenderer.preloadAllModels();
  }

  initAntigravity() {
    const bgCanvas = document.getElementById("antigravity-canvas");
    if (bgCanvas) {
      try {
        this.antigravity = new AntigravityBackground(bgCanvas, {
          count: 300,
          magnetRadius: 10,
          ringRadius: 10,
          waveSpeed: 0.3,
          waveAmplitude: 1,
          particleSize: 2,
          lerpSpeed: 0.1,
          color: "#FF9FFC",
          autoAnimate: false,
          particleVariance: 1,
          rotationSpeed: 0,
          depthFactor: 1,
          pulseSpeed: 3,
          particleShape: "capsule",
          fieldStrength: 10
        });
      } catch (err) {
        console.warn("Antigravity background failed:", err);
      }
    }
  }

  initTechText() {
    const container = document.getElementById("heroTechText");
    if (container) {
      try {
        this.techText = new TechText(container, {
          text: "ARCADE",
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 900,
          fontSize: 100,
          letterSpacing: -0.02,
          color: "#ffffff",
          accentColor: "#38bdf8",
          reveal: "letter",
          reach: 180,
          softness: 0.7,
          dashLength: 4,
          dashGap: 2,
          strokeWidth: 1.8,
          lineStyle: "dashed",
          specks: 15,
          selection: true,
          labels: true,
          draggable: true,
          sweep: true,
          speed: 1,
          align: "left",
          paddingLeft: 6
        });
      } catch (err) {
        console.warn("TechText initialization failed:", err);
      }
    }
  }

  initGradientText() {
    try {
      this.gradientTexts = GradientText.initAll();
    } catch (err) {
      console.warn("GradientText initialization failed:", err);
    }
  }

  initSpotlightCards() {
    try {
      this.spotlightCards = SpotlightCard.initAll();
    } catch (err) {
      console.warn("SpotlightCard initialization failed:", err);
    }
  }

  initCursor() {
    try {
      this.cursor = new ArcadeCursor({ lerpSpeed: 0.18 });
    } catch (err) {
      console.warn("ArcadeCursor initialization failed:", err);
    }
  }

  bindGlobalNavigation() {
    const participantLoginForm = document.getElementById("participantLoginForm");
    if (participantLoginForm) {
      participantLoginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const nameInput = document.getElementById("participantTeamName");
        const errorEl = document.getElementById("participantLoginError");
        const enteredName = (nameInput?.value || "").trim();

        if (!enteredName) {
          if (errorEl) errorEl.textContent = "Please enter your name or team name.";
          nameInput?.focus();
          return;
        }

        // Check if team already exists in roster by name (local or MongoDB)
        let team = await LeaderboardManager.findTeamByCredentialsAsync(enteredName, "");
        if (!team) {
          const roster = LeaderboardManager.getRoster();
          team = roster.find(t => t.name.toLowerCase() === enteredName.toLowerCase());
        }

        if (!team) {
          // Automatically register this participant/team
          team = LeaderboardManager.registerTeam({
            name: enteredName,
            department: "Arcade Arena",
            accessCode: LeaderboardManager.generateAccessCode()
          });
        }

        if (team.status === "completed") {
          if (errorEl) errorEl.textContent = "This team has already completed its tournament run. Please contact the admin desk.";
          return;
        }

        AuthManager.authenticateParticipant(team);
        AuthManager.applyRoleVisibility();
        // Clear any stale progress from a previous session before setting the new team
        state.clearProgress();
        state.reset();
        state.setTeam(team);
        if (errorEl) errorEl.textContent = "";

        // Update 3D HUD player tag, warp pilot display, and loading note
        const playerNameEl = document.getElementById("room3dPlayerName");
        if (playerNameEl) playerNameEl.textContent = team.name.toUpperCase();

        const pilotEl = document.getElementById("room3dLoadingPilot");
        if (pilotEl) pilotEl.textContent = team.name.toUpperCase();

        const loadingTitleEl = document.getElementById("room3dLoadingTitle");
        if (loadingTitleEl) loadingTitleEl.textContent = "WARPING INTO MECHA WORLD...";

        const loadingNoteEl = document.getElementById("room3dLoadingNote");
        if (loadingNoteEl) loadingNoteEl.textContent = `Pilot verified: ${team.name}. Streaming 3D arena assets…`;

        // Switch to the 3D room and boot the 3D models!
        this.enterArcadeRoom();
      });
    }

    const adminPortalBtn = document.getElementById("btnAdminPortal");
    if (adminPortalBtn) {
      adminPortalBtn.addEventListener("click", () => {
        this.showAdminAuthModal(() => {
          AuthManager.applyRoleVisibility();
          this.organizer.toggleModal();
        });
      });
    }

    document.querySelectorAll(".btn-start-arcade").forEach(btn => {
      btn.addEventListener("click", () => this.startGame());
    });

    document.querySelectorAll(".btn-show-how-to-play").forEach(btn => {
      btn.addEventListener("click", () => this.ui.showScreen("screen-how-to-play"));
    });

    document.querySelectorAll(".btn-start-practice").forEach(btn => {
      btn.addEventListener("click", () => this.startPracticeMode());
    });

    const showLeaderboard = () => {
      if (this.retroBlast) {
        this.retroBlast.destroy();
        this.retroBlast = null;
      }
      if (!AuthManager.isAdminAuthenticated()) {
        this.ui.showScreen("screen-home");
        return;
      }
      this.timer.stop();
      this.ui.renderLeaderboardScreen(
        () => this.startGame(),
        () => this.ui.showScreen("screen-home")
      );
    };

    document.querySelectorAll(".btn-show-leaderboard, .btn-nav-leaderboard, #btnNavLeaderboard").forEach(btn => {
      btn.addEventListener("click", showLeaderboard);
    });

    document.querySelectorAll(".btn-nav-home").forEach(btn => {
      btn.addEventListener("click", () => {
        if (this.retroBlast) {
          this.retroBlast.destroy();
          this.retroBlast = null;
        }
        this.timer.stop();
        this.ui.showScreen("screen-home");
      });
    });

    const togglePresBtn = document.getElementById("togglePresentationBtn");
    if (togglePresBtn) {
      togglePresBtn.addEventListener("click", () => this.ui.togglePresentationMode());
    }

    const homePresBtn = document.getElementById("btnHomePresMode");
    if (homePresBtn) {
      homePresBtn.addEventListener("click", () => {
        this.ui.togglePresentationMode();
      });
    }

    // Direct Round Launchers from Home / Check-In Screen
    document.querySelectorAll(".btn-direct-round, .game-card-teaser").forEach(el => {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        let roundNum = parseInt(el.dataset.round || el.dataset.jumpRound);
        if (!roundNum) {
          // Check card number chip
          const chip = el.querySelector(".card-num-chip");
          if (chip && chip.textContent.includes("01")) roundNum = 1;
          else if (chip && chip.textContent.includes("02")) roundNum = 2;
          else if (chip && chip.textContent.includes("03")) roundNum = 3;
          else if (chip && chip.textContent.includes("04")) roundNum = 4;
          else if (chip && chip.textContent.includes("05")) roundNum = 5;
        }
        if (roundNum >= 1 && roundNum <= 5) {
          this.launchRoundStandalone(roundNum);
        }
      });
    });

    document.querySelectorAll(".btn-enter-room3d").forEach(btn => {
      btn.addEventListener("click", () => this.enterArcadeRoom());
    });

    const room3dExitBtn = document.getElementById("btnRoom3dExit");
    if (room3dExitBtn) {
      room3dExitBtn.addEventListener("click", () => this.exitArcadeRoom());
    }

    // Fullscreen toggle
    const fsBtn = document.getElementById("btnFullscreenToggle");
    if (fsBtn) {
      fsBtn.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
          fsBtn.innerHTML = `<span class="mode-icon">⛶</span> EXIT FULLSCREEN`;
        } else {
          document.exitFullscreen().catch(() => { });
          fsBtn.innerHTML = `<span class="mode-icon">⛶</span> FULLSCREEN`;
        }
      });
    }

    // Nav organizer button — always asks for the organizer passphrase before opening
    const navOrgBtn = document.getElementById("btnNavOrganizer");
    if (navOrgBtn) {
      navOrgBtn.addEventListener("click", () => {
        if (this.organizer.isOpen) {
          this.organizer.toggleModal();
          return;
        }
        this.showAdminAuthModal(() => {
          AuthManager.applyRoleVisibility();
          this.organizer.toggleModal();
        }, { forceReentry: true });
      });
    }

    // Keyboard shortcut 'P' for Presentation Mode
    window.addEventListener("keydown", (e) => {
      if ((e.key === "p" || e.key === "P") && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        this.ui.togglePresentationMode();
      }
      if (e.key === "Escape") {
        const orgModal = document.getElementById("organizerModal");
        if (orgModal && orgModal.classList.contains("active")) {
          this.organizer.toggleModal();
        }
        const memeModal = document.getElementById("memeRubricModalOverlay");
        if (memeModal && memeModal.classList.contains("active")) {
          memeModal.classList.remove("active");
        }
        ["registrationModal", "adminAuthModal"].forEach((id) => {
          const modal = document.getElementById(id);
          if (modal) modal.classList.remove("active");
        });
      }
    });
  }

  promptStartGame() {
    this.startGame();
  }

  showRegistrationModal() {
    // Compatibility entry point forwarding to the provision modal
    return this.showTeamProvisionModal();
  }

  showTeamProvisionModal() {
    if (!AuthManager.isAdminAuthenticated()) {
      this.showAdminAuthModal(() => this.showTeamProvisionModal());
      return;
    }

    const modal = document.getElementById("registrationModal");
    const modalBody = document.getElementById("registrationModalBody");
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
      <div class="modal-cyber-glow"></div>
      <div class="reg-header">
        <span class="game-badge">ADMIN CONTROL DESK</span>
        <h2 class="reg-title">CREATE PARTICIPANT TEAM</h2>
        <p class="reg-sub">Issue a team account and share its generated code at check-in.</p>
        <button type="button" class="btn-close-modal" id="btnCloseRegModal">✕</button>
      </div>
      <form id="teamProvisionForm" class="reg-form">
        <div class="reg-fields-grid">
          <div class="reg-field">
            <label for="regTeamName">TEAM NAME *</label>
            <input type="text" id="regTeamName" class="arcade-text-input" placeholder="e.g. Team Nova" required maxlength="40" autofocus />
          </div>
          <div class="reg-field">
            <label for="regTeamDept">DEPARTMENT / COLLEGE</label>
            <input type="text" id="regTeamDept" class="arcade-text-input" placeholder="e.g. Computer Engineering" maxlength="50" />
          </div>
          <div class="reg-field full-width">
            <label for="regTeamMembers">TEAM MEMBERS</label>
            <input type="text" id="regTeamMembers" class="arcade-text-input" placeholder="e.g. Rahul Sharma & Priya Patel" maxlength="80" />
          </div>
          <div class="reg-field full-width">
            <label for="regTeamCode">CUSTOM ACCESS CODE (OPTIONAL)</label>
            <input type="text" id="regTeamCode" class="arcade-text-input access-code-input" placeholder="Leave blank to generate a unique code" maxlength="12" autocomplete="off" />
          </div>
        </div>
        <div class="reg-actions-row">
          <button type="button" class="btn-secondary-gaming" id="btnCloseProvision">CANCEL</button>
          <button type="submit" class="btn-primary-gaming">CREATE TEAM & ISSUE CODE →</button>
        </div>
      </form>
    `;

    modal.classList.add("active");
    const close = () => modal.classList.remove("active");
    document.getElementById("btnCloseRegModal")?.addEventListener("click", close);
    document.getElementById("btnCloseProvision")?.addEventListener("click", close);
    document.getElementById("teamProvisionForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const team = LeaderboardManager.registerTeam({
        name: document.getElementById("regTeamName")?.value,
        department: document.getElementById("regTeamDept")?.value || "General Engineering",
        members: document.getElementById("regTeamMembers")?.value,
        accessCode: document.getElementById("regTeamCode")?.value
      });
      close();
      this.organizer.lastCreatedTeam = team;
      this.organizer.renderDashboard();
      document.getElementById("organizerModal")?.classList.add("active");
    });
  }

  startGameWithTeam(teamData) {
    state.reset();
    state.setTeam(teamData);
    LeaderboardManager.updateTeamStatus(teamData.id, "in-game");
    this.ui.scoreDisplayValue = 0;
    this.ui.showScreen("screen-game");
    this.loadRound(1);
  }

  /**
   * Show admin authentication modal with passphrase gate
   * @param {Function} onSuccess - Callback to execute after successful authentication
   * @param {{forceReentry?: boolean}} options - forceReentry prompts for the passphrase even when a session already exists
   */
  showAdminAuthModal(onSuccess, options = {}) {
    const modal = document.getElementById("adminAuthModal");
    const modalBody = document.getElementById("adminAuthModalBody");
    if (!modal || !modalBody) return;

    // If already authenticated, skip the gate
    if (!options.forceReentry && AuthManager.isAdminAuthenticated()) {
      if (onSuccess) onSuccess();
      return;
    }

    modalBody.innerHTML = AuthManager.renderLoginGateHTML();
    modal.classList.add("active");

    // Initialize React Bits effects inside modal
    try {
      GradientText.initAll(modalBody);
      SpotlightCard.initAll(modalBody);
    } catch (_) { }

    // Focus passphrase input
    const passInput = document.getElementById("adminPassphraseInput");
    if (passInput) {
      setTimeout(() => passInput.focus(), 100);
    }

    // Close button
    const closeBtn = document.getElementById("btnCloseAuthModal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.classList.remove("active");
      });
    }

    // Cancel button
    const cancelBtn = document.getElementById("btnCancelAuth");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        modal.classList.remove("active");
      });
    }

    // Toggle password visibility
    const toggleBtn = document.getElementById("btnTogglePassVisibility");
    if (toggleBtn && passInput) {
      toggleBtn.addEventListener("click", () => {
        const isPassword = passInput.type === "password";
        passInput.type = isPassword ? "text" : "password";
        toggleBtn.textContent = isPassword ? "🙈" : "👁️";
      });
    }

    // Submit form
    const form = document.getElementById("adminLoginForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const passphrase = passInput ? passInput.value.trim() : "";
        const errorMsg = document.getElementById("authErrorMsg");

        const isAuthed = await AuthManager.authenticateAsync(passphrase);
        if (isAuthed) {
          // Success
          modal.classList.remove("active");
          AuthManager.applyRoleVisibility();
          if (onSuccess) onSuccess();
        } else {
          // Failure - shake animation + error message
          if (errorMsg) {
            errorMsg.style.display = "block";
            errorMsg.classList.add("shake-error");
            setTimeout(() => errorMsg.classList.remove("shake-error"), 600);
          }
          if (passInput) {
            passInput.value = "";
            passInput.focus();
            passInput.classList.add("input-error-flash");
            setTimeout(() => passInput.classList.remove("input-error-flash"), 600);
          }
        }
      });
    }
  }

  // ==========================================
  // PRACTICE / WARM-UP MODE (ZERO POINTS)
  // ==========================================
  getPracticeSteps() {
    return [
      { kind: "scale", q: ROUND1_SCALE_QUESTIONS[0] },
      { kind: "scale", q: ROUND1_SCALE_QUESTIONS[1] },
      { kind: "code" }
    ];
  }

  startPracticeMode() {
    if (this.retroBlast) {
      this.retroBlast.destroy();
      this.retroBlast = null;
    }
    this.timer.stop();
    this.practice = { active: true, step: 0 };

    state.reset();
    state.setTeam({
      id: "practice_team",
      name: "PRACTICE",
      department: "Warm-Up Mode",
      members: "You"
    });
    this.ui.scoreDisplayValue = 0;
    this.ui.setRoundBackground(0);
    this.ui.showScreen("screen-game");

    const timerCard = document.getElementById("hudTimerCard");
    if (timerCard) timerCard.style.display = "none";

    this.loadPracticeStep();
  }

  loadPracticeStep() {
    const steps = this.getPracticeSteps();
    const idx = this.practice.step;
    const arena = document.getElementById("gameArena");
    if (!arena) return;

    const roundEl = document.getElementById("hudRound");
    if (roundEl) roundEl.textContent = "PRACTICE MODE";
    const qEl = document.getElementById("hudQuestion");
    if (qEl) qEl.textContent = `WARM-UP ${Math.min(idx + 1, steps.length)} / ${steps.length}`;
    const scoreEl = document.getElementById("hudScore");
    if (scoreEl) scoreEl.textContent = "SCORE: —";
    const maxEl = document.getElementById("hudMaxScore");
    if (maxEl) maxEl.textContent = "PRACTICE · 0 PTS";

    if (idx >= steps.length) {
      this.finishPractice();
      return;
    }

    state.isAnswerLocked = false;
    const step = steps[idx];

    if (step.kind === "scale") {
      ScaleWarsRenderer.reclaimModelViewers();
      arena.innerHTML = ScaleWarsRenderer.renderQuestion(step.q, () => { }, () => { }, () => { });
      ScaleWarsRenderer.mountModelViewers();
      this.bindPracticeScale(step.q);
    } else {
      arena.innerHTML = BlackoutBuildRenderer.renderLevel(0, "visibility", "");
      this.bindPracticeCode();
    }
  }

  bindPracticeScale(q) {
    document.querySelectorAll("#gameArena .btn-choice-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        const correct = btn.dataset.choice === q.correctAnswer;
        this.revealPracticeScale(q, correct, correct ? "CORRECT!" : "NOT QUITE");
      });
    });

    const passBtn = document.getElementById("btnPass");
    if (passBtn) {
      passBtn.addEventListener("click", () => this.revealPracticeScale(q, null, "SKIPPED"));
    }
  }

  revealPracticeScale(q, correct, headline) {
    this.ui.showPracticeReveal({
      headline: `${headline} — 0 PTS (PRACTICE)`,
      correct,
      explanation: q.explanation,
      nextLabel: this.practice.step >= this.getPracticeSteps().length - 1 ? "FINISH PRACTICE →" : "NEXT WARM-UP →",
      onNext: () => this.advancePractice()
    });
  }

  bindPracticeCode() {
    const editor = document.getElementById("blackoutCodeEditor");
    const submitBtn = document.getElementById("btnSubmitCode");
    const resetBtn = document.getElementById("btnResetCode");
    const gutter = document.getElementById("lineGutter");

    const updateGutter = () => {
      if (gutter && editor) {
        const lineCount = (editor.value.match(/\n/g) || []).length + 1;
        gutter.innerHTML = Array.from({ length: Math.max(12, lineCount) }, (_, i) => i + 1).join("<br>");
      }
    };

    const submitCode = () => {
      const lvl = BLACKOUT_LEVELS[0];
      const typed = editor ? editor.value : "";
      const res = BlackoutBuildRenderer.evaluateTyping(lvl.targetCode, typed, lvl.maxPoints);
      const headline = res.isPerfect
        ? "PERFECT MATCH!"
        : res.passed
          ? `SOLID — ${res.accuracy}% ACCURACY`
          : `KEEP GOING — ${res.accuracy}% ACCURACY`;
      this.ui.showPracticeReveal({
        headline: `${headline} — 0 PTS (PRACTICE)`,
        correct: res.passed,
        explanation: `This open-code warm-up mirrors Blackout Code Round 1 (worth up to ${lvl.maxPoints} pts in the real run). Accuracy is measured character-by-character and line-by-line. In the real round the reference hides behind timed shutters — here it stays visible so you can learn the editor.`,
        nextLabel: "FINISH PRACTICE →",
        onNext: () => this.advancePractice()
      });
    };

    if (editor) {
      editor.addEventListener("input", () => {
        if (this.audio && this.audio.playKeyClick) this.audio.playKeyClick();
        updateGutter();
      });
      editor.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.value = editor.value.substring(0, start) + "  " + editor.value.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
          updateGutter();
        } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          submitCode();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (editor) { editor.value = ""; updateGutter(); }
      });
    }
    if (submitBtn) {
      submitBtn.addEventListener("click", (e) => { e.preventDefault(); submitCode(); });
    }

    updateGutter();
  }

  advancePractice() {
    this.practice.step++;
    this.loadPracticeStep();
  }

  finishPractice() {
    this.practice.active = false;
    const arena = document.getElementById("gameArena");
    if (!arena) return;

    const roundEl = document.getElementById("hudRound");
    if (roundEl) roundEl.textContent = "PRACTICE MODE";
    const qEl = document.getElementById("hudQuestion");
    if (qEl) qEl.textContent = "WARM-UP COMPLETE";

    arena.innerHTML = `
      <div class="cyber-modal practice-complete-card">
        <div class="modal-cyber-glow"></div>
        <div class="between-header">
          <span class="game-badge">WARM-UP COMPLETE</span>
          <h1 class="between-title">PRACTICE FINISHED</h1>
          <p class="between-sub">Nice work! That was a zero-stakes warm-up — no points were scored.</p>
        </div>
        <div class="practice-summary">
          <p>You tried <strong>Scale Wars</strong> comparisons and an open <strong>Blackout Code</strong> typing task. In the real tournament these are Rounds 1 and 4.</p>
          <p class="practice-tip">💡 In the real run, answers lock immediately and the Blackout Code hides behind timed shutters. Use practice to get comfortable with the controls first.</p>
        </div>
        <div class="between-actions">
          <button type="button" class="btn-primary-gaming" id="btnPracticeToReal">START THE REAL RUN ▶</button>
          <button type="button" class="btn-secondary-gaming" id="btnPracticeHome">🏠 BACK TO HOME</button>
        </div>
      </div>
    `;

    document.getElementById("btnPracticeToReal")?.addEventListener("click", () => this.startGame());
    document.getElementById("btnPracticeHome")?.addEventListener("click", () => {
      state.reset();
      this.ui.showScreen("screen-home");
    });
  }

  startGame() {
    this.ui.showScreen("screen-home");
    setTimeout(() => document.getElementById("participantTeamName")?.focus(), 50);
  }

  jumpToRound(roundNumber) {
    this.timer.stop();
    state.currentRound = roundNumber;
    state.currentQuestionIndex = 0;
    state.isAnswerLocked = false;
    this.ui.showScreen("screen-game");
    this.loadRound(roundNumber);
  }

  /** Launch a single round directly (home shortcuts + 3D arcade cabinets). */
  launchRoundStandalone(roundNumber) {
    if (this.retroBlast) {
      this.retroBlast.destroy();
      this.retroBlast = null;
    }
    this.timer.stop();
    if (!state.activeTeam || !state.activeTeam.id) {
      state.reset();
      state.setTeam({
        id: "practice_team",
        name: "CADET TEAM",
        department: "Live Simulation",
        members: "Cadet"
      });
    }
    this.ui.scoreDisplayValue = state.totalScore;
    document.body.classList.remove("room3d-mode");
    this.ui.showScreen("screen-game");
    this.loadRound(roundNumber);
  }

  async enterArcadeRoom() {
    this.ui.showScreen("screen-room3d");
    document.body.classList.add("room3d-mode");
    if (this.antigravity) this.antigravity.stop();

    const playerName = state.activeTeam?.name || "CHALLENGER";
    const playerNameEl = document.getElementById("room3dPlayerName");
    if (playerNameEl) playerNameEl.textContent = playerName.toUpperCase();

    const totalScoreEl = document.getElementById("room3dTotalScore");
    if (totalScoreEl) totalScoreEl.textContent = String(state.totalScore).padStart(3, "0");

    if (this.room3d && this.room3d.ready) {
      this.room3d.enter();
      return;
    }

    const errorEl = document.getElementById("room3dError");

    try {
      const { ArcadeRoom3D } = await import("./room/arcade-room.js");
      const room = new ArcadeRoom3D();
      const ok = await room.init(
        (roundNumber) => {
          room.exit();
          this.launchRoundStandalone(roundNumber);
        },
        () => this.exitArcadeRoom()
      );
      if (!ok) throw new Error("initialisation returned false");
      this.room3d = room;
      window.__arcadeRoom3d = room; // debug handle for event-day troubleshooting
      room.enter();
    } catch (err) {
      console.error("3D arcade floor unavailable:", err);
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = `3D arcade floor unavailable on this machine (${err.message}). Use LEAVE THE ARCADE and pick a round from the home screen.`;
      }
    }
  }

  exitArcadeRoom() {
    if (this.room3d) this.room3d.exit();
    document.body.classList.remove("room3d-mode");
    if (this.antigravity) this.antigravity.start();
    this.ui.showScreen("screen-home");
  }

  loadRound(roundNumber) {
    if (this.retroBlast && roundNumber !== 5) {
      this.retroBlast.destroy();
      this.retroBlast = null;
    }

    this.practice = { active: false, step: 0 };
    this.ui.setRoundBackground(roundNumber);
    this.ui.showScreen("screen-game");
    if (roundNumber === 1) {
      ScaleWarsRenderer.preloadAllModels();
    }
    // Show a short "how to play" briefing for this round before it begins.
    this.ui.renderRoundBriefing(roundNumber, () => this.startRound(roundNumber));
  }

  startRound(roundNumber) {
    // Only Round 4 (Blackout Code 8-min global timer) shows the timer card
    const timerCard = document.getElementById("hudTimerCard");
    if (timerCard) {
      timerCard.style.display = roundNumber === 4 ? "flex" : "none";
    }

    state.currentRound = roundNumber;
    state.currentQuestionIndex = 0;
    state.isAnswerLocked = false;
    this.ui.scoreDisplayValue = state.totalScore;
    if (typeof this.ui.updateScore === "function") {
      this.ui.updateScore(state.totalScore, state.highestPossibleScore);
    } else if (typeof this.ui.updateHUD === "function") {
      this.ui.updateHUD(1, 5);
    }

    if (roundNumber === 1) {
      ScaleWarsRenderer.preloadAllModels();
      this.loadRound1Question();
    } else if (roundNumber === 2) {
      this.loadRound2Question();
    } else if (roundNumber === 3) {
      state.round3Phase = "trivia";
      state.round3TriviaIndex = 0;
      this.loadRound3PhaseA();
    } else if (roundNumber === 4) {
      state.round4LevelIndex = 0;
      this.timer.start(ROUND4_CONFIG.totalRoundSeconds || 480);
      this.loadRound4Level();
    } else if (roundNumber === 5) {
      this.loadRound5RetroBlast();
    }
  }

  // ==========================================
  // ROUND 5: RETRO BLAST (CYBERPUNK TARGET SIMULATOR)
  // ==========================================
  loadRound5RetroBlast() {
    this.timer.stop();
    const timerCard = document.getElementById("hudTimerCard");
    if (timerCard) timerCard.style.display = "none";

    state.currentRound = 5;
    state.isAnswerLocked = false;
    this.ui.updateHUD(1, 3);

    const roundEl = document.getElementById("hudRound");
    if (roundEl) roundEl.textContent = "ROUND 5 / 5";
    const questionEl = document.getElementById("hudQuestion");
    if (questionEl) questionEl.textContent = "RETRO BLAST: AIM LABS";

    if (this.retroBlast) {
      this.retroBlast.destroy();
    }

    const arena = document.getElementById("gameArena");
    this.retroBlast = new RetroBlastRenderer();
    this.retroBlast.mount(
      arena,
      (finalRoundScore, stats) => {
        state.roundScores[5] = finalRoundScore;
        state.totalScore = Object.values(state.roundScores).reduce((a, b) => a + b, 0);
        state.round5Stats = stats;
        if (state.stats.roundStats[5]) {
          state.stats.roundStats[5].hits = stats.targetsHit;
          state.stats.roundStats[5].misses = stats.targetsMissed;
          state.stats.roundStats[5].correct = stats.targetsHit;
          state.stats.roundStats[5].incorrect = stats.bombsHit;
        }
        this.completeRound(5);
      }
    );
  }


  // ==========================================
  // ROUND 1: SCALE WARS
  // ==========================================
  loadRound1Question() {
    const questions = ROUND1_SCALE_QUESTIONS;
    const q = questions[state.currentQuestionIndex];
    if (!q) {
      this.completeRound(1);
      return;
    }

    this.timer.stop();
    const timerCard = document.getElementById("hudTimerCard");
    if (timerCard) timerCard.style.display = "none";

    state.isAnswerLocked = false;
    this.ui.updateHUD(state.currentQuestionIndex + 1, questions.length);

    ScaleWarsRenderer.reclaimModelViewers();

    const arena = document.getElementById("gameArena");
    arena.innerHTML = ScaleWarsRenderer.renderQuestion(
      q,
      (choice) => this.handleRound1Choice(choice),
      (est) => this.handleRound1Estimate(est),
      () => this.handlePass()
    );

    ScaleWarsRenderer.mountModelViewers();

    this.bindArenaActions();
  }

  handleRound1Choice(choice) {
    if (state.isAnswerLocked) return;
    this.timer.stop();
    this.ui.lockInputs();

    const q = ROUND1_SCALE_QUESTIONS[state.currentQuestionIndex];
    const isCorrect = choice === q.correctAnswer;
    const pts = isCorrect ? q.points : 0;

    state.recordResult(isCorrect ? "correct" : "incorrect", pts, 1);
    this.ui.updateHUD(state.currentQuestionIndex + 1, ROUND1_SCALE_QUESTIONS.length);

    this.ui.showAnswerReveal({
      isCorrect,
      pointsEarned: pts,
      resultType: isCorrect ? "correct" : "incorrect",
      explanation: q.explanation,
      onNext: () => this.nextQuestion()
    });
  }

  handleRound1Estimate(userEstimate) {
    if (state.isAnswerLocked) return;
    this.timer.stop();
    this.ui.lockInputs();

    const q = ROUND1_SCALE_QUESTIONS[state.currentQuestionIndex];
    const diff = Math.abs(userEstimate - q.correctNumber);
    let pts = 0;
    let label = "NO SCORE";

    for (const tier of q.tolerance) {
      if (diff <= tier.maxDiff) {
        pts = tier.points;
        label = tier.label;
        break;
      }
    }

    state.recordResult(pts > 0 ? "correct" : "incorrect", pts, 1);
    this.ui.updateHUD(state.currentQuestionIndex + 1, ROUND1_SCALE_QUESTIONS.length);

    const resultType = pts >= 20 ? "correct" : (pts > 0 ? "partial" : "incorrect");
    const headline = pts > 0 ? `${label} · +${pts} PTS` : "OFF TARGET · 0 PTS";

    this.ui.showAnswerReveal({
      isCorrect: pts > 0,
      pointsEarned: pts,
      resultType,
      headline,
      explanation: `${label}! Actual canonical size is ${q.correctNumber}m (Your estimate: ${userEstimate.toFixed(2)}m · Error margin: ±${diff.toFixed(2)}m). ${q.explanation}`,
      onNext: () => this.nextQuestion()
    });
  }

  // ==========================================
  // ROUND 2: CTRL + ALT + GUESS
  // ==========================================
  loadRound2Question() {
    const questions = ROUND2_TECH_QUESTIONS;
    const q = questions[state.currentQuestionIndex];
    if (!q) {
      this.completeRound(2);
      return;
    }

    this.timer.stop();
    const timerCard = document.getElementById("hudTimerCard");
    if (timerCard) timerCard.style.display = "none";

    state.isAnswerLocked = false;
    state.round2Stage = 1;
    state.round2FiftyFiftyUsed = false;
    state.round2EliminatedOptions = [];
    this.ui.updateHUD(state.currentQuestionIndex + 1, questions.length);

    this.renderRound2Screen(q);
  }

  renderRound2Screen(q) {
    const arena = document.getElementById("gameArena");
    arena.innerHTML = CtrlAltGuessRenderer.renderQuestion(
      q,
      state.round2Stage,
      state.round2EliminatedOptions,
      state.round2FiftyFiftyUsed
    );

    this.bindArenaActions();

    const advBtn = document.getElementById("btnAdvanceReveal");
    if (advBtn) {
      advBtn.addEventListener("click", () => this.advanceRound2Reveal());
    }

    const fiftyBtn = document.getElementById("btnFiftyFifty");
    if (fiftyBtn) {
      fiftyBtn.addEventListener("click", () => this.useRound2FiftyFifty());
    }
  }

  useRound2FiftyFifty() {
    if (state.isAnswerLocked || state.round2FiftyFiftyUsed) return;
    const q = ROUND2_TECH_QUESTIONS[state.currentQuestionIndex];
    if (!q) return;

    state.round2FiftyFiftyUsed = true;
    const wrongOptions = q.options.filter(opt => opt !== q.correctAnswer);
    const shuffledWrong = [...wrongOptions].sort(() => 0.5 - Math.random());
    state.round2EliminatedOptions = shuffledWrong.slice(0, 2);

    // 50:50 gives +10 points & clarifies to stage 3
    if (state.round2Stage < 3) {
      state.round2Stage = 3;
    }

    this.renderRound2Screen(q);
  }

  advanceRound2Reveal() {
    if (state.round2Stage < 4) {
      state.round2Stage++;
      const q = ROUND2_TECH_QUESTIONS[state.currentQuestionIndex];
      this.renderRound2Screen(q);
    }
  }

  handleRound2Choice(choice) {
    if (state.isAnswerLocked) return;
    if (state.round2EliminatedOptions.includes(choice)) return;
    this.timer.stop();
    this.ui.lockInputs();

    const q = ROUND2_TECH_QUESTIONS[state.currentQuestionIndex];
    const isCorrect = choice === q.correctAnswer;
    const pointsMap = { 1: 20, 2: 15, 3: 10, 4: 5 };
    let pts = 0;
    if (isCorrect) {
      if (state.round2FiftyFiftyUsed && pointsMap[state.round2Stage] > 10) {
        pts = 10;
      } else {
        pts = pointsMap[state.round2Stage];
      }
    }

    state.recordResult(isCorrect ? "correct" : "incorrect", pts, 2);
    this.ui.updateHUD(state.currentQuestionIndex + 1, ROUND2_TECH_QUESTIONS.length);

    // Fully unblur to 100% clarity on reveal
    const graphicBox = document.getElementById("progressiveGraphicBox");
    if (graphicBox) {
      graphicBox.className = "graphic-canvas-box reveal-filter-stage-4";
    }

    const lifelineNote = state.round2FiftyFiftyUsed ? " (50:50 Lifeline Used)" : "";
    this.ui.showAnswerReveal({
      isCorrect,
      pointsEarned: pts,
      resultType: isCorrect ? "correct" : "incorrect",
      explanation: `Identified at Stage ${state.round2Stage}${lifelineNote}. ${q.explanation}`,
      onNext: () => this.nextQuestion()
    });
  }

  // ==========================================
  // ROUND 3: TECH MEME BATTLE
  // ==========================================
  loadRound3PhaseA() {
    const questions = ROUND3_MEME_TRIVIA;
    const q = questions[state.round3TriviaIndex];

    if (!q) {
      // Transition to Phase B: Creation
      state.round3Phase = "creation";
      this.loadRound3PhaseB();
      return;
    }

    this.timer.stop();
    const timerCard = document.getElementById("hudTimerCard");
    if (timerCard) timerCard.style.display = "none";

    state.isAnswerLocked = false;
    this.ui.updateHUD(state.round3TriviaIndex + 1, 6); // 5 trivia + 1 creation

    const arena = document.getElementById("gameArena");
    arena.innerHTML = MemeBattleRenderer.renderTriviaQuestion(
      q,
      state.round3TriviaIndex,
      questions.length,
      (choice) => this.handleRound3TriviaChoice(choice),
      () => this.handlePass()
    );

    this.bindArenaActions();
  }

  handleRound3TriviaChoice(choice) {
    if (state.isAnswerLocked) return;
    this.timer.stop();
    this.ui.lockInputs();

    const q = ROUND3_MEME_TRIVIA[state.round3TriviaIndex];
    const isCorrect = choice === q.correctAnswer;
    const pts = isCorrect ? q.points : 0;

    state.recordResult(isCorrect ? "correct" : "incorrect", pts, 3);
    this.ui.updateHUD(state.round3TriviaIndex + 1, 6);

    this.ui.showAnswerReveal({
      isCorrect,
      pointsEarned: pts,
      resultType: isCorrect ? "correct" : "incorrect",
      explanation: q.explanation,
      onNext: () => {
        state.round3TriviaIndex++;
        this.loadRound3PhaseA();
      }
    });
  }

  loadRound3PhaseB() {
    this.timer.stop();
    state.isAnswerLocked = false;
    this.ui.updateHUD(6, 6);

    // Fresh start every time: the player has to choose the template themselves.
    this.currentMemeTemplateId = null;

    const arena = document.getElementById("gameArena");
    arena.innerHTML = MemeBattleRenderer.renderMemeStudio(
      this.currentMemePromptIdx,
      this.currentMemeTemplateId
    );

    // The captions are fixed and read-only; the picture is shown without text.
    const submitMemeBtn = document.getElementById("btnSubmitMeme");
    const canvasArt = document.getElementById("memeCanvasArt");
    const tmplBadge = document.getElementById("tmplBadge");
    const canvasBox = document.getElementById("memeCanvasBox");

    // Template selection clicks
    document.querySelectorAll(".btn-template-select").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-template-select").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentMemeTemplateId = btn.dataset.template;
        const tmpl = MEME_TEMPLATES.find(t => t.id === this.currentMemeTemplateId);
        if (tmpl) {
          canvasArt.innerHTML = tmpl.imgSrc
            ? `<img src="${tmpl.imgSrc}" class="meme-template-img" alt="${tmpl.name}" />`
            : MemeBattleRenderer.getTemplateSVG(tmpl.id);
          tmplBadge.textContent = tmpl.name.toUpperCase();
          canvasBox.style.borderColor = tmpl.accentColor;
          if (submitMemeBtn) submitMemeBtn.disabled = false;
        }
      });
    });

    // Submit: only the Drake template is correct (75 pts); any other template scores 0.
    if (submitMemeBtn) {
      submitMemeBtn.addEventListener("click", () => {
        if (state.isAnswerLocked || !this.currentMemeTemplateId) return;
        const tmpl = MEME_TEMPLATES.find(t => t.id === this.currentMemeTemplateId);
        if (!tmpl) return;
        const memePayload = {
          templateId: tmpl.id,
          topText: tmpl.topPlaceholder,
          bottomText: tmpl.bottomPlaceholder
        };
        const isCorrect = tmpl.id === MEME_CORRECT_TEMPLATE_ID;
        const pts = isCorrect ? MEME_CREATION_POINTS : 0;
        const correctTmpl = MEME_TEMPLATES.find(t => t.id === MEME_CORRECT_TEMPLATE_ID);

        state.round3CreatedMeme = memePayload;
        state.round3CreationScore = pts;
        state.recordResult(isCorrect ? "correct" : "incorrect", pts, 3);
        state.isAnswerLocked = true;
        this.ui.lockInputs();
        this.ui.updateScore && this.ui.updateScore();

        this.ui.showAnswerReveal({
          isCorrect,
          pointsEarned: pts,
          resultType: isCorrect ? "correct" : "incorrect",
          headline: isCorrect ? `CORRECT TEMPLATE! +${pts} POINTS` : "WRONG TEMPLATE — 0 POINTS",
          explanation: isCorrect
            ? `${tmpl.name} is the right match: the captions are a disapprove / approve pair — reject the tedious thing, approve the reckless shortcut.`
            : `${tmpl.name} doesn't fit these captions. They are a disapprove / approve pair, which is the ${correctTmpl ? correctTmpl.name : "Drake"} template.`,
          nextLabel: "FINISH ROUND 3 →",
          onNext: () => this.completeRound(3)
        });
      });
    }
  }

  showMemeJudgingModal(memePayload) {
    const modal = document.getElementById("memeRubricModalOverlay");
    if (!modal) return;

    modal.innerHTML = MemeBattleRenderer.renderJudgingRubric(memePayload);
    modal.classList.add("active");

    const inOrig = document.getElementById("scoreOriginality");
    const inHum = document.getElementById("scoreHumor");
    const inRel = document.getElementById("scoreRelevance");
    const totDisplay = document.getElementById("rubricTotalDisplay");

    const updateSum = () => {
      const o = parseInt(inOrig.value, 10) || 0;
      const h = parseInt(inHum.value, 10) || 0;
      const r = parseInt(inRel.value, 10) || 0;
      const sum = Math.min(75, Math.max(0, o + h + r));
      totDisplay.textContent = `${sum} / 75 PTS`;
      return sum;
    };

    [inOrig, inHum, inRel].forEach(input => {
      input?.addEventListener("input", updateSum);
    });

    const confirmBtn = document.getElementById("btnConfirmMemeScore");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        const awardedPts = updateSum();
        modal.classList.remove("active");
        state.round3CreationScore = awardedPts;
        state.recordResult("correct", awardedPts, 3);
        this.completeRound(3);
      });
    }
  }

  // ==========================================
  // ROUND 4: BLACKOUT CODE (5 PROGRESSIVE ROUNDS)
  // ==========================================
  loadRound4Level() {
    const levelIndex = state.round4LevelIndex;
    const levelData = BLACKOUT_LEVELS[levelIndex];

    // Clear previous shutter schedules
    if (this.round4ShutterInterval) {
      clearInterval(this.round4ShutterInterval);
      this.round4ShutterInterval = null;
    }
    if (this.round4ShutterTimeout) {
      clearTimeout(this.round4ShutterTimeout);
      this.round4ShutterTimeout = null;
    }

    if (!levelData) {
      this.timer.stop();
      const elapsedSec = Math.max(1, Math.round((Date.now() - (state.round4GlobalStartTime || Date.now())) / 1000));
      const totalScore = (state.round4Results || []).reduce((acc, r) => acc + (r ? (r.pointsEarned || 0) : 0), 0);
      const arena = document.getElementById("gameArena");
      arena.innerHTML = BlackoutBuildRenderer.renderFinalResults(state.round4Results || [], totalScore, elapsedSec);

      const finishBtn = document.getElementById("btnFinishRound4");
      if (finishBtn) {
        finishBtn.addEventListener("click", () => this.completeRound(4));
      }
      return;
    }

    state.round4Phase = (levelData.level === 5) ? "memorize" : "visibility";
    state.isAnswerLocked = false;
    state.round4StartTime = Date.now();
    state.round4TypedCode = "";
    this.ui.updateHUD(levelIndex + 1, BLACKOUT_LEVELS.length);

    const arena = document.getElementById("gameArena");
    arena.innerHTML = BlackoutBuildRenderer.renderLevel(levelIndex, state.round4Phase, "");

    this.bindBlackoutControls(levelIndex);
  }

  bindBlackoutControls(levelIndex) {
    const levelData = BLACKOUT_LEVELS[levelIndex];
    const targetCode = levelData.targetCode;

    const editor = document.getElementById("blackoutCodeEditor");
    const submitBtn = document.getElementById("btnSubmitCode");
    const resetBtn = document.getElementById("btnResetCode");
    const gutter = document.getElementById("lineGutter");
    const shutter = document.getElementById("blackoutShutter");
    const targetStatusTag = document.getElementById("targetStatusTag");
    const liveShutterStatus = document.getElementById("liveShutterStatus");
    const shutterSubMessage = document.getElementById("shutterSubMessage");
    const blindKeystrokeCount = document.getElementById("blindKeystrokeCount");

    const updateGutter = () => {
      if (gutter && editor) {
        const lineCount = (editor.value.match(/\n/g) || []).length + 1;
        gutter.innerHTML = Array.from({ length: Math.max(12, lineCount) }, (_, i) => i + 1).join("<br>");
      }
    };

    // -------------------------------------------------------------
    // CONFIGURE 5-ROUND VISIBILITY & SHUTTER SCHEDULES
    // -------------------------------------------------------------
    if (levelData.level === 1) {
      // ROUND 1: Never disappears (100% visible)
      if (shutter) shutter.classList.remove("active");
      if (targetStatusTag) {
        targetStatusTag.className = "editor-status-tag tag-visible";
        targetStatusTag.textContent = "👁️ VISIBLE";
      }
      if (liveShutterStatus) {
        liveShutterStatus.className = "s-val neon-green";
        liveShutterStatus.textContent = "👁️ 100% CONSTANT VISIBILITY";
      }
    } else if (levelData.level >= 2 && levelData.level <= 4) {
      // ROUNDS 2, 3, 4: Disappears for X seconds, then reappears for Y seconds (Cyclical)
      let isBlackout = false;
      let secondsLeft = levelData.visibleSeconds || 5;

      if (shutter) shutter.classList.remove("active");
      if (targetStatusTag) {
        targetStatusTag.className = "editor-status-tag tag-visible";
        targetStatusTag.textContent = "👁️ VISIBLE";
      }
      if (liveShutterStatus) {
        liveShutterStatus.className = "s-val neon-green";
        liveShutterStatus.textContent = `👁️ CODE VISIBLE (${secondsLeft}s)`;
      }

      this.round4ShutterInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          if (liveShutterStatus) {
            liveShutterStatus.textContent = isBlackout
              ? `⚠️ BLACKOUT (${secondsLeft}s)`
              : `👁️ CODE VISIBLE (${secondsLeft}s)`;
          }
        } else {
          // Toggle between Blackout and Reappearance
          isBlackout = !isBlackout;

          if (isBlackout) {
            // Disappear (Blackout active)
            secondsLeft = levelData.blackoutSeconds;
            state.round4Phase = "blackout";

            if (shutter) shutter.classList.add("active");
            if (targetStatusTag) {
              targetStatusTag.className = "editor-status-tag tag-blackout";
              targetStatusTag.textContent = "⚠️ BLACKOUT";
            }
            if (liveShutterStatus) {
              liveShutterStatus.className = "s-val neon-red";
              liveShutterStatus.textContent = `⚠️ BLACKOUT (${secondsLeft}s)`;
            }
            if (this.audio && this.audio.playAlarmWarning) {
              this.audio.playAlarmWarning();
            }
          } else {
            // Reappear (Visible active)
            secondsLeft = levelData.visibleSeconds || 4;
            state.round4Phase = "visibility";

            if (shutter) shutter.classList.remove("active");
            if (targetStatusTag) {
              targetStatusTag.className = "editor-status-tag tag-visible";
              targetStatusTag.textContent = "👁️ REAPPEARED";
            }
            if (liveShutterStatus) {
              liveShutterStatus.className = "s-val neon-green";
              liveShutterStatus.textContent = `👁️ CODE VISIBLE (${secondsLeft}s)`;
            }
            if (this.audio && this.audio.playKeyClick) {
              this.audio.playKeyClick();
            }
          }
        }
      }, 1000);
    } else if (levelData.level === 5) {
      // ROUND 5: Final Memory Challenge (10s Memorize -> 20s Reproduce)
      let phase = "memorize";
      let secondsLeft = levelData.visibleSeconds || 10; // 10s

      if (editor) {
        editor.disabled = true;
        editor.placeholder = `// MEMORIZE THE CODE ABOVE... (TYPING UNLOCKS IN ${secondsLeft}s)`;
      }
      if (shutter) shutter.classList.remove("active");
      if (targetStatusTag) {
        targetStatusTag.className = "editor-status-tag tag-visible";
        targetStatusTag.textContent = "🧠 MEMORIZING";
      }
      if (liveShutterStatus) {
        liveShutterStatus.className = "s-val neon-amber";
        liveShutterStatus.textContent = `🧠 PHASE 1: MEMORIZE (${secondsLeft}s)`;
      }

      this.round4ShutterInterval = setInterval(() => {
        secondsLeft--;
        if (phase === "memorize") {
          if (secondsLeft > 0) {
            if (liveShutterStatus) {
              liveShutterStatus.textContent = `🧠 PHASE 1: MEMORIZE (${secondsLeft}s)`;
            }
          } else {
            // Phase 1 Ends -> Transition to Phase 2: Reproduction Sprint
            phase = "reproduce";
            secondsLeft = levelData.reproduceSeconds || 20; // 20s
            state.round4Phase = "blackout";

            if (shutter) shutter.classList.add("active");
            if (shutterSubMessage) {
              shutterSubMessage.textContent = `${levelData.visibleSeconds || 10}s MEMORIZATION ENDED. TYPE FROM MEMORY NOW!`;
            }
            if (targetStatusTag) {
              targetStatusTag.className = "editor-status-tag tag-blackout";
              targetStatusTag.textContent = "⚠️ BLIND SPRINT";
            }
            if (liveShutterStatus) {
              liveShutterStatus.className = "s-val neon-red";
              liveShutterStatus.textContent = `⚠️ PHASE 2: REPRODUCE (${secondsLeft}s)`;
            }

            if (editor) {
              editor.disabled = false;
              editor.placeholder = "// Type the code from memory now!";
              editor.focus();
            }

            if (this.audio && this.audio.playAlarmWarning) {
              this.audio.playAlarmWarning();
            }
          }
        } else if (phase === "reproduce") {
          if (secondsLeft > 0) {
            if (liveShutterStatus) {
              liveShutterStatus.textContent = `⚠️ PHASE 2: REPRODUCE (${secondsLeft}s)`;
            }
          } else {
            // Reproduction sprint expired -> Auto Submit!
            clearInterval(this.round4ShutterInterval);
            this.round4ShutterInterval = null;
            if (liveShutterStatus) {
              liveShutterStatus.textContent = "🔒 SPRINT TIME EXPIRED — SUBMITTING...";
            }
            this.evaluateBlackoutSubmission(levelIndex);
          }
        }
      }, 1000);
    }

    if (editor) {
      editor.addEventListener("input", (e) => {
        state.round4TypedCode = e.target.value;
        this.audio.playKeyClick();
        updateGutter();
        if (blindKeystrokeCount) {
          blindKeystrokeCount.textContent = `BUFFER: ${e.target.value.length} CHARS RECORDED`;
        }
      });

      // Enable Tab key support inside code editor (2 spaces) & Ctrl+Enter to submit
      editor.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          const indent = "  ";
          editor.value = editor.value.substring(0, start) + indent + editor.value.substring(end);
          editor.selectionStart = editor.selectionEnd = start + indent.length;
          state.round4TypedCode = editor.value;
          if (this.audio && this.audio.playKeyClick) this.audio.playKeyClick();
          updateGutter();
        } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          this.evaluateBlackoutSubmission(levelIndex);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (editor) {
          editor.value = "";
          state.round4TypedCode = "";
          updateGutter();
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.evaluateBlackoutSubmission(levelIndex);
      });
    }

    updateGutter();
  }

  handleTimerExpire() {
    if (state.isAnswerLocked) return;

    // Handle Blackout Round 8-minute overall timer expiration
    if (state.currentRound === 4) {
      if (this.round4ShutterInterval) {
        clearInterval(this.round4ShutterInterval);
        this.round4ShutterInterval = null;
      }
      this.evaluateBlackoutSubmission(state.round4LevelIndex, true);
      return;
    }

    // Default question timeout
    this.ui.lockInputs();
    state.recordResult("incorrect", 0);
    this.ui.updateHUD();

    this.ui.showAnswerReveal({
      isCorrect: false,
      pointsEarned: 0,
      resultType: "timeout",
      explanation: "Time expired before an answer was locked. 0 points awarded.",
      onNext: () => this.nextQuestion()
    });
  }

  evaluateBlackoutSubmission(levelIndex, isFinalRoundTimeout = false) {
    try {
      if (this.round4ShutterInterval) {
        clearInterval(this.round4ShutterInterval);
        this.round4ShutterInterval = null;
      }

      const levelData = BLACKOUT_LEVELS[levelIndex] || BLACKOUT_LEVELS[0];
      const targetCode = levelData.targetCode;
      const editor = document.getElementById("blackoutCodeEditor");
      const typedCode = editor ? editor.value : (state.round4TypedCode || "");

      const evaluation = BlackoutBuildRenderer.evaluateTyping(
        targetCode,
        typedCode,
        levelData.maxPoints
      );

      state.round4Results = state.round4Results || [];
      state.round4Results[levelIndex] = evaluation;

      const pts = evaluation.pointsEarned;

      try {
        if (this.audio) {
          if (pts >= levelData.maxPoints * 0.75 && this.audio.playRoundFanfare) {
            this.audio.playRoundFanfare();
          } else if (this.audio.playTargetHit) {
            this.audio.playTargetHit();
          }
        }
      } catch (audioErr) {
        console.warn("Audio playback non-critical error:", audioErr);
      }

      state.recordResult(evaluation.passed ? "correct" : "incorrect", pts, 4);
      this.ui.updateHUD();

      const isLastLevel = levelIndex >= BLACKOUT_LEVELS.length - 1 || isFinalRoundTimeout;
      const arena = document.getElementById("gameArena");

      if (isLastLevel) {
        this.timer.stop();
        const elapsedSec = Math.max(1, Math.round((Date.now() - (state.round4GlobalStartTime || Date.now())) / 1000));
        const totalScore = state.round4Results.reduce((acc, r) => acc + (r ? (r.pointsEarned || 0) : 0), 0);

        arena.innerHTML = BlackoutBuildRenderer.renderFinalResults(state.round4Results, totalScore, elapsedSec);

        const finishBtn = document.getElementById("btnFinishRound4");
        if (finishBtn) {
          finishBtn.addEventListener("click", () => this.completeRound(4));
        }
      } else {
        arena.innerHTML = BlackoutBuildRenderer.renderRoundTransition(
          levelIndex,
          evaluation,
          () => {
            state.round4LevelIndex++;
            this.loadRound4Level();
          }
        );

        const nextLvlBtn = document.getElementById("btnNextLevelAction");
        if (nextLvlBtn) {
          nextLvlBtn.addEventListener("click", () => {
            state.round4LevelIndex++;
            this.loadRound4Level();
          });
        }
      }
    } catch (err) {
      console.error("Error in evaluateBlackoutSubmission:", err);
      // Fallback transition
      state.round4LevelIndex++;
      if (state.round4LevelIndex < BLACKOUT_LEVELS.length) {
        this.loadRound4Level();
      } else {
        this.completeRound(4);
      }
    }
  }

  handlePass() {
    if (state.isAnswerLocked) return;
    this.timer.stop();
    this.ui.lockInputs();

    state.recordResult("passed", 0);
    this.ui.updateHUD();

    if (state.currentRound === 4) {
      state.round4LevelIndex++;
      if (state.round4LevelIndex < BLACKOUT_LEVELS.length) {
        this.loadRound4Level();
      } else {
        this.completeRound(4);
      }
      return;
    }

    if (state.currentRound === 5) {
      if (this.retroBlast) {
        this.retroBlast.finishRound5();
      } else {
        this.completeRound(5);
      }
      return;
    }

    this.ui.showAnswerReveal({
      isCorrect: false,
      pointsEarned: 0,
      resultType: "passed",
      explanation: "Question skipped with zero penalty.",
      onNext: () => this.nextQuestion()
    });
  }

  bindArenaActions() {
    // Choice options
    document.querySelectorAll(".btn-choice-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        const choice = btn.dataset.choice;
        if (state.currentRound === 1) this.handleRound1Choice(choice);
        else if (state.currentRound === 2) this.handleRound2Choice(choice);
        else if (state.currentRound === 3) this.handleRound3TriviaChoice(choice);
      });
    });

    // Estimation submit
    const estBtn = document.getElementById("btnSubmitEstimate");
    const estInput = document.getElementById("numericalEstimateInput");
    if (estBtn && estInput) {
      const submitVal = () => {
        const val = parseFloat(estInput.value);
        if (isNaN(val) || val <= 0) return;
        this.handleRound1Estimate(val);
      };
      estBtn.addEventListener("click", submitVal);
      estInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitVal();
      });
    }

    // Pass button
    const passBtn = document.getElementById("btnPass");
    if (passBtn) {
      passBtn.addEventListener("click", () => this.handlePass());
    }
  }

  nextQuestion() {
    if (state.currentRound === 1) {
      state.currentQuestionIndex++;
      this.loadRound1Question();
    } else if (state.currentRound === 2) {
      state.currentQuestionIndex++;
      this.loadRound2Question();
    } else if (state.currentRound === 3) {
      state.round3TriviaIndex++;
      this.loadRound3PhaseA();
    }
  }

  skipCurrentQuestion() {
    this.handlePass();
  }

  resetCurrentQuestion() {
    this.timer.stop();
    if (state.currentRound === 1) this.loadRound1Question();
    else if (state.currentRound === 2) this.loadRound2Question();
    else if (state.currentRound === 3) this.loadRound3PhaseA();
    else if (state.currentRound === 4) this.loadRound4Level();
    else if (state.currentRound === 5) this.loadRound5RetroBlast();
  }

  completeRound(roundNumber) {
    this.timer.stop();
    if (roundNumber === 1) {
      ScaleWarsRenderer.reclaimModelViewers();
    }
    if (this.retroBlast && roundNumber !== 5) {
      this.retroBlast.destroy();
      this.retroBlast = null;
    }

    // Persist completed round and score
    state.markRoundCompleted(roundNumber);
    if (state.activeTeam?.id) {
      // Update roster status and leaderboard entry
      LeaderboardManager.updateTeamStatus(state.activeTeam.id, "in-progress", {
        score: state.totalScore,
        roundScores: state.roundScores
      });
      const tier = state.getPerformanceTier();
      LeaderboardManager.addEntry({
        id: state.activeTeam.id,
        name: state.activeTeam.name,
        department: state.activeTeam.department || "Arcade Arena",
        score: state.totalScore,
        maxScore: state.highestPossibleScore,
        tier: tier.tier,
        tierTitle: tier.title,
        badgeClass: tier.badgeClass,
        roundScores: { ...state.roundScores },
        accuracy: state.getAccuracy(),
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5)
      });
    }

    if (roundNumber < 5) {
      const nextRound = roundNumber + 1;
      this.ui.renderBetweenRound(roundNumber, async () => {
        // Return player back to the 3D Arcade Room!
        await this.enterArcadeRoom();
        if (this.room3d) {
          this.room3d.setReturnPosition(roundNumber);
          const roundNames = {
            1: "SCALE WARS",
            2: "CTRL+ALT+GUESS",
            3: "TECH MEME BATTLE",
            4: "BLACKOUT BUILD",
            5: "RETRO BLAST"
          };
          const pts = state.roundScores[roundNumber] || 0;
          this.room3d.showToast(`★ ROUND ${roundNumber} CLEARED (+${pts} PTS)! WALK TO CABINET ${nextRound} (${roundNames[nextRound]}) ★`, "success");
        }
      });
    } else {
      if (this.retroBlast) {
        this.retroBlast.destroy();
        this.retroBlast = null;
      }
      this.showFinalResults();
    }
  }

  showFinalResults() {
    this.timer.stop();

    // Finalize leaderboard entry — mark team as completed with full score
    if (state.activeTeam?.id) {
      LeaderboardManager.updateTeamStatus(state.activeTeam.id, "completed", {
        score: state.totalScore,
        roundScores: state.roundScores
      });
      const tier = state.getPerformanceTier();
      LeaderboardManager.addEntry({
        id: state.activeTeam.id,
        name: state.activeTeam.name,
        department: state.activeTeam.department || "Arcade Arena",
        score: state.totalScore,
        maxScore: state.highestPossibleScore,
        tier: tier.tier,
        tierTitle: tier.title,
        badgeClass: tier.badgeClass,
        roundScores: { ...state.roundScores },
        accuracy: state.getAccuracy(),
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5)
      });
    }

    this.ui.renderFinalResults(
      () => {
        state.clearProgress();
        state.reset();
        this.startGame();
      },
      () => {
        state.clearProgress();
        state.reset();
        this.ui.showScreen("screen-home");
      },
      () => {
        // Option to explore 3D room after tournament
        this.enterArcadeRoom();
        if (this.room3d) {
          this.room3d.showToast("★ TOURNAMENT COMPLETED! ALL 5 CABINETS CLEARED ★", "success");
        }
      }
    );
  }
}

// Bootstrap once DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const app = new ArcadeApp();
  app.init();
});
