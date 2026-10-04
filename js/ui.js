/**
 * ARCADE - UI Controller
 * Manages HUD, screen transitions, score animations, reveal modals, and results
 */

import { LeaderboardManager } from "./leaderboard.js";
import { AuthManager } from "./auth.js";

export class ArcadeUIController {
  constructor(state, timer) {
    this.state = state;
    this.timer = timer;
    this.scoreDisplayValue = 0;
  }

  showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add("active");
      // Gameplay uses a deliberately focused participant layout. The global
      // navigation and event footer return automatically between rounds/results.
      document.body.classList.toggle("participant-mode", screenId === "screen-game");
      const resetBgScreens = ["screen-home", "screen-results", "screen-leaderboard", "screen-how-to-play"];
      if (resetBgScreens.includes(screenId)) {
        this.setRoundBackground(0);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  setRoundBackground(roundNumber) {
    if (roundNumber) {
      document.body.dataset.roundBg = String(roundNumber);
    } else {
      delete document.body.dataset.roundBg;
    }
  }

  togglePresentationMode() {
    this.state.presentationMode = !this.state.presentationMode;
    document.body.classList.toggle("presentation-mode", this.state.presentationMode);

    const btn = document.getElementById("togglePresentationBtn");
    if (btn) {
      btn.classList.toggle("active", this.state.presentationMode);
      btn.innerHTML = this.state.presentationMode
        ? `<span class="mode-icon">🖥️</span> EXIT PROJECTOR`
        : `<span class="mode-icon">📽️</span> PRESENTATION MODE`;
    }
  }

  updateHUD(currentQuestionNumber = 1, totalQuestions = 5) {
    const roundEl = document.getElementById("hudRound");
    const questionEl = document.getElementById("hudQuestion");
    const maxScoreEl = document.getElementById("hudMaxScore");
    const teamEl = document.getElementById("hudActiveTeam");
    const scoreEl = document.getElementById("hudScore");

    if (roundEl) {
      roundEl.textContent = `ROUND ${this.state.currentRound} / 5`;
    }
    if (questionEl) {
      questionEl.textContent = `QUESTION ${currentQuestionNumber} / ${totalQuestions}`;
    }
    if (maxScoreEl) {
      maxScoreEl.textContent = `MAX: ${this.state.highestPossibleScore}`;
    }
    if (teamEl) {
      const teamName = this.state.activeTeam?.name || "UNREGISTERED";
      teamEl.textContent = `TEAM: ${teamName.toUpperCase()}`;
    }

    this.animateScore(this.state.totalScore);
  }

  updateScore(score = this.state.totalScore, maxScore = this.state.highestPossibleScore) {
    const scoreEl = document.getElementById("hudScore");
    if (scoreEl) scoreEl.textContent = `SCORE: ${String(score).padStart(3, "0")}`;
    const maxScoreEl = document.getElementById("hudMaxScore");
    if (maxScoreEl) maxScoreEl.textContent = `MAX: ${maxScore}`;
    this.animateScore(score);
  }

  animateScore(targetScore) {
    const scoreEl = document.getElementById("hudScore");
    if (!scoreEl) return;

    const start = this.scoreDisplayValue;
    const diff = targetScore - start;
    if (diff === 0) {
      scoreEl.textContent = `SCORE: ${String(targetScore).padStart(3, '0')}`;
      return;
    }

    const duration = 500;
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const current = Math.round(start + diff * progress);
      scoreEl.textContent = `SCORE: ${String(current).padStart(3, '0')}`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.scoreDisplayValue = targetScore;
        scoreEl.textContent = `SCORE: ${String(targetScore).padStart(3, '0')}`;
      }
    };

