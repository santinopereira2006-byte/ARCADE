/**
 * ARCADE - Game Module: CTRL + ALT + GUESS (Round 2)
 * Progressive 4-stage unblur and crop reveal technology identification
 * Stage 1 (20 pts) -> Stage 2 (15 pts) -> Stage 3 (10 pts) -> Stage 4 (5 pts)
 */

export class CtrlAltGuessRenderer {
  static renderQuestion(question, currentStage = 1, eliminatedOptions = [], fiftyFiftyUsed = false) {
    const pointsMap = { 1: 20, 2: 15, 3: 10, 4: 5 };
    const currentPoints = pointsMap[currentStage] || 5;

    return `
      <div class="ctrl-alt-container">
        <div class="game-instruction-banner">
          <span class="game-badge">ROUND 2: CTRL + ALT + GUESS</span>
          <h2 class="game-headline">${question.question}</h2>
          <p class="game-sub">${question.category} | ${question.hint}</p>
        </div>

        <!-- Progressive Reveal Stage Visual Box -->
        <div class="reveal-stage-wrapper">
          <div class="reveal-stage-header">
            <div class="stage-stepper">
              <span class="step-pip ${currentStage >= 1 ? 'active' : ''}">STAGE 1 (20 PTS)</span>
              <span class="step-pip ${currentStage >= 2 ? 'active' : ''}">STAGE 2 (15 PTS)</span>
              <span class="step-pip ${currentStage >= 3 ? 'active' : ''}">STAGE 3 (10 PTS)</span>
              <span class="step-pip ${currentStage >= 4 ? 'active' : ''}">STAGE 4 (5 PTS)</span>
            </div>
            <div class="current-value-badge neon-amber">
              CURRENT VALUE: <strong>+${currentPoints} PTS</strong>
            </div>
          </div>

          <!-- Filtered Graphic Screen -->
          <div class="graphic-screen-viewport">
            <div class="graphic-canvas-box reveal-filter-stage-${currentStage}" id="progressiveGraphicBox">
              ${question.imgSrc ? `<img src="${question.imgSrc}" class="tech-graphic-img" alt="${question.question}" />` : question.svgContent}
              <div class="cyber-scan-grid"></div>
            </div>
          </div>

          <!-- Progressive Reveal Controls & Lifeline -->
          <div class="reveal-actions-strip">
            ${currentStage < 4 ? `
              <button type="button" class="btn-advance-reveal" id="btnAdvanceReveal">
                🔍 REVEAL MORE (DROPS TO +${pointsMap[currentStage + 1]} PTS)
              </button>
            ` : `
              <span class="max-reveal-label">FULL CLARITY REACHED (5 PTS)</span>
            `}
            <button type="button" class="btn-lifeline-fifty" id="btnFiftyFifty" ${fiftyFiftyUsed ? 'disabled' : ''}>
              ⚖️ 50:50 LIFELINE (+10 PTS)
            </button>
          </div>
        </div>

        <!-- Choice Options Grid -->
        <div class="tech-options-grid">
          ${question.options.map((opt, idx) => {
            const isEliminated = Array.isArray(eliminatedOptions) && eliminatedOptions.includes(opt);
            return `
              <button type="button" class="btn-tech-opt btn-choice-opt ${isEliminated ? 'option-eliminated' : ''}" data-choice="${opt}" ${isEliminated ? 'disabled' : ''}>
                <span class="opt-prefix">${String.fromCharCode(65 + idx)}</span>
                <span class="opt-label">${opt}</span>
                <span class="opt-stake">${isEliminated ? 'ELIMINATED' : `+${currentPoints}`}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="game-action-footer">
          <button type="button" class="btn-arcade-pass" id="btnPass">
            ⏭️ PASS (0 PTS)
          </button>
        </div>
      </div>
    `;
  }
}
