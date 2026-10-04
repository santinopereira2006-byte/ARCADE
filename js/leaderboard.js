/**
 * ARCADE - Tournament Leaderboard Manager
 * Manages persistent tournament rankings, podium standings, CSV exports, and score submissions
 */

import { dbApi } from "./api.js";

const STORAGE_KEY = "arcade_tournament_leaderboard";

const DEFAULT_LEADERBOARD = [
  {
    id: "entry-01",
    name: "Santino Pereira",
    department: "AI & Data Science (SY)",
    score: 625,
    maxScore: 650,
    tier: "S",
    tierTitle: "Supreme Arcade Architect",
    badgeClass: "tier-s",
    roundScores: { 1: 100, 2: 100, 3: 145, 4: 190, 5: 90 },
    accuracy: 96,
    date: "2026-09-24",
    time: "18:45"
  },
  {
    id: "entry-02",
    name: "Darpan & Harikrishna",
    department: "Computer Engineering (SY)",
    score: 575,
    maxScore: 650,
    tier: "A",
    tierTitle: "Elite Cyber-Operative",
    badgeClass: "tier-a",
    roundScores: { 1: 95, 2: 90, 3: 135, 4: 170, 5: 85 },
    accuracy: 91,
    date: "2026-09-24",
    time: "19:15"
  },
  {
    id: "entry-03",
    name: "Team CipherSquad",
    department: "Information Technology",
    score: 540,
    maxScore: 650,
    tier: "A",
    tierTitle: "Elite Cyber-Operative",
    badgeClass: "tier-a",
    roundScores: { 1: 90, 2: 85, 3: 125, 4: 160, 5: 80 },
    accuracy: 87,
    date: "2026-09-24",
    time: "19:50"
  },
  {
    id: "entry-04",
    name: "NeuralKnights",
    department: "AI & Machine Learning",
    score: 490,
    maxScore: 650,
    tier: "B",
    tierTitle: "Tactical Arcade Specialist",
    badgeClass: "tier-b",
    roundScores: { 1: 85, 2: 80, 3: 110, 4: 140, 5: 75 },
    accuracy: 82,
    date: "2026-09-24",
    time: "20:10"
  },
  {
    id: "entry-05",
    name: "ByteBrawlers",
    department: "Electronics & Telecomm",
    score: 450,
    maxScore: 650,
    tier: "B",
    tierTitle: "Tactical Arcade Specialist",
    badgeClass: "tier-b",
    roundScores: { 1: 80, 2: 75, 3: 95, 4: 130, 5: 70 },
    accuracy: 78,
    date: "2026-09-24",
    time: "20:30"
  }
];

const ROSTER_KEY = "arcade_registered_teams";

export class LeaderboardManager {
  static cachedRoster = null;
  static cachedEntries = null;
  static isInitialized = false;
  static syncListeners = new Set();

  static onSync(callback) {
    if (typeof callback === 'function') {
      this.syncListeners.add(callback);
    }
  }

  static notifySync(type) {
    this.syncListeners.forEach(fn => {
      try { fn(type); } catch (_) {}
    });
  }

  static async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load initial local cache
    this.getRoster();
    this.getEntries();

    // Async sync from MongoDB
    await this.syncFromDB();