    requestAnimationFrame(step);
  }

  updateTimerDisplay({ formatted, percent, isWarning }) {
    const timerText = document.getElementById("timerText");
    const timerCard = document.getElementById("hudTimerCard");
    const timerProgress = document.getElementById("timerProgressBar");

    if (timerText) timerText.textContent = formatted;
    if (timerCard) {
      timerCard.classList.toggle("warning-danger", isWarning);
    }
    if (timerProgress) {
      timerProgress.style.width = `${percent}%`;
      timerProgress.classList.toggle("progress-danger", isWarning);
    }
  }

  lockInputs() {
    this.state.isAnswerLocked = true;
    document.querySelectorAll("#gameArena button, #gameArena input, #gameArena textarea").forEach(el => {
      if (el.id !== "btnNextQuestion") {
        el.disabled = true;
      }
    });

    const passBtn = document.getElementById("btnPass");
    if (passBtn) passBtn.style.display = "none";
  }

  showAnswerReveal({ isCorrect, pointsEarned, resultType, headline, explanation, onNext }) {
    const arena = document.getElementById("gameArena");
    if (!arena) return;

    let existingReveal = document.getElementById("answerRevealPanel");
    if (!existingReveal) {
      existingReveal = document.createElement("div");
      existingReveal.id = "answerRevealPanel";
      existingReveal.className = "answer-reveal-panel";
      arena.appendChild(existingReveal);
    }

    existingReveal.style.display = "block";

    let badgeClass = "incorrect-badge";
    let title = headline || "INCORRECT — 0 POINTS";

    if (resultType === "correct") {
      badgeClass = "correct-badge";
      if (!headline) title = `CORRECT! +${pointsEarned} POINTS`;
    } else if (resultType === "partial") {
      badgeClass = "partial-badge";
      if (!headline) title = `PARTIAL ESTIMATE · +${pointsEarned} POINTS`;
    } else if (resultType === "passed") {
      badgeClass = "passed-badge";
      if (!headline) title = "QUESTION PASSED — 0 POINTS";
    } else if (resultType === "timeout") {
      badgeClass = "timeout-badge";
      if (!headline) title = "TIME EXPIRED — 0 POINTS";
    }

    const currentTotal = this.state ? this.state.totalScore : 0;

    existingReveal.innerHTML = `
      <div class="result-badge ${badgeClass}">
        <div class="badge-lock-tag">ANSWER LOCKED</div>
        <div class="badge-headline">${title}</div>
        <div class="badge-score-pill">
          <span class="score-pill-q">THIS QUESTION: <strong>+${pointsEarned} PTS</strong></span>
          <span class="score-pill-dot">·</span>
          <span class="score-pill-total">TOTAL: <strong>${currentTotal} PTS</strong></span>
        </div>
      </div>

      <div class="reveal-details-box">
        <p class="explanation-text"><strong>ANALYSIS:</strong> ${explanation}</p>
      </div>

      <div class="reveal-actions">
        <button type="button" class="btn-primary-gaming" id="btnNextQuestion">
          NEXT QUESTION →
        </button>
      </div>
    `;

    existingReveal.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const nextBtn = document.getElementById("btnNextQuestion");
    if (nextBtn) {
      nextBtn.addEventListener("click", onNext);
    }
  }

  renderRoundBriefing(roundNumber, onStartRound) {
    const BRIEFINGS = {
      1: {
        icon: "📐",
        name: "SCALE WARS",
        tagline: "Estimation & Observation",
        tag: "ROUND 1 / 5",
        pts: "100 PTS · 5 QUESTIONS",
        rules: [
          "Compare two characters and pick the taller/bigger one, or type a height estimate in metres.",
          "Closer estimates score more — tolerance tiers award 20 / 15 / 10 / 5 points.",
          "Answers lock the moment you submit. You may PASS any question with zero penalty."
        ],
        tip: "Use the on-screen reference scale (human, car, building) to sanity-check a guess before you lock it in."
      },
      2: {
        icon: "💻",
        name: "CTRL + ALT + GUESS",
        tagline: "Visual Tech Recall",
        tag: "ROUND 2 / 5",
        pts: "100 PTS · 5 QUESTIONS",
        rules: [
          "A tech logo/icon is revealed in 4 stages, from blurry to clear.",
          "Guess early for more points: Stage 1 = 20, Stage 2 = 15, Stage 3 = 10, Stage 4 = 5.",
          "Use the 50:50 lifeline once per question to remove two wrong options (caps that question at 10 pts)."
        ],
        tip: "Not sure? Advance the reveal for a clearer image, but each stage you wait costs points."
      },
      3: {
        icon: "🎭",
        name: "TECH MEME BATTLE",
        tagline: "Culture & Creativity",
        tag: "ROUND 3 / 5",
        pts: "150 PTS · TRIVIA + STUDIO",
        rules: [
          "Phase A: 5 developer-meme multiple-choice questions, 15 pts each.",
          "Phase B: create your own meme in the studio; judges score Originality, Humor, and Relevance (up to 75 pts).",
          "Keep all meme content college-appropriate."
        ],
        tip: "Read the setup line carefully — the punchline is usually a well-known dev joke."
      },
      4: {
        icon: "⚡",
        name: "BLACKOUT CODE",
        tagline: "5-Level Memory Speed-Coding (JavaScript)",
        tag: "ROUND 4 / 5",
        pts: "1000 PTS · 8-MIN GLOBAL TIMER",
        rules: [
          "Type the target code as accurately as you can; scoring is character-by-character and line-by-line.",
          "Level 1 stays fully visible. Later levels hide the code behind timed blackout shutters.",
          "Level 5 is a memory sprint: 10s to memorize, then 20s to reproduce (auto-submits).",
          "One shared 8-minute timer runs across all 5 levels. Tab inserts 2 spaces; Ctrl+Enter submits; copy/paste is disabled."
        ],
        tip: "Accuracy beats speed — a shorter but exact match scores higher than a long, messy one."
      },
      5: {
        icon: "🎯",
        name: "RETRO BLAST",
        tagline: "Cyberpunk Precision Target Simulator",
        tag: "ROUND 5 / 5",
        pts: "100 PTS · 3 WAVES",
        rules: [
          "Click/tap the neon targets to score. Three waves: grid clear, reflex snap, then precision & hazards.",
          "Watch your ammo in the later waves — misses can cost you.",
          "Avoid the RED hazard bombs: hitting one deducts points."
        ],
        tip: "Stay calm and aim for centre-mass hits; the hazard wave rewards control over raw speed."
      }
    };

    const b = BRIEFINGS[roundNumber];
    const arena = document.getElementById("gameArena");
    if (!arena) return;

    // Briefings never show the countdown timer card.
    const timerCard = document.getElementById("hudTimerCard");
    if (timerCard) timerCard.style.display = "none";

    const roundEl = document.getElementById("hudRound");
    if (roundEl) roundEl.textContent = `ROUND ${roundNumber} / 5`;
    const qEl = document.getElementById("hudQuestion");
    if (qEl) qEl.textContent = b ? b.name : "BRIEFING";

    if (!b) {
      if (onStartRound) onStartRound();
      return;
    }

    arena.innerHTML = `
      <div class="cyber-modal between-round-card round-briefing-card">
        <div class="modal-cyber-glow"></div>
        <div class="between-header">
          <span class="game-badge">${b.tag} · ${b.pts}</span>
          <h1 class="between-title">${b.icon} ${b.name}</h1>
          <p class="between-sub">${b.tagline}</p>
        </div>
        <div class="briefing-body">
          <h3 class="section-title">HOW THIS ROUND WORKS</h3>
          <ul class="briefing-rules">
            ${b.rules.map(r => `<li>${r}</li>`).join("")}
          </ul>
          <div class="briefing-tip">
            <span class="tip-icon">💡</span>
            <span>${b.tip}</span>
          </div>
        </div>
        <div class="between-actions">
          <button type="button" class="btn-primary-gaming" id="btnStartRound">
            START ROUND ${roundNumber} ▶
          </button>
        </div>
      </div>
    `;

    const startBtn = document.getElementById("btnStartRound");
    if (startBtn) {
      const launch = () => {
        startBtn.disabled = true;
        if (onStartRound) onStartRound();
      };
      startBtn.addEventListener("click", launch);
      startBtn.focus();
      const onKey = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          window.removeEventListener("keydown", onKey);
          launch();
        }
      };
      window.addEventListener("keydown", onKey, { once: true });
    }
  }

  showPracticeReveal({ headline, correct, explanation, onNext, nextLabel }) {
    const arena = document.getElementById("gameArena");
    if (!arena) return;

    // Freeze the question so it can't be answered again.
    arena.querySelectorAll("button, input, textarea").forEach(el => { el.disabled = true; });

    let panel = document.getElementById("practiceRevealPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "practiceRevealPanel";
      panel.className = "answer-reveal-panel practice-reveal-panel";
      arena.appendChild(panel);
    }
    panel.style.display = "block";

    const badgeClass = correct === null ? "passed-badge" : correct ? "correct-badge" : "incorrect-badge";
    panel.innerHTML = `
      <div class="result-badge ${badgeClass}">
        <div class="badge-lock-tag">PRACTICE MODE — NO POINTS</div>
        <div class="badge-headline">${headline}</div>
      </div>
      <div class="reveal-details-box">
        <p class="explanation-text"><strong>LEARN:</strong> ${explanation}</p>
      </div>
      <div class="reveal-actions">
        <button type="button" class="btn-primary-gaming" id="btnPracticeNext">
          ${nextLabel || "NEXT →"}
        </button>
      </div>
    `;

    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("btnPracticeNext")?.addEventListener("click", onNext);
  }

  renderBetweenRound(roundNumber, onProceedNext) {
    const roundNames = {
      1: "SCALE WARS",
      2: "CTRL + ALT + GUESS",
      3: "TECH MEME BATTLE",
      4: "BLACKOUT BUILD",
      5: "RETRO BLAST"
    };

    const screen = document.getElementById("screen-between-round");
    if (!screen) return;

    const roundScore = this.state.roundScores[roundNumber] || 0;
    const totalScore = this.state.totalScore;
    const rStats = this.state.stats.roundStats[roundNumber] || { correct: 0, incorrect: 0, passed: 0 };

    const nextRoundName = roundNames[roundNumber + 1] ? ` (${roundNames[roundNumber + 1]})` : "";

    screen.innerHTML = `
      <div class="cyber-modal between-round-card">
        <div class="modal-cyber-glow"></div>
        <div class="between-header">
          <span class="game-badge">ROUND ${roundNumber} / 5 COMPLETED</span>
          <h1 class="between-title">ROUND COMPLETE</h1>
          <p class="between-sub">${roundNames[roundNumber]}</p>
        </div>

        <div class="between-scores-grid">
          <div class="score-pod">
            <span class="pod-label">ROUND ${roundNumber} SCORE</span>
            <span class="pod-value neon-cyan">+${roundScore}</span>
          </div>
          <div class="score-pod">
            <span class="pod-label">TOTAL ACCUMULATED SCORE</span>
            <span class="pod-value neon-amber">${totalScore}</span>
          </div>
        </div>

        <div class="between-stats-container">
          <h3 class="section-title">PERFORMANCE METRICS</h3>
          <div class="stats-row">
            <div class="stat-cell correct">
              <span class="cell-count">${rStats.correct || rStats.hits || 0}</span>
              <span class="cell-label">CORRECT / HITS</span>
            </div>
            <div class="stat-cell incorrect">
              <span class="cell-count">${rStats.incorrect || rStats.misses || 0}</span>
              <span class="cell-label">INCORRECT / MISSES</span>
            </div>
            <div class="stat-cell passed">
              <span class="cell-count">${rStats.passed || 0}</span>
              <span class="cell-label">PASSED</span>
            </div>
          </div>
        </div>

        <div class="between-actions">
          <button type="button" class="btn-primary-gaming" id="btnProceedNextRound">
            RETURN TO 3D ARCADE FLOOR ▶ [UNLOCK CABINET ${roundNumber + 1}${nextRoundName}]
          </button>
          <p class="between-sub" style="margin-top: 12px; font-size: 0.9rem; color: #94a3b8; letter-spacing: 0.5px;">
            ✓ Points saved to tournament progress! Walk to Cabinet ${roundNumber + 1} to begin the next game.
          </p>
        </div>
      </div>
    `;

    this.showScreen("screen-between-round");

    const proceedBtn = document.getElementById("btnProceedNextRound");
    if (proceedBtn) {
      proceedBtn.addEventListener("click", onProceedNext);
    }
  }

  renderFinalResults(onPlayAgain, onReturnHome, onExploreRoom3d = null) {
    const screen = document.getElementById("screen-results");
    if (!screen) return;

    const total = this.state.totalScore;
    const max = this.state.highestPossibleScore;
    const tier = this.state.getPerformanceTier();
    const stats = this.state.stats;
    const accuracy = this.state.getAccuracy();

    screen.innerHTML = `
      <div class="cyber-modal results-card">
        <div class="modal-cyber-glow"></div>
        <div class="results-header">
          <span class="game-badge">TOURNAMENT CONCLUDED</span>
          <h1 class="results-title glitch-title" data-text="ARCADE COMPLETE">ARCADE COMPLETE</h1>
          <p class="results-tagline">“Five Games. One Score. Zero Room for Error.”</p>
        </div>

        <!-- Performance Tier Crest Banner -->
        <div class="tier-banner ${tier.badgeClass}">
          <div class="tier-crest">${tier.tier} TIER</div>
          <div class="tier-details">
            <h2 class="tier-title">${tier.title}</h2>
            <p class="tier-comment">${tier.comment}</p>
          </div>
        </div>

        <!-- Big Score Pod -->
        <div class="final-score-pod">
          <span class="f-label">FINAL ACCUMULATED SCORE</span>
          <div class="f-score-display">
            <span class="score-curr">${total}</span>
            <span class="score-slash">/</span>
            <span class="score-max">${max}</span>
          </div>
        </div>

        <!-- Round by Round Score Breakdown -->
        <div class="results-breakdown-section">
          <h3 class="section-title">SCORE BREAKDOWN</h3>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="b-round">ROUND 1</span>
              <span class="b-name">Scale Wars</span>
              <span class="b-score">${this.state.roundScores[1]} / 100 pts</span>
            </div>
            <div class="breakdown-item">
              <span class="b-round">ROUND 2</span>
              <span class="b-name">CTRL + ALT + GUESS</span>
              <span class="b-score">${this.state.roundScores[2]} / 100 pts</span>
            </div>
            <div class="breakdown-item">
              <span class="b-round">ROUND 3</span>
              <span class="b-name">Tech Meme Battle</span>
              <span class="b-score">${this.state.roundScores[3]} / 150 pts</span>
            </div>
            <div class="breakdown-item">
              <span class="b-round">ROUND 4</span>
              <span class="b-name">Blackout Build</span>
              <span class="b-score">${this.state.roundScores[4]} / 200 pts</span>
            </div>
            <div class="breakdown-item">
              <span class="b-round">ROUND 5</span>
              <span class="b-name">Retro Blast</span>
              <span class="b-score">${this.state.roundScores[5] || 0} / 100 pts</span>
            </div>
          </div>
        </div>

        <!-- Overall Accuracy Metrics -->
        <div class="results-performance-summary">
          <h3 class="section-title">PERFORMANCE METRICS</h3>
          <div class="stats-row">
            <div class="stat-cell correct">
              <span class="cell-count">${stats.totalCorrect}</span>
              <span class="cell-label">CORRECT</span>
            </div>
            <div class="stat-cell incorrect">
              <span class="cell-count">${stats.totalIncorrect}</span>
              <span class="cell-label">INCORRECT</span>
            </div>
            <div class="stat-cell passed">
              <span class="cell-count">${stats.totalPassed}</span>
              <span class="cell-label">PASSED</span>
            </div>
            <div class="stat-cell accuracy">
              <span class="cell-count neon-cyan">${accuracy}%</span>
              <span class="cell-label">ACCURACY</span>
            </div>
          </div>
        </div>

        <!-- Submit to Leaderboard Card (Admin Only - auto-saved for registered teams) -->
        ${AuthManager.isAdminAuthenticated() ? `
        <div class="submit-leaderboard-card">
          <div class="submit-card-header">
            <span class="submit-icon">🏆</span>
            <div class="submit-header-text">
              <h3 class="submit-title">SAVE YOUR SCORE TO LEADERBOARD</h3>
              <p class="submit-sub">Immortalize this tournament run on the official championship board</p>
            </div>
          </div>
          <div class="submit-input-grid">
            <div class="submit-field">
              <label for="contestantNameInput">CONTESTANT / TEAM NAME</label>
              <input type="text" id="contestantNameInput" class="arcade-text-input" value="${this.state.activeTeam?.name || ''}" placeholder="e.g. MasterCoder or Team Titan" maxlength="30" />
            </div>
            <div class="submit-field">
              <label for="contestantDeptInput">DEPARTMENT / COLLEGE</label>
              <input type="text" id="contestantDeptInput" class="arcade-text-input" value="${this.state.activeTeam?.department || ''}" placeholder="e.g. AI &amp; Data Science (SY)" maxlength="40" />
            </div>
          </div>
          <button type="button" class="btn-primary-gaming btn-save-leaderboard" id="btnSaveToLeaderboard">
            ⭐ SAVE SCORE TO LEADERBOARD
          </button>
        </div>
        ` : `
        <div class="submit-leaderboard-card student-notice">
          <div class="submit-card-header">
            <span class="submit-icon">✅</span>
            <div class="submit-header-text">
              <h3 class="submit-title">SCORE RECORDED</h3>
              <p class="submit-sub">Your score has been automatically saved. The event organizer will display the leaderboard.</p>
            </div>
          </div>
        </div>
        `}

        <div class="results-actions">
          <button type="button" class="btn-primary-gaming" id="btnPlayAgain">
            🔄 NEXT MATCH / PLAY AGAIN
          </button>
          ${onExploreRoom3d ? `
          <button type="button" class="btn-secondary-gaming" id="btnResultsRoom3d">
            🕹️ EXPLORE 3D ARCADE
          </button>
          ` : ''}
          ${AuthManager.isAdminAuthenticated() ? `
          <button type="button" class="btn-secondary-gaming" id="btnResultsViewLeaderboard">
            🏆 VIEW LEADERBOARD
          </button>
          ` : ''}
          <button type="button" class="btn-secondary-gaming" id="btnReturnHome">
            🏠 RETURN HOME
          </button>
          <button type="button" class="btn-nav-mode" id="btnResultsPresMode">
            📽️ PRESENTATION MODE
          </button>
        </div>
      </div>
    `;

    // Automatically record to roster & leaderboard if team was registered
    if (this.state.activeTeam?.id && !this.state.activeTeam.isGuest) {
      LeaderboardManager.updateTeamStatus(this.state.activeTeam.id, "completed", {
        score: total,
        tier: tier.tier,
        roundScores: { ...this.state.roundScores }
      });
      LeaderboardManager.addEntry({
        name: this.state.activeTeam.name,
        department: this.state.activeTeam.department,
        score: total,
        maxScore: max,
        tier: tier.tier,
        tierTitle: tier.title,
        badgeClass: tier.badgeClass,
        roundScores: { ...this.state.roundScores },
        accuracy
      });
    }

    this.showScreen("screen-results");

    const playAgainBtn = document.getElementById("btnPlayAgain");
    const returnHomeBtn = document.getElementById("btnReturnHome");
    const room3dBtn = document.getElementById("btnResultsRoom3d");
    const presBtn = document.getElementById("btnResultsPresMode");
    const viewLbBtn = document.getElementById("btnResultsViewLeaderboard");
    const saveLbBtn = document.getElementById("btnSaveToLeaderboard");

    if (playAgainBtn) playAgainBtn.addEventListener("click", onPlayAgain);
    if (returnHomeBtn) returnHomeBtn.addEventListener("click", onReturnHome);
    if (room3dBtn && onExploreRoom3d) room3dBtn.addEventListener("click", onExploreRoom3d);
    if (presBtn) presBtn.addEventListener("click", () => this.togglePresentationMode());
    if (viewLbBtn) viewLbBtn.addEventListener("click", () => this.renderLeaderboardScreen(onPlayAgain, onReturnHome));

    if (saveLbBtn) {
      saveLbBtn.addEventListener("click", () => {
        const nameInput = document.getElementById("contestantNameInput");
        const deptInput = document.getElementById("contestantDeptInput");
        const name = nameInput ? nameInput.value.trim() : "";
        const department = deptInput ? deptInput.value.trim() : "";

        if (!name) {
          alert("Please enter a contestant or team name to submit your score!");
          if (nameInput) nameInput.focus();
          return;
        }

        LeaderboardManager.addEntry({
          name,
          department: department || "General Engineering",
          score: total,
          maxScore: max,
          tier: tier.tier,
          tierTitle: tier.title,
          badgeClass: tier.badgeClass,
          roundScores: { ...this.state.roundScores },
          accuracy
        });

        this.renderLeaderboardScreen(onPlayAgain, onReturnHome);
      });
    }
  }

  renderLeaderboardScreen(onStartRun, onBackHome) {
    if (!AuthManager.isAdminAuthenticated()) {
      this.showScreen("screen-home");
      return;
    }
    const screen = document.getElementById("screen-leaderboard");
    if (!screen) return;
    LeaderboardManager.renderScreen(screen, { onStartRun, onBackHome });
    this.showScreen("screen-leaderboard");
  }
}
