/**
 * ARCADE - Game Module: BLACKOUT CODE (Round 4)
 * Professional Tech-Event Memory Speed-Coding Game
 * 5 Progressive Rounds | 1 Coding Language Per Round | 8-Minute Global Timer | 1000 Total Points
 */

import { BLACKOUT_LEVELS, ROUND4_CONFIG } from "../data/round4-blackout.js";

export class BlackoutBuildRenderer {
  /**
   * Format code with line numbers and syntax formatting
   */
  static renderCodeLines(targetCode) {
    const lines = targetCode.split("\n");
    return lines.map((line, idx) => {
      const escaped = BlackoutBuildRenderer.escapeHtml(line);
      return `<div class="code-line"><span class="line-no">${idx + 1}</span><span class="line-text">${escaped || "&nbsp;"}</span></div>`;
    }).join("");
  }

  static escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Render the Blackout Code Arena for the active round (1 language per round)
   */
  static renderLevel(levelIndex, currentPhase = "visibility", currentCode = "") {
    const levelData = BLACKOUT_LEVELS[levelIndex] || BLACKOUT_LEVELS[0];
    const targetCode = levelData.targetCode;
    const isBlackout = currentPhase === "blackout";
    const isRound5MemPhase = levelData.level === 5 && currentPhase === "memorize";

    return `
      <div class="blackout-code-container level-${levelData.level}">
        <!-- Top Mission Header (Single Language Display) -->
        <div class="blackout-mission-bar">
          <div class="mission-info">
            <span class="mission-tier-chip">${levelData.roundName}</span>
            <h2 class="mission-title">${levelData.title}</h2>
            <p class="mission-subtitle">${levelData.description}</p>
          </div>

          <div class="mission-meta-group">
            <div class="meta-pill stake-pill">
              <span class="pill-lbl">STAKE WEIGHT</span>
              <span class="pill-val neon-amber">${levelData.maxPoints} PTS</span>
            </div>

            <!-- Single Language Chip -->
            <div class="meta-pill lang-pill">
              <span class="pill-lbl">LANGUAGE</span>
              <span class="pill-val neon-cyan">${levelData.languageIcon} ${levelData.languageName}</span>
            </div>
          </div>
        </div>

        <!-- Live Round Status Sub-bar -->
        <div class="round-status-strip">
          <div class="status-item">
            <span class="s-label">ROUND PROGRESS</span>
            <span class="s-val">ROUND ${levelData.level} OF 5</span>
          </div>
          <div class="status-item">
            <span class="s-label">DIFFICULTY</span>
            <span class="s-val neon-magenta">${levelData.difficulty}</span>
          </div>
          <div class="status-item status-shutter-item">
            <span class="s-label">VISIBILITY PROTOCOL</span>
            <span class="s-val ${isBlackout ? 'neon-red' : 'neon-green'}" id="liveShutterStatus">
              ${levelData.level === 1 ? '👁️ 100% CONSTANT VISIBILITY' : `👁️ VISIBILITY ACTIVE (${levelData.visibilitySeconds}s)`}
            </span>
          </div>
        </div>

        <!-- Split View: Target Reference Code vs Player Answer Editor -->
        <div class="blackout-split-stage">
          <!-- Target Reference Panel -->
          <div class="code-editor-card target-card">
            <div class="editor-header">
              <div class="window-controls">
                <span class="ctrl-dot red"></span>
                <span class="ctrl-dot yellow"></span>
                <span class="ctrl-dot green"></span>
              </div>
              <span class="editor-title">TARGET REFERENCE — [${levelData.languageName}]</span>
              <span class="editor-status-tag ${isBlackout ? 'tag-blackout' : 'tag-visible'}" id="targetStatusTag">
                ${isBlackout ? '⚠️ BLACKOUT' : '👁️ VISIBLE'}
              </span>
            </div>

            <div class="code-viewport unselectable" id="targetCodeViewport" oncopy="return false" oncut="return false" oncontextmenu="return false">
              <div class="code-display-body" id="targetCodeDisplay">
                ${BlackoutBuildRenderer.renderCodeLines(targetCode)}
              </div>

              <!-- Blackout Shutter Overlay (Zero Blur / 100% Solid Hide) -->
              <div class="blackout-solid-shutter ${isBlackout ? 'active' : ''}" id="blackoutShutter">
                <div class="shutter-hud-card">
                  <div class="shutter-icon">🔒</div>
                  <h3 class="shutter-heading">BLACKOUT ACTIVE</h3>
                  <p class="shutter-sub" id="shutterSubMessage">
                    ${levelData.level === 5 ? 'MEMORIZATION COMPLETE. TYPE FROM MEMORY!' : 'REFERENCE HIDDEN. REPRODUCE FROM MEMORY.'}
                  </p>
                  <div class="buffer-count-chip">
                    <span class="blink-dot"></span>
                    <span id="blindKeystrokeCount">BUFFER: ${currentCode.length} CHARS RECORDED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Player Answer Editor Panel -->
          <div class="code-editor-card input-card">
            <div class="editor-header">
              <div class="window-controls">
                <span class="ctrl-dot blue"></span>
                <span class="ctrl-dot purple"></span>
              </div>
              <span class="editor-title">ANSWER TERMINAL</span>
              <span class="editor-status-tag tag-answer">LIVE BUFFER</span>
            </div>

            <div class="input-viewport">
              <div class="editor-gutter" id="lineGutter">1</div>
              <textarea 
                id="blackoutCodeEditor" 
                class="blackout-textarea" 
                placeholder="${isRound5MemPhase ? '// MEMORIZE THE CODE ABOVE... (TYPING UNLOCKS IN 10s)' : '// Type the code from memory here...'}"
                spellcheck="false" 
                autocomplete="off" 
                autocorrect="off" 
                autocapitalize="off"
                ${isRound5MemPhase ? 'disabled' : ''}
                onpaste="return false">${currentCode}</textarea>
            </div>
          </div>
        </div>

        <!-- Action Control Bar -->
        <div class="blackout-action-bar">
          <div class="action-hints">
            <span class="hint-text">💡 <b>Tab</b> inserts 2 spaces. Copy/paste is disabled. Click Submit when ready.</span>
          </div>
          <div class="action-buttons">
            <button type="button" class="btn-ide-action" id="btnResetCode">
              🔄 CLEAR BUFFER
            </button>
            <button type="button" class="btn-primary-gaming btn-submit-blackout" id="btnSubmitCode">
              🚀 SUBMIT CODE
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Evaluate typing submission vs target code
   */
  static evaluateTyping(targetCode, typedCode, maxPoints) {
    const normalize = (str) => str.replace(/\r\n/g, "\n").trim();
    // Normalize indentations (4 spaces -> 2 spaces) so tab width differences don't penalize students
    const cleanTarget = normalize(targetCode).replace(/    /g, "  ");
    const cleanTyped = normalize(typedCode).replace(/    /g, "  ");

    if (!cleanTyped) {
      return {
        accuracy: 0,
        completion: 0,
        pointsEarned: 0,
        maxPoints,
        isPerfect: false,
        passed: false
      };
    }

    // Character-by-character comparison
    let matchCount = 0;
    const minLen = Math.min(cleanTarget.length, cleanTyped.length);
    for (let i = 0; i < minLen; i++) {
      if (cleanTarget[i] === cleanTyped[i]) matchCount++;
    }

    // Levenshtein-like accuracy ratio
    const charAccuracy = Math.max(0, Math.round((matchCount / Math.max(cleanTarget.length, cleanTyped.length)) * 100));
    const completion = Math.min(100, Math.round((cleanTyped.length / cleanTarget.length) * 100));

    // Calculate line accuracy
    const targetLines = cleanTarget.split("\n");
    const typedLines = cleanTyped.split("\n");
    let matchedLines = 0;
    targetLines.forEach((tLine, idx) => {
      if (typedLines[idx] && typedLines[idx].trim() === tLine.trim()) {
        matchedLines++;
      }
    });

    const lineAccuracy = Math.round((matchedLines / targetLines.length) * 100);
    const overallAccuracy = Math.round(charAccuracy * 0.7 + lineAccuracy * 0.3);

    const isPerfect = cleanTarget === cleanTyped;
    const pointsEarned = isPerfect
      ? maxPoints
      : Math.round((overallAccuracy / 100) * maxPoints);

    const passed = overallAccuracy >= 60;

    return {
      accuracy: overallAccuracy,
      completion,
      pointsEarned,
      maxPoints,
      isPerfect,
      passed,
      matchedLines,
      totalLines: targetLines.length
    };
  }

  /**
   * Render Between-Round Transition Modal
   */
  static renderRoundTransition(levelIndex, evaluation, onProceed) {
    const levelData = BLACKOUT_LEVELS[levelIndex];
    const isLastRound = levelIndex >= BLACKOUT_LEVELS.length - 1;

    return `
      <div class="cyber-modal level-results-modal">
        <div class="modal-cyber-glow"></div>
        <div class="between-header">
          <span class="game-badge">${levelData.roundName} EVALUATION</span>
          <h2 class="between-title">${evaluation.isPerfect ? 'PERFECT REPRODUCTION! 🔥' : evaluation.passed ? 'ROUND COMPLETED' : 'ROUND SUBMITTED'}</h2>
          <p class="between-sub">${levelData.title}</p>
        </div>

        <div class="level-score-pod">
          <span class="l-lbl">POINTS AWARDED</span>
          <span class="l-score neon-amber">+${evaluation.pointsEarned} / ${levelData.maxPoints} PTS</span>
        </div>

        <div class="level-breakdown-grid">
          <div class="b-cell ${evaluation.accuracy >= 80 ? 'pass' : 'fail'}">
            <span class="b-name">ACCURACY</span>
            <span class="b-val">${evaluation.accuracy}%</span>
          </div>
          <div class="b-cell ${evaluation.completion >= 80 ? 'pass' : 'fail'}">
            <span class="b-name">CODE COMPLETION</span>
            <span class="b-val">${evaluation.completion}%</span>
          </div>
          <div class="b-cell ${evaluation.passed ? 'pass' : 'fail'}">
            <span class="b-name">SYNTAX STATUS</span>
            <span class="b-val">${evaluation.passed ? 'ACCEPTED' : 'ERRORS DETECTED'}</span>
          </div>
        </div>

        <div class="between-actions">
          <button type="button" class="btn-primary-gaming" id="btnNextLevelAction">
            ${isLastRound ? 'VIEW FINAL BLACKOUT RESULTS →' : `PROCEED TO ROUND ${levelData.level + 1} →`}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render Final Results Screen for BLACKOUT CODE (1000 Points Total)
   */
  static renderFinalResults(roundResults = [], totalScore = 0, elapsedSeconds = 0) {
    const maxScore = ROUND4_CONFIG.maxPoints || 1000;
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const avgAccuracy = roundResults.length > 0
      ? Math.round(roundResults.reduce((acc, r) => acc + (r.accuracy || 0), 0) / roundResults.length)
      : 0;

    return `
      <div class="cyber-modal results-card blackout-final-modal">
        <div class="modal-cyber-glow"></div>
        <div class="results-header">
          <span class="game-badge">BLACKOUT CODE — COMPLETE</span>
          <h1 class="results-title">FINAL TOURNAMENT SCORE</h1>
          <div class="final-score-display neon-amber">${totalScore} / ${maxScore}</div>
        </div>

        <!-- 5-Round Performance Table -->
        <div class="results-table-container">
          <table class="blackout-results-table">
            <thead>
              <tr>
                <th>ROUND</th>
                <th>DIFFICULTY</th>
                <th>LANGUAGE</th>
                <th>RESULT</th>
                <th>ACCURACY</th>
                <th>SCORE</th>
              </tr>
            </thead>
            <tbody>
              ${BLACKOUT_LEVELS.map((lvl, idx) => {
      const res = roundResults[idx] || { passed: false, accuracy: 0, pointsEarned: 0 };
      return `
                  <tr class="${res.passed ? 'row-pass' : 'row-fail'}">
                    <td><b>Round ${lvl.level}</b></td>
                    <td>${lvl.difficulty}</td>
                    <td>${lvl.languageIcon} ${lvl.languageName}</td>
                    <td><span class="res-badge ${res.passed ? 'pass' : 'fail'}">${res.passed ? '✓ PASSED' : '✗ INCOMPLETE'}</span></td>
                    <td>${res.accuracy || 0}%</td>
                    <td class="neon-amber"><b>+${res.pointsEarned || 0} / ${lvl.maxPoints}</b></td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Overall Summary Stats -->
        <div class="results-summary-row">
          <div class="summary-stat-box">
            <span class="stat-lbl">TOTAL SCORE</span>
            <span class="stat-val neon-amber">${totalScore} PTS</span>
          </div>
          <div class="summary-stat-box">
            <span class="stat-lbl">ROUNDS COMPLETED</span>
            <span class="stat-val">${roundResults.filter(r => r.passed).length} / 5</span>
          </div>
          <div class="summary-stat-box">
            <span class="stat-lbl">OVERALL ACCURACY</span>
            <span class="stat-val neon-green">${avgAccuracy}%</span>
          </div>
          <div class="summary-stat-box">
            <span class="stat-lbl">TIME ELAPSED</span>
            <span class="stat-val neon-cyan">${timeFormatted}</span>
          </div>
        </div>

        <!-- Finish Actions -->
        <div class="results-actions">
          <button type="button" class="btn-primary-gaming" id="btnFinishRound4">
            PROCEED TO ROUND 5: RETRO BLAST →
          </button>
        </div>
      </div>
    `;
  }
}