    // Listen to real-time events for live updates across screens
    dbApi.initLiveSync((eventType) => {
      if (eventType === 'teams_updated') {
        this.syncTeamsFromDB().then(() => this.notifySync('teams'));
      } else if (eventType === 'leaderboard_updated') {
        this.syncLeaderboardFromDB().then(() => this.notifySync('leaderboard'));
      }
    });
  }

  static async syncTeamsFromDB() {
    try {
      const teams = await dbApi.getTeams();
      if (Array.isArray(teams)) {
        this.cachedRoster = teams;
        localStorage.setItem(ROSTER_KEY, JSON.stringify(teams));
      }
    } catch (_) {}
  }

  static async syncLeaderboardFromDB() {
    try {
      const entries = await dbApi.getLeaderboard();
      if (Array.isArray(entries)) {
        this.cachedEntries = entries;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      }
    } catch (_) {}
  }

  static async syncFromDB() {
    await Promise.allSettled([
      this.syncTeamsFromDB(),
      this.syncLeaderboardFromDB()
    ]);
  }

  // ==========================================
  // REGISTERED TEAMS ROSTER MANAGEMENT
  // ==========================================
  static getRoster() {
    if (this.cachedRoster) return this.cachedRoster;
    try {
      const raw = localStorage.getItem(ROSTER_KEY);
      if (!raw) {
        this.cachedRoster = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      this.cachedRoster = Array.isArray(parsed) ? parsed : [];
      return this.cachedRoster;
    } catch (e) {
      console.warn("Error reading roster:", e);
      this.cachedRoster = [];
      return [];
    }
  }

  static registerTeam(teamData) {
    const roster = this.getRoster();
    const requestedCode = (teamData.accessCode || "").trim().toUpperCase();
    const accessCode = requestedCode && !roster.some(team => team.accessCode === requestedCode)
      ? requestedCode
      : this.generateAccessCode(roster);
    const newTeam = {
      id: teamData.id || ("team-" + Date.now()),
      name: teamData.name ? teamData.name.trim() : "Challenger " + (roster.length + 1),
      members: teamData.members ? teamData.members.trim() : "",
      department: teamData.department ? teamData.department.trim() : "General Engineering",
      accessCode,
      registeredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "ready", // "ready" | "in-game" | "completed"
      score: 0,
      tier: "—",
      roundScores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
    roster.push(newTeam);
    this.cachedRoster = roster;
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
    } catch (e) {
      console.warn("Error saving roster:", e);
    }

    // Persist to MongoDB in background
    dbApi.createTeam(newTeam).catch(() => {});

    return newTeam;
  }

  static generateAccessCode(roster = this.getRoster()) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    do {
      code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    } while (roster.some(team => team.accessCode === code));
    return code;
  }

  static findTeamByCredentials(teamName, accessCode) {
    const normalizedName = String(teamName || "").trim().toLowerCase();
    const normalizedCode = String(accessCode || "").trim().toUpperCase();
    if (!normalizedName || !normalizedCode) return null;
    return this.getRoster().find(team =>
      String(team?.name || "").trim().toLowerCase() === normalizedName &&
      String(team?.accessCode || "").trim().toUpperCase() === normalizedCode
    ) || null;
  }

  static async findTeamByCredentialsAsync(teamName, accessCode) {
    const local = this.findTeamByCredentials(teamName, accessCode);
    if (local) return local;

    try {
      const res = await dbApi.participantLogin(teamName, accessCode);
      if (res && res.success && res.team) {
        const roster = this.getRoster();
        const existingIdx = roster.findIndex(t => t.id === res.team.id);
        if (existingIdx !== -1) {
          roster[existingIdx] = res.team;
        } else {
          roster.push(res.team);
        }
        this.cachedRoster = roster;
        localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
        return res.team;
      }
    } catch (_) {}

    return null;
  }

  static updateTeamStatus(teamId, status, scoreData = null) {
    const roster = this.getRoster();
    const team = roster.find(t => t.id === teamId);
    if (team) {
      team.status = status;
      if (scoreData) {
        team.score = scoreData.score || team.score;
        team.tier = scoreData.tier || team.tier;
        team.roundScores = scoreData.roundScores || team.roundScores;
      }
      this.cachedRoster = roster;
      try {
        localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
      } catch (e) {}

      // Persist to MongoDB
      dbApi.updateTeam(teamId, {
        status,
        score: team.score,
        tier: team.tier,
        roundScores: team.roundScores
      }).catch(() => {});
    }
  }

  static removeTeam(teamId) {
    let roster = this.getRoster();
    roster = roster.filter(t => t.id !== teamId);
    this.cachedRoster = roster;
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
    } catch (e) {}

    // Delete in MongoDB
    dbApi.deleteTeam(teamId).catch(() => {});
    return roster;
  }

  static clearRoster() {
    this.cachedRoster = [];
    try {
      localStorage.removeItem(ROSTER_KEY);
    } catch (e) {}
    dbApi.clearTeams().catch(() => {});
  }

  // ==========================================
  // TOURNAMENT LEADERBOARD
  // ==========================================
  static getEntries() {
    if (this.cachedEntries) return this.cachedEntries;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.cachedEntries = [...DEFAULT_LEADERBOARD];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LEADERBOARD));
        return this.cachedEntries;
      }
      const parsed = JSON.parse(raw);
      this.cachedEntries = Array.isArray(parsed) ? parsed.sort((a, b) => b.score - a.score) : [...DEFAULT_LEADERBOARD];
      return this.cachedEntries;
    } catch (e) {
      console.warn("Error reading leaderboard:", e);
      this.cachedEntries = [...DEFAULT_LEADERBOARD];
      return this.cachedEntries;
    }
  }

  static addEntry(entryData) {
    const entries = this.getEntries();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].substring(0, 5);

    const newEntry = {
      id: "entry-" + Date.now(),
      name: entryData.name || "Anonymous Challenger",
      department: entryData.department || "General Engineering",
      score: parseInt(entryData.score, 10) || 0,
      maxScore: entryData.maxScore || 650,
      tier: entryData.tier || "B",
      tierTitle: entryData.tierTitle || "Contender",
      badgeClass: entryData.badgeClass || "tier-b",
      roundScores: entryData.roundScores || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      accuracy: entryData.accuracy || 0,
      date: dateStr,
      time: timeStr
    };

    // If an entry for this exact name exists, update if higher score
    const existingIdx = entries.findIndex(e => e.name.toLowerCase() === newEntry.name.toLowerCase());
    if (existingIdx !== -1) {
      if (newEntry.score > entries[existingIdx].score) {
        entries[existingIdx] = newEntry;
      }
    } else {
      entries.push(newEntry);
    }

    entries.sort((a, b) => b.score - a.score);
    this.cachedEntries = entries;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn("Error saving leaderboard entry:", e);
    }

    // Persist to MongoDB
    dbApi.addLeaderboardEntry(newEntry).catch(() => {});

    return newEntry;
  }

  static resetLeaderboard() {
    this.cachedEntries = [...DEFAULT_LEADERBOARD];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LEADERBOARD));
    } catch (e) {
      console.warn("Error resetting leaderboard:", e);
    }
    dbApi.resetLeaderboard().catch(() => {});
    return [...DEFAULT_LEADERBOARD];
  }

  static exportCSV() {
    const entries = this.getEntries();
    let csv = "Rank,Contestant/Team,Department,Score,Max Score,Tier,Round 1,Round 2,Round 3,Round 4,Accuracy %,Date,Time\n";

    entries.forEach((e, idx) => {
      const r1 = e.roundScores ? e.roundScores[1] || 0 : 0;
      const r2 = e.roundScores ? e.roundScores[2] || 0 : 0;
      const r3 = e.roundScores ? e.roundScores[3] || 0 : 0;
      const r4 = e.roundScores ? e.roundScores[4] || 0 : 0;
      const r5 = e.roundScores ? e.roundScores[5] || 0 : 0;

      csv += `"${idx + 1}","${(e.name || '').replace(/"/g, '""')}","${(e.department || '').replace(/"/g, '""')}",${e.score},${e.maxScore},"${e.tier}",${r1},${r2},${r3},${r4},${r5},${e.accuracy},"${e.date}","${e.time}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `arcade_tournament_leaderboard_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static renderScreen(container, { onStartRun, onBackHome }) {
    const entries = this.getEntries();
    const top3 = entries.slice(0, 3);
    const rest = entries.slice(3);

    const getRankIcon = (idx) => {
      if (idx === 0) return "🥇";
      if (idx === 1) return "🥈";
      if (idx === 2) return "🥉";
      return `#${idx + 1}`;
    };

    container.innerHTML = `
      <div class="leaderboard-container">
        <!-- Top Tournament Header Strip -->
        <div class="leaderboard-header">
          <div class="header-badge-tag">CSI TECHNICAL SYMPOSIUM 2026</div>
          <h1 class="leaderboard-main-title glitch-title" data-text="TOURNAMENT LEADERBOARD">TOURNAMENT LEADERBOARD</h1>
          <p class="leaderboard-sub">Live Championship Standings &amp; Hall of Records</p>
        </div>

        <!-- Hall of Champions Podium (Top 3) -->
        <div class="leaderboard-podium-grid">
          <!-- 2nd Place -->
          ${top3[1] ? `
            <div class="podium-card podium-silver">
              <div class="podium-crown">🥈 2ND PLACE</div>
              <div class="podium-avatar">🛡️</div>
              <h3 class="podium-name">${top3[1].name}</h3>
              <span class="podium-dept">${top3[1].department}</span>
              <div class="podium-score-chip">
                <span class="score-number">${top3[1].score}</span>
                <span class="score-total">/ ${top3[1].maxScore} PTS</span>
              </div>
              <span class="tier-pill ${top3[1].badgeClass || 'tier-a'}">${top3[1].tier}-TIER</span>
            </div>
          ` : ''}

          <!-- 1st Place (Champion Center) -->
          ${top3[0] ? `
            <div class="podium-card podium-gold champion-card">
              <div class="podium-crown gold-crown">👑 TOURNAMENT CHAMPION</div>
              <div class="podium-avatar champ-avatar">🏆</div>
              <h2 class="podium-name champ-name">${top3[0].name}</h2>
              <span class="podium-dept champ-dept">${top3[0].department}</span>
              <div class="podium-score-chip champ-chip">
                <span class="score-number">${top3[0].score}</span>
                <span class="score-total">/ ${top3[0].maxScore} PTS</span>
              </div>
              <span class="tier-pill ${top3[0].badgeClass || 'tier-s'}">${top3[0].tier}-TIER • ${top3[0].tierTitle}</span>
            </div>
          ` : ''}

          <!-- 3rd Place -->
          ${top3[2] ? `
            <div class="podium-card podium-bronze">
              <div class="podium-crown">🥉 3RD PLACE</div>
              <div class="podium-avatar">⚔️</div>
              <h3 class="podium-name">${top3[2].name}</h3>
              <span class="podium-dept">${top3[2].department}</span>
              <div class="podium-score-chip">
                <span class="score-number">${top3[2].score}</span>
                <span class="score-total">/ ${top3[2].maxScore} PTS</span>
              </div>
              <span class="tier-pill ${top3[2].badgeClass || 'tier-b'}">${top3[2].tier}-TIER</span>
            </div>
          ` : ''}
        </div>

        <!-- Search & Control Toolbar -->
        <div class="leaderboard-toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="lbSearchInput" class="lb-search-input" placeholder="Search by contestant, team, or department..." />
          </div>
          <div class="toolbar-actions">
            <button type="button" class="btn-secondary-gaming" id="btnExportCSV" title="Export tournament rankings to CSV">
              📥 EXPORT CSV
            </button>
            <button type="button" class="btn-secondary-gaming" id="btnResetLeaderboard" title="Reset leaderboard to defaults">
              🔄 RESET
            </button>
          </div>
        </div>

        <!-- Detailed Leaderboard Table -->
        <div class="leaderboard-table-wrapper">
          <table class="leaderboard-table" id="leaderboardTable">
            <thead>
              <tr>
                <th class="th-rank">RANK</th>
                <th class="th-name">CONTESTANT / TEAM</th>
                <th class="th-dept">DEPARTMENT</th>
                <th class="th-rounds">ROUNDS (R1 / R2 / R3 / R4 / R5)</th>
                <th class="th-acc">ACCURACY</th>
                <th class="th-score">TOTAL SCORE</th>
                <th class="th-tier">TIER</th>
              </tr>
            </thead>
            <tbody id="leaderboardTbody">
              ${entries.map((e, idx) => `
                <tr class="lb-row ${idx < 3 ? 'top-three-row' : ''}">
                  <td class="td-rank">
                    <span class="rank-badge rank-${idx + 1}">${getRankIcon(idx)}</span>
                  </td>
                  <td class="td-name">
                    <strong>${e.name}</strong>
                    <span class="row-date">${e.date || ''}</span>
                  </td>
                  <td class="td-dept">${e.department || '—'}</td>
                  <td class="td-rounds">
                    <span class="round-dot-score">R1: ${e.roundScores ? e.roundScores[1] || 0 : 0}</span>
                    <span class="round-dot-score">R2: ${e.roundScores ? e.roundScores[2] || 0 : 0}</span>
                    <span class="round-dot-score">R3: ${e.roundScores ? e.roundScores[3] || 0 : 0}</span>
                    <span class="round-dot-score">R4: ${e.roundScores ? e.roundScores[4] || 0 : 0}</span>
                    <span class="round-dot-score">R5: ${e.roundScores ? e.roundScores[5] || 0 : 0}</span>
                  </td>
                  <td class="td-acc">${e.accuracy || 0}%</td>
                  <td class="td-score">
                    <span class="table-score-highlight">${e.score}</span>
                    <span class="table-score-max">/ ${e.maxScore}</span>
                  </td>
                  <td class="td-tier">
                    <span class="tier-pill ${e.badgeClass || 'tier-b'}">${e.tier}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Navigation Action Buttons -->
        <div class="leaderboard-bottom-actions">
          <button type="button" class="btn-secondary-gaming" id="btnLeaderboardHome">
            ← BACK TO HOME
          </button>
          <button type="button" class="btn-primary-gaming" id="btnLeaderboardPlay">
            START NEW RUN ▶
          </button>
        </div>
      </div>
    `;

    // Bind Search Filtering
    const searchInput = document.getElementById("lbSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (ev) => {
        const query = ev.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll("#leaderboardTbody tr");
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? "" : "none";
        });
      });
    }

    // Bind Export CSV
    const exportBtn = document.getElementById("btnExportCSV");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportCSV());
    }

    // Bind Reset
    const resetBtn = document.getElementById("btnResetLeaderboard");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("Reset tournament leaderboard to default initial records?")) {
          this.resetLeaderboard();
          this.renderScreen(container, { onStartRun, onBackHome });
        }
      });
    }

    // Bind Navigation
    const homeBtn = document.getElementById("btnLeaderboardHome");
    if (homeBtn && onBackHome) {
      homeBtn.addEventListener("click", onBackHome);
    }

    const playBtn = document.getElementById("btnLeaderboardPlay");
    if (playBtn && onStartRun) {
      playBtn.addEventListener("click", onStartRun);
    }
  }
}

// Automatically sync with database on load
LeaderboardManager.init();

