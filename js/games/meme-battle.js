/**
 * ARCADE - Game Module: Tech Meme Battle (Round 3)
 * Phase A: Meme Identification & Context Matching (5 x 15 = 75 pts)
 * Phase B: Interactive Meme Creation Studio & Organizer Rubric (75 pts)
 */

import { MEME_TEMPLATES, MEME_CREATOR_PROMPTS } from "../data/round3-memes.js";

export class MemeBattleRenderer {
  // Phase A: Trivia / Punchline Matching
  static renderTriviaQuestion(question, questionIndex, totalQuestions, onSelectAnswer, onPass) {
    return `
      <div class="meme-battle-container">
        <div class="game-instruction-banner">
          <span class="game-badge">ROUND 3: TECH MEME BATTLE (PHASE A: RECALL)</span>
          <h2 class="game-headline">${question.question}</h2>
          <p class="game-sub">${question.setupText}</p>
        </div>

        <div class="meme-trivia-stage">
          <div class="meme-graphic-card">
            ${question.svgMeme}
          </div>

          <div class="meme-options-grid">
            ${question.options.map((opt, idx) => `
              <button type="button" class="btn-meme-opt btn-choice-opt" data-choice="${opt}">
                <span class="opt-prefix">${String.fromCharCode(65 + idx)}</span>
                <span class="opt-text">${opt}</span>
                <span class="opt-stake">+15 PTS</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="game-action-footer">
          <button type="button" class="btn-arcade-pass" id="btnPass">
            ⏭️ PASS (0 PTS)
          </button>
        </div>
      </div>
    `;
  }

  // Phase B: Meme Creation Studio
  static renderMemeStudio(selectedPromptIndex = 0, selectedTemplateId = "drake") {
    const prompt = MEME_CREATOR_PROMPTS[selectedPromptIndex] || MEME_CREATOR_PROMPTS[0];
    const template = MEME_TEMPLATES.find(t => t.id === selectedTemplateId) || MEME_TEMPLATES[0];

    return `
      <div class="meme-studio-container">
        <div class="game-instruction-banner">
          <span class="game-badge">ROUND 3: TECH MEME BATTLE (PHASE B: CREATION)</span>
          <h2 class="game-headline">CREATE YOUR TECH MEME</h2>
          <p class="game-sub">PROMPT: <strong>${prompt.title}</strong> — ${prompt.description}</p>
        </div>

        <div class="meme-studio-workspace">
          <!-- Left: Meme Customization Controls -->
          <div class="studio-controls-card">
            <div class="control-group">
              <label class="studio-lbl">SELECT MEME TEMPLATE:</label>
              <div class="template-selector-grid">
                ${MEME_TEMPLATES.map(tmpl => `
                  <button type="button" class="btn-template-select ${tmpl.id === template.id ? 'active' : ''}" data-template="${tmpl.id}">
                    <span class="tmpl-swatch" style="background: ${tmpl.accentColor}"></span>
                    <span class="tmpl-name">${tmpl.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="control-group">
              <label class="studio-lbl" for="topTextInput">TOP CAPTION / SETUP:</label>
              <input type="text" id="topTextInput" class="arcade-text-input" placeholder="${template.topPlaceholder}" maxlength="60" />
            </div>

            <div class="control-group">
              <label class="studio-lbl" for="bottomTextInput">BOTTOM CAPTION / PUNCHLINE:</label>
              <input type="text" id="bottomTextInput" class="arcade-text-input" placeholder="${template.bottomPlaceholder}" maxlength="60" />
            </div>

            <div class="studio-actions-bar">
              <button type="button" class="btn-primary-gaming" id="btnSubmitMeme">
                🚀 SUBMIT MEME FOR JUDGING
              </button>
            </div>
            
            <p class="community-rules-hint">⚠️ All submissions must adhere to standard campus technical fest code of conduct. No inappropriate/NSFW content.</p>
          </div>

          <!-- Right: Live Canvas Meme Preview -->
          <div class="studio-preview-card">
            <div class="preview-header">
              <span class="p-title">LIVE RENDER PREVIEW</span>
              <span class="p-badge" id="tmplBadge">${template.name.toUpperCase()}</span>
            </div>
            
            <div class="meme-canvas-stage" id="memeCanvasStage">
              <!-- Rendered dynamically -->
              <div class="meme-canvas-box" id="memeCanvasBox" style="border-color: ${template.accentColor}">
                <div class="meme-text top-caption" id="renderedTopText">${template.topPlaceholder}</div>
                <div class="meme-canvas-art" id="memeCanvasArt">
                  ${template.imgSrc ? `<img src="${template.imgSrc}" class="meme-template-img" alt="${template.name}" />` : this.getTemplateSVG(template.id)}
                </div>
                <div class="meme-text bottom-caption" id="renderedBottomText">${template.bottomPlaceholder}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static getTemplateSVG(templateId) {
    switch (templateId) {
      case "dicaprio":
        return `
          <svg viewBox="0 0 300 180" class="meme-art-svg">
            <rect width="300" height="180" fill="#0b132b"/>
            <!-- Sparkles / Atmosphere -->
            <circle cx="50" cy="35" r="3" fill="#fbbf24" opacity="0.6"/>
            <circle cx="250" cy="30" r="4" fill="#fbbf24" opacity="0.7"/>
            <circle cx="270" cy="80" r="3" fill="#60a5fa" opacity="0.5"/>
            <circle cx="35" cy="110" r="3" fill="#f472b6" opacity="0.5"/>
            <!-- Tuxedo Body -->
            <path d="M 90 180 L 110 130 L 190 130 L 210 180 Z" fill="#1e293b"/>
            <!-- Shirt & Bowtie -->
            <polygon points="140,130 160,130 150,145" fill="#ffffff"/>
            <polygon points="143,142 157,142 150,148" fill="#000000"/>
            <!-- Head -->
            <ellipse cx="150" cy="95" rx="30" ry="34" fill="#fbd38d"/>
            <!-- Hair -->
            <path d="M 120 85 C 120 58 180 58 180 85 C 170 70 130 70 120 85 Z" fill="#92400e"/>
            <!-- Brows & Eyes -->
            <path d="M 132 88 Q 140 84 146 88" stroke="#78350f" stroke-width="2.5" fill="none"/>
            <path d="M 154 88 Q 160 84 168 88" stroke="#78350f" stroke-width="2.5" fill="none"/>
            <circle cx="140" cy="93" r="2.5" fill="#1e293b"/>
            <circle cx="160" cy="93" r="2.5" fill="#1e293b"/>
            <!-- Smirk -->
            <path d="M 138 112 Q 150 122 165 110" stroke="#991b1b" stroke-width="3" fill="none"/>
            <!-- Arm & Raised Glass -->
            <line x1="190" y1="140" x2="225" y2="90" stroke="#fbd38d" stroke-width="8" stroke-linecap="round"/>
            <path d="M 215 65 L 245 65 L 235 85 L 225 85 Z" fill="#fef08a" opacity="0.9" stroke="#f59e0b" stroke-width="1.5"/>
            <line x1="230" y1="85" x2="230" y2="105" stroke="#f59e0b" stroke-width="2"/>
            <line x1="220" y1="105" x2="240" y2="105" stroke="#f59e0b" stroke-width="2"/>
            <text x="150" y="172" fill="#38bdf8" font-family="'Orbitron', sans-serif" font-weight="900" font-size="12" text-anchor="middle">CHEERS TO THAT 🥂</text>
          </svg>
        `;
      case "button":
        return `
          <svg viewBox="0 0 300 180" class="meme-art-svg">
            <rect width="300" height="180" fill="#18181b"/>
            <!-- Console panel with 2 red buttons -->
            <rect x="25" y="20" width="250" height="60" rx="8" fill="#27272a" stroke="#52525b" stroke-width="2"/>
            <!-- Button 1 -->
            <ellipse cx="85" cy="48" rx="35" ry="16" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>
            <ellipse cx="85" cy="44" rx="30" ry="12" fill="#f87171"/>
            <text x="85" y="48" fill="#fff" font-size="9" font-family="monospace" font-weight="900" text-anchor="middle">BUTTON A</text>
            <!-- Button 2 -->
            <ellipse cx="215" cy="48" rx="35" ry="16" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>
            <ellipse cx="215" cy="44" rx="30" ry="12" fill="#f87171"/>
            <text x="215" y="48" fill="#fff" font-size="9" font-family="monospace" font-weight="900" text-anchor="middle">BUTTON B</text>
            <!-- Sweating Character Face -->
            <circle cx="150" cy="132" r="32" fill="#fed7aa"/>
            <!-- Eyes -->
            <circle cx="140" cy="127" r="7" fill="#fff"/>
            <circle cx="160" cy="127" r="7" fill="#fff"/>
            <circle cx="140" cy="127" r="3.5" fill="#000"/>
            <circle cx="160" cy="127" r="3.5" fill="#000"/>
            <!-- Mouth -->
            <path d="M 140 148 Q 150 142 160 148" stroke="#7c2d12" stroke-width="2" fill="none"/>
            <!-- Sweat Drops -->
            <path d="M 125 112 Q 120 122 125 125 Q 130 122 125 112" fill="#38bdf8"/>
            <path d="M 175 117 Q 170 127 175 130 Q 180 127 175 117" fill="#38bdf8"/>
            <!-- Towel wiping forehead -->
            <ellipse cx="115" cy="116" rx="14" ry="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
            <text x="150" y="172" fill="#f87171" font-family="'Orbitron', sans-serif" font-weight="800" font-size="11" text-anchor="middle">SWEATING DECISION 😰</text>
          </svg>
        `;
      case "boyfriend":
      case "distracted":
        return `
          <svg viewBox="0 0 300 180" class="meme-art-svg">
            <rect width="300" height="180" fill="#0f172a"/>
            <!-- Street line -->
            <line x1="0" y1="140" x2="300" y2="140" stroke="#334155" stroke-width="2"/>
            <!-- Girl in red on left -->
            <circle cx="65" cy="65" r="18" fill="#f43f5e"/>
            <path d="M 52 83 L 78 83 L 84 135 L 46 135 Z" fill="#e11d48"/>
            <rect x="25" y="142" width="80" height="24" rx="4" fill="#e11d48"/>
            <text x="65" y="158" fill="#fff" font-size="9" font-weight="800" font-family="sans-serif" text-anchor="middle">NEW TECH</text>
            <!-- Distracted Boyfriend in middle -->
            <circle cx="150" cy="60" r="20" fill="#3b82f6"/>
            <path d="M 134 80 L 166 80 L 170 135 L 130 135 Z" fill="#2563eb"/>
            <path d="M 136 55 Q 110 50 95 62" stroke="#fbbf24" stroke-width="3" fill="none" stroke-dasharray="3,2"/>
            <rect x="110" y="142" width="80" height="24" rx="4" fill="#2563eb"/>
            <text x="150" y="158" fill="#fff" font-size="9" font-weight="800" font-family="sans-serif" text-anchor="middle">DEVELOPER</text>
            <!-- Girlfriend on right -->
            <circle cx="235" cy="65" r="18" fill="#10b981"/>
            <path d="M 222 83 L 248 83 L 254 135 L 216 135 Z" fill="#059669"/>
            <line x1="222" y1="65" x2="195" y2="65" stroke="#ef4444" stroke-width="2"/>
            <polygon points="195,65 202,61 202,69" fill="#ef4444"/>
            <rect x="195" y="142" width="90" height="24" rx="4" fill="#059669"/>
            <text x="240" y="158" fill="#fff" font-size="9" font-weight="800" font-family="sans-serif" text-anchor="middle">CURRENT CODE</text>
          </svg>
        `;
      case "drake":
      default:
        return `
          <svg viewBox="0 0 300 180" class="meme-art-svg">
            <rect width="300" height="180" fill="#1c1917"/>
            <!-- Top Panel: Disapproving gesture -->
            <line x1="0" y1="90" x2="300" y2="90" stroke="#44403c" stroke-width="2"/>
            <circle cx="60" cy="45" r="20" fill="#f59e0b"/>
            <line x1="60" y1="35" x2="30" y2="45" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
            <text x="120" y="52" fill="#ef4444" font-family="'Orbitron', sans-serif" font-weight="900" font-size="16">❌ NOPE</text>
            <!-- Bottom Panel: Approving gesture -->
            <circle cx="60" cy="135" r="20" fill="#f59e0b"/>
            <line x1="60" y1="135" x2="90" y2="125" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
            <text x="120" y="142" fill="#10b981" font-family="'Orbitron', sans-serif" font-weight="900" font-size="16">✔️ PERFECTION</text>
          </svg>
        `;
    }
  }

  // Phase B: Organizer Rubric Judging Modal
  static renderJudgingRubric(memeData, onScoreAwarded) {
    return `
      <div class="cyber-modal rubric-modal" id="memeJudgingModal">
        <div class="modal-cyber-glow"></div>
        <div class="rubric-header">
          <span class="game-badge">ORGANIZER EVALUATION</span>
          <h2 class="rubric-title">MEME BATTLE SCORING RUBRIC</h2>
          <p class="rubric-sub">Award points across 3 official criteria (Max: 75 Points)</p>
        </div>

        <div class="submitted-meme-summary">
          <div class="sub-meme-preview">
            <div class="meme-text top">${memeData.topText}</div>
            <div class="sub-art">
              ${(() => {
                const tmpl = MEME_TEMPLATES.find(t => t.id === memeData.templateId);
                return tmpl?.imgSrc ? `<img src="${tmpl.imgSrc}" class="meme-template-img" alt="${tmpl.name}" />` : this.getTemplateSVG(memeData.templateId);
              })()}
            </div>
            <div class="meme-text bottom">${memeData.bottomText}</div>
          </div>
        </div>

        <div class="rubric-criteria-grid">
          <!-- 1. Originality (25 pts) -->
          <div class="rubric-row">
            <div class="crit-info">
              <span class="crit-name">1. ORIGINALITY</span>
              <span class="crit-desc">Fresh tech angle vs recycled cliché</span>
            </div>
            <div class="crit-input-box">
              <input type="number" class="crit-score-input" id="scoreOriginality" min="0" max="25" value="22" />
              <span class="crit-max">/ 25</span>
            </div>
          </div>

          <!-- 2. Humor (25 pts) -->
          <div class="rubric-row">
            <div class="crit-info">
              <span class="crit-name">2. HUMOR</span>
              <span class="crit-desc">Punchline impact & comedic timing</span>
            </div>
            <div class="crit-input-box">
              <input type="number" class="crit-score-input" id="scoreHumor" min="0" max="25" value="23" />
              <span class="crit-max">/ 25</span>
            </div>
          </div>

          <!-- 3. Relevance (25 pts) -->
          <div class="rubric-row">
            <div class="crit-info">
              <span class="crit-name">3. RELEVANCE</span>
              <span class="crit-desc">Technical accuracy & developer culture context</span>
            </div>
            <div class="crit-input-box">
              <input type="number" class="crit-score-input" id="scoreRelevance" min="0" max="25" value="24" />
              <span class="crit-max">/ 25</span>
            </div>
          </div>
        </div>

        <div class="rubric-total-strip">
          <span class="tot-label">TOTAL MEME SCORE:</span>
          <span class="tot-val neon-amber" id="rubricTotalDisplay">69 / 75 PTS</span>
        </div>

        <div class="rubric-actions">
          <button type="button" class="btn-primary-gaming" id="btnConfirmMemeScore">
            CONFIRM SCORE &amp; COMPLETE ROUND 3 →
          </button>
        </div>
      </div>
    `;
  }
}
