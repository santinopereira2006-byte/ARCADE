/**
 * ARCADE - Hidden Organizer Control Console & Sudden Death Tie-Breaker
 * Accessible via keyboard shortcut (Ctrl + Shift + O) or discreet organizer button
 */

import { TIE_BREAKER_DATA } from "./data/tie-breaker.js";
import { ROUND1_SCALE_QUESTIONS } from "./data/round1-scale.js";
import { ROUND2_TECH_QUESTIONS } from "./data/round2-ctrl-alt.js";
import { ROUND3_MEME_TRIVIA } from "./data/round3-memes.js";
import { BLACKOUT_LEVELS } from "./data/round4-blackout.js";
import { LeaderboardManager } from "./leaderboard.js";
import { AuthManager } from "./auth.js";
import { GradientText } from "./gradient-text.js";
import { SpotlightCard } from "./spotlight-card.js";

export class OrganizerConsole {
  constructor(state, app) {
    this.state = state;
    this.app = app;
    this.isOpen = false;
    this.lastCreatedTeam = null;
  }

  init() {
    // Keyboard shortcut: Ctrl + Shift + O
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "O" || e.key === "o")) {
        e.preventDefault();
        this.toggleModal();
      }
    });

    // Discreet trigger in footer
    const footerTrigger = document.getElementById("btnFooterOrganizer");
    if (footerTrigger) {
      footerTrigger.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleModal();
      });
    }
  }

  toggleModal() {
    // If not authenticated, show the auth modal first
    if (!this.isOpen && !AuthManager.isAdminAuthenticated()) {
      this.app.showAdminAuthModal(() => {
        // After successful auth, open the organizer console
        this.isOpen = true;
        const modal = document.getElementById("organizerModal");
        if (modal) {
          this.renderDashboard();
          modal.classList.add("active");
        }
      });
      return;
    }

    this.isOpen = !this.isOpen;
    const modal = document.getElementById("organizerModal");
    if (!modal) return;

    if (this.isOpen) {
      this.renderDashboard();
      modal.classList.add("active");
    } else {
      modal.classList.remove("active");
    }
  }

  renderDashboard() {
    const modalBody = document.getElementById("organizerModalBody");
    if (!modalBody) return;

    const roster = LeaderboardManager.getRoster();
    const entries = LeaderboardManager.getEntries();
    const lastTeam = this.lastCreatedTeam;

    modalBody.innerHTML = `
      <div class="org-console-card spotlight-card" data-spotlight data-spotlight-color="rgba(56, 189, 248, 0.18)">
        <div class="org-header">
          <span class="game-badge" data-gradient-text data-gradient-border="true" data-gradient-colors='["#38bdf8", "#818cf8", "#c084fc", "#38bdf8"]' data-gradient-speed="4">ORGANIZER MASTER TERMINAL</span>
          <h2 class="org-title"><span data-gradient-text data-gradient-colors='["#ffffff", "#e0f2fe", "#93c5fd", "#c4b5fd", "#ffffff"]' data-gradient-speed="4">ARCADE TOURNAMENT OVERRIDE</span></h2>
          <button type="button" class="btn-close-modal" id="btnCloseOrgModal" title="Close terminal">✕</button>
        </div>

        <div class="org-dashboard-grid">
          <!-- Column 1: Match & Teams -->
          <div class="org-dashboard-col">
            <!-- Active Match & Team Management -->
            <div class="org-section">
              <label class="org-sec-lbl">ACTIVE PARTICIPATING TEAM:</label>
              <div class="org-team-active-row">
                <span class="active-team-pill">CURRENT: <strong>${this.state.activeTeam?.name || 'UNREGISTERED'}</strong> (${this.state.activeTeam?.department || 'No Dept'})</span>
                <button type="button" class="btn-org-action neon-cyan" id="orgBtnOpenRegModal">+ CREATE TEAM &amp; ISSUE CODE</button>
              </div>
            </div>

            ${lastTeam ? `
            <div class="org-created-banner">
              <div><span class="org-created-label">TEAM CREATED — SHARE THIS CODE</span><strong>${lastTeam.name}</strong></div>
              <code>${lastTeam.accessCode}</code>
              <button type="button" class="btn-org-action" id="orgBtnDismissCreated">DISMISS</button>
            </div>` : ''}

            <div class="org-section org-roster-section">
              <div class="org-section-heading-row">
                <label class="org-sec-lbl">TEAM ROSTER &amp; ACCESS CODES (${roster.length})</label>
                <span class="org-live-label"><span class="live-pulse-dot"></span> LIVE ROSTER</span>
              </div>
              <div class="org-roster-list">
                ${roster.length ? roster.map(team => `
                  <div class="org-roster-row">
                    <div class="org-roster-team">
                      <strong>${team.name}</strong>
                      <span>${team.department || 'General Engineering'}${team.members ? ` • ${team.members}` : ''}</span>
                    </div>
                    <code class="org-team-code">${team.accessCode || 'LEGACY'}</code>
                    <span class="org-status status-${team.status}">${team.status}</span>
                    <span class="org-roster-score">${team.status === 'completed' ? `${team.score || 0} pts` : '—'}</span>
                    <button type="button" class="btn-org-delete" data-remove-team="${team.id}" title="Remove team">✕</button>
                  </div>
                `).join('') : '<div class="org-empty-state">No participant teams yet. Create the first team to issue credentials.</div>'}
              </div>
            </div>

            <!-- Quick Jump to Round -->
            <div class="org-section">
              <label class="org-sec-lbl">JUMP DIRECTLY TO ROUND:</label>
              <div class="org-btn-group">
                <button type="button" class="btn-org-action" data-jump-round="1">📐 R1: Scale Wars</button>
                <button type="button" class="btn-org-action" data-jump-round="2">🔍 R2: CTRL+ALT+GUESS</button>
                <button type="button" class="btn-org-action" data-jump-round="3">🎭 R3: Meme Battle</button>
                <button type="button" class="btn-org-action" data-jump-round="4">⚡ R4: Blackout Code</button>
                <button type="button" class="btn-org-action" data-jump-round="5">🎯 R5: Retro Blast</button>
                <button type="button" class="btn-org-action neon-amber" data-jump-action="results">🏆 Final Results</button>
              </div>
            </div>
          </div>

          <!-- Column 2: Controls & Operations -->
          <div class="org-dashboard-col">
            <!-- Scoreboard Snapshot -->
            <div class="org-section org-score-overview">
              <div class="org-section-heading-row">
                <label class="org-sec-lbl">SCOREBOARD SNAPSHOT</label>
                <button type="button" class="btn-org-action neon-cyan" id="orgBtnOpenLeaderboard">LEADERBOARD ↗</button>
              </div>
              <div class="org-score-strip">
                <span><b>${entries.length}</b> recorded runs</span>
                <span><b>${entries[0]?.score || 0}</b> top score</span>
                <span><b>${roster.filter(team => team.status === 'in-game').length}</b> live in-game</span>
              </div>
            </div>

            <!-- Live Gameplay Controls -->
            <div class="org-section">
              <label class="org-sec-lbl">LIVE GAMEPLAY CONTROLS:</label>
              <div class="org-btn-group">
                <button type="button" class="btn-org-action" id="orgBtnSkipQ">⏩ Skip Current Question</button>
                <button type="button" class="btn-org-action" id="orgBtnResetQ">🔄 Reset Current Question</button>
                <button type="button" class="btn-org-action" id="orgBtnTogglePres">📽️ Presentation Mode</button>
                <button type="button" class="btn-org-action neon-red" id="orgBtnResetGame">⚠️ Hard Reset Game</button>
              </div>
            </div>

            <!-- Score Adjustments -->
            <div class="org-section">
              <label class="org-sec-lbl">SCORE OVERRIDE (CURRENT: ${this.state.totalScore} PTS):</label>
              <div class="org-btn-group">
                <button type="button" class="btn-org-action neon-red" data-score-adj="-25">−25 PTS</button>
                <button type="button" class="btn-org-action neon-red" data-score-adj="-10">−10 PTS</button>
                <button type="button" class="btn-org-action neon-green" data-score-adj="10">+10 PTS</button>
                <button type="button" class="btn-org-action neon-green" data-score-adj="25">+25 PTS</button>
              </div>
            </div>

            <!-- Sudden Death Tie-Breaker Launch -->
            <div class="org-section">
              <label class="org-sec-lbl">EVENT JUDGING SPECIAL MODES:</label>
              <div class="org-btn-group">
                <button type="button" class="btn-primary-gaming" id="orgBtnLaunchTieBreaker">
                  ⚡ LAUNCH SUDDEN DEATH TIE-BREAKER
                </button>
              </div>
            </div>

            <!-- Admin Session Controls -->
            <div class="org-section">
              <label class="org-sec-lbl">ADMIN SESSION:</label>
              <div class="org-btn-group" style="align-items: center; justify-content: space-between;">
                <span class="admin-session-info">✅ Authenticated as <strong>ADMIN</strong></span>
                <button type="button" class="btn-org-action neon-red" id="orgBtnLogout">
                  🔒 LOGOUT ADMIN SESSION
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Secret Answer Keys Viewer (Full Width) -->
        <div class="org-section full-width">
          <details class="org-details-box">
            <summary class="org-summary-lbl">🔑 VIEW MASTER ANSWER KEYS</summary>
            <div class="answer-keys-content">
              <h4>ROUND 1: SCALE WARS</h4>
              <ul>
                ${ROUND1_SCALE_QUESTIONS.map(q => `<li><strong>${q.id}</strong>: ${q.correctAnswer || q.correctNumber + 'm'} (${q.explanation})</li>`).join('')}
              </ul>
              <h4>ROUND 2: CTRL + ALT + GUESS</h4>
              <ul>
                ${ROUND2_TECH_QUESTIONS.map(q => `<li><strong>${q.id}</strong>: ${q.correctAnswer}</li>`).join('')}
              </ul>
              <h4>ROUND 3: TECH MEME TRIVIA</h4>
              <ul>
                ${ROUND3_MEME_TRIVIA.map(q => `<li><strong>${q.id}</strong>: ${q.correctAnswer}</li>`).join('')}
              </ul>
              <h4>ROUND 4: BLACKOUT BUILD SOLUTIONS</h4>
              <ul>
                ${BLACKOUT_LEVELS.map(l => `<li><strong>${l.title}</strong>: ${l.subtitle}</li>`).join('')}
              </ul>
              <h4>ROUND 5: RETRO BLAST PROTOCOLS</h4>
              <ul>
                <li><strong>Combat Modes</strong>: Wave 1 (Grid Clear, 20 targets), Wave 2 (Reflex Snap, 30 targets), Wave 3 (Precision &amp; Hazards, 30 targets + 10 hazard bombs). Despawn timers removed. Max 100 PTS.</li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    `;

    try {
      GradientText.initAll(modalBody);
      SpotlightCard.initAll(modalBody);
    } catch (_) {}

    this.bindDashboardEvents();
  }

  bindDashboardEvents() {
    const closeBtn = document.getElementById("btnCloseOrgModal");
    if (closeBtn) closeBtn.addEventListener("click", () => this.toggleModal());

    const openRegBtn = document.getElementById("orgBtnOpenRegModal");
    if (openRegBtn) {
      openRegBtn.addEventListener("click", () => {
        this.toggleModal();
        this.app.showTeamProvisionModal();
      });
    }

    document.getElementById("orgBtnDismissCreated")?.addEventListener("click", () => {
      this.lastCreatedTeam = null;
      this.renderDashboard();
    });

    document.querySelectorAll("[data-remove-team]").forEach(btn => {
      btn.addEventListener("click", () => {
        const team = LeaderboardManager.getRoster().find(item => item.id === btn.dataset.removeTeam);
        if (!team || !confirm(`Remove ${team.name} from the participant roster?`)) return;
        LeaderboardManager.removeTeam(team.id);
        this.renderDashboard();
      });
    });

    document.getElementById("orgBtnOpenLeaderboard")?.addEventListener("click", () => {
      this.toggleModal();
      this.app.ui.renderLeaderboardScreen(() => this.app.startGame(), () => this.app.ui.showScreen("screen-home"));
    });

    // Jump rounds
    document.querySelectorAll("[data-jump-round]").forEach(btn => {
      btn.addEventListener("click", () => {
        const roundNum = parseInt(btn.dataset.jumpRound, 10);
        this.toggleModal();
        this.app.jumpToRound(roundNum);
      });
    });

    const resultsBtn = document.querySelector("[data-jump-action='results']");
    if (resultsBtn) {
      resultsBtn.addEventListener("click", () => {
        this.toggleModal();
        this.app.showFinalResults();
      });
    }

    // Skip question
    const skipBtn = document.getElementById("orgBtnSkipQ");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        this.toggleModal();
        this.app.skipCurrentQuestion();
      });
    }

    // Reset question
    const resetQBtn = document.getElementById("orgBtnResetQ");
    if (resetQBtn) {
      resetQBtn.addEventListener("click", () => {
        this.toggleModal();
        this.app.resetCurrentQuestion();
      });
    }

    // Toggle presentation
    const togglePresBtn = document.getElementById("orgBtnTogglePres");
    if (togglePresBtn) {
      togglePresBtn.addEventListener("click", () => {
        this.app.ui.togglePresentationMode();
      });
    }

    // Reset Game
    const resetGameBtn = document.getElementById("orgBtnResetGame");
    if (resetGameBtn) {
      resetGameBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to reset the entire tournament game? All scores will return to 0.")) {
          this.toggleModal();
          this.app.startGame();
        }
      });
    }

    // Score adjustments
    document.querySelectorAll("[data-score-adj]").forEach(btn => {
      btn.addEventListener("click", () => {
        const adj = parseInt(btn.dataset.scoreAdj, 10);
        this.state.totalScore = Math.max(0, this.state.totalScore + adj);
        this.app.ui.updateHUD();
        this.renderDashboard();
      });
    });

    // Launch Tie-Breaker
    const tbBtn = document.getElementById("orgBtnLaunchTieBreaker");
    if (tbBtn) {
      tbBtn.addEventListener("click", () => {
        this.toggleModal();
        this.renderTieBreakerScreen();
      });
    }

    // Admin Logout
    const logoutBtn = document.getElementById("orgBtnLogout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (confirm("Log out of admin session? You will need to re-enter the passphrase to access the organizer console.")) {
          AuthManager.logout();
          AuthManager.applyRoleVisibility();
          this.toggleModal();
        }
      });
    }
  }

  renderTieBreakerScreen() {
    this.app.timer.stop();
    const screen = document.getElementById("screen-tie-breaker");
    if (!screen) return;

    screen.innerHTML = `
      <div class="cyber-modal sudden-death-modal">
        <div class="modal-cyber-glow"></div>
        <div class="tb-header">
          <span class="game-badge neon-red">ORGANIZER SUDDEN DEATH TIE-BREAKER</span>
          <h1 class="tb-title glitch-title" data-text="SUDDEN DEATH">SUDDEN DEATH</h1>
          <p class="tb-subtitle">${TIE_BREAKER_DATA.subtitle}</p>
        </div>

        <div class="tb-challenge-box">
          <h3 class="tb-q-title">${TIE_BREAKER_DATA.question}</h3>
          <p class="tb-q-sub">${TIE_BREAKER_DATA.subtext}</p>
        </div>

        <div class="tb-contestants-comparison-grid">
          <!-- Contestant A -->
          <div class="contestant-input-pod" id="podA">
            <span class="pod-tag">CONTESTANT / TEAM A</span>
            <input type="number" id="inputContestantA" class="arcade-num-input" placeholder="Estimate in kg..." />
            <div class="delta-result-badge" id="deltaA" style="display: none;"></div>
          </div>

          <div class="vs-divider"><div class="vs-circle">VS</div></div>

          <!-- Contestant B -->
          <div class="contestant-input-pod" id="podB">
            <span class="pod-tag">CONTESTANT / TEAM B</span>
            <input type="number" id="inputContestantB" class="arcade-num-input" placeholder="Estimate in kg..." />
            <div class="delta-result-badge" id="deltaB" style="display: none;"></div>
          </div>
        </div>

        <div class="tb-judge-actions">
          <button type="button" class="btn-primary-gaming" id="btnCalculateWinner">
            ⚖️ CALCULATE WINNER (CLOSEST ESTIMATE)
          </button>
        </div>

        <!-- Winner Declaration Banner (initially hidden) -->
        <div class="winner-announcement-card" id="winnerAnnouncement" style="display: none;">
          <div class="winner-crest">🏆 WINNER DECLARED</div>
          <h2 class="winner-name" id="winnerNameDisplay">CONTESTANT A</h2>
          <div class="canonical-truth-strip">
            CANONICAL VALUE: <strong>${TIE_BREAKER_DATA.displayValue}</strong>
          </div>
          <p class="lore-strip">${TIE_BREAKER_DATA.loreNotes}</p>
          <div class="tb-bonus-action">
            <button type="button" class="btn-secondary-gaming" id="btnApplyTieBreakerBonus">
              +20 PTS TIE-BREAKER BONUS TO TOURNAMENT SCORE
            </button>
          </div>
        </div>

        <div class="tb-footer-actions">
          <button type="button" class="btn-arcade-pass" id="btnExitTieBreaker">
            ← EXIT TO HOME
          </button>
        </div>
      </div>
    `;

    this.app.ui.showScreen("screen-tie-breaker");

    // Bind Tie Breaker logic
    const calcBtn = document.getElementById("btnCalculateWinner");
    if (calcBtn) {
      calcBtn.addEventListener("click", () => {
        const valA = parseFloat(document.getElementById("inputContestantA").value);
        const valB = parseFloat(document.getElementById("inputContestantB").value);
        const actual = TIE_BREAKER_DATA.correctValue;

        if (isNaN(valA) && isNaN(valB)) return;

        const diffA = Math.abs((valA || 0) - actual);
        const diffB = Math.abs((valB || 0) - actual);

        const deltaAEl = document.getElementById("deltaA");
        const deltaBEl = document.getElementById("deltaB");
        deltaAEl.style.display = "block";
        deltaBEl.style.display = "block";
        deltaAEl.innerHTML = `MARGIN: ±${diffA.toLocaleString()} kg`;
        deltaBEl.innerHTML = `MARGIN: ±${diffB.toLocaleString()} kg`;

        const winnerCard = document.getElementById("winnerAnnouncement");
        const winnerName = document.getElementById("winnerNameDisplay");
        winnerCard.style.display = "block";

        if (diffA < diffB) {
          winnerName.textContent = "🏆 CONTESTANT A WINS!";
          document.getElementById("podA").classList.add("winner-highlight");
        } else if (diffB < diffA) {
          winnerName.textContent = "🏆 CONTESTANT B WINS!";
          document.getElementById("podB").classList.add("winner-highlight");
        } else {
          winnerName.textContent = "EXACT DEADLOCK TIE!";
        }
      });
    }

    const bonusBtn = document.getElementById("btnApplyTieBreakerBonus");
    if (bonusBtn) {
      bonusBtn.addEventListener("click", () => {
        this.state.totalScore += 20;
        this.app.ui.updateHUD();
        bonusBtn.textContent = "✅ +20 BONUS APPLIED";
        bonusBtn.disabled = true;
      });
    }

    const exitBtn = document.getElementById("btnExitTieBreaker");
    if (exitBtn) {
      exitBtn.addEventListener("click", () => {
        this.app.ui.showScreen("screen-home");
      });
    }
  }
}
